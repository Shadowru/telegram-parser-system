# data-collector/src/api/dependencies.py
from fastapi import Header, HTTPException
from typing import Optional
import os

async def verify_token(authorization: Optional[str] = Header(None)) -> str:
    """
    Verify worker authentication token
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        expected_token = os.getenv("WORKER_AUTH_TOKEN")
        if token != expected_token:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Extract worker_id from token or header
        worker_id = Header(None, alias="X-Worker-ID")
        if not worker_id:
            raise HTTPException(status_code=400, detail="Missing X-Worker-ID header")
        
        return worker_id
        
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

async def get_queue():
    """Dependency to get message queue instance"""
    from main import message_queue
    if not message_queue:
        raise HTTPException(status_code=503, detail="Queue not available")
    return message_queue

async def get_db_writer():
    """Dependency to get database writer instance"""
    from main import db_writer
    if not db_writer:
        raise HTTPException(status_code=503, detail="Database not available")
    return db_writer