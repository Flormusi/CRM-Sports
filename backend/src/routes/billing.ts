import { Request, Response, NextFunction } from 'express';

export const validateOrderId = (req: Request, res: Response, next: NextFunction): void => {
  const { orderId } = req.body;

  if (!orderId || typeof orderId !== 'string') {
    res.status(400).json({ error: 'Invalid or missing orderId' });
    return; // Stop further execution
  }

  next(); // Proceed if validation passes
};
