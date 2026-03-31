'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Test {
  id: string;
  title: string;
  subject: string;
  description: string;
  testType: 'practice' | 'mock' | 'chapter' | 'weekly';
  difficulty: 'easy' | 'medium' | 'hard';
  totalQuestions: number;
  totalMarks: number;
  duration: number;
  status: 'draft' | 'published' | 'scheduled' | 'live' | 'completed' | 'archived';
  scheduledAt: string | null;
  endTime: string | null;
  batches: { id: string; name: string }[];
  submissions: number;
  averageScore: number;
  highestScore: number;
  passingPercentage: number;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export default function AdminTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTests();
  }, [selectedType, selectedStatus, selectedSubject]);

  const fetchTests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        type: selectedType,
        status: selectedStatus,
        subject: selectedSubject,
        search: searchQuery
      });

      const response = await fetch(`/api/admin/tests?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTests();
  };

  const handleSelectAll = () => {
    if (selectedTests.length === tests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(tests.map(t => t.id));
    }
  };

  const handleSelectTest = (id: string) => {
    setSelectedTests(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (action: 'publish' | 'archive' | 'duplicate' | 'delete') => {
    if (selectedTests.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      await fetch('/api/admin/tests/bulk-action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ testIds: selectedTests, action })
      });
      fetchTests();
      setSelectedTests([]);
    } catch (error) {
      console.error('Error performing bulk action:', error);
    }
  };

  const handleStatusChange = async (testId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/admin/tests/${testId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTests();
    } catch (error) {
      console.error('Error updating test status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      published: 'bg-blue-100 text-blue-800',
      scheduled: 'bg-indigo-100 text-indigo-800',
      live: 'bg-green-100 text-green-800',
      completed: 'bg-purple-100 text-purple-800',
      archived: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      practice: 'bg-cyan-100 text-cyan-800',
      mock: 'bg-purple-100 text-purple-800',
      chapter: 'bg-indigo-100 text-indigo-800',
      weekly: 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: 'text-green-600',
      medium: 'text-yellow-600',
      hard: 'text-red-600'
    };
    return colors[difficulty] || 'text-gray-600';
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const uniqueSubjects = [...new Set(tests.map(t => t.subject))];

  const stats = {
    total: tests.length,
    drafts: tests.filter(t => t.status === 'draft').length,
    published: tests.filter(t => t.status === 'published' || t.status === 'scheduled').length,
    live: tests.filter(t => t.status === 'live').length,
    completed: tests.filter(t => t.status === 'completed').length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tests</h1>
              <p className="text-sm text-gray-500 mt-1">Create and manage tests for your students</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/tests/create"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                + Create Test
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <button onClick={() => setSelectedStatus('all')} className={`p-4 rounded-xl border transition-colors ${selectedStatus === 'all' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'}`}>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Tests</p>
          </button>
          <button onClick={() => setSelectedStatus('draft')} className={`p-4 rounded-xl border transition-colors ${selectedStatus === 'draft' ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'}`}>
            <p className="text-2xl font-bold text-gray-600">{stats.drafts}</p>
            <p className="text-sm text-gray-500">Drafts</p>
          </button>
          <button onClick={() => setSelectedStatus('published')} className={`p-4 rounded-xl border transition-colors ${selectedStatus === 'published' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
            <p className="text-2xl font-bold text-blue-600">{stats.published}</p>
            <p className="text-sm text-gray-500">Published</p>
          </button>
          <button onClick={() => setSelectedStatus('live')} className={`p-4 rounded-xl border transition-colors ${selectedStatus === 'live' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
            <p className="text-2xl font-bold text-green-600">{stats.live}</p>
            <p className="text-sm text-gray-500">Live</p>
          </button>
          <button onClick={() => setSelectedStatus('completed')} className={`p-4 rounded-xl border transition-colors ${selectedStatus === 'completed' ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}>
            <p className="text-2xl font-bold text-purple-600">{stats.completed}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </form>

            <div className="flex items-center gap-4">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="practice">Practice</option>
                <option value="mock">Mock Test</option>
                <option value="chapter">Chapter Test</option>
                <option value="weekly">Weekly Test</option>
              </select>

              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Subjects</option>
                {uniqueSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>

              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-500'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-500'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedTests.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-500">{selectedTests.length} tests selected</span>
              <button onClick={() => handleBulkAction('publish')} className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">Publish</button>
              <button onClick={() => handleBulkAction('archive')} className="px-3 py-1 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100">Archive</button>
              <button onClick={() => handleBulkAction('duplicate')} className="px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100">Duplicate</button>
              <button onClick={() => handleBulkAction('delete')} className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100">Delete</button>
            </div>
          )}
        </div>

        {/* Tests Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : tests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 mb-4">No tests found</p>
            <Link href="/admin/tests/create" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              Create your first test
            </Link>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.map((test) => (
              <div key={test.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {/* Selection & Status */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <input
                      type="checkbox"
                      checked={selectedTests.includes(test.id)}
                      onChange={() => handleSelectTest(test.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(test.status)}`}>
                        {test.status}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(test.testType)}`}>
                        {test.testType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{test.title}</h3>
                  <p className="text-sm text-gray-500 mb-3">{test.subject}</p>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{test.totalQuestions}</p>
                      <p className="text-xs text-gray-500">Questions</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{formatDuration(test.duration)}</p>
                      <p className="text-xs text-gray-500">Duration</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{test.totalMarks}</p>
                      <p className="text-xs text-gray-500">Marks</p>
                    </div>
                  </div>

                  {/* Batches */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Assigned to:</p>
                    <div className="flex flex-wrap gap-1">
                      {test.batches.slice(0, 2).map(batch => (
                        <span key={batch.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">
                          {batch.name}
                        </span>
                      ))}
                      {test.batches.length > 2 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          +{test.batches.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats for completed tests */}
                  {test.status === 'completed' && (
                    <div className="grid grid-cols-3 gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-900">{test.submissions}</p>
                        <p className="text-xs text-gray-500">Submissions</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-indigo-600">{test.averageScore}%</p>
                        <p className="text-xs text-gray-500">Avg Score</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-green-600">{test.highestScore}%</p>
                        <p className="text-xs text-gray-500">Highest</p>
                      </div>
                    </div>
                  )}

                  {/* Schedule Info */}
                  {test.scheduledAt && (
                    <p className="text-xs text-gray-500 mb-4">
                      📅 Scheduled: {new Date(test.scheduledAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {test.status === 'draft' && (
                        <button
                          onClick={() => handleStatusChange(test.id, 'published')}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                        >
                          Publish
                        </button>
                      )}
                      {test.status === 'published' && (
                        <button
                          onClick={() => handleStatusChange(test.id, 'live')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                        >
                          Go Live
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/admin/tests/${test.id}`)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="View"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => router.push(`/admin/tests/${test.id}/edit`)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => router.push(`/admin/tests/${test.id}/results`)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Results"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedTests.length === tests.length && tests.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Questions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submissions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTests.includes(test.id)}
                        onChange={() => handleSelectTest(test.id)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{test.title}</p>
                        <p className="text-sm text-gray-500">{test.subject}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(test.testType)}`}>
                        {test.testType}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">{test.totalQuestions}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{formatDuration(test.duration)}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(test.status)}`}>
                        {test.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">{test.submissions}</td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${
                        test.averageScore >= 70 ? 'text-green-600' :
                        test.averageScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {test.averageScore}%
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => router.push(`/admin/tests/${test.id}`)} className="text-indigo-600 hover:text-indigo-900 text-sm">View</button>
                        <button onClick={() => router.push(`/admin/tests/${test.id}/edit`)} className="text-gray-600 hover:text-gray-900 text-sm">Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}