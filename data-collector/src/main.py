# data-collector/src/main.py
from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import logging
from typing import Optional

from api.routes import router
from queue.message_queue import MessageQueue
from queue.batch_processor import BatchProcessor
from database.writer import DatabaseWriter
from monitoring.metrics import MetricsCollector
from config import Settings

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Settings
settings = Settings()

# Global instances
message_queue: Optional[MessageQueue] = None
batch_processor: Optional[BatchProcessor] = None
db_writer: Optional[DatabaseWriter] = None
metrics: Optional[MetricsCollector] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global message_queue, batch_processor, db_writer, metrics
    
    logger.info("Starting Data Collector Service...")
    
    # Initialize components
    db_writer = DatabaseWriter(settings.DATABASE_URL)
    await db_writer.connect()
    
    message_queue = MessageQueue(
        redis_url=settings.REDIS_URL,
        max_size=settings.MAX_QUEUE_SIZE
    )
    await message_queue.connect()
    
    batch_processor = BatchProcessor(
        queue=message_queue,
        db_writer=db_writer,
        batch_size=settings.BATCH_SIZE,
        batch_timeout=settings.BATCH_TIMEOUT
    )
    
    metrics = MetricsCollector()
    
    # Start background tasks
    asyncio.create_task(batch_processor.start())
    asyncio.create_task(cleanup_old_jobs())
    
    logger.info("Data Collector Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Data Collector Service...")
    await batch_processor.stop()
    await message_queue.disconnect()
    await db_writer.disconnect()
    logger.info("Data Collector Service stopped")

# FastAPI app
app = FastAPI(
    title="Telegram Parser Data Collector",
    description="REST API for collecting parsed data from workers",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router, prefix="/api/collector")

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    queue_size = await message_queue.size() if message_queue else 0
    
    return {
        "status": "healthy",
        "queue_size": queue_size,
        "max_queue_size": settings.MAX_QUEUE_SIZE,
        "batch_size": settings.BATCH_SIZE
    }

# Metrics endpoint
@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    if metrics:
        return metrics.generate_metrics()
    return {}

async def cleanup_old_jobs():
    """Background task to cleanup old completed jobs"""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            if db_writer:
                await db_writer.cleanup_old_jobs(days=7)
                logger.info("Cleaned up old jobs")
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.API_PORT,
        workers=4,
        log_level="info"
    )