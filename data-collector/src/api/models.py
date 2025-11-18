# data-collector/src/api/models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class WorkerStatus(str, Enum):
    ACTIVE = "active"
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"

class Message(BaseModel):
    message_id: int
    text: Optional[str] = None
    date: datetime
    views: int = 0
    forwards: int = 0
    replies: int = 0
    reactions: Optional[Dict[str, int]] = None
    edit_date: Optional[datetime] = None
    media_type: Optional[str] = None
    media_url: Optional[str] = None
    media_metadata: Optional[Dict[str, Any]] = None
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    is_forwarded: bool = False
    forward_from: Optional[Dict[str, Any]] = None
    reply_to_msg_id: Optional[int] = None
    raw_data: Optional[Dict[str, Any]] = None

class MessageBatch(BaseModel):
    channel_id: int
    job_id: Optional[str] = None
    messages: List[Message]
    metadata: Optional[Dict[str, Any]] = None

class WorkerHeartbeat(BaseModel):
    status: WorkerStatus
    current_job: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class JobRequest(BaseModel):
    channel_id: int
    job_type: str
    priority: int = 5

class JobResponse(BaseModel):
    job_id: str
    channel_id: int
    channel_username: str
    job_type: str
    priority: int
    created_at: datetime

class MessageResponse(BaseModel):
    success: bool
    batch_id: str
    messages_count: int
    message: str

class WorkerStats(BaseModel):
    jobs_completed: int
    jobs_failed: int
    messages_processed: int
    uptime_seconds: int

class StatsResponse(BaseModel):
    queue_size: int
    worker_stats: WorkerStats