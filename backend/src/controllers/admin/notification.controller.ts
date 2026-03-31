import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';
import { Queue, Worker, Job } from 'bullmq';
import { bullmqConnection } from '../../utils/redisClient';

// Notification queue for scheduled notifications
const notificationQueue = new Queue('notifications', {
  connection: bullmqConnection,
});

// Process notification jobs
new Worker('notifications', async (job: Job) => {
  const { type, recipientId, title, message, data } = job.data as {
    type: string;
    recipientId: string;
    title: string;
    message: string;
    data: Record<string, unknown>;
  };

  // Create notification record
  await supabaseAdmin
    .from('notifications')
    .insert({
      userId: recipientId,
      type,
      title,
      message,
      data,
      isRead: false
    });

  // In production, also send push notification, email, etc.
  console.log(`Notification sent to ${recipientId}: ${title}`);
}, { connection: bullmqConnection });

// Get all notifications (admin view)
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const branchId = req.user!.branch_id;

    let query = supabaseAdmin
      .from('notification_logs')
      .select(`
        id,
        type,
        title,
        message,
        recipientCount,
        status,
        scheduledAt,
        sentAt,
        createdAt,
        createdBy:users(id, name)
      `, { count: 'exact' })
      .eq('branchId', branchId);

    // Apply filters
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('createdAt', startDate);
    if (endDate) query = query.lte('createdAt', endDate);

    // Apply sorting
    query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: notifications, error, count } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      notifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Send notification
