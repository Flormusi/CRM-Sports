import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { AfipService, AfipConfig, AfipInvoiceData } from '../services/afip.service';
import { PdfHtmlService } from '../services/pdf.service';
import { EmailService } from '../services/emailService';

const prisma = new PrismaClient();

// Schemas de validación
const afipConfigSchema = z.object({
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos'),
  certificatePath: z.string().min(1),
  privateKeyPath: z.string().min(1),
  environment: z.enum(['TESTING', 'PRODUCTION']),
  puntoVenta: z.number().positive(),
});

const generateInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  tipoComprobante: z.number().default(11), // 11 = Factura C
});

// URLs de AFIP
const AFIP_URLS = {
  TESTING: {
    WSAA: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    WSFEv1: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  PRODUCTION: {
    WSAA: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    WSFEv1: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

export class AfipController {
  // Obtener configuración de AFIP
  static async getAfipConfig(req: Request, res: Response) {
    try {
      const config = await prisma.afipConfig.findFirst({
        where: { isActive: true },
      });

      if (!config) {
        return res.status(404).json({ error: 'Configuración de AFIP no encontrada' });
      }

      // No devolver las rutas de certificados por seguridad
      const { certificatePath, privateKeyPath, ...safeConfig } = config;
      res.json(safeConfig);
    } catch (error) {
      console.error('Error al obtener configuración AFIP:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear o actualizar configuración de AFIP
  static async updateAfipConfig(req: Request, res: Response) {
    try {
      const validatedData = afipConfigSchema.parse(req.body);

      // Verificar que los archivos de certificado existen
      if (!fs.existsSync(validatedData.certificatePath)) {
        return res.status(400).json({ error: 'Archivo de certificado no encontrado' });
      }

      if (!fs.existsSync(validatedData.privateKeyPath)) {
        return res.status(400).json({ error: 'Archivo de clave privada no encontrado' });
      }

      // Desactivar configuración anterior
      await prisma.afipConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      // Crear nueva configuración
      const config = await prisma.afipConfig.create({
        data: validatedData,
      });

      const { certificatePath, privateKeyPath, ...safeConfig } = config;
      res.json(safeConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de entrada inválidos', 
          details: error.errors 
        });
      }
      console.error('Error al actualizar configuración AFIP:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Generar factura electrónica en AFIP
  static async generateElectronicInvoice(req: Request, res: Response) {
    try {
      const validatedData = generateInvoiceSchema.parse(req.body);
      const { invoiceId, tipoComprobante } = validatedData;

      // Obtener la factura
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          items: true,
          afipInvoice: true,
        },
      });

      if (!invoice) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }

      const existingAfip = invoice.afipInvoice;
      if (existingAfip && existingAfip.status === 'AUTHORIZED') {
        return res.status(400).json({ error: 'La factura ya fue autorizada por AFIP' });
      }

      // Obtener configuración de AFIP
      const config = await prisma.afipConfig.findFirst({
        where: { isActive: true },
      });

      // Modo prueba: si no hay configuración activa o faltan certificados, simular CAE y finalizar
      const certsMissing = !config || !config.certificatePath || !config.privateKeyPath;
      if (certsMissing) {
        const mockNumber = (config?.lastTicketNumber || 0) + 1;
        let afipInvoice;
        if (existingAfip) {
          afipInvoice = await prisma.afipInvoice.update({
            where: { id: existingAfip.id },
            data: {
              ticketNumber: mockNumber,
              puntoVenta: config?.puntoVenta || 1,
              tipoComprobante,
              numeroComprobante: mockNumber,
              fechaEmision: new Date(),
              importeTotal: invoice.totalAmount,
              importeNeto: invoice.subtotal,
              importeIva: invoice.taxAmount,
              status: 'AUTHORIZED',
              cae: `CAE_TEST_${Math.floor(Math.random() * 1e14)}`,
              caeExpiration: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
              xmlResponse: 'Mock XML response (test mode)',
            },
          });
        } else {
          afipInvoice = await prisma.afipInvoice.create({
            data: {
              invoiceId: invoice.id,
              ticketNumber: mockNumber,
              puntoVenta: config?.puntoVenta || 1,
              tipoComprobante,
              numeroComprobante: mockNumber,
              fechaEmision: new Date(),
              importeTotal: invoice.totalAmount,
              importeNeto: invoice.subtotal,
              importeIva: invoice.taxAmount,
              status: 'AUTHORIZED',
              cae: `CAE_TEST_${Math.floor(Math.random() * 1e14)}`,
              caeExpiration: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
              xmlResponse: 'Mock XML response (test mode)',
            },
          });
        }
        res.json({
          success: true,
          afipInvoice,
          cae: afipInvoice.cae,
          caeExpiration: afipInvoice.caeExpiration,
          testMode: true,
        });
        setImmediate(async () => {
          try {
            const pdfService = new PdfHtmlService();
            await pdfService.generateAndAttach(invoice.id);
          } catch (err) {
            console.error('Post-invoice processing failed (test mode):', err);
          }
        });
        return;
      }

      // Obtener token de autenticación
      const token = await AfipController.getAuthToken(config);
      if (!token) {
        return res.status(500).json({ error: 'Error al obtener token de AFIP' });
      }

      // Obtener próximo número de comprobante
      const nextNumber = await AfipController.getNextInvoiceNumber(
        config, 
        token, 
        tipoComprobante
      );

      if (!nextNumber) {
        return res.status(500).json({ error: 'Error al obtener número de comprobante' });
      }

      // Crear o reutilizar registro de factura AFIP
      let afipInvoice;
      if (existingAfip) {
        afipInvoice = await prisma.afipInvoice.update({
          where: { id: existingAfip.id },
          data: {
            ticketNumber: config.lastTicketNumber + 1,
            puntoVenta: config.puntoVenta,
            tipoComprobante,
            numeroComprobante: nextNumber,
            fechaEmision: new Date(),
            importeTotal: invoice.totalAmount,
            importeNeto: invoice.subtotal,
            importeIva: invoice.taxAmount,
            status: 'PENDING',
          },
        });
      } else {
        afipInvoice = await prisma.afipInvoice.create({
          data: {
            invoiceId: invoice.id,
            ticketNumber: config.lastTicketNumber + 1,
            puntoVenta: config.puntoVenta,
            tipoComprobante,
            numeroComprobante: nextNumber,
            fechaEmision: new Date(),
            importeTotal: invoice.totalAmount,
            importeNeto: invoice.subtotal,
            importeIva: invoice.taxAmount,
          },
        });
      }

      // Configurar servicio AFIP
      const afipConfig: AfipConfig = {
        cuit: config.cuit,
        certificatePath: config.certificatePath,
        privateKeyPath: config.privateKeyPath,
        environment: config.environment as 'TESTING' | 'PRODUCTION',
        puntoVenta: config.puntoVenta,
      };

      const afipService = new AfipService(afipConfig);

      // Preparar datos para AFIP
      const afipInvoiceData: AfipInvoiceData = {
        tipoComprobante,
        numeroComprobante: nextNumber,
        fechaEmision: new Date(),
        importeTotal: invoice.totalAmount,
        importeNeto: invoice.subtotal,
        importeIva: invoice.taxAmount,
        clientDocType: 96, // Tipo de documento por defecto (DNI)
         clientDocNumber: '0', // Número de documento por defecto
      };

      // Autorizar factura en AFIP
      const result = await afipService.authorizeInvoice(afipInvoiceData);

      if (result.success) {
        // Actualizar con CAE recibido
        const updatedAfipInvoice = await prisma.afipInvoice.update({
          where: { id: afipInvoice.id },
          data: {
            status: 'AUTHORIZED',
            cae: result.cae,
            caeExpiration: result.caeExpiration,
            xmlResponse: result.xmlResponse,
          },
        });

        // Actualizar contador de tickets
        await prisma.afipConfig.update({
          where: { id: config.id },
          data: {
            lastTicketNumber: config.lastTicketNumber + 1,
          },
        });

        res.json({
          success: true,
          afipInvoice: updatedAfipInvoice,
          cae: result.cae,
          caeExpiration: result.caeExpiration,
        });

        // Async post-processing: generate PDF and email to client
        setImmediate(async () => {
          try {
            const pdfService = new PdfHtmlService();
            const { filepath } = await pdfService.generateAndAttach(invoice.id);
            const clientEmail = invoice.client?.email;
            if (clientEmail) {
              const emailService = new EmailService();
              // Resolve Tiendanube tracking URL
              const cfg = await prisma.configuration.findUnique({ where: { key: `tn_order_${invoice.id}` } });
              const orderId = cfg?.value;
              const base = process.env.TIENDANUBE_TRACKING_BASE_URL || '';
              const trackingUrl = orderId && base ? `${base}/${orderId}` : undefined;
              await emailService.sendInvoiceEmail({
                to: clientEmail,
                customerName: invoice.client?.name || '',
                invoiceNumber: invoice.invoiceNumber,
                pdfPath: filepath,
                trackingUrl,
              });
            }
          } catch (err) {
            console.error('Post-invoice processing failed:', err);
          }
        });
      } else {
        // Actualizar con error
        await prisma.afipInvoice.update({
          where: { id: afipInvoice.id },
          data: {
            status: 'REJECTED',
            errorMessage: result.error,
            xmlResponse: result.xmlResponse,
          },
        });

        res.status(400).json({
          error: 'Error al autorizar factura en AFIP',
          details: result.error,
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de entrada inválidos', 
          details: error.errors 
        });
      }
      console.error('Error al generar factura electrónica:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener estado de facturas AFIP
  static async getAfipInvoices(req: Request, res: Response) {
    try {
      const { status, page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (status) {
        where.status = status;
      }

      const [afipInvoices, total] = await Promise.all([
        prisma.afipInvoice.findMany({
          where,
          include: {
            invoice: {
              include: {
                client: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.afipInvoice.count({ where }),
      ]);

      res.json({
        afipInvoices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error al obtener facturas AFIP:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Verificar estado de factura en AFIP
  static async checkInvoiceStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const afipInvoice = await prisma.afipInvoice.findUnique({
        where: { id },
        include: {
          invoice: true,
        },
      });

      if (!afipInvoice) {
        return res.status(404).json({ error: 'Factura AFIP no encontrada' });
      }

      const config = await prisma.afipConfig.findFirst({
        where: { isActive: true },
      });

      if (!config) {
        return res.status(400).json({ error: 'Configuración de AFIP no encontrada' });
      }

      // Configurar servicio AFIP
      const afipConfig: AfipConfig = {
        cuit: config.cuit,
        certificatePath: config.certificatePath,
        privateKeyPath: config.privateKeyPath,
        environment: config.environment as 'TESTING' | 'PRODUCTION',
        puntoVenta: config.puntoVenta,
      };

      const afipService = new AfipService(afipConfig);

      // Consultar estado en AFIP
      const status = await afipService.queryInvoiceStatus(
        afipInvoice.tipoComprobante,
        afipInvoice.numeroComprobante
      );

      res.json({
        afipInvoice,
        afipStatus: status,
      });
    } catch (error) {
      console.error('Error al verificar estado en AFIP:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Métodos auxiliares privados
  private static async getAuthToken(config: any): Promise<string | null> {
    try {
      // Implementar autenticación WSAA con certificados
      // Este es un ejemplo simplificado - en producción necesitarías
      // implementar la autenticación completa con certificados
      
      const loginTicketRequest = `
        <?xml version="1.0" encoding="UTF-8"?>
        <loginTicketRequest version="1.0">
          <header>
            <uniqueId>${Date.now()}</uniqueId>
            <generationTime>${new Date().toISOString()}</generationTime>
            <expirationTime>${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}</expirationTime>
          </header>
          <service>wsfe</service>
        </loginTicketRequest>
      `;

      // En producción, aquí firmarías el XML con el certificado
      // y enviarías la solicitud al WSAA
      
      return 'mock_token_for_development';
    } catch (error) {
      console.error('Error al obtener token:', error);
      return null;
    }
  }

  private static async getNextInvoiceNumber(
    config: any,
    token: string,
    tipoComprobante: number
  ): Promise<number | null> {
    try {
      // Consultar último número de comprobante en AFIP
      // En desarrollo, retornar un número simulado
      return 1;
    } catch (error) {
      console.error('Error al obtener próximo número:', error);
      return null;
    }
  }

  private static async submitInvoiceToAfip(
    config: any,
    token: string,
    afipInvoice: any,
    invoice: any
  ): Promise<any> {
    try {
      // Construir XML de solicitud para WSFEv1
      const xmlRequest = `
        <?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
          <soap:Body>
            <FECAESolicitar>
              <Auth>
                <Token>${token}</Token>
                <Sign>mock_sign</Sign>
                <Cuit>${config.cuit}</Cuit>
              </Auth>
              <FeCAEReq>
                <FeCabReq>
                  <CantReg>1</CantReg>
                  <PtoVta>${config.puntoVenta}</PtoVta>
                  <CbteTipo>${afipInvoice.tipoComprobante}</CbteTipo>
                </FeCabReq>
                <FeDetReq>
                  <FECAEDetRequest>
                    <Concepto>1</Concepto>
                    <DocTipo>80</DocTipo>
                    <DocNro>${invoice.client.taxId || '0'}</DocNro>
                    <CbteDesde>${afipInvoice.numeroComprobante}</CbteDesde>
                    <CbteHasta>${afipInvoice.numeroComprobante}</CbteHasta>
                    <CbteFch>${afipInvoice.fechaEmision.toISOString().split('T')[0].replace(/-/g, '')}</CbteFch>
                    <ImpTotal>${afipInvoice.importeTotal}</ImpTotal>
                    <ImpTotConc>0</ImpTotConc>
                    <ImpNeto>${afipInvoice.importeNeto}</ImpNeto>
                    <ImpOpEx>0</ImpOpEx>
                    <ImpIVA>${afipInvoice.importeIva}</ImpIVA>
                    <ImpTrib>0</ImpTrib>
                    <MonId>PES</MonId>
                    <MonCotiz>1</MonCotiz>
                  </FECAEDetRequest>
                </FeDetReq>
              </FeCAEReq>
            </FECAESolicitar>
          </soap:Body>
        </soap:Envelope>
      `;

      // En desarrollo, simular respuesta exitosa
      return {
        success: true,
        cae: 'CAE' + Date.now(),
        caeExpiration: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        xmlResponse: 'Mock XML response',
      };
    } catch (error) {
      console.error('Error al enviar a AFIP:', error);
      return {
        success: false,
        error: error.message,
        xmlResponse: null,
      };
    }
  }

  private static async queryInvoiceStatus(
    config: any,
    token: string,
    afipInvoice: any
  ): Promise<any> {
    try {
      // Consultar estado en AFIP
      // En desarrollo, retornar estado simulado
      return {
        authorized: true,
        cae: afipInvoice.cae,
        caeExpiration: afipInvoice.caeExpiration,
      };
    } catch (error) {
      console.error('Error al consultar estado:', error);
      return {
        authorized: false,
        error: error.message,
      };
    }
  }

  // Obtener tipos de comprobante disponibles
  static async getInvoiceTypes(req: Request, res: Response) {
    try {
      const invoiceTypes = AfipService.getInvoiceTypes();

      res.json({
        success: true,
        types: invoiceTypes,
      });
    } catch (error) {
      console.error('Error al obtener tipos de comprobante:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}
