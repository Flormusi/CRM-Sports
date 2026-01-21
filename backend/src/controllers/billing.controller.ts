import express from 'express';
import type { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { InvoiceModel } from '../models/invoice.model';
import { randomUUID } from 'node:crypto';
import type { Order, OrderItem } from '../types/order';
import { ApiError } from '../utils/ApiError';

export class BillingController {
  private readonly TAX_RATE = 0.21;
  private readonly orderService: OrderService;

  constructor(orderService?: OrderService) {
    this.orderService = orderService || new OrderService();
  }

  private calculateItemTotals(price: number, quantity: number) {
    const subtotal = price * quantity;
    const tax = subtotal * this.TAX_RATE;
    return {
      subtotal,
      tax,
      total: subtotal + tax
    };
  }

  private mapOrderItemToInvoiceItem(item: OrderItem) {
    const { name, quantity, price } = item;
    return {
      description: name,
      quantity,
      unitPrice: price,
      taxRate: this.TAX_RATE,
      ...this.calculateItemTotals(price, quantity)
    };
  }

  private calculateTotals(items: ReturnType<typeof this.mapOrderItemToInvoiceItem>[]) {
    return items.reduce((acc, item) => ({
      subtotal: acc.subtotal + item.subtotal,
      tax: acc.tax + item.tax,
      total: acc.total + item.total
    }), { subtotal: 0, tax: 0, total: 0 });
  }

  generateInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        throw new ApiError(400, 'Order ID is required');
      }

      const order = await this.orderService.getOrder(orderId);
      
      if (!order) {
        throw new ApiError(404, 'Order not found');
      }

      if (!order.items?.length) {
        throw new ApiError(400, 'Order must have at least one item');
      }

      const items = order.items.map(item => this.mapOrderItemToInvoiceItem(item));
      const totals = this.calculateTotals(items);

      const invoice = new InvoiceModel({
        id: randomUUID(),
        type: 'A',
        number: await this.getNextInvoiceNumber(),
        date: new Date(),
        customer: order.customer,
        items,
        ...totals,
        status: 'pending'
      });

      await invoice.save();
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error('Invoice generation error:', error);
        res.status(500).json({ error: 'Failed to generate invoice' });
      }
    }
  };

  updateInvoiceStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['pending', 'paid', 'cancelled', 'completed'].includes(status)) {
        throw new ApiError(400, 'Invalid status');
      }

      const invoice = await InvoiceModel.findOne({ id });
      
      if (!invoice) {
        throw new ApiError(404, 'Invoice not found');
      }

      if (invoice.status === 'cancelled') {
        throw new ApiError(400, 'Cannot update cancelled invoice');
      }

      invoice.status = status;
      await invoice.save();
      
      res.json(invoice);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error('Invoice status update error:', error);
        res.status(500).json({ error: 'Failed to update invoice status' });
      }
    }
  };

  cancelInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const invoice = await InvoiceModel.findOne({ id });
      
      if (!invoice) {
        throw new ApiError(404, 'Invoice not found');
      }

      if (invoice.status === 'cancelled') {
        throw new ApiError(400, 'Invoice is already cancelled');
      }

      if (invoice.status === 'completed') {
        throw new ApiError(400, 'Cannot cancel completed invoice');
      }

      invoice.status = 'cancelled';
      invoice.cancellationReason = reason;
      invoice.cancelledAt = new Date();
      
      await invoice.save();
      res.json(invoice);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error('Invoice cancellation error:', error);
        res.status(500).json({ error: 'Failed to cancel invoice' });
      }
    }
  };

  getInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new ApiError(400, 'Invoice ID is required');
      }

      const invoice = await InvoiceModel.findOne({ id }).lean();
      
      if (!invoice) {
        throw new ApiError(404, 'Invoice not found');
      }
      
      res.json(invoice);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error('Invoice retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve invoice' });
      }
    }
  };

  listInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
      const invoices = await InvoiceModel.find(req.query).lean();
      res.json(invoices);
    } catch (error) {
      console.error('Invoice listing error:', error);
      res.status(500).json({ error: 'Failed to list invoices' });
    }
  };

  private async getNextInvoiceNumber(): Promise<number> {
    const lastInvoice = await InvoiceModel.findOne()
      .sort({ number: -1 })
      .select('number')
      .lean();
    
    return (lastInvoice?.number ?? 0) + 1;
  }
}