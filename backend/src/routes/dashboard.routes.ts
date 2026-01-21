import express, { Request, Response, NextFunction } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';

const router = express.Router();
const dashboardController = new DashboardController();

const handleRequest = (fn: (req: Request, res: Response) => Promise<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
};

router.get('/stats', authenticate, handleRequest((req, res) => dashboardController.getStats(req, res)));
router.get('/summary', authenticate, handleRequest((req, res) => dashboardController.getSummary(req, res)));
router.get('/sales', authenticate, isAdmin, handleRequest((req, res) => dashboardController.getSalesStats(req, res)));
router.get('/recent-activity', authenticate, handleRequest((req, res) => dashboardController.getRecentActivity(req, res)));

export default router;
