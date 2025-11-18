# worker/src/main.py
import asyncio
import logging
import signal
import sys
from typing import Optional

from config import Config
from telegram_client import TelegramClientManager
from parser import ChannelParser
from api_client import CollectorAPIClient
from job_executor import JobExecutor
from heartbeat import HeartbeatSender

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/app/logs/worker.log')
    ]
)

logger = logging.getLogger(__name__)

class Worker:
    """Main worker class"""
    
    def __init__(self, config: Config):
        self.config = config
        self.running = False
        
        # Initialize components
        self.api_client = CollectorAPIClient(
            base_url=config.COLLECTOR_API_URL,
            auth_token=config.WORKER_AUTH_TOKEN,
            worker_id=config.WORKER_ID
        )
        
        self.telegram_client = TelegramClientManager(
            api_id=config.TELEGRAM_API_ID,
            api_hash=config.TELEGRAM_API_HASH,
            phone=config.TELEGRAM_PHONE,
            session_name=config.WORKER_ID
        )
        
        self.parser = ChannelParser()
        
        self.job_executor = JobExecutor(
            telegram_client=self.telegram_client,
            parser=self.parser,
            api_client=self.api_client,
            config=config
        )
        
        self.heartbeat_sender = HeartbeatSender(
            api_client=self.api_client,
            interval=config.HEARTBEAT_INTERVAL
        )
    
    async def start(self):
        """Start worker"""
        logger.info(f"Starting worker {self.config.WORKER_ID}...")
        self.running = True
        
        try:
            # Connect to Telegram
            await self.telegram_client.connect()
            logger.info("Connected to Telegram")
            
            # Start heartbeat
            heartbeat_task = asyncio.create_task(self.heartbeat_sender.start())
            
            # Main work loop
            while self.running:
                try:
                    # Get jobs from collector
                    jobs = await self.api_client.get_jobs(limit=1)
                    
                    if jobs:
                        job = jobs[0]
                        logger.info(f"Received job: {job['job_id']}")
                        
                        # Execute job
                        await self.job_executor.execute(job)
                    else:
                        # No jobs available, wait
                        logger.debug("No jobs available, waiting...")
                        await asyncio.sleep(10)
                        
                except Exception as e:
                    logger.error(f"Error in main loop: {e}", exc_info=True)
                    await asyncio.sleep(5)
            
            # Cancel heartbeat
            heartbeat_task.cancel()
            
        except Exception as e:
            logger.error(f"Fatal error: {e}", exc_info=True)
        finally:
            await self.stop()
    
    async def stop(self):
        """Stop worker"""
        logger.info("Stopping worker...")
        self.running = False
        
        # Disconnect from Telegram
        await self.telegram_client.disconnect()
        
        # Close API client
        await self.api_client.close()
        
        logger.info("Worker stopped")
    
    def handle_signal(self, sig):
        """Handle shutdown signals"""
        logger.info(f"Received signal {sig}, shutting down...")
        self.running = False

async def main():
    """Main entry point"""
    config = Config()
    worker = Worker(config)
    
    # Setup signal handlers
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(
            sig,
            lambda s=sig: worker.handle_signal(s)
        )
    
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    finally:
        await worker.stop()

if __name__ == "__main__":
    asyncio.run(main())