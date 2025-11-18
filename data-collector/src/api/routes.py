# data-collector/src/api/routes.py
from fastapi import APIRouter, HTTPException, Depends, Header, BackgroundTasks
from typing import List, Optional
from datetime import datetime
import logging

from .models import (
    MessageBatch,
    WorkerHeartbeat,
    JobRequest,
    JobResponse,
    MessageResponse,
    StatsResponse
)
from .dependencies import verify_token, get_queue, get_db_writer

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/messages", response_model=MessageResponse)
async def submit_messages(
    batch: MessageBatch,
    background_tasks: BackgroundTasks,
    worker_id: str = Depends(verify_token),
    queue = Depends(get_queue)
):
    """
    Endpoint for workers to submit parsed messages
    """
    try:
        # Validate batch
        if not batch.messages:
            raise HTTPException(status_code=400, detail="Empty message batch")
        
        if len(batch.messages) > 1000:
            raise HTTPException(
                status_code=400, 
                detail="Batch too large (max 1000 messages)"
            )
        
        # Add to queue
        batch_id = await queue.add_batch(
            worker_id=worker_id,
            channel_id=batch.channel_id,
            messages=batch.messages,
            job_id=batch.job_id
        )
        
        logger.info(
            f"Received batch {batch_id} from worker {worker_id}: "
            f"{len(batch.messages)} messages for channel {batch.channel_id}"
        )
        
        return MessageResponse(
            success=True,
            batch_id=batch_id,
            messages_count=len(batch.messages),
            message="Messages queued for processing"
        )
        
    except Exception as e:
        logger.error(f"Error submitting messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/heartbeat")
async def worker_heartbeat(
    heartbeat: WorkerHeartbeat,
    worker_id: str = Depends(verify_token),
    db_writer = Depends(get_db_writer)
):
    """
    Endpoint for workers to send heartbeat
    """
    try:
        await db_writer.update_worker_heartbeat(
            worker_id=worker_id,
            status=heartbeat.status,
            current_job=heartbeat.current_job,
            metadata=heartbeat.metadata
        )
        
        return {
            "success": True,
            "message": "Heartbeat received",
            "timestamp": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error processing heartbeat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs", response_model=List[JobResponse])
async def get_jobs(
    worker_id: str = Depends(verify_token),
    limit: int = 10,
    db_writer = Depends(get_db_writer)
):
    """
    Endpoint for workers to get assigned jobs
    """
    try:
        jobs = await db_writer.get_worker_jobs(
            worker_id=worker_id,
            limit=limit
        )
        
        return jobs
        
    except Exception as e:
        logger.error(f"Error getting jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/jobs/{job_id}/start")
async def start_job(
    job_id: str,
    worker_id: str = Depends(verify_token),
    db_writer = Depends(get_db_writer)
):
    """
    Mark job as started
    """
    try:
        await db_writer.update_job_status(
            job_id=job_id,
            status="running",
            worker_id=worker_id
        )
        
        return {"success": True, "message": "Job started"}
        
    except Exception as e:
        logger.error(f"Error starting job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/jobs/{job_id}/complete")
async def complete_job(
    job_id: str,
    messages_count: int,
    worker_id: str = Depends(verify_token),
    db_writer = Depends(get_db_writer)
):
    """
    Mark job as completed
    """
    try:
        await db_writer.update_job_status(
            job_id=job_id,
            status="completed",
            worker_id=worker_id,
            messages_collected=messages_count
        )
        
        return {"success": True, "message": "Job completed"}
        
    except Exception as e:
        logger.error(f"Error completing job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/jobs/{job_id}/fail")
async def fail_job(
    job_id: str,
    error_message: str,
    worker_id: str = Depends(verify_token),
    db_writer = Depends(get_db_writer)
):
    """
    Mark job as failed
    """
    try:
        await db_writer.update_job_status(
            job_id=job_id,
            status="failed",
            worker_id=worker_id,
            error_message=error_message
        )
        
        return {"success": True, "message": "Job marked as failed"}
        
    except Exception as e:
        logger.error(f"Error failing job: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    worker_id: str = Depends(verify_token),
    queue = Depends(get_queue),
    db_writer = Depends(get_db_writer)
):
    """
    Get collector statistics
    """
    try:
        queue_size = await queue.size()
        worker_stats = await db_writer.get_worker_stats(worker_id)
        
        return StatsResponse(
            queue_size=queue_size,
            worker_stats=worker_stats
        )
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
