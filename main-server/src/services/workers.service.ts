// src/services/workers.service.ts
import { query } from '../config/database';
import { logger } from '../utils/logger';

interface WorkerFilters {
  status?: string;
}

export class WorkersService {
  async getWorkers(filters: WorkerFilters = {}) {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.status) {
        whereClause += ' AND status = $1';
        params.push(filters.status);
      }

      // Consider workers offline if no heartbeat in last 2 minutes
      const result = await query(
        `SELECT 
          worker_id, worker_name, hostname, location,
          CASE 
            WHEN last_heartbeat > NOW() - INTERVAL '2 minutes' THEN status
            ELSE 'offline'
          END as status,
          last_heartbeat, jobs_completed, jobs_failed,
          messages_processed, started_at, metadata
         FROM workers
         ${whereClause}
         ORDER BY last_heartbeat DESC`,
        params
      );

      return result.rows;
    } catch (error) {
      logger.error('Get workers error:', error);
      throw error;
    }
  }

  async getWorkerById(workerId: string) {
    try {
      const result = await query(
        `SELECT 
          worker_id, worker_name, hostname, location,
          CASE 
            WHEN last_heartbeat > NOW() - INTERVAL '2 minutes' THEN status
            ELSE 'offline'
          END as status,
          last_heartbeat, jobs_completed, jobs_failed,
          messages_processed, started_at, metadata
         FROM workers
         WHERE worker_id = $1`,
        [workerId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Get worker error:', error);
      throw error;
    }
  }

  async getWorkerStats(workerId: string) {
    try {
      const worker = await this.getWorkerById(workerId);
      if (!worker) return null;

      // Get recent job history
      const jobsResult = await query(
        `SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::int as avg_duration
         FROM jobs
         WHERE worker_id = $1
         AND completed_at > NOW() - INTERVAL '24 hours'
         GROUP BY status`,
        [workerId]
      );

      const jobStats: any = {};
      jobsResult.rows.forEach((row) => {
        jobStats[row.status] = {
          count: parseInt(row.count, 10),
          avg_duration: row.avg_duration,
        };
      });

      return {
        ...worker,
        job_stats: jobStats,
      };
    } catch (error) {
      logger.error('Get worker stats error:', error);
      throw error;
    }
  }

  async getWorkerJobs(workerId: string, filters: any) {
    try {
      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM jobs WHERE worker_id = $1',
        [workerId]
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get jobs
      const result = await query(
        `SELECT 
          j.*, c.username as channel_username
         FROM jobs j
         JOIN channels c ON j.channel_id = c.id
         WHERE j.worker_id = $1
         ORDER BY j.created_at DESC
         LIMIT $2 OFFSET $3`,
        [workerId, filters.limit, filters.offset]
      );

      return {
        items: result.rows,
        total,
        limit: filters.limit,
        offset: filters.offset,
      };
    } catch (error) {
      logger.error('Get worker jobs error:', error);
      throw error;
    }
  }
}