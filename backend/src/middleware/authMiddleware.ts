import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  email: string;
  role: 'super_admin' | 'branch_admin' | 'student';
  branch_id?: string;
  student_id?: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get token from httpOnly cookie
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    
    // Attach user to request
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export default authMiddleware;