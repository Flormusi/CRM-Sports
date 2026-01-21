import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schemas de validación
const createQuickResponseSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  content: z.string().min(1, 'El contenido es requerido'),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

const updateQuickResponseSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export class QuickResponseController {
  // Obtener todas las respuestas rápidas
  static async getQuickResponses(req: Request, res: Response) {
    try {
      const { 
        category, 
        tag, 
        isActive, 
        search,
        page = '1', 
        limit = '20' 
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        userId: req.user?.id,
      };

      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      if (category) {
        where.category = category;
      }

      if (tag) {
        where.tags = {
          has: tag,
        };
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [quickResponses, total] = await Promise.all([
        prisma.quickResponse.findMany({
          where,
          orderBy: [
            { usageCount: 'desc' },
            { updatedAt: 'desc' },
          ],
          skip,
          take: limitNum,
        }),
        prisma.quickResponse.count({ where }),
      ]);

      res.json({
        quickResponses,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error al obtener respuestas rápidas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener respuesta rápida por ID
  static async getQuickResponseById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const quickResponse = await prisma.quickResponse.findFirst({
        where: {
          id,
          userId: req.user?.id,
        },
      });

      if (!quickResponse) {
        return res.status(404).json({ error: 'Respuesta rápida no encontrada' });
      }

      res.json(quickResponse);
    } catch (error) {
      console.error('Error al obtener respuesta rápida:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear nueva respuesta rápida
  static async createQuickResponse(req: Request, res: Response) {
    try {
      const validatedData = createQuickResponseSchema.parse(req.body);

      const quickResponse = await prisma.quickResponse.create({
        data: {
          ...validatedData,
          userId: req.user?.id!,
        },
      });

      res.status(201).json(quickResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de entrada inválidos', 
          details: error.errors 
        });
      }
      console.error('Error al crear respuesta rápida:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar respuesta rápida
  static async updateQuickResponse(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateQuickResponseSchema.parse(req.body);

      // Verificar que la respuesta rápida existe y pertenece al usuario
      const existingQuickResponse = await prisma.quickResponse.findFirst({
        where: {
          id,
          userId: req.user?.id,
        },
      });

      if (!existingQuickResponse) {
        return res.status(404).json({ error: 'Respuesta rápida no encontrada' });
      }

      const quickResponse = await prisma.quickResponse.update({
        where: { id },
        data: validatedData,
      });

      res.json(quickResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de entrada inválidos', 
          details: error.errors 
        });
      }
      console.error('Error al actualizar respuesta rápida:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Eliminar respuesta rápida
  static async deleteQuickResponse(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verificar que la respuesta rápida existe y pertenece al usuario
      const existingQuickResponse = await prisma.quickResponse.findFirst({
        where: {
          id,
          userId: req.user?.id,
        },
      });

      if (!existingQuickResponse) {
        return res.status(404).json({ error: 'Respuesta rápida no encontrada' });
      }

      await prisma.quickResponse.delete({
        where: { id },
      });

      res.json({ message: 'Respuesta rápida eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar respuesta rápida:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Usar respuesta rápida (incrementar contador de uso)
  static async useQuickResponse(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verificar que la respuesta rápida existe y pertenece al usuario
      const existingQuickResponse = await prisma.quickResponse.findFirst({
        where: {
          id,
          userId: req.user?.id,
          isActive: true,
        },
      });

      if (!existingQuickResponse) {
        return res.status(404).json({ error: 'Respuesta rápida no encontrada o inactiva' });
      }

      const quickResponse = await prisma.quickResponse.update({
        where: { id },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });

      res.json(quickResponse);
    } catch (error) {
      console.error('Error al usar respuesta rápida:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener categorías disponibles
  static async getCategories(req: Request, res: Response) {
    try {
      const categories = await prisma.quickResponse.findMany({
        where: {
          userId: req.user?.id,
          category: {
            not: null,
          },
        },
        select: {
          category: true,
        },
        distinct: ['category'],
      });

      const categoryList = categories
        .map(item => item.category)
        .filter(Boolean)
        .sort();

      res.json(categoryList);
    } catch (error) {
      console.error('Error al obtener categorías:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener tags disponibles
  static async getTags(req: Request, res: Response) {
    try {
      const quickResponses = await prisma.quickResponse.findMany({
        where: {
          userId: req.user?.id,
        },
        select: {
          tags: true,
        },
      });

      const allTags = quickResponses
        .flatMap(item => item.tags)
        .filter((tag, index, array) => array.indexOf(tag) === index)
        .sort();

      res.json(allTags);
    } catch (error) {
      console.error('Error al obtener tags:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener estadísticas de uso
  static async getUsageStats(req: Request, res: Response) {
    try {
      const stats = await prisma.quickResponse.aggregate({
        where: {
          userId: req.user?.id,
        },
        _count: {
          id: true,
        },
        _sum: {
          usageCount: true,
        },
        _avg: {
          usageCount: true,
        },
      });

      const activeCount = await prisma.quickResponse.count({
        where: {
          userId: req.user?.id,
          isActive: true,
        },
      });

      const mostUsed = await prisma.quickResponse.findMany({
        where: {
          userId: req.user?.id,
        },
        orderBy: {
          usageCount: 'desc',
        },
        take: 5,
        select: {
          id: true,
          title: true,
          usageCount: true,
        },
      });

      res.json({
        total: stats._count.id || 0,
        active: activeCount,
        totalUsage: stats._sum.usageCount || 0,
        averageUsage: stats._avg.usageCount || 0,
        mostUsed,
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Duplicar respuesta rápida
  static async duplicateQuickResponse(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const originalResponse = await prisma.quickResponse.findFirst({
        where: {
          id,
          userId: req.user?.id,
        },
      });

      if (!originalResponse) {
        return res.status(404).json({ error: 'Respuesta rápida no encontrada' });
      }

      const duplicatedResponse = await prisma.quickResponse.create({
        data: {
          title: `${originalResponse.title} (Copia)`,
          content: originalResponse.content,
          category: originalResponse.category,
          tags: originalResponse.tags,
          isActive: originalResponse.isActive,
          userId: req.user?.id!,
        },
      });

      res.status(201).json(duplicatedResponse);
    } catch (error) {
      console.error('Error al duplicar respuesta rápida:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}