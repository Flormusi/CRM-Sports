import { Response } from 'express';
import { ApiError } from './ApiError';

export const handleError = (error: unknown, res: Response, defaultMessage: string): void => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  } else {
    const status = error instanceof Error ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error instanceof Error ? error.message : defaultMessage
    });
  }
};