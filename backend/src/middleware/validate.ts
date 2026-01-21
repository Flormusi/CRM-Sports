import { Request, Response, NextFunction } from 'express';
const { validationResult } = require('express-validator');

export const validate = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await Promise.all(validations.map(validation => validation.run(req)));
      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }
      res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    } catch (error) {
      next(error);
    }
  };
};