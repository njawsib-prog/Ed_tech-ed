import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { auditLogger } from '../middleware/auditLogger';
import dashboardController from '../controllers/super-admin/dashboard.controller';
import branchController from '../controllers/super-admin/branch.controller';
import paymentController from '../controllers/super-admin/payment.controller';
import courseController from '../controllers/super-admin/course.controller';
import studentController from '../controllers/super-admin/student.controller';

const router = Router();

// All routes require super_admin role
router.use(authMiddleware);
router.use(requireRole('super_admin'));
router.use(auditLogger);

// ============================================
// Dashboard Routes
// ============================================
router.get('/dashboard', dashboardController.getDashboardAnalytics);

// ============================================
// Branch Routes
// ============================================
router.get('/branches/compare', branchController.compareBranches);
router.get('/branches', branchController.getBranches);
router.post('/branches', branchController.createBranch);
router.patch('/branches/bulk', branchController.bulkBranchAction);
router.get('/branches/:id', branchController.getBranchById);
router.put('/branches/:id', branchController.updateBranch);

// ============================================
// Payment Routes
// ============================================
router.get('/payments/defaulters', paymentController.getDefaulters);
router.get('/payments', paymentController.getPayments);
router.patch('/payments/:id/verify', paymentController.verifyPayment);
router.get('/payments/:id/receipt', paymentController.generateReceipt);

// ============================================
// Course Routes
// ============================================
router.get('/courses', courseController.getCourses);
router.post('/courses', courseController.createCourse);
router.put('/courses/:id', courseController.updateCourse);
router.patch('/courses/:id/branches/:branchId', courseController.toggleCourseForBranch);

// ============================================
// Student Routes
// ============================================
router.get('/students/stats', studentController.getStudentStats);
router.get('/students', studentController.getStudents);

export default router;