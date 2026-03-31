import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

// Get all complaints with filtering
export const getComplaints = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      category,
      studentId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const branchId = req.user!.branch_id;

    let query = supabaseAdmin
      .from('complaints')
      .select(`
        id,
        title,
        description,
        category,
        status,
        priority,
        isAnonymous,
        createdAt,
        updatedAt,
        resolvedAt,
        student:students(id, name, enrollmentNumber),
        assignedTo:users(id, name),
        responses:complaint_responses(count)
      `, { count: 'exact' })
      .eq('branchId', branchId);

    // Apply filters
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (category) query = query.eq('category', category);
    if (studentId) query = query.eq('studentId', studentId);

    // Apply sorting
    query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: complaints, error, count } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      complaints,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get complaint by ID with full details
export const getComplaintById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branch_id;

    const { data: complaint, error } = await supabaseAdmin
      .from('complaints')
      .select(`
        id,
        title,
        description,
        category,
        status,
        priority,
        isAnonymous,
        attachments,
        createdAt,
        updatedAt,
        resolvedAt,
        student:students(id, name, enrollmentNumber, email),
        assignedTo:users(id, name, email),
        responses:complaint_responses(
          id,
          message,
          createdAt,
          responder:users(id, name, role)
        )
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (error || !complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    res.json(complaint);
  } catch (error) {
    console.error('Get complaint by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create complaint (student or admin on behalf)
export const createComplaint = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      category,
      priority = 'medium',
      studentId,
      isAnonymous = false,
      attachments = []
    } = req.body;

    const branchId = req.user!.branch_id;
    const userId = req.user!.id;

    // If student creating their own complaint
    let actualStudentId = studentId;
    if (!studentId && req.user!.role === 'student') {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('userId', userId)
        .single();
      actualStudentId = student?.id;
    }

    const { data: complaint, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        branchId,
        studentId: isAnonymous ? null : actualStudentId,
        title,
        description,
        category,
        priority,
        status: 'open',
        isAnonymous,
        attachments
      })
      .select(`
        id,
        title,
        status,
        createdAt
      `)
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Create notification for branch admins
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('branchId', branchId)
      .in('role', ['admin', 'super_admin']);

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin) => ({
        userId: admin.id,
        branchId,
        type: 'complaint',
        title: 'New Complaint Submitted',
        message: `A new ${priority} priority complaint has been submitted: ${title}`,
        data: { complaintId: complaint.id }
      }));

      await supabaseAdmin.from('notifications').insert(notifications);
    }

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update complaint status/priority
export const updateComplaint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo } = req.body;
    const branchId = req.user!.branch_id;

    // Get current complaint
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'resolved') {
        updateData.resolvedAt = new Date().toISOString();
      }
    }
    if (priority) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    updateData.updatedAt = new Date().toISOString();

    const { data: complaint, error } = await supabaseAdmin
      .from('complaints')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Notify student if not anonymous
    if (existing.studentId && status && status !== existing.status) {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('userId')
        .eq('id', existing.studentId)
        .single();

      if (student?.userId) {
        await supabaseAdmin.from('notifications').insert({
          userId: student.userId,
          branchId,
          type: 'complaint_update',
          title: 'Complaint Status Updated',
          message: `Your complaint "${existing.title}" status has been updated to ${status}`,
          data: { complaintId: id }
        });
      }
    }

    res.json({
      message: 'Complaint updated successfully',
      complaint
    });
  } catch (error) {
    console.error('Update complaint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add response to complaint
export const addComplaintResponse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const branchId = req.user!.branch_id;
    const userId = req.user!.id;

    if (!message) {
      res.status(400).json({ error: 'Response message is required' });
      return;
    }

    // Verify complaint exists
    const { data: complaint, error: complaintError } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (complaintError || !complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    // Create response
    const { data: response, error } = await supabaseAdmin
      .from('complaint_responses')
      .insert({
        complaintId: id,
        responderId: userId,
        message
      })
      .select(`
        id,
        message,
        createdAt,
        responder:users(id, name, role)
      `)
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Update complaint timestamp
    await supabaseAdmin
      .from('complaints')
      .update({ updatedAt: new Date().toISOString() })
      .eq('id', id);

    // Notify student if not anonymous
    if (complaint.studentId) {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('userId')
        .eq('id', complaint.studentId)
        .single();

      if (student?.userId) {
        await supabaseAdmin.from('notifications').insert({
          userId: student.userId,
          branchId,
          type: 'complaint_response',
          title: 'New Response on Your Complaint',
          message: `A new response has been added to your complaint "${complaint.title}"`,
          data: { complaintId: id }
        });
      }
    }

    res.status(201).json({
      message: 'Response added successfully',
      response
    });
  } catch (error) {
    console.error('Add complaint response error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete complaint (admin only)
export const deleteComplaint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branch_id;

    // Delete responses first
    await supabaseAdmin
      .from('complaint_responses')
      .delete()
      .eq('complaintId', id);

    // Delete complaint
    const { error } = await supabaseAdmin
      .from('complaints')
      .delete()
      .eq('id', id)
      .eq('branchId', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Complaint deleted successfully' });
  } catch (error) {
    console.error('Delete complaint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get complaint statistics
export const getComplaintStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branch_id;

    // Get all complaints for stats
    const { data: complaints } = await supabaseAdmin
      .from('complaints')
      .select('status, priority, category, createdAt')
      .eq('branchId', branchId);

    const stats = {
      total: complaints?.length || 0,
      byStatus: {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0
      },
      byCategory: {} as Record<string, number>,
      averageResolutionTime: 0
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    complaints?.forEach((c: any) => {
      // Status count
      if (stats.byStatus[c.status as keyof typeof stats.byStatus] !== undefined) {
        stats.byStatus[c.status as keyof typeof stats.byStatus]++;
      }

      // Priority count
      if (stats.byPriority[c.priority as keyof typeof stats.byPriority] !== undefined) {
        stats.byPriority[c.priority as keyof typeof stats.byPriority]++;
      }

      // Category count
      if (c.category) {
        stats.byCategory[c.category] = (stats.byCategory[c.category] || 0) + 1;
      }
    });

    // Calculate average resolution time
    const { data: resolved } = await supabaseAdmin
      .from('complaints')
      .select('createdAt, resolvedAt')
      .eq('branchId', branchId)
      .eq('status', 'resolved')
      .not('resolvedAt', 'is', null);

    resolved?.forEach((c: any) => {
      if (c.resolvedAt) {
        const created = new Date(c.createdAt).getTime();
        const resolvedTime = new Date(c.resolvedAt).getTime();
        totalResolutionTime += (resolvedTime - created);
        resolvedCount++;
      }
    });

    if (resolvedCount > 0) {
      stats.averageResolutionTime = Math.round(totalResolutionTime / resolvedCount / (1000 * 60 * 60)); // in hours
    }

    res.json(stats);
  } catch (error) {
    console.error('Get complaint stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Bulk update complaints
export const bulkUpdateComplaints = async (req: Request, res: Response): Promise<void> => {
  try {
    const { complaintIds, status, priority, assignedTo } = req.body;
    const branchId = req.user!.branch_id;

    if (!complaintIds?.length) {
      res.status(400).json({ error: 'Complaint IDs are required' });
      return;
    }

    // Verify all complaints belong to branch
    const { data: existing } = await supabaseAdmin
      .from('complaints')
      .select('id')
      .in('id', complaintIds)
      .eq('branchId', branchId);

    if (existing?.length !== complaintIds.length) {
      res.status(400).json({ error: 'Some complaints not found' });
      return;
    }

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    if (status === 'resolved') {
      updateData.resolvedAt = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from('complaints')
      .update(updateData)
      .in('id', complaintIds);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Complaints updated successfully',
      updatedCount: complaintIds.length
    });
  } catch (error) {
    console.error('Bulk update complaints error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export complaints to CSV
export const exportComplaints = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, priority, startDate, endDate } = req.query;
    const branchId = req.user!.branch_id;

    let query = supabaseAdmin
      .from('complaints')
      .select(`
        title,
        description,
        category,
        status,
        priority,
        isAnonymous,
        createdAt,
        resolvedAt,
        student:students(name, enrollmentNumber),
        assignedTo:users(name)
      `)
      .eq('branchId', branchId);

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (startDate) query = query.gte('createdAt', startDate);
    if (endDate) query = query.lte('createdAt', endDate);

    const { data: complaints, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Generate CSV
    const headers = [
      'Title',
      'Description',
      'Category',
      'Status',
      'Priority',
      'Anonymous',
      'Student Name',
      'Enrollment Number',
      'Assigned To',
      'Created At',
      'Resolved At'
    ];

    const rows = complaints?.map((c: any) => [
      c.title,
      c.description?.replace(/"/g, '""') || '',
      c.category || '',
      c.status,
      c.priority,
      c.isAnonymous ? 'Yes' : 'No',
      c.student?.name || 'Anonymous',
      c.student?.enrollmentNumber || '',
      c.assignedTo?.name || '',
      c.createdAt ? new Date(c.createdAt).toISOString() : '',
      c.resolvedAt ? new Date(c.resolvedAt).toISOString() : ''
    ]);

    const csv = [
      headers.join(','),
      ...(rows?.map((row: string[]) => row.map(cell => `"${cell}"`).join(',')) || [])
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="complaints-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export complaints error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};