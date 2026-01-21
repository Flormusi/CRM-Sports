import { describe, expect, it, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.routes';
import dashboardRoutes from '../routes/dashboard';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import { signToken } from '../utils/token';

describe('Authentication', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User'
  };

  beforeEach(async () => {
    await prisma.$connect();
    // Clean up any existing test user
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    // Create test user
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    await prisma.user.create({
      data: {
        email: testUser.email,
        password: hashedPassword,
        firstName: testUser.firstName,
        lastName: testUser.lastName
      }
    });
  });

  afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await prisma.$disconnect();
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Protected endpoints', () => {
    it('should return 401 without Authorization header', async () => {
      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });

    it('should return 401 with expired token', async () => {
      const expiredToken = signToken({ id: 'expired', email: 'expired@test.com', role: 'USER' }, '1ms');
      await new Promise((r) => setTimeout(r, 10));
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('should return 200 with valid token', async () => {
      const token = signToken({ id: 'valid', email: 'valid@test.com', role: 'USER' });
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalClients');
    });
  });
});
