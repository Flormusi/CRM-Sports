## Resumen del Proyecto
- Arquitectura: monorepo con `backend` (Node/Express/TypeScript + Prisma/Postgres, Swagger, JWT) y `frontend` (React + MUI + Router) funcionando; existe carpeta `client` legacy y un esqueleto FastAPI no usado en orquestación.
- Frontend: rutas protegidas con token y layout MUI, páginas principales implementadas (Login, Dashboard, Clients, Products, StockAlerts, Messages, Invoices, Afip*, Analytics).
- Backend: rutas `/api/*` para auth, clientes, productos, órdenes, facturas, AFIP, mensajes, notificaciones y alertas de stock; Swagger montado.
- Datos: Prisma para usuarios/clientes/productos/órdenes/facturas; modelos Mongoose coexistentes para clientes/productos/órdenes/stock métricas.
- Infra: Docker Compose para backend + Postgres, Jest en backend, CRA tests en `client`, múltiples `.env` con JWT/DB/SMTP/Redis/MercadoLibre.

## Mejoras Propuestas Inmediatas
1. Alinear API de alertas de stock entre frontend y backend.
2. Completar endpoints faltantes o ajustar el cliente para evitar inconsistencias.
3. Añadir pruebas de integración y documentación Swagger para nuevos endpoints.
4. Verificar configuración `.env` y CORS para entorno local.

## Detalle de Alineación de Alertas de Stock
1. Backend: ampliar `stockAlert.routes.ts` y `stockAlert.controller.ts`:
   - Exponer `GET /config/:productId` y `PUT /config/:productId`.
   - Agregar `DELETE /config/:productId` para limpieza de configuración.
   - Implementar `POST /test-email/:productId` (simulación/SMTP) para compatibilidad con el frontend.
   - Opcional: `PATCH /:alertId/read` o mantener `PUT /alerts/:productId/viewed` y adaptar frontend.
2. Frontend: actualizar `stockAlertService.ts` si se decide conservar la convención del backend actual:
   - Cambiar `markAlertAsRead` a `PUT /alerts/:productId/viewed`.
   - Ajustar payloads de configuración: `minStock`, `criticalStock`, `alertDays`.
3. Documentación:
   - Añadir entradas Swagger con `bearerAuth` para nuevos endpoints y respuestas.
4. Pruebas:
   - Backend: Jest para controller de stock alerts (config, summary, active), mocks de Prisma/SMTP.
   - Frontend: pruebas básicas de `StockAlerts.tsx` para carga de datos y guardar configuración.

## Verificación Local
1. Backend: levantar con Docker Compose o `npm run dev` en `backend` y migraciones Prisma.
2. Frontend: `REACT_APP_API_URL` apuntando a `http://localhost:3001/api` y probar rutas protegidas.
3. Validar `StockAlerts`: resumen, tableros, edición de configuración y envío de email de prueba.

¿Confirmás que avancemos con esta alineación y validaciones? 