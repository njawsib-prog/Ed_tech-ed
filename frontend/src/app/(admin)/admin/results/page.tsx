'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface TestResult {
  id: string;
  testId: string;
  testTitle: string;
  subject: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  batchName: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  rank: number | null;
  status: 'pass' | 'fail';
  grade: string;
  submittedAt: string;
  duration: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  reviewStatus: 'pending' | 'reviewed' | 'disputed';
  proctoringFlags?: number;
}

interface Test {
  id: string;
  title: string;
  subject: string;
  totalSubmissions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

function AdminResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [results, setResults] = useState<TestResult[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTest, setSelectedTest] = useState<string>(searchParams.get('testId') || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>(searchParams.get('status') || 'all');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'percentage' | 'rank'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'leaderboard'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showExportModal, setShowExportModal] = useState(false);

  const itemsPerPage = 25;

  useEffect(() => {
    fetchResults();
    fetchTests();
  }, [currentPage, selectedTest, selectedStatus, selectedReviewStatus, selectedBatch, sortBy, sortOrder]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        testId: selectedTest,
        status: selectedStatus,
        reviewStatus: selectedReviewStatus,
        batchId: selectedBatch,
        sortBy,
        sortOrder,
        search: searchQuery
      });

      const response = await fetch(`/api/admin/results?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setResults(data.data.results);
        setTotalPages(Math.ceil(data.data.total / itemsPerPage));
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/tests?status=completed', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setTests(data.data.tests);
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchResults();
  };

  const handleSelectAll = () => {
    if (selectedResults.length === results.length) {
      setSelectedResults([]);
    } else {
      setSelectedResults(results.map(r => r.id));
    }
  };

  const handleSelectResult = (id: string) => {
    setSelectedResults(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        testId: selectedTest,
        status: selectedStatus,
        batchId: selectedBatch,
        format
      });

      if (selectedResults.length > 0) {
        params.append('resultIds', selectedResults.join(','));
      }

      const response = await fetch(`/api/admin/results/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `results.${format}`;
      a.click();
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting results:', error);
    }
  };

  const handleBulkAction = async (action: 'review' | 're-evaluate' | 'publish') => {
    if (selectedResults.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      await fetch('/api/admin/results/bulk-action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resultIds: selectedResults, action })
      });
      fetchResults();
      setSelectedResults([]);
    } catch (error) {
      console.error('Error performing bulk action:', error);
    }
  };

  const handleReevaluate = async (resultId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/admin/results/${resultId}/re-evaluate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchResults();
    } catch (error) {
      console.error('Error re-evaluating result:', error);
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'pass' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      'A+': 'text-green-600',
      'A': 'text-green-500',
      'B+': 'text-blue-600',
      'B': 'text-blue-500',
      'C+': 'text-yellow-600',
      'C': 'text-yellow-500',
      'D': 'text-orange-600',
      'F': 'text-red-600'
    };
    return colors[grade] || 'text-gray-600';
  };

  const getReviewStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      reviewed: 'bg-green-100 text-green-800',
      disputed: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const stats = {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    averageScore: results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
      : 0,
    pending: results.filter(r => r.reviewStatus === 'pending').length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Results</h1>
              <p className="text-sm text-gray-500 mt-1">View and manage test results</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 uppercase">Total Results</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 uppercase">Passed</p>
            <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 uppercase">Failed</p>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 uppercase">Avg Score</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.averageScore}%</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 uppercase">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by student name or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </form>

            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedTest}
                onChange={(e) => { setSelectedTest(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Tests</option>
                {tests.map(test => (
                  <option key={test.id} value={test.id}>{test.title}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="pass">Passed</option>
                <option value="fail">Failed</option>
              </select>

              <select
                value={selectedReviewStatus}
                onChange={(e) => { setSelectedReviewStatus(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Reviews</option>
                <option value="pending">Pending Review</option>
                <option value="reviewed">Reviewed</option>
                <option value="disputed">Disputed</option>
              </select>

              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [by, order] = e.target.value.split('-');
                  setSortBy(by as 'date' | 'percentage' | 'rank');
                  setSortOrder(order as 'asc' | 'desc');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="percentage-desc">Highest Score</option>
                <option value="percentage-asc">Lowest Score</option>
                <option value="rank-asc">Best Rank</option>
              </select>

              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 ${viewMode === 'table' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-500'}`}
                  title="Table View"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('leaderboard')}
                  className={`p-2 ${viewMode === 'leaderboard' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-500'}`}
                  title="Leaderboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedResults.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-500">{selectedResults.length} selected</span>
              <button onClick={() => handleBulkAction('review')} className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">Mark Reviewed</button>
              <button onClick={() => handleBulkAction('re-evaluate')} className="px-3 py-1 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100">Re-evaluate</button>
              <button onClick={() => handleBulkAction('publish')} className="px-3 py-1 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100">Publish</button>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : viewMode === 'leaderboard' ? (
          // Leaderboard View
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Leaderboard</h3>
              <div className="space-y-3">
                {results
                  .filter(r => r.rank !== null)
                  .sort((a, b) => (a.rank || 999) - (b.rank || 999))
                  .slice(0, 20)
                  .map((result, index) => (
                    <div
                      key={result.id}
                      className={`flex items-center gap-4 p-4 rounded-xl ${
                        index === 0 ? 'bg-yellow-50 border-2 border-yellow-200' :
                        index === 1 ? 'bg-gray-100 border-2 border-gray-200' :
                        index === 2 ? 'bg-orange-50 border-2 border-orange-200' :
                        'bg-gray-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-gray-300 text-gray-700' :
                        index === 2 ? 'bg-orange-400 text-orange-900' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {result.rank}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{result.studentName}</p>
                        <p className="text-sm text-gray-500">{result.studentRollNumber} • {result.batchName}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${getGradeColor(result.grade)}`}>{result.percentage}%</p>
                        <p className="text-sm text-gray-500">{result.obtainedMarks}/{result.totalMarks}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          // Table View
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedResults.length === results.length && results.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Review</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedResults.includes(result.id)}
                          onChange={() => handleSelectResult(result.id)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{result.studentName}</p>
                          <p className="text-sm text-gray-500">{result.studentRollNumber}</p>
                          <p className="text-xs text-gray-400">{result.batchName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{result.testTitle}</p>
                          <p className="text-sm text-gray-500">{result.subject}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className={`text-lg font-bold ${getGradeColor(result.grade)}`}>
                            {result.percentage}%
                          </p>
                          <p className="text-sm text-gray-500">{result.obtainedMarks}/{result.totalMarks}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-green-600">✓{result.correctAnswers}</span>
                            <span className="text-xs text-red-600">✗{result.wrongAnswers}</span>
                            <span className="text-xs text-gray-400">-{result.unattempted}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-lg font-bold ${getGradeColor(result.grade)}`}>
                          {result.grade}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {result.rank ? (
                          <span className="font-medium text-gray-900">#{result.rank}</span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                          {result.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReviewStatusColor(result.reviewStatus)}`}>
                          {result.reviewStatus}
                        </span>
                        {result.proctoringFlags && result.proctoringFlags > 0 && (
                          <span className="ml-1 text-xs text-red-500">⚠️ {result.proctoringFlags}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-500">
                          {new Date(result.submittedAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {Math.round(result.duration / 60)} min
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/admin/results/${result.id}`)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleReevaluate(result.id)}
                            className="text-gray-600 hover:text-gray-900 text-sm"
                          >
                            Re-evaluate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">Page {currentPage} of {totalPages}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Results</h3>
            <p className="text-sm text-gray-500 mb-4">
              Choose the format for exporting {selectedResults.length > 0 ? `${selectedResults.length} selected` : 'all'} results.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleExport('csv')}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Export as PDF
              </button>
            </div>
            <button
              onClick={() => setShowExportModal(false)}
              className="mt-4 w-full px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminResultsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
      <AdminResultsContent />
    </Suspense>
  );
}