import { Router } from 'express';
import invoiceRoutes from './invoice.routes';
import emailRoutes from './email.routes';
import stockRoutes from './stock.routes';
import stockAlertRoutes from './stockAlert.routes';

const router = Router();

router.use('/api', invoiceRoutes);
router.use('/api/email', emailRoutes);
router.use('/api/stock', stockRoutes);
router.use('/api/stock-alerts', stockAlertRoutes);

export default router;