import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { InvoiceModel } from '../models/invoice.model';
import { ApiError } from '../utils/ApiError';

export class PDFService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads/invoices');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async generateInvoicePDF(invoiceId: string): Promise<string> {
    const invoice = await InvoiceModel.findOne({ id: invoiceId });
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    const doc = new PDFDocument();
    const filename = `invoice-${invoice.number}-${Date.now()}.pdf`;
    const filepath = path.join(this.uploadDir, filename);
    const writeStream = fs.createWriteStream(filepath);

    doc.pipe(writeStream);

    // Header
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();

    // Invoice Details
    doc.fontSize(12)
      .text(`Invoice Number: ${invoice.number}`)
      .text(`Date: ${invoice.date.toLocaleDateString()}`)
      .text(`Status: ${invoice.status}`)
      .moveDown();

    // Customer Details
    if (invoice.customer) {
      doc.text(`Customer: ${invoice.customer.name}`)
         .text(`ID: ${invoice.customer.id}`)
         .moveDown();
    }

    // Items Table
    doc.fontSize(10);
    const tableTop = doc.y;
    this.generateItemsTable(doc, invoice.items, tableTop);

    // Totals
    doc.fontSize(12)
      .text(`Subtotal: $${invoice.subtotal}`, { align: 'right' })
      .text(`Tax: $${invoice.tax}`, { align: 'right' })
      .text(`Total: $${invoice.total}`, { align: 'right' })
      .moveDown();

    // Payment Details if paid
    if (invoice.status === 'paid' && invoice.paymentDetails) {
      doc.text('Payment Information')
        .text(`Method: ${invoice.paymentDetails.method}`)
        .text(`Paid At: ${invoice.paymentDetails.paidAt?.toLocaleDateString()}`);
    }

    doc.end();

    // Fix Promise typing
    await new Promise<void>((resolve) => writeStream.on('finish', () => resolve()));

    // Update invoice with PDF info
    invoice.set('pdfGenerated', {
      lastGenerated: new Date(),
      url: `/uploads/invoices/${filename}`,
      version: (invoice.pdfGenerated?.version || 0) + 1
    });
    await invoice.save();

    return filepath;
  }

  private generateItemsTable(doc: PDFKit.PDFDocument, items: any[], startY: number) {
    const headers = ['Description', 'Quantity', 'Unit Price', 'Tax Rate', 'Total'];
    const columnWidth = 100;
    
    headers.forEach((header, i) => {
      doc.text(header, 50 + (i * columnWidth), startY);
    });

    items.forEach((item, index) => {
      const y = startY + 20 + (index * 20);
      doc.text(item.description, 50, y)
         .text(item.quantity.toString(), 150, y)
         .text(item.unitPrice.toString(), 250, y)
         .text(item.taxRate.toString(), 350, y)
         .text(item.total.toString(), 450, y);
    });
  }
}