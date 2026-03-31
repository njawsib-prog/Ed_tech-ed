'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalTests: number;
  pendingResults: number;
  todayAttendance: number;
  attendancePercentage: number;
  totalBatches: number;
  activeBatches: number;
  totalFaculty: number;
  activeFaculty: number;
  upcomingTests: number;
  pendingComplaints: number;
}

interface RecentActivity {
  id: string;
  type: 'test_submitted' | 'student_enrolled' | 'payment_received' | 'complaint_filed' | 'material_uploaded';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface UpcomingEvent {
  id: string;
  title: string;
  type: 'test' | 'holiday' | 'event' | 'deadline';
  date: string;
  description?: string;
}

interface PerformanceData {
  subject: string;
  averageScore: number;
  testCount: number;
  trend: number;
}

interface AttendanceTrend {
  date: string;
  present: number;
  absent: number;
  percentage: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch all dashboard data in parallel
      const [statsRes, activityRes, eventsRes, performanceRes, attendanceRes] = await Promise.all([
        fetch(`/api/admin/dashboard/stats?period=${selectedPeriod}`, { headers }),
        fetch('/api/admin/dashboard/activity', { headers }),
        fetch('/api/admin/dashboard/events', { headers }),
        fetch(`/api/admin/dashboard/performance?period=${selectedPeriod}`, { headers }),
        fetch(`/api/admin/dashboard/attendance?period=${selectedPeriod}`, { headers })
      ]);

      const [statsData, activityData, eventsData, performanceData, attendanceData] = await Promise.all([
        statsRes.json(),
        activityRes.json(),
        eventsRes.json(),
        performanceRes.json(),
        attendanceRes.json()
      ]);

      if (statsData.success) setStats(statsData.data.stats);
      if (activityData.success) setRecentActivity(activityData.data.activities);
      if (eventsData.success) setUpcomingEvents(eventsData.data.events);
      if (performanceData.success) setPerformanceData(performanceData.data.performance);
      if (attendanceData.success) setAttendanceTrend(attendanceData.data.trend);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, { icon: JSX.Element; color: string; bg: string }> = {
      test_submitted: {
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 6l2 2 4-4" /></svg>,
        color: 'text-green-600',
        bg: 'bg-green-100'
      },
      student_enrolled: {
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
        color: 'text-blue-600',
        bg: 'bg-blue-100'
      },
      payment_received: {
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        color: 'text-emerald-600',
        bg: 'bg-emerald-100'
      },
      complaint_filed: {
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
        color: 'text-orange-600',
        bg: 'bg-orange-100'
      },
      material_uploaded: {
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
        color: 'text-purple-600',
        bg: 'bg-purple-100'
      }
    };
    return icons[type] || icons.test_submitted;
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      test: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      holiday: 'bg-pink-100 text-pink-700 border-pink-200',
      event: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      deadline: 'bg-red-100 text-red-700 border-red-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as typeof selectedPeriod)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
              <button
                onClick={() => fetchDashboardData()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {/* Total Students */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Students</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalStudents || 0}</p>
                <p className="text-xs text-green-600 mt-1">{stats?.activeStudents || 0} active</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <Link href="/admin/students" className="text-xs text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
              View all →
            </Link>
          </div>

          {/* Total Tests */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Tests</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalTests || 0}</p>
                <p className="text-xs text-indigo-600 mt-1">{stats?.upcomingTests || 0} upcoming</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <Link href="/admin/tests" className="text-xs text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
              Manage tests →
            </Link>
          </div>

          {/* Today's Attendance */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Today's Attendance</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.attendancePercentage || 0}%</p>
                <p className="text-xs text-gray-500 mt-1">{stats?.todayAttendance || 0} present</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 6l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <Link href="/admin/attendance" className="text-xs text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
              View details →
            </Link>
          </div>

          {/* Pending Results */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Pending Results</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{stats?.pendingResults || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Awaiting review</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <Link href="/admin/results?status=pending" className="text-xs text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
              Review now →
            </Link>
          </div>

          {/* Batches */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Active Batches</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.activeBatches || 0}</p>
                <p className="text-xs text-gray-500 mt-1">of {stats?.totalBatches || 0} total</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <Link href="/admin/batches" className="text-xs text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
              Manage batches →
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Create Test', href: '/admin/tests/create', icon: '📝', color: 'bg-indigo-50 hover:bg-indigo-100' },
              { label: 'Add Student', href: '/admin/students/create', icon: '👤', color: 'bg-blue-50 hover:bg-blue-100' },
              { label: 'Upload Material', href: '/admin/materials/upload', icon: '📚', color: 'bg-purple-50 hover:bg-purple-100' },
              { label: 'Take Attendance', href: '/admin/attendance/take', icon: '✅', color: 'bg-green-50 hover:bg-green-100' },
              { label: 'Send Notification', href: '/admin/notifications/send', icon: '🔔', color: 'bg-yellow-50 hover:bg-yellow-100' },
              { label: 'View Reports', href: '/admin/reports', icon: '📊', color: 'bg-pink-50 hover:bg-pink-100' }
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`flex flex-col items-center justify-center p-4 rounded-xl transition-colors ${action.color}`}
              >
                <span className="text-2xl mb-2">{action.icon}</span>
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Overview */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Performance by Subject</h3>
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1">
                <option>Last 30 days</option>
                <option>Last 90 days</option>
                <option>All time</option>
              </select>
            </div>
            
            {performanceData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No performance data available
              </div>
            ) : (
              <div className="space-y-4">
                {performanceData.map((subject) => (
                  <div key={subject.subject} className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium text-gray-700 truncate">{subject.subject}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          subject.averageScore >= 70 ? 'bg-green-500' :
                          subject.averageScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${subject.averageScore}%` }}
                      />
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-sm font-semibold text-gray-900">{subject.averageScore}%</span>
                      {subject.trend !== 0 && (
                        <span className={`text-xs ml-1 ${subject.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {subject.trend > 0 ? '↑' : '↓'}{Math.abs(subject.trend)}
                        </span>
                      )}
                    </div>
                    <div className="w-20 text-xs text-gray-500">{subject.testCount} tests</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
              <Link href="/admin/calendar" className="text-sm text-indigo-600 hover:text-indigo-700">
                View calendar
              </Link>
            </div>
            
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No upcoming events
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border ${getEventTypeColor(event.type)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{event.title}</p>
                        {event.description && (
                          <p className="text-xs mt-1 opacity-75">{event.description}</p>
                        )}
                      </div>
                      <span className="text-xs font-medium">
                        {new Date(event.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Attendance Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Trend</h3>
            
            {attendanceTrend.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No attendance data available
              </div>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {attendanceTrend.map((day, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-t transition-colors ${
                        day.percentage >= 80 ? 'bg-green-500' :
                        day.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ height: `${day.percentage}%` }}
                      title={`${day.present} present, ${day.absent} absent`}
                    />
                    <span className="text-xs text-gray-500 mt-1">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <Link href="/admin/activity" className="text-sm text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            </div>
            
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No recent activity
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 6).map((activity) => {
                  const { icon, color, bg } = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${bg} ${color}`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{activity.message}</p>
                        <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Alerts Section */}
        {(stats?.pendingComplaints || 0) > 0 && (
          <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-orange-800">{stats?.pendingComplaints} pending complaints</p>
                  <p className="text-sm text-orange-600">Students are waiting for resolution</p>
                </div>
              </div>
              <Link
                href="/admin/complaints?status=pending"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                Review Now
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}