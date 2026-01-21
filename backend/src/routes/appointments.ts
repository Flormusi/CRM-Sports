import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const router = express.Router();

// Get all appointments
router.get('/', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        client: true  // Fixed: Changed Client to client
      }
    });
    res.json(appointments);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
    return;
  }
});

// Get single appointment
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        client: true  // Changed from client to Client to match Prisma schema
      }
    });
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Create appointment
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { date, duration, type, notes, clientId } = req.body;
    const appointment = await prisma.appointment.create({
      data: {
        id: crypto.randomUUID(), // Add unique ID
        date: new Date(date),
        duration: parseInt(duration),
        type,
        notes,
        updatedAt: new Date(), // Add updatedAt timestamp
        client: {
          connect: { id: clientId }
        }
      }
    });
    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const updateData = {
      ...(req.body.date && { date: new Date(req.body.date) }),
      ...(req.body.duration && { duration: parseInt(req.body.duration) }),
      ...(req.body.type && { type: req.body.type }),
      ...(req.body.notes && { notes: req.body.notes }),
      ...(req.body.status && { status: req.body.status })
    } as const;

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/:id', authenticate, async (_req: Request, res: Response) => {
  try {
    await prisma.appointment.delete({
      where: { id: _req.params.id }
    });
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

export default router;