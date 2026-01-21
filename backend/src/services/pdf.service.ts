import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { getOrder } from './tiendanube.service';

const prisma = new PrismaClient();

function simpleTemplate(html: string, data: Record<string, any>): string {
  let out = html;
  // Sections: {{#items}}...{{/items}}
  out = out.replace(/\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g, (_m, inner) => {
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((it: any) => {
      let row = inner;
      Object.keys(it).forEach(k => {
        row = row.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(it[k] ?? ''));
      });
      return row;
    }).join('');
  });
  Object.keys(data).forEach(k => {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(data[k] ?? ''));
  });
  return out;
}

async function renderHtmlToPdf(
  html: string,
  filepath: string,
  fallbackData?: {
    companyName: string;
    companyAddress: string;
    companyTaxId: string;
    invoiceNumber: string;
    issuedDate: string;
    status: string;
    clientName: string;
    clientEmail: string;
    cae: string;
    caeExpiration: string;
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
    items: Array<{ description: string; quantity: number; unitPrice: string; taxRate: string; total: string }>;
  }
): Promise<void> {
  try {
    const puppeteer = require('puppeteer-core');
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' } });
    await browser.close();
    await fs.promises.writeFile(filepath, pdfBuffer);
  } catch (e) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);
    const d = fallbackData || {
      companyName: '',
      companyAddress: '',
      companyTaxId: '',
      invoiceNumber: '',
      issuedDate: '',
      status: '',
      clientName: '',
      clientEmail: '',
      cae: '',
      caeExpiration: '',
      subtotal: '0.00',
      taxAmount: '0.00',
      totalAmount: '0.00',
      items: [],
    };
    doc.fontSize(18).text('Factura', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(d.companyName);
    doc.text(d.companyAddress);
    doc.text(d.companyTaxId);
    doc.moveDown();
    doc.fontSize(12).text(`Número: ${d.invoiceNumber}`);
    doc.text(`Fecha: ${d.issuedDate}`);
    doc.text(`Estado: ${d.status}`);
    doc.moveDown();
    doc.text(`Cliente: ${d.clientName}`);
    if (d.clientEmail) doc.text(`Email: ${d.clientEmail}`);
    doc.moveDown();
    if (d.cae) {
      doc.text(`CAE: ${d.cae}`);
      if (d.caeExpiration) doc.text(`Vencimiento CAE: ${d.caeExpiration}`);
      doc.moveDown();
    }
    doc.fontSize(11).text('Items');
    doc.moveDown(0.5);
    const startY = doc.y;
    const colX = [50, 260, 330, 400, 470];
    ['Descripción', 'Cantidad', 'Precio', 'IVA %', 'Total'].forEach((h, i) => doc.text(h, colX[i], startY));
    d.items.forEach((it, idx) => {
      const y = startY + 20 + idx * 18;
      doc.text(it.description, colX[0], y, { width: 200 });
      doc.text(String(it.quantity), colX[1], y);
      doc.text(it.unitPrice, colX[2], y);
      doc.text(it.taxRate, colX[3], y);
      doc.text(it.total, colX[4], y);
    });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Subtotal: $${d.subtotal}`, { align: 'right' });
    doc.text(`IVA: $${d.taxAmount}`, { align: 'right' });
    doc.text(`Total: $${d.totalAmount}`, { align: 'right' });
    doc.end();
    await new Promise<void>((resolve) => writeStream.on('finish', () => resolve()));
  }
}

async function buildAfipQrDataUrl(invoice: any, afipCfg: any): Promise<string> {
  try {
    const QRCode = require('qrcode');
    const fecha = new Date(invoice.afipInvoice.fechaEmision).toISOString().split('T')[0];
    const cuit = String(afipCfg.cuit).replace(/\D/g, '');
    const ptoVta = Number(invoice.afipInvoice.puntoVenta);
    const tipoCmp = Number(invoice.afipInvoice.tipoComprobante);
    const nroCmp = Number(invoice.afipInvoice.numeroComprobante);
    const importe = Number(invoice.totalAmount);
    const moneda = invoice.currency || 'PES';
    const ctz = 1;
    // Default receptor: Consumidor Final
    const tipoDocRec = 99;
    const nroDocRec = 0;
    const tipoCodAut = 'E';
    const codAutRaw = String(invoice.afipInvoice.cae || '').replace(/\D/g, '');
    const codAut = codAutRaw ? Number(codAutRaw) : 0;
    const payload = {
      ver: 1,
      fecha,
      cuit: Number(cuit),
      ptoVta,
      tipoCmp,
      nroCmp,
      importe,
      moneda,
      ctz,
      tipoDocRec,
      nroDocRec,
      tipoCodAut,
      codAut,
    };
    const baseUrl = 'https://www.afip.gob.ar/fe/qr/?p=';
    const base64Json = Buffer.from(JSON.stringify(payload)).toString('base64');
    const fullUrl = baseUrl + base64Json;
    return await QRCode.toDataURL(fullUrl);
  } catch {
    return '';
  }
}

async function buildTrackingQrDataUrl(invoiceId: string): Promise<string> {
  try {
    const QRCode = require('qrcode');
    const cfg = await prisma.configuration.findUnique({ where: { key: `tn_order_${invoiceId}` } });
    const tnOrderId = cfg?.value;
    if (!tnOrderId) return '';
    const order = await getOrder(String(tnOrderId));
    const candidates = [
      order?.tracking_url,
      order?.shipping?.tracking_url,
      Array.isArray(order?.shipments) && order.shipments.length > 0 ? order.shipments[0]?.tracking_url : undefined,
    ].filter(Boolean);
    let trackingUrl = candidates[0] as string | undefined;
    const trackingNumber = order?.shipping?.tracking_number || (Array.isArray(order?.shipments) && order.shipments[0]?.tracking_number) || order?.tracking_number;
    if (!trackingUrl && trackingNumber && process.env.TRACKING_LOOKUP_BASE_URL) {
      trackingUrl = `${process.env.TRACKING_LOOKUP_BASE_URL}${trackingNumber}`;
    }
    if (!trackingUrl) {
      const base = process.env.TIENDANUBE_TRACKING_BASE_URL || '';
      trackingUrl = base && tnOrderId ? `${base}/${tnOrderId}` : '';
    }
    if (!trackingUrl) return '';
    return await QRCode.toDataURL(String(trackingUrl));
  } catch {
    return '';
  }
}

export class PdfHtmlService {
  private uploadsDir = path.join(__dirname, '../../uploads/invoices');

  constructor() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async generateAndAttach(invoiceId: string, force = false): Promise<{ filepath: string, url: string }> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        items: true,
        afipInvoice: true,
      },
    });
    if (!invoice) throw new Error('Invoice not found');

    // Cache: use existing pdf if present and not forcing
    if (!force && (invoice as any).pdfUrl) {
      const existingPath = path.join(this.uploadsDir, path.basename((invoice as any).pdfUrl));
      if (fs.existsSync(existingPath)) {
        return { filepath: existingPath, url: (invoice as any).pdfUrl };
      }
    }

    const filename = `${crypto.randomUUID()}.pdf`;
    const filepath = path.join(this.uploadsDir, filename);
    const url = `/uploads/invoices/${filename}`;

    const afipCfg = await prisma.afipConfig.findFirst({ where: { isActive: true } });
    const qrUrl = (invoice.afipInvoice && afipCfg) ? await buildAfipQrDataUrl(invoice, afipCfg) : '';
    const trackingQrUrl = await buildTrackingQrDataUrl(invoice.id);

    const tplPath = path.join(__dirname, '../templates/invoice.html');
    const tpl = fs.readFileSync(tplPath, 'utf-8');
    const html = simpleTemplate(tpl, {
      companyName: 'El Nogal',
      companyAddress: 'Av. Siempreviva 742, CABA',
      companyTaxId: 'CUIT 30-00000000-0',
      logoUrl: process.env.COMPANY_LOGO_URL || '',
      invoiceNumber: invoice.invoiceNumber,
      issuedDate: new Date(invoice.issuedAt).toLocaleDateString(),
      status: invoice.status,
      clientName: invoice.client?.name || '',
      clientEmail: invoice.client?.email || '',
      cae: invoice.afipInvoice?.cae || '',
      caeExpiration: invoice.afipInvoice?.caeExpiration ? new Date(invoice.afipInvoice.caeExpiration).toLocaleDateString() : '',
      qrImageUrl: qrUrl,
      trackingQrUrl,
      subtotal: invoice.subtotal.toFixed(2),
      taxAmount: invoice.taxAmount.toFixed(2),
      totalAmount: invoice.totalAmount.toFixed(2),
      items: invoice.items.map(it => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice.toFixed(2),
        taxRate: (it.taxRate || 0).toFixed(0),
        total: it.totalAmount.toFixed(2),
        discountRate: (it.discountRate || 0).toFixed(0),
      })),
    });

    await renderHtmlToPdf(html, filepath, {
      companyName: 'El Nogal',
      companyAddress: 'Av. Siempreviva 742, CABA',
      companyTaxId: 'CUIT 30-00000000-0',
      invoiceNumber: invoice.invoiceNumber,
      issuedDate: new Date(invoice.issuedAt).toLocaleDateString(),
      status: invoice.status,
      clientName: invoice.client?.name || '',
      clientEmail: invoice.client?.email || '',
      cae: invoice.afipInvoice?.cae || '',
      caeExpiration: invoice.afipInvoice?.caeExpiration ? new Date(invoice.afipInvoice.caeExpiration).toLocaleDateString() : '',
      subtotal: invoice.subtotal.toFixed(2),
      taxAmount: invoice.taxAmount.toFixed(2),
      totalAmount: invoice.totalAmount.toFixed(2),
      items: invoice.items.map(it => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice.toFixed(2),
        taxRate: (it.taxRate || 0).toFixed(0),
        total: it.totalAmount.toFixed(2),
      })),
    });

    await (prisma as any).invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl: url },
    });

    return { filepath, url };
  }
}
