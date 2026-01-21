import { Request, Response, NextFunction } from 'express';

interface UserRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const requireRole = (role: string) => {
  return (req: UserRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!req.user.role || req.user.role.toUpperCase() !== role.toUpperCase()) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    next();
  };
};

