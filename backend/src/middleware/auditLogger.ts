import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../db/supabaseAdmin';

/**
 * Audit Logger Middleware
 * 
 * Automatically logs all mutating actions (POST, PUT, PATCH, DELETE) 
 * performed by admin users to the audit_logs table.
 */
export const auditLogger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Store original end function
  const originalEnd = res.end;
  const originalJson = res.json;

  // Override res.json to capture response
  res.json = function (body: unknown): Response {
    logAction();
    return originalJson.call(this, body);
  };

  // Override res.end to capture response
  res.end = function (chunk?: unknown, ...args: unknown[]): Response {
    logAction();
    return originalEnd.apply(this, [chunk, ...args] as Parameters<typeof originalEnd>);
  };

  async function logAction() {
    try {
      // Only log mutating methods and successful responses
      const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      const shouldLog = 
        mutatingMethods.includes(req.method) && 
        res.statusCode >= 200 && 
        res.statusCode < 400 &&
        req.user && 
        req.user.role !== 'student'; // Don't log student actions

      if (!shouldLog || !req.user) return;

      // Extract entity from path (e.g., /api/admin/students -> students)
      const pathParts = req.path.split('/').filter(Boolean);
      const entity = pathParts[2] || pathParts[1] || 'unknown';

      await supabaseAdmin.from('audit_logs').insert({
        user_id: req.user.id,
        branch_id: req.user.branch_id || null,
        action: req.method,
        entity: entity,
        entity_id: req.params?.id || req.body?.id || null,
        old_values: null, // Would need to fetch before update for full implementation
        new_values: req.method !== 'DELETE' ? req.body : null,
        ip_address: getClientIp(req),
        user_agent: req.headers['user-agent'] || null,
      });

    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't fail the request if logging fails
    }
  }

  next();
};

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'] as string;
  }
  return req.ip || 'unknown';
}

export default auditLogger;