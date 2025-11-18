// src/services/jobs.service.ts
import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../config/database';
import { logger } from '../utils/logger';

interface JobFilters {
  status?: string;
  channel_id?: number;
  worker_id?: string;
  limit: number;
  offset: number;
}

export class JobsService {
  async getJobs(filters: JobFilters) {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.status) {
        whereClause += ` AND j.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.channel_id) {
        whereClause += ` AND j.channel_id = $${paramIndex}`;
        params.push(filters.channel_id);
        paramIndex++;
      }

      if (filters.worker_id) {
        whereClause += ` AND j.worker_id = $${paramIndex}`;
        params.push(filters.worker_id);
        paramIndex++;
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM jobs j ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get jobs
      const result = await query(
        `SELECT 
          j.id, j.job_uuid, j.channel_id, c.username as channel_username,
          j.job_type, j.status, j.priority, j.messages_collected,
          j.messages_target, j.progress_percent, j.worker_id,
          j.started_at, j.completed_at, j.created_at, j.error_message
         FROM jobs j
         JOIN channels c ON j.channel_id = c.id
         ${whereClause}
         ORDER BY j.created_at DESC
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
      logger.error('Get jobs error:', error);
      throw error;
    }
  }

  async getJobById(jobUuid: string) {
    try {
      const result = await query(
        `SELECT 
          j.*, c.username as channel_username
         FROM jobs j
         JOIN channels c ON j.channel_id = c.id
         WHERE j.job_uuid = $1`,
        [jobUuid]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Get job error:', error);
      throw error;
    }
  }

  async createJob(data: any) {
    try {
      const jobUuid = uuidv4();

      const result = await query(
        `INSERT INTO jobs (
          job_uuid, channel_id, job_type, priority, status,
          parameters, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          jobUuid,
          data.channel_id,
          data.job_type,
          data.priority || 5,
          'pending',
          JSON.stringify(data.parameters || {}),
          data.created_by,
        ]
      );

      logger.info(`Job created: ${jobUuid}`);

      return result.rows[0];
    } catch (error) {
      logger.error('Create job error:', error);
      throw error;
    }
  }

  async cancelJob(jobUuid: string): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE jobs
         SET status = 'cancelled', completed_at = NOW()
         WHERE job_uuid = $1 AND status IN ('pending', 'assigned')
         RETURNING id`,
        [jobUuid]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error('Cancel job error:', error);
      throw error;
    }
  }

  async retryJob(jobUuid: string) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get original job
      const original = await client.query(
        'SELECT * FROM jobs WHERE job_uuid = $1 AND status = $2',
        [jobUuid, 'failed']
      );

      if (original.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const job = original.rows[0];

      // Create new job
      const newJobUuid = uuidv4();
      const result = await client.query(
        `INSERT INTO jobs (
          job_uuid, channel_id, job_type, priority, status,
          parameters, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          newJobUuid,
          job.channel_id,
          job.job_type,
          job.priority,
          'pending',
          job.parameters,
          job.created_by,
        ]
      );

      await client.query('COMMIT');

      logger.info(`Job retried: ${jobUuid} -> ${newJobUuid}`);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Retry job error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getJobStats() {
    try {
      const result = await query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY status
      `);

      const stats: any = {
        pending: 0,
        assigned: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };

      result.rows.forEach((row) => {
        stats[row.status] = parseInt(row.count, 10);
      });

      return stats;
    } catch (error) {
      logger.error('Get job stats error:', error);
      throw error;
    }
  }
}