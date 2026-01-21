import { Router, Request, Response, NextFunction } from 'express';
import { EmailController } from '../controllers/email.controller';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();
const emailController = new EmailController();

const handleRequest = (fn: (req: Request, res: Response) => Promise<void>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
};

// Admin routes for email monitoring
router.get('/queue/status', isAdmin, handleRequest(emailController.getQueueStatus.bind(emailController)));
router.get('/queue/failed', isAdmin, handleRequest(emailController.getFailedEmails.bind(emailController)));
router.post('/queue/retry/:jobId', isAdmin, handleRequest(emailController.retryFailedEmail.bind(emailController)));

export default router;