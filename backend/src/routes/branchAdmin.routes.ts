import { Router } from 'express';
import { requireRole } from '../middleware/roleMiddleware';
import { branchMiddleware } from '../middleware/branchMiddleware';

// Import controllers
import * as paymentController from '../controllers/branch-admin/payment.controller';
import * as batchController from '../controllers/branch-admin/batch.controller';

const router = Router();

// All routes require admin role and branch access
router.use(requireRole('branch_admin', 'super_admin'));
router.use(branchMiddleware);

// ==================== PAYMENT ROUTES ====================
router.get('/payments', paymentController.getPaymentHistory);
router.get('/payments/pending', paymentController.getPendingFees);
router.post('/payments', paymentController.recordPayment);
router.get('/payments/:id/receipt', paymentController.generateReceiptPDF);
router.get('/payments/defaulters', paymentController.getFeeDefaulters);
router.post('/payments/remind', paymentController.sendPaymentReminder);
router.get('/payments/stats', paymentController.getPaymentStats);

// ==================== BATCH ROUTES ====================
router.get('/batches', batchController.getBatches);
router.get('/batches/stats', batchController.getBatchStats);
router.get('/batches/:id', batchController.getBatchById);
router.post('/batches', batchController.createBatch);
router.put('/batches/:id', batchController.updateBatch);
router.delete('/batches/:id', batchController.deleteBatch);
router.post('/batches/:id/students', batchController.addStudentsToBatch);
router.delete('/batches/:id/students/:studentId', batchController.removeStudentFromBatch);
router.post('/students/:studentId/transfer', batchController.transferStudent);
router.post('/batches/:id/promote', batchController.promoteBatch);
router.get('/batches/:id/export', batchController.exportBatchStudents);

export default router;