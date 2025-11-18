// src/routes/workers.routes.ts
import { Router } from 'express';
import { WorkersController } from '../controllers/workers.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { param, query } from 'express-validator';

const router = Router();
const workersController = new WorkersController();

// All routes require authentication
router.use(authMiddleware);

// Get all workers
router.get(
  '/',
  [
    query('status').optional().isIn(['active', 'idle', 'busy', 'offline', 'error']),
    validateRequest,
  ],
  workersController.getWorkers.bind(workersController)
);

// Get worker by ID
router.get(
  '/:id',
  [
    param('id').isString(),
    validateRequest,
  ],
  workersController.getWorker.bind(workersController)
);

// Get worker stats
router.get(
  '/:id/stats',
  [
    param('id').isString(),
    validateRequest,
  ],
  workersController.getWorkerStats.bind(workersController)
);

// Get worker jobs
router.get(
  '/:id/jobs',
  [
    param('id').isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  workersController.getWorkerJobs.bind(workersController)
);

export default router;