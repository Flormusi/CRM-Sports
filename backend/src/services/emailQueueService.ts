import Queue from 'bull';
import { EmailService } from './emailService';
import { ApiError } from '../utils/ApiError';

interface EmailJob {
  type: 'invoice' | 'reminder' | 'overdue' | 'confirmation' | 'stock_alert';
  invoiceId: string;
  recipientEmail?: string;
  data?: any;
}

// Remove unused interface
// interface EmailQueueItem {
//   type: 'stock_alert';
//   invoiceId: string;
//   recipientEmail: string;
//   data: {
//     productId: string;
//     meliId: string;
//     currentStock: number;
//     threshold: number;
//     price: number;
//   };
// }

export class EmailQueueService {
  private emailQueue: Queue.Queue;
  private emailService: EmailService;

  constructor() {
    this.emailQueue = new Queue('email-queue', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379
      }
    });
    this.emailService = new EmailService();
    this.processJobs();
  }

  private processJobs(): void {
    this.emailQueue.process(async (job) => {
      const { type, recipientEmail, data } = job.data as EmailJob;

      try {
        if (type === 'stock_alert') {
          await this.emailService.sendStockAlert({
            ...data,
            recipientEmail
          });
        }
      } catch (error) {
        console.error(`Failed to process email job: ${error}`);
        throw error;
      }
    });
  }

  async addToQueue(jobData: EmailJob): Promise<void> {
    await this.emailQueue.add(jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
  }

  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount()
    ]);

    return { waiting, active, completed, failed };
  }

  async getFailedJobs() {
    const failed = await this.emailQueue.getFailed();
    return failed.map(job => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      timestamp: job.timestamp
    }));
  }

  async retryJob(jobId: string) {
    const job = await this.emailQueue.getJob(jobId);
    if (!job) {
      throw new ApiError(404, 'Job not found');
    }
    await job.retry();
  }
}
