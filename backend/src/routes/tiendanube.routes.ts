import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { markPacked } from '../services/tiendanube.service';

const router = Router();
const prisma = new PrismaClient();

router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    const customerEmail = payload?.customer?.email || payload?.email;
    if (!customerEmail) {
      return res.status(400).json({ error: 'Email de cliente no disponible en webhook' });
    }
    const customerName = payload?.customer?.name || payload?.billing?.name || customerEmail;
    let client = await prisma.client.findFirst({ where: { email: customerEmail } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          name: customerName,
          email: customerEmail,
          phone: payload?.customer?.phone || '',
          company: payload?.customer?.company || '',
        },
      });
    }
    const itemsRaw = payload?.items || payload?.products || [];
    const items = itemsRaw.map((it: any) => ({
      productId: it?.product_id ? String(it.product_id) : undefined,
      description: it?.name || it?.title || 'Item',
      quantity: Number(it?.quantity || it?.qty || 1),
      unitPrice: Number(it?.price || it?.unit_price || it?.unitPrice || 0),
      taxRate: 21,
      discountRate: 0,
    }));
    const config = await prisma.invoiceConfig.findFirst() || await prisma.invoiceConfig.create({
      data: {
        companyName: 'Mi Empresa',
        companyAddress: 'Dirección',
        invoicePrefix: 'INV',
        nextInvoiceNumber: 1,
        defaultTaxRate: 21.0,
        defaultCurrency: 'ARS',
        paymentTermsDays: 30,
      },
    });
    const invoiceNumber = `${config.invoicePrefix}-${String(config.nextInvoiceNumber).padStart(6, '0')}`;
    let subtotal = 0;
    let taxAmount = 0;
    const processedItems = items.map((item: any) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = itemSubtotal * (item.discountRate / 100);
      const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount;
      const itemTax = itemSubtotalAfterDiscount * (item.taxRate / 100);
      const itemTotal = itemSubtotalAfterDiscount + itemTax;
      subtotal += itemSubtotalAfterDiscount;
      taxAmount += itemTax;
      return { ...item, totalAmount: itemTotal };
    });
    const totalAmount = subtotal + taxAmount;
    const invoice = await prisma.invoice.create({
      data: {
        clientId: client.id,
        subtotal,
        taxAmount,
        discountAmount: 0,
        totalAmount,
        currency: config.defaultCurrency,
        status: 'DRAFT',
        invoiceNumber,
        items: { create: processedItems },
      },
      include: { client: true, items: true },
    });
    const tnOrderId = String(payload?.id || payload?.order_id || '');
    if (tnOrderId) {
      await prisma.configuration.upsert({
        where: { key: `tn_order_${invoice.id}` },
        update: { value: tnOrderId },
        create: { key: `tn_order_${invoice.id}`, value: tnOrderId },
      });
    }
    await prisma.invoiceConfig.update({
      where: { id: config.id },
      data: { nextInvoiceNumber: config.nextInvoiceNumber + 1 },
    });
    res.status(201).json({ message: 'Borrador de factura creado', invoice });
  } catch (error) {
    console.error('Error en webhook Tiendanube:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
});

router.post('/orders/:invoiceId/mark-packed', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const cfg = await prisma.configuration.findUnique({ where: { key: `tn_order_${invoiceId}` } });
    if (!cfg?.value) {
      return res.status(404).json({ error: 'Orden Tiendanube no encontrada para la factura' });
    }
    await markPacked(cfg.value);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marcando como empaquetado en Tiendanube:', error);
    res.status(500).json({ error: 'No se pudo actualizar el estado en Tiendanube' });
  }
});

export default router;
