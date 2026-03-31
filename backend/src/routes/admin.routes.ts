import { Router } from 'express';
import { requireRole } from '../middleware/roleMiddleware';
import { branchMiddleware } from '../middleware/branchMiddleware';

// Import controllers
import * as testController from '../controllers/admin/test.controller';
import * as resultsController from '../controllers/admin/results.controller';
import * as materialController from '../controllers/admin/material.controller';
import * as attendanceController from '../controllers/admin/attendance.controller';
import * as timetableController from '../controllers/admin/timetable.controller';
import * as notificationController from '../controllers/admin/notification.controller';
import * as complaintController from '../controllers/admin/complaint.controller';
import * as feedbackController from '../controllers/admin/feedback.controller';
import * as settingsController from '../controllers/admin/settings.controller';
import * as auditLogController from '../controllers/admin/auditLog.controller';

const router = Router();

// All routes require admin or super_admin role and branch access
router.use(requireRole('branch_admin', 'super_admin'));
router.use(branchMiddleware);

// ==================== TEST ROUTES ====================
router.get('/tests', testController.getTests);
router.get('/tests/:id', testController.getTestById);
router.post('/tests', testController.createTest);
router.put('/tests/:id', testController.updateTest);
router.delete('/tests/:id', testController.deleteTest);
router.post('/tests/:id/questions', testController.addQuestionsBulk);
router.post('/tests/:id/assign', testController.assignTest);
router.get('/tests/:id/analytics', testController.getTestAnalytics);
router.post('/tests/:id/duplicate', testController.duplicateTest);

// ==================== RESULTS ROUTES ====================
router.get('/results', resultsController.getResults);
router.get('/results/:id', resultsController.getResultById);
router.get('/results/test/:testId/leaderboard', resultsController.getLeaderboard);
router.get('/results/analytics', resultsController.getResultsAnalytics);
router.post('/results/:id/reevaluate', resultsController.reevaluateResult);
router.get('/results/export', resultsController.exportResults);

// ==================== STUDY MATERIAL ROUTES ====================
router.get('/materials', materialController.getMaterials);
router.get('/materials/:id', materialController.getMaterialById);
router.post('/materials', materialController.createMaterial);
router.put('/materials/:id', materialController.updateMaterial);
router.delete('/materials/:id', materialController.deleteMaterial);
router.post('/materials/:id/download', materialController.recordDownload);
router.post('/materials/bulk-assign', materialController.bulkAssignToBatches);
router.get('/materials/student/:studentId', materialController.getMaterialsForStudent);

// ==================== ATTENDANCE ROUTES ====================
router.post('/attendance/generate-qr', attendanceController.generateQRCode);
router.post('/attendance/mark-qr', attendanceController.markAttendanceViaQR);
router.post('/attendance/manual', attendanceController.markManualAttendance);
router.get('/attendance', attendanceController.getAttendance);
router.get('/attendance/batch/:batchId/summary', attendanceController.getBatchAttendanceSummary);
router.get('/attendance/student/:studentId/history', attendanceController.getStudentAttendanceHistory);
router.put('/attendance/:id', attendanceController.updateAttendance);
router.post('/attendance/bulk-update', attendanceController.bulkUpdateAttendance);
router.get('/attendance/export', attendanceController.exportAttendance);
router.get('/attendance/qr-sessions', attendanceController.getActiveQRSessions);
router.delete('/attendance/qr-sessions/:token', attendanceController.cancelQRSession);

// ==================== TIMETABLE ROUTES ====================
router.get('/timetables', timetableController.getTimetables);
router.get('/timetables/:id', timetableController.getTimetableById);
router.post('/timetables', timetableController.createTimetable);
router.put('/timetables/:id', timetableController.updateTimetable);
router.delete('/timetables/:id', timetableController.deleteTimetable);
router.post('/timetables/:id/entries', timetableController.addTimetableEntry);
router.put('/timetables/:id/entries/:entryId', timetableController.updateTimetableEntry);
router.delete('/timetables/:id/entries/:entryId', timetableController.deleteTimetableEntry);
router.get('/timetables/batch/:batchId/today', timetableController.getTodaySchedule);
router.post('/timetables/:id/copy', timetableController.copyTimetable);
router.get('/timetables/:id/export', timetableController.exportTimetablePDF);

