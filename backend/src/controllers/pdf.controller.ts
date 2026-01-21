import { Request, Response } from 'express';
import { PDFService } from '../services/pdfService';
import { ApiError } from '../utils/ApiError';

export class PDFController {
  private pdfService: PDFService;

  constructor() {
    this.pdfService = new PDFService();
  }

  generateInvoicePDF = async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const pdfPath = await this.pdfService.generateInvoicePDF(invoiceId);
      
      res.json({
        success: true,
        message: 'PDF generated successfully',
        data: {
          path: pdfPath,
          url: `/api/invoices/${invoiceId}/pdf`
        }
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error generating PDF'
        });
      }
    }
  }

  downloadInvoicePDF = async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const pdfPath = await this.pdfService.generateInvoicePDF(invoiceId);
      
      res.download(pdfPath);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error downloading PDF'
      });
    }
  }
}