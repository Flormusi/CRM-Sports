import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import userProfileRoutes from './routes/userProfile';
import appointmentRoutes from './routes/appointments';
import taskRoutes from './routes/tasks';
import dashboardRoutes from './routes/dashboard';
import routes from './routes/index';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/test-db', async (_req, res, next) => {
  try {
    await prisma.$connect();
    const userCount = await prisma.user.count();
    res.json({ 
      status: 'success', 
      data: { 
        connection: 'Database connected', 
        users: userCount 
      }
    });
  } catch (error) {
    next(error);
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userProfileRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/', routes);

// Error Handling
app.use(errorHandler);

// Server Start
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});