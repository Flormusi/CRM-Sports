import { Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export type AsyncRequestHandler = (
  req: Request,
  res: Response
) => Promise<Response | void>;