// ==================== NOTIFICATION ROUTES ====================
router.get('/notifications', notificationController.getNotifications);
router.post('/notifications', notificationController.sendNotification);
router.get('/notifications/:id', notificationController.getNotificationById);
router.delete('/notifications/:id', notificationController.cancelNotification);
router.post('/notifications/bulk', notificationController.sendBulkNotifications);
router.get('/notification-templates', notificationController.getNotificationTemplates);
router.post('/notification-templates', notificationController.createNotificationTemplate);
router.put('/notification-templates/:id', notificationController.updateNotificationTemplate);
router.delete('/notification-templates/:id', notificationController.deleteNotificationTemplate);

// User notification routes
router.get('/user/notifications', notificationController.getUserNotifications);
router.post('/user/notifications/:id/read', notificationController.markAsRead);
router.post('/user/notifications/read-all', notificationController.markAllAsRead);

// ==================== COMPLAINT ROUTES ====================
router.get('/complaints', complaintController.getComplaints);
router.get('/complaints/:id', complaintController.getComplaintById);
router.post('/complaints', complaintController.createComplaint);
router.put('/complaints/:id', complaintController.updateComplaint);
router.post('/complaints/:id/responses', complaintController.addComplaintResponse);
router.delete('/complaints/:id', complaintController.deleteComplaint);
router.get('/complaints/stats', complaintController.getComplaintStats);
router.post('/complaints/bulk-update', complaintController.bulkUpdateComplaints);
router.get('/complaints/export', complaintController.exportComplaints);

// ==================== FEEDBACK ROUTES ====================
router.get('/feedback/forms', feedbackController.getFeedbackForms);
router.get('/feedback/forms/:id', feedbackController.getFeedbackFormById);
router.post('/feedback/forms', feedbackController.createFeedbackForm);
router.put('/feedback/forms/:id', feedbackController.updateFeedbackForm);
router.delete('/feedback/forms/:id', feedbackController.deleteFeedbackForm);
router.post('/feedback/responses', feedbackController.submitFeedbackResponse);
router.get('/feedback/forms/:formId/responses', feedbackController.getFeedbackResponses);
router.get('/feedback/forms/:formId/analytics', feedbackController.getFeedbackAnalytics);
router.get('/feedback/forms/:formId/export', feedbackController.exportFeedbackResponses);

// ==================== SETTINGS ROUTES ====================
router.get('/settings', settingsController.getBranchSettings);
router.put('/settings', settingsController.updateBranchSettings);
router.post('/settings/logo', settingsController.uploadBranchLogo);

// Subjects
router.get('/subjects', settingsController.getSubjects);
router.post('/subjects', settingsController.createSubject);
router.put('/subjects/:id', settingsController.updateSubject);
router.delete('/subjects/:id', settingsController.deleteSubject);

// Faculty
router.get('/faculty', settingsController.getFacultyList);
router.post('/faculty', settingsController.upsertFaculty);
router.delete('/faculty/:id', settingsController.removeFaculty);

// Holidays
router.get('/holidays', settingsController.getHolidays);
router.post('/holidays', settingsController.addHoliday);
router.delete('/holidays/:id', settingsController.deleteHoliday);

// Email templates
router.get('/email-templates', settingsController.getEmailTemplates);
router.put('/email-templates/:id', settingsController.updateEmailTemplate);

// ==================== AUDIT LOG ROUTES ====================
router.get('/audit-logs', auditLogController.getAuditLogs);
router.get('/audit-logs/:id', auditLogController.getAuditLogById);
router.get('/audit-logs/entity/:entityType/:entityId', auditLogController.getEntityAuditLogs);
router.get('/audit-logs/stats', auditLogController.getAuditLogStats);
router.get('/audit-logs/export', auditLogController.exportAuditLogs);
router.get('/audit-logs/action-types', auditLogController.getActionTypes);
router.get('/audit-logs/entity-types', auditLogController.getEntityTypes);

export default router;