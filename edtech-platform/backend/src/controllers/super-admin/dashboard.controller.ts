import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

/**
 * Get Global Dashboard Analytics
 * GET /api/super-admin/dashboard
 */
export const getDashboardAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get active branches count
    const { count: activeBranches } = await supabaseAdmin
      .from('branches')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get total students count
    const { count: totalStudents } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get new students this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const { count: newStudentsThisMonth } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thisMonth.toISOString());

    // Get tests completed this month
    const { count: testsCompleted } = await supabaseAdmin
      .from('results')
      .select('*', { count: 'exact', head: true })
      .gte('submitted_at', thisMonth.toISOString());

    // Get average performance
    const { data: avgData } = await supabaseAdmin
      .from('results')
      .select('score, total')
      .gte('submitted_at', thisMonth.toISOString());

    const avgAccuracy = avgData && avgData.length > 0
      ? avgData.reduce((acc, r) => acc + (r.score / r.total) * 100, 0) / avgData.length
      : 0;

    // Get total revenue this month
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'verified')
      .gte('payment_date', thisMonth.toISOString().split('T')[0]);

    const totalRevenue = payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;

    // Get attendance rate this month
    const { data: attendance } = await supabaseAdmin
      .from('attendance')
      .select('status')
      .gte('date', thisMonth.toISOString().split('T')[0]);

    const presentCount = attendance?.filter(a => a.status === 'present').length || 0;
    const attendanceRate = attendance && attendance.length > 0
      ? (presentCount / attendance.length) * 100
      : 0;

    // Get top performing branches
    const { data: branchResults } = await supabaseAdmin
      .from('results')
      .select(`
        score,
        total,
        students!inner(branch_id, branches!inner(id, name))
      `)
      .gte('submitted_at', thisMonth.toISOString());

    const branchPerformance: Record<string, { name: string; total: number; count: number }> = {};
    
    branchResults?.forEach((r: { score: number; total: number; students: { branch_id: string; branches: { id: string; name: string } } }) => {
      const branchId = r.students.branch_id;
      if (!branchPerformance[branchId]) {
        branchPerformance[branchId] = {
          name: r.students.branches.name,
          total: 0,
          count: 0,
        };
      }
      branchPerformance[branchId].total += (r.score / r.total) * 100;
      branchPerformance[branchId].count++;
    });

    const topBranches = Object.entries(branchPerformance)
      .map(([id, data]) => ({
        id,
        name: data.name,
        avgScore: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    // Get defaulter count
    const { count: defaulters } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('defaulter_flag', true);

    res.json({
      activeBranches: activeBranches || 0,
      totalStudents: totalStudents || 0,
      newStudentsThisMonth: newStudentsThisMonth || 0,
      testsCompleted: testsCompleted || 0,
      avgAccuracy: Math.round(avgAccuracy * 10) / 10,
      totalRevenue,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      topBranches,
      defaulters: defaulters || 0,
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
};

export default {
  getDashboardAnalytics,
};