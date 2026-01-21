
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';  // Add this import

interface AuthRequest extends Request {
  user: {
    id: string;
    role: string;
    email: string;
  };
}

const router = express.Router();
const AVATAR_DIR = path.join(__dirname, '../../uploads/avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    filename: (_req, file, cb): void => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
  })
});

// Get user profile
// Add at the top of the file after imports
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  authenticate(req as AuthRequest, res, next);
};

// Update the route handlers to use authMiddleware
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    const cfg = await prisma.configuration.findUnique({ where: { key: `user_avatar_${userId}` } });
    res.json({ ...user, avatar: cfg?.value || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Also update the other routes that use userId
router.put('/profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user.id;
    const updateData = {
      ...(req.body.firstName && { firstName: req.body.firstName }),
      ...(req.body.lastName && { lastName: req.body.lastName }),
      ...(req.body.email && { email: req.body.email }),
      ...(req.body.phone && { phone: req.body.phone }),
      ...(req.body.company && { company: req.body.company })
    } as const;
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },  // Remove parseInt here too
      data: updateData
    });
    
    res.json(updatedUser);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        res.status(400).json({
          status: 'error',
          message: 'Email already exists'
        });
      }
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload avatar
const handleAvatarUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const userId = (req as AuthRequest).user.id;
    const publicUrl = `/uploads/avatars/${req.file.filename}`;

    await prisma.configuration.upsert({
      where: { key: `user_avatar_${userId}` },
      update: { value: publicUrl },
      create: { key: `user_avatar_${userId}`, value: publicUrl }
    });

    res.status(200).json({ 
      message: 'Avatar uploaded successfully',
      avatarUrl: publicUrl
    });
  } catch (error) {
    next(error);
  }
};

router.post('/avatar', authMiddleware, upload.single('avatar'), handleAvatarUpload);

export default router;
