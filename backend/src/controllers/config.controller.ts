import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class ConfigController {
  async getConfigurations(_req: Request, res: Response): Promise<Response> {
    try {
      const configurations = await prisma.configuration.findMany({
        orderBy: {
          key: 'asc'
        }
      });
      return res.json(configurations);
    } catch (error) {
      console.error('Error fetching configurations:', error);
      return res.status(500).json({ error: 'Failed to fetch configurations' });
    }
  }

  async createConfiguration(req: Request, res: Response): Promise<Response> {
    try {
      const { key, value } = req.body as { key: string; value: string };

      if (!key || !value) {
        return res.status(400).json({ error: 'Key and value are required' });
      }

      const existingConfig = await prisma.configuration.findUnique({
        where: { key }
      });

      if (existingConfig) {
        return res.status(400).json({ error: 'Configuration key already exists' });
      }

      const configuration = await prisma.configuration.create({
        data: {
          key,
          value,
          updatedAt: new Date(),
          createdAt: new Date()
        }
      });

      return res.status(201).json(configuration);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return res.status(400).json({ error: 'Invalid configuration data' });
      }
      console.error('Error creating configuration:', error);
      return res.status(500).json({ error: 'Failed to create configuration' });
    }
  }

  async updateConfiguration(req: Request, res: Response): Promise<Response> {
    try {
      const id = parseInt(req.params.id);
      const { key, value } = req.body as { key: string; value: string };

      if (!key || !value) {
        return res.status(400).json({ error: 'Key and value are required' });
      }

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid configuration ID' });
      }

      const configuration = await prisma.configuration.update({
        where: { key: key },  // Changed from id to key as the unique identifier
        data: { value }       // Only updating value since key is the identifier
      });

      return res.json(configuration);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Configuration not found' });
        }
        return res.status(400).json({ error: 'Invalid configuration data' });
      }
      console.error('Error updating configuration:', error);
      return res.status(500).json({ error: 'Failed to update configuration' });
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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Configuration not found' });
        }
      }
      console.error('Error deleting configuration:', error);
      return res.status(500).json({ error: 'Failed to delete configuration' });
    }
  }
}