import express, { Request, Response, NextFunction } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate as auth } from '../middleware/auth';
import { isAdmin } from '../middleware/isAdmin';

const router = express.Router();
const productController = new ProductController();

const handleRequest = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// List all products
router.get('/', auth, handleRequest(async (req, res) => {
  await productController.getAllProducts(req, res);
}));

// Get low stock products (must be before /:id route)
router.get('/inventory/low-stock', auth, handleRequest(async (req, res) => {
  await productController.getLowStock(req, res);
}));

// Get by barcode (must be before /:id route)
router.get('/barcode/:code', auth, handleRequest(async (req, res) => {
  await productController.getByBarcode(req, res);
}));

// Get single product by ID
router.get('/:id', auth, handleRequest(async (req, res) => {
  await productController.getProductById(req, res);
}));

// Batches: list
router.get('/:id/batches', auth, handleRequest(async (req, res) => {
  await productController.listBatches(req, res);
}));

// Batches: create
router.post('/:id/batches', auth, isAdmin, handleRequest(async (req, res) => {
  await productController.createBatch(req, res);
}));

// Variants by product
router.get('/:id/variants', auth, handleRequest(async (req, res) => {
  const { id } = req.params;
  const { prisma } = await import('../lib/prisma');
  const list = await (prisma as any).productVariant.findMany({ where: { productId: String(id) } });
  res.json(list);
}));

// Create new product
router.post('/', auth, isAdmin, handleRequest(async (req, res) => {
  await productController.createProduct(req, res);
}));

// Import product from external URL
router.post('/import-url', auth, handleRequest(async (req, res) => {
  await productController.importFromUrl(req, res);
}));

router.get('/proxy-image', async (req, res, next) => {
  try {
    await new ProductController().proxyImage(req, res);
  } catch (e) {
    next(e);
  }
});

// Update product
router.put('/:id', auth, isAdmin, handleRequest(async (req, res) => {
  await productController.update(req, res);
}));

// Delete product
router.delete('/:id', auth, isAdmin, handleRequest(async (req, res) => {
  await productController.delete(req, res);
}));

// Deactivate product (soft)
router.patch('/:id/deactivate', auth, isAdmin, handleRequest(async (req, res) => {
  await productController.deactivate(req, res);
}));

export default router;
