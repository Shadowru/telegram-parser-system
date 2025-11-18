// src/app.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { register } from 'prom-client';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/error.middleware';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';

// Routes
import authRoutes from './routes/auth.routes';
import channelsRoutes from './routes/channels.routes';
import jobsRoutes from './routes/jobs.routes';
import workersRoutes from './routes/workers.routes';
import analyticsRoutes from './routes/analytics.routes';

// Services
import { SchedulerService } from './services/scheduler.service';

class App {
  public app: Application;
  private schedulerService: SchedulerService;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim())
      }
    }));

    // Request ID
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.id = Math.random().toString(36).substring(7);
      res.setHeader('X-Request-ID', req.id);
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/channels', channelsRoutes);
    this.app.use('/api/jobs', jobsRoutes);
    this.app.use('/api/workers', workersRoutes);
    this.app.use('/api/analytics', analyticsRoutes);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async initialize(): Promise<void> {
    try {
      // Connect to database
      await connectDatabase();
      logger.info('Database connected');

      // Connect to Redis
      await connectRedis();
      logger.info('Redis connected');

      // Initialize scheduler
      this.schedulerService = new SchedulerService();
      await this.schedulerService.start();
      logger.info('Scheduler started');

    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down application...');
    
    if (this.schedulerService) {
      await this.schedulerService.stop();
    }

    // Close database connections, etc.
    process.exit(0);
  }

  public listen(port: number): void {
    this.app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });
  }
}

// Start server
const app = new App();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.initialize()
  .then(() => {
    app.listen(PORT);
  })
  .catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => app.shutdown());
process.on('SIGINT', () => app.shutdown());

export default app;