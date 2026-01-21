import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export class DashboardController {
  async getDashboardStats(req: Request, res: Response) {
    try {
      const [totalCustomers, totalOrders, recentOrders, topProducts] = await Promise.all([
        prisma.user.count({ where: { role: 'customer' } }),
        prisma.order.count(),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
            orderItems: {
              include: {
                product: true
              }
            }
          }
        }),
        prisma.product.findMany({
          take: 5,
          orderBy: {
            orderItems: {
              _count: 'desc'
            }
          },
          include: {
            _count: {
              select: {
                orderItems: true
              }
            }
          }
        })
      ]);

      const totalRevenue = await prisma.order.aggregate({
        _sum: {
          total: true
        }
      });

      res.json({
        totalCustomers,
        totalOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        recentOrders,
        topProducts: topProducts.map(product => ({
          ...product,
          totalOrders: product._count.orderItems
        }))
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
  }

  async getRevenueStats(req: Request, res: Response) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const revenueData = await prisma.order.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        _sum: {
          total: true
        }
      });

      res.json(revenueData.map(data => ({
        date: data.createdAt,
        revenue: data._sum.total || 0
      })));
    } catch (error) {
      console.error('Error fetching revenue stats:', error);
      res.status(500).json({ error: 'Failed to fetch revenue statistics' });
    }
  }
}