import { Router } from 'express';
import { StockAlertController } from '../controllers/stockAlert.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Middleware de autenticación para todas las rutas
router.use(authenticate);

// Rutas de alertas de stock
router.get('/low-stock', StockAlertController.getLowStockProducts);
router.get('/active', StockAlertController.getActiveAlerts);
router.get('/summary', StockAlertController.getStockSummary);
router.get('/config', StockAlertController.getAlertConfig);
router.get('/config/:productId', StockAlertController.getAlertConfigByProduct);
router.post('/config', StockAlertController.configureAlert);
router.put('/config/:productId', StockAlertController.updateAlertConfig);
router.delete('/config/:productId', StockAlertController.deleteAlertConfig);
router.put('/alerts/:productId/viewed', StockAlertController.markAlertAsViewed);
router.post('/test-email/:productId', StockAlertController.testEmailNotification);

export default router;
