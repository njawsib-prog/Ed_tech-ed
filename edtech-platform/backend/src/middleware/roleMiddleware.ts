import { Request, Response, NextFunction } from 'express';

type Role = 'super_admin' | 'branch_admin' | 'student';

/**
 * Factory function to create role-based middleware
 * Usage: app.get('/admin/data', requireRole('branch_admin'), handler)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role as Role;

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ 
        error: 'Access denied', 
        message: `This action requires one of: ${allowedRoles.join(', ')}`,
        code: 'FORBIDDEN'
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user has super_admin role
 */
export const requireSuperAdmin = requireRole('super_admin');

/**
 * Middleware to check if user has branch_admin role
 */
export const requireBranchAdmin = requireRole('branch_admin');

/**
 * Middleware to check if user has student role
 */
export const requireStudent = requireRole('student');

/**
 * Middleware to allow branch_admin or super_admin
 */
export const requireAdmin = requireRole('super_admin', 'branch_admin');

export default requireRole;