// src/services/channels.service.ts
import { query, getClient } from '../config/database';
import { cacheGet, cacheSet, cacheDel } from '../config/redis';
import { logger } from '../utils/logger';
import { JobsService } from './jobs.service';

const jobsService = new JobsService();

interface ChannelFilters {
  status?: string;
  search?: string;
  limit: number;
  offset: number;
}

interface MessageFilters {
  limit: number;
  offset: number;
  start_date?: string;
  end_date?: string;
}

export class ChannelsService {
  async getChannels(filters: ChannelFilters) {
    try {
      const cacheKey = `channels:${JSON.stringify(filters)}`;
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.search) {
        whereClause += ` AND (username ILIKE $${paramIndex} OR title ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM channels ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get channels
      const result = await query(
        `SELECT 
          id, username, title, description, members_count,
          status, parse_frequency, last_parsed_at, last_message_date,
          created_at, updated_at
         FROM channels
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, filters.limit, filters.offset]
      );

      const response = {
        items: result.rows,
        total,
        limit: filters.limit,
        offset: filters.offset,
      };

      await cacheSet(cacheKey, response, 60); // Cache for 1 minute

      return response;
    } catch (error) {
      logger.error('Get channels error:', error);
      throw error;
    }
  }

  async getChannelById(id: number) {
    try {
      const cacheKey = `channel:${id}`;
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;

      const result = await query(
        `SELECT 
          id, username, title, description, members_count,
          status, parse_frequency, last_parsed_at, last_message_date,
          photo_url, created_at, updated_at, created_by
         FROM channels
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const channel = result.rows[0];
      await cacheSet(cacheKey, channel, 300); // Cache for 5 minutes

      return channel;
    } catch (error) {
      logger.error('Get channel error:', error);
      throw error;
    }
  }

  async createChannel(data: any) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check if channel already exists
      const existing = await client.query(
        'SELECT id FROM channels WHERE username = $1',
        [data.username]
      );

      if (existing.rows.length > 0) {
        throw new Error('Channel already exists');
      }

      // Create channel
      const result = await client.query(
        `INSERT INTO channels (
          username, parse_frequency, status, created_by
         ) VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.username, data.parse_frequency, 'active', data.created_by]
      );

      const channel = result.rows[0];

      // Create initial parse job
      await jobsService.createJob({
        channel_id: channel.id,
        job_type: 'initial',
        priority: 10,
        created_by: data.created_by,
      });

      await client.query('COMMIT');

      // Invalidate cache
      await cacheDel('channels:*');

      return channel;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Create channel error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateChannel(id: number, updates: any) {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.keys(updates).forEach((key) => {
        if (['title', 'description', 'status', 'parse_frequency'].includes(key)) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(updates[key]);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        return await this.getChannelById(id);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query(
        `UPDATE channels
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Invalidate cache
      await cacheDel(`channel:${id}`);
      await cacheDel('channels:*');

      return result.rows[0];
    } catch (error) {
      logger.error('Update channel error:', error);
      throw error;
    }
  }

  async deleteChannel(id: number): Promise<boolean> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Cancel pending jobs
      await client.query(
        `UPDATE jobs
         SET status = 'cancelled', completed_at = NOW()
         WHERE channel_id = $1 AND status IN ('pending', 'assigned')`,
        [id]
      );

      // Delete channel (messages will be cascade deleted)
      const result = await client.query(
        'DELETE FROM channels WHERE id = $1',
        [id]
      );

      await client.query('COMMIT');

      // Invalidate cache
      await cacheDel(`channel:${id}`);
      await cacheDel('channels:*');

      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Delete channel error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async triggerParse(channelId: number, userId?: number) {
    try {
      // Check if channel exists
      const channel = await this.getChannelById(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      // Create manual parse job
      const job = await jobsService.createJob({
        channel_id: channelId,
        job_type: 'manual',
        priority: 8,
        created_by: userId,
      });

      return job;
    } catch (error) {
      logger.error('Trigger parse error:', error);
      throw error;
    }
  }

  async getChannelMessages(channelId: number, filters: MessageFilters) {
    try {
      let whereClause = 'WHERE channel_id = $1';
      const params: any[] = [channelId];
      let paramIndex = 2;

      if (filters.start_date) {
        whereClause += ` AND date >= $${paramIndex}`;
        params.push(filters.start_date);
        paramIndex++;
      }

      if (filters.end_date) {
        whereClause += ` AND date <= $${paramIndex}`;
        params.push(filters.end_date);
        paramIndex++;
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM messages ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get messages
      const result = await query(
        `SELECT 
          id, message_id, text, date, views, forwards, replies,
          reactions, media_type, is_forwarded, created_at
         FROM messages
         ${whereClause}
         ORDER BY date DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, filters.limit, filters.offset]
      );

      return {
        items: result.rows,
        total,
        limit: filters.limit,
        offset: filters.offset,
      };
    } catch (error) {
      logger.error('Get channel messages error:', error);
      throw error;
    }
  }

  async getChannelStats(channelId: number) {
    try {
      const cacheKey = `channel:${channelId}:stats`;
      const cached = await cacheGet(cacheKey);
      if (cached) return cached;

      const result = await query(
        `SELECT 
          COUNT(*) as total_messages,
          AVG(views)::int as avg_views,
          MAX(views) as max_views,
          AVG(forwards)::int as avg_forwards,
          MAX(date) as last_message_date,
          MIN(date) as first_message_date
         FROM messages
         WHERE channel_id = $1`,
        [channelId]
      );

      const stats = result.rows[0];
      await cacheSet(cacheKey, stats, 300); // Cache for 5 minutes

      return stats;
    } catch (error) {
      logger.error('Get channel stats error:', error);
      throw error;
    }
  }
}