import { PrismaClient } from '@prisma/client';
import { addBatch, deductFromBatches, computeVariantStock, syncVariantStocksForAllocations } from '../src/services/stock.service';
import * as tnService from '../src/services/tiendanube.service';

async function main() {
  const prisma = new PrismaClient();
  const tnCalls: Array<{ sku: string, stock: number }> = [];
  (tnService as any).updateVariantStockBySku = async (sku: string, stock: number) => {
    tnCalls.push({ sku, stock });
    return;
  };

  const product = await prisma.product.create({
    data: {
      name: 'Whey Protein',
      description: 'Proteína de suero',
      price: 2000,
      stock: 0,
      minStock: 10,
    }
  });

  let variant = await (prisma as any).productVariant.findFirst({ where: { sku: 'WP-TEST-001' } });
  if (!variant) {
    variant = await (prisma as any).productVariant.create({
      data: {
        productId: product.id,
        sku: 'WP-TEST-001',
        name: 'Whey Vainilla 1kg',
        flavor: 'Vainilla',
        size: '1kg',
      }
    });
  }

  const client = await prisma.client.create({
    data: {
      name: 'Juan Perez',
      email: 'juan@example.com',
      phone: '11111111',
      company: 'El Nogal',
    }
  });

  const b1 = await addBatch(product.id, 5, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), 1000, { variantId: variant.id, batchNumber: 'L1', shelfLocation: 'A1' });
  const b2 = await addBatch(product.id, 10, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), 1200, { variantId: variant.id, batchNumber: 'L2', shelfLocation: 'B2' });
  console.log('Lote creado:', { b1, b2 });

  const qtyToSell = 7;
  const res = await deductFromBatches(product.id, qtyToSell);
  const averageCost = res.averageCost;
  const allocations = res.allocations;

  const invoice = await (prisma as any).invoice.create({
    data: {
      invoiceNumber: `TEST-${Date.now()}`,
      clientId: client.id,
      subtotal: qtyToSell * 2000,
      taxAmount: 0,
      totalAmount: qtyToSell * 2000,
      currency: 'ARS',
      status: 'PAID',
      items: {
        create: [{
          description: variant.name || 'Whey',
          productId: product.id,
          variantId: variant.id,
          quantity: qtyToSell,
          unitPrice: 2000,
          taxRate: 0,
          discountRate: 0,
          totalAmount: qtyToSell * 2000,
          costPrice: averageCost,
        }] as any
      }
    },
    include: { items: true }
  });

  for (const a of allocations) {
    await (prisma as any).invoiceItemBatch.create({
      data: {
        invoiceItemId: (invoice as any).items[0].id,
        batchId: a.batchId,
        quantity: a.quantity,
        costPrice: a.costPrice,
      }
    });
  }

  await syncVariantStocksForAllocations(allocations.map(a => ({ batchId: a.batchId })));

  const batches = await (prisma as any).batch.findMany({
    where: { productId: product.id },
    orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, batchNumber: true, quantity: true, costPrice: true }
  });

  const vStock = await computeVariantStock(variant.id);

  console.log('Stock remanente por lote:', batches);
  console.log('Costo promedio de venta:', averageCost);

  let afipCfg = await prisma.afipConfig.findFirst({ where: { cuit: '30123456789' } });
  if (!afipCfg) {
    afipCfg = await prisma.afipConfig.create({
      data: {
        cuit: '30123456789',
        certificatePath: '/tmp/cert.crt',
        privateKeyPath: '/tmp/key.key',
        environment: 'TESTING',
        puntoVenta: 5,
        isActive: true,
      }
    });
  } else {
    await prisma.afipConfig.update({ where: { id: afipCfg.id }, data: { isActive: true, puntoVenta: 5 } });
  }

  const afipInvoice = await prisma.afipInvoice.create({
    data: {
      invoiceId: invoice.id,
      cae: '71234567890123',
      caeExpiration: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      ticketNumber: 1,
      puntoVenta: 5,
      tipoComprobante: 11,
      numeroComprobante: 1234,
      fechaEmision: new Date(),
      importeTotal: invoice.totalAmount,
      importeNeto: invoice.subtotal,
      importeIva: invoice.taxAmount,
      status: 'AUTHORIZED',
    }
  });

  const qrPayload = {
    ver: 1,
    fecha: new Date(afipInvoice.fechaEmision).toISOString().split('T')[0],
    cuit: Number(afipCfg.cuit),
    ptoVta: afipInvoice.puntoVenta,
    tipoCmp: afipInvoice.tipoComprobante,
    nroCmp: afipInvoice.numeroComprobante,
    importe: Number(invoice.totalAmount),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: 99,
    nroDocRec: 0,
    tipoCodAut: 'E',
    codAut: Number(String(afipInvoice.cae)),
  };
  console.log('AFIP QR JSON:', qrPayload);

  console.log('Sync Tiendanube llamadas:', tnCalls);
  console.log('Stock variante sincronizado:', vStock);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
