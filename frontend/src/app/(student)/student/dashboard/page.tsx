'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import Link from 'next/link';

interface StudentData {
  id: string;
  name: string;
  enrollmentNumber: string;
  email: string;
  avatarUrl?: string;
  batch?: { id: string; name: string };
  branch?: { name: string; logo?: string };
}

interface DashboardStats {
  attendanceRate: number;
  totalTests: number;
  passedTests: number;
  passRate: number;
  averageScore: number;
  pendingFees: number;
  unreadNotifications: number;
}

interface UpcomingTest {
  id: string;
  title: string;
  type: string;
  duration: number;
  totalMarks: number;
  scheduledStart: string;
  scheduledEnd: string;
  subject?: { id: string; name: string };
}

interface RecentResult {
  id: string;
  score: number;
  totalMarks: number;
  percentage: number;
  status: string;
  submittedAt: string;
  test?: { id: string; title: string };
}

interface ScheduleItem {
  startTime: string;
  endTime: string;
  room?: string;
  subject?: { id: string; name: string; color?: string };
  faculty?: { id: string; name: string };
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingTests, setUpcomingTests] = useState<UpcomingTest[]>([]);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await apiClient.get('/student/dashboard');
        setStudent(response.data.student);
        setStats(response.data.stats);
        setUpcomingTests(response.data.upcomingTests || []);
        setRecentResults(response.data.recentResults || []);
        setTodaySchedule(response.data.todaySchedule || []);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDashboard();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {student?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-600 mt-1">
            {student?.batch?.name} • {student?.branch?.name}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">Attendance</div>
              <div className="text-2xl font-bold text-primary mt-1">{stats?.attendanceRate}%</div>
              <ProgressBar 
                value={stats?.attendanceRate || 0} 
                max={100} 
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">Tests Taken</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalTests}</div>
              <div className="text-sm text-green-600 mt-1">
                {stats?.passedTests} passed ({stats?.passRate}%)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">Avg Score</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats?.averageScore}%</div>
              <div className="text-sm text-gray-500 mt-1">Overall performance</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">Pending Fees</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{stats?.pendingFees}</div>
              <Link href="/student/fees" className="text-sm text-primary hover:underline mt-1 block">
                View details →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Tests */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Upcoming Tests</h2>
                <Link href="/student/tests" className="text-primary text-sm hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {upcomingTests.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No upcoming tests scheduled</p>
                ) : (
                  <div className="divide-y">
                    {upcomingTests.map((test) => (
                      <div key={test.id} className="py-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{test.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span>{test.subject?.name || 'General'}</span>
                            <span>{test.duration} mins</span>
                            <span>{test.totalMarks} marks</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {formatDate(test.scheduledStart)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatTime(test.scheduledStart)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Results */}
            <Card className="mt-6">
              <CardHeader className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent Results</h2>
                <Link href="/student/results" className="text-primary text-sm hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {recentResults.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No test results yet</p>
                ) : (
                  <div className="divide-y">
                    {recentResults.map((result) => (
                      <div key={result.id} className="py-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{result.test?.title}</h3>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDate(result.submittedAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-medium">{result.percentage.toFixed(1)}%</div>
                            <div className="text-sm text-gray-500">
                              {result.score}/{result.totalMarks}
                            </div>
                          </div>
                          <Badge className={getStatusColor(result.status)}>
                            {result.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Today's Schedule */}
          <div>
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Today's Schedule</h2>
              </CardHeader>
              <CardContent>
                {todaySchedule.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No classes scheduled today</p>
                ) : (
                  <div className="space-y-3">
                    {todaySchedule.map((item, index) => (
                      <div 
                        key={index} 
                        className="p-3 rounded-lg border-l-4 bg-gray-50"
                        style={{ borderLeftColor: item.subject?.color || '#3B82F6' }}
                      >
                        <div className="font-medium">{item.subject?.name}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {item.startTime} - {item.endTime}
                        </div>
                        {item.room && (
                          <div className="text-sm text-gray-500">Room: {item.room}</div>
                        )}
                        {item.faculty && (
                          <div className="text-sm text-gray-500">
                            {item.faculty.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-lg font-semibold">Quick Actions</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/student/materials"
                    className="p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📚</div>
                    <div className="text-sm font-medium">Study Materials</div>
                  </Link>
                  <Link
                    href="/student/timetable"
                    className="p-4 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📅</div>
                    <div className="text-sm font-medium">Timetable</div>
                  </Link>
                  <Link
                    href="/student/attendance"
                    className="p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">✅</div>
                    <div className="text-sm font-medium">Attendance</div>
                  </Link>
                  <Link
                    href="/student/notifications"
                    className="p-4 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors text-center relative"
                  >
                    <div className="text-2xl mb-2">🔔</div>
                    <div className="text-sm font-medium">Notifications</div>
                    {stats?.unreadNotifications ? (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {stats.unreadNotifications}
                      </span>
                    ) : null}
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}