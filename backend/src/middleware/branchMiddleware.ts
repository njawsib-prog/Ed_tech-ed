import { Request, Response, NextFunction } from 'express';

/**
 * Branch Isolation Middleware
 * 
 * CRITICAL SECURITY MIDDLEWARE
 * This middleware enforces branch-level data isolation for branch_admin users.
 * It ensures that a branch admin can never access data belonging to another branch.
 * 
 * Security enforcement layers:
 * 1. JWT payload contains branch_id
 * 2. This middleware validates branch_id in request body/params
 * 3. Supabase RLS policies enforce at database level
 */
export const branchMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip for super_admin - they have global access
  if (req.user?.role === 'super_admin') {
    next();
    return;
  }

  // For branch_admin, enforce branch isolation
  if (req.user?.role === 'branch_admin') {
    const userBranchId = req.user.branch_id;

    if (!userBranchId) {
      res.status(403).json({ 
        error: 'Branch access not configured',
        code: 'NO_BRANCH_ASSIGNED'
      });
      return;
    }

    // Store branch_id in res.locals for controllers to use
    res.locals.branchId = userBranchId;

    // Validate branch_id in request body
    if (req.body?.branch_id && req.body.branch_id !== userBranchId) {
      res.status(403).json({ 
        error: 'Branch access denied',
        code: 'BRANCH_MISMATCH'
      });
      return;
    }

    // Validate branch_id in query params
    if (req.query?.branch_id && req.query.branch_id !== userBranchId) {
      res.status(403).json({ 
        error: 'Branch access denied',
        code: 'BRANCH_MISMATCH'
      });
      return;
    }

    // Validate branch_id in route params
    if (req.params?.branch_id && req.params.branch_id !== userBranchId) {
      res.status(403).json({ 
        error: 'Branch access denied',
        code: 'BRANCH_MISMATCH'
      });
      return;
    }

    // Override any branch_id in body with the user's branch_id for safety
    if (req.body) {
      req.body.branch_id = userBranchId;
    }
  }

  // For students, ensure they can only access their own data
  if (req.user?.role === 'student') {
    res.locals.studentId = req.user.student_id;
    res.locals.branchId = req.user.branch_id;
  }

  next();
};

/**
 * Helper function to get branch_id from request
 * Use this in controllers instead of accessing req.user.branch_id directly
 */
export function getBranchId(req: Request): string | undefined {
  return res.locals.branchId || req.user?.branch_id;
}

/**
 * Helper function to add branch_id filter to query objects
 */
export function addBranchFilter<T extends Record<string, unknown>>(
  query: T, 
  req: Request
): T & { branch_id: string } {
  const branchId = getBranchId(req);
  if (!branchId && req.user?.role !== 'super_admin') {
    throw new Error('Branch ID required for non-super-admin users');
  }
  return { ...query, branch_id: branchId! };
}

export default branchMiddleware;