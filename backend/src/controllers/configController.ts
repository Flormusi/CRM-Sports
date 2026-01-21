import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const ConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1)
});

export class ConfigController {
  async getConfigurations(_req: Request, res: Response): Promise<Response> {
    try {
      const configs = await prisma.configuration.findMany({
        orderBy: {
          createdAt: 'desc'
        }
      });
      return res.json(configs);
    } catch (error) {
      console.error('Error fetching configurations:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch configurations',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateConfiguration(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const parsedId = parseInt(id);
      
      if (isNaN(parsedId)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }

      const validation = ConfigSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid input',
          details: validation.error.errors 
        });
      }

      const { key, value } = validation.data;

      const config = await prisma.configuration.update({
        where: { key },  // Using key as the unique identifier
        data: { value }  // Only updating value since key is unique
      });

      return res.json(config);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return res.status(404).json({ error: 'Configuration not found' });
      }
      console.error('Error updating configuration:', error);
      return res.status(500).json({ 
        error: 'Failed to update configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async createConfiguration(req: Request, res: Response): Promise<Response> {
    try {
      const validation = ConfigSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid input',
          details: validation.error.errors 
        });
      }

      const { key, value } = validation.data;

      const config = await prisma.configuration.create({
        data: {
          key,
          value,
          updatedAt: new Date(),
          createdAt: new Date()
        }
      });

      return res.status(201).json(config);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        return res.status(409).json({ error: 'Configuration key already exists' });
      }
      console.error('Error creating configuration:', error);
      return res.status(500).json({ 
        error: 'Failed to create configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteConfiguration(req: Request, res: Response): Promise<Response> {
    try {
      const { key } = req.params;
      
      if (!key) {
        return res.status(400).json({ error: 'Configuration key is required' });
      }

      await prisma.configuration.delete({
        where: { key }
      });

      return res.json({ message: 'Configuration deleted successfully' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        return res.status(404).json({ error: 'Configuration not found' });
      }
      console.error('Error deleting configuration:', error);
      return res.status(500).json({ 
        error: 'Failed to delete configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}