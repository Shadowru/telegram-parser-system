# worker/src/job_executor.py
import asyncio
import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta

from telegram_client import TelegramClientManager
from parser import ChannelParser
from api_client import CollectorAPIClient
from config import Config

logger = logging.getLogger(__name__)

class JobExecutor:
    """Executes parsing jobs"""
    
    def __init__(
        self,
        telegram_client: TelegramClientManager,
        parser: ChannelParser,
        api_client: CollectorAPIClient,
        config: Config
    ):
        self.telegram_client = telegram_client
        self.parser = parser
        self.api_client = api_client
        self.config = config
        
        self.current_job: Optional[str] = None
        self.messages_collected = 0
    
    async def execute(self, job: Dict[str, Any]):
        """Execute a parsing job"""
        job_id = job['job_uuid']
        channel_id = job['channel_id']
        channel_username = job['channel_username']
        job_type = job['job_type']
        
        self.current_job = job_id
        self.messages_collected = 0
        
        logger.info(
            f"Starting job {job_id}: {job_type} for channel {channel_username}"
        )
        
        try:
            # Mark job as started
            await self.api_client.start_job(job_id)
            
            # Execute based on job type
            if job_type == 'initial':
                await self._execute_initial_parse(channel_id, channel_username, job_id)
            elif job_type == 'update':
                await self._execute_update_parse(channel_id, channel_username, job_id)
            elif job_type == 'full_sync':
                await self._execute_full_sync(channel_id, channel_username, job_id)
            else:
                raise ValueError(f"Unknown job type: {job_type}")
            
            # Mark job as completed
            await self.api_client.complete_job(job_id, self.messages_collected)
            
            logger.info(
                f"Completed job {job_id}: collected {self.messages_collected} messages"
            )
            
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}", exc_info=True)
            await self.api_client.fail_job(job_id, str(e))
        
        finally:
            self.current_job = None
            self.messages_collected = 0
    
    async def _execute_initial_parse(
        self,
        channel_id: int,
        channel_username: str,
        job_id: str
    ):
        """Initial parse - get recent messages"""
        logger.info(f"Initial parse for {channel_username}")
        
        # Get channel info first
        try:
            channel_info = await self.telegram_client.get_channel_info(channel_username)
            logger.info(f"Channel info: {channel_info['title']}, {channel_info['members_count']} members")
        except Exception as e:
            logger.error(f"Error getting channel info: {e}")
        
        # Get recent messages (last 1000)
        await self._collect_messages(
            channel_id=channel_id,
            channel_username=channel_username,
            job_id=job_id,
            limit=1000
        )
    
    async def _execute_update_parse(
        self,
        channel_id: int,
        channel_username: str,
        job_id: str
    ):
        """Update parse - get new messages since last parse"""
        logger.info(f"Update parse for {channel_username}")
        
        # Get messages from last 24 hours
        offset_date = datetime.now() - timedelta(days=1)
        
        await self._collect_messages(
            channel_id=channel_id,
            channel_username=channel_username,
            job_id=job_id,
            offset_date=offset_date
        )
    
    async def _execute_full_sync(
        self,
        channel_id: int,
        channel_username: str,
        job_id: str
    ):
        """Full sync - get all messages"""
        logger.info(f"Full sync for {channel_username}")
        
        await self._collect_messages(
            channel_id=channel_id,
            channel_username=channel_username,
            job_id=job_id,
            limit=None  # No limit - get all
        )
    
    async def _collect_messages(
        self,
        channel_id: int,
        channel_username: str,
        job_id: str,
        limit: Optional[int] = None,
        offset_date: Optional[datetime] = None
    ):
        """Collect and submit messages in batches"""
        batch = []
        batch_size = self.config.MESSAGE_BATCH_SIZE
        
        try:
            async for message in self.telegram_client.get_messages(
                username=channel_username,
                limit=limit,
                offset_date=offset_date
            ):
                # Parse message
                try:
                    parsed_message = self.parser.parse_message(message)
                    batch.append(parsed_message)
                    self.messages_collected += 1
                    
                    # Submit batch when full
                    if len(batch) >= batch_size:
                        success = await self.api_client.submit_messages(
                            channel_id=channel_id,
                            messages=batch,
                            job_id=job_id
                        )
                        
                        if success:
                            logger.info(
                                f"Submitted batch of {len(batch)} messages "
                                f"(total: {self.messages_collected})"
                            )
                            batch = []
                        else:
                            logger.error("Failed to submit batch, will retry")
                            await asyncio.sleep(5)
                    
                except Exception as e:
                    logger.error(f"Error parsing message {message.id}: {e}")
                    continue
            
            # Submit remaining messages
            if batch:
                success = await self.api_client.submit_messages(
                    channel_id=channel_id,
                    messages=batch,
                    job_id=job_id
                )
                
                if success:
                    logger.info(f"Submitted final batch of {len(batch)} messages")
                else:
                    logger.error("Failed to submit final batch")
        
        except Exception as e:
            logger.error(f"Error collecting messages: {e}")
            raise