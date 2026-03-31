'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
  marks: number;
  difficulty?: string;
  topic?: string;
}

interface Test {
  id: string;
  title: string;
  duration: number;
  totalMarks: number;
  instructions?: string;
  subject?: { id: string; name: string };
}

interface TestSession {
  sessionId: string;
  test: Test;
  questions: Question[];
  answers: Record<string, { answer: string; timeSpent: number }>;
  timeRemaining: number;
  startedAt: string;
}

export default function TestEnginePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const testId = params.testId as string;

  const [session, setSession] = useState<TestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Start test
  useEffect(() => {
    const startTest = async () => {
      try {
        const response = await apiClient.post(`/student/test/${testId}/start`);
        setSession(response.data.session);
        setAnswers(
          Object.fromEntries(
            Object.entries(response.data.session.answers || {}).map(([k, v]: [string, any]) => [k, v.answer])
          )
        );
        setTimeRemaining(response.data.session.timeRemaining);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to start test');
      } finally {
        setLoading(false);
      }
    };

    if (user && testId) {
      startTest();
    }
  }, [user, testId]);

  // Timer
  useEffect(() => {
    if (timeRemaining <= 0) {
      if (session && !submitting) {
        handleAutoSubmit();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining > 0]);

  // Save answer
  const saveAnswer = useCallback(async (questionId: string, answer: string) => {
    try {
      await apiClient.post(`/student/test/${testId}/answer`, {
        questionId,
        answer,
        timeSpent: 0
      });
    } catch (err) {
      console.error('Failed to save answer:', err);
    }
  }, [testId]);

  // Handle answer selection
  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    saveAnswer(questionId, answer);
  };

  // Toggle flag
  const toggleFlag = async (questionId: string) => {
    const newFlags = new Set(flaggedQuestions);
    if (newFlags.has(questionId)) {
      newFlags.delete(questionId);
    } else {
      newFlags.add(questionId);
    }
    setFlaggedQuestions(newFlags);

    try {
      await apiClient.post(`/student/test/${testId}/flag`, {
        questionId,
        flagged: newFlags.has(questionId)
      });
    } catch (err) {
      console.error('Failed to flag question:', err);
    }
  };

  // Auto submit
  const handleAutoSubmit = async () => {
    setSubmitting(true);
    try {
      await apiClient.post(`/student/test/${testId}/auto-submit`);
      router.push(`/student/result?testId=${testId}`);
    } catch (err) {
      console.error('Auto submit failed:', err);
    }
  };

  // Manual submit
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await apiClient.post(`/student/test/${testId}/submit`, { answers });
      router.push(`/student/result?testId=${testId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit test');
      setSubmitting(false);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Unable to load test session</p>
      </div>
    );
  }

  const currentQuestion = session.questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length;
  const progressPercentage = (answeredCount / session.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{session.test.title}</h1>
            <p className="text-sm text-gray-500">
              {session.test.subject?.name || 'General'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`text-2xl font-mono font-bold ${timeRemaining < 300 ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
              {formatTime(timeRemaining)}
            </div>
            <Button
              variant="primary"
              onClick={() => setShowSubmitModal(true)}
              disabled={submitting}
            >
              Submit Test
            </Button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 pb-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question navigation sidebar */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-white rounded-lg shadow p-4 sticky top-24">
              <h3 className="font-semibold mb-3">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {session.questions.map((q, index) => {
                  const isAnswered = !!answers[q.id];
                  const isCurrent = index === currentQuestionIndex;
                  const isFlagged = flaggedQuestions.has(q.id);

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(index)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium relative
                        ${isCurrent ? 'ring-2 ring-primary' : ''}
                        ${isAnswered ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                        hover:opacity-80 transition-opacity
                      `}
                    >
                      {index + 1}
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 text-sm text-gray-500">
                <p>Answered: {answeredCount}/{session.questions.length}</p>
                <p>Flagged: {flaggedQuestions.size}</p>
              </div>
            </div>
          </div>

          {/* Question area */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="bg-white rounded-lg shadow p-6">
              {/* Question header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500">
                  Question {currentQuestionIndex + 1} of {session.questions.length}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">
                    {currentQuestion.marks} marks
                  </span>
                  <button
                    onClick={() => toggleFlag(currentQuestion.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      flaggedQuestions.has(currentQuestion.id)
                        ? 'bg-yellow-100 text-yellow-600'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Question text */}
              <div className="prose max-w-none mb-6">
                <p className="text-lg">{currentQuestion.text}</p>
              </div>

              {/* Options */}
              {currentQuestion.type !== 'text' && currentQuestion.options && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, optIndex) => (
                    <label
                      key={optIndex}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${answers[currentQuestion.id] === option
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option}
                        checked={answers[currentQuestion.id] === option}
                        onChange={() => handleAnswerSelect(currentQuestion.id, option)}
                        className="mt-1"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(session.questions.length - 1, prev + 1))}
                  disabled={currentQuestionIndex === session.questions.length - 1}
                >
                  Save & Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Submit confirmation modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Submit Test?</h3>
            <p className="text-gray-600 mb-2">
              You have answered {answeredCount} out of {session.questions.length} questions.
            </p>
            {answeredCount < session.questions.length && (
              <p className="text-yellow-600 mb-4">
                Warning: {session.questions.length - answeredCount} questions are unanswered.
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowSubmitModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit} loading={submitting}>
                Submit Test
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}