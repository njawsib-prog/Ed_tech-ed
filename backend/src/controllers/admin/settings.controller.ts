import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

interface AuthRequest extends Request {
  user?: {
    id: string;
    branchId: string;
    role: string;
  };
}

// Get branch settings
export const getBranchSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;

    const { data: settings, error } = await supabaseAdmin
      .from('branch_settings')
      .select('*')
      .eq('branchId', branchId)
      .single();

    if (error && error.code !== 'PGRST116') {
      res.status(400).json({ error: error.message });
      return;
    }

    // Return default settings if not configured
    const defaultSettings = {
      branchId,
      general: {
        instituteName: '',
        contactEmail: '',
        contactPhone: '',
        address: '',
        logo: null,
        timezone: 'Asia/Kolkata'
      },
      academic: {
        academicYearStart: 'April',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        defaultSessionDuration: 60,
        attendanceThreshold: 75
      },
      test: {
        defaultTestDuration: 60,
        questionShuffle: true,
        showResultsImmediately: true,
        allowRetake: false,
        negativeMarking: false,
        negativeMarkingValue: 0
      },
      notification: {
        emailNotifications: true,
        smsNotifications: false,
        reminderBeforeTest: 30,
        attendanceAlert: true
      },
      payment: {
        currency: 'INR',
        lateFeeAmount: 0,
        lateFeeType: 'fixed',
        dueDateDay: 10,
        enableOnlinePayment: false,
        razorpayKeyId: null
      },
      features: {
        testEngine: true,
        studyMaterial: true,
        attendance: true,
        timetable: true,
        feedback: true,
        complaints: true,
        notifications: true
      }
    };

    res.json(settings || defaultSettings);
  } catch (error) {
    console.error('Get branch settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update branch settings
export const updateBranchSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { general, academic, test, notification, payment, features } = req.body;
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Check if settings exist
    const { data: existing } = await supabaseAdmin
      .from('branch_settings')
      .select('id')
      .eq('branchId', branchId)
      .single();

    const settingsData = {
      branchId,
      general,
      academic,
      test,
      notification,
      payment,
      features,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    };

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('branch_settings')
        .update(settingsData)
        .eq('branchId', branchId)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      result = data;
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from('branch_settings')
        .insert(settingsData)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      result = data;
    }

    res.json({
      message: 'Settings updated successfully',
      settings: result
    });
  } catch (error) {
    console.error('Update branch settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get subjects for branch
export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;

    const { data: subjects, error } = await supabaseAdmin
      .from('subjects')
      .select('*')
      .eq('branchId', branchId)
      .order('name', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ subjects });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create subject
export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description, color } = req.body;
    const branchId = req.user!.branchId;

    const { data: subject, error } = await supabaseAdmin
      .from('subjects')
      .insert({
        branchId,
        name,
        code,
        description,
        color
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({
      message: 'Subject created successfully',
      subject
    });
  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update subject
export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, description, color, isActive } = req.body;
    const branchId = req.user!.branchId;

    const { data: subject, error } = await supabaseAdmin
      .from('subjects')
      .update({ name, code, description, color, isActive })
      .eq('id', id)
      .eq('branchId', branchId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Subject updated successfully',
      subject
    });
  } catch (error) {
    console.error('Update subject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete subject
export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    // Check if subject is in use
    const { data: tests } = await supabaseAdmin
      .from('tests')
      .select('id')
      .eq('subjectId', id)
      .limit(1);

    const { data: materials } = await supabaseAdmin
      .from('study_materials')
      .select('id')
      .eq('subjectId', id)
      .limit(1);

    if ((tests && tests.length > 0) || (materials && materials.length > 0)) {
      res.status(400).json({ error: 'Subject is in use and cannot be deleted' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('subjects')
      .delete()
      .eq('id', id)
      .eq('branchId', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get faculty list for branch
export const getFacultyList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;

    const { data: faculty, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        name,
        email,
        phone,
        avatarUrl,
        isActive,
        createdAt,
        faculty_subjects(
          subject:subjects(id, name)
        )
      `)
      .eq('branchId', branchId)
      .eq('role', 'faculty')
      .order('name', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ faculty });
  } catch (error) {
    console.error('Get faculty list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add/Update faculty
export const upsertFaculty = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, name, email, phone, subjectIds } = req.body;
    const branchId = req.user!.branchId;

    let facultyId = id;

    if (id) {
      // Update existing faculty
      const { error } = await supabaseAdmin
        .from('users')
        .update({ name, email, phone })
        .eq('id', id)
        .eq('branchId', branchId);

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      // Update subject assignments
      await supabaseAdmin
        .from('faculty_subjects')
        .delete()
        .eq('facultyId', id);
    } else {
      // Create new faculty
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          branchId,
          name,
          email,
          phone,
          role: 'faculty',
          isActive: true
        })
        .select('id')
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      facultyId = data.id;
    }

    // Assign subjects
    if (subjectIds && subjectIds.length > 0) {
      const assignments = subjectIds.map((subjectId: string) => ({
        facultyId,
        subjectId
      }));

      await supabaseAdmin.from('faculty_subjects').insert(assignments);
    }

    res.json({
      message: id ? 'Faculty updated successfully' : 'Faculty created successfully',
      facultyId
    });
  } catch (error) {
    console.error('Upsert faculty error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Remove faculty
export const removeFaculty = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    // Check if faculty has classes scheduled
    const { data: schedules } = await supabaseAdmin
      .from('timetable_entries')
      .select('id')
      .eq('facultyId', id)
      .limit(1);

    if (schedules && schedules.length > 0) {
      res.status(400).json({ error: 'Faculty has scheduled classes. Remove them first.' });
      return;
    }

    // Remove subject assignments
    await supabaseAdmin
      .from('faculty_subjects')
      .delete()
      .eq('facultyId', id);

    // Deactivate faculty account
    const { error } = await supabaseAdmin
      .from('users')
      .update({ isActive: false })
      .eq('id', id)
      .eq('branchId', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Faculty removed successfully' });
  } catch (error) {
    console.error('Remove faculty error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get holiday list
export const getHolidays = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { year } = req.query;
    const branchId = req.user!.branchId;

    let query = supabaseAdmin
      .from('holidays')
      .select('*')
      .eq('branchId', branchId);

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    query = query.order('date', { ascending: true });

    const { data: holidays, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ holidays });
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add holiday
export const addHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, date, type, isRecurring } = req.body;
    const branchId = req.user!.branchId;

    const { data: holiday, error } = await supabaseAdmin
      .from('holidays')
      .insert({
        branchId,
        name,
        date,
        type: type || 'national',
        isRecurring: isRecurring || false
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({
      message: 'Holiday added successfully',
      holiday
    });
  } catch (error) {
    console.error('Add holiday error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete holiday
export const deleteHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const { error } = await supabaseAdmin
      .from('holidays')
      .delete()
      .eq('id', id)
      .eq('branchId', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload branch logo
export const uploadBranchLogo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const file = req.file;
    const fileExt = file.originalname.split('.').pop();
    const fileName = `logos/${branchId}-${Date.now()}.${fileExt}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('branch-assets')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      res.status(400).json({ error: uploadError.message });
      return;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('branch-assets')
      .getPublicUrl(fileName);

    // Update branch with logo URL
    await supabaseAdmin
      .from('branches')
      .update({ logo: urlData.publicUrl })
      .eq('id', branchId);

    res.json({
      message: 'Logo uploaded successfully',
      logoUrl: urlData.publicUrl
    });
  } catch (error) {
    console.error('Upload branch logo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get email templates
export const getEmailTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;

    const { data: templates, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .or(`branchId.eq.${branchId},isGlobal.eq.true`)
      .order('name', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ templates });
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update email template
export const updateEmailTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { subject, body } = req.body;
    const branchId = req.user!.branchId;

    const { data: template, error } = await supabaseAdmin
      .from('email_templates')
      .update({ subject, body })
      .eq('id', id)
      .eq('branchId', branchId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Email template updated successfully',
      template
    });
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};