import { signToken } from './token';
import dotenv from 'dotenv';

dotenv.config();

const generateAdminToken = () => {
  const adminUser = {
    id: '1',
    email: 'admin@test.com',
    role: 'admin'
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return signToken(adminUser, '1h');
};

try {
  const token = generateAdminToken();
  console.log('Admin Token:', token);
} catch (error: any) {
  console.error('Error generating token:', error?.message || 'Unknown error');
}
