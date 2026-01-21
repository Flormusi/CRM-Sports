import { Router } from 'express';
import { QuickResponseController } from '../controllers/quickResponse.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

// Rutas principales de respuestas rápidas
router.get('/', QuickResponseController.getQuickResponses);
router.get('/categories', QuickResponseController.getCategories);
router.get('/tags', QuickResponseController.getTags);
router.get('/stats', QuickResponseController.getUsageStats);
router.get('/:id', QuickResponseController.getQuickResponseById);
router.post('/', QuickResponseController.createQuickResponse);
router.post('/:id/duplicate', QuickResponseController.duplicateQuickResponse);
router.put('/:id', QuickResponseController.updateQuickResponse);
router.put('/:id/use', QuickResponseController.useQuickResponse);
router.delete('/:id', QuickResponseController.deleteQuickResponse);

export default router;