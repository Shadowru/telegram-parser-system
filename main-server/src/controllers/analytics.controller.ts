// src/controllers/analytics.controller.ts
import { Request, Response, NextFunction } from "express";
import { AnalyticsService } from "../services/analytics.service";

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  async getSystemStats(
    //@ts-expect-error
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await analyticsService.getSystemStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  async getChannelAnalytics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { period = "30d" } = req.query;

      const analytics = await analyticsService.getChannelAnalytics(
        parseInt(id, 10),
        period as string
      );

      res.json(analytics);
    } catch (error) {
      next(error);
    }
  }

  async getTopChannels(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      //@ts-expect-error
      const { metric = "messages", limit = 10 } = req.query;

      const channels = await analyticsService.getTopChannels(
        parseInt(limit as string, 10)
      );

      res.json(channels);
    } catch (error) {
      next(error);
    }
  }
}
