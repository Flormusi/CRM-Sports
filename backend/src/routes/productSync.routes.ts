import { Router } from 'express';
import { ProductSyncController } from '../controllers/productSync.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

// Rutas para grupos de sincronización
router.get('/groups', ProductSyncController.getSyncGroups);
router.post('/groups', ProductSyncController.createSyncGroup);
router.put('/groups/:id/sync', ProductSyncController.syncGroupStock);
router.delete('/groups/:id', ProductSyncController.deleteSyncGroup);

// Rutas para gestión de productos en grupos
router.post('/groups/:id/products', ProductSyncController.addProductToGroup);
router.delete('/groups/:id/products/:productId', ProductSyncController.removeProductFromGroup);

// Rutas auxiliares
router.get('/unsynced-products', ProductSyncController.getUnsyncedProducts);
router.post('/auto-sync', ProductSyncController.autoSync);

export default router;