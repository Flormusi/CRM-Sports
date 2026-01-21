import express, { Request, Response, NextFunction } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authenticate } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';

const router = express.Router();
const customerController = new CustomerController();

const handleRequest = (fn: (req: Request, res: Response) => Promise<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
};

router.get('/', authenticate, handleRequest((req, res) => customerController.getAll(req, res)));
router.get('/:id', authenticate, handleRequest((req, res) => customerController.getById(req, res)));
router.post('/', authenticate, handleRequest((req, res) => customerController.create(req, res)));
router.put('/:id', authenticate, handleRequest((req, res) => customerController.update(req, res)));
router.delete('/:id', authenticate, isAdmin, handleRequest((req, res) => customerController.delete(req, res)));

export default router;