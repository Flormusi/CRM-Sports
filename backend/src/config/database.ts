import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-sports';
export const prisma = new PrismaClient();

// MongoDB Configuration
export const connectMongoDb = async (): Promise<void> => {
  try {
    const options = {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGODB_URI, options);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('🔌 MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

// PostgreSQL Configuration (using Prisma)
export const connectPostgresDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully (managed by Prisma)');
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error);
    throw error;
  }
};

// Remove the pg Pool since we're using Prisma