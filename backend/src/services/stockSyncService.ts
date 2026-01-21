import schedule from 'node-schedule';
import { Stock } from '../models/stock.model';
import { MeliService } from './meliService';
import { EmailQueueService } from './emailQueueService';
import { StockMetrics } from '../models/stockMetrics.model';

export class StockSyncService {
  private meliService: MeliService;
  private emailQueueService: EmailQueueService;
  private syncJob!: schedule.Job; // Add definite assignment assertion

  constructor() {
    this.meliService = new MeliService();
    this.emailQueueService = new EmailQueueService();
    this.initSyncSchedule();
  }

  private initSyncSchedule() {
    this.syncJob = schedule.scheduleJob('0 * * * *', async () => {
      await this.syncAllProducts();
    });
  }

  // Add method to stop the sync job if needed
  public stopSync() {
    if (this.syncJob) {
      this.syncJob.cancel();
    }
  }

  // Add to syncAllProducts method in StockSyncService
  async syncAllProducts() {
    const activeProducts = await Stock.find({ status: 'active' });
    
    for (const product of activeProducts) {
      try {
        const [meliStock, meliPrice] = await Promise.all([
          this.meliService.getItemStock(product.meliId),
          this.meliService.getItemPrice(product.meliId)
        ]);
        
        // Calculate deltas
        const stockDelta = meliStock - product.quantity;
        const priceDelta = meliPrice - product.price;

        // Save metrics
        await StockMetrics.create({
          productId: product.productId,
          meliId: product.meliId,
          quantity: meliStock,
          price: meliPrice,
          stockDelta,
          priceDelta
        });
        
        // Update product
        product.quantity = meliStock;
        product.price = meliPrice;
        product.lastSync = new Date();
        await product.save();

        if (meliStock <= product.minThreshold) {
          await this.handleLowStock(product);
        }
      } catch (error) {
        console.error(`Failed to sync product ${product.productId}:`, error);
      }
    }
  }

  // Change from private to public
  public async handleLowStock(product: any) {
    const now = new Date();
    const hoursSinceLastAlert = product.lastAlert ? 
      (now.getTime() - product.lastAlert.getTime()) / (1000 * 60 * 60) : 24;

    // Send alert only if last alert was more than 24 hours ago
    if (hoursSinceLastAlert >= 24) {
      await this.emailQueueService.addToQueue({
        type: 'stock_alert',
        invoiceId: '', // Not applicable for stock alerts
        recipientEmail: process.env.ADMIN_EMAIL,
        data: {
          productId: product.productId,
          meliId: product.meliId,
          currentStock: product.quantity,
          threshold: product.minThreshold,
          price: product.price
        }
      });

      product.lastAlert = now;
      await product.save();
    }
  }
}