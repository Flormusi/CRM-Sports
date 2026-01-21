## Resumen actual

* Backend Node/Express usa JWT para proteger rutas con `authenticate` en `backend/src/middleware/auth.ts:18`, verificando tokens con `jwt.verify` en `backend/src/middleware/auth.ts:27`.

* El token se toma de `Authorization: Bearer <token>` y se adjunta a `req.user`.

* Múltiples rutas están protegidas, por ejemplo `backend/src/routes/appointment.routes.ts:8` (`router.use(authenticate)`), y hay usos con alias como `backend/src/routes/product.routes.ts:3`.

* Observación a mejorar: existe fallback de secreto (`'your-secret-key'`) en la verificación.

## Objetivo

* Endurecer la autenticación JWT, unificar el uso del middleware en todas las rutas, y cubrir con pruebas los casos de token ausente/inválido/expirado.

## Pasos de implementación

1. Eliminar el fallback del secreto en `authenticate` y exigir `process.env.JWT_SECRET` (error claro si falta).
2. Centralizar la generación de tokens en una utilidad (p. ej. `utils/token.ts`) usando `process.env.JWT_SECRET` y `process.env.JWT_EXPIRES_IN`.
3. Añadir un middleware `requireRole(role)` para rutas administrativas y proteger acciones sensibles.
4. Normalizar imports y uso del middleware (`authenticate` vs alias) y asegurar `router.use(authenticate)` donde corresponda.
5. Agregar pruebas de integración para:

   * 401 sin `Authorization`.

   * 401 con token inválido.

   * 401 con token expirado.

   * 200 con token válido (propaga `req.user`).
6. Frontend: configurar interceptor HTTP que adjunte `Authorization: Bearer <token>` y manejo global de 401.
7. Variables de entorno y documentación: asegurar `.env` con `JWT_SECRET`/`JWT_EXPIRES_IN`, sin secretos hardcode. (Opcional: alinear FastAPI si se usa).

## Verificación

* Ejecutar pruebas y validar manualmente endpoints protegidos: sin token → 401; con token válido → acceso.

## Entregables

* Middleware actualizado, utilidad de tokens, pruebas y documentación corta de entorno.

