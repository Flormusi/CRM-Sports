import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CRM Sports API',
      version: '1.0.0',
      description: 'API documentation for CRM Sports application',
      contact: {
        name: 'Support',
        email: 'support@crmsports.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Development server',
      },
      {
        url: 'https://api.crmsports.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Client: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            id: {
              type: 'string',
              description: 'ID único del cliente',
            },
            name: {
              type: 'string',
              description: 'Nombre del cliente',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email del cliente',
            },
            phone: {
              type: 'string',
              description: 'Teléfono del cliente',
            },
            company: {
              type: 'string',
              description: 'Empresa del cliente',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de actualización',
            },
          },
        },
        Task: {
          type: 'object',
          required: ['title', 'clientId'],
          properties: {
            id: {
              type: 'string',
              description: 'ID único de la tarea',
            },
            title: {
              type: 'string',
              description: 'Título de la tarea',
            },
            description: {
              type: 'string',
              description: 'Descripción de la tarea',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
              description: 'Estado de la tarea',
            },
            priority: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
              description: 'Prioridad de la tarea',
            },
            dueDate: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de vencimiento',
            },
            clientId: {
              type: 'string',
              description: 'ID del cliente asociado',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de actualización',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensaje de error',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths: {
      '/api/stock-alerts/config': {
        get: {
          tags: ['Stock Alerts'],
          security: [{ bearerAuth: [] }],
          summary: 'Listar configuración de alertas para todos los productos',
          responses: {
            200: { description: 'OK' },
          },
        },
        post: {
          tags: ['Stock Alerts'],
          security: [{ bearerAuth: [] }],
          summary: 'Configurar alerta para un producto',
          responses: {
            200: { description: 'OK' },
          },
        },
      },
      '/api/stock-alerts/config/{productId}': {
        get: {
          tags: ['Stock Alerts'],
          security: [{ bearerAuth: [] }],
          summary: 'Obtener configuración por producto',
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' }, 404: { description: 'No encontrado' } },
        },
        put: {
          tags: ['Stock Alerts'],
          security: [{ bearerAuth: [] }],
          summary: 'Actualizar configuración de alerta por producto',
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
        delete: {
          tags: ['Stock Alerts'],
          security: [{ bearerAuth: [] }],
          summary: 'Eliminar configuración de alerta por producto',
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/api/stock-alerts/test-email/{productId}': {
        post: {
          tags: ['Stock Alerts'],
          security: [{ bearerAuth: [] }],
          summary: 'Enviar email de prueba para alertas de stock',
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' }, 404: { description: 'No encontrado' } },
        },
      },
      '/api/stock-alerts/alerts/{productId}/viewed': {
        put: {
          tags: ['Stock Alerts'],
          security: [{ bearerAuth: [] }],
          summary: 'Marcar alerta como vista por producto',
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'OK' } },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
