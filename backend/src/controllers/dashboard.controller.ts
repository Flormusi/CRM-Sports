import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';

export class DashboardController {
  async getStats(_req: Request, res: Response) {
    try {
      const [customers, orders, products] = await Promise.all([
        prisma.client.count(),
        prisma.order.count(),
        prisma.product.count()
      ]);

      res.json({
        customers,
        orders,
        products
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
  }

  async getSummary(_req: Request, res: Response) {
    try {
      const summary = await prisma.order.groupBy({
        by: ['status'],
        _count: true
      });
      res.json(summary);
    } catch (error) {
      console.error('Error fetching summary:', error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  }

  async getSalesStats(_req: Request, res: Response) {
    try {
      const sales = await prisma.order.findMany({
        where: {
          status: OrderStatus.COMPLETED
        },
        include: {
          orderItems: {
            include: {
              product: true
            }
          }
        }
      });
      res.json(sales);
    } catch (error) {
      console.error('Error fetching sales stats:', error);
      res.status(500).json({ error: 'Failed to fetch sales statistics' });
    }
  }

  async getRecentActivity(_req: Request, res: Response) {
    try {
      const [invoices, tasks, batches] = await Promise.all([
        prisma.invoice.findMany({
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { client: true },
        }),
        prisma.task.findMany({
          where: { status: 'COMPLETED' },
          orderBy: { updatedAt: 'desc' },
          take: 15,
          include: { client: true, },
        }),
        prisma.batch.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 30,
          include: { product: true },
        }),
      ]);
      const invoiceEvents = invoices.map((inv) => ({
        type: 'invoice',
        icon: 'cart',
        title: `Factura ${inv.invoiceNumber}`,
        description: inv.client?.name ? `Emitida para ${inv.client.name}` : 'Nueva factura emitida',
        date: inv.createdAt,
      }));
      const taskEvents = tasks
        .filter((t) => !!t.whatsappLink)
        .map((t) => {
          const lastLog = Array.isArray((t as any).log) ? (t as any).log[(t as any).log.length - 1] : null;
          const who = lastLog?.message?.split(' ')[0] || '';
          return {
            type: 'task',
            icon: 'check',
            title: t.title || 'Tarea de WhatsApp',
            description: who ? `Cerrada por ${who}` : 'Tarea marcada como completada',
            date: t.updatedAt || t.createdAt,
          };
        });
      const stockEvents = batches
        .filter((b) => {
          const min = b.product?.minStock ?? 0;
          return b.quantity <= min && min > 0;
        })
        .map((b) => ({
          type: 'stock_alert',
          icon: 'alert',
          title: b.product?.name ? `Alerta de stock: ${b.product.name}` : 'Lote en alerta',
          description: `Cantidad ${b.quantity} ≤ mínimo ${b.product?.minStock ?? 0}`,
          date: b.updatedAt || b.createdAt,
        }));
      const events = [...invoiceEvents, ...taskEvents, ...stockEvents]
        .sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime())
        .slice(0, 20);
      res.json(events);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
  }
}
