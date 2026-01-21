## Credenciales Disponibles
- Admin (seed principal): email `admin@crmsports.com`, password `admin123`.
- Admin demo (script de ejemplo): email `admin@example.com`, password `admin123`.
- Pruebas automatizadas: `test@example.com` / `password123` (normalmente no sembrado en BD real).

## Cómo Loguear
- Endpoint: `POST http://localhost:3002/api/auth/login`
- Body: `{ "email": "admin@crmsports.com", "password": "admin123" }`
- El frontend ya usa este endpoint; al loguearte se guarda el `token` en `localStorage` y habilita rutas protegidas.

## Si no existen usuarios sembrados
- Opción A: ejecutar el seed (admin `admin@crmsports.com`).
- Opción B: usar `POST /api/auth/register` para crear un usuario (rol `USER`).
- Opción C: activar el script demo (admin `admin@example.com`).

¿Querés que deje listo el admin `admin@crmsports.com` si no está creado o preferís usar el registro desde la UI?