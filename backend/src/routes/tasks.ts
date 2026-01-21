import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
const router = express.Router();

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Obtener todas las tareas
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tareas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        client: true,
      },
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Obtener una tarea por ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la tarea
 *     responses:
 *       200:
 *         description: Tarea encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Tarea no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        client: true  // Fixed: Changed Client to client to match Prisma types
      }
    });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task' });
    return;
  }
});

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Crear una nueva tarea
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - clientId
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título de la tarea
 *               description:
 *                 type: string
 *                 description: Descripción de la tarea
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha de vencimiento
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 description: Prioridad de la tarea
 *               clientId:
 *                 type: string
 *                 description: ID del cliente asociado
 *     responses:
 *       201:
 *         description: Tarea creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { title, description, dueDate, priority, clientId, whatsappLink, assignedToId } = req.body;
    const userId = assignedToId || (req.user?.id || undefined);
    const now = new Date().toISOString();
    const initialLog = [{ message: `Creada por ${req.user?.email || 'sistema'} el ${now}` }];
    const parsedDue = dueDate ? new Date(dueDate) : undefined;
    const data: any = {
      id: crypto.randomUUID(),
      title: typeof title === 'string' && title.trim() ? title.trim() : 'Tarea',
      description: typeof description === 'string' ? description : '',
      priority: priority || 'MEDIUM',
      status: 'PENDING',
      whatsappLink,
      assignedToId: userId,
      log: initialLog,
      client: {
        connect: { id: clientId }
      }
    };
    data.dueDate = (parsedDue && !isNaN(parsedDue.getTime())) ? parsedDue : new Date();
    const task = await prisma.task.create({
      data: {
        id: data.id,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        priority: data.priority,
        status: data.status,
        whatsappLink: whatsappLink || null,
        assignedToId: userId || null,
        log: initialLog as any,
        client: { connect: { id: clientId } },
      } as any,
      include: { client: true }
    });
    res.status(201).json(task);
  } catch (error) {
    console.error('Error completo de Prisma al crear tarea:', error);
    res.status(500).json({ error: 'Failed to create task', details: (error as any)?.message || String(error) });
  }
});

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Actualizar una tarea
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la tarea
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título de la tarea
 *               description:
 *                 type: string
 *                 description: Descripción de la tarea
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha de vencimiento
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 description: Prioridad de la tarea
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED, CANCELLED]
 *                 description: Estado de la tarea
 *     responses:
 *       200:
 *         description: Tarea actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const current = await prisma.task.findUnique({ where: { id: req.params.id } });
    const updateData: any = {
      ...(req.body.title && { title: req.body.title }),
      ...(req.body.description && { description: req.body.description }),
      ...(req.body.dueDate && { dueDate: new Date(req.body.dueDate) }),
      ...(req.body.priority && { priority: req.body.priority }),
      ...(req.body.status && { status: req.body.status }),
      ...(req.body.whatsappLink && { whatsappLink: req.body.whatsappLink }),
      ...(req.body.assignedToId && { assignedToId: req.body.assignedToId }),
    };
    if (req.body.status && current && req.body.status !== current.status) {
      const now = new Date().toISOString();
      const entry = { message: `${req.user?.email || 'sistema'} movió a ${req.body.status} el ${now}` };
      const logArr = Array.isArray((current as any).log) ? (current as any).log : [];
      updateData.log = { set: [...logArr, entry] };
    }
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData as any,
    });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Eliminar una tarea
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la tarea
 *     responses:
 *       200:
 *         description: Tarea eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Task deleted successfully
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.task.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
