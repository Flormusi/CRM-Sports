import { Router, Request, Response, NextFunction } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';

const router = Router();
const userController = new UserController();

const handleRequest = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// Public routes
router.post('/login', handleRequest((req, res) => userController.login(req, res)));
router.post('/register', handleRequest((req, res) => userController.register(req, res)));

// Protected routes
router.get('/profile', authenticate, handleRequest(userController.getProfile.bind(userController)));
router.put('/profile', authenticate, handleRequest(userController.updateProfile.bind(userController)));

// Admin-only routes
router.get('/users', authenticate, isAdmin, handleRequest(userController.getAllUsers.bind(userController)));
router.put('/users/:id/role', authenticate, isAdmin, handleRequest(userController.updateUserRole.bind(userController)));
router.delete('/users/:id', authenticate, isAdmin, handleRequest(userController.deleteUser.bind(userController)));

export default router;