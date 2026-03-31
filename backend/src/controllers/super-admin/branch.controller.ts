import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';
import bcrypt from 'bcrypt';

/**
 * Get all branches
 * GET /api/super-admin/branches
 */
export const getBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('branches')
      .select(`
        *,
        admins(name, email),
        students(count)
      `, { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%`);
    }

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const { data, error, count } = await query
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      branches: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
};

/**
 * Get branch by ID with detailed stats
 * GET /api/super-admin/branches/:id
 */
export const getBranchById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: branch, error } = await supabaseAdmin
      .from('branches')
      .select(`
        *,
        admins(id, name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (error || !branch) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    // Get branch stats
    const { count: studentsCount } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id)
      .eq('status', 'active');

    const { count: testsCount } = await supabaseAdmin
      .from('tests')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('branch_id', id)
      .eq('status', 'verified')
      .gte('payment_date', thisMonth.toISOString().split('T')[0]);

    const monthlyRevenue = payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;

    res.json({
      ...branch,
      stats: {
        studentsCount: studentsCount || 0,
        testsCount: testsCount || 0,
        monthlyRevenue,
      },
    });
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({ error: 'Failed to fetch branch' });
  }
};

/**
 * Create new branch
 * POST /api/super-admin/branches
 */
export const createBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, location, contact, email, admin_name, admin_email, admin_password } = req.body;

    if (!name || !admin_name || !admin_email || !admin_password) {
      res.status(400).json({ error: 'Branch name, admin name, email, and password are required' });
      return;
    }

    // Create branch
    const { data: branch, error: branchError } = await supabaseAdmin
      .from('branches')
      .insert({
        name,
        location,
        contact,
        email,
      })
      .select()
      .single();

    if (branchError) {
      res.status(400).json({ error: branchError.message });
      return;
    }

    // Create admin user
    const passwordHash = await bcrypt.hash(admin_password, 12);
    
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        email: admin_email.toLowerCase(),
        password_hash: passwordHash,
        role: 'branch_admin',
        branch_id: branch.id,
      })
      .select()
      .single();

    if (userError) {
      // Rollback branch creation
      await supabaseAdmin.from('branches').delete().eq('id', branch.id);
      res.status(400).json({ error: userError.message });
      return;
    }

    // Create admin profile
    const { error: adminError } = await supabaseAdmin
      .from('admins')
      .insert({
        user_id: user.id,
        branch_id: branch.id,
        name: admin_name,
      });

    if (adminError) {
      res.status(400).json({ error: adminError.message });
      return;
    }

    // Update branch with admin_user_id
    await supabaseAdmin
      .from('branches')
      .update({ admin_user_id: user.id })
      .eq('id', branch.id);

    res.status(201).json({
      message: 'Branch created successfully',
      branch,
      admin: {
        id: user.id,
        email: user.email,
        name: admin_name,
      },
    });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
};

/**
 * Update branch
 * PUT /api/super-admin/branches/:id
 */
export const updateBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, location, contact, email, is_active, settings } = req.body;

    const { data, error } = await supabaseAdmin
      .from('branches')
      .update({
        name,
        location,
        contact,
        email,
        is_active,
        settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Branch updated successfully', branch: data });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ error: 'Failed to update branch' });
  }
};

/**
 * Bulk action on branches
 * PATCH /api/super-admin/branches/bulk
 */
export const bulkBranchAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, action } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Branch IDs are required' });
      return;
    }

    if (!['activate', 'deactivate'].includes(action)) {
      res.status(400).json({ error: 'Invalid action. Use "activate" or "deactivate"' });
      return;
    }

    const is_active = action === 'activate';

    const { error } = await supabaseAdmin
      .from('branches')
      .update({ is_active, updated_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: `Successfully ${action}d ${ids.length} branch(es)`,
      affected: ids.length,
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({ error: 'Failed to perform bulk action' });
  }
};

/**
 * Compare branches
 * GET /api/super-admin/branches/compare
 */
export const compareBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.query;

    if (!ids || typeof ids !== 'string') {
      res.status(400).json({ error: 'Branch IDs are required as comma-separated values' });
      return;
    }

    const branchIds = ids.split(',').slice(0, 5); // Max 5 branches

    if (branchIds.length < 2) {
      res.status(400).json({ error: 'At least 2 branch IDs are required for comparison' });
      return;
    }

    const { data: branches, error } = await supabaseAdmin
      .from('branches')
      .select(`
        id,
        name,
        location,
        is_active,
        students(count),
        tests(count),
        payments(amount)
      `)
      .in('id', branchIds);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Get results for each branch
    const comparison = await Promise.all(
      branches.map(async (branch) => {
        const { data: results } = await supabaseAdmin
          .from('results')
          .select('score, total')
          .in('student_id', 
            (await supabaseAdmin
              .from('students')
              .select('id')
              .eq('branch_id', branch.id)
            ).data?.map(s => s.id) || []
          );

        const avgScore = results && results.length > 0
          ? results.reduce((acc, r) => acc + (r.score / r.total) * 100, 0) / results.length
          : 0;

        const totalRevenue = (branch.payments as { amount: number }[])?.reduce(
          (acc, p) => acc + Number(p.amount), 0
        ) || 0;

        return {
          id: branch.id,
          name: branch.name,
          location: branch.location,
          is_active: branch.is_active,
          studentsCount: (branch.students as { count: number }[])?.length || 0,
          testsCount: (branch.tests as { count: number }[])?.length || 0,
          totalRevenue,
          avgScore: Math.round(avgScore * 10) / 10,
        };
      })
    );

    res.json({ comparison });
  } catch (error) {
    console.error('Compare branches error:', error);
    res.status(500).json({ error: 'Failed to compare branches' });
  }
};

export default {
  getBranches,
  getBranchById,
  createBranch,
  updateBranch,
  bulkBranchAction,
  compareBranches,
};