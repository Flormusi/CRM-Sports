import { Router } from 'express';
import { ProductComboController } from '../controllers/productCombo.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Middleware de autenticación para todas las rutas
router.use(authenticate);

// Rutas de combos
router.get('/', ProductComboController.getCombos);
router.get('/:id', ProductComboController.getComboById);
router.post('/', ProductComboController.createCombo);
router.put('/:id', ProductComboController.updateCombo);
router.delete('/:id', ProductComboController.deleteCombo);

// Rutas de disponibilidad y ventas
router.get('/:id/availability', ProductComboController.checkComboAvailability);
router.post('/:id/sale', ProductComboController.processComboSale);

export default router;