# worker/src/parser.py
from telethon.tl.types import Message, MessageMediaPhoto, MessageMediaDocument
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ChannelParser:
    """Parse Telegram messages"""
    
    def parse_message(self, message: Message) -> Dict[str, Any]:
        """Parse single message"""
        try:
            parsed = {
                'message_id': message.id,
                'text': message.text or '',
                'date': message.date,
                'views': message.views or 0,
                'forwards': message.forwards or 0,
                'replies': message.replies.replies if message.replies else 0,
                'reactions': self._parse_reactions(message),
                'edit_date': message.edit_date,
                'media_type': self._get_media_type(message),
                'media_url': None,  # Will be set if media downloaded
                'media_metadata': self._parse_media_metadata(message),
                'author_id': message.from_id.user_id if message.from_id else None,
                'author_name': None,  # TODO: Get author name
                'is_forwarded': message.fwd_from is not None,
                'forward_from': self._parse_forward_info(message),
                'reply_to_msg_id': message.reply_to_msg_id,
                'raw_data': None  # Can store full message object if needed
            }
            
            return parsed
            
        except Exception as e:
            logger.error(f"Error parsing message {message.id}: {e}")
            raise
    
    def _parse_reactions(self, message: Message) -> Optional[Dict[str, int]]:
        """Parse message reactions"""
        if not message.reactions:
            return None
        
        reactions = {}
        for reaction in message.reactions.results:
            emoji = reaction.reaction.emoticon if hasattr(reaction.reaction, 'emoticon') else str(reaction.reaction)
            reactions[emoji] = reaction.count
        
        return reactions if reactions else None
    
    def _get_media_type(self, message: Message) -> Optional[str]:
        """Get media type"""
        if not message.media:
            return None
        
        if isinstance(message.media, MessageMediaPhoto):
            return 'photo'
        elif isinstance(message.media, MessageMediaDocument):
            if message.media.document.mime_type.startswith('video'):
                return 'video'
            elif message.media.document.mime_type.startswith('audio'):
                return 'audio'
            else:
                return 'document'
        else:
            return 'other'
    
    def _parse_media_metadata(self, message: Message) -> Optional[Dict[str, Any]]:
        """Parse media metadata"""
        if not message.media:
            return None
        
        metadata = {}
        
        if isinstance(message.media, MessageMediaPhoto):
            metadata['type'] = 'photo'
            
        elif isinstance(message.media, MessageMediaDocument):
            doc = message.media.document
            metadata['type'] = 'document'
            metadata['mime_type'] = doc.mime_type
            metadata['size'] = doc.size
            
            # Get attributes
            for attr in doc.attributes:
                if hasattr(attr, 'duration'):
                    metadata['duration'] = attr.duration
                if hasattr(attr, 'w') and hasattr(attr, 'h'):
                    metadata['width'] = attr.w
                    metadata['height'] = attr.h
                if hasattr(attr, 'file_name'):
                    metadata['file_name'] = attr.file_name
        
        return metadata if metadata else None
    
    def _parse_forward_info(self, message: Message) -> Optional[Dict[str, Any]]:
        """Parse forward information"""
        if not message.fwd_from:
            return None
        
        fwd = message.fwd_from
        return {
            'date': fwd.date,
            'from_id': fwd.from_id.user_id if fwd.from_id else None,
            'from_name': fwd.from_name,
            'channel_id': fwd.channel_id if hasattr(fwd, 'channel_id') else None,
            'post_id': fwd.channel_post if hasattr(fwd, 'channel_post') else None
        }