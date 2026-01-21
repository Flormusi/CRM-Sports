import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

// Schemas de validación
const createComboSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  discount: z.number().min(0).max(100),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().min(1),
  })).min(2),
});

const updateComboSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  discount: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().min(1),
  })).min(2).optional(),
});

export class ProductComboController {
  // Obtener todos los combos
  static async getCombos(req: Request, res: Response) {
    try {
      const { active = 'true', includeItems = 'true' } = req.query;
      
      const where: any = {};
      if (active !== 'all') {
        where.isActive = active === 'true';
      }

      const combos = await prisma.productCombo.findMany({
        where,
        include: {
          items: includeItems === 'true' ? {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                },
              },
            },
          } : false,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calcular precios y disponibilidad para cada combo
      const combosWithCalculations = combos.map(combo => {
        if (!combo.items || combo.items.length === 0) {
          return {
            ...combo,
            originalPrice: 0,
            finalPrice: 0,
            savings: 0,
            available: false,
            minAvailableQuantity: 0,
          };
        }

        // Solo calcular precios si incluimos los datos del producto
        if (includeItems === 'true') {
          const originalPrice = combo.items.reduce(
            (sum, item: any) => sum + (item.product.price * item.quantity), 
            0
          );
          
          const finalPrice = originalPrice * (1 - combo.discount / 100);
          const savings = originalPrice - finalPrice;
          
          // Calcular disponibilidad basada en el stock de cada producto
          const minAvailableQuantity = Math.min(
            ...combo.items.map((item: any) => Math.floor(item.product.stock / item.quantity))
          );
          
          const available = minAvailableQuantity > 0;

          return {
            ...combo,
            originalPrice: Math.round(originalPrice * 100) / 100,
            finalPrice: Math.round(finalPrice * 100) / 100,
            savings: Math.round(savings * 100) / 100,
            available,
            minAvailableQuantity,
          };
        }

        // Si no incluimos items, retornar sin cálculos
         return {
           ...combo,
           originalPrice: 0,
           finalPrice: 0,
           savings: 0,
           available: false,
           minAvailableQuantity: 0,
         };
      });

      res.json(combosWithCalculations);
    } catch (error) {
      console.error('Error al obtener combos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener combo por ID
  static async getComboById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const combo = await prisma.productCombo.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!combo) {
        return res.status(404).json({ error: 'Combo no encontrado' });
      }

      // Calcular precios y disponibilidad
      const originalPrice = combo.items.reduce(
        (sum, item) => sum + (item.product.price * item.quantity), 
        0
      );
      
      const finalPrice = originalPrice * (1 - combo.discount / 100);
      const savings = originalPrice - finalPrice;
      
      const minAvailableQuantity = Math.min(
        ...combo.items.map(item => Math.floor(item.product.stock / item.quantity))
      );
      
      const available = minAvailableQuantity > 0;

      const comboWithCalculations = {
        ...combo,
        originalPrice: Math.round(originalPrice * 100) / 100,
        finalPrice: Math.round(finalPrice * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        available,
        minAvailableQuantity,
      };

      res.json(comboWithCalculations);
    } catch (error) {
      console.error('Error al obtener combo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear nuevo combo
  static async createCombo(req: Request, res: Response) {
    try {
      const { name, description, discount, items } = createComboSchema.parse(req.body);

      // Verificar que todos los productos existen
      const productIds = items.map(item => item.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        return res.status(400).json({ error: 'Uno o más productos no existen' });
      }

      // Crear el combo con sus items
      const combo = await prisma.productCombo.create({
        data: {
          name,
          description,
          discount,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      res.status(201).json(combo);
    } catch (error) {
      console.error('Error al crear combo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar combo
  static async updateCombo(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = updateComboSchema.parse(req.body);

      // Verificar que el combo existe
      const existingCombo = await prisma.productCombo.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingCombo) {
        return res.status(404).json({ error: 'Combo no encontrado' });
      }

      // Si se actualizan los items, verificar productos
      if (updateData.items) {
        const productIds = updateData.items.map(item => item.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
        });

        if (products.length !== productIds.length) {
          return res.status(400).json({ error: 'Uno o más productos no existen' });
        }

        // Eliminar items existentes y crear nuevos
        await prisma.comboItem.deleteMany({
          where: { comboId: id },
        });
      }

      const combo = await prisma.productCombo.update({
        where: { id },
        data: {
          ...updateData,
          items: updateData.items ? {
            create: updateData.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          } : undefined,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      res.json(combo);
    } catch (error) {
      console.error('Error al actualizar combo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Eliminar combo
  static async deleteCombo(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Verificar que el combo existe
      const existingCombo = await prisma.productCombo.findUnique({
        where: { id },
      });

      if (!existingCombo) {
        return res.status(404).json({ error: 'Combo no encontrado' });
      }

      // Eliminar items del combo primero
      await prisma.comboItem.deleteMany({
        where: { comboId: id },
      });

      // Eliminar el combo
      await prisma.productCombo.delete({
        where: { id },
      });

      res.json({ message: 'Combo eliminado exitosamente' });
    } catch (error) {
      console.error('Error al eliminar combo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Verificar disponibilidad de combo
  static async checkComboAvailability(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { quantity = 1 } = req.query;

      const combo = await prisma.productCombo.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  stock: true,
                },
              },
            },
          },
        },
      });

      if (!combo) {
        return res.status(404).json({ error: 'Combo no encontrado' });
      }

      const requestedQuantity = Number(quantity);
      const availability = combo.items.map(item => {
        const requiredStock = item.quantity * requestedQuantity;
        const available = item.product.stock >= requiredStock;
        const maxPossible = Math.floor(item.product.stock / item.quantity);

        return {
          productId: item.product.id,
          productName: item.product.name,
          requiredQuantity: item.quantity,
          requiredStock,
          currentStock: item.product.stock,
          available,
          maxPossible,
        };
      });

      const overallAvailable = availability.every(item => item.available);
      const maxComboQuantity = Math.min(...availability.map(item => item.maxPossible));

      res.json({
        comboId: combo.id,
        comboName: combo.name,
        requestedQuantity,
        available: overallAvailable,
        maxAvailableQuantity: maxComboQuantity,
        itemAvailability: availability,
      });
    } catch (error) {
      console.error('Error al verificar disponibilidad:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Procesar venta de combo (descontar stock)
  static async processComboSale(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { quantity = 1 } = req.body;

      const combo = await prisma.productCombo.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!combo || !combo.isActive) {
        return res.status(404).json({ error: 'Combo no encontrado o inactivo' });
      }

      const saleQuantity = Number(quantity);

      // Verificar disponibilidad
      const availability = combo.items.map(item => {
        const requiredStock = item.quantity * saleQuantity;
        return {
          productId: item.product.id,
          requiredStock,
          currentStock: item.product.stock,
          available: item.product.stock >= requiredStock,
        };
      });

      const canProcess = availability.every(item => item.available);

      if (!canProcess) {
        return res.status(400).json({ 
          error: 'Stock insuficiente para procesar la venta',
          availability,
        });
      }

      // Procesar la venta (descontar stock)
      const updates = await Promise.all(
        combo.items.map(item => 
          prisma.product.update({
            where: { id: item.product.id },
            data: {
              stock: {
                decrement: item.quantity * saleQuantity,
              },
            },
          })
        )
      );

      res.json({
        message: 'Venta de combo procesada exitosamente',
        comboId: combo.id,
        comboName: combo.name,
        quantitySold: saleQuantity,
        updatedProducts: updates.map(product => ({
          id: product.id,
          name: product.name,
          newStock: product.stock,
        })),
      });
    } catch (error) {
      console.error('Error al procesar venta de combo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}