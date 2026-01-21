import { Request, Response, NextFunction } from 'express';

interface UserRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const isAdmin = (req: UserRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (!req.user.role || req.user.role.toUpperCase() !== 'ADMIN') {
      console.warn(`Unauthorized admin access attempt by user: ${req.user.email}`);
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Error checking admin privileges' });
  }
};
