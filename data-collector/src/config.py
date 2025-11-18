# data-collector/src/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # API Settings
    API_PORT: int = 8000
    API_HOST: str = "0.0.0.0"
    
    # Database
    DATABASE_URL: str
    DB_POOL_SIZE: int = 20
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Queue Settings
    MAX_QUEUE_SIZE: int = 10000
    BATCH_SIZE: int = 100
    BATCH_TIMEOUT: float = 5.0
    
    # Authentication
    WORKER_AUTH_TOKEN: str
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    # Monitoring
    METRICS_ENABLED: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()