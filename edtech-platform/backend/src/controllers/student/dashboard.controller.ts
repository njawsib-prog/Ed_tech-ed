import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface AuthRequest extends Request {
  user?: {
    id: string;
    branchId: string;
    role: string;
  };
}

// Get student dashboard data
export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const branchId = req.user!.branchId;

    // Get student details
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        name,
        enrollmentNumber,
        email,
        phone,
        avatarUrl,
        batch:batches(id, name),
        branch:branches(name, logo)
      `)
      .eq('userId', userId)
      .single();

    if (studentError || !student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Get upcoming tests
    const { data: upcomingTests } = await supabaseAdmin
      .from('test_assignments')
      .select(`
        test:tests(
          id,
          title,
          type,
          duration,
          totalMarks,
          scheduledStart,
          scheduledEnd
        )
      `)
      .eq('studentId', student.id)
      .gte('test.scheduledEnd', new Date().toISOString())
      .order('test.scheduledStart', { ascending: true })
      .limit(5);

    // Get recent results
    const { data: recentResults } = await supabaseAdmin
      .from('results')
      .select(`
        id,
        score,
        totalMarks,
        percentage,
        status,
        submittedAt,
        test:tests(id, title)
      `)
      .eq('studentId', student.id)
      .order('submittedAt', { ascending: false })
      .limit(5);

    // Get attendance stats
    const { data: attendanceData } = await supabaseAdmin
      .from('attendance')
      .select('status')
      .eq('studentId', student.id);

    const totalAttendance = attendanceData?.length || 0;
    const presentCount = attendanceData?.filter((a: any) => a.status === 'present').length || 0;

    // Get overall test stats
    const { data: resultsData } = await supabaseAdmin
      .from('results')
      .select('percentage, status')
      .eq('studentId', student.id);

    const totalTests = resultsData?.length || 0;
    const passedTests = resultsData?.filter((r: any) => r.status === 'passed').length || 0;
    const averageScore = resultsData && resultsData.length > 0
      ? resultsData.reduce((sum: number, r: any) => sum + (r.percentage || 0), 0) / resultsData.length
      : 0;

    // Get today's schedule
    const today = new Date().getDay();
    const { data: timetable } = await supabaseAdmin
      .from('student_batches')
      .select('batchId')
      .eq('studentId', student.id);

    const batchIds = timetable?.map((t: any) => t.batchId) || [];

    let todaySchedule: any[] = [];
    if (batchIds.length > 0) {
      const { data: scheduleData } = await supabaseAdmin
        .from('timetable_entries')
        .select(`
          startTime,
          endTime,
          room,
          subject:subjects(id, name, color),
          faculty:users(id, name)
        `)
        .in('timetableId', batchIds)
        .eq('dayOfWeek', today);

      todaySchedule = scheduleData || [];
    }

    // Get pending fees count
    const { data: pendingFees } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('studentId', student.id)
      .eq('status', 'pending');

    // Get unread notifications
    const { count: unreadNotifications } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId)
      .eq('isRead', false);

    res.json({
      student,
      stats: {
        attendanceRate: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0,
        totalTests,
        passedTests,
        passRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
        averageScore: Math.round(averageScore * 100) / 100,
        pendingFees: pendingFees?.length || 0,
        unreadNotifications: unreadNotifications || 0
      },
      upcomingTests: upcomingTests?.map((ta: any) => ta.test) || [],
      recentResults,
      todaySchedule
    });
  } catch (error) {
    console.error('Get student dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get student profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        name,
        enrollmentNumber,
        email,
        phone,
        avatarUrl,
        dob,
        gender,
        address,
        guardianName,
        guardianPhone,
        guardianEmail,
        enrollmentDate,
        batch:batches(id, name),
        branch:branches(id, name)
      `)
      .eq('userId', userId)
      .single();

    if (error || !student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json(student);
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update student profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { phone, address, avatarUrl } = req.body;

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('userId', userId)
      .single();

    if (studentError || !student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('students')
      .update({
        phone,
        address,
        avatarUrl
      })
      .eq('id', student.id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update student profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get student's upcoming tests
export const getUpcomingTests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get student
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('userId', userId)
      .single();

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const now = new Date().toISOString();

    const { data: tests, error } = await supabaseAdmin
      .from('test_assignments')
      .select(`
        id,
        test:tests(
          id,
          title,
          description,
          type,
          duration,
          totalMarks,
          passingMarks,
          scheduledStart,
          scheduledEnd,
          instructions,
          subject:subjects(id, name)
        )
      `)
      .eq('studentId', student.id)
      .gte('test.scheduledEnd', now)
      .order('test.scheduledStart', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ tests: tests?.map((ta: any) => ({
      assignmentId: ta.id,
      ...ta.test
    })) });
  } catch (error) {
    console.error('Get upcoming tests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get student's test history
export const getTestHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get student
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('userId', userId)
      .single();

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const { data: results, error, count } = await supabaseAdmin
      .from('results')
      .select(`
        id,
        score,
        totalMarks,
        percentage,
        rank,
        status,
        timeTaken,
        submittedAt,
        test:tests(
          id,
          title,
          type,
          subject:subjects(id, name)
        )
      `, { count: 'exact' })
      .eq('studentId', student.id)
      .order('submittedAt', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      results,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get test history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get student's attendance summary
export const getAttendanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { month, year } = req.query;

    // Get student
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('userId', userId)
      .single();

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Calculate date range
    const targetMonth = Number(month) || new Date().getMonth() + 1;
    const targetYear = Number(year) || new Date().getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const { data: attendance, error } = await supabaseAdmin
      .from('attendance')
      .select(`
        date,
        status,
        checkInTime,
        checkOutTime,
        subject:subjects(id, name)
      `)
      .eq('studentId', student.id)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Calculate summary
    const summary = {
      total: attendance?.length || 0,
      present: attendance?.filter((a: any) => a.status === 'present').length || 0,
      absent: attendance?.filter((a: any) => a.status === 'absent').length || 0,
      late: attendance?.filter((a: any) => a.status === 'late').length || 0
    };

    res.json({
      month: targetMonth,
      year: targetYear,
      attendance,
      summary,
      attendanceRate: summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get student's fee status
export const getFeeStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get student
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('userId', userId)
      .single();

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const { data: payments, error } = await supabaseAdmin
      .from('payments')
      .select(`
        id,
        amount,
        lateFee,
        totalAmount,
        status,
        paymentMethod,
        receiptNumber,
        paidAt,
        dueDate,
        feeMonth,
        feeYear
      `)
      .eq('studentId', student.id)
      .order('createdAt', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Calculate summary
    const summary = {
      totalPaid: payments?.filter((p: any) => p.status === 'completed')
        .reduce((sum: number, p: any) => sum + (p.totalAmount || 0), 0) || 0,
      totalPending: payments?.filter((p: any) => p.status === 'pending')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0,
      pendingCount: payments?.filter((p: any) => p.status === 'pending').length || 0
    };

    res.json({
      payments,
      summary
    });
  } catch (error) {
    console.error('Get fee status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get student's study materials
export const getStudyMaterials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { subjectId, type } = req.query;

    // Get student with batches
    const { data: student } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        batches:student_batches(batchId)
      `)
      .eq('userId', userId)
      .single();

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const batchIds = student.batches?.map((b: any) => b.batchId) || [];

    if (batchIds.length === 0) {
      res.json({ materials: [] });
      return;
    }

    // Get materials for student's batches
    let query = supabaseAdmin
      .from('study_materials')
      .select(`
        id,
        title,
        description,
        type,
        fileUrl,
        fileName,
        fileSize,
        downloadCount,
        createdAt,
        subject:subjects(id, name)
      `)
      .or(`isPublic.eq.true,batches.cs.{"batchIds":${JSON.stringify(batchIds)}}`);

    if (subjectId) query = query.eq('subjectId', subjectId);
    if (type) query = query.eq('type', type);

    query = query.order('createdAt', { ascending: false });

    const { data: materials, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ materials });
  } catch (error) {
    console.error('Get study materials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get student's timetable
export const getTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get student with batches
    const { data: student } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        batches:student_batches(
          batchId,
          batch:batches(
            id,
            name,
            timetable:timetables(
              id,
              name,
              isActive
            )
          )
        )
      `)
      .eq('userId', userId)
      .single();

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Get active timetables
    const timetables = student.batches
      ?.map((b: any) => b.batch?.timetable)
      .flat()
      .filter((t: any) => t?.isActive);

    if (!timetables || timetables.length === 0) {
      res.json({ timetable: null, entries: [] });
      return;
    }

    const timetableIds = timetables.map((t: any) => t.id);

    // Get entries
    const { data: entries, error } = await supabaseAdmin
      .from('timetable_entries')
      .select(`
        dayOfWeek,
        startTime,
        endTime,
        room,
        subject:subjects(id, name, color),
        faculty:users(id, name)
      `)
      .in('timetableId', timetableIds)
      .order('dayOfWeek')
      .order('startTime');

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Group by day
    const entriesByDay: Record<number, any[]> = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };

    entries?.forEach((entry: any) => {
      entriesByDay[entry.dayOfWeek].push(entry);
    });

    res.json({
      timetable: timetables[0],
      entries,
      entriesByDay
    });
  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};