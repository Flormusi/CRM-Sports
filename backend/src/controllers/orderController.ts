import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export class OrderController {
  async getAllOrders(_req: Request, res: Response): Promise<Response> {
    try {
      const orders = await prisma.order.findMany({
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true
            }
          }
        }
      });
      return res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }

  async getOrderById(req: Request, res: Response): Promise<Response> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
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

  async createOrder(req: Request, res: Response) {
    try {
      const { customerId, items, total } = req.body;
      
      const order = await prisma.order.create({
        data: {
          customerId,
          total,
          orderItems: {
            create: items.map((item: any) => ({
              quantity: item.quantity,
              price: item.price,
              product: { connect: { id: item.productId } }
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
      
      res.status(201).json(order);
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }
}