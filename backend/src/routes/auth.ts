import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signToken } from '../utils/token';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 8);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: name,
        lastName: '',           // Add required lastName field
        role: 'USER',
        updatedAt: new Date()
      },
    });

    const token = signToken({ userId: user.id });
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(400).json({ error: 'Unable to register' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error();
    }

    const token = signToken({ userId: user.id });
    res.json({ user, token });
  } catch (error) {
    res.status(401).json({ error: 'Unable to login' });
  }
});

export default router;
