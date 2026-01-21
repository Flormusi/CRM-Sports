import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

// Rutas de facturas
router.get('/', InvoiceController.getInvoices);
router.get('/stats', InvoiceController.getInvoiceStats);
router.get('/reports/gross-profit', InvoiceController.getGrossProfitReport);
router.get('/:id/picking', InvoiceController.getPickingList);
router.get('/config', InvoiceController.getInvoiceConfig);
router.put('/config', InvoiceController.updateInvoiceConfig);
router.post('/process-overdue', InvoiceController.processOverdueInvoices);
router.get('/:id', InvoiceController.getInvoiceById);
router.post('/', InvoiceController.createInvoice);
router.put('/:id', InvoiceController.updateInvoice);
router.delete('/:id', InvoiceController.deleteInvoice);
router.post('/generate/:orderId', InvoiceController.generateInvoiceFromOrder);
router.post('/:id/mark-paid', InvoiceController.markAsPaid);
router.post('/:id/pdf/generate', InvoiceController.generatePdf);
router.get('/:id/pdf', InvoiceController.downloadPdf);

export default router;
