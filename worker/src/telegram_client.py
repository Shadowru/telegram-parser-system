# worker/src/telegram_client.py
from telethon import TelegramClient
from telethon.tl.types import Channel, Message
from telethon.errors import FloodWaitError, ChannelPrivateError
import asyncio
import logging
from typing import List, Optional, AsyncIterator
from datetime import datetime

logger = logging.getLogger(__name__)

class TelegramClientManager:
    """Manages Telegram client connection and operations"""
    
    def __init__(
        self,
        api_id: int,
        api_hash: str,
        phone: str,
        session_name: str
    ):
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.session_name = session_name
        
        self.client: Optional[TelegramClient] = None
        self.rate_limiter = RateLimiter(max_requests=20, period=60)
    
    async def connect(self):
        """Connect to Telegram"""
        self.client = TelegramClient(
            f'sessions/{self.session_name}',
            self.api_id,
            self.api_hash
        )
        
        await self.client.connect()
        
        if not await self.client.is_user_authorized():
            await self.client.send_code_request(self.phone)
            logger.warning("Authorization required. Please check your phone for code.")
            # In production, handle this differently
            raise Exception("Authorization required")
        
        logger.info("Telegram client connected and authorized")
    
    async def disconnect(self):
        """Disconnect from Telegram"""
        if self.client:
            await self.client.disconnect()
            logger.info("Telegram client disconnected")
    
    async def get_channel_info(self, username: str) -> dict:
        """Get channel information"""
        await self.rate_limiter.wait()
        
        try:
            entity = await self.client.get_entity(username)
            
            if not isinstance(entity, Channel):
                raise ValueError(f"{username} is not a channel")
            
            return {
                'id': entity.id,
                'title': entity.title,
                'username': entity.username,
                'description': entity.about if hasattr(entity, 'about') else None,
                'members_count': entity.participants_count if hasattr(entity, 'participants_count') else 0,
                'photo_url': None  # TODO: Download photo
            }
            
        except ChannelPrivateError:
            logger.error(f"Channel {username} is private")
            raise
        except Exception as e:
            logger.error(f"Error getting channel info: {e}")
            raise
    
    async def get_messages(
        self,
        username: str,
        limit: Optional[int] = None,
        offset_date: Optional[datetime] = None,
        min_id: int = 0,
        max_id: int = 0
    ) -> AsyncIterator[Message]:
        """
        Get messages from channel
        Returns async iterator of messages
        """
        try:
            entity = await self.client.get_entity(username)
            
            async for message in self.client.iter_messages(
                entity,
                limit=limit,
                offset_date=offset_date,
                min_id=min_id,
                max_id=max_id,
                reverse=False
            ):
                await self.rate_limiter.wait()
                yield message
                
        except FloodWaitError as e:
            logger.warning(f"Flood wait: {e.seconds} seconds")
            await asyncio.sleep(e.seconds)
            # Retry
            async for message in self.get_messages(
                username, limit, offset_date, min_id, max_id
            ):
                yield message
                
        except Exception as e:
            logger.error(f"Error getting messages: {e}")
            raise
    
    async def download_media(self, message: Message, path: str) -> Optional[str]:
        """Download media from message"""
        if not message.media:
            return None
        
        try:
            await self.rate_limiter.wait()
            file_path = await self.client.download_media(message, path)
            return file_path
        except Exception as e:
            logger.error(f"Error downloading media: {e}")
            return None

class RateLimiter:
    """Simple rate limiter"""
    
    def __init__(self, max_requests: int, period: int):
        self.max_requests = max_requests
        self.period = period
        self.requests = []
    
    async def wait(self):
        """Wait if rate limit exceeded"""
        now = asyncio.get_event_loop().time()
        
        # Remove old requests
        self.requests = [
            req_time for req_time in self.requests
            if now - req_time < self.period
        ]
        
        if len(self.requests) >= self.max_requests:
            sleep_time = self.period - (now - self.requests[0])
            if sleep_time > 0:
                logger.debug(f"Rate limit reached, sleeping {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)
                self.requests = []
        
        self.requests.append(now)