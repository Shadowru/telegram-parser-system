// src/routes/jobs.routes.ts
import { Router } from 'express';
import { JobsController } from '../controllers/jobs.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const jobsController = new JobsController();

// All routes require authentication
router.use(authMiddleware);

// Get all jobs
router.get(
  '/',
  [
    query('status').optional().isIn(['pending', 'assigned', 'running', 'completed', 'failed', 'cancelled']),
    query('channel_id').optional().isInt(),
    query('worker_id').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  jobsController.getJobs.bind(jobsController)
);

// Get job by ID
router.get(
  '/:id',
  [
    param('id').isUUID(),
    validateRequest,
  ],
  jobsController.getJob.bind(jobsController)
);

// Create job
router.post(
  '/',
  [
    body('channel_id').isInt(),
    body('job_type').isIn(['initial', 'update', 'full_sync', 'manual']),
    body('priority').optional().isInt({ min: 1, max: 10 }),
    body('parameters').optional().isObject(),
    validateRequest,
  ],
  jobsController.createJob.bind(jobsController)
);

// Cancel job
router.post(
  '/:id/cancel',
  [
    param('id').isUUID(),
    validateRequest,
  ],
  jobsController.cancelJob.bind(jobsController)
);

// Retry job
router.post(
  '/:id/retry',
  [
    param('id').isUUID(),
    validateRequest,
  ],
  jobsController.retryJob.bind(jobsController)
);

// Get job stats
router.get(
  '/stats/summary',
  jobsController.getJobStats.bind(jobsController)
);

export default router;