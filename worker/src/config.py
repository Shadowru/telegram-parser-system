# worker/src/config.py
from pydantic_settings import BaseSettings
from typing import Optional
import os

class Config(BaseSettings):
    # Collector API
    COLLECTOR_API_URL: str
    WORKER_AUTH_TOKEN: str
    
    # Telegram API
    TELEGRAM_API_ID: int
    TELEGRAM_API_HASH: str
    TELEGRAM_PHONE: str
    
    # Worker Identity
    WORKER_ID: str = os.getenv('HOSTNAME', 'worker-1')
    WORKER_NAME: str = "Worker 1"
    WORKER_LOCATION: str = "Server A"
    
    # Performance Settings
    MAX_CONCURRENT_CHANNELS: int = 5
    MESSAGE_BATCH_SIZE: int = 50
    HEARTBEAT_INTERVAL: int = 30
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

config = Config()