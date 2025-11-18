// src/routes/channels.routes.ts
import { Router } from 'express';
import { ChannelsController } from '../controllers/channels.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const channelsController = new ChannelsController();

// All routes require authentication
router.use(authMiddleware);

// Get all channels
router.get(
  '/',
  [
    query('status').optional().isIn(['active', 'paused', 'error']),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    validateRequest,
  ],
  channelsController.getChannels.bind(channelsController)
);

// Get channel by ID
router.get(
  '/:id',
  [
    param('id').isInt(),
    validateRequest,
  ],
  channelsController.getChannel.bind(channelsController)
);

// Create channel
router.post(
  '/',
  [
    body('username').isString().matches(/^[a-zA-Z0-9_]+$/),
    body('parse_frequency').optional().isInt({ min: 60, max: 86400 }),
    validateRequest,
  ],
  channelsController.createChannel.bind(channelsController)
);

// Update channel
router.put(
  '/:id',
  [
    param('id').isInt(),
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('status').optional().isIn(['active', 'paused', 'error']),
    body('parse_frequency').optional().isInt({ min: 60, max: 86400 }),
    validateRequest,
  ],
  channelsController.updateChannel.bind(channelsController)
);

// Delete channel
router.delete(
  '/:id',
  [
    param('id').isInt(),
    validateRequest,
  ],
  channelsController.deleteChannel.bind(channelsController)
);

// Trigger parse
router.post(
  '/:id/parse',
  [
    param('id').isInt(),
    validateRequest,
  ],
  channelsController.triggerParse.bind(channelsController)
);

// Get channel messages
router.get(
  '/:id/messages',
  [
    param('id').isInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    validateRequest,
  ],
  channelsController.getChannelMessages.bind(channelsController)
);

// Get channel stats
router.get(
  '/:id/stats',
  [
    param('id').isInt(),
    validateRequest,
  ],
  channelsController.getChannelStats.bind(channelsController)
);

export default router;