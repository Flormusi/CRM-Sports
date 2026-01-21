import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin user if not exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@crmsports.com' }
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: 'admin@crmsports.com',
        password: await hash('admin123', 10),
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN'
      }
    });
  }

  // Create multiple clients
  for (const clientData of [
    {
      id: '1',
      name: 'Sports Club A',
      email: 'contact@sportscluba.com',
      phone: '1234567890',
      company: 'Sports Club A Inc.',
    },
    {
      id: '2',
      name: 'Fitness Center Pro',
      email: 'info@fitnesspro.com',
      phone: '9876543210',
      company: 'Fitness Pro LLC',
    },
    {
      id: '3',
      name: 'CrossFit Zone',
      email: 'info@crossfitzone.com',
      phone: '5556667777',
      company: 'CrossFit Zone LLC',
    }
  ]) {
    const existingClient = await prisma.client.findUnique({
      where: { id: clientData.id }
    });

    if (!existingClient) {
      await prisma.client.create({
        data: {
          ...clientData,
          updatedAt: new Date(),
          Task: clientData.id === '3' ? {
            create: [
              {
                id: '3',
                title: 'Monthly Progress Review',
                description: 'Review client progress and update training plan',
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                priority: 'MEDIUM',
                status: 'IN_PROGRESS',
                updatedAt: new Date()
              }
            ]
          } : undefined,
          Appointment: clientData.id === '2' ? {
            create: [
              {
                id: '2',
                date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                duration: 90,
                type: 'Consultation',
                notes: 'Annual equipment maintenance review',
                updatedAt: new Date()
              }
            ]
          } : undefined
        }
      });
    }
  }

  // Create products
  await Promise.all([
    prisma.product.create({
      data: {
        name: 'Training Kit Pro',
        description: 'Professional training equipment set',
        price: 299.99,
        stock: 50,
        minStock: 10
      }
    }),
    prisma.product.create({
      data: {
        name: 'Gym Essentials Pack',
        description: 'Basic gym equipment package',
        price: 149.99,
        stock: 100,
        minStock: 20
      }
    })
  ]);

  // Create sample orders
  const user = await prisma.user.findUnique({
    where: { email: 'admin@crmsports.com' }
  });

  if (user) {
    const products = await prisma.product.findMany();
    
    await prisma.order.create({
      data: {
        total: 599.98,
        status: 'PENDING',
        customerId: user.id,
        orderItems: {
          create: [
            {
              quantity: 1,
              price: 299.99,
              productId: products[0].id // Training Kit Pro
            },
            {
              quantity: 2,
              price: 149.99,
              productId: products[1].id // Gym Essentials Pack
            }
          ]
        }
      }
    });
    // Create notification
    await prisma.notification.create({
      data: {
        message: "New order received",
        userId: user.id
      }
    });

    // Add system configurations
    const configsToCreate = [
      { key: "NOTIFICATION_ENABLED", value: "true" },
      { key: "LOW_STOCK_THRESHOLD", value: "25" }, // Increased buffer for popular items
      { key: "CRITICAL_STOCK_THRESHOLD", value: "10" }, // Emergency reorder point
      { key: "REORDER_QUANTITY_MULTIPLIER", value: "2.5" }, // Order 2.5x the threshold
      { key: "STOCK_CHECK_INTERVAL", value: "86400" }, // Daily check in seconds
      { key: "SEASONAL_STOCK_BUFFER", value: "40" }, // Higher buffer during peak seasons
      { key: "AUTO_REORDER_ENABLED", value: "true" },
      { key: "HIGH_CPU_USAGE_THRESHOLD", value: "85" }, // percentage
      { key: "HIGH_MEMORY_USAGE_THRESHOLD", value: "90" }, // percentage
      { key: "API_RESPONSE_TIME_THRESHOLD", value: "2000" }, // milliseconds
      { key: "CONCURRENT_USERS_THRESHOLD", value: "100" },
      { key: "DAILY_ORDER_ALERT_THRESHOLD", value: "50" },
      { key: "AUTO_ASSIGN_TASKS", value: "true" },
      // Production configurations
      { key: "SSL_ENABLED", value: "true" },
      { key: "SSL_CERT_PATH", value: "C:\\Program Files\\CRM Sports\\ssl\\certs\\crm-sports.crt" },
      { key: "SSL_KEY_PATH", value: "C:\\Program Files\\CRM Sports\\ssl\\private\\crm-sports.key" },
      
      // Log paths adjusted for Windows
      { key: "LOG_PATH", value: "C:\\Program Files\\CRM Sports\\logs" },
      { key: "BACKUP_PATH", value: "C:\\Program Files\\CRM Sports\\backups" },
      { key: "SSL_CERT_PATH", value: "/usr/local/etc/ssl/certs/crm-sports.crt" },
      { key: "SSL_KEY_PATH", value: "/usr/local/etc/ssl/private/crm-sports.key" },
      // Monitoring configurations - cost-optimized
      { key: "MONITORING_INTERVAL", value: "900" }, // Changed to 15 minutes
      { key: "PERFORMANCE_METRICS_INTERVAL", value: "3600" }, // Hourly metrics
      // Log rotation settings - optimized for storage
      { key: "LOG_MAX_SIZE", value: "50000000" }, // Reduced to 50MB per file
      { key: "LOG_MAX_FILES", value: "5" }, // Reduced to 5 files
      { key: "LOG_COMPRESS", value: "true" },
      // Module specific logging - focused on critical areas
      { key: "ORDER_LOG_LEVEL", value: "WARN" }, // Changed from INFO
      { key: "INVENTORY_LOG_LEVEL", value: "WARN" }, // Changed from DEBUG
      { key: "SECURITY_LOG_LEVEL", value: "ERROR" }, // Changed from WARN
      { key: "PAYMENT_LOG_LEVEL", value: "ERROR" },
      // Reduced retention period
      { key: "LOG_RETENTION_DAYS", value: "30" }, // Changed from 90
      { key: "ERROR_LOGGING_LEVEL", value: "INFO" }, // Changed from ERROR to capture more details
      { key: "LOG_RETENTION_DAYS", value: "90" },
      { key: "LOG_PATH", value: "/var/log/crm-sports" },
      { key: "AUDIT_LOGGING_ENABLED", value: "true" },
      { key: "TRANSACTION_LOGGING_ENABLED", value: "true" },
      { key: "LOG_FORMAT", value: "JSON" },
      { key: "PERFORMANCE_METRICS_ENABLED", value: "true" },
      // Backup configurations
      { key: "BACKUP_ENABLED", value: "true" },
      { key: "BACKUP_FREQUENCY", value: "86400" }, // Daily in seconds
      { key: "BACKUP_RETENTION_DAYS", value: "30" },
      { key: "BACKUP_PATH", value: "/var/backups/crm-sports" },
      // Security configurations
      { key: "MAX_LOGIN_ATTEMPTS", value: "5" },
      { key: "PASSWORD_EXPIRY_DAYS", value: "90" },
      { key: "SESSION_TIMEOUT_MINUTES", value: "30" },
      { key: "REQUIRE_2FA", value: "true" },
      // Deployment configurations
      { key: "MAINTENANCE_MODE_ENABLED", value: "false" },
      { key: "MAINTENANCE_WINDOW", value: "0 2 * * 0" }, // Weekly maintenance at 2 AM Sunday
      { key: "ERROR_NOTIFICATION_EMAIL", value: "admin@crmsports.com" },
      { key: "SYSTEM_STATUS_CHECK_ENABLED", value: "true" },
      // Final deployment checks
      { key: "DEPLOYMENT_VERSION", value: "1.0.0" },
      { key: "DEPLOYMENT_DATE", value: new Date().toISOString() },
      { key: "HEALTH_CHECK_ENDPOINT", value: "/api/health" },
      { key: "ROLLBACK_ENABLED", value: "true" },
      { key: "DEPLOYMENT_ENVIRONMENT", value: "production" },
      
      // Critical alerts
      { key: "ALERT_EMAIL_ENABLED", value: "true" },
      { key: "ALERT_PHONE_NUMBER", value: "" }, // To be filled by client
      { key: "CRITICAL_ALERT_THRESHOLD", value: "3" }, // Alerts within 1 hour
      
      // ... rest of configs
    ];

    for (const config of configsToCreate) {
      const existingConfig = await prisma.configuration.findUnique({
        where: { key: config.key }
      });

      if (!existingConfig) {
        await prisma.configuration.create({
          data: {
            ...config,
            updatedAt: new Date()
          }
        });
      }
    }
    
    // Add a completed task
    const client = await prisma.client.findUnique({
      where: { id: '1' }
    });
    
    if (client) {
      const existingTask = await prisma.task.findUnique({
        where: { id: '2' }
      });

      if (!existingTask) {
        await prisma.task.create({
          data: {
            id: '2',
            title: 'Initial Setup',
            description: 'Complete initial system setup',
            dueDate: new Date(),
            clientId: '1',
            priority: 'HIGH',
            status: 'COMPLETED',
            updatedAt: new Date()
          }
        });
      }
    }
  }

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
