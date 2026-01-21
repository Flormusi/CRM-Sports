import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
const router = express.Router();

// Get all clients
router.get('/', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        Appointment: true,
        Task: true
      }
    });
    res.json(clients);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clients' });
    return;
  }
});

// Get single client
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        Appointment: true,
        Task: true
      }
    });
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json(client);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch client' });
    return;
  }
});

// Create client
router.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, company } = req.body;
    const client = await prisma.client.create({
      data: {
        id: crypto.randomUUID(),
        name,
        email,
        phone,
        company,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    res.status(201).json(client);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
res.status(400).json({ error: 'Email already exists' });
return;
      }
    }
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const updateData = {
      ...(req.body.name && { name: req.body.name }),
      ...(req.body.email && { email: req.body.email }),
      ...(req.body.phone && { phone: req.body.phone }),
      ...(req.body.company && { company: req.body.company })
    } as const;

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json(client);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
res.status(400).json({ error: 'Email already exists' });
return;
      }
    }
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.client.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;