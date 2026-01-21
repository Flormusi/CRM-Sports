import express, { Request, Response, RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { signToken } from '../utils/token';
import { prisma } from '../lib/prisma';

const router = express.Router();

const register = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Raw request body:', req.body);
    
    if (!req.body || typeof req.body !== 'object') {
      console.error('Invalid request body format:', req.body);
      res.status(400).json({ error: 'Invalid request format' });
      return;
    }

    const { email, password, firstName, lastName } = req.body;
    
    if (typeof email !== 'string' || typeof password !== 'string' || 
        typeof firstName !== 'string' || typeof lastName !== 'string') {
      console.error('Invalid data types in request');
      res.status(400).json({ error: 'Invalid data format' });
      return;
    }

    try {
      await prisma.$connect();
      console.log('Database connected successfully');
      
      const existingUser = await prisma.user.findUnique({ 
        where: { email },
        select: { email: true }
      });
      
      if (existingUser) {
        console.log('Email already exists:', email);
        res.status(400).json({ error: 'Email already exists' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'USER'
        }
      });

      console.log('User created successfully:', { id: user.id, email: user.email });
      res.status(201).json({ message: 'User created successfully', userId: user.id });
    } catch (dbError: any) {
      console.error('Database error:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta
      });
      throw dbError;
    }
  } catch (error: any) {
    console.error('Registration failed:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ error: `Registration failed: ${error.message}` });
  }
};

const login: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('User not found:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    console.log('Login successful for user:', email);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Login error details:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: `Login failed: ${error.message}` });
  }
};

router.post('/register', register);
router.post('/login', login);

export default router;
