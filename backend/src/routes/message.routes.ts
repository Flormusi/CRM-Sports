import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Middleware de autenticación para todas las rutas
router.use(authenticate);

// Rutas de conversaciones
router.get('/conversations', MessageController.getConversations);
router.post('/conversations', MessageController.createConversation);
router.put('/conversations/:conversationId/close', MessageController.closeConversation);

// Rutas de mensajes
router.get('/conversations/:conversationId/messages', MessageController.getMessages);
router.post('/messages', MessageController.sendMessage);

// Rutas de plantillas
router.get('/templates', MessageController.getMessageTemplates);
router.post('/templates', MessageController.createMessageTemplate);
router.post('/templates/:templateId/use', MessageController.useMessageTemplate);

export default router;