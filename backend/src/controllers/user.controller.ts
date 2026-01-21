import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { signToken } from '../utils/token';
import { prisma } from '../lib/prisma';

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and authentication
 */

export class UserController {
  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: User login
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                 user:
   *                   type: object
   *       401:
   *         description: Invalid credentials
   */
  async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signToken({ id: user.id, email: user.email, role: user.role });

      return res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        } 
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Login failed' });
    }
  }

  async logout(_req: Request, res: Response): Promise<Response> {
    res.clearCookie('token');
    return res.json({ message: 'Logged out successfully' });
  }
  async register(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'USER'
        },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true
        }
      });

      res.status(201).json(user);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true
        }
      });
      res.json(user);
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { firstName, lastName, email } = req.body;
      
      const user = await prisma.user.update({
        where: { id: userId },
        data: { firstName, lastName, email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true
        }
      });

      res.json(user);
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  async getAllUsers(_req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true
        }
      });
      res.json(users);
    } catch (error) {
      console.error('Users fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  // Keep only this implementation
  async updateUserRole(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          role: true
        }
      });

      return res.json(user);
    } catch (error) {
      console.error('Role update error:', error);
      return res.status(500).json({ error: 'Failed to update user role' });
    }
  }

  // Remove the first updateUserRole method since we have a duplicate
  
    async deleteUser(req: Request, res: Response): Promise<Response> {
      try {
        const { id } = req.params;
        await prisma.user.delete({
          where: { id }  // Remove Number() conversion
        });
        return res.json({ message: 'User deleted successfully' });
      } catch (error) {
        console.error('User deletion error:', error);
        return res.status(500).json({ error: 'Failed to delete user' });
      }
    }
}
