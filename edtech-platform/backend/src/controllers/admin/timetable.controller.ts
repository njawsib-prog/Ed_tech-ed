import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

interface AuthRequest extends Request {
  user?: {
    id: string;
    branchId: string;
    role: string;
  };
}

// Get timetables with filtering
export const getTimetables = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { batchId, isActive = true } = req.query;
    const branchId = req.user!.branchId;

    let query = supabaseAdmin
      .from('timetables')
      .select(`
        id,
        name,
        effectiveFrom,
        effectiveTo,
        isActive,
        createdAt,
        batch:batches(id, name)
      `)
      .eq('branchId', branchId)
      .eq('isActive', isActive === 'true' || isActive === true);

    if (batchId) {
      query = query.eq('batchId', batchId);
    }

    query = query.order('createdAt', { ascending: false });

    const { data: timetables, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ timetables });
  } catch (error) {
    console.error('Get timetables error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get full timetable with entries
export const getTimetableById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const { data: timetable, error: timetableError } = await supabaseAdmin
      .from('timetables')
      .select(`
        id,
        name,
        effectiveFrom,
        effectiveTo,
        isActive,
        createdAt,
        batch:batches(id, name)
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (timetableError || !timetable) {
      res.status(404).json({ error: 'Timetable not found' });
      return;
    }

    // Get timetable entries
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('timetable_entries')
      .select(`
        id,
        dayOfWeek,
        startTime,
        endTime,
        room,
        type,
        notes,
        subject:subjects(id, name, color),
        faculty:users(id, name)
      `)
      .eq('timetableId', id)
      .order('dayOfWeek', { ascending: true })
      .order('startTime', { ascending: true });

    if (entriesError) {
      res.status(400).json({ error: entriesError.message });
      return;
    }

    // Group by day
    const entriesByDay: Record<number, any[]> = {
      0: [], // Sunday
      1: [], // Monday
      2: [], // Tuesday
      3: [], // Wednesday
      4: [], // Thursday
      5: [], // Friday
      6: []  // Saturday
    };

    entries?.forEach((entry: any) => {
      entriesByDay[entry.dayOfWeek].push(entry);
    });

    res.json({
      timetable,
      entries,
      entriesByDay
    });
  } catch (error) {
    console.error('Get timetable by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create timetable
export const createTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { batchId, name, effectiveFrom, effectiveTo, entries } = req.body;
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Verify batch exists
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

    // Check for conflicts with existing active timetables
    const { data: existingTimetables } = await supabaseAdmin
      .from('timetables')
      .select('id, effectiveFrom, effectiveTo')
      .eq('batchId', batchId)
      .eq('branchId', branchId)
      .eq('isActive', true);

    if (existingTimetables && existingTimetables.length > 0) {
      // Deactivate existing timetables if overlapping
      for (const existing of existingTimetables) {
        if (
          (!effectiveTo || !existing.effectiveTo ||
           new Date(effectiveFrom) <= new Date(existing.effectiveTo)) &&
          new Date(effectiveTo) >= new Date(existing.effectiveFrom)
        ) {
          await supabaseAdmin
            .from('timetables')
            .update({ isActive: false })
            .eq('id', existing.id);
        }
      }
    }

    // Create timetable
    const { data: timetable, error } = await supabaseAdmin
      .from('timetables')
      .insert({
        branchId,
        batchId,
        name,
        effectiveFrom,
        effectiveTo,
        isActive: true,
        createdBy: userId
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Create entries if provided
    if (entries && entries.length > 0) {
      const entryRecords = entries.map((entry: any) => ({
        timetableId: timetable.id,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        subjectId: entry.subjectId,
        facultyId: entry.facultyId,
        room: entry.room,
        type: entry.type || 'lecture',
        notes: entry.notes
      }));

      const { error: entriesError } = await supabaseAdmin
        .from('timetable_entries')
        .insert(entryRecords);

      if (entriesError) {
        // Rollback timetable creation
        await supabaseAdmin.from('timetables').delete().eq('id', timetable.id);
        res.status(400).json({ error: entriesError.message });
        return;
      }
    }

    res.status(201).json({
      message: 'Timetable created successfully',
      timetable
    });
  } catch (error) {
    console.error('Create timetable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update timetable
export const updateTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, effectiveFrom, effectiveTo, isActive } = req.body;
    const branchId = req.user!.branchId;

    // Verify timetable exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('timetables')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Timetable not found' });
      return;
    }

    const { data: timetable, error } = await supabaseAdmin
      .from('timetables')
      .update({
        name: name || existing.name,
        effectiveFrom: effectiveFrom || existing.effectiveFrom,
        effectiveTo: effectiveTo || existing.effectiveTo,
        isActive: isActive !== undefined ? isActive : existing.isActive
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Timetable updated successfully',
      timetable
    });
  } catch (error) {
    console.error('Update timetable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete timetable
export const deleteTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    // Verify timetable exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('timetables')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Timetable not found' });
      return;
    }

    // Delete entries first
    await supabaseAdmin
      .from('timetable_entries')
      .delete()
      .eq('timetableId', id);

    // Delete timetable
    const { error } = await supabaseAdmin
      .from('timetables')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Timetable deleted successfully' });
  } catch (error) {
    console.error('Delete timetable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add entry to timetable
export const addTimetableEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, subjectId, facultyId, room, type, notes } = req.body;
    const branchId = req.user!.branchId;

    // Verify timetable exists
    const { data: timetable, error: timetableError } = await supabaseAdmin
      .from('timetables')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (timetableError || !timetable) {
      res.status(404).json({ error: 'Timetable not found' });
      return;
    }

    // Check for conflicts on the same day
    const { data: conflicts } = await supabaseAdmin
      .from('timetable_entries')
      .select('*')
      .eq('timetableId', id)
      .eq('dayOfWeek', dayOfWeek);

    const hasConflict = conflicts?.some((entry: any) => {
      const existingStart = entry.startTime;
      const existingEnd = entry.endTime;
      return (
        (startTime >= existingStart && startTime < existingEnd) ||
        (endTime > existingStart && endTime <= existingEnd) ||
        (startTime <= existingStart && endTime >= existingEnd)
      );
    });

    if (hasConflict) {
      res.status(400).json({ error: 'Time slot conflicts with existing entry' });
      return;
    }

    // Check faculty availability
    if (facultyId) {
      const { data: facultySchedule } = await supabaseAdmin
        .from('timetable_entries')
        .select(`
          *,
          timetable:timetables(branchId)
        `)
        .eq('facultyId', facultyId)
        .eq('dayOfWeek', dayOfWeek);

      const facultyConflict = facultySchedule?.some((entry: any) => {
        if (entry.timetable?.branchId !== branchId) return false;
        const existingStart = entry.startTime;
        const existingEnd = entry.endTime;
        return (
          (startTime >= existingStart && startTime < existingEnd) ||
          (endTime > existingStart && endTime <= existingEnd)
        );
      });

      if (facultyConflict) {
        res.status(400).json({ error: 'Faculty is not available during this time slot' });
        return;
      }
    }

    const { data: entry, error } = await supabaseAdmin
      .from('timetable_entries')
      .insert({
        timetableId: id,
        dayOfWeek,
        startTime,
        endTime,
        subjectId,
        facultyId,
        room,
        type: type || 'lecture',
        notes
      })
      .select(`
        id,
        dayOfWeek,
        startTime,
        endTime,
        room,
        type,
        notes,
        subject:subjects(id, name, color),
        faculty:users(id, name)
      `)
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({
      message: 'Entry added successfully',
      entry
    });
  } catch (error) {
    console.error('Add timetable entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update timetable entry
export const updateTimetableEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, entryId } = req.params;
    const { dayOfWeek, startTime, endTime, subjectId, facultyId, room, type, notes } = req.body;
    const branchId = req.user!.branchId;

    // Verify timetable exists
    const { data: timetable } = await supabaseAdmin
      .from('timetables')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (!timetable) {
      res.status(404).json({ error: 'Timetable not found' });
      return;
    }

    const { data: entry, error } = await supabaseAdmin
      .from('timetable_entries')
      .update({
        dayOfWeek,
        startTime,
        endTime,
        subjectId,
        facultyId,
        room,
        type,
        notes
      })
      .eq('id', entryId)
      .eq('timetableId', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Entry updated successfully',
      entry
    });
  } catch (error) {
    console.error('Update timetable entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete timetable entry
export const deleteTimetableEntry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, entryId } = req.params;
    const branchId = req.user!.branchId;

    // Verify timetable exists
    const { data: timetable } = await supabaseAdmin
      .from('timetables')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (!timetable) {
      res.status(404).json({ error: 'Timetable not found' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('timetable_entries')
      .delete()
      .eq('id', entryId)
      .eq('timetableId', id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete timetable entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get today's schedule for a batch
export const getTodaySchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const branchId = req.user!.branchId;

    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Get active timetable for batch
    const { data: timetable, error: timetableError } = await supabaseAdmin
      .from('timetables')
      .select('*')
      .eq('batchId', batchId)
      .eq('branchId', branchId)
      .eq('isActive', true)
      .lte('effectiveFrom', new Date().toISOString())
      .or(`effectiveTo.is.null,effectiveTo.gte.${new Date().toISOString()}`)
      .single();

    if (timetableError || !timetable) {
      res.json({ schedule: [], message: 'No active timetable found' });
      return;
    }

    // Get today's entries
    const { data: entries, error } = await supabaseAdmin
      .from('timetable_entries')
      .select(`
        id,
        startTime,
        endTime,
        room,
        type,
        notes,
        subject:subjects(id, name, color),
        faculty:users(id, name)
      `)
      .eq('timetableId', timetable.id)
      .eq('dayOfWeek', today)
      .order('startTime', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Determine current and upcoming classes
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const schedule = entries?.map((entry: any) => {
      let status = 'upcoming';
      if (currentTime >= entry.endTime) {
        status = 'completed';
      } else if (currentTime >= entry.startTime && currentTime < entry.endTime) {
        status = 'ongoing';
      }

      return {
        ...entry,
        status
      };
    });

    res.json({
      date: new Date().toISOString().split('T')[0],
      dayOfWeek: today,
      timetable,
      schedule
    });
  } catch (error) {
    console.error('Get today schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Copy timetable to another batch
export const copyTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { targetBatchId, name } = req.body;
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Get source timetable
    const { data: sourceTimetable, error: sourceError } = await supabaseAdmin
      .from('timetables')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (sourceError || !sourceTimetable) {
      res.status(404).json({ error: 'Source timetable not found' });
      return;
    }

    // Verify target batch
    const { data: targetBatch, error: targetError } = await supabaseAdmin
      .from('batches')
      .select('id')
      .eq('id', targetBatchId)
      .eq('branchId', branchId)
      .single();

    if (targetError || !targetBatch) {
      res.status(404).json({ error: 'Target batch not found' });
      return;
    }

    // Get source entries
    const { data: sourceEntries } = await supabaseAdmin
      .from('timetable_entries')
      .select('*')
      .eq('timetableId', id);

    // Create new timetable
    const { data: newTimetable, error: createError } = await supabaseAdmin
      .from('timetables')
      .insert({
        branchId,
        batchId: targetBatchId,
        name: name || `Copy of ${sourceTimetable.name}`,
        effectiveFrom: sourceTimetable.effectiveFrom,
        effectiveTo: sourceTimetable.effectiveTo,
        isActive: false,
        createdBy: userId
      })
      .select()
      .single();

    if (createError) {
      res.status(400).json({ error: createError.message });
      return;
    }

    // Copy entries
    if (sourceEntries && sourceEntries.length > 0) {
      const newEntries = sourceEntries.map((entry: any) => ({
        timetableId: newTimetable.id,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        subjectId: entry.subjectId,
        facultyId: entry.facultyId,
        room: entry.room,
        type: entry.type,
        notes: entry.notes
      }));

      await supabaseAdmin
        .from('timetable_entries')
        .insert(newEntries);
    }

    res.json({
      message: 'Timetable copied successfully',
      timetable: newTimetable
    });
  } catch (error) {
    console.error('Copy timetable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export timetable to PDF
export const exportTimetablePDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    // Get timetable with entries
    const { data: timetable, error: timetableError } = await supabaseAdmin
      .from('timetables')
      .select(`
        id,
        name,
        batch:batches(name)
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (timetableError || !timetable) {
      res.status(404).json({ error: 'Timetable not found' });
      return;
    }

    const { data: entries } = await supabaseAdmin
      .from('timetable_entries')
      .select(`
        dayOfWeek,
        startTime,
        endTime,
        room,
        subject:subjects(name),
        faculty:users(name)
      `)
      .eq('timetableId', id)
      .order('dayOfWeek')
      .order('startTime');

    // Format data for PDF export
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const formattedEntries = entries?.map((e: any) => ({
      day: days[e.dayOfWeek],
      time: `${e.startTime} - ${e.endTime}`,
      subject: e.subject?.name || 'N/A',
      faculty: e.faculty?.name || 'N/A',
      room: e.room || 'N/A'
    }));

    res.json({
      timetable,
      entries: formattedEntries,
      exportDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Export timetable PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};