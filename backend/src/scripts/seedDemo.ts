import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create demo admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 8),
      name: 'Admin User',
      role: 'ADMIN'
    }
  });

  // Create demo client
  const client = await prisma.client.create({
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      company: 'Sports Club',
      appointments: {
        create: [
          {
            date: new Date(Date.now() + 86400000), // tomorrow
            duration: 60,
            type: 'Training Session',
            notes: 'Initial assessment',
            status: 'SCHEDULED'
          }
        ]
      },
      tasks: {
        create: [
          {
            title: 'Follow-up call',
            description: 'Discuss training progress',
            dueDate: new Date(Date.now() + 172800000), // day after tomorrow
            priority: 'HIGH',
            status: 'PENDING'
          }
        ]
      }
    }
  });

  console.log('Demo data created successfully');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());