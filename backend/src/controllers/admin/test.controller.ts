import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';
import { Queue } from 'bullmq';
import { bullmqConnection } from '../../utils/redisClient';

// Initialize test schedule queue
const testScheduleQueue = new Queue('testSchedule', {
  connection: bullmqConnection,
});

/**
 * Get all tests for branch
 * GET /api/admin/tests
 */
export const getTests = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.user?.branch_id;
    const { page = 1, limit = 20, type, is_active, course_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('tests')
      .select(`
        *,
        courses(title),
        test_assignments(count),
        questions(count)
      `, { count: 'exact' })
      .eq('branch_id', branchId);

    if (type) {
      query = query.eq('type', type);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    if (course_id) {
      query = query.eq('course_id', course_id);
    }

    const { data, error, count } = await query
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      tests: data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
};

/**
 * Get test by ID
 * GET /api/admin/tests/:id
 */
export const getTestById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user?.branch_id;

    const { data: test, error } = await supabaseAdmin
      .from('tests')
      .select(`
        *,
        courses(title),
        questions(*)
      `)
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (error || !test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    res.json(test);
  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({ error: 'Failed to fetch test' });
  }
};

/**
 * Create new test
 * POST /api/admin/tests
 */
export const createTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.user?.branch_id;
    const {
      title,
      description,
      time_limit_mins,
      total_marks,
      passing_marks,
      type,
      scheduled_at,
      instructions,
      course_id,
    } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Test title is required' });
      return;
    }

    const { data: test, error } = await supabaseAdmin
      .from('tests')
      .insert({
        branch_id: branchId,
        title,
        description,
        time_limit_mins: time_limit_mins || 60,
        total_marks: total_marks || 100,
        passing_marks: passing_marks || 40,
        type: type || 'practice',
        scheduled_at,
        instructions,
        course_id,
        is_active: !scheduled_at, // Auto-activate if not scheduled
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Schedule test activation if scheduled_at is set
    if (scheduled_at) {
      const delay = new Date(scheduled_at).getTime() - Date.now();
      if (delay > 0) {
        await testScheduleQueue.add(
          'activateTest',
          { testId: test.id, branchId },
          { delay }
        );
      }
    }

    res.status(201).json({ message: 'Test created successfully', test });
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
};

/**
 * Update test
 * PUT /api/admin/tests/:id
 */
export const updateTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user?.branch_id;

    // Check if test has submissions
    const { count: submissions } = await supabaseAdmin
      .from('results')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', id);

    if (submissions && submissions > 0) {
      res.status(400).json({ 
        error: 'Cannot update test with existing submissions',
        code: 'HAS_SUBMISSIONS'
      });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('tests')
      .update({
        ...req.body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Test updated successfully', test: data });
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({ error: 'Failed to update test' });
  }
};

/**
 * Delete test
 * DELETE /api/admin/tests/:id
 */
export const deleteTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user?.branch_id;

    // Check if test has submissions
    const { count: submissions } = await supabaseAdmin
      .from('results')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', id);

    if (submissions && submissions > 0) {
      res.status(400).json({ error: 'Cannot delete test with existing submissions' });
      return;
    }

    // Delete questions first
    await supabaseAdmin.from('questions').delete().eq('test_id', id);
    
    // Delete assignments
    await supabaseAdmin.from('test_assignments').delete().eq('test_id', id);

    // Delete test
    const { error } = await supabaseAdmin
      .from('tests')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Test deleted successfully' });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({ error: 'Failed to delete test' });
  }
};

/**
 * Add questions to test (bulk)
 * POST /api/admin/tests/:id/questions/bulk
 */
export const addQuestionsBulk = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { questions } = req.body;
    const branchId = req.user?.branch_id;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'Questions array is required' });
      return;
    }

    // Verify test belongs to branch
    const { data: test } = await supabaseAdmin
      .from('tests')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    // Validate and prepare questions
    const questionsToInsert = questions.map((q, index) => ({
      test_id: id,
      question_text: q.question_text || q.question,
      options: q.options,
      correct_option: q.correct_option,
      explanation: q.explanation,
      marks: q.marks || 1,
      negative_marks: q.negative_marks || 0,
      order_index: index,
    }));

    const { data, error } = await supabaseAdmin
      .from('questions')
      .insert(questionsToInsert)
      .select();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ 
      message: `${data.length} questions added successfully`,
      questions: data 
    });
  } catch (error) {
    console.error('Add questions error:', error);
    res.status(500).json({ error: 'Failed to add questions' });
  }
};

/**
 * Assign test to students
 * POST /api/admin/tests/:id/assign
 */
