# data-collector/src/database/writer.py
import asyncpg
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class DatabaseWriter:
    """Database writer with connection pooling and batch operations"""
    
    def __init__(self, database_url: str, pool_size: int = 20):
        self.database_url = database_url
        self.pool_size = pool_size
        self.pool: Optional[asyncpg.Pool] = None
        
    async def connect(self):
        """Create connection pool"""
        self.pool = await asyncpg.create_pool(
            self.database_url,
            min_size=5,
            max_size=self.pool_size,
            command_timeout=60,
            max_queries=50000,
            max_inactive_connection_lifetime=300
        )
        logger.info(f"Database connection pool created (size: {self.pool_size})")
    
    async def disconnect(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")
    
    async def insert_messages(
        self,
        channel_id: int,
        messages: List[Dict[str, Any]]
    ) -> int:
        """
        Batch insert messages with deduplication
        Returns number of inserted messages
        """
        if not messages:
            return 0
        
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Prepare data for batch insert
                records = []
                for msg in messages:
                    records.append((
                        channel_id,
                        msg.get('message_id'),
                        msg.get('text'),
                        msg.get('date'),
                        msg.get('views', 0),
                        msg.get('forwards', 0),
                        msg.get('replies', 0),
                        json.dumps(msg.get('reactions')) if msg.get('reactions') else None,
                        msg.get('edit_date'),
                        msg.get('media_type'),
                        msg.get('media_url'),
                        json.dumps(msg.get('media_metadata')) if msg.get('media_metadata') else None,
                        msg.get('author_id'),
                        msg.get('author_name'),
                        msg.get('is_forwarded', False),
                        json.dumps(msg.get('forward_from')) if msg.get('forward_from') else None,
                        msg.get('reply_to_msg_id'),
                        json.dumps(msg.get('raw_data')) if msg.get('raw_data') else None
                    ))
                
                # Batch insert with ON CONFLICT
                query = """
                    INSERT INTO messages (
                        channel_id, message_id, text, date, views, forwards, replies,
                        reactions, edit_date, media_type, media_url, media_metadata,
                        author_id, author_name, is_forwarded, forward_from,
                        reply_to_msg_id, raw_data
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                    ON CONFLICT (channel_id, message_id) 
                    DO UPDATE SET
                        views = EXCLUDED.views,
                        forwards = EXCLUDED.forwards,
                        replies = EXCLUDED.replies,
                        reactions = EXCLUDED.reactions,
                        edit_date = EXCLUDED.edit_date
                """
                
                result = await conn.executemany(query, records)
                
                # Update channel statistics
                await conn.execute("""
                    UPDATE channels 
                    SET 
                        last_parsed_at = NOW(),
                        last_message_date = (
                            SELECT MAX(date) FROM messages WHERE channel_id = $1
                        ),
                        updated_at = NOW()
                    WHERE id = $1
                """, channel_id)
                
                logger.info(f"Inserted {len(records)} messages for channel {channel_id}")
                return len(records)
    
    async def update_worker_heartbeat(
        self,
        worker_id: str,
        status: str,
        current_job: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Update worker heartbeat and status"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO workers (worker_id, status, last_heartbeat, metadata)
                VALUES ($1, $2, NOW(), $3)
                ON CONFLICT (worker_id) 
                DO UPDATE SET
                    status = EXCLUDED.status,
                    last_heartbeat = NOW(),
                    metadata = EXCLUDED.metadata
            """, worker_id, status, json.dumps(metadata) if metadata else None)
            
            # Update worker stats
            if current_job:
                await conn.execute("""
                    UPDATE workers 
                    SET metadata = jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{current_job}',
                        to_jsonb($2::text)
                    )
                    WHERE worker_id = $1
                """, worker_id, current_job)
    
    async def get_worker_jobs(
        self,
        worker_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get pending jobs for worker"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    j.job_uuid,
                    j.channel_id,
                    c.username as channel_username,
                    j.job_type,
                    j.priority,
                    j.created_at
                FROM jobs j
                JOIN channels c ON j.channel_id = c.id
                WHERE j.status = 'pending'
                AND c.status = 'active'
                ORDER BY j.priority DESC, j.created_at ASC
                LIMIT $1
            """, limit)
            
            return [dict(row) for row in rows]
    
    async def update_job_status(
        self,
        job_id: str,
        status: str,
        worker_id: Optional[str] = None,
        messages_collected: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        """Update job status"""
        async with self.pool.acquire() as conn:
            if status == 'running':
                await conn.execute("""
                    UPDATE jobs 
                    SET 
                        status = $2,
                        worker_id = $3,
                        started_at = NOW()
                    WHERE job_uuid = $1
                """, job_id, status, worker_id)
                
            elif status == 'completed':
                await conn.execute("""
                    UPDATE jobs 
                    SET 
                        status = $2,
                        completed_at = NOW(),
                        messages_collected = $3,
                        progress_percent = 100
                    WHERE job_uuid = $1
                """, job_id, status, messages_collected)
                
                # Update worker stats
                if worker_id:
                    await conn.execute("""
                        UPDATE workers 
                        SET 
                            jobs_completed = jobs_completed + 1,
                            messages_processed = messages_processed + $2
                        WHERE worker_id = $1
                    """, worker_id, messages_collected or 0)
                
            elif status == 'failed':
                await conn.execute("""
                    UPDATE jobs 
                    SET 
                        status = $2,
                        completed_at = NOW(),
                        error_message = $3,
                        retry_count = retry_count + 1
                    WHERE job_uuid = $1
                """, job_id, status, error_message)
                
                # Update worker stats
                if worker_id:
                    await conn.execute("""
                        UPDATE workers 
                        SET jobs_failed = jobs_failed + 1
                        WHERE worker_id = $1
                    """, worker_id)
    
    async def get_worker_stats(self, worker_id: str) -> Dict[str, Any]:
        """Get worker statistics"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT 
                    jobs_completed,
                    jobs_failed,
                    messages_processed,
                    EXTRACT(EPOCH FROM (NOW() - started_at))::int as uptime_seconds
                FROM workers
                WHERE worker_id = $1
            """, worker_id)
            
            if row:
                return dict(row)
            return {
                'jobs_completed': 0,
                'jobs_failed': 0,
                'messages_processed': 0,
                'uptime_seconds': 0
            }
    
    async def cleanup_old_jobs(self, days: int = 7):
        """Cleanup old completed jobs"""
        async with self.pool.acquire() as conn:
            result = await conn.execute("""
                DELETE FROM jobs
                WHERE status IN ('completed', 'failed')
                AND completed_at < NOW() - INTERVAL '%s days'
            """ % days)
            
            logger.info(f"Cleaned up old jobs: {result}")
    
    async def get_channel_stats(self, channel_id: int) -> Dict[str, Any]:
        """Get channel statistics"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_messages,
                    AVG(views)::int as avg_views,
                    MAX(date) as last_message_date,
                    MIN(date) as first_message_date
                FROM messages
                WHERE channel_id = $1
            """, channel_id)
            
            return dict(row) if row else {}