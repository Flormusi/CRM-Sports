import { Request, Response } from 'express';
import { EmailQueueService } from '../services/emailQueueService';
import { handleError } from '../utils/errorHandler';

export class EmailController {
  private emailQueueService: EmailQueueService;

  constructor() {
    this.emailQueueService = new EmailQueueService();
  }

  getQueueStatus = async (_req: Request, res: Response) => {
    try {
      const status = await this.emailQueueService.getQueueStatus();
      res.json({ success: true, data: status });
    } catch (error) {
      handleError(error, res, 'Error fetching email queue status');
    }
  }

  getFailedEmails = async (_req: Request, res: Response) => {
    try {
      const failedJobs = await this.emailQueueService.getFailedJobs();
      res.json({ success: true, data: failedJobs });
    } catch (error) {
      handleError(error, res, 'Error fetching failed emails');
    }
  }

  retryFailedEmail = async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      await this.emailQueueService.retryJob(jobId);
      res.json({ success: true, message: 'Email queued for retry' });
    } catch (error) {
      handleError(error, res, 'Error retrying failed email');
    }
  }
}