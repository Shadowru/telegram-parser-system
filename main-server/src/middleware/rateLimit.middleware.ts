// src/middleware/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';

// General API rate limiter
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter (stricter)
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many login attempts, please try again later',
  },
  skipSuccessfulRequests: true,
});

// Create channel rate limiter
export const createChannelLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:create:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit to 10 channel creations per hour
  message: {
    error: 'Too Many Requests',
    message: 'Too many channels created, please try again later',
  },
});