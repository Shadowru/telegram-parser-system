// src/controllers/channels.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ChannelsService } from '../services/channels.service';
import { logger } from '../utils/logger';

const channelsService = new ChannelsService();

export class ChannelsController {
  async getChannels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        status,
        search,
        limit = 25,
        offset = 0,
      } = req.query;

      const result = await channelsService.getChannels({
        status: status as string,
        search: search as string,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const channel = await channelsService.getChannelById(parseInt(id, 10));

      if (!channel) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Channel not found',
        });
        return;
      }

      res.json(channel);
    } catch (error) {
      next(error);
    }
  }

  async createChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, parse_frequency } = req.body;

      if (!username) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Username is required',
        });
        return;
      }

      const channel = await channelsService.createChannel({
        username: username.replace('@', ''),
        parse_frequency: parse_frequency || 300,
        created_by: req.user?.id,
      });

      logger.info(`Channel created: ${username}`);

      res.status(201).json(channel);
    } catch (error) {
      next(error);
    }
  }

  async updateChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const channel = await channelsService.updateChannel(
        parseInt(id, 10),
        updates
      );

      if (!channel) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Channel not found',
        });
        return;
      }

      logger.info(`Channel updated: ${id}`);

      res.json(channel);
    } catch (error) {
      next(error);
    }
  }

  async deleteChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const success = await channelsService.deleteChannel(parseInt(id, 10));

      if (!success) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Channel not found',
        });
        return;
      }

      logger.info(`Channel deleted: ${id}`);

      res.json({ message: 'Channel deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async triggerParse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const job = await channelsService.triggerParse(
        parseInt(id, 10),
        req.user?.id
      );

      logger.info(`Parse triggered for channel: ${id}`);

      res.json(job);
    } catch (error) {
      next(error);
    }
  }

  async getChannelMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const {
        limit = 25,
        offset = 0,
        start_date,
        end_date,
      } = req.query;

      const result = await channelsService.getChannelMessages(
        parseInt(id, 10),
        {
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
          start_date: start_date as string,
          end_date: end_date as string,
        }
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getChannelStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const stats = await channelsService.getChannelStats(parseInt(id, 10));

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}