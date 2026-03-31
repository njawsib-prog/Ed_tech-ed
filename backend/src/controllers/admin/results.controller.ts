import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Get all results with filtering and pagination
export const getResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      testId,
      batchId,
      studentId,
      status,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const branchId = req.user!.branch_id;

    let query = supabaseAdmin
      .from('results')
      .select(`
        id,
        score,
        totalMarks,
        percentage,
        rank,
        status,
        submittedAt,
        timeTaken,
        test:tests(id, title, totalMarks),
        student:students(id, name, email, enrollmentNumber),
        batch:batches(id, name)
      `, { count: 'exact' })
      .eq('branchId', branchId);

    // Apply filters
    if (testId) query = query.eq('testId', testId);
    if (batchId) query = query.eq('batchId', batchId);
    if (studentId) query = query.eq('studentId', studentId);
    if (status) query = query.eq('status', status);

    // Apply sorting
    query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: results, error, count } = await query;

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
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get result details with question-wise analysis
export const getResultById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branch_id;

    const { data: result, error } = await supabaseAdmin
      .from('results')
      .select(`
        id,
        score,
        totalMarks,
        percentage,
        rank,
        status,
        submittedAt,
        timeTaken,
        test:tests(
          id,
          title,
          totalMarks,
          passingMarks,
          instructions
        ),
        student:students(id, name, email, enrollmentNumber),
        batch:batches(id, name),
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
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (error || !result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // Calculate question-wise analytics
    const questionAnalytics = result.answers.map((answer: any) => ({
      questionId: answer.questionId,
      isCorrect: answer.isCorrect,
      marksObtained: answer.marksObtained,
      maxMarks: answer.question.marks,
      timeSpent: answer.timeSpent
    }));

    // Topic-wise performance (if questions have topics)
    const topicPerformance: Record<string, { correct: number; total: number }> = {};
    result.answers.forEach((answer: any) => {
      const topic = answer.question.topic || 'General';
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { correct: 0, total: 0 };
      }
      topicPerformance[topic].total++;
      if (answer.isCorrect) {
        topicPerformance[topic].correct++;
      }
    });

    res.json({
      result,
      analytics: {
        questionWise: questionAnalytics,
        topicWise: topicPerformance,
        accuracy: result.totalMarks > 0 ? (result.score / result.totalMarks) * 100 : 0,
        averageTimePerQuestion: result.answers.length > 0 
          ? result.answers.reduce((sum: number, a: any) => sum + (a.timeSpent || 0), 0) / result.answers.length 
          : 0
      }
    });
  } catch (error) {
    console.error('Get result by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate leaderboard for a test
export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { testId } = req.params;
    const { limit = 50 } = req.query;
    const branchId = req.user!.branch_id;

    // Check cache first
    const cacheKey = `leaderboard:${branchId}:${testId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      res.json({ leaderboard: JSON.parse(cached), cached: true });
      return;
    }

    // Verify test belongs to branch
    const { data: test, error: testError } = await supabaseAdmin
      .from('tests')
      .select('id')
      .eq('id', testId)
      .eq('branchId', branchId)
      .single();

    if (testError || !test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    // Get all results for the test, ranked
    const { data: results, error } = await supabaseAdmin
      .from('results')
      .select(`
        id,
        score,
        percentage,
        timeTaken,
        submittedAt,
        student:students(id, name, enrollmentNumber, avatarUrl)
      `)
      .eq('testId', testId)
      .eq('branchId', branchId)
      .eq('status', 'completed')
      .order('score', { ascending: false })
      .order('timeTaken', { ascending: true })
      .limit(Number(limit));

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Assign ranks
    let currentRank = 1;
    let prevScore: number | null = null;
    let prevTime: number | null = null;
    
    const leaderboard = results.map((result: any, index: number) => {
      // Handle ties - same score and time get same rank
      if (prevScore !== null && (result.score !== prevScore || result.timeTaken !== prevTime)) {
        currentRank = index + 1;
      }
      
      prevScore = result.score;
      prevTime = result.timeTaken;
      
      return {
        rank: currentRank,
        ...result
      };
    });

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(leaderboard));

    res.json({ leaderboard, cached: false });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get results analytics for dashboard
export const getResultsAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branch_id;
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get overall stats
    const { data: overallStats } = await supabaseAdmin
      .from('results')
      .select('score, totalMarks, status')
      .eq('branchId', branchId)
      .gte('submittedAt', startDate.toISOString());

    // Get test-wise performance
    const { data: testPerformance } = await supabaseAdmin
      .from('results')
      .select(`
        score,
        totalMarks,
        test:tests(id, title)
      `)
      .eq('branchId', branchId)
      .gte('submittedAt', startDate.toISOString());

    // Get daily submissions
    const { data: dailySubmissions } = await supabaseAdmin
      .from('results')
      .select('submittedAt')
      .eq('branchId', branchId)
      .gte('submittedAt', startDate.toISOString());

    // Process analytics
    const totalResults = overallStats?.length || 0;
    const averageScore = overallStats && overallStats.length > 0
      ? overallStats.reduce((sum, r) => sum + (r.score || 0), 0) / overallStats.length
      : 0;
    const averagePercentage = overallStats && overallStats.length > 0
      ? overallStats.reduce((sum, r) => sum + ((r.score || 0) / (r.totalMarks || 1)) * 100, 0) / overallStats.length
      : 0;
    const passRate = overallStats && overallStats.length > 0
      ? (overallStats.filter(r => r.status === 'passed').length / overallStats.length) * 100
      : 0;

    // Test-wise aggregation
    const testWiseStats: Record<string, { title: string; attempts: number; avgScore: number; total: number }> = {};
    testPerformance?.forEach((r: any) => {
      const testId = r.test?.id || 'unknown';
      if (!testWiseStats[testId]) {
        testWiseStats[testId] = {
          title: r.test?.title || 'Unknown Test',
          attempts: 0,
          avgScore: 0,
          total: 0
        };
      }
      testWiseStats[testId].attempts++;
      testWiseStats[testId].total += r.score || 0;
    });

    Object.keys(testWiseStats).forEach(key => {
      testWiseStats[key].avgScore = testWiseStats[key].total / testWiseStats[key].attempts;
    });

    // Daily submissions aggregation
    const dailyStats: Record<string, number> = {};
    dailySubmissions?.forEach((r: any) => {
      const date = new Date(r.submittedAt).toISOString().split('T')[0];
      dailyStats[date] = (dailyStats[date] || 0) + 1;
    });

    res.json({
      overview: {
        totalResults,
        averageScore: Math.round(averageScore * 100) / 100,
        averagePercentage: Math.round(averagePercentage * 100) / 100,
        passRate: Math.round(passRate * 100) / 100
      },
      testWisePerformance: Object.values(testWiseStats),
      dailySubmissions: Object.entries(dailyStats).map(([date, count]) => ({
        date,
        count
      })).sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error) {
    console.error('Get results analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Re-evaluate a result (for disputed questions)
export const reevaluateResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { questionUpdates } = req.body; // Array of { questionId, newMarks }
    const branchId = req.user!.branch_id;

    // Get current result
    const { data: result, error: resultError } = await supabaseAdmin
      .from('results')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (resultError || !result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // Update individual answer marks
    let totalScoreChange = 0;
    
    for (const update of questionUpdates) {
      const { data: answer, error: answerError } = await supabaseAdmin
        .from('result_answers')
        .select('*')
        .eq('resultId', id)
        .eq('questionId', update.questionId)
        .single();

      if (answer) {
        const oldMarks = answer.marksObtained || 0;
        totalScoreChange += update.newMarks - oldMarks;

        await supabaseAdmin
          .from('result_answers')
          .update({ marksObtained: update.newMarks })
          .eq('id', answer.id);
      }
    }

    // Update result totals
    const newScore = (result.score || 0) + totalScoreChange;
    const newPercentage = (newScore / result.totalMarks) * 100;

    await supabaseAdmin
      .from('results')
      .update({
        score: newScore,
        percentage: newPercentage,
        reevaluatedAt: new Date().toISOString(),
        reevaluatedBy: req.user!.id
      })
      .eq('id', id);

    // Invalidate leaderboard cache
    await redis.del(`leaderboard:${branchId}:${result.testId}`);

    res.json({
      message: 'Result re-evaluated successfully',
      oldScore: result.score,
      newScore,
      scoreChange: totalScoreChange
    });
  } catch (error) {
    console.error('Reevaluate result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export results to CSV
export const exportResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const { testId, batchId } = req.query;
    const branchId = req.user!.branch_id;

    let query = supabaseAdmin
      .from('results')
      .select(`
        id,
        score,
        totalMarks,
        percentage,
        rank,
        status,
        submittedAt,
        timeTaken,
        test:tests(title),
        student:students(name, email, enrollmentNumber),
        batch:batches(name)
      `)
      .eq('branchId', branchId);

    if (testId) query = query.eq('testId', testId);
    if (batchId) query = query.eq('batchId', batchId);

    const { data: results, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Generate CSV
    const headers = [
      'Enrollment Number',
      'Student Name',
      'Email',
      'Batch',
      'Test',
      'Score',
      'Total Marks',
      'Percentage',
      'Rank',
      'Status',
      'Time Taken (min)',
      'Submitted At'
    ];

    const rows = results?.map((r: any) => [
      r.student?.enrollmentNumber || '',
      r.student?.name || '',
      r.student?.email || '',
      r.batch?.name || '',
      r.test?.title || '',
      r.score || 0,
      r.totalMarks || 0,
      r.percentage ? `${r.percentage.toFixed(2)}%` : '0%',
      r.rank || '',
      r.status || '',
      r.timeTaken ? Math.round(r.timeTaken / 60) : '',
      r.submittedAt ? new Date(r.submittedAt).toISOString() : ''
    ]);

    const csv = [
      headers.join(','),
      ...(rows?.map((row: string[]) => row.map(cell => `"${cell}"`).join(',')) || [])
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="results-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};