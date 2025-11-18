// src/controllers/jobs.controller.ts
import { Request, Response, NextFunction } from 'express';
import { JobsService } from '../services/jobs.service';
import { logger } from '../utils/logger';

const jobsService = new JobsService();

export class JobsController {
  async getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        status,
        channel_id,
        worker_id,
        limit = 25,
        offset = 0,
      } = req.query;

      const result = await jobsService.getJobs({
        status: status as string,
        channel_id: channel_id ? parseInt(channel_id as string, 10) : undefined,
        worker_id: worker_id as string,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const job = await jobsService.getJobById(id);

      if (!job) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Job not found',
        });
        return;
      }

      res.json(job);
    } catch (error) {
      next(error);
    }
  }

  async createJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        channel_id,
        job_type,
        priority,
        parameters,
      } = req.body;

      if (!channel_id || !job_type) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'channel_id and job_type are required',
        });
        return;
      }

      const job = await jobsService.createJob({
        channel_id,
        job_type,
        priority: priority || 5,
        parameters,
        created_by: req.user?.id,
      });

      logger.info(`Job created: ${job.job_uuid}`);

      res.status(201).json(job);
    } catch (error) {
      next(error);
    }
  }

  async cancelJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const success = await jobsService.cancelJob(id);

      if (!success) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Job not found or cannot be cancelled',
        });
        return;
      }

      logger.info(`Job cancelled: ${id}`);

      res.json({ message: 'Job cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  async retryJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const job = await jobsService.retryJob(id);

      if (!job) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Job not found or cannot be retried',
        });
        return;
      }

      logger.info(`Job retried: ${id}`);

      res.json(job);
    } catch (error) {
      next(error);
    }
  }

  //@ts-expect-error
  async getJobStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await jobsService.getJobStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}