import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';

export class CustomerController {
  async getAllCustomers(_req: Request, res: Response): Promise<Response> {
    try {
      const customers = await prisma.user.findMany({
        where: { role: Role.USER },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
          orders: true
        }
      });
      return res.json(customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      return res.status(500).json({ error: 'Failed to fetch customers' });
    }
  }

  // In getCustomerById method
  async getCustomerById(req: Request, res: Response): Promise<Response> {
    try {
      const customer = await prisma.user.findUnique({
        where: { id: req.params.id }, // Remove Number() conversion
        include: {
          orders: {
            include: {
              orderItems: true
            }
          }
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

  // In createCustomer method
  async createCustomer(req: Request, res: Response): Promise<Response> {
    try {
      const { firstName, lastName, email, password } = req.body;
      const customer = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          password,
          role: Role.USER
        }
      });
      
      return res.status(201).json(customer);
    } catch (error) {
      console.error('Error creating customer:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }
  }

  // In updateCustomer method
  async updateCustomer(req: Request, res: Response): Promise<Response> {
    try {
      const { firstName, lastName, email } = req.body;
      const customer = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          firstName,
          lastName,
          email
        }
      });

      return res.json(customer);
    } catch (error) {
      console.error('Error updating customer:', error);
      return res.status(500).json({ error: 'Failed to update customer' });
    }
  }

  async deleteCustomer(req: Request, res: Response): Promise<Response> {
    try {
      await prisma.user.delete({
        where: { id: req.params.id }
      });

      return res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
      console.error('Error deleting customer:', error);
      return res.status(500).json({ error: 'Failed to delete customer' });
    }
  }
}