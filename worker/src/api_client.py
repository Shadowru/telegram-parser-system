# worker/src/api_client.py
import httpx
import logging
from typing import List, Dict, Any, Optional
import asyncio

logger = logging.getLogger(__name__)

class CollectorAPIClient:
    """Client for Data Collector API"""
    
    def __init__(
        self,
        base_url: str,
        auth_token: str,
        worker_id: str,
        timeout: int = 30
    ):
        self.base_url = base_url.rstrip('/')
        self.auth_token = auth_token
        self.worker_id = worker_id
        
        self.client = httpx.AsyncClient(
            timeout=timeout,
            headers={
                'Authorization': f'Bearer {auth_token}',
                'X-Worker-ID': worker_id,
                'Content-Type': 'application/json'
            }
        )
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
    
    async def get_jobs(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get available jobs"""
        try:
            response = await self.client.get(
                f'{self.base_url}/api/collector/jobs',
                params={'limit': limit}
            )
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"Error getting jobs: {e}")
            return []
    
    async def start_job(self, job_id: str) -> bool:
        """Mark job as started"""
        try:
            response = await self.client.post(
                f'{self.base_url}/api/collector/jobs/{job_id}/start'
            )
            response.raise_for_status()
            return True
            
        except httpx.HTTPError as e:
            logger.error(f"Error starting job: {e}")
            return False
    
    async def complete_job(self, job_id: str, messages_count: int) -> bool:
        """Mark job as completed"""
        try:
            response = await self.client.post(
                f'{self.base_url}/api/collector/jobs/{job_id}/complete',
                params={'messages_count': messages_count}
            )
            response.raise_for_status()
            return True
            
        except httpx.HTTPError as e:
            logger.error(f"Error completing job: {e}")
            return False
    
    async def fail_job(self, job_id: str, error_message: str) -> bool:
        """Mark job as failed"""
        try:
            response = await self.client.post(
                f'{self.base_url}/api/collector/jobs/{job_id}/fail',
                params={'error_message': error_message}
            )
            response.raise_for_status()
            return True
            
        except httpx.HTTPError as e:
            logger.error(f"Error failing job: {e}")
            return False
    
    async def submit_messages(
        self,
        channel_id: int,
        messages: List[Dict[str, Any]],
        job_id: Optional[str] = None,
        retry_count: int = 3
    ) -> bool:
        """Submit parsed messages"""
        payload = {
            'channel_id': channel_id,
            'job_id': job_id,
            'messages': messages
        }
        
        for attempt in range(retry_count):
            try:
                response = await self.client.post(
                    f'{self.base_url}/api/collector/messages',
                    json=payload
                )
                response.raise_for_status()
                
                result = response.json()
                logger.info(
                    f"Submitted batch: {result['batch_id']}, "
                    f"{result['messages_count']} messages"
                )
                return True
                
            except httpx.HTTPError as e:
                logger.error(
                    f"Error submitting messages (attempt {attempt + 1}/{retry_count}): {e}"
                )
                
                if attempt < retry_count - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                else:
                    return False
        
        return False
    
    async def send_heartbeat(
        self,
        status: str,
        current_job: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send heartbeat"""
        try:
            payload = {
                'status': status,
                'current_job': current_job,
                'metadata': metadata or {}
            }
            
            response = await self.client.post(
                f'{self.base_url}/api/collector/heartbeat',
                json=payload
            )
            response.raise_for_status()
            return True
            
        except httpx.HTTPError as e:
            logger.error(f"Error sending heartbeat: {e}")
            return False