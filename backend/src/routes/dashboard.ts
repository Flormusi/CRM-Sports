import express from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = express.Router();

router.get('/stats', authenticate, async (_req, res) => {
  try {
    const [totalClients, todayAppointments, pendingTasks] = await Promise.all([
      prisma.client.count(),
      prisma.appointment.count({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      prisma.task.count({
        where: {
          status: 'PENDING',
        },
      }),
    ]);

    // Calculate monthly growth (example: comparing current month's clients vs last month)
    const thisMonth = new Date();
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1);
    
    const [currentMonthClients, lastMonthClients] = await Promise.all([
      prisma.client.count({
        where: {
          createdAt: {
            gte: new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1),
          },
        },
      }),
      prisma.client.count({
        where: {
          createdAt: {
            gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
            lt: new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1),
          },
        },
      }),
    ]);

    const growthRate = lastMonthClients === 0 
      ? '100%' 
      : `${Math.round(((currentMonthClients - lastMonthClients) / lastMonthClients) * 100)}%`;

    res.json({
      totalClients,
      todayAppointments,
      pendingTasks,
      monthlyGrowth: growthRate,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

export default router;
