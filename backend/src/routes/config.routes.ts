import express, { Request, Response, NextFunction } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { authenticate } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';

const router = express.Router();
const configController = new ConfigController();

const handleRequest = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// Get all configurations
router.get('/', authenticate, handleRequest(async (req, res) => {
  await configController.getConfigurations(req, res);
}));

// Create new configuration
router.post('/', authenticate, isAdmin, handleRequest(async (req, res) => {
  await configController.createConfiguration(req, res);
}));

// Update configuration
router.put('/:id', authenticate, isAdmin, handleRequest(async (req, res) => {
  await configController.updateConfiguration(req, res);
}));

// Delete configuration
router.delete('/:id', authenticate, isAdmin, handleRequest(async (req, res) => {
  await configController.deleteConfiguration(req, res);
}));

export default router;