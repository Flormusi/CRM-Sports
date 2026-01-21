import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';

export class OrderController {
  async getAll(_req: Request, res: Response): Promise<Response> {
    try {
      const orders = await prisma.order.findMany({
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      return res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const order = await prisma.order.findUnique({
        where: { id },  // Remove Number() conversion since id is string
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true
            }
          }
        }
      });
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      return res.json(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      return res.status(500).json({ error: 'Failed to fetch order' });
    }
  }

  // Fix return types and ID handling for other methods
  async getByCustomer(req: Request, res: Response): Promise<Response> {
    try {
      const { customerId } = req.params;
      const orders = await prisma.order.findMany({
        where: { customerId }, // Remove Number() conversion
        include: {
          orderItems: {
            include: {
              product: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(orders);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return res.status(500).json({ error: 'Failed to fetch customer orders' });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { customerId, items, total } = req.body;
      const order = await prisma.order.create({
        data: {
          customerId,  // Remove Number() conversion
          total,
          status: OrderStatus.PENDING,
          orderItems: {
            create: items.map((item: any) => ({
              quantity: item.quantity,
              price: item.price,
              productId: item.productId
            }))
          }
        },
        include: {
          orderItems: {
            include: {
              product: true
            }
          }
        }
      });
      return res.status(201).json(order);
    } catch (error) {
      console.error('Error creating order:', error);
      return res.status(500).json({ error: 'Failed to create order' });
    }
  }

  async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const order = await prisma.order.update({
        where: { id },
        data: { 
          status: status as OrderStatus 
        },
        include: {
          orderItems: {
            include: {
              product: true
            }
          }
        }
      });
      
      return res.json(order);
    } catch (error) {
      console.error('Error updating order status:', error);
      return res.status(500).json({ error: 'Failed to update order status' });
    }
  }

  async cancelOrder(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const order = await prisma.order.update({
        where: { id },
        data: { 
          status: OrderStatus.CANCELLED 
        },
        include: {
          orderItems: {
            include: {
              product: true
            }
          }
        }
      });
      
      return res.json(order);  // Added return statement
    } catch (error) {
      console.error('Error cancelling order:', error);
      return res.status(500).json({ error: 'Failed to cancel order' });
    }
  }
}