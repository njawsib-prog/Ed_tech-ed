'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Test {
  id: string;
  title: string;
  subject: string;
  description: string;
  totalQuestions: number;
  totalMarks: number;
  duration: number; // in minutes
  difficulty: 'easy' | 'medium' | 'hard';
  testType: 'practice' | 'mock' | 'chapter' | 'weekly';
  status: 'upcoming' | 'live' | 'completed' | 'expired';
  scheduledAt: string | null;
  endTime: string | null;
  attempts: number;
  maxAttempts: number;
  hasAttempted: boolean;
  bestScore: number | null;
  instructions: string[];
}

export default function StudentTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'all' | 'upcoming' | 'live' | 'completed'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const response = await fetch('/api/student/tests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setTests(data.data.tests);
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800'
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      practice: 'bg-blue-100 text-blue-800',
      mock: 'bg-purple-100 text-purple-800',
      chapter: 'bg-indigo-100 text-indigo-800',
      weekly: 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'bg-blue-100 text-blue-800',
      live: 'bg-green-100 text-green-800 animate-pulse',
      completed: 'bg-gray-100 text-gray-800',
      expired: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const getTimeRemaining = (date: string) => {
    const now = new Date();
    const target = new Date(date);
    const diff = target.getTime() - now.getTime();
    
    if (diff < 0) return 'Started';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const filteredTests = tests
    .filter(test => {
      if (selectedTab !== 'all' && test.status !== selectedTab) return false;
      if (selectedSubject !== 'all' && test.subject !== selectedSubject) return false;
      if (selectedType !== 'all' && test.testType !== selectedType) return false;
      if (searchQuery && !test.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
        const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
        return dateA - dateB;
      }
      return a.title.localeCompare(b.title);
    });

  const uniqueSubjects = [...new Set(tests.map(t => t.subject))];

  const stats = {
    total: tests.length,
    upcoming: tests.filter(t => t.status === 'upcoming').length,
    live: tests.filter(t => t.status === 'live').length,
    completed: tests.filter(t => t.status === 'completed' || t.hasAttempted).length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Tests</h1>
              <p className="text-sm text-gray-500 mt-1">View and take your assigned tests</p>
            </div>
            <Link
              href="/student/dashboard"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Tests</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Live Now</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.live}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Upcoming</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.upcoming}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Completed</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{stats.completed}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-4">
              {/* Subject Filter */}
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Subjects</option>
                {uniqueSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="practice">Practice</option>
                <option value="mock">Mock Test</option>
                <option value="chapter">Chapter Test</option>
                <option value="weekly">Weekly Test</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'title')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="date">Sort by Date</option>
                <option value="title">Sort by Title</option>
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setSelectedTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTab === 'all'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({tests.length})
            </button>
            <button
              onClick={() => setSelectedTab('live')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTab === 'live'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Live ({stats.live})
            </button>
            <button
              onClick={() => setSelectedTab('upcoming')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTab === 'upcoming'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Upcoming ({stats.upcoming})
            </button>
            <button
              onClick={() => setSelectedTab('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTab === 'completed'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Completed ({stats.completed})
            </button>
          </div>
        </div>

        {/* Tests Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTests.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500">No tests found</p>
            </div>
          ) : (
            filteredTests.map((test) => (
              <div
                key={test.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Status Banner */}
                {test.status === 'live' && (
                  <div className="bg-green-500 text-white text-xs font-medium px-3 py-1 text-center flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    LIVE NOW
                  </div>
                )}
                {test.status === 'upcoming' && test.scheduledAt && (
                  <div className="bg-blue-500 text-white text-xs font-medium px-3 py-1 text-center">
                    Starts in {getTimeRemaining(test.scheduledAt)}
                  </div>
                )}

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{test.title}</h3>
                      <p className="text-sm text-gray-500">{test.subject}</p>
                    </div>
                    <div className="flex gap-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(test.testType)}`}>
                        {test.testType.charAt(0).toUpperCase() + test.testType.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{test.description}</p>

                  {/* Test Details */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Questions</p>
                      <p className="font-semibold text-gray-900">{test.totalQuestions}</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="font-semibold text-gray-900">{formatDuration(test.duration)}</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Marks</p>
                      <p className="font-semibold text-gray-900">{test.totalMarks}</p>
                    </div>
                  </div>

                  {/* Difficulty & Attempts */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(test.difficulty)}`}>
                      {test.difficulty.charAt(0).toUpperCase() + test.difficulty.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {test.attempts}/{test.maxAttempts} attempts
                    </span>
                  </div>

                  {/* Previous Score (if attempted) */}
                  {test.hasAttempted && test.bestScore !== null && (
                    <div className="mb-4 p-2 bg-indigo-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-indigo-600">Best Score</span>
                        <span className="font-semibold text-indigo-700">{test.bestScore}%</span>
                      </div>
                    </div>
                  )}

                  {/* Schedule Info */}
                  {test.status === 'upcoming' && test.scheduledAt && (
                    <div className="text-xs text-gray-500 mb-4">
                      <span className="font-medium">Scheduled:</span>{' '}
                      {new Date(test.scheduledAt).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="flex gap-2">
                    {test.status === 'live' && !test.hasAttempted && (
                      <button
                        onClick={() => router.push(`/student/test/${test.id}`)}
                        className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        Start Test
                      </button>
                    )}
                    {test.status === 'live' && test.hasAttempted && test.attempts < test.maxAttempts && (
                      <button
                        onClick={() => router.push(`/student/test/${test.id}`)}
                        className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                      >
                        Retry Test
                      </button>
                    )}
                    {test.status === 'upcoming' && (
                      <button
                        disabled
                        className="flex-1 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
                      >
                        Not Available
                      </button>
                    )}
                    {test.status === 'completed' && (
                      <button
                        onClick={() => router.push(`/student/results?testId=${test.id}`)}
                        className="flex-1 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors"
                      >
                        View Result
                      </button>
                    )}
                    {test.status === 'expired' && (
                      <button
                        disabled
                        className="flex-1 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
                      >
                        Expired
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/student/test/${test.id}/instructions`)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Info
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}