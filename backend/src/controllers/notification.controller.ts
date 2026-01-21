import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// Schemas de validación
const createNotificationSchema = z.object({
  message: z.string().min(1),
  userId: z.string().uuid(),
});

const updateNotificationSchema = z.object({
  read: z.boolean().optional(),
  message: z.string().min(1).optional(),
});

export class NotificationController {
  // Obtener todas las notificaciones
  static async getNotifications(req: Request, res: Response) {
    try {
      const { 
        read, 
        userId,
        page = '1', 
        limit = '20' 
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Construir filtros
      const where: any = {};
      
      if (read !== undefined) {
        where.read = read === 'true';
      }
      
      if (userId) {
        where.userId = userId;
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.notification.count({ where }),
      ]);

      res.json({
        notifications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener notificación por ID
  static async getNotificationById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({ error: 'Notificación no encontrada' });
      }

      res.json(notification);
    } catch (error) {
      console.error('Error al obtener notificación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear nueva notificación
  static async createNotification(req: Request, res: Response) {
    try {
      const validatedData = createNotificationSchema.parse(req.body);

      const notification = await prisma.notification.create({
        data: validatedData,
      });

      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
      }
      console.error('Error al crear notificación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar notificación
  static async updateNotification(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateNotificationSchema.parse(req.body);

      const existingNotification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!existingNotification) {
        return res.status(404).json({ error: 'Notificación no encontrada' });
      }

      const notification = await prisma.notification.update({
        where: { id },
        data: validatedData,
      });

      res.json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
      }
      console.error('Error al actualizar notificación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Eliminar notificación
  static async deleteNotification(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({ error: 'Notificación no encontrada' });
      }

      await prisma.notification.delete({
        where: { id },
      });

      res.json({ message: 'Notificación eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Marcar notificación como leída
  static async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({ error: 'Notificación no encontrada' });
      }

      const updatedNotification = await prisma.notification.update({
        where: { id },
        data: { read: true },
      });

      res.json(updatedNotification);
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Marcar todas las notificaciones como leídas
  static async markAllAsRead(req: Request, res: Response) {
    try {
      const { userId } = req.query;

      const where: any = { read: false };
      if (userId) {
        where.userId = userId;
      }

      const result = await prisma.notification.updateMany({
        where,
        data: { read: true },
      });

      res.json({ 
        message: 'Notificaciones marcadas como leídas',
        count: result.count 
      });
    } catch (error) {
      console.error('Error al marcar todas las notificaciones como leídas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener conteo de notificaciones no leídas
  static async getUnreadCount(req: Request, res: Response) {
    try {
      const { userId } = req.query;

      const where: any = { read: false };
      if (userId) {
        where.userId = userId;
      }

      const count = await prisma.notification.count({ where });

      res.json({ unreadCount: count });
    } catch (error) {
      console.error('Error al obtener conteo de notificaciones no leídas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Eliminar notificaciones antiguas
  static async deleteOldNotifications(req: Request, res: Response) {
    try {
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysNum);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          read: true,
        },
      });

      res.json({ 
        message: `Notificaciones antiguas eliminadas`,
        count: result.count,
        cutoffDate: cutoffDate.toISOString(),
      });
    } catch (error) {
      console.error('Error al eliminar notificaciones antiguas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear notificación del sistema
  static async createSystemNotification(req: Request, res: Response) {
    try {
      const { message, userId } = req.body;

      if (!message || !userId) {
        return res.status(400).json({ error: 'Mensaje y userId requeridos' });
      }

      const notification = await prisma.notification.create({
        data: {
          message,
          userId,
        },
      });

      res.status(201).json(notification);
    } catch (error) {
      console.error('Error al crear notificación del sistema:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}