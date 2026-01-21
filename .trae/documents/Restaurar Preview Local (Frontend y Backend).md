## Problema
- El navegador muestra `ERR_CONNECTION_REFUSED` en `http://localhost:3000/login`, lo que indica que el servidor de desarrollo del frontend no está corriendo o el puerto/host no es accesible.

## Verificaciones
1. Comprobar si el servidor frontend está activo y en qué puerto.
2. Si no corre, iniciar `npm start` en `frontend/`.
3. Si el puerto `3000` está ocupado o bloqueado:
   - Establecer `PORT=3001` (o `3003`) para CRA y reiniciar.
   - Probar `http://127.0.0.1:3000` por si hay resolución/IPv6.
4. Confirmar backend en `http://localhost:3002` y que `frontend/.env` tenga `REACT_APP_API_URL=http://localhost:3002/api`.

## Acciones Propuestas
1. Reiniciar backend dev (`npm run dev` en `backend/`) y verificar logs de salud.
2. Reiniciar frontend dev (`npm start` en `frontend/`) y capturar la URL de preview.
3. Si persiste el refusal:
   - Cambiar puerto del frontend a `3001` (setear `PORT=3001` temporalmente al arrancar).
   - Alternativa: servir build estática con `serve -s build` en puerto `5000`.
4. Validar flujo de login: limpiar `localStorage` token, cargar `/login`, loguear con `admin@crmsports.com` / `admin123`.

## Entregables
- Arrancar servidores y proporcionar URL accesible del frontend.
- Confirmación de que la app carga y redirige correctamente a `login` si no hay sesión.

¿Avanzo con el reinicio y, si hace falta, cambio de puerto para dejarte una URL funcional inmediata?