export const assignTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { student_ids, all_course, all_branch } = req.body;
    const branchId = req.user?.branch_id;

    let studentsToAssign: string[] = [];

    if (all_branch) {
      // Assign to all students in branch
      const { data } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('branch_id', branchId)
        .eq('status', 'active');
      
      studentsToAssign = data?.map(s => s.id) || [];
    } else if (all_course && req.body.course_id) {
      // Assign to all students in course
      const { data } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('branch_id', branchId)
        .eq('course_id', req.body.course_id)
        .eq('status', 'active');
      
      studentsToAssign = data?.map(s => s.id) || [];
    } else if (student_ids && Array.isArray(student_ids)) {
      studentsToAssign = student_ids;
    } else {
      res.status(400).json({ error: 'Provide student_ids, all_course, or all_branch' });
      return;
    }

    // Create assignments (upsert to handle duplicates)
    const assignments = studentsToAssign.map(studentId => ({
      test_id: id,
      student_id: studentId,
    }));

    const { error } = await supabaseAdmin
      .from('test_assignments')
      .upsert(assignments, { onConflict: 'test_id,student_id' });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ 
      message: `Test assigned to ${studentsToAssign.length} students`,
      assigned_count: studentsToAssign.length 
    });
  } catch (error) {
    console.error('Assign test error:', error);
    res.status(500).json({ error: 'Failed to assign test' });
  }
};

/**
 * Get test analytics
 * GET /api/admin/tests/:id/analytics
 */
export const getTestAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user?.branch_id;

    // Verify test exists
    const { data: test, error: testError } = await supabaseAdmin
      .from('tests')
      .select('id, title, total_marks')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (testError || !test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    // Get results statistics
    const { data: results } = await supabaseAdmin
      .from('results')
      .select('id, score, percentage, status, time_taken')
      .eq('test_id', id);

    // Get question-level analytics
    const { data: questionStats } = await supabaseAdmin
      .from('result_answers')
      .select(`
        is_correct,
        marks_obtained,
        question_id,
        questions(text, marks, topic)
      `)
      .in('result_id', results?.map(r => r.id) || []);

    // Calculate statistics
    const totalAttempts = results?.length || 0;
    const averageScore = results && results.length > 0
      ? results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length
      : 0;
    const averagePercentage = results && results.length > 0
      ? results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length
      : 0;
    const passRate = results && results.length > 0
      ? (results.filter(r => r.status === 'passed').length / results.length) * 100
      : 0;

    // Question difficulty analysis
    const questionAnalysis: Record<string, { correct: number; total: number; accuracy: number }> = {};
    questionStats?.forEach((answer: any) => {
      const qId = answer.question_id;
      if (!questionAnalysis[qId]) {
        questionAnalysis[qId] = { correct: 0, total: 0, accuracy: 0 };
      }
      questionAnalysis[qId].total++;
      if (answer.is_correct) {
        questionAnalysis[qId].correct++;
      }
    });

    Object.keys(questionAnalysis).forEach(qId => {
      questionAnalysis[qId].accuracy = (questionAnalysis[qId].correct / questionAnalysis[qId].total) * 100;
    });

    res.json({
      test,
      analytics: {
        totalAttempts,
        averageScore: Math.round(averageScore * 100) / 100,
        averagePercentage: Math.round(averagePercentage * 100) / 100,
        passRate: Math.round(passRate * 100) / 100,
        questionAnalysis
      }
    });
  } catch (error) {
    console.error('Get test analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch test analytics' });
  }
};

/**
 * Duplicate test
 * POST /api/admin/tests/:id/duplicate
 */
export const duplicateTest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user?.branch_id;
    const userId = req.user?.id;

    // Get original test
    const { data: originalTest, error: testError } = await supabaseAdmin
      .from('tests')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();

    if (testError || !originalTest) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    // Get original questions
    const { data: originalQuestions } = await supabaseAdmin
      .from('questions')
      .select('*')
      .eq('test_id', id);

    // Create duplicate test
    const { data: newTest, error: createError } = await supabaseAdmin
      .from('tests')
      .insert({
        branch_id: branchId,
        course_id: originalTest.course_id,
        title: `${originalTest.title} (Copy)`,
        description: originalTest.description,
        type: originalTest.type,
        total_marks: originalTest.total_marks,
        duration: originalTest.duration,
        passing_marks: originalTest.passing_marks,
        instructions: originalTest.instructions,
        settings: originalTest.settings,
        is_active: false, // Duplicated tests start as inactive
        created_by: userId
      })
      .select()
      .single();

    if (createError) {
      res.status(400).json({ error: createError.message });
      return;
    }

    // Duplicate questions
    if (originalQuestions && originalQuestions.length > 0) {
      const newQuestions = originalQuestions.map(q => ({
        test_id: newTest.id,
        text: q.text,
        type: q.type,
        options: q.options,
        correct_option: q.correct_option,
        explanation: q.explanation,
        marks: q.marks,
        negative_marks: q.negative_marks,
        topic: q.topic,
        difficulty: q.difficulty
      }));

      const { error: questionsError } = await supabaseAdmin
        .from('questions')
        .insert(newQuestions);

      if (questionsError) {
        // Rollback test creation
        await supabaseAdmin.from('tests').delete().eq('id', newTest.id);
        res.status(400).json({ error: questionsError.message });
        return;
      }
    }

    res.status(201).json({
      message: 'Test duplicated successfully',
      test: newTest
    });
  } catch (error) {
    console.error('Duplicate test error:', error);
    res.status(500).json({ error: 'Failed to duplicate test' });
  }
};

export default {
  getTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  addQuestionsBulk,
  assignTest,
};