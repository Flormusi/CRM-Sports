import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { deductFromBatches, syncVariantStocksForAllocations } from '../services/stock.service';
import { PdfHtmlService } from '../services/pdf.service';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// Schemas de validación
const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.string().uuid().optional(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    taxRate: z.number().min(0).max(100).default(21),
    discountRate: z.number().min(0).max(100).default(0),
  })),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateInvoiceSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).optional(),
  notes: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentReference: z.string().optional(),
  paidDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
});

const invoiceConfigSchema = z.object({
  companyName: z.string().min(1),
  companyAddress: z.string().min(1),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email().optional(),
  taxId: z.string().optional(),
  logoUrl: z.string().url().optional(),
  invoicePrefix: z.string().default('INV'),
  defaultTaxRate: z.number().min(0).max(100).default(21),
  defaultCurrency: z.string().default('ARS'),
  paymentTermsDays: z.number().positive().default(30),
  autoGenerateInvoices: z.boolean().default(false),
  emailTemplate: z.string().optional(),
  footerText: z.string().optional(),
});

export class InvoiceController {
  // Obtener todas las facturas
  static async getInvoices(req: Request, res: Response) {
    try {
      const { 
        status, 
        clientId, 
        dateFrom, 
        dateTo,
        page = '1', 
        limit = '20' 
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (clientId) {
        where.clientId = clientId;
      }

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) {
          where.createdAt.gte = new Date(dateFrom as string);
        }
        if (dateTo) {
          where.createdAt.lte = new Date(dateTo as string);
        }
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                company: true,
              },
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            order: {
              select: {
                id: true,
                status: true,
              },
            },
            afipInvoice: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.invoice.count({ where }),
      ]);

      res.json({
        invoices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error al obtener facturas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener factura por ID
  static async getInvoiceById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          client: true,
          items: {
            include: {
              product: true,
            },
          },
          order: true,
        },
      });

      if (!invoice) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }

      res.json(invoice);
    } catch (error) {
      console.error('Error al obtener factura:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear nueva factura
  static async createInvoice(req: Request, res: Response) {
    try {
      const validatedData = createInvoiceSchema.parse(req.body);
      const { items, ...invoiceData } = validatedData;

      const client = await prisma.client.findUnique({ where: { id: invoiceData.clientId } });
      if (!client) {
        return res.status(400).json({ error: 'Faltan datos del cliente o el cliente no existe' });
      }
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'La factura debe contener al menos un item' });
      }

      // Obtener configuración de facturación
      const config = await InvoiceController.getOrCreateConfig();
      
      // Generar número de factura
      const invoiceNumber = `${config.invoicePrefix}-${config.nextInvoiceNumber.toString().padStart(6, '0')}`;

      // Calcular totales
      let subtotal = 0;
      let taxAmount = 0;

      const totalAmount = subtotal + taxAmount - (invoiceData.discountAmount || 0);

      // Crear items con costo promedio del lote y descontar stock por item
      const processedItems: any[] = [];
      const processedAllocations: Array<Array<{ batchId: string, quantity: number, costPrice: number }>> = [];
      for (const item of items) {
        let avgCost = 0;
        let allocations: Array<{ batchId: string, quantity: number, costPrice: number }> = [];
        if (item.productId) {
          let deduction;
          try {
            deduction = await deductFromBatches(item.productId as string, item.quantity, (item as any).variantId);
          } catch (e: any) {
            if (e?.message) {
              return res.status(400).json({ error: e.message });
            }
            return res.status(400).json({ error: 'Error al descontar stock por lotes' });
          }
          avgCost = deduction.averageCost;
          allocations = deduction.allocations;
        }
        const itemSubtotal = item.quantity * item.unitPrice;
        const itemDiscount = itemSubtotal * (item.discountRate / 100);
        const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount;
        const itemTax = itemSubtotalAfterDiscount * (item.taxRate / 100);
        const itemTotal = itemSubtotalAfterDiscount + itemTax;
        subtotal += itemSubtotalAfterDiscount;
        taxAmount += itemTax;
        processedItems.push({ ...item, totalAmount: itemTotal, costPrice: avgCost });
        processedAllocations.push(allocations);
      }

      // Crear factura con items
      const invoice = await prisma.invoice.create({
        data: {
          ...invoiceData,
          invoiceNumber,
          subtotal,
          taxAmount,
          totalAmount,
          currency: config.defaultCurrency,
          dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : 
                   new Date(Date.now() + config.paymentTermsDays * 24 * 60 * 60 * 1000),
          items: {
            create: processedItems as any,
          },
        },
        include: {
          client: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Persist batch allocations per item
      for (let i = 0; i < invoice.items.length; i++) {
        const item = invoice.items[i];
        const allocs = processedAllocations[i] || [];
        for (const a of allocs) {
          await (prisma as any).invoiceItemBatch.create({
            data: {
              invoiceItemId: item.id,
              batchId: a.batchId,
              quantity: a.quantity,
              costPrice: a.costPrice,
            }
          });
        }
      }
      await syncVariantStocksForAllocations(processedAllocations.flat());

      // Actualizar contador de facturas
      await prisma.invoiceConfig.update({
        where: { id: config.id },
        data: {
          nextInvoiceNumber: config.nextInvoiceNumber + 1,
        },
      });

      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de entrada inválidos', 
          details: error.errors 
        });
      }
      if (error instanceof Error) {
        const msg = error.message || '';
        const known = [
          'No hay stock suficiente en los lotes',
          'Faltan datos del cliente o el cliente no existe',
          'La factura debe contener al menos un item',
        ];
        if (known.includes(msg)) {
          return res.status(400).json({ error: msg });
        }
      }
      try {
        const prismaCode = (error as any)?.code;
        const prismaMeta = (error as any)?.meta;
        console.error('Error al crear factura (Prisma):', { code: prismaCode, meta: prismaMeta, error });
      } catch {
        console.error('Error al crear factura:', error);
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar factura
  static async updateInvoice(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateInvoiceSchema.parse(req.body);

      const updateData: any = { ...validatedData };
      
      if (validatedData.paidDate) {
        updateData.paidDate = new Date(validatedData.paidDate);
      }
      
      if (validatedData.dueDate) {
        updateData.dueDate = new Date(validatedData.dueDate);
      }

      // If moving to CANCELLED, restore stock to batches based on allocations
      if (validatedData.status === 'CANCELLED') {
        const inv = await prisma.invoice.findUnique({
          where: { id },
          include: { items: true },
        });
        if (inv) {
          const itemIds = inv.items.map(i => i.id);
          const allocations = await (prisma as any).invoiceItemBatch.findMany({
            where: { invoiceItemId: { in: itemIds } }
          });
          await (prisma as any).$transaction(async (tx: any) => {
            for (const a of allocations as any[]) {
              const batch = await tx.batch.findUnique({ where: { id: a.batchId } });
              if (!batch) continue;
              await tx.batch.update({
                where: { id: a.batchId },
                data: { quantity: batch.quantity + a.quantity },
              });
            }
            // Recompute product stocks impacted
            const batchIds = Array.from(new Set((allocations as any[]).map((a: any) => a.batchId)));
            const batches = await tx.batch.findMany({ where: { id: { in: batchIds } } });
            const productIds = Array.from(new Set((batches as any[]).map((b: any) => b.productId)));
            for (const pid of productIds as string[]) {
              const agg = await tx.batch.aggregate({ where: { productId: pid }, _sum: { quantity: true } });
              await tx.product.update({ where: { id: pid }, data: { stock: agg._sum.quantity || 0 } });
            }
          });
        }
      }

      const invoice = await prisma.invoice.update({
        where: { id },
        data: updateData,
        include: {
          client: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de entrada inválidos', 
          details: error.errors 
        });
      }
      console.error('Error al actualizar factura:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Eliminar factura
  static async deleteInvoice(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const invoice = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!invoice) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }

      if (invoice.status === 'PAID') {
        return res.status(400).json({ error: 'No se puede eliminar una factura pagada' });
      }

      await prisma.invoice.delete({
        where: { id },
      });

      res.json({ message: 'Factura eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar factura:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  static async generatePdf(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const inv = await prisma.invoice.findUnique({ where: { id } });
      if (!inv) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }
      const pdfService = new PdfHtmlService();
      const { url } = await pdfService.generateAndAttach(id, true);
      const absolute = `${req.protocol}://${req.get('host')}${url}`;
      res.json({ success: true, url: absolute });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      res.status(500).json({ error: 'No se pudo generar el PDF' });
    }
  }

  static async downloadPdf(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const inv = await prisma.invoice.findUnique({ where: { id } });
      if (!inv) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }
      let pdfUrl = (inv as any).pdfUrl as string | undefined;
      if (!pdfUrl) {
        const pdfService = new PdfHtmlService();
        const { url } = await pdfService.generateAndAttach(id, true);
        pdfUrl = url;
      }
      const filename = path.basename(String(pdfUrl));
      const filepath = path.join(__dirname, '../../uploads/invoices', filename);
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'PDF no encontrado' });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
      res.sendFile(filepath);
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      res.status(500).json({ error: 'No se pudo descargar el PDF' });
    }
  }

  // Generar factura automática desde orden
  static async generateInvoiceFromOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;

      // Verificar que la orden existe y no tiene factura
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          customer: true,
          invoice: true,
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      if (order.invoice) {
        return res.status(400).json({ error: 'La orden ya tiene una factura asociada' });
      }

      // Obtener configuración
      const config = await InvoiceController.getOrCreateConfig();

      // Convertir items de orden a items de factura
      const invoiceItems = order.orderItems.map(item => ({
        productId: item.productId,
        description: item.product?.name || 'Producto',
        quantity: item.quantity,
        unitPrice: item.price,
        taxRate: config.defaultTaxRate,
        discountRate: 0,
      }));

      // Crear factura
      const invoiceData = {
        clientId: order.customerId,
        orderId: order.id,
        items: invoiceItems,
        discountAmount: 0,
        notes: `Factura generada automáticamente para la orden ${order.id}`,
      };

      // Reutilizar lógica de creación
      req.body = invoiceData;
      return await InvoiceController.createInvoice(req, res);
    } catch (error) {
      console.error('Error al generar factura desde orden:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Marcar factura como pagada
  static async markAsPaid(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { paymentMethod, paymentReference } = req.body;

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          status: 'PAID',
          paidDate: new Date(),
          paymentMethod,
          paymentReference,
        },
        include: {
          client: true,
          items: true,
        },
      });

      res.json(invoice);
    } catch (error) {
      console.error('Error al marcar factura como pagada:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener estadísticas de facturación
  static async getInvoiceStats(req: Request, res: Response) {
    try {
      const { period = '30' } = req.query;
      const days = parseInt(period as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [totalInvoices, paidInvoices, pendingInvoices, overdueInvoices, totalRevenue] = await Promise.all([
        prisma.invoice.count(),
        prisma.invoice.count({ where: { status: 'PAID' } }),
        prisma.invoice.count({ where: { status: { in: ['DRAFT', 'SENT'] } } }),
        prisma.invoice.count({ 
          where: { 
            status: 'OVERDUE',
            dueDate: { lt: new Date() }
          } 
        }),
        prisma.invoice.aggregate({
          where: { 
            status: 'PAID',
            paidDate: { gte: startDate }
          },
          _sum: { totalAmount: true }
        }),
      ]);

      res.json({
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        overdueInvoices,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Configuración de facturación
  static async getInvoiceConfig(req: Request, res: Response) {
    try {
      const config = await InvoiceController.getOrCreateConfig();
      res.json(config);
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  static async updateInvoiceConfig(req: Request, res: Response) {
    try {
      const validatedData = invoiceConfigSchema.parse(req.body);
      
      const config = await InvoiceController.getOrCreateConfig();
      
      const updatedConfig = await prisma.invoiceConfig.update({
        where: { id: config.id },
        data: validatedData,
      });

      res.json(updatedConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de entrada inválidos', 
          details: error.errors 
        });
      }
      console.error('Error al actualizar configuración:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Método auxiliar para obtener o crear configuración
  private static async getOrCreateConfig() {
    let config = await prisma.invoiceConfig.findFirst();
    
    if (!config) {
      config = await prisma.invoiceConfig.create({
        data: {
          companyName: 'Mi Empresa',
          companyAddress: 'Dirección de la empresa',
          invoicePrefix: 'INV',
          nextInvoiceNumber: 1,
          defaultTaxRate: 21.0,
          defaultCurrency: 'ARS',
          paymentTermsDays: 30,
        },
      });
    }
    
    return config;
  }

  // Proceso automático para marcar facturas vencidas
  static async processOverdueInvoices(req: Request, res: Response) {
    try {
      const overdueInvoices = await prisma.invoice.updateMany({
        where: {
          status: 'SENT',
          dueDate: {
            lt: new Date(),
          },
        },
        data: {
          status: 'OVERDUE',
        },
      });

      res.json({ 
        message: `${overdueInvoices.count} facturas marcadas como vencidas`,
        count: overdueInvoices.count 
      });
    } catch (error) {
      console.error('Error al procesar facturas vencidas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  static async getGrossProfitReport(req: Request, res: Response) {
    try {
      const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
      const where: any = {};
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }
      const invoices = await prisma.invoice.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      });
      const resultInvoices = invoices.map(inv => {
        const cost = inv.items.reduce((sum, it) => sum + (((it as any).costPrice || 0) * it.quantity), 0);
        const gross = inv.totalAmount - inv.taxAmount - cost;
        return { id: inv.id, invoiceNumber: inv.invoiceNumber, date: inv.createdAt, grossProfit: gross };
      });
      const dailyMap = new Map<string, number>();
      for (const r of resultInvoices) {
        const k = new Date(r.date).toISOString().slice(0, 10);
        dailyMap.set(k, (dailyMap.get(k) || 0) + r.grossProfit);
      }
      const daily = Array.from(dailyMap.entries()).map(([date, grossProfit]) => ({ date, grossProfit }));
      res.json({ invoices: resultInvoices, daily });
    } catch (error) {
      console.error('Error en reporte de utilidad bruta:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  static async getPickingList(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: { client: true, items: true },
      });
      if (!invoice) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }
      const itemIds = invoice.items.map(i => i.id);
      const allocations = await (prisma as any).invoiceItemBatch.findMany({
        where: { invoiceItemId: { in: itemIds } },
        include: {
          batch: { include: { product: true, variant: true } },
          invoiceItem: true,
        },
      });
      const lines = allocations.map((a: any) => {
        const productName = a.batch.product?.name || a.invoiceItem.description || '';
        const flavor = a.batch.variant?.flavor || '';
        const size = a.batch.variant?.size || '';
        const batchNumber = a.batch.batchNumber || '';
        const shelfLocation = a.batch.shelfLocation || '';
        return {
          quantity: a.quantity,
          productName,
          flavor,
          size,
          batchNumber,
          shelfLocation,
        };
      });
      res.json({ invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, client: invoice.client }, lines });
    } catch (error) {
      res.status(500).json({ error: 'Error generando lista de picking' });
    }
  }
}
