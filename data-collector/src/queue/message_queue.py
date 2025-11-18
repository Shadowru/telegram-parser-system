# data-collector/src/queue/message_queue.py
import asyncio
import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
import aioredis
import logging

logger = logging.getLogger(__name__)

class MessageQueue:
    """In-memory queue with Redis backup"""
    
    def __init__(self, redis_url: str, max_size: int = 10000):
        self.redis_url = redis_url
        self.max_size = max_size
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=max_size)
        self.redis: Optional[aioredis.Redis] = None
        self.processed_count = 0
        self.failed_count = 0
        
    async def connect(self):
        """Connect to Redis"""
        self.redis = await aioredis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        logger.info("Connected to Redis")
        
        # Restore queue from Redis if exists
        await self._restore_from_redis()
    
    async def disconnect(self):
        """Disconnect from Redis"""
        # Backup queue to Redis before disconnect
        await self._backup_to_redis()
        
        if self.redis:
            await self.redis.close()
            logger.info("Disconnected from Redis")
    
    async def add_batch(
        self,
        worker_id: str,
        channel_id: int,
        messages: List[Dict[str, Any]],
        job_id: Optional[str] = None
    ) -> str:
        """Add message batch to queue"""
        batch_id = str(uuid.uuid4())
        
        batch_data = {
            "batch_id": batch_id,
            "worker_id": worker_id,
            "channel_id": channel_id,
            "job_id": job_id,
            "messages": messages,
            "received_at": datetime.utcnow().isoformat(),
            "retry_count": 0
        }
        
        try:
            # Add to in-memory queue
            await self.queue.put(batch_data)
            
            # Backup to Redis
            if self.redis:
                await self.redis.lpush(
                    "message_queue_backup",
                    json.dumps(batch_data, default=str)
                )
                await self.redis.ltrim("message_queue_backup", 0, 9999)
            
            logger.debug(f"Added batch {batch_id} to queue")
            return batch_id
            
        except asyncio.QueueFull:
            logger.error("Queue is full, rejecting batch")
            raise Exception("Queue is full")
    
    async def get_batch(self, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
        """Get batch from queue"""
        try:
            batch = await asyncio.wait_for(
                self.queue.get(),
                timeout=timeout
            )
            return batch
        except asyncio.TimeoutError:
            return None
    
    async def size(self) -> int:
        """Get current queue size"""
        return self.queue.qsize()
    
    async def _backup_to_redis(self):
        """Backup current queue to Redis"""
        if not self.redis:
            return
        
        items = []
        while not self.queue.empty():
            try:
                item = self.queue.get_nowait()
                items.append(item)
            except asyncio.QueueEmpty:
                break
        
        if items:
            await self.redis.delete("message_queue_backup")
            for item in items:
                await self.redis.lpush(
                    "message_queue_backup",
                    json.dumps(item, default=str)
                )
            logger.info(f"Backed up {len(items)} items to Redis")
    
    async def _restore_from_redis(self):
        """Restore queue from Redis"""
        if not self.redis:
            return
        
        count = await self.redis.llen("message_queue_backup")
        if count == 0:
            return
        
        logger.info(f"Restoring {count} items from Redis")
        
        for _ in range(min(count, self.max_size)):
            item_json = await self.redis.rpop("message_queue_backup")
            if item_json:
                item = json.loads(item_json)
                try:
                    await self.queue.put(item)
                except asyncio.QueueFull:
                    logger.warning("Queue full during restore")
                    break
        
        logger.info("Queue restored from Redis")