// src/services/analytics.service.ts
import { query } from '../config/database';
import { cacheGet, cacheSet } from '../config/redis';
import { logger } from '../utils/logger';

export class AnalyticsService {
  async getSystemStats() {
    try {
      const cacheKey = 'analytics:system:stats';
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;

      // Get various statistics
      const [
        totalMessages,
        messagesToday,
        channels,
        jobs,
        workers,
        timeline,
        topChannels,
      ] = await Promise.all([
        this.getTotalMessages(),
        this.getMessagesToday(),
        this.getChannelStats(),
        this.getJobStats(),
        this.getWorkerStats(),
        this.getMessagesTimeline(),
        this.getTopChannels(),
      ]);

      const stats = {
        total_messages: totalMessages,
        messages_today: messagesToday,
        ...channels,
        ...jobs,
        ...workers,
        messages_timeline: timeline,
        top_channels: topChannels,
      };

      await cacheSet(cacheKey, stats, 60); // Cache for 1 minute

      return stats;
    } catch (error) {
      logger.error('Get system stats error:', error);
      throw error;
    }
  }

  private async getTotalMessages(): Promise<number> {
    const result = await query('SELECT COUNT(*) FROM messages');
    return parseInt(result.rows[0].count, 10);
  }

  private async getMessagesToday(): Promise<number> {
    const result = await query(`
      SELECT COUNT(*) FROM messages
      WHERE date >= CURRENT_DATE
    `);
    return parseInt(result.rows[0].count, 10);
  }

  private async getChannelStats() {
    const result = await query(`
      SELECT 
        COUNT(*) as total_channels,
        COUNT(*) FILTER (WHERE status = 'active') as active_channels,
        COUNT(*) FILTER (WHERE status = 'paused') as paused_channels,
        COUNT(*) FILTER (WHERE status = 'error') as error_channels
      FROM channels
    `);
    return result.rows[0];
  }

  private async getJobStats() {
    const result = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
        COUNT(*) FILTER (WHERE status = 'running') as active_jobs,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_jobs_24h
      FROM jobs
    `);
    return result.rows[0];
  }

  private async getWorkerStats() {
    const result = await query(`
      SELECT 
        COUNT(*) as total_workers,
        COUNT(*) FILTER (WHERE last_heartbeat > NOW() - INTERVAL '2 minutes') as active_workers
      FROM workers
    `);
    return result.rows[0];
  }

  private async getMessagesTimeline() {
    const result = await query(`
      SELECT 
        DATE(date) as day,
        COUNT(*) as count
      FROM messages
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(date)
      ORDER BY day
    `);

    return {
    //@ts-expect-error
      labels: result.rows.map((r) => r.day),
    //@ts-expect-error
      data: result.rows.map((r) => parseInt(r.count, 10)),
    };
  }

  public async getTopChannels(limit: number = 10) {
    const result = await query(
      `SELECT 
        c.id, c.username, c.title,
        COUNT(m.id) as message_count,
        AVG(m.views)::int as avg_views
       FROM channels c
       LEFT JOIN messages m ON c.id = m.channel_id
       WHERE m.date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY c.id, c.username, c.title
       ORDER BY message_count DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  async getChannelAnalytics(channelId: number, period: string = '30d') {
    try {
      const cacheKey = `analytics:channel:${channelId}:${period}`;
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;

      const interval = this.getPeriodInterval(period);

      const result = await query(
        `SELECT 
          DATE(date) as day,
          COUNT(*) as message_count,
          AVG(views)::int as avg_views,
          AVG(forwards)::int as avg_forwards,
          AVG(replies)::int as avg_replies
         FROM messages
         WHERE channel_id = $1
         AND date >= NOW() - INTERVAL '${interval}'
         GROUP BY DATE(date)
         ORDER BY day`,
        [channelId]
      );

      const analytics = {
        timeline: {
    //@ts-expect-error
          labels: result.rows.map((r) => r.day),
    //@ts-expect-error
          message_count: result.rows.map((r) => parseInt(r.message_count, 10)),
    //@ts-expect-error
          avg_views: result.rows.map((r) => parseInt(r.avg_views, 10)),
    //@ts-expect-error
          avg_forwards: result.rows.map((r) => parseInt(r.avg_forwards, 10)),
    //@ts-expect-error
          avg_replies: result.rows.map((r) => parseInt(r.avg_replies, 10)),
        },
      };

      await cacheSet(cacheKey, analytics, 300); // Cache for 5 minutes

      return analytics;
    } catch (error) {
      logger.error('Get channel analytics error:', error);
      throw error;
    }
  }

  private getPeriodInterval(period: string): string {
    const map: any = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      '1y': '1 year',
    };
    return map[period] || '30 days';
  }
}