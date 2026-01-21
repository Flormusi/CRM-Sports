import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

// Rutas principales de notificaciones
router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.get('/:id', NotificationController.getNotificationById);
router.post('/', NotificationController.createNotification);
router.post('/system', NotificationController.createSystemNotification);
router.put('/:id', NotificationController.updateNotification);
router.put('/:id/read', NotificationController.markAsRead);
router.put('/mark-all-read', NotificationController.markAllAsRead);
router.delete('/old', NotificationController.deleteOldNotifications);
router.delete('/:id', NotificationController.deleteNotification);

export default router;