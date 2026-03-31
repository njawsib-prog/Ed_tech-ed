import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { supabaseAdmin } from '../db/supabaseAdmin';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

interface LoginRequest {
  email: string;
  password: string;
  totp_code?: string;
}

/**
 * Super Admin Login
 * POST /api/auth/super-admin/login
 */
export const superAdminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, totp_code } = req.body as LoginRequest;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('role', 'super_admin')
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if active
    if (!user.is_active) {
      res.status(403).json({ error: 'Account is deactivated' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check 2FA if enabled
    if (user.totp_enabled) {
      if (!totp_code) {
        res.status(200).json({ 
          message: '2FA required', 
          requires2FA: true,
          email: user.email 
        });
        return;
      }

      const isValidTotp = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: totp_code,
        window: 1,
      });

      if (!isValidTotp) {
        res.status(401).json({ error: 'Invalid 2FA code' });
        return;
      }
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Super admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Branch Admin Login
 * POST /api/auth/admin/login
 */
export const branchAdminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, totp_code } = req.body as LoginRequest;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user with branch info
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        admins!inner(id, name, branch_id)
      `)
      .eq('email', email.toLowerCase())
      .eq('role', 'branch_admin')
      .single();

    if (error || !user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ error: 'Account is deactivated' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check 2FA
    if (user.totp_enabled) {
      if (!totp_code) {
        res.status(200).json({ 
          message: '2FA required', 
          requires2FA: true,
          email: user.email 
        });
        return;
      }

      const isValidTotp = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: totp_code,
        window: 1,
      });

      if (!isValidTotp) {
        res.status(401).json({ error: 'Invalid 2FA code' });
        return;
      }
    }

    // Generate JWT with branch_id
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        branch_id: user.admins[0].branch_id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        branch_id: user.admins[0].branch_id,
        name: user.admins[0].name,
      },
    });
  } catch (error) {
    console.error('Branch admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Student Login
 * POST /api/auth/student/login
 */
export const studentLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { student_code, password } = req.body;

    if (!student_code || !password) {
      res.status(400).json({ error: 'Student code and password are required' });
      return;
    }

    // Find student by code
    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        users!inner(id, email, password_hash, is_active)
      `)
      .eq('student_code', student_code.toUpperCase())
      .single();

    if (error || !student) {
      res.status(401).json({ error: 'Invalid student code or password' });
      return;
    }

    if (!student.users.is_active || student.status !== 'active') {
      res.status(403).json({ error: 'Account is not active' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, student.users.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid student code or password' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: student.users.id,
        email: student.users.email,
        role: 'student',
        branch_id: student.branch_id,
        student_id: student.id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', student.users.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      message: 'Login successful',
      user: {
        id: student.users.id,
        student_id: student.id,
        name: student.name,
        student_code: student.student_code,
        role: 'student',
        branch_id: student.branch_id,
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Logout
 * POST /api/auth/logout
 */
export const logout = (req: Request, res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
  });
  res.json({ message: 'Logged out successfully' });
};

/**
 * Get Current User
 * GET /api/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let userData = null;

    if (req.user.role === 'super_admin') {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id, email, role, created_at')
        .eq('id', req.user.id)
        .single();
      userData = data;
    } else if (req.user.role === 'branch_admin') {
      const { data } = await supabaseAdmin
        .from('users')
        .select(`
          id, email, role,
          admins(name, phone, branch_id, branches(id, name, location))
        `)
        .eq('id', req.user.id)
        .single();
      userData = data;
    } else if (req.user.role === 'student') {
      const { data } = await supabaseAdmin
        .from('students')
        .select(`
          id, name, student_code, status, photo_url,
          users(email),
          branches(id, name),
          courses(id, title)
        `)
        .eq('id', req.user.student_id)
        .single();
      userData = data;
    }

    res.json({ user: userData });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
};

/**
 * Setup 2FA
 * POST /api/auth/2fa/setup
 */
export const setup2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const secret = speakeasy.generateSecret({
      name: `EdTech (${req.user.email})`,
      length: 20,
    });

    // Store secret temporarily (not enabled until verified)
    await supabaseAdmin
      .from('users')
      .update({ totp_secret: secret.base32 })
      .eq('id', req.user.id);

    res.json({
      message: '2FA setup initiated',
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
};

/**
 * Verify and Enable 2FA
 * POST /api/auth/2fa/verify
 */
export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { totp_code } = req.body;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('totp_secret')
      .eq('id', req.user.id)
      .single();

    if (!user?.totp_secret) {
      res.status(400).json({ error: '2FA not set up' });
      return;
    }

    const isValid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: totp_code,
      window: 1,
    });

    if (!isValid) {
      res.status(401).json({ error: 'Invalid 2FA code' });
      return;
    }

    // Enable 2FA
    await supabaseAdmin
      .from('users')
      .update({ totp_enabled: true })
      .eq('id', req.user.id);

    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
};

export default {
  superAdminLogin,
  branchAdminLogin,
  studentLogin,
  logout,
  getCurrentUser,
  setup2FA,
  verify2FA,
};