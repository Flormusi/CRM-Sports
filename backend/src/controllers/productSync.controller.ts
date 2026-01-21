import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// Schemas de validación
const createSyncGroupSchema = z.object({
  masterSku: z.string().min(1),
  productIds: z.array(z.string().uuid()).min(2),
});

const updateStockSchema = z.object({
  stock: z.number().min(0),
  syncToAll: z.boolean().default(true),
});

export class ProductSyncController {
  // Obtener todos los grupos de sincronización
  static async getSyncGroups(req: Request, res: Response) {
    try {
      const { includeProducts = 'true' } = req.query;

      const syncGroups = await prisma.productSync.findMany({
        include: {
          products: includeProducts === 'true' ? {
            select: {
              id: true,
              name: true,
              stock: true,
              price: true,
              meliItemId: true,
            },
          } : false,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calcular estadísticas para cada grupo
      const groupsWithStats = syncGroups.map(group => {
        if (!group.products || group.products.length === 0) {
          return {
            ...group,
            stats: {
              totalProducts: 0,
              syncStatus: 'empty',
              stockVariance: 0,
              lastSyncStatus: 'never',
            },
          };
        }

        const stocks = group.products.map(p => p.stock);
        const minStock = Math.min(...stocks);
        const maxStock = Math.max(...stocks);
        const avgStock = stocks.reduce((sum, stock) => sum + stock, 0) / stocks.length;
        const stockVariance = maxStock - minStock;
        
        const syncStatus = stockVariance === 0 ? 'synced' : 
                          stockVariance <= 5 ? 'minor_variance' : 'major_variance';
        
        const lastSyncStatus = group.lastSyncAt ? 
          (Date.now() - group.lastSyncAt.getTime() < 60000 ? 'recent' : 'outdated') : 'never';

        return {
          ...group,
          stats: {
            totalProducts: group.products.length,
            syncStatus,
            stockVariance,
            minStock,
            maxStock,
            avgStock: Math.round(avgStock * 100) / 100,
            lastSyncStatus,
          },
        };
      });

      res.json(groupsWithStats);
    } catch (error) {
      console.error('Error al obtener grupos de sincronización:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear nuevo grupo de sincronización
  static async createSyncGroup(req: Request, res: Response) {
    try {
      const { masterSku, productIds } = createSyncGroupSchema.parse(req.body);

      // Verificar que todos los productos existen
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        return res.status(400).json({ error: 'Uno o más productos no existen' });
      }

      // Verificar que ningún producto ya esté en otro grupo
      const existingSync = await prisma.product.findFirst({
        where: {
          id: { in: productIds },
          syncGroupId: { not: null },
        },
      });

      if (existingSync) {
        return res.status(400).json({ 
          error: 'Uno o más productos ya están en otro grupo de sincronización' 
        });
      }

      // Crear el grupo de sincronización
      const syncGroup = await prisma.productSync.create({
        data: {
          masterSku,
          products: {
            connect: productIds.map(id => ({ id })),
          },
        },
        include: {
          products: true,
        },
      });

      // Sincronizar stock inicial (usar el promedio)
      const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
      const avgStock = Math.floor(totalStock / products.length);
      await this.syncStockToAll(syncGroup.id, avgStock);

      res.status(201).json(syncGroup);
    } catch (error) {
      console.error('Error al crear grupo de sincronización:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Sincronizar stock de un grupo
  static async syncGroupStock(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { stock, syncToAll } = updateStockSchema.parse(req.body);

      const syncGroup = await prisma.productSync.findUnique({
        where: { id },
        include: { products: true },
      });

      if (!syncGroup) {
        return res.status(404).json({ error: 'Grupo de sincronización no encontrado' });
      }

      if (syncToAll) {
        // Sincronizar a todos los productos del grupo
        await this.syncStockToAll(id, stock);
      } else {
        // Solo actualizar la fecha de sincronización del grupo
        await prisma.productSync.update({
          where: { id },
          data: {
            lastSyncAt: new Date(),
          },
        });
      }

      const updatedGroup = await prisma.productSync.findUnique({
        where: { id },
        include: { products: true },
      });

      res.json(updatedGroup);
    } catch (error) {
      console.error('Error al sincronizar stock:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Método privado para sincronizar stock a todos los productos
  private static async syncStockToAll(syncGroupId: string, newStock: number) {
    const syncGroup = await prisma.productSync.findUnique({
      where: { id: syncGroupId },
      include: { products: true },
    });

    if (!syncGroup) return;

    // Actualizar stock de todos los productos
    await Promise.all(
      syncGroup.products.map(product =>
        prisma.product.update({
          where: { id: product.id },
          data: { stock: newStock },
        })
      )
    );

    // Actualizar el grupo
    await prisma.productSync.update({
      where: { id: syncGroupId },
      data: {
        lastSyncAt: new Date(),
      },
    });
  }

  // Agregar producto a grupo existente
  static async addProductToGroup(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({ error: 'ID de producto requerido' });
      }

      // Verificar que el grupo existe
      const syncGroup = await prisma.productSync.findUnique({
        where: { id },
        include: { products: true },
      });

      if (!syncGroup) {
        return res.status(404).json({ error: 'Grupo de sincronización no encontrado' });
      }

      // Verificar que el producto existe y no está en otro grupo
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      if (product.syncGroupId) {
        return res.status(400).json({ 
          error: 'El producto ya está en otro grupo de sincronización' 
        });
      }

      // Agregar producto al grupo
      await prisma.product.update({
        where: { id: productId },
        data: { syncGroupId: id },
      });

      // Sincronizar stock del nuevo producto con el grupo
      if (syncGroup.products.length > 0) {
        const avgStock = Math.floor(
          syncGroup.products.reduce((sum, p) => sum + p.stock, 0) / syncGroup.products.length
        );
        
        await prisma.product.update({
          where: { id: productId },
          data: { stock: avgStock },
        });
      }

      const updatedGroup = await prisma.productSync.findUnique({
        where: { id },
        include: { products: true },
      });

      res.json(updatedGroup);
    } catch (error) {
      console.error('Error al agregar producto al grupo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Remover producto de grupo
  static async removeProductFromGroup(req: Request, res: Response) {
    try {
      const { id, productId } = req.params;

      // Verificar que el producto está en el grupo
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          syncGroupId: id,
        },
      });

      if (!product) {
        return res.status(404).json({ 
          error: 'Producto no encontrado en este grupo de sincronización' 
        });
      }

      // Remover producto del grupo
      await prisma.product.update({
        where: { id: productId },
        data: { syncGroupId: null },
      });

      const updatedGroup = await prisma.productSync.findUnique({
        where: { id },
        include: { products: true },
      });

      res.json(updatedGroup);
    } catch (error) {
      console.error('Error al remover producto del grupo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Eliminar grupo de sincronización
  static async deleteSyncGroup(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verificar que el grupo existe
      const syncGroup = await prisma.productSync.findUnique({
        where: { id },
        include: { products: true },
      });

      if (!syncGroup) {
        return res.status(404).json({ error: 'Grupo de sincronización no encontrado' });
      }

      // Remover la referencia de sincronización de todos los productos
      await prisma.product.updateMany({
        where: { syncGroupId: id },
        data: { syncGroupId: null },
      });

      // Eliminar el grupo
      await prisma.productSync.delete({
        where: { id },
      });

      res.json({ message: 'Grupo de sincronización eliminado exitosamente' });
    } catch (error) {
      console.error('Error al eliminar grupo de sincronización:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener productos sin sincronizar
  static async getUnsyncedProducts(req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        where: { syncGroupId: null },
        select: {
          id: true,
          name: true,
          stock: true,
          price: true,
          meliItemId: true,
        },
        orderBy: { name: 'asc' },
      });

      res.json(products);
    } catch (error) {
      console.error('Error al obtener productos sin sincronizar:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Sincronización automática (webhook o cron)
  static async autoSync(req: Request, res: Response) {
    try {
      const syncGroups = await prisma.productSync.findMany({
        include: { products: true },
      });

      const results = [];

      for (const group of syncGroups) {
        if (group.products.length === 0) continue;

        // Calcular stock promedio del grupo
        const totalStock = group.products.reduce((sum, product) => sum + product.stock, 0);
        const avgStock = Math.floor(totalStock / group.products.length);

        // Solo sincronizar si hay diferencias significativas
        const hasVariance = group.products.some(product => 
          Math.abs(product.stock - avgStock) > 1
        );

        if (hasVariance) {
          await this.syncStockToAll(group.id, avgStock);
          results.push({
            groupId: group.id,
            masterSku: group.masterSku,
            syncedStock: avgStock,
            productsCount: group.products.length,
          });
        }
      }

      res.json({
        message: 'Sincronización automática completada',
        syncedGroups: results.length,
        results,
      });
    } catch (error) {
      console.error('Error en sincronización automática:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}