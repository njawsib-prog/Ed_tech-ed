import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

interface AuthRequest extends Request {
  user?: {
    id: string;
    branchId: string;
    role: string;
  };
}

// Get audit logs with filtering
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      entityType,
      userId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const branchId = req.user!.branchId;

    let query = supabaseAdmin
      .from('audit_logs')
      .select(`
        id,
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
        createdAt,
        user:users(id, name, email, role)
      `, { count: 'exact' })
      .eq('branchId', branchId);

    // Apply filters
    if (action) query = query.eq('action', action);
    if (entityType) query = query.eq('entityType', entityType);
    if (userId) query = query.eq('userId', userId);
    if (startDate) query = query.gte('createdAt', startDate);
    if (endDate) query = query.lte('createdAt', endDate);

    // Apply sorting
    query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: logs, error, count } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get audit log by ID
export const getAuditLogById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const { data: log, error } = await supabaseAdmin
      .from('audit_logs')
      .select(`
        id,
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
        createdAt,
        user:users(id, name, email, role)
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (error || !log) {
      res.status(404).json({ error: 'Audit log not found' });
      return;
    }

    res.json(log);
  } catch (error) {
    console.error('Get audit log by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get audit logs for a specific entity
export const getEntityAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { entityType, entityId } = req.params;
    const branchId = req.user!.branchId;

    const { data: logs, error } = await supabaseAdmin
      .from('audit_logs')
      .select(`
        id,
        action,
        oldValues,
        newValues,
        createdAt,
        user:users(id, name, email, role)
      `)
      .eq('branchId', branchId)
      .eq('entityType', entityType)
      .eq('entityId', entityId)
      .order('createdAt', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ logs });
  } catch (error) {
    console.error('Get entity audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get audit log statistics
export const getAuditLogStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get all logs for the period
    const { data: logs } = await supabaseAdmin
      .from('audit_logs')
      .select('action, entityType, createdAt')
      .eq('branchId', branchId)
      .gte('createdAt', startDate.toISOString());

    // Calculate stats
    const actionCounts: Record<string, number> = {};
    const entityTypeCounts: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};

    logs?.forEach((log: any) => {
      // Count by action
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;

      // Count by entity type
      entityTypeCounts[log.entityType] = (entityTypeCounts[log.entityType] || 0) + 1;

      // Count by day
      const day = new Date(log.createdAt).toISOString().split('T')[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });

    // Get most active users
    const { data: userActivity } = await supabaseAdmin
      .from('audit_logs')
      .select(`
        userId,
        user:users(name, email)
      `)
      .eq('branchId', branchId)
      .gte('createdAt', startDate.toISOString());

    const userCounts: Record<string, { name: string; email: string; count: number }> = {};
    userActivity?.forEach((log: any) => {
      if (log.userId) {
        if (!userCounts[log.userId]) {
          userCounts[log.userId] = {
            name: log.user?.name || 'Unknown',
            email: log.user?.email || '',
            count: 0
          };
        }
        userCounts[log.userId].count++;
      }
    });

    const topUsers = Object.entries(userCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      totalLogs: logs?.length || 0,
      byAction: actionCounts,
      byEntityType: entityTypeCounts,
      dailyActivity: Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topUsers
    });
  } catch (error) {
    console.error('Get audit log stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export audit logs
export const exportAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, action, entityType } = req.query;
    const branchId = req.user!.branchId;

    let query = supabaseAdmin
      .from('audit_logs')
      .select(`
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        ipAddress,
        createdAt,
        user:users(name, email, role)
      `)
      .eq('branchId', branchId);

    if (startDate) query = query.gte('createdAt', startDate);
    if (endDate) query = query.lte('createdAt', endDate);
    if (action) query = query.eq('action', action);
    if (entityType) query = query.eq('entityType', entityType);

    query = query.order('createdAt', { ascending: false }).limit(10000);

    const { data: logs, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Generate CSV
    const headers = [
      'Date',
      'Time',
      'Action',
      'Entity Type',
      'Entity ID',
      'User Name',
      'User Email',
      'User Role',
      'IP Address',
      'Old Values',
      'New Values'
    ];

    const rows = logs?.map((log: any) => {
      const date = new Date(log.createdAt);
      return [
        date.toISOString().split('T')[0],
        date.toTimeString().split(' ')[0],
        log.action,
        log.entityType,
        log.entityId,
        log.user?.name || '',
        log.user?.email || '',
        log.user?.role || '',
        log.ipAddress || '',
        log.oldValues ? JSON.stringify(log.oldValues).replace(/"/g, '""') : '',
        log.newValues ? JSON.stringify(log.newValues).replace(/"/g, '""') : ''
      ];
    });

    const csv = [
      headers.join(','),
      ...(rows?.map((row: string[]) => row.map(cell => `"${cell}"`).join(',')) || [])
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get available action types
export const getActionTypes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      actions: [
        { value: 'create', label: 'Create' },
        { value: 'update', label: 'Update' },
        { value: 'delete', label: 'Delete' },
        { value: 'login', label: 'Login' },
        { value: 'logout', label: 'Logout' },
        { value: 'export', label: 'Export' },
        { value: 'import', label: 'Import' },
        { value: 'assign', label: 'Assign' },
        { value: 'status_change', label: 'Status Change' }
      ]
    });
  } catch (error) {
    console.error('Get action types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get available entity types
export const getEntityTypes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      entityTypes: [
        { value: 'branch', label: 'Branch' },
        { value: 'user', label: 'User' },
        { value: 'student', label: 'Student' },
        { value: 'batch', label: 'Batch' },
        { value: 'test', label: 'Test' },
        { value: 'question', label: 'Question' },
        { value: 'result', label: 'Result' },
        { value: 'attendance', label: 'Attendance' },
        { value: 'material', label: 'Study Material' },
        { value: 'timetable', label: 'Timetable' },
        { value: 'payment', label: 'Payment' },
        { value: 'notification', label: 'Notification' },
        { value: 'complaint', label: 'Complaint' },
        { value: 'feedback', label: 'Feedback' },
        { value: 'settings', label: 'Settings' }
      ]
    });
  } catch (error) {
    console.error('Get entity types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};