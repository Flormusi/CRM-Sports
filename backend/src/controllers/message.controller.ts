import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// Schemas de validación
const createConversationSchema = z.object({
  clientId: z.string().uuid(),
  subject: z.string().optional(),
});

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1),
  messageType: z.enum(['TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO']).default('TEXT'),
  attachments: z.any().optional(),
});

const createTemplateSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export class MessageController {
  // Obtener todas las conversaciones del usuario
  static async getConversations(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const conversations = await prisma.conversation.findMany({
        where: { userId },
        include: {
          client: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              messages: {
                where: {
                  readAt: null,
                  direction: 'INCOMING',
                },
              },
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      res.json(conversations);
    } catch (error) {
      console.error('Error al obtener conversaciones:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear nueva conversación
  static async createConversation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const { clientId, subject } = createConversationSchema.parse(req.body);

      // Verificar si ya existe una conversación activa con este cliente
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          clientId,
          userId,
          status: 'ACTIVE',
        },
      });

      if (existingConversation) {
        return res.json(existingConversation);
      }

      const conversation = await prisma.conversation.create({
        data: {
          clientId,
          userId,
          subject,
        },
        include: {
          client: true,
        },
      });

      res.status(201).json(conversation);
    } catch (error) {
      console.error('Error al crear conversación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener mensajes de una conversación
  static async getMessages(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      // Verificar que el usuario tenga acceso a esta conversación
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversación no encontrada' });
      }

      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          conversation: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              client: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      });

      // Marcar mensajes como leídos
      await prisma.message.updateMany({
        where: {
          conversationId,
          direction: 'INCOMING',
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      res.json(messages.reverse());
    } catch (error) {
      console.error('Error al obtener mensajes:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Enviar mensaje
  static async sendMessage(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const { conversationId, content, messageType, attachments } = sendMessageSchema.parse(req.body);

      // Verificar que el usuario tenga acceso a esta conversación
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversación no encontrada' });
      }

      const message = await prisma.message.create({
          data: {
            conversationId,
            content,
            messageType,
            attachments,
            direction: 'OUTGOING',
          },
        include: {
          conversation: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              client: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Actualizar última actividad de la conversación
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      res.status(201).json(message);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener plantillas de mensajes
  static async getMessageTemplates(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const { category, search } = req.query;
      const where: any = { userId, isActive: true };

      if (category) {
        where.category = category;
      }

      if (search) {
        where.OR = [
          { title: { contains: search as string, mode: 'insensitive' } },
          { content: { contains: search as string, mode: 'insensitive' } },
          { tags: { has: search as string } },
        ];
      }

      const templates = await prisma.messageTemplate.findMany({
        where,
        orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
      });

      res.json(templates);
    } catch (error) {
      console.error('Error al obtener plantillas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear plantilla de mensaje
  static async createMessageTemplate(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const { title, content, category, tags } = createTemplateSchema.parse(req.body);

      const template = await prisma.messageTemplate.create({
        data: {
          title,
          content,
          category,
          tags,
          userId,
        },
      });

      res.status(201).json(template);
    } catch (error) {
      console.error('Error al crear plantilla:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Usar plantilla de mensaje
  static async useMessageTemplate(req: Request, res: Response) {
    try {
      const { templateId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const template = await prisma.messageTemplate.findFirst({
        where: {
          id: templateId,
          userId,
          isActive: true,
        },
      });

      if (!template) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      // Incrementar contador de uso
      await prisma.messageTemplate.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      });

      res.json(template);
    } catch (error) {
      console.error('Error al usar plantilla:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Cerrar conversación
  static async closeConversation(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const conversation = await prisma.conversation.updateMany({
        where: {
          id: conversationId,
          userId,
        },
        data: {
          status: 'CLOSED',
        },
      });

      if (conversation.count === 0) {
        return res.status(404).json({ error: 'Conversación no encontrada' });
      }

      res.json({ message: 'Conversación cerrada exitosamente' });
    } catch (error) {
      console.error('Error al cerrar conversación:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}