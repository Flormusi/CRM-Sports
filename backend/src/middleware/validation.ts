import { Request, Response, NextFunction } from 'express';

export const validateOrderId = (req: Request, res: Response, next: NextFunction) => {
  const { orderId } = req.body;
  
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ error: 'Valid order ID is required' });
  }

  next();
};