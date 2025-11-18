// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Email and password are required',
        });
        return;
      }

      const result = await authService.login(email, password);

      if (!result) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
        return;
      }

      logger.info(`User logged in: ${email}`);

      res.json({
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Email, password, and name are required',
        });
        return;
      }

      const result = await authService.register(email, password, name);

      logger.info(`User registered: ${email}`);

      res.status(201).json({
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Invalidate token (if using token blacklist)
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        await authService.logout(token);
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      const user = await authService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Current and new passwords are required',
        });
        return;
      }

      const success = await authService.changePassword(
        userId,
        currentPassword,
        newPassword
      );

      if (!success) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid current password',
        });
        return;
      }

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }
}