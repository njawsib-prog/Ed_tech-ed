import { Router } from 'express';
import { requireRole } from '../middleware/roleMiddleware';
import { branchMiddleware } from '../middleware/branchMiddleware';
import * as dashboardController from '../controllers/student/dashboard.controller';
import * as testEngineController from '../controllers/student/testEngine.controller';
import * as notificationController from '../controllers/admin/notification.controller';

const router = Router();

// All routes require student role
router.use(requireRole('student'));
router.use(branchMiddleware);

// ==================== DASHBOARD ROUTES ====================
router.get('/dashboard', dashboardController.getDashboard);
router.get('/profile', dashboardController.getProfile);
router.put('/profile', dashboardController.updateProfile);

// ==================== TEST ROUTES ====================
router.get('/tests/upcoming', dashboardController.getUpcomingTests);
router.get('/tests/history', dashboardController.getTestHistory);

// ==================== TEST ENGINE ROUTES ====================
router.post('/test/:testId/start', testEngineController.startTest);
router.post('/test/:testId/answer', testEngineController.saveAnswer);
router.get('/test/:testId/session', testEngineController.getSession);
router.post('/test/:testId/submit', testEngineController.submitTest);
router.post('/test/:testId/auto-submit', testEngineController.autoSubmit);
router.post('/test/:testId/flag', testEngineController.flagQuestion);
router.get('/result/:resultId', testEngineController.getTestResult);

// ==================== ATTENDANCE ROUTES ====================
router.get('/attendance', dashboardController.getAttendanceSummary);

// ==================== FEES ROUTES ====================
router.get('/fees', dashboardController.getFeeStatus);

// ==================== STUDY MATERIALS ====================
router.get('/materials', dashboardController.getStudyMaterials);

// ==================== TIMETABLE ====================
router.get('/timetable', dashboardController.getTimetable);

// ==================== NOTIFICATIONS ====================
router.get('/notifications', notificationController.getUserNotifications);
router.post('/notifications/:id/read', notificationController.markAsRead);
router.post('/notifications/read-all', notificationController.markAllAsRead);

export default router;