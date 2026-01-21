import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export class ClientController {
  // Add return type Promise<void> to all methods
  async getAllClients(_req: Request, res: Response): Promise<void> {
    try {
      const clients = await prisma.client.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });
      res.json(clients);
    } catch (error) {
      console.log(error);
      console.error('Error fetching clients:', error);
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  }

  async getClientById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const client = await prisma.client.findUnique({
        where: { id }
      });

      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      res.json(client);
    } catch (error) {
      console.error('Error fetching client:', error);
      res.status(500).json({ error: 'Failed to fetch client' });
    }
  }

  async createClient(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, phone, company } = req.body;
      const safeName = typeof name === 'string' && name.trim() ? name.trim() : 'Sin Nombre';
      const safeEmail = typeof email === 'string' ? email.trim() : '';
      const safePhone = typeof phone === 'string' ? phone.trim() : '';
      const safeCompany = typeof company === 'string' ? company.trim() : '';
      const client = await prisma.client.create({
        data: {
          name: safeName,
          email: safeEmail,
          phone: safePhone,
          company: safeCompany
        }
      });
      res.status(201).json(client);
    } catch (error) {
      console.error('Error completo de Prisma:', error);
      console.error('Error creating client:', error);
      res.status(500).json({ error: 'Failed to create client' });
    }
  }

  async updateClient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, email, phone, company } = req.body;
      
      const client = await prisma.client.update({
        where: { id },
        data: {
          name,
          email,
          phone,
          company
        }
      });
      
      res.json(client);
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ error: 'Failed to update client' });
    }
  }

  async deleteClient(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.client.delete({
        where: { id }
      });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ error: 'Failed to delete client' });
    }
  }

  async getNotes(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const client = await prisma.client.findUnique({ where: { id } });
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      const cfg = await prisma.configuration.findUnique({ where: { key: `client_notes_${id}` } });
      res.json({ notes: cfg?.value || '' });
    } catch (error) {
      console.error('Error fetching client notes:', error);
      res.status(500).json({ error: 'Failed to fetch client notes' });
    }
  }

  async updateNotes(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { notes } = req.body as { notes: string };
      const client = await prisma.client.findUnique({ where: { id } });
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      await prisma.configuration.upsert({
        where: { key: `client_notes_${id}` },
        update: { value: notes || '' },
        create: { key: `client_notes_${id}`, value: notes || '' },
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating client notes:', error);
      res.status(500).json({ error: 'Failed to update client notes' });
    }
  }
}
