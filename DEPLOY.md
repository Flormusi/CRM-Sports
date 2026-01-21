# Deploy

## Backend en Railway
- Crear un nuevo proyecto en Railway e importar este repositorio.
- Añadir un servicio de Postgres y copiar el `DATABASE_URL`.
- Variables de entorno:
  - `DATABASE_URL`: cadena de conexión de Postgres (Railway).
  - `PORT`: 3002
  - `JWT_SECRET`: una cadena segura.
  - `FRONTEND_URL`: URL del frontend en producción (por ejemplo, `https://tu-app.vercel.app`).
  - Opcionales:
    - `PUPPETEER_EXECUTABLE_PATH`: ruta del navegador en Railway si usás Puppeteer; si no, se usa fallback PDFKit.
    - `TRACKING_LOOKUP_BASE_URL`, `TIENDANUBE_TRACKING_BASE_URL`: para QR de tracking.
    - SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) si envías emails.
  - Asegurá CORS: ya aceptamos `FRONTEND_URL`.
- Comandos:
  - Build: `npm run build`
  - Start: `npm run start`
- Prisma:
  - Ejecutar migraciones: `npx prisma migrate deploy` con `DATABASE_URL` configurado.
- Static:
  - Los PDFs se sirven desde `/uploads/invoices`.

## Frontend en Vercel
- Importar el proyecto de `frontend` en Vercel.
- Variables de entorno:
  - `REACT_APP_API_URL`: `https://<railway-domain>/api`
- Build:
  - Comando: `npm run build`
  - Output: automático por React Scripts
- Enlaces:
  - Copiar la URL de Vercel e ingresarla en `FRONTEND_URL` del backend en Railway.

## Notas
- Autenticación: el frontend inyecta `Authorization: Bearer <token>`.
- AFIP modo prueba: si faltan certificados, se genera CAE simulado y PDF.
- PDFs: si es necesario, habilitar `PUPPETEER_EXECUTABLE_PATH`; en caso contrario, PDFKit genera PDFs válidos.
