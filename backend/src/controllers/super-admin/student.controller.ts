import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

/**
 * Get all students (cross-branch)
 * GET /api/super-admin/students
 */
export const getStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, branch_id, status, course_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('students')
      .select(`
        id,
        name,
        student_code,
        email,
        phone,
        status,
        defaulter_flag,
        enrollment_date,
        branches(id, name, location),
        courses(id, title)
      `, { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,student_code.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    const { data, error, count } = await query
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      students: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

/**
 * Get student statistics
 * GET /api/super-admin/students/stats
 */
export const getStudentStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { count: total } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true });

    const { count: active } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: inactive } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'inactive');

    const { count: suspended } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'suspended');

    const { count: defaulters } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('defaulter_flag', true);

    // New students this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    
    const { count: newThisMonth } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thisMonth.toISOString());

    res.json({
      total: total || 0,
      active: active || 0,
      inactive: inactive || 0,
      suspended: suspended || 0,
      defaulters: defaulters || 0,
      newThisMonth: newThisMonth || 0,
    });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({ error: 'Failed to fetch student statistics' });
  }
};

export default {
  getStudents,
  getStudentStats,
};