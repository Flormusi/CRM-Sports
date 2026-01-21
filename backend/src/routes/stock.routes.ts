import { Router } from 'express';
import { StockController } from '../controllers/stock.controller';

const router = Router();
const stockController = new StockController();

// Create new product with stock
/**
 * @swagger
 * /stock/products:
 *   post:
 *     summary: Create a new product with stock
 *     tags: [Stock]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - meliId
 *               - quantity
 *               - price
 *             properties:
 *               productId:
 *                 type: string
 *               meliId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               price:
 *                 type: number
 *               minThreshold:
 *                 type: number
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post('/products', stockController.createProduct);

/**
 * @swagger
 * /stock/products/{id}/stock:
 *   put:
 *     summary: Update product stock
 *     tags: [Stock]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: number
 *     responses:
 *       200:
 *         description: Stock updated successfully
 */
router.put('/products/:id/stock', stockController.updateStock);

// Trigger manual sync
/**
 * @swagger
 * /stock/sync:
 *   post:
 *     summary: Trigger manual stock synchronization
 *     tags: [Stock]
 *     responses:
 *       200:
 *         description: Sync initiated successfully
 *       500:
 *         description: Error initiating sync
 */
router.post('/sync', stockController.syncNow);

/**
 * @swagger
 * /stock/products/{id}/stock:
 *   get:
 *     summary: Get stock status for a product
 *     tags: [Stock]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stock status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 productId:
 *                   type: string
 *                 quantity:
 *                   type: number
 *                 minThreshold:
 *                   type: number
 *                 status:
 *                   type: string
 *                 lastSync:
 *                   type: string
 *                   format: date-time
 */
router.get('/products/:id/stock', stockController.getStockStatus);

/**
 * @swagger
 * /stock/low-stock:
 *   get:
 *     summary: Get all products with low stock
 *     tags: [Stock]
 *     responses:
 *       200:
 *         description: Low stock items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   productId:
 *                     type: string
 *                   quantity:
 *                     type: number
 *                   minThreshold:
 *                     type: number
 */
router.get('/low-stock', stockController.getLowStockItems);

export default router;