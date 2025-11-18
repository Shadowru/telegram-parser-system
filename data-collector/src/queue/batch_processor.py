# data-collector/src/queue/batch_processor.py
import asyncio
import logging
from typing import List, Dict, Any
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)

class BatchProcessor:
    """Process message batches and write to database"""
    
    def __init__(
        self,
        queue,
        db_writer,
        batch_size: int = 100,
        batch_timeout: float = 5.0
    ):
        self.queue = queue
        self.db_writer = db_writer
        self.batch_size = batch_size
        self.batch_timeout = batch_timeout
        self.running = False
        self.current_batch: Dict[int, List[Dict]] = defaultdict(list)
        self.last_flush = datetime.utcnow()
        
    async def start(self):
        """Start processing batches"""
        self.running = True
        logger.info("Batch processor started")
        
        while self.running:
            try:
                # Get batch from queue
                batch_data = await self.queue.get_batch(timeout=1.0)
                
                if batch_data:
                    await self._process_batch(batch_data)
                
                # Check if we should flush
                await self._check_flush()
                
            except Exception as e:
                logger.error(f"Error in batch processor: {e}")
                await asyncio.sleep(1)
    
    async def stop(self):
        """Stop processing and flush remaining batches"""
        logger.info("Stopping batch processor...")
        self.running = False
        await self._flush_all()
        logger.info("Batch processor stopped")
    
    async def _process_batch(self, batch_data: Dict[str, Any]):
        """Process a single batch"""
        channel_id = batch_data["channel_id"]
        messages = batch_data["messages"]
        
        # Add messages to current batch
        self.current_batch[channel_id].extend(messages)
        
        # Check if channel batch is ready to flush
        if len(self.current_batch[channel_id]) >= self.batch_size:
            await self._flush_channel(channel_id)
    
    async def _check_flush(self):
        """Check if timeout flush is needed"""
        now = datetime.utcnow()
        elapsed = (now - self.last_flush).total_seconds()
        
        if elapsed >= self.batch_timeout and self.current_batch:
            await self._flush_all()
    
    async def _flush_channel(self, channel_id: int):
        """Flush messages for specific channel"""
        if channel_id not in self.current_batch:
            return
        
        messages = self.current_batch[channel_id]
        if not messages:
            return
        
        try:
            # Write to database
            await self.db_writer.insert_messages(channel_id, messages)
            
            logger.info(
                f"Flushed {len(messages)} messages for channel {channel_id}"
            )
            
            # Clear batch
            self.current_batch[channel_id] = []
            
        except Exception as e:
            logger.error(f"Error flushing channel {channel_id}: {e}")
            # Keep messages in batch for retry
    
    async def _flush_all(self):
        """Flush all pending batches"""
        if not self.current_batch:
            return
        
        logger.info(f"Flushing all batches ({len(self.current_batch)} channels)")
        
        for channel_id in list(self.current_batch.keys()):
            await self._flush_channel(channel_id)
        
        self.last_flush = datetime.utcnow()