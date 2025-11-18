// src/config/redis.ts
import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    logger.error('Redis connection error:', err);
    return true;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redis.ping();
    logger.info('Redis connection established');
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

// Cache helper functions
export const cacheGet = async (key: string): Promise<any> => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: any,
  ttl: number = 3600
): Promise<void> => {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error:', error);
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error('Cache delete error:', error);
  }
};

export { redis };