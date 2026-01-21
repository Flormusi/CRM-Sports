import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// Schemas de validación
const stockAlertConfigSchema = z.object({
  productId: z.string().uuid(),
  minStock: z.number().min(0),
  criticalStock: z.number().min(0),
  alertDays: z.number().min(1).default(7),
  emailNotifications: z.boolean().optional().default(false),
});

export class StockAlertController {
  // Obtener productos con bajo stock y métricas
  static async getLowStockProducts(_req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          stock: true,
          minStock: true,
          updatedAt: true,
        },
      });

      const lowStock = products.filter((p) => {
        const min = p.minStock || 0;
        return p.stock === 0 || p.stock <= min;
      });

      const result = lowStock.map((p) => {
        const min = p.minStock || 0;
        const severity = p.stock === 0 ? 'out_of_stock' : (p.stock <= min * 0.5 ? 'critical' : 'low');
        return {
          id: p.id,
          name: p.name,
          currentStock: p.stock,
          minStock: min,
          severity,
          lastUpdated: p.updatedAt.toISOString(),
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Error al obtener productos con bajo stock:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Calcular métricas de stock
  private static async calculateStockMetrics(product: any) {
    const orderItems = product.OrderItem || [];
    
    if (orderItems.length === 0) {
      return {
        averageDailySales: 0,
        estimatedDaysRemaining: null,
        projectedStockoutDate: null,
        recommendedReorderQuantity: product.minStock * 2,
      };
    }

    // Calcular ventas promedio diarias
    const totalSold = orderItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const daysWithSales = new Set(orderItems.map((item: any) => 
      item.createdAt.toISOString().split('T')[0]
    )).size;
    
    const averageDailySales = daysWithSales > 0 ? totalSold / daysWithSales : 0;
    
    // Calcular días estimados restantes
    const estimatedDaysRemaining = averageDailySales > 0 
      ? Math.floor(product.stock / averageDailySales)
      : null;
    
    // Fecha proyectada de agotamiento
    const projectedStockoutDate = estimatedDaysRemaining 
      ? new Date(Date.now() + estimatedDaysRemaining * 24 * 60 * 60 * 1000)
      : null;
    
    // Cantidad recomendada de reorden (para 30 días)
    const recommendedReorderQuantity = Math.max(
      Math.ceil(averageDailySales * 30),
      product.minStock * 2
    );

    return {
      averageDailySales: Math.round(averageDailySales * 100) / 100,
      estimatedDaysRemaining,
      projectedStockoutDate,
      recommendedReorderQuantity,
      salesTrend: this.calculateSalesTrend(orderItems),
    };
  }

  // Calcular tendencia de ventas
  private static calculateSalesTrend(orderItems: any[]) {
    if (orderItems.length < 7) return 'insufficient_data';

    const now = new Date();
    const lastWeek = orderItems.filter(item => 
      new Date(item.createdAt) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    );
    const previousWeek = orderItems.filter(item => {
      const itemDate = new Date(item.createdAt);
      return itemDate >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) &&
             itemDate < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    });

    const lastWeekSales = lastWeek.reduce((sum, item) => sum + item.quantity, 0);
    const previousWeekSales = previousWeek.reduce((sum, item) => sum + item.quantity, 0);

    if (previousWeekSales === 0) return 'no_previous_data';
    
    const changePercent = ((lastWeekSales - previousWeekSales) / previousWeekSales) * 100;
    
    if (changePercent > 20) return 'increasing';
    if (changePercent < -20) return 'decreasing';
    return 'stable';
  }

  // Determinar estado del stock
  private static getStockStatus(currentStock: number, minStock: number) {
    if (currentStock === 0) return 'out_of_stock';
    if (currentStock <= minStock * 0.5) return 'critical';
    if (currentStock <= minStock) return 'low';
    return 'normal';
  }

  // Obtener alertas activas
  static async getActiveAlerts(req: Request, res: Response) {
    try {
      const { priority = 'all' } = req.query;

      let whereClause: any = {
        OR: [
          { stock: { equals: 0 } }, // Sin stock
          // Prisma no soporta comparar campo vs campo; filtramos por stock > 0 y luego ajustamos en código si hiciera falta
          { stock: { gt: 0 } },
        ],
      };

      if (priority === 'critical') {
        whereClause = { stock: { equals: 0 } };
      } else if (priority === 'low') {
        whereClause = {
          AND: [
            { stock: { gt: 0 } },
          ],
        };
      }

      const alerts = await prisma.product.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          stock: true,
          minStock: true,
          price: true,
          updatedAt: true,
        },
        orderBy: [
          { stock: 'asc' },
          { updatedAt: 'desc' },
        ],
      });

      const alertsWithStatus = alerts
        .filter((product) => product.stock === 0 || product.stock <= (product.minStock || 0))
        .map(product => ({
          ...product,
          alertType: product.stock === 0 ? 'out_of_stock' : 'low_stock',
          severity: product.stock === 0 ? 'critical' : 
                   product.stock <= (product.minStock || 0) * 0.5 ? 'high' : 'medium',
          daysWithoutStock: product.stock === 0 ? 
            Math.floor((Date.now() - product.updatedAt.getTime()) / (24 * 60 * 60 * 1000)) : 0,
        }));

      res.json(alertsWithStatus);
    } catch (error) {
      console.error('Error al obtener alertas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener configuración de alertas
  static async getAlertConfig(req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          minStock: true,
        },
      });

      const configs = await Promise.all(
        products.map(async (product) => {
          const config = await prisma.configuration.findUnique({
            where: { key: `stock_alert_${product.id}` },
          });

          let alertConfig = { criticalStock: 0, alertDays: 7, emailNotifications: false };
          if (config?.value) {
            try {
              alertConfig = JSON.parse(config.value);
            } catch (e) {
              console.error('Error parsing alert config:', e);
            }
          }

          return {
            productId: product.id,
            productName: product.name,
            minStock: product.minStock || 0,
            criticalStock: alertConfig.criticalStock,
            alertDays: alertConfig.alertDays,
            emailNotifications: alertConfig.emailNotifications,
          };
        })
      );

      res.json(configs);
    } catch (error) {
      console.error('Error al obtener configuración de alertas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Configurar alertas personalizadas
  static async configureAlert(req: Request, res: Response) {
    try {
      const { productId, minStock, criticalStock, alertDays, emailNotifications } = stockAlertConfigSchema.parse(req.body);

      const product = await prisma.product.update({
        where: { id: productId },
        data: { minStock },
      });

      // Guardar configuración adicional en Configuration
      await prisma.configuration.upsert({
        where: { key: `stock_alert_${productId}` },
        update: {
          value: JSON.stringify({
            criticalStock,
            alertDays,
            emailNotifications: !!emailNotifications,
            updatedAt: new Date(),
          }),
        },
        create: {
          key: `stock_alert_${productId}`,
          value: JSON.stringify({
            criticalStock,
            alertDays,
            emailNotifications: !!emailNotifications,
            createdAt: new Date(),
          }),
        },
      });

      res.json({ 
        message: 'Configuración de alerta actualizada',
        product: {
          id: product.id,
          name: product.name,
          minStock: product.minStock,
          criticalStock,
          alertDays,
          emailNotifications: !!emailNotifications,
        },
      });
    } catch (error) {
      console.error('Error al configurar alerta:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  static async getAlertConfigByProduct(req: Request, res: Response) {
    try {
      const { productId } = req.params;

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, minStock: true },
      });

      if (!product) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      const config = await prisma.configuration.findUnique({
        where: { key: `stock_alert_${productId}` },
      });

      let parsed = { criticalStock: 0, alertDays: 7, emailNotifications: false } as any;
      if (config?.value) {
        try {
          parsed = JSON.parse(config.value);
        } catch {}
      }

      res.json({
        productId: product.id,
        productName: product.name,
        minStock: product.minStock || 0,
        criticalStock: parsed.criticalStock,
        alertDays: parsed.alertDays,
        emailNotifications: !!parsed.emailNotifications,
      });
    } catch (error) {
      console.error('Error al obtener configuración de producto:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  static async updateAlertConfig(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const body = stockAlertConfigSchema.partial({ productId: true }).parse(req.body);

      const product = await prisma.product.update({
        where: { id: productId },
        data: body.minStock !== undefined ? { minStock: body.minStock } : {},
        select: { id: true, name: true, minStock: true },
      });

      const existing = await prisma.configuration.findUnique({ where: { key: `stock_alert_${productId}` } });
      let prev = { criticalStock: 0, alertDays: 7, emailNotifications: false } as any;
      if (existing?.value) {
        try { prev = JSON.parse(existing.value); } catch {}
      }

      const next = {
        criticalStock: body.criticalStock ?? prev.criticalStock,
        alertDays: body.alertDays ?? prev.alertDays,
        emailNotifications: body.emailNotifications ?? prev.emailNotifications,
        updatedAt: new Date(),
      };

      await prisma.configuration.upsert({
        where: { key: `stock_alert_${productId}` },
        update: { value: JSON.stringify(next) },
        create: { key: `stock_alert_${productId}`, value: JSON.stringify({ ...next, createdAt: new Date() }) },
      });

      res.json({
        message: 'Configuración de alerta actualizada',
        product: {
          id: product.id,
          name: product.name,
          minStock: product.minStock,
          criticalStock: next.criticalStock,
          alertDays: next.alertDays,
          emailNotifications: !!next.emailNotifications,
        },
      });
    } catch (error) {
      console.error('Error al actualizar configuración de alerta:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  static async deleteAlertConfig(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      await prisma.configuration.delete({ where: { key: `stock_alert_${productId}` } }).catch(() => Promise.resolve());
      res.json({ message: 'Configuración de alerta eliminada' });
    } catch (error) {
      console.error('Error al eliminar configuración de alerta:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  static async testEmailNotification(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      }

      const recipientEmail = (req.user as any)?.email || process.env.EMAIL_FROM || 'test@example.com';
      const currentStock = product.stock;
      const threshold = product.minStock || 0;
      res.json({ success: true, message: `Email de prueba preparado para ${recipientEmail} (producto ${product.name}, stock ${currentStock}, umbral ${threshold})` });
    } catch (error) {
      console.error('Error en test email de alerta de stock:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // Obtener resumen de stock
  static async getStockSummary(req: Request, res: Response) {
    try {
      const all = await prisma.product.findMany({ select: { stock: true, minStock: true } });
      const totalProducts = all.length;
      const outOfStockProducts = all.filter(p => p.stock === 0).length;
      const criticalStockProducts = all.filter(p => {
        const min = p.minStock || 0;
        return p.stock > 0 && p.stock <= min * 0.5;
      }).length;
      const lowStockProducts = all.filter(p => {
        const min = p.minStock || 0;
        return p.stock > 0 && p.stock <= min && p.stock > min * 0.5;
      }).length;
      const normalStock = Math.max(totalProducts - outOfStockProducts - criticalStockProducts - lowStockProducts, 0);
      const healthScore = totalProducts > 0 ? Math.round((normalStock / totalProducts) * 100) : 0;

      const stockValue = await prisma.product.aggregate({
        _sum: {
          stock: true,
        },
        where: {
          stock: { gt: 0 },
        },
      });

      const totalStockValue = await prisma.$queryRaw`
        SELECT SUM(stock * price) as total_value
        FROM "Product"
        WHERE stock > 0
      ` as any[];

      res.json({
        totalProducts,
        outOfStockProducts,
        criticalStockProducts,
        lowStockProducts,
        healthScore,
        totalUnits: stockValue._sum.stock || 0,
        totalValue: totalStockValue[0]?.total_value || 0,
        alertsCount: outOfStockProducts + lowStockProducts + criticalStockProducts,
      });
    } catch (error) {
      console.error('Error al obtener resumen de stock:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Marcar alerta como vista
  static async markAlertAsViewed(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      // Registrar que el usuario vio la alerta
      await prisma.configuration.upsert({
        where: { key: `alert_viewed_${productId}_${userId}` },
        update: {
          value: new Date().toISOString(),
        },
        create: {
          key: `alert_viewed_${productId}_${userId}`,
          value: new Date().toISOString(),
        },
      });

      res.json({ message: 'Alerta marcada como vista' });
    } catch (error) {
      console.error('Error al marcar alerta:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}
