import { Router } from 'express';
import { PDFController } from '../controllers/pdf.controller';

const router = Router();
const pdfController = new PDFController();

// Generate PDF
router.post('/invoices/:invoiceId/pdf', pdfController.generateInvoicePDF);

// Download PDF
router.get('/invoices/:invoiceId/pdf/download', pdfController.downloadInvoicePDF);

export default router;