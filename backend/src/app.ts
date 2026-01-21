import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import clientRoutes from './routes/client.routes';
import taskRoutes from './routes/tasks';
import dashboardRoutes from './routes/dashboard.routes';
import messageRoutes from './routes/message.routes';
import appointmentRoutes from './routes/appointment.routes';
import notificationRoutes from './routes/notification.routes';
import stockAlertRoutes from './routes/stockAlert.routes';
import productComboRoutes from './routes/productCombo.routes';
import productSyncRoutes from './routes/productSync.routes';
import quickResponseRoutes from './routes/quickResponse.routes';
import invoiceRoutes from './routes/invoice.routes';
import afipRoutes from './routes/afip.routes';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import userProfileRoutes from './routes/userProfile';
import tiendanubeRoutes from './routes/tiendanube.routes';
import pdfRoutes from './routes/pdf.routes';
import swaggerSpec from './config/swagger';

const app = express();

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean) as string[];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression() as unknown as express.RequestHandler); // Fix type assertion with unknown
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stock-alerts', stockAlertRoutes);
app.use('/api/product-combos', productComboRoutes);
app.use('/api/product-sync', productSyncRoutes);
app.use('/api/quick-responses', quickResponseRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/afip', afipRoutes);
app.use('/api/users', userProfileRoutes);
app.use('/api/tiendanube', tiendanubeRoutes);
app.use('/api', pdfRoutes);

// Static assets (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, must-revalidate');
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Disposition', 'inline');
    }
  }
}));

// Error handling
app.use(errorHandler);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

export { app };
