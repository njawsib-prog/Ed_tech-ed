import { Router } from 'express';
import {
  superAdminLogin,
  branchAdminLogin,
  studentLogin,
  logout,
  getCurrentUser,
  setup2FA,
  verify2FA,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/authMiddleware';
import { loginRateLimiter, twoFactorRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// ============================================
// Public Routes (No Authentication Required)
// ============================================

// Super Admin Login
router.post('/super-admin/login', loginRateLimiter, superAdminLogin);

// Branch Admin Login
router.post('/admin/login', loginRateLimiter, branchAdminLogin);

// Student Login
router.post('/student/login', loginRateLimiter, studentLogin);

// ============================================
// Protected Routes (Authentication Required)
// ============================================

// Logout
router.post('/logout', authMiddleware, logout);

// Get Current User
router.get('/me', authMiddleware, getCurrentUser);

// 2FA Setup
router.post('/2fa/setup', authMiddleware, setup2FA);

// 2FA Verify
router.post('/2fa/verify', authMiddleware, twoFactorRateLimiter, verify2FA);

export default router;