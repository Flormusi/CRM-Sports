import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
export class CustomerController {
  async getAll(_req: Request, res: Response): Promise<Response> {
    try {
      const customers = await prisma.client.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' }
      });
      return res.json(customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const customer = await prisma.client.findFirst({
        where: { 
          AND: [
            { id },
            { deletedAt: null }
          ]
        }
      });
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      return res.json(customer);
    } catch (error) {
      console.error('Error fetching customer:', error);
      return res.status(500).json({ error: 'Failed to fetch customer' });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const { name, email, phone, company } = req.body;
      const customer = await prisma.client.create({
        data: {
          id: crypto.randomUUID(),
          name,
          email,
          phone,
          company
        }
      });
      return res.status(201).json(customer);
    } catch (error) {
      console.error('Error creating customer:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const existingCustomer = await prisma.client.findFirst({
        where: { 
          AND: [
            { id },
            { deletedAt: null }
          ]
        }
      });

      if (!existingCustomer) {
        return res.status(404).json({ error: 'Customer not found or already deleted' });
      }

      const customer = await prisma.client.update({
        where: { id },
        data: { 
          name: req.body.name, 
          email: req.body.email, 
          phone: req.body.phone, 
          company: req.body.company
        }
      });
      return res.json(customer);
    } catch (error) {
      console.error('Error updating customer:', error);
      return res.status(500).json({ error: 'Failed to update customer' });
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const existingCustomer = await prisma.client.findFirst({
        where: { 
          AND: [
            { id },
            { deletedAt: null }
          ]
        }
      });

      if (!existingCustomer) {
        return res.status(404).json({ error: 'Customer not found or already deleted' });
      }

      await prisma.client.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
      return res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
      console.error('Error deleting customer:', error);
      return res.status(500).json({ error: 'Failed to delete customer' });
    }
  }
}
