import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

interface AuthRequest extends Request {
  user?: {
    id: string;
    branchId: string;
    role: string;
  };
}

// Get all feedback forms
export const getFeedbackForms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isActive, type } = req.query;
    const branchId = req.user!.branchId;

    let query = supabaseAdmin
      .from('feedback_forms')
      .select(`
        id,
        title,
        description,
        type,
        isActive,
        isAnonymous,
        startDate,
        endDate,
        createdAt,
        _count:feedback_responses
      `)
      .eq('branchId', branchId);

    if (isActive !== undefined) query = query.eq('isActive', isActive === 'true');
    if (type) query = query.eq('type', type);

    query = query.order('createdAt', { ascending: false });

    const { data: forms, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ forms });
  } catch (error) {
    console.error('Get feedback forms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get feedback form by ID with questions
export const getFeedbackFormById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const { data: form, error: formError } = await supabaseAdmin
      .from('feedback_forms')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (formError || !form) {
      res.status(404).json({ error: 'Feedback form not found' });
      return;
    }

    // Get questions
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('feedback_questions')
      .select('*')
      .eq('formId', id)
      .order('order', { ascending: true });

    if (questionsError) {
      res.status(400).json({ error: questionsError.message });
      return;
    }

    res.json({
      form,
      questions
    });
  } catch (error) {
    console.error('Get feedback form by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create feedback form
export const createFeedbackForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      type = 'general',
      isAnonymous = true,
      startDate,
      endDate,
      batchIds = [],
      questions
    } = req.body;

    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Create form
    const { data: form, error: formError } = await supabaseAdmin
      .from('feedback_forms')
      .insert({
        branchId,
        title,
        description,
        type,
        isAnonymous,
        startDate,
        endDate,
        isActive: true,
        createdBy: userId
      })
      .select()
      .single();

    if (formError) {
      res.status(400).json({ error: formError.message });
      return;
    }

    // Create questions
    if (questions && questions.length > 0) {
      const questionRecords = questions.map((q: any, index: number) => ({
        formId: form.id,
        text: q.text,
        type: q.type || 'rating',
        options: q.options,
        required: q.required !== false,
        order: index + 1
      }));

      const { error: questionsError } = await supabaseAdmin
        .from('feedback_questions')
        .insert(questionRecords);

      if (questionsError) {
        // Rollback form creation
        await supabaseAdmin.from('feedback_forms').delete().eq('id', form.id);
        res.status(400).json({ error: questionsError.message });
        return;
      }
    }

    // Assign to batches
    if (batchIds.length > 0) {
      const batchAssignments = batchIds.map((batchId: string) => ({
        formId: form.id,
        batchId
      }));

      await supabaseAdmin.from('feedback_form_batches').insert(batchAssignments);
    }

    res.status(201).json({
      message: 'Feedback form created successfully',
      form
    });
  } catch (error) {
    console.error('Create feedback form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update feedback form
export const updateFeedbackForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, isActive, startDate, endDate } = req.body;
    const branchId = req.user!.branchId;

    // Check for existing responses
    const { data: responses } = await supabaseAdmin
      .from('feedback_responses')
      .select('id')
      .eq('formId', id)
      .limit(1);

    if (responses && responses.length > 0) {
      // Can only update isActive status if form has responses
      if (title || description || startDate || endDate) {
        res.status(400).json({ error: 'Cannot modify form with existing responses' });
        return;
      }
    }

    const { data: form, error } = await supabaseAdmin
      .from('feedback_forms')
      .update({
        title,
        description,
        isActive,
        startDate,
        endDate
      })
      .eq('id', id)
      .eq('branchId', branchId)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Feedback form updated successfully',
      form
    });
  } catch (error) {
    console.error('Update feedback form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete feedback form
export const deleteFeedbackForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    // Delete questions first
    await supabaseAdmin.from('feedback_questions').delete().eq('formId', id);
    await supabaseAdmin.from('feedback_form_batches').delete().eq('formId', id);

    // Delete responses
    const { data: responses } = await supabaseAdmin
      .from('feedback_responses')
      .select('id')
      .eq('formId', id);

    if (responses && responses.length > 0) {
      for (const response of responses) {
        await supabaseAdmin.from('feedback_answers').delete().eq('responseId', response.id);
      }
      await supabaseAdmin.from('feedback_responses').delete().eq('formId', id);
    }

    // Delete form
    const { error } = await supabaseAdmin
      .from('feedback_forms')
      .delete()
      .eq('id', id)
      .eq('branchId', branchId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Feedback form deleted successfully' });
  } catch (error) {
    console.error('Delete feedback form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Submit feedback response (student)
export const submitFeedbackResponse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { formId, answers } = req.body;
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Get form details
    const { data: form, error: formError } = await supabaseAdmin
      .from('feedback_forms')
      .select('*')
      .eq('id', formId)
      .eq('branchId', branchId)
      .single();

    if (formError || !form) {
      res.status(404).json({ error: 'Feedback form not found' });
      return;
    }

    if (!form.isActive) {
      res.status(400).json({ error: 'Feedback form is not active' });
      return;
    }

    if (form.endDate && new Date(form.endDate) < new Date()) {
      res.status(400).json({ error: 'Feedback form has expired' });
      return;
    }

    // Get student ID
    let studentId = null;
    if (!form.isAnonymous) {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('userId', userId)
        .single();
      studentId = student?.id;
    }

    // Check if already submitted
    if (studentId) {
      const { data: existingResponse } = await supabaseAdmin
        .from('feedback_responses')
        .select('id')
        .eq('formId', formId)
        .eq('studentId', studentId)
        .single();

      if (existingResponse) {
        res.status(400).json({ error: 'You have already submitted this feedback' });
        return;
      }
    }

    // Create response
    const { data: response, error: responseError } = await supabaseAdmin
      .from('feedback_responses')
      .insert({
        formId,
        studentId,
        branchId,
        submittedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (responseError) {
      res.status(400).json({ error: responseError.message });
      return;
    }

    // Create answers
    const answerRecords = answers.map((answer: any) => ({
      responseId: response.id,
      questionId: answer.questionId,
      ratingValue: answer.ratingValue,
      textValue: answer.textValue,
      selectedOptions: answer.selectedOptions
    }));

    const { error: answersError } = await supabaseAdmin
      .from('feedback_answers')
      .insert(answerRecords);

    if (answersError) {
      // Rollback response
      await supabaseAdmin.from('feedback_responses').delete().eq('id', response.id);
      res.status(400).json({ error: answersError.message });
      return;
    }

    res.status(201).json({
      message: 'Feedback submitted successfully',
      responseId: response.id
    });
  } catch (error) {
    console.error('Submit feedback response error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get feedback responses
export const getFeedbackResponses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const branchId = req.user!.branchId;

    const offset = (Number(page) - 1) * Number(limit);

    // Verify form belongs to branch
    const { data: form } = await supabaseAdmin
      .from('feedback_forms')
      .select('id, isAnonymous')
      .eq('id', formId)
      .eq('branchId', branchId)
      .single();

    if (!form) {
      res.status(404).json({ error: 'Feedback form not found' });
      return;
    }

    const { data: responses, error, count } = await supabaseAdmin
      .from('feedback_responses')
      .select(`
        id,
        submittedAt,
        student:students(id, name, enrollmentNumber),
        answers:feedback_answers(
          id,
          questionId,
          ratingValue,
          textValue,
          selectedOptions
        )
      `, { count: 'exact' })
      .eq('formId', formId)
      .eq('branchId', branchId)
      .order('submittedAt', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Anonymize if needed
    const sanitizedResponses = form.isAnonymous
      ? responses?.map((r: any) => ({ ...r, student: null }))
      : responses;

    res.json({
      responses: sanitizedResponses,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get feedback responses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get feedback analytics
export const getFeedbackAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const branchId = req.user!.branchId;

    // Verify form belongs to branch
    const { data: form, error: formError } = await supabaseAdmin
      .from('feedback_forms')
      .select('*')
      .eq('id', formId)
      .eq('branchId', branchId)
      .single();

    if (formError || !form) {
      res.status(404).json({ error: 'Feedback form not found' });
      return;
    }

    // Get questions
    const { data: questions } = await supabaseAdmin
      .from('feedback_questions')
      .select('*')
      .eq('formId', formId)
      .order('order', { ascending: true });

    // Get all answers
    const { data: responses } = await supabaseAdmin
      .from('feedback_responses')
      .select(`
        id,
        answers:feedback_answers(
          questionId,
          ratingValue,
          textValue,
          selectedOptions
        )
      `)
      .eq('formId', formId);

    const totalResponses = responses?.length || 0;

    // Calculate analytics per question
    const questionAnalytics = questions?.map((question: any) => {
      const questionAnswers = responses
        ?.flatMap((r: any) => r.answers)
        .filter((a: any) => a.questionId === question.id) || [];

      let analytics: any = {
        questionId: question.id,
        questionText: question.text,
        questionType: question.type,
        responseCount: questionAnswers.length
      };

      switch (question.type) {
        case 'rating':
          const ratings = questionAnswers
            .map((a: any) => a.ratingValue)
            .filter((r: number) => r !== null);
          analytics.averageRating = ratings.length > 0
            ? ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length
            : 0;
          analytics.ratingDistribution = {
            1: ratings.filter((r: number) => r === 1).length,
            2: ratings.filter((r: number) => r === 2).length,
            3: ratings.filter((r: number) => r === 3).length,
            4: ratings.filter((r: number) => r === 4).length,
            5: ratings.filter((r: number) => r === 5).length
          };
          break;

        case 'text':
          analytics.textResponses = questionAnswers
            .map((a: any) => a.textValue)
            .filter((t: string) => t);
          analytics.wordCount = analytics.textResponses.reduce(
            (sum: number, text: string) => sum + text.split(/\s+/).length,
            0
          );
          break;

        case 'multiple_choice':
          const optionCounts: Record<string, number> = {};
          questionAnswers.forEach((a: any) => {
            a.selectedOptions?.forEach((option: string) => {
              optionCounts[option] = (optionCounts[option] || 0) + 1;
            });
          });
          analytics.optionDistribution = optionCounts;
          break;
      }

      return analytics;
    });

    res.json({
      form,
      totalResponses,
      questionAnalytics
    });
  } catch (error) {
    console.error('Get feedback analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export feedback responses
export const exportFeedbackResponses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { formId } = req.params;
    const branchId = req.user!.branchId;

    // Get form and questions
    const { data: form } = await supabaseAdmin
      .from('feedback_forms')
      .select('*')
      .eq('id', formId)
      .eq('branchId', branchId)
      .single();

    if (!form) {
      res.status(404).json({ error: 'Feedback form not found' });
      return;
    }

    const { data: questions } = await supabaseAdmin
      .from('feedback_questions')
      .select('*')
      .eq('formId', formId)
      .order('order', { ascending: true });

    const { data: responses } = await supabaseAdmin
      .from('feedback_responses')
      .select(`
        submittedAt,
        student:students(name, enrollmentNumber),
        answers:feedback_answers(
          questionId,
          ratingValue,
          textValue,
          selectedOptions
        )
      `)
      .eq('formId', formId);

    // Generate CSV
    const headers = [
      'Submitted At',
      ...(form.isAnonymous ? [] : ['Student Name', 'Enrollment Number']),
      ...questions?.map((q: any) => q.text.substring(0, 50)) || []
    ];

    const rows = responses?.map((r: any) => {
      const row: any[] = [
        new Date(r.submittedAt).toISOString()
      ];

      if (!form.isAnonymous) {
        row.push(r.student?.name || '');
        row.push(r.student?.enrollmentNumber || '');
      }

      questions?.forEach((q: any) => {
        const answer = r.answers?.find((a: any) => a.questionId === q.id);
        if (answer) {
          if (q.type === 'rating') {
            row.push(answer.ratingValue?.toString() || '');
          } else if (q.type === 'text') {
            row.push(answer.textValue?.replace(/"/g, '""') || '');
          } else {
            row.push(answer.selectedOptions?.join('; ') || '');
          }
        } else {
          row.push('');
        }
      });

      return row;
    });

    const csv = [
      headers.map(h => `"${h}"`).join(','),
      ...(rows?.map((row: string[]) => row.map(cell => `"${cell}"`).join(',')) || [])
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="feedback-${formId}-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export feedback responses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};