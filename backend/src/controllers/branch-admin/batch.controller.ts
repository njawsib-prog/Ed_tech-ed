import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

interface AuthRequest extends Request {
  user?: {
    id: string;
    branchId: string;
    role: string;
  };
}

// Get all batches for branch
export const getBatches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;
    const { isActive, courseId } = req.query;

    let query = supabaseAdmin
      .from('batches')
      .select(`
        id,
        name,
        code,
        capacity,
        startDate,
        endDate,
        isActive,
        createdAt,
        course:courses(id, name),
        _count:students(id),
        faculty:users(id, name)
      `)
      .eq('branchId', branchId);

    if (isActive !== undefined) {
      query = query.eq('isActive', isActive === 'true');
    }

    if (courseId) {
      query = query.eq('courseId', courseId);
    }

    query = query.order('createdAt', { ascending: false });

    const { data: batches, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ batches });
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get batch by ID with details
export const getBatchById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const { data: batch, error } = await supabaseAdmin
      .from('batches')
      .select(`
        id,
        name,
        code,
        capacity,
        startDate,
        endDate,
        isActive,
        createdAt,
        course:courses(id, name),
        faculty:users(id, name, email),
        students:student_batches(
          student:students(
            id,
            name,
            enrollmentNumber,
            email,
            phone,
            avatarUrl
          )
        )
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (error || !batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Transform students
    const students = batch.students?.map((sb: any) => sb.student) || [];

    res.json({
      ...batch,
      students,
      studentCount: students.length
    });
  } catch (error) {
    console.error('Get batch by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new batch
export const createBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      code,
      courseId,
      facultyId,
      capacity,
      startDate,
      endDate,
      studentIds = []
    } = req.body;

    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Check if batch code exists
    const { data: existingBatch } = await supabaseAdmin
      .from('batches')
      .select('id')
      .eq('branchId', branchId)
      .eq('code', code)
      .single();

    if (existingBatch) {
      res.status(400).json({ error: 'Batch code already exists' });
      return;
    }

    // Create batch
    const { data: batch, error } = await supabaseAdmin
      .from('batches')
      .insert({
        branchId,
        name,
        code,
        courseId,
        facultyId,
        capacity,
        startDate,
        endDate,
        isActive: true,
        createdBy: userId
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Assign students if provided
    if (studentIds.length > 0) {
      const studentAssignments = studentIds.map((studentId: string) => ({
        batchId: batch.id,
        studentId
      }));

      await supabaseAdmin
        .from('student_batches')
        .insert(studentAssignments);
    }

    res.status(201).json({
      message: 'Batch created successfully',
      batch
    });
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update batch
export const updateBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, facultyId, capacity, startDate, endDate, isActive } = req.body;
    const branchId = req.user!.branchId;

    // Check if batch exists
    const { data: existingBatch, error: fetchError } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (fetchError || !existingBatch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Check code uniqueness if changing
    if (code && code !== existingBatch.code) {
      const { data: duplicateCode } = await supabaseAdmin
        .from('batches')
        .select('id')
        .eq('branchId', branchId)
        .eq('code', code)
        .neq('id', id)
        .single();

      if (duplicateCode) {
        res.status(400).json({ error: 'Batch code already exists' });
        return;
      }
    }

    const { data: batch, error } = await supabaseAdmin
      .from('batches')
      .update({
        name: name || existingBatch.name,
        code: code || existingBatch.code,
        facultyId: facultyId !== undefined ? facultyId : existingBatch.facultyId,
        capacity: capacity || existingBatch.capacity,
        startDate: startDate || existingBatch.startDate,
        endDate: endDate || existingBatch.endDate,
        isActive: isActive !== undefined ? isActive : existingBatch.isActive
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Batch updated successfully',
      batch
    });
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete batch
export const deleteBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    // Check for students in batch
    const { data: students } = await supabaseAdmin
      .from('student_batches')
      .select('id')
      .eq('batchId', id)
      .limit(1);

    if (students && students.length > 0) {
      res.status(400).json({ error: 'Cannot delete batch with students. Remove students first.' });
      return;
    }

    // Delete batch
    const { error } = await supabaseAdmin
      .from('batches')
      .delete()
      .eq('id', id)
      .eq('branchId', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Batch deleted successfully' });
  } catch (error) {
    console.error('Delete batch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add students to batch
export const addStudentsToBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { studentIds } = req.body;
    const branchId = req.user!.branchId;

    if (!studentIds?.length) {
      res.status(400).json({ error: 'Student IDs are required' });
      return;
    }

    // Verify batch exists
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select('id, capacity')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (batchError || !batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Check current count
    const { count: currentCount } = await supabaseAdmin
      .from('student_batches')
      .select('*', { count: 'exact', head: true })
      .eq('batchId', id);

    if (batch.capacity && (currentCount || 0) + studentIds.length > batch.capacity) {
      res.status(400).json({ error: 'Batch capacity exceeded' });
      return;
    }

    // Verify students exist and belong to branch
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id')
      .in('id', studentIds)
      .eq('branchId', branchId);

    if (studentsError || students?.length !== studentIds.length) {
      res.status(400).json({ error: 'Some students not found' });
      return;
    }

    // Create assignments (ignore duplicates)
    const assignments = studentIds.map((studentId: string) => ({
      batchId: id,
      studentId
    }));

    const { error } = await supabaseAdmin
      .from('student_batches')
      .upsert(assignments, { onConflict: 'ignore' });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Students added to batch successfully',
      addedCount: studentIds.length
    });
  } catch (error) {
    console.error('Add students to batch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove student from batch
export const removeStudentFromBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, studentId } = req.params;
    const branchId = req.user!.branchId;

    // Verify batch exists
    const { data: batch } = await supabaseAdmin
      .from('batches')
      .select('id')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (!batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('student_batches')
      .delete()
      .eq('batchId', id)
      .eq('studentId', studentId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Student removed from batch successfully' });
  } catch (error) {
    console.error('Remove student from batch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Transfer student between batches
export const transferStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { sourceBatchId, targetBatchId, reason } = req.body;
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Verify both batches exist
    const { data: batches } = await supabaseAdmin
      .from('batches')
      .select('id, capacity')
      .in('id', [sourceBatchId, targetBatchId])
      .eq('branchId', branchId);

    if (!batches || batches.length !== 2) {
      res.status(404).json({ error: 'One or both batches not found' });
      return;
    }

    const targetBatch = batches.find(b => b.id === targetBatchId);

    // Check target batch capacity
    if (targetBatch?.capacity) {
      const { count: targetCount } = await supabaseAdmin
        .from('student_batches')
        .select('*', { count: 'exact', head: true })
        .eq('batchId', targetBatchId);

      if ((targetCount || 0) >= targetBatch.capacity) {
        res.status(400).json({ error: 'Target batch is at capacity' });
        return;
      }
    }

    // Remove from source batch
    await supabaseAdmin
      .from('student_batches')
      .delete()
      .eq('batchId', sourceBatchId)
      .eq('studentId', studentId);

    // Add to target batch
    const { error } = await supabaseAdmin
      .from('student_batches')
      .insert({
        batchId: targetBatchId,
        studentId
      });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Log transfer
    await supabaseAdmin
      .from('student_transfers')
      .insert({
        studentId,
        sourceBatchId,
        targetBatchId,
        reason,
        transferredBy: userId
      });

    res.json({ message: 'Student transferred successfully' });
  } catch (error) {
    console.error('Transfer student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get batch statistics
export const getBatchStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;

    // Get all batches with counts
    const { data: batches } = await supabaseAdmin
      .from('batches')
      .select(`
        id,
        name,
        capacity,
        isActive,
        _count:students(id)
      `)
      .eq('branchId', branchId);

    // Get attendance summary
    const { data: attendanceStats } = await supabaseAdmin
      .from('attendance')
      .select('batchId, status')
      .eq('branchId', branchId);

    // Get test results summary
    const { data: resultsStats } = await supabaseAdmin
      .from('results')
      .select('batchId, status, percentage')
      .eq('branchId', branchId);

    // Calculate stats per batch
    const stats = batches?.map((batch: any) => {
      const batchAttendance = attendanceStats?.filter((a: any) => a.batchId === batch.id) || [];
      const batchResults = resultsStats?.filter((r: any) => r.batchId === batch.id) || [];

      const presentCount = batchAttendance.filter((a: any) => a.status === 'present').length;
      const totalAttendance = batchAttendance.length;
      const passCount = batchResults.filter((r: any) => r.status === 'passed').length;
      const totalResults = batchResults.length;

      return {
        id: batch.id,
        name: batch.name,
        capacity: batch.capacity,
        isActive: batch.isActive,
        studentCount: batch._count?.id || 0,
        attendanceRate: totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0,
        passRate: totalResults > 0 ? (passCount / totalResults) * 100 : 0,
        averageScore: totalResults > 0
          ? batchResults.reduce((sum: number, r: any) => sum + (r.percentage || 0), 0) / totalResults
          : 0
      };
    });

    res.json({ stats });
  } catch (error) {
    console.error('Get batch stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Promote batch (move to next level/course)
export const promoteBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newCourseId, newBatchName, promoteStudents = true } = req.body;
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Get current batch
    const { data: currentBatch, error: batchError } = await supabaseAdmin
      .from('batches')
      .select(`
        *,
        students:student_batches(studentId)
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (batchError || !currentBatch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Create new batch
    const { data: newBatch, error: createError } = await supabaseAdmin
      .from('batches')
      .insert({
        branchId,
        name: newBatchName || `${currentBatch.name} (Promoted)`,
        code: `${currentBatch.code}-P${Date.now().toString(36)}`,
        courseId: newCourseId || currentBatch.courseId,
        capacity: currentBatch.capacity,
        facultyId: currentBatch.facultyId,
        isActive: true,
        createdBy: userId
      })
      .select()
      .single();

    if (createError) {
      res.status(400).json({ error: createError.message });
      return;
    }

    // Move students to new batch
    if (promoteStudents && currentBatch.students?.length > 0) {
      const newAssignments = currentBatch.students.map((s: any) => ({
        batchId: newBatch.id,
        studentId: s.studentId
      }));

      await supabaseAdmin.from('student_batches').insert(newAssignments);
    }

    // Mark old batch as inactive
    await supabaseAdmin
      .from('batches')
      .update({ isActive: false })
      .eq('id', id);

    res.json({
      message: 'Batch promoted successfully',
      newBatch
    });
  } catch (error) {
    console.error('Promote batch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export batch students
export const exportBatchStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    // Get batch with students
    const { data: batch, error } = await supabaseAdmin
      .from('batches')
      .select(`
        name,
        code,
        students:student_batches(
          student:students(
            name,
            enrollmentNumber,
            email,
            phone,
            address,
            dob,
            gender
          )
        )
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (error || !batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Generate CSV
    const headers = [
      'Enrollment Number',
      'Name',
      'Email',
      'Phone',
      'Gender',
      'Date of Birth',
      'Address'
    ];

    const rows = batch.students?.map((sb: any) => {
      const s = sb.student;
      return [
        s.enrollmentNumber || '',
        s.name || '',
        s.email || '',
        s.phone || '',
        s.gender || '',
        s.dob || '',
        s.address || ''
      ];
    });

    const csv = [
      headers.join(','),
      ...(rows?.map((row: string[]) => row.map(cell => `"${cell}"`).join(',')) || [])
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${batch.name}-students.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export batch students error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};