export const sendNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      type = 'announcement',
      title,
      message,
      recipientType, // 'all', 'batch', 'student', 'role'
      recipientIds,
      batchIds,
      scheduledAt,
      data = {}
    } = req.body;

    const branchId = req.user!.branch_id;
    const userId = req.user!.id;

    if (!title || !message) {
      res.status(400).json({ error: 'Title and message are required' });
      return;
    }

    // Get recipient list based on type
    let recipients: string[] = [];

    switch (recipientType) {
      case 'all':
        // Get all students in branch
        const { data: allStudents } = await supabaseAdmin
          .from('students')
          .select('userId')
          .eq('branchId', branchId);
        recipients = allStudents?.map((s: any) => s.userId).filter(Boolean) || [];
        break;

      case 'batch':
        // Get students from specified batches
        if (!batchIds?.length) {
          res.status(400).json({ error: 'Batch IDs required for batch recipients' });
          return;
        }
        const { data: batchStudents } = await supabaseAdmin
          .from('student_batches')
          .select('student:students(userId)')
          .in('batchId', batchIds);
        recipients = batchStudents?.map((bs: any) => bs.student?.userId).filter(Boolean) || [];
        break;

      case 'student':
        // Direct student IDs provided
        if (!recipientIds?.length) {
          res.status(400).json({ error: 'Recipient IDs required' });
          return;
        }
        recipients = recipientIds;
        break;

      case 'role':
        // Get users by role
        if (!recipientIds?.length) {
          res.status(400).json({ error: 'Role names required' });
          return;
        }
        const { data: roleUsers } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('branchId', branchId)
          .in('role', recipientIds);
        recipients = roleUsers?.map((u: any) => u.id) || [];
        break;

      default:
        res.status(400).json({ error: 'Invalid recipient type' });
        return;
    }

    if (recipients.length === 0) {
      res.status(400).json({ error: 'No recipients found' });
      return;
    }

    // Create notification log
    const { data: log, error: logError } = await supabaseAdmin
      .from('notification_logs')
      .insert({
        branchId,
        type,
        title,
        message,
        recipientCount: recipients.length,
        status: scheduledAt ? 'scheduled' : 'sent',
        scheduledAt,
        createdBy: userId
      })
      .select()
      .single();

    if (logError) {
      res.status(400).json({ error: logError.message });
      return;
    }

    // Send or schedule notifications
    if (scheduledAt) {
      // Schedule for later
      const delay = new Date(scheduledAt).getTime() - Date.now();
      
      await notificationQueue.add(
        'send',
        {
          type,
          recipientIds: recipients,
          title,
          message,
          data: { ...data, logId: log.id, branchId }
        },
        {
          delay: delay > 0 ? delay : 0,
          jobId: `notification:${log.id}`
        }
      );

      res.json({
        message: 'Notification scheduled successfully',
        log,
        recipientCount: recipients.length
      });
    } else {
      // Send immediately
      const notifications = recipients.map((recipientId) => ({
        userId: recipientId,
        branchId,
        type,
        title,
        message,
        data,
        isRead: false
      }));

      // Batch insert notifications
      const { error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        res.status(400).json({ error: insertError.message });
        return;
      }

      // Update log status
      await supabaseAdmin
        .from('notification_logs')
        .update({ status: 'sent', sentAt: new Date().toISOString() })
        .eq('id', log.id);

      res.json({
        message: 'Notification sent successfully',
        log,
        recipientCount: recipients.length
      });
    }
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get notification details
export const getNotificationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branch_id;

    const { data: notification, error } = await supabaseAdmin
      .from('notification_logs')
      .select(`
        id,
        type,
        title,
        message,
        recipientCount,
        status,
        scheduledAt,
        sentAt,
        createdAt,
        createdBy:users(id, name)
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (error || !notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json(notification);
  } catch (error) {
    console.error('Get notification by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Cancel scheduled notification
export const cancelNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branch_id;

    // Get notification
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('notification_logs')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (fetchError || !notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    if (notification.status !== 'scheduled') {
      res.status(400).json({ error: 'Only scheduled notifications can be cancelled' });
      return;
    }

    // Remove from queue
    const job = await notificationQueue.getJob(`notification:${id}`);
    if (job) {
      await job.remove();
    }

    // Update status
    const { error } = await supabaseAdmin
      .from('notification_logs')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Notification cancelled successfully' });
  } catch (error) {
    console.error('Cancel notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Send bulk notifications
export const sendBulkNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { notifications } = req.body;
    const branchId = req.user!.branch_id;
    const userId = req.user!.id;

    if (!notifications?.length) {
      res.status(400).json({ error: 'Notifications array is required' });
      return;
    }

    const results = [];

    for (const notif of notifications) {
      try {
        const { type, title, message, recipientIds, batchIds, scheduledAt } = notif;

        // Get recipients
        let recipients: string[] = [];

        if (recipientIds) {
          recipients = recipientIds;
        } else if (batchIds) {
          const { data: batchStudents } = await supabaseAdmin
            .from('student_batches')
            .select('student:students(userId)')
            .in('batchId', batchIds);
          recipients = batchStudents?.map((bs: any) => bs.student?.userId).filter(Boolean) || [];
        }

        if (recipients.length === 0) {
          results.push({ title, status: 'failed', error: 'No recipients' });
          continue;
        }

        // Create log
        const { data: log } = await supabaseAdmin
          .from('notification_logs')
          .insert({
            branchId,
            type: type || 'announcement',
            title,
            message,
            recipientCount: recipients.length,
            status: scheduledAt ? 'scheduled' : 'sent',
            scheduledAt,
            createdBy: userId
          })
          .select()
          .single();

        // Send notifications
        if (!scheduledAt) {
          const notifRecords = recipients.map((recipientId) => ({
            userId: recipientId,
            branchId,
            type: type || 'announcement',
            title,
            message,
            isRead: false
          }));

          await supabaseAdmin.from('notifications').insert(notifRecords);

          await supabaseAdmin
            .from('notification_logs')
            .update({ status: 'sent', sentAt: new Date().toISOString() })
            .eq('id', log?.id);
        }

        results.push({ title, status: 'success', recipientCount: recipients.length });
      } catch (err) {
        results.push({ title: notif.title, status: 'failed', error: String(err) });
      }
    }

    res.json({
      message: 'Bulk notifications processed',
      results,
      successCount: results.filter(r => r.status === 'success').length,
      failureCount: results.filter(r => r.status === 'failed').length
    });
  } catch (error) {
    console.error('Send bulk notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get notification templates
export const getNotificationTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branch_id;

    const { data: templates, error } = await supabaseAdmin
      .from('notification_templates')
      .select('*')
      .or(`branchId.eq.${branchId},isGlobal.eq.true`)
      .order('createdAt', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ templates });
  } catch (error) {
    console.error('Get notification templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create notification template
export const createNotificationTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, title, message, variables } = req.body;
    const branchId = req.user!.branch_id;

    const { data: template, error } = await supabaseAdmin
      .from('notification_templates')
      .insert({
        branchId,
        name,
        type,
        title,
        message,
        variables,
        isGlobal: false
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    console.error('Create notification template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update notification template
export const updateNotificationTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, title, message, variables } = req.body;
    const branchId = req.user!.branch_id;

    // Verify template belongs to branch (not global)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('notification_templates')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Template not found or is global' });
      return;
    }

    const { data: template, error } = await supabaseAdmin
      .from('notification_templates')
      .update({ name, type, title, message, variables })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    console.error('Update notification template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete notification template
export const deleteNotificationTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branch_id;

    const { error } = await supabaseAdmin
      .from('notification_templates')
      .delete()
      .eq('id', id)
      .eq('branchId', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete notification template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user notifications (for logged-in user)
export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('userId', userId);

    if (unreadOnly === 'true') {
      query = query.eq('isRead', false);
    }

    query = query
      .order('createdAt', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    const { data: notifications, error, count } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Get unread count
    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId)
      .eq('isRead', false);

    res.json({
      notifications,
      unreadCount: unreadCount || 0,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ isRead: true, readAt: new Date().toISOString() })
      .eq('id', id)
      .eq('userId', userId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark all as read
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ isRead: true, readAt: new Date().toISOString() })
      .eq('userId', userId)
      .eq('isRead', false);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};