import express, { Request, Response, NextFunction } from 'express';
import { OrderController } from '../controllers/order.controller';  // Fixed import path
import { authenticate } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';

const router = express.Router();
const orderController = new OrderController();

const handleRequest = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// Get all orders
router.get('/', authenticate, handleRequest(async (req, res) => {
  await orderController.getAll(req, res);  // Removed next parameter
}));

// Get orders by customer (must be before /:id route)
router.get('/customer/:customerId', authenticate, handleRequest(async (req, res) => {
  await orderController.getByCustomer(req, res);  // Removed next parameter
}));

// Get order by ID
router.get('/:id', authenticate, handleRequest(async (req, res) => {
  await orderController.getById(req, res);  // Removed next parameter
}));

// Create new order
router.post('/', authenticate, handleRequest(async (req, res) => {
  await orderController.create(req, res);  // Removed next parameter
}));

// Update order status
router.put('/:id/status', authenticate, isAdmin, handleRequest(async (req, res) => {
  await orderController.updateStatus(req, res);  // Removed next parameter
}));

// Cancel order
router.put('/:id/cancel', authenticate, isAdmin, handleRequest(async (req, res) => {
  await orderController.cancelOrder(req, res);  // Removed next parameter
}));

export default router;