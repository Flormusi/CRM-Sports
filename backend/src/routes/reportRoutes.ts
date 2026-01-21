import express from 'express';
import { ReportController } from '../controllers/reportController';

const router = express.Router();
const reportController = new ReportController();

router.get('/sales', reportController.getSalesReport);
router.get('/inventory', reportController.getInventoryReport);
router.get('/customers', reportController.getCustomerReport);

export default router;