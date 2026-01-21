import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export class ReportController {
  async getSalesReport(_req: Request, res: Response) {
    try {
      const result = await prisma.order.findMany({
        select: {
          id: true,
          createdAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          orderItems: {
            select: {
              quantity: true,
              price: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const formattedResult = result.map(order => ({
        order_id: order.id,
        created_at: order.createdAt,
        first_name: order.customer.firstName,
        last_name: order.customer.lastName,
        total_amount: order.orderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0)
      }));

      res.json(formattedResult);
    } catch (error) {
      console.error('Error generating sales report:', error);
      res.status(500).json({ error: 'Failed to generate sales report' });
    }
  }

  async getInventoryReport(_req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          stock: true,
          price: true,
          OrderItem: {
            select: {
              id: true
            }
          }
        },
        orderBy: {
          stock: 'asc'
        }
      });

      const formattedResult = products.map(product => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        price: product.price,
        times_ordered: product.OrderItem.length
      }));

      res.json(formattedResult);
    } catch (error) {
      console.error('Error generating inventory report:', error);
      res.status(500).json({ error: 'Failed to generate inventory report' });
    }
  }

  async getCustomerReport(_req: Request, res: Response) {
    try {
      const customers = await prisma.user.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          orders: {
            select: {
              id: true,
              total: true
            }
          }
        }
      });

      const formattedResult = customers.map(customer => ({
        id: customer.id,
        first_name: customer.firstName,
        last_name: customer.lastName,
        total_orders: customer.orders.length,
        total_spent: customer.orders.reduce((sum, order) => sum + order.total, 0)
      }));

      res.json(formattedResult);
    } catch (error) {
      console.error('Error generating customer report:', error);
      res.status(500).json({ error: 'Failed to generate customer report' });
    }
  }
}

export const reportController = {
  async getReportData(req: Request, res: Response) {
    try {
      const { timeFrame } = req.query;
      const startDate = getStartDate(timeFrame as string);
      
      const [salesData, customerStats, productStats] = await Promise.all([
        getSalesData(startDate),
        getCustomerStats(),
        getProductStats()
      ]);

      res.json({
        salesData,
        customerStats,
        productStats
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch report data' });
    }
  }
};

function getStartDate(timeFrame: string): Date {
  const now = new Date();
  switch (timeFrame) {
    case 'week':
      return new Date(now.setDate(now.getDate() - 7));
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1));
    case 'year':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    default:
      return new Date(now.setMonth(now.getMonth() - 1));
  }
}

async function getSalesData(startDate: Date) {
  const orders = await prisma.order.groupBy({
    by: ['createdAt'],
    where: {
      createdAt: {
        gte: startDate
      }
    },
    _sum: {
      total: true
    },
    _count: {
      id: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return orders.map(order => ({
    date: order.createdAt,
    amount: order._sum.total || 0,
    count: order._count.id
  }));
}

async function getCustomerStats() {
  const users = await prisma.user.findMany({
    include: {
      orders: true,
      _count: {
        select: { orders: true }
      }
    }
  });

  return {
    total_customers: users.length,
    active_customers: users.filter(user => user.orders.length > 0).length,
    average_purchase_value: users.reduce((sum, user) => 
      sum + user.orders.reduce((orderSum, order) => orderSum + order.total, 0), 0) / users.length || 0
  };
}

async function getProductStats() {
  const products = await prisma.product.findMany({
    include: {
      OrderItem: true,
      _count: {
        select: { OrderItem: true }
      }
    }
  });

  const stats = {
    total_products: products.length,
    low_stock_products: products.filter(p => p.stock < p.minStock).length,
    topSellingProducts: products
      .map(p => ({
        id: p.id,
        name: p.name,
        salesCount: p._count.OrderItem
      }))
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 5)
  };

  return stats;
}