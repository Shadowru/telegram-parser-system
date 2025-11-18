// src/services/scheduler.service.ts
import cron from 'node-cron';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { JobsService } from './jobs.service';

const jobsService = new JobsService();

export class SchedulerService {
  private tasks: cron.ScheduledTask[] = [];

  async start() {
    logger.info('Starting scheduler...');

    // Schedule channel parsing (every 5 minutes)
    this.tasks.push(
      cron.schedule('*/5 * * * *', async () => {
        await this.scheduleChannelParsing();
      })
    );

    // Cleanup old jobs (daily at 2 AM)
    this.tasks.push(
      cron.schedule('0 2 * * *', async () => {
        await this.cleanupOldJobs();
      })
    );

    // Check stale jobs (every 10 minutes)
    this.tasks.push(
      cron.schedule('*/10 * * * *', async () => {
        await this.checkStaleJobs();
      })
    );

    // Update worker status (every minute)
    this.tasks.push(
      cron.schedule('* * * * *', async () => {
        await this.updateWorkerStatus();
      })
    );

    logger.info('Scheduler started');
  }

  async stop() {
    logger.info('Stopping scheduler...');
    this.tasks.forEach((task) => task.stop());
    logger.info('Scheduler stopped');
  }

  private async scheduleChannelParsing() {
    try {
      // Get channels that need parsing
      const result = await query(`
        SELECT id, username, parse_frequency
        FROM channels
        WHERE status = 'active'
        AND (
          last_parsed_at IS NULL
          OR last_parsed_at < NOW() - (parse_frequency || ' seconds')::INTERVAL
        )
        AND NOT EXISTS (
          SELECT 1 FROM jobs
          WHERE jobs.channel_id = channels.id
          AND jobs.status IN ('pending', 'assigned', 'running')
        )
        LIMIT 10
      `);

      for (const channel of result.rows) {
        await jobsService.createJob({
          channel_id: channel.id,
          job_type: 'update',
          priority: 5,
        });

        logger.info(`Scheduled parsing for channel: ${channel.username}`);
      }
    } catch (error) {
      logger.error('Schedule channel parsing error:', error);
    }
  }

  private async cleanupOldJobs() {
    try {
      const result = await query(`
        DELETE FROM jobs
        WHERE status IN ('completed', 'failed', 'cancelled')
        AND completed_at < NOW() - INTERVAL '7 days'
      `);

      logger.info(`Cleaned up ${result.rowCount} old jobs`);
    } catch (error) {
      logger.error('Cleanup old jobs error:', error);
    }
  }

  private async checkStaleJobs() {
    try {
      // Mark jobs as failed if running for too long
      const result = await query(`
        UPDATE jobs
        SET 
          status = 'failed',
          completed_at = NOW(),
          error_message = 'Job timeout - no progress for 30 minutes'
        WHERE status = 'running'
        AND started_at < NOW() - INTERVAL '30 minutes'
        AND (
          updated_at IS NULL
          OR updated_at < NOW() - INTERVAL '30 minutes'
        )
      `);

      if (result.rowCount > 0) {
        logger.warn(`Marked ${result.rowCount} stale jobs as failed`);
      }
    } catch (error) {
      logger.error('Check stale jobs error:', error);
    }
  }

  private async updateWorkerStatus() {
    try {
      // Mark workers as offline if no heartbeat in last 2 minutes
      const result = await query(`
        UPDATE workers
        SET status = 'offline'
        WHERE status != 'offline'
        AND last_heartbeat < NOW() - INTERVAL '2 minutes'
      `);

      if (result.rowCount > 0) {
        logger.warn(`Marked ${result.rowCount} workers as offline`);
      }
    } catch (error) {
      logger.error('Update worker status error:', error);
    }
  }
}