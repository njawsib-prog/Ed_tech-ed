'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  batchName: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInTime: string | null;
  checkOutTime: string | null;
  method: 'qr' | 'manual' | 'biometric';
  remarks: string | null;
}

interface AttendanceSession {
  id: string;
  batchId: string;
  batchName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  qrCode: string;
  isActive: boolean;
}

interface Batch {
  id: string;
  name: string;
  studentCount: number;
}

export default function AdminAttendancePage() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'daily' | 'sessions' | 'report'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [showQRModal, setShowQRModal] = useState(false);
  const [activeQRSession, setActiveQRSession] = useState<AttendanceSession | null>(null);
  const [showTakeAttendance, setShowTakeAttendance] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (viewMode === 'daily') {
      fetchDailyAttendance();
    } else if (viewMode === 'sessions') {
      fetchSessions();
    }
  }, [viewMode, selectedDate, selectedBatch]);

  const fetchBatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/batches', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBatches(data.data.batches);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    }
  };

  const fetchDailyAttendance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        date: selectedDate,
        batchId: selectedBatch
      });

      const response = await fetch(`/api/admin/attendance?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setAttendance(data.data.attendance);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        date: selectedDate,
        batchId: selectedBatch
      });

      const response = await fetch(`/api/admin/attendance/sessions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setSessions(data.data.sessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async (batchId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/attendance/generate-qr', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchId, date: selectedDate })
      });
      const data = await response.json();
      
      if (data.success) {
        setActiveQRSession(data.data.session);
        setShowQRModal(true);
      }
    } catch (error) {
      console.error('Error generating QR:', error);
    }
  };

  const handleMarkAttendance = async (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/admin/attendance/mark', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId,
          date: selectedDate,
          status,
          method: 'manual'
        })
      });
      fetchDailyAttendance();
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  const handleBulkMark = async (status: 'present' | 'absent') => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/admin/attendance/bulk-mark', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: selectedDate,
          batchId: selectedBatch,
          status
        })
      });
      fetchDailyAttendance();
    } catch (error) {
      console.error('Error bulk marking attendance:', error);
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        date: selectedDate,
        batchId: selectedBatch
      });

      const response = await fetch(`/api/admin/attendance/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `attendance_${selectedDate}.csv`;
      a.click();
    } catch (error) {
      console.error('Error exporting attendance:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-yellow-100 text-yellow-800',
      excused: 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'qr':
        return '📱';
      case 'biometric':
        return '👆';
      default:
        return '✏️';
    }
  };

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    percentage: attendance.length > 0 
      ? Math.round((attendance.filter(a => a.status === 'present' || a.status === 'late').length / attendance.length) * 100)
      : 0
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
              <p className="text-sm text-gray-500 mt-1">Track and manage student attendance</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
              <button
                onClick={() => setShowTakeAttendance(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                + Take Attendance
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* View Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'daily', label: 'Daily View' },
            { id: 'sessions', label: 'QR Sessions' },
            { id: 'report', label: 'Reports' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as typeof viewMode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === tab.id
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Batches</option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>{batch.name}</option>
                ))}
              </select>
            </div>
            {viewMode === 'daily' && (
              <div className="md:ml-auto flex gap-2">
                <button
                  onClick={() => handleBulkMark('present')}
                  className="px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100"
                >
                  Mark All Present
                </button>
                <button
                  onClick={() => handleBulkMark('absent')}
                  className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm hover:bg-red-100"
                >
                  Mark All Absent
                </button>
              </div>
            )}
          </div>
        </div>

        {viewMode === 'daily' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase">Present</p>
                <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase">Absent</p>
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase">Late</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase">Attendance %</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.percentage}%</p>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : attendance.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No attendance records for this date</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {attendance.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium text-gray-900">{record.studentName}</p>
                              <p className="text-sm text-gray-500">{record.studentRollNumber}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">{record.batchName}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {record.checkInTime || '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {record.checkOutTime || '-'}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            <span title={record.method}>{getMethodIcon(record.method)}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleMarkAttendance(record.studentId, 'present')}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Mark Present"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleMarkAttendance(record.studentId, 'absent')}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Mark Absent"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleMarkAttendance(record.studentId, 'late')}
                                className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"
                                title="Mark Late"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {viewMode === 'sessions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Create New Session Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Generate QR Code</h3>
              <p className="text-sm text-gray-500 mb-4">
                Create a new attendance session with QR code for students to scan.
              </p>
              <select
                id="qr-batch-select"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              >
                <option value="">Select Batch</option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>{batch.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const select = document.getElementById('qr-batch-select') as HTMLSelectElement;
                  if (select.value) {
                    handleGenerateQR(select.value);
                  }
                }}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Generate QR Code
              </button>
            </div>

            {/* Active Sessions */}
            {sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className={`p-4 ${session.isActive ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{session.batchName}</h3>
                    {session.isActive && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{session.date}</p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 bg-green-50 rounded-lg">
                      <p className="font-bold text-green-600">{session.present}</p>
                      <p className="text-xs text-gray-500">Present</p>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded-lg">
                      <p className="font-bold text-red-600">{session.absent}</p>
                      <p className="text-xs text-gray-500">Absent</p>
                    </div>
                    <div className="text-center p-2 bg-yellow-50 rounded-lg">
                      <p className="font-bold text-yellow-600">{session.late}</p>
                      <p className="text-xs text-gray-500">Late</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setActiveQRSession(session);
                        setShowQRModal(true);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      View QR
                    </button>
                    <button
                      onClick={() => router.push(`/admin/attendance/session/${session.id}`)}
                      className="flex-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'report' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Attendance Reports</h3>
            <p className="text-gray-500 mb-6">Generate detailed attendance reports and analytics.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 cursor-pointer transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Monthly Report</h4>
                    <p className="text-sm text-gray-500">View monthly attendance statistics by batch</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 cursor-pointer transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Student Report</h4>
                    <p className="text-sm text-gray-500">Individual student attendance history</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 cursor-pointer transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Defaulter List</h4>
                    <p className="text-sm text-gray-500">Students with low attendance percentage</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 cursor-pointer transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Calendar View</h4>
                    <p className="text-sm text-gray-500">Visual calendar of attendance data</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* QR Code Modal */}
      {showQRModal && activeQRSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Attendance QR Code</h3>
              <p className="text-sm text-gray-500 mb-4">{activeQRSession.batchName}</p>
              
              {/* QR Code Placeholder */}
              <div className="w-48 h-48 mx-auto bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                <div className="text-center">
                  <svg className="w-24 h-24 text-gray-400 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h1v1h-1v-1zm-2 0h1v1h-1v-1zm1 1h1v1h-1v-1zm-1 1h1v1h-1v-1zm1 1h1v1h-1v-1zm-2 0h1v1h-1v-1zm1 1h1v1h-1v-1zm2 0h1v1h-1v-1zm1-3h1v1h-1v-1zm0 2h1v1h-1v-1zm-4 2h1v1h-1v-1zm2 0h1v1h-1v-1zm4 0h1v1h-1v-1z"/>
                  </svg>
                  <p className="text-xs text-gray-400 mt-2">QR Code</p>
                </div>
              </div>

              <div className="text-sm text-gray-500 mb-4">
                <p>Valid until: {activeQRSession.endTime}</p>
                <p className="text-green-600 font-medium">{activeQRSession.present} students checked in</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowQRModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Close
                </button>
                <button className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}