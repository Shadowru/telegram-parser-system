// src/routes/analytics.routes.ts
import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { param, query } from 'express-validator';

const router = Router();
const analyticsController = new AnalyticsController();

// All routes require authentication
router.use(authMiddleware);

// Get system stats
router.get(
  '/system',
  analyticsController.getSystemStats.bind(analyticsController)
);

// Get channel analytics
router.get(
  '/channels/:id',
  [
    param('id').isInt(),
    query('period').optional().isIn(['7d', '30d', '90d', '1y']),
    validateRequest,
  ],
  analyticsController.getChannelAnalytics.bind(analyticsController)
);

// Get top channels
router.get(
  '/top-channels',
  [
    query('metric').optional().isIn(['messages', 'views', 'engagement']),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    validateRequest,
  ],
  analyticsController.getTopChannels.bind(analyticsController)
);

export default router;