import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

/**
 * Get all courses
 * GET /api/super-admin/courses
 */
export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, is_active } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('courses')
      .select(`
        *,
        modules(count),
        students(count)
      `, { count: 'exact' });

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data, error, count } = await query
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      courses: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

/**
 * Create course
 * POST /api/super-admin/courses
 */
export const createCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, duration_months, fee } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Course title is required' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('courses')
      .insert({
        title,
        description,
        duration_months,
        fee,
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ message: 'Course created successfully', course: data });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
};

/**
 * Update course
 * PUT /api/super-admin/courses/:id
 */
export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, duration_months, fee, is_active } = req.body;

    const { data, error } = await supabaseAdmin
      .from('courses')
      .update({
        title,
        description,
        duration_months,
        fee,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Course updated successfully', course: data });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
};

/**
 * Toggle course visibility for branch
 * PATCH /api/super-admin/courses/:id/branches/:branchId
 */
export const toggleCourseForBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, branchId } = req.params;
    const { is_visible } = req.body;

    // This would typically be stored in a branch_courses junction table
    // For simplicity, we'll update the branch settings
    const { data: branch } = await supabaseAdmin
      .from('branches')
      .select('settings')
      .eq('id', branchId)
      .single();

    const settings = branch?.settings || {};
    settings.hidden_courses = settings.hidden_courses || [];

    if (is_visible) {
      settings.hidden_courses = settings.hidden_courses.filter((c: string) => c !== id);
    } else {
      if (!settings.hidden_courses.includes(id)) {
        settings.hidden_courses.push(id);
      }
    }

    const { error } = await supabaseAdmin
      .from('branches')
      .update({ settings })
      .eq('id', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: `Course ${is_visible ? 'enabled' : 'disabled'} for branch` });
  } catch (error) {
    console.error('Toggle course error:', error);
    res.status(500).json({ error: 'Failed to toggle course' });
  }
};

export default {
  getCourses,
  createCourse,
  updateCourse,
  toggleCourseForBranch,
};