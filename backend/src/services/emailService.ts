import nodemailer from 'nodemailer';
import { ApiError } from '../utils/ApiError';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      throw new ApiError(500, 'SMTP configuration is missing');
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  }

  async sendInvoiceEmail(data: {
    to: string;
    customerName?: string;
    invoiceNumber: string;
    pdfPath: string;
    trackingUrl?: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: data.to,
        subject: `Factura ${data.invoiceNumber} - CRM Sports`,
        html: `
          <h2>Hola ${data.customerName || ''}</h2>
          <p>Adjuntamos tu factura ${data.invoiceNumber}. Podés descargarla y conservarla para tu control.</p>
          ${data.trackingUrl ? `<p>Seguimiento de tu pedido: <a href="${data.trackingUrl}">${data.trackingUrl}</a></p>` : ''}
          <p>Gracias por tu compra.</p>
        `,
        attachments: [
          {
            filename: `Factura-${data.invoiceNumber}.pdf`,
            path: data.pdfPath,
          }
        ]
      });
    } catch (error) {
      console.error('Failed to send invoice email:', error);
      throw new ApiError(500, 'Failed to send invoice email');
    }
  }

  async sendStockAlert(data: {
    productId: string;
    meliId: string;
    currentStock: number;
    threshold: number;
    price: number;
    recipientEmail: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: data.recipientEmail,
        subject: `Low Stock Alert - Product ${data.productId}`,
        html: this.generateStockAlertTemplate(data)
      });
    } catch (error) {
      console.error('Failed to send stock alert:', error);
      throw new ApiError(500, 'Failed to send stock alert email');
    }
  }

  private generateStockAlertTemplate(data: {
    productId: string;
    meliId: string;
    currentStock: number;
    threshold: number;
    price: number;
  }): string {
    return `
      <h1>Low Stock Alert</h1>
      <p>A product has reached its minimum stock threshold:</p>
      <ul>
        <li>Product ID: ${data.productId}</li>
        <li>MercadoLibre ID: ${data.meliId}</li>
        <li>Current Stock: ${data.currentStock}</li>
        <li>Threshold: ${data.threshold}</li>
        <li>Current Price: $${data.price}</li>
      </ul>
      <p>Please review and restock if necessary.</p>
    `;
  }
}
