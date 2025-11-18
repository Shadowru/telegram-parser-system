// src/controllers/workers.controller.ts
import { Request, Response, NextFunction } from 'express';
import { WorkersService } from '../services/workers.service';

const workersService = new WorkersService();

export class WorkersController {
  async getWorkers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.query;

      const workers = await workersService.getWorkers({
        status: status as string,
      });

      res.json(workers);
    } catch (error) {
      next(error);
    }
  }

  async getWorker(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const worker = await workersService.getWorkerById(id);

      if (!worker) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Worker not found',
        });
        return;
      }

      res.json(worker);
    } catch (error) {
      next(error);
    }
  }

  async getWorkerStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const stats = await workersService.getWorkerStats(id);

      if (!stats) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Worker not found',
        });
        return;
      }

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  async getWorkerJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 25, offset = 0 } = req.query;

      const result = await workersService.getWorkerJobs(id, {
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}