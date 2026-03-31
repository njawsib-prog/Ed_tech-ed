import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';
import Redis from 'ioredis';
import crypto from 'crypto';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface AuthRequest extends Request {
  user?: {
    id: string;
    branchId: string;
    role: string;
  };
}

// QR Code expiration time (15 minutes)
const QR_EXPIRATION = 15 * 60;

// Generate QR code for attendance
export const generateQRCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { batchId, subjectId, duration = QR_EXPIRATION } = req.body;
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Verify batch belongs to branch
    if (batchId) {
      const { data: batch, error: batchError } = await supabaseAdmin
        .from('batches')
        .select('id')
        .eq('id', batchId)
        .eq('branchId', branchId)
        .single();

      if (batchError || !batch) {
        res.status(404).json({ error: 'Batch not found' });
        return;
      }
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const qrId = `qr:${branchId}:${token}`;

    // Store QR session in Redis
    const qrData = {
      branchId,
      batchId,
      subjectId,
      createdBy: userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (duration * 1000)
    };

    await redis.setex(qrId, duration, JSON.stringify(qrData));

    // Generate QR code data (URL that students will scan)
    const qrUrl = `${process.env.FRONTEND_URL}/student/attendance/mark?token=${token}&branch=${branchId}`;

    res.json({
      success: true,
      qrToken: token,
      qrUrl,
      expiresAt: new Date(Date.now() + (duration * 1000)).toISOString(),
      expiresIn: duration
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark attendance via QR scan (student)
export const markAttendanceViaQR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const studentId = req.user!.id;
    const branchId = req.user!.branchId;

    // Get QR session from Redis
    const qrId = `qr:${branchId}:${token}`;
    const qrDataStr = await redis.get(qrId);

    if (!qrDataStr) {
      res.status(400).json({ error: 'QR code expired or invalid' });
      return;
    }

    const qrData = JSON.parse(qrDataStr);

    // Check if student belongs to the batch (if batch specified)
    if (qrData.batchId) {
      const { data: studentBatch } = await supabaseAdmin
        .from('student_batches')
        .select('id')
        .eq('studentId', studentId)
        .eq('batchId', qrData.batchId)
        .single();

      if (!studentBatch) {
        res.status(403).json({ error: 'You are not assigned to this batch' });
        return;
      }
    }

    // Check for duplicate attendance today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingAttendance } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('studentId', studentId)
      .eq('branchId', branchId)
      .gte('date', today)
      .lt('date', new Date(today).getTime() + 24 * 60 * 60 * 1000);

    if (existingAttendance && existingAttendance.length > 0) {
      res.status(400).json({ error: 'Attendance already marked for today' });
      return;
    }

    // Record attendance
    const { data: attendance, error } = await supabaseAdmin
      .from('attendance')
      .insert({
        studentId,
        branchId,
        batchId: qrData.batchId,
        subjectId: qrData.subjectId,
        date: new Date().toISOString(),
        status: 'present',
        checkInTime: new Date().toISOString(),
        markedBy: qrData.createdBy,
        qrToken: token
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      attendance
    });
  } catch (error) {
    console.error('Mark attendance via QR error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Manual attendance marking (by admin/faculty)
export const markManualAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentIds, batchId, subjectId, date, status = 'present', notes } = req.body;
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    if (!studentIds?.length) {
      res.status(400).json({ error: 'Student IDs are required' });
      return;
    }

    const attendanceDate = date || new Date().toISOString().split('T')[0];

    // Create attendance records
    const attendanceRecords = studentIds.map((studentId: string) => ({
      studentId,
      branchId,
      batchId,
      subjectId,
      date: attendanceDate,
      status,
      markedBy: userId,
      notes
    }));

    // Upsert to handle existing records
    const { data: attendance, error } = await supabaseAdmin
      .from('attendance')
      .upsert(attendanceRecords, {
        onConflict: 'studentId,date,branchId',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      success: true,
      message: `Attendance marked for ${attendance.length} students`,
      attendance
    });
  } catch (error) {
    console.error('Mark manual attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get attendance records with filtering
export const getAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      batchId,
      studentId,
      subjectId,
      status,
      startDate,
      endDate,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const branchId = req.user!.branchId;

    let query = supabaseAdmin
      .from('attendance')
      .select(`
        id,
        date,
        status,
        checkInTime,
        checkOutTime,
        notes,
        createdAt,
        student:students(id, name, enrollmentNumber, avatarUrl),
        batch:batches(id, name),
        subject:subjects(id, name),
        markedByUser:users(id, name)
      `, { count: 'exact' })
      .eq('branchId', branchId);

    // Apply filters
    if (batchId) query = query.eq('batchId', batchId);
    if (studentId) query = query.eq('studentId', studentId);
    if (subjectId) query = query.eq('subjectId', subjectId);
    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    // Apply sorting
    query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: attendance, error, count } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      attendance,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get attendance summary for a batch
export const getBatchAttendanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const { month, year } = req.query;
    const branchId = req.user!.branchId;

    // Verify batch belongs to branch
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, name')
      .eq('id', batchId)
      .eq('branchId', branchId)
      .single();

    if (batchError || !batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Calculate date range
    const targetMonth = Number(month) || new Date().getMonth() + 1;
    const targetYear = Number(year) || new Date().getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    // Get all students in batch
    const { data: batchStudents } = await supabaseAdmin
      .from('student_batches')
      .select(`
        student:students(id, name, enrollmentNumber)
      `)
      .eq('batchId', batchId);

    // Get attendance for the month
    const { data: attendanceData } = await supabaseAdmin
      .from('attendance')
      .select('studentId, status, date')
      .eq('batchId', batchId)
      .eq('branchId', branchId)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    // Calculate summary per student
    const studentSummary: Record<string, {
      student: any;
      present: number;
      absent: number;
      late: number;
      total: number;
      percentage: number;
    }> = {};

    batchStudents?.forEach((bs: any) => {
      studentSummary[bs.student.id] = {
        student: bs.student,
        present: 0,
        absent: 0,
        late: 0,
        total: 0,
        percentage: 0
      };
    });

    attendanceData?.forEach((a: any) => {
      if (studentSummary[a.studentId]) {
        studentSummary[a.studentId].total++;
        if (a.status === 'present') studentSummary[a.studentId].present++;
        else if (a.status === 'absent') studentSummary[a.studentId].absent++;
        else if (a.status === 'late') studentSummary[a.studentId].late++;
      }
    });

    // Calculate percentages
    Object.keys(studentSummary).forEach(key => {
      const summary = studentSummary[key];
      summary.percentage = summary.total > 0
        ? Math.round((summary.present / summary.total) * 100)
        : 0;
    });

    res.json({
      batch,
      month: targetMonth,
      year: targetYear,
      totalDays: endDate.getDate(),
      summary: Object.values(studentSummary)
    });
  } catch (error) {
    console.error('Get batch attendance summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get student attendance history
export const getStudentAttendanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;
    const branchId = req.user!.branchId;

    let query = supabaseAdmin
      .from('attendance')
      .select(`
        id,
        date,
        status,
        checkInTime,
        checkOutTime,
        notes,
        batch:batches(id, name),
        subject:subjects(id, name)
      `)
      .eq('studentId', studentId)
      .eq('branchId', branchId)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data: attendance, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Calculate overall stats
    const stats = {
      total: attendance?.length || 0,
      present: attendance?.filter((a: any) => a.status === 'present').length || 0,
      absent: attendance?.filter((a: any) => a.status === 'absent').length || 0,
      late: attendance?.filter((a: any) => a.status === 'late').length || 0
    };

    res.json({
      attendance,
      stats,
      attendancePercentage: stats.total > 0
        ? Math.round((stats.present / stats.total) * 100)
        : 0
    });
  } catch (error) {
    console.error('Get student attendance history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update attendance record
export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, checkOutTime, notes } = req.body;
    const branchId = req.user!.branchId;

    // Verify attendance belongs to branch
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Attendance record not found' });
      return;
    }

    const { data: attendance, error } = await supabaseAdmin
      .from('attendance')
      .update({
        status: status || existing.status,
        checkOutTime: checkOutTime || existing.checkOutTime,
        notes: notes || existing.notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Attendance updated successfully',
      attendance
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Bulk update attendance
export const bulkUpdateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { attendanceIds, status } = req.body;
    const branchId = req.user!.branchId;

    if (!attendanceIds?.length) {
      res.status(400).json({ error: 'Attendance IDs are required' });
      return;
    }

    // Verify all records belong to branch
    const { data: existing } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .in('id', attendanceIds)
      .eq('branchId', branchId);

    if (existing?.length !== attendanceIds.length) {
      res.status(400).json({ error: 'Some attendance records not found' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({ status })
      .in('id', attendanceIds);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Attendance updated successfully',
      updatedCount: attendanceIds.length
    });
  } catch (error) {
    console.error('Bulk update attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export attendance to CSV
export const exportAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { batchId, startDate, endDate } = req.query;
    const branchId = req.user!.branchId;

    let query = supabaseAdmin
      .from('attendance')
      .select(`
        date,
        status,
        checkInTime,
        checkOutTime,
        notes,
        student:students(name, enrollmentNumber),
        batch:batches(name),
        subject:subjects(name)
      `)
      .eq('branchId', branchId);

    if (batchId) query = query.eq('batchId', batchId);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data: attendance, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Generate CSV
    const headers = [
      'Date',
      'Enrollment Number',
      'Student Name',
      'Batch',
      'Subject',
      'Status',
      'Check In',
      'Check Out',
      'Notes'
    ];

    const rows = attendance?.map((a: any) => [
      a.date ? new Date(a.date).toISOString().split('T')[0] : '',
      a.student?.enrollmentNumber || '',
      a.student?.name || '',
      a.batch?.name || '',
      a.subject?.name || '',
      a.status || '',
      a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString() : '',
      a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '',
      a.notes || ''
    ]);

    const csv = [
      headers.join(','),
      ...(rows?.map((row: string[]) => row.map(cell => `"${cell}"`).join(',')) || [])
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get active QR sessions
export const getActiveQRSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;

    // Scan for all QR sessions for this branch
    const keys = await redis.keys(`qr:${branchId}:*`);

    if (keys.length === 0) {
      res.json({ sessions: [] });
      return;
    }

    const sessions = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        const ttl = await redis.ttl(key);
        sessions.push({
          token: key.split(':')[2],
          ...parsed,
          remainingTime: ttl
        });
      }
    }

    res.json({ sessions });
  } catch (error) {
    console.error('Get active QR sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Cancel/expire QR session
export const cancelQRSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const branchId = req.user!.branchId;

    const qrId = `qr:${branchId}:${token}`;
    await redis.del(qrId);

    res.json({ message: 'QR session cancelled successfully' });
  } catch (error) {
    console.error('Cancel QR session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};