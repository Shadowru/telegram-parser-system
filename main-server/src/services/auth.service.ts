// src/services/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface AuthResult {
  token: string;
  user: User;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_EXPIRES_IN = '7d';
  private readonly SALT_ROUNDS = 10;

  async login(email: string, password: string): Promise<AuthResult | null> {
    try {
      // Get user from database
      const result = await query(
        'SELECT id, email, name, password_hash, role FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return null;
      }

      // Generate token
      const token = this.generateToken(user);

      // Update last login
      await query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  async register(email: string, password: string, name: string): Promise<AuthResult> {
    try {
      // Check if user exists
      const existing = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existing.rows.length > 0) {
        throw new Error('User already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

      // Create user
      const result = await query(
        `INSERT INTO users (email, name, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, role`,
        [email, name, passwordHash, 'user']
      );

      const user = result.rows[0];

      // Generate token
      const token = this.generateToken(user);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      logger.error('Register error:', error);
      throw error;
    }
  }

  async logout(token: string): Promise<void> {
    try {
      // Add token to blacklist
      const decoded: any = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`blacklist:${token}`, ttl, '1');
        }
      }
    } catch (error) {
      logger.error('Logout error:', error);
    }
  }

  async getUserById(id: number): Promise<User | null> {
    try {
      const result = await query(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Get user error:', error);
      throw error;
    }
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    try {
      // Get current password hash
      const result = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      // Verify current password
      const isValid = await bcrypt.compare(
        currentPassword,
        result.rows[0].password_hash
      );

      if (!isValid) {
        return false;
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Update password
      await query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      return true;
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return null;
      }

      // Verify token
      const decoded: any = jwt.verify(token, this.JWT_SECRET);

      // Get user
      return await this.getUserById(decoded.userId);
    } catch (error) {
      return null;
    }
  }

  private generateToken(user: any): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }
}