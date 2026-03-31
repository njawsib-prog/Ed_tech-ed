import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';
import Redis from 'ioredis';
import { shuffleArray } from '../../utils/helpers';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface AuthRequest extends Request {
  user?: {
    id: string;
    branchId: string;
    role: string;
  };
}

// Test session cache prefix
const SESSION_PREFIX = 'test_session:';

// Start test
export const startTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
    const userId = req.user!.id;
    const branchId = req.user!.branchId;

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

    // Check if test is assigned to student
    const { data: assignment } = await supabaseAdmin
      .from('test_assignments')
      .select('id, attempts, maxAttempts')
      .eq('testId', testId)
      .eq('studentId', student.id)
      .single();

    if (!assignment) {
      res.status(403).json({ error: 'Test not assigned to you' });
      return;
    }

    // Check if already attempted max times
    if (assignment.maxAttempts && assignment.attempts >= assignment.maxAttempts) {
      res.status(400).json({ error: 'Maximum attempts reached' });
      return;
    }

    // Check for existing incomplete session
    const existingSession = await redis.get(`${SESSION_PREFIX}${student.id}:${testId}`);
    if (existingSession) {
      const session = JSON.parse(existingSession);
      res.json({
        message: 'Resuming existing session',
        session: {
          sessionId: session.sessionId,
          test: session.test,
          questions: session.questions,
          answers: session.answers,
          timeRemaining: session.timeRemaining,
          startedAt: session.startedAt
        }
      });
      return;
    }

    // Get test details
    const { data: test, error: testError } = await supabaseAdmin
      .from('tests')
      .select(`
        id,
        title,
        description,
        type,
        duration,
        totalMarks,
        passingMarks,
        instructions,
        settings,
        subject:subjects(id, name)
      `)
      .eq('id', testId)
      .eq('branchId', branchId)
      .single();

    if (testError || !test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    // Check if test is within scheduled window
    const now = new Date();
    if (test.settings?.scheduledStart && new Date(test.settings.scheduledStart) > now) {
      res.status(400).json({ error: 'Test has not started yet' });
      return;
    }

    if (test.settings?.scheduledEnd && new Date(test.settings.scheduledEnd) < now) {
      res.status(400).json({ error: 'Test has ended' });
      return;
    }

    // Get questions
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select(`
        id,
        text,
        type,
        options,
        marks,
        difficulty,
        topic
      `)
      .eq('testId', testId);

    if (questionsError) {
      res.status(400).json({ error: questionsError.message });
      return;
    }

    // Shuffle questions if enabled
    let processedQuestions = questions || [];
    if (test.settings?.shuffleQuestions) {
      processedQuestions = shuffleArray(processedQuestions);
    }

    // Remove correct answers from response
    const safeQuestions = processedQuestions.map((q: any) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options,
      marks: q.marks,
      difficulty: q.difficulty,
      topic: q.topic
    }));

    // Create session
    const sessionId = `${student.id}-${testId}-${Date.now()}`;
    const sessionData = {
      sessionId,
      studentId: student.id,
      testId,
      test,
      questions: safeQuestions,
      answers: {} as Record<string, any>,
      startedAt: new Date().toISOString(),
      timeRemaining: test.duration * 60, // in seconds
      duration: test.duration
    };

    // Cache session
    await redis.setex(
      `${SESSION_PREFIX}${student.id}:${testId}`,
      test.duration * 60 + 300, // Duration + 5 min buffer
      JSON.stringify(sessionData)
    );

    // Update attempt count
    await supabaseAdmin
      .from('test_assignments')
      .update({ attempts: assignment.attempts + 1 })
      .eq('id', assignment.id);

    res.json({
      message: 'Test started',
      session: {
        sessionId,
        test,
        questions: safeQuestions,
        answers: {},
        timeRemaining: sessionData.timeRemaining,
        startedAt: sessionData.startedAt
      }
    });
  } catch (error) {
    console.error('Start test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Save answer
export const saveAnswer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
    const { questionId, answer, timeSpent } = req.body;
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

    // Get session
    const sessionData = await redis.get(`${SESSION_PREFIX}${student.id}:${testId}`);
    if (!sessionData) {
      res.status(400).json({ error: 'Test session not found or expired' });
      return;
    }

    const session = JSON.parse(sessionData);

    // Save answer
    session.answers[questionId] = {
      answer,
      timeSpent: timeSpent || 0,
      savedAt: new Date().toISOString()
    };

    // Update cache
    await redis.setex(
      `${SESSION_PREFIX}${student.id}:${testId}`,
      session.timeRemaining + 300,
      JSON.stringify(session)
    );

    res.json({ message: 'Answer saved', saved: true });
  } catch (error) {
    console.error('Save answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get current session state
export const getSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
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

    const sessionData = await redis.get(`${SESSION_PREFIX}${student.id}:${testId}`);
    if (!sessionData) {
      res.status(404).json({ error: 'No active session found' });
      return;
    }

    const session = JSON.parse(sessionData);

    // Calculate time remaining
    const elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    const timeRemaining = Math.max(0, session.duration * 60 - elapsed);

    res.json({
      sessionId: session.sessionId,
      test: session.test,
      questions: session.questions,
      answers: session.answers,
      timeRemaining,
      startedAt: session.startedAt
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Submit test
export const submitTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
    const { answers, forceSubmit = false } = req.body;
    const userId = req.user!.id;
    const branchId = req.user!.branchId;

    // Get student
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, batchId')
      .eq('userId', userId)
      .single();

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Get session
    const sessionData = await redis.get(`${SESSION_PREFIX}${student.id}:${testId}`);
    if (!sessionData && !forceSubmit) {
      res.status(400).json({ error: 'Test session not found or expired' });
      return;
    }

    let session = sessionData ? JSON.parse(sessionData) : null;

    // Merge answers
    const finalAnswers = {
      ...(session?.answers || {}),
      ...answers
    };

    // Get test and questions with correct answers
    const { data: test } = await supabaseAdmin
      .from('tests')
      .select(`
        id,
        totalMarks,
        passingMarks,
        settings,
        negativeMarking,
        negativeMarkValue
      `)
      .eq('id', testId)
      .single();

    const { data: questions } = await supabaseAdmin
      .from('questions')
      .select('id, correctOption, marks, negativeMarks, type')
      .eq('testId', testId);

    // Calculate score
    let score = 0;
    let totalMarks = 0;
    const answerRecords: any[] = [];

    questions?.forEach((question: any) => {
      totalMarks += question.marks;
      const userAnswer = finalAnswers[question.id];

      if (userAnswer) {
        let isCorrect = false;
        let marksObtained = 0;

        if (question.type === 'mcq' || question.type === 'single_choice') {
          isCorrect = userAnswer.answer === question.correctOption;
          marksObtained = isCorrect ? question.marks : 0;

          // Apply negative marking
          if (!isCorrect && test?.negativeMarking) {
            marksObtained = -(question.negativeMarks || test.negativeMarkValue || 0);
          }
        } else if (question.type === 'multiple_choice') {
          const correctOptions = question.correctOption as string[];
          const selectedOptions = userAnswer.answer as string[];
          const correctCount = selectedOptions.filter(o => correctOptions.includes(o)).length;
          const incorrectCount = selectedOptions.filter(o => !correctOptions.includes(o)).length;

          isCorrect = correctCount === correctOptions.length && incorrectCount === 0;
          marksObtained = isCorrect
            ? question.marks
            : (correctCount / correctOptions.length) * question.marks;
        } else if (question.type === 'true_false') {
          isCorrect = userAnswer.answer === question.correctOption;
          marksObtained = isCorrect ? question.marks : 0;
        }

        score += marksObtained;

        answerRecords.push({
          questionId: question.id,
          selectedOption: userAnswer.answer,
          isCorrect,
          marksObtained: Math.max(0, marksObtained),
          timeSpent: userAnswer.timeSpent || 0
        });
      } else {
        // Unanswered question
        answerRecords.push({
          questionId: question.id,
          selectedOption: null,
          isCorrect: false,
          marksObtained: 0,
          timeSpent: 0
        });
      }
    });

    // Ensure score is not negative
    score = Math.max(0, score);

    // Calculate percentage and status
    const percentage = (score / totalMarks) * 100;
    const status = percentage >= (test?.passingMarks || 40) ? 'passed' : 'failed';

    // Calculate time taken
    const startedAt = session?.startedAt || new Date().toISOString();
    const timeTaken = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);

    // Get batch ID
    const { data: studentBatch } = await supabaseAdmin
      .from('student_batches')
      .select('batchId')
      .eq('studentId', student.id)
      .limit(1)
      .single();

    // Create result
    const { data: result, error } = await supabaseAdmin
      .from('results')
      .insert({
        testId,
        studentId: student.id,
        branchId,
        batchId: studentBatch?.batchId,
        score,
        totalMarks,
        percentage,
        status,
        timeTaken,
        submittedAt: new Date().toISOString(),
        answers: finalAnswers
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Save answer records
    if (answerRecords.length > 0) {
      await supabaseAdmin
        .from('result_answers')
        .insert(answerRecords.map(a => ({
          resultId: result.id,
          ...a
        })));
    }

    // Clear session
    await redis.del(`${SESSION_PREFIX}${student.id}:${testId}`);

    // Check if should show results immediately
    const showResults = test?.settings?.showResultsImmediately !== false;

    res.json({
      message: 'Test submitted successfully',
      result: showResults ? {
        id: result.id,
        score,
        totalMarks,
        percentage,
        status,
        timeTaken,
        submittedAt: result.submittedAt
      } : { id: result.id, submittedAt: result.submittedAt }
    });
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get test result
export const getTestResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { resultId } = req.params;
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

    const { data: result, error } = await supabaseAdmin
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
        ),
        answers:result_answers(
          id,
          questionId,
          selectedOption,
          isCorrect,
          marksObtained,
          timeSpent,
          question:questions(
            id,
            text,
            type,
            options,
            correctOption,
            explanation,
            marks
          )
        )
      `)
      .eq('id', resultId)
      .eq('studentId', student.id)
      .single();

    if (error || !result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // Calculate analytics
    const correctCount = result.answers?.filter((a: any) => a.isCorrect).length || 0;
    const totalQuestions = result.answers?.length || 0;

    res.json({
      result,
      analytics: {
        correctCount,
        incorrectCount: totalQuestions - correctCount,
        accuracy: totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Get test result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Auto-submit on time expiry (called by frontend timer)
export const autoSubmit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
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

    // Check if session exists
    const sessionData = await redis.get(`${SESSION_PREFIX}${student.id}:${testId}`);
    if (!sessionData) {
      res.status(400).json({ error: 'No active session' });
      return;
    }

    // Force submit with current answers
    req.body = { forceSubmit: true };
    await submitTest(req, res);
  } catch (error) {
    console.error('Auto submit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Flag question for review
export const flagQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
    const { questionId, flagged } = req.body;
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

    // Get session
    const sessionData = await redis.get(`${SESSION_PREFIX}${student.id}:${testId}`);
    if (!sessionData) {
      res.status(400).json({ error: 'Test session not found' });
      return;
    }

    const session = JSON.parse(sessionData);

    // Update flag status
    if (!session.flags) session.flags = {};
    session.flags[questionId] = flagged;

    // Update cache
    await redis.setex(
      `${SESSION_PREFIX}${student.id}:${testId}`,
      session.timeRemaining + 300,
      JSON.stringify(session)
    );

    res.json({ message: 'Flag status updated', flagged });
  } catch (error) {
    console.error('Flag question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};