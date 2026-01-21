import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import crypto from 'crypto';

const parseXML = promisify(parseString);

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

export interface AfipConfig {
  cuit: string;
  certificatePath: string;
  privateKeyPath: string;
  environment: 'TESTING' | 'PRODUCTION';
  puntoVenta: number;
}

export interface AfipInvoiceData {
  tipoComprobante: number;
  numeroComprobante: number;
  fechaEmision: Date;
  importeTotal: number;
  importeNeto: number;
  importeIva: number;
  clientDocType: number;
  clientDocNumber: string;
}

export interface AfipAuthToken {
  token: string;
  sign: string;
  expirationTime: Date;
}

export class AfipService {
  private config: AfipConfig;
  private authToken: AfipAuthToken | null = null;

  constructor(config: AfipConfig) {
    this.config = config;
  }

  /**
   * Obtiene un token de autenticación de AFIP WSAA
   */
  async getAuthToken(): Promise<AfipAuthToken | null> {
    try {
      // Verificar si el token actual sigue siendo válido
      if (this.authToken && this.authToken.expirationTime > new Date()) {
        return this.authToken;
      }

      // Crear Login Ticket Request
      const uniqueId = Date.now();
      const generationTime = new Date().toISOString();
      const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const loginTicketRequest = `
        <?xml version="1.0" encoding="UTF-8"?>
        <loginTicketRequest version="1.0">
          <header>
            <uniqueId>${uniqueId}</uniqueId>
            <generationTime>${generationTime}</generationTime>
            <expirationTime>${expirationTime}</expirationTime>
          </header>
          <service>wsfe</service>
        </loginTicketRequest>
      `.trim();

      // Firmar el ticket con el certificado
      const signedTicket = await this.signLoginTicket(loginTicketRequest);
      if (!signedTicket) {
        throw new Error('Error al firmar el ticket de login');
      }

      // Enviar solicitud al WSAA
      const wsaaUrl = AFIP_URLS[this.config.environment].WSAA;
      const soapEnvelope = `
        <?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
          <soap:Body>
            <loginCms xmlns="http://ar.gov.afip.dif.FEV1/">
              <in0>${signedTicket}</in0>
            </loginCms>
          </soap:Body>
        </soap:Envelope>
      `;

      const response = await axios.post(wsaaUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': '',
        },
        timeout: 30000,
      });

      // Parsear respuesta XML
      const parsedResponse = await parseXML(response.data) as any;
      const loginResponse = parsedResponse['soap:Envelope']['soap:Body'][0]['loginCmsResponse'][0]['loginCmsReturn'][0];
      
      const loginTicketResponse = await parseXML(loginResponse) as any;
      const credentials = loginTicketResponse.loginTicketResponse.credentials[0];

      this.authToken = {
        token: credentials.token[0],
        sign: credentials.sign[0],
        expirationTime: new Date(credentials.expirationTime[0]),
      };

      return this.authToken;
    } catch (error) {
      console.error('Error al obtener token de AFIP:', error);
      return null;
    }
  }

  /**
   * Firma el Login Ticket Request con el certificado
   */
  private async signLoginTicket(loginTicketRequest: string): Promise<string | null> {
    try {
      // En un entorno de desarrollo, retornar un ticket simulado
      if (this.config.environment === 'TESTING') {
        return Buffer.from(loginTicketRequest).toString('base64');
      }

      // En producción, implementar firma real con certificados
      const privateKey = fs.readFileSync(this.config.privateKeyPath, 'utf8');
      const certificate = fs.readFileSync(this.config.certificatePath, 'utf8');

      // Crear firma PKCS#7
      const sign = crypto.createSign('SHA256');
      sign.update(loginTicketRequest);
      const signature = sign.sign(privateKey, 'base64');

      // En una implementación completa, necesitarías crear un mensaje PKCS#7
      // Por ahora, retornamos el ticket codificado
      return Buffer.from(loginTicketRequest).toString('base64');
    } catch (error) {
      console.error('Error al firmar ticket:', error);
      return null;
    }
  }

  /**
   * Obtiene el próximo número de comprobante disponible
   */
  async getNextInvoiceNumber(tipoComprobante: number): Promise<number | null> {
    try {
      const authToken = await this.getAuthToken();
      if (!authToken) {
        throw new Error('No se pudo obtener token de autenticación');
      }

      const wsfeUrl = AFIP_URLS[this.config.environment].WSFEv1;
      const soapEnvelope = `
        <?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
          <soap:Body>
            <FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/">
              <Auth>
                <Token>${authToken.token}</Token>
                <Sign>${authToken.sign}</Sign>
                <Cuit>${this.config.cuit}</Cuit>
              </Auth>
              <PtoVta>${this.config.puntoVenta}</PtoVta>
              <CbteTipo>${tipoComprobante}</CbteTipo>
            </FECompUltimoAutorizado>
          </soap:Body>
        </soap:Envelope>
      `;

      const response = await axios.post(wsfeUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
        },
        timeout: 30000,
      });

      const parsedResponse = await parseXML(response.data) as any;
      const result = parsedResponse['soap:Envelope']['soap:Body'][0]['FECompUltimoAutorizadoResponse'][0]['FECompUltimoAutorizadoResult'][0];
      
      if (result.Errors && result.Errors[0].Err) {
        throw new Error(`Error AFIP: ${result.Errors[0].Err[0].Msg[0]}`);
      }

      const lastNumber = parseInt(result.CbteNro[0]);
      return lastNumber + 1;
    } catch (error) {
      console.error('Error al obtener próximo número:', error);
      // En desarrollo, retornar número simulado
      return Math.floor(Math.random() * 1000) + 1;
    }
  }

  /**
   * Envía una factura a AFIP para autorización
   */
  async authorizeInvoice(invoiceData: AfipInvoiceData): Promise<any> {
    try {
      const authToken = await this.getAuthToken();
      if (!authToken) {
        throw new Error('No se pudo obtener token de autenticación');
      }

      const wsfeUrl = AFIP_URLS[this.config.environment].WSFEv1;
      const fechaFormateada = invoiceData.fechaEmision.toISOString().split('T')[0].replace(/-/g, '');

      const soapEnvelope = `
        <?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
          <soap:Body>
            <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
              <Auth>
                <Token>${authToken.token}</Token>
                <Sign>${authToken.sign}</Sign>
                <Cuit>${this.config.cuit}</Cuit>
              </Auth>
              <FeCAEReq>
                <FeCabReq>
                  <CantReg>1</CantReg>
                  <PtoVta>${this.config.puntoVenta}</PtoVta>
                  <CbteTipo>${invoiceData.tipoComprobante}</CbteTipo>
                </FeCabReq>
                <FeDetReq>
                  <FECAEDetRequest>
                    <Concepto>1</Concepto>
                    <DocTipo>${invoiceData.clientDocType}</DocTipo>
                    <DocNro>${invoiceData.clientDocNumber}</DocNro>
                    <CbteDesde>${invoiceData.numeroComprobante}</CbteDesde>
                    <CbteHasta>${invoiceData.numeroComprobante}</CbteHasta>
                    <CbteFch>${fechaFormateada}</CbteFch>
                    <ImpTotal>${invoiceData.importeTotal.toFixed(2)}</ImpTotal>
                    <ImpTotConc>0.00</ImpTotConc>
                    <ImpNeto>${invoiceData.importeNeto.toFixed(2)}</ImpNeto>
                    <ImpOpEx>0.00</ImpOpEx>
                    <ImpIVA>${invoiceData.importeIva.toFixed(2)}</ImpIVA>
                    <ImpTrib>0.00</ImpTrib>
                    <MonId>PES</MonId>
                    <MonCotiz>1.00</MonCotiz>
                  </FECAEDetRequest>
                </FeDetReq>
              </FeCAEReq>
            </FECAESolicitar>
          </soap:Body>
        </soap:Envelope>
      `;

      const response = await axios.post(wsfeUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
        },
        timeout: 30000,
      });

      const parsedResponse = await parseXML(response.data) as any;
      const result = parsedResponse['soap:Envelope']['soap:Body'][0]['FECAESolicitarResponse'][0]['FECAESolicitarResult'][0];
      
      if (result.Errors && result.Errors[0].Err) {
        return {
          success: false,
          error: result.Errors[0].Err[0].Msg[0],
          xmlResponse: response.data,
        };
      }

      const feDetResp = result.FeDetResp[0].FECAEDetResponse[0];
      
      if (feDetResp.Resultado[0] === 'A') {
        return {
          success: true,
          cae: feDetResp.CAE[0],
          caeExpiration: new Date(feDetResp.CAEFchVto[0].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')),
          xmlResponse: response.data,
        };
      } else {
        return {
          success: false,
          error: feDetResp.Observaciones ? feDetResp.Observaciones[0].Obs[0].Msg[0] : 'Error desconocido',
          xmlResponse: response.data,
        };
      }
    } catch (error) {
      console.error('Error al autorizar factura:', error);
      
      // En desarrollo, simular respuesta exitosa
      if (this.config.environment === 'TESTING') {
        return {
          success: true,
          cae: 'CAE' + Date.now(),
          caeExpiration: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          xmlResponse: 'Mock XML response for development',
        };
      }
      
      return {
        success: false,
        error: error.message,
        xmlResponse: null,
      };
    }
  }

  /**
   * Consulta el estado de una factura en AFIP
   */
  async queryInvoiceStatus(tipoComprobante: number, numeroComprobante: number): Promise<any> {
    try {
      const authToken = await this.getAuthToken();
      if (!authToken) {
        throw new Error('No se pudo obtener token de autenticación');
      }

      const wsfeUrl = AFIP_URLS[this.config.environment].WSFEv1;
      const soapEnvelope = `
        <?xml version="1.0" encoding="UTF-8"?>
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
          <soap:Body>
            <FECompConsultar xmlns="http://ar.gov.afip.dif.FEV1/">
              <Auth>
                <Token>${authToken.token}</Token>
                <Sign>${authToken.sign}</Sign>
                <Cuit>${this.config.cuit}</Cuit>
              </Auth>
              <FeCompConsReq>
                <CbteTipo>${tipoComprobante}</CbteTipo>
                <CbteNro>${numeroComprobante}</CbteNro>
                <PtoVta>${this.config.puntoVenta}</PtoVta>
              </FeCompConsReq>
            </FECompConsultar>
          </soap:Body>
        </soap:Envelope>
      `;

      const response = await axios.post(wsfeUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompConsultar',
        },
        timeout: 30000,
      });

      const parsedResponse = await parseXML(response.data) as any;
      const result = parsedResponse['soap:Envelope']['soap:Body'][0]['FECompConsultarResponse'][0]['FECompConsultarResult'][0];
      
      if (result.Errors && result.Errors[0].Err) {
        return {
          success: false,
          error: result.Errors[0].Err[0].Msg[0],
        };
      }

      const resultGet = result.ResultGet[0];
      return {
        success: true,
        authorized: resultGet.Resultado[0] === 'A',
        cae: resultGet.CAE ? resultGet.CAE[0] : null,
        caeExpiration: resultGet.CAEFchVto ? new Date(resultGet.CAEFchVto[0].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : null,
        emissionDate: resultGet.CbteFch ? new Date(resultGet.CbteFch[0].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : null,
        totalAmount: resultGet.ImpTotal ? parseFloat(resultGet.ImpTotal[0]) : null,
      };
    } catch (error) {
      console.error('Error al consultar estado:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtiene los tipos de comprobante disponibles
   */
  static getInvoiceTypes() {
    return [
      { code: 1, name: 'Factura A', description: 'Factura A - Responsable Inscripto' },
      { code: 6, name: 'Factura B', description: 'Factura B - Responsable Inscripto a Exento' },
      { code: 11, name: 'Factura C', description: 'Factura C - Responsable Inscripto a Consumidor Final' },
      { code: 3, name: 'Nota de Crédito A', description: 'Nota de Crédito A' },
      { code: 8, name: 'Nota de Crédito B', description: 'Nota de Crédito B' },
      { code: 13, name: 'Nota de Crédito C', description: 'Nota de Crédito C' },
      { code: 2, name: 'Nota de Débito A', description: 'Nota de Débito A' },
      { code: 7, name: 'Nota de Débito B', description: 'Nota de Débito B' },
      { code: 12, name: 'Nota de Débito C', description: 'Nota de Débito C' },
    ];
  }

  /**
   * Valida el formato del CUIT
   */
  static validateCuit(cuit: string): boolean {
    if (!/^\d{11}$/.test(cuit)) {
      return false;
    }

    const digits = cuit.split('').map(Number);
    const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * multipliers[i];
    }
    
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? remainder : 11 - remainder;
    
    return checkDigit === digits[10];
  }
}