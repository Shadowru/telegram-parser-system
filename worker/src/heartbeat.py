# worker/src/heartbeat.py
import asyncio
import logging
from typing import Optional

from api_client import CollectorAPIClient

logger = logging.getLogger(__name__)

class HeartbeatSender:
    """Sends periodic heartbeats to collector"""
    
    def __init__(
        self,
        api_client: CollectorAPIClient,
        interval: int = 30
    ):
        self.api_client = api_client
        self.interval = interval
        self.running = False
        self.current_job: Optional[str] = None
    
    async def start(self):
        """Start sending heartbeats"""
        self.running = True
        logger.info(f"Heartbeat sender started (interval: {self.interval}s)")
        
        while self.running:
            try:
                status = 'busy' if self.current_job else 'idle'
                
                success = await self.api_client.send_heartbeat(
                    status=status,
                    current_job=self.current_job,
                    metadata={
                        'interval': self.interval
                    }
                )
                
                if success:
                    logger.debug(f"Heartbeat sent (status: {status})")
                else:
                    logger.warning("Failed to send heartbeat")
                
            except Exception as e:
                logger.error(f"Error sending heartbeat: {e}")
            
            await asyncio.sleep(self.interval)
    
    def stop(self):
        """Stop sending heartbeats"""
        self.running = False
        logger.info("Heartbeat sender stopped")
    
    def set_current_job(self, job_id: Optional[str]):
        """Update current job"""
        self.current_job = job_id