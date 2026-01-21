import { Request, Response } from 'express';
import { Stock } from '../models/stock.model';
import { StockSyncService } from '../services/stockSyncService';
import { handleError } from '../utils/errorHandler';
import { ApiError } from '../utils/ApiError';

export class StockController {
  private syncService: StockSyncService;

  constructor() {
    this.syncService = new StockSyncService();
  }

  createProduct = async (req: Request, res: Response) => {
    try {
      const { productId, meliId, quantity, price, minThreshold } = req.body;
      const product = await Stock.create({
        productId,
        meliId,
        quantity,
        price,
        minThreshold,
        status: 'active',
        lastSync: new Date()
      });
      res.status(201).json({ success: true, data: product });
    } catch (error) {
      handleError(error, res, 'Error creating product');
    }
  }

  updateStock = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      
      const product = await Stock.findByIdAndUpdate(
        id,
        { 
          quantity,
          lastSync: new Date()
        },
        { new: true }
      );

      if (!product) throw new ApiError(404, 'Product not found');
      
      // Check for low stock after update
      if (quantity <= product.minThreshold) {
        await this.syncService.handleLowStock(product);
      }

      res.json({ success: true, data: product });
    } catch (error) {
      handleError(error, res, 'Error updating stock');
    }
  }

  syncNow = async (req: Request, res: Response) => {
    try {
      await this.syncService.syncAllProducts();
      res.json({ success: true, message: 'Sync initiated successfully' });
    } catch (error) {
      handleError(error, res, 'Error initiating sync');
    }
  }

  getStockStatus = async (req: Request, res: Response) => {
    try {
      const product = await Stock.findById(req.params.id);
      if (!product) throw new ApiError(404, 'Product not found');
      
      res.json({
        success: true,
        data: {
          productId: product.productId,
          quantity: product.quantity,
          minThreshold: product.minThreshold,
          status: product.status,
          lastSync: product.lastSync,
          price: product.price
        }
      });
    } catch (error) {
      handleError(error, res, 'Error fetching stock status');
    }
  }

  getLowStockItems = async (req: Request, res: Response) => {
    try {
      const lowStockProducts = await Stock.find({
        status: 'active',
        quantity: { $lte: '$minThreshold' }
      });

      res.json({
        success: true,
        data: lowStockProducts
      });
    } catch (error) {
      handleError(error, res, 'Error fetching low stock items');
    }
  }
}