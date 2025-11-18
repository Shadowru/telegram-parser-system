// src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();
const authController = new AuthController();

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    validateRequest,
  ],
  authController.login.bind(authController)
);

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').isLength({ min: 2 }),
    validateRequest,
  ],
  authController.register.bind(authController)
);

// Logout
router.post(
  '/logout',
  authMiddleware,
  authController.logout.bind(authController)
);

// Get current user
router.get(
  '/me',
  authMiddleware,
  authController.getCurrentUser.bind(authController)
);

// Change password
router.post(
  '/change-password',
  authMiddleware,
  [
    body('currentPassword').isLength({ min: 6 }),
    body('newPassword').isLength({ min: 6 }),
    validateRequest,
  ],
  authController.changePassword.bind(authController)
);

export default router;