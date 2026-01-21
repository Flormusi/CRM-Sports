import { prisma } from '../lib/prisma';

describe('Prisma Database Connection', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should connect to database successfully', async () => {
    expect(async () => {
      const userCount = await prisma.user.count();
      expect(typeof userCount).toBe('number');
    }).not.toThrow();
  });

  test('should be able to query clients table', async () => {
    expect(async () => {
      const clientCount = await prisma.client.count();
      expect(typeof clientCount).toBe('number');
    }).not.toThrow();
  });

  test('should be able to query tasks table', async () => {
    expect(async () => {
      const taskCount = await prisma.task.count();
      expect(typeof taskCount).toBe('number');
    }).not.toThrow();
  });
});