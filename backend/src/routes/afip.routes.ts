import { Router } from 'express';
import { AfipController } from '../controllers/afip.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

// Rutas de configuración AFIP
router.get('/config', AfipController.getAfipConfig);
router.put('/config', AfipController.updateAfipConfig);

// Rutas de facturación electrónica
router.post('/generate-invoice', AfipController.generateElectronicInvoice);
router.get('/invoices', AfipController.getAfipInvoices);
router.get('/invoices/:id/status', AfipController.checkInvoiceStatus);

// Rutas de utilidades
router.get('/invoice-types', AfipController.getInvoiceTypes);

export default router;