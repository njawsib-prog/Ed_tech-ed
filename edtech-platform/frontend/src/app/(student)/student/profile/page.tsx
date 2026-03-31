'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface StudentProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  rollNumber: string;
  batchName: string;
  batchId: string;
  branchName: string;
  branchId: string;
  instituteName: string;
  avatar: string | null;
  dateOfBirth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  parentName: string | null;
  parentPhone: string | null;
  joiningDate: string;
  enrollmentStatus: 'active' | 'inactive' | 'graduated' | 'dropped';
}

interface AcademicStats {
  totalTests: number;
  averageScore: number;
  highestScore: number;
  attendancePercentage: number;
  rank: number | null;
  totalStudentsInBatch: number;
}

interface TestHistory {
  id: string;
  testTitle: string;
  date: string;
  score: number;
  rank: number | null;
}

interface PaymentRecord {
  id: string;
  receiptNumber: string;
  amount: number;
  paymentType: string;
  paymentDate: string;
  status: 'completed' | 'pending' | 'failed';
}

export default function StudentProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [stats, setStats] = useState<AcademicStats | null>(null);
  const [testHistory, setTestHistory] = useState<TestHistory[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tests' | 'payments' | 'settings'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch profile
      const profileRes = await fetch('/api/student/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profileData = await profileRes.json();
      
      if (profileData.success) {
        setProfile(profileData.data.profile);
        setEditForm({
          phone: profileData.data.profile.phone || '',
          address: profileData.data.profile.address || '',
          city: profileData.data.profile.city || '',
          state: profileData.data.profile.state || '',
          pincode: profileData.data.profile.pincode || ''
        });
      }

      // Fetch stats
      const statsRes = await fetch('/api/student/profile/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.data.stats);
      }

      // Fetch test history
      const testsRes = await fetch('/api/student/profile/tests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const testsData = await testsRes.json();
      if (testsData.success) {
        setTestHistory(testsData.data.tests);
      }

      // Fetch payments
      const paymentsRes = await fetch('/api/student/profile/payments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const paymentsData = await paymentsRes.json();
      if (paymentsData.success) {
        setPayments(paymentsData.data.payments);
      }

    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/student/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });
      
      const data = await response.json();
      if (data.success) {
        setProfile(prev => prev ? { ...prev, ...editForm } : null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/student/profile/avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setProfile(prev => prev ? { ...prev, avatar: data.data.avatarUrl } : null);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      graduated: 'bg-blue-100 text-blue-800',
      dropped: 'bg-red-100 text-red-800',
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Profile not found</p>
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
              <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your account and view your academic information</p>
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
        {/* Profile Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          {/* Cover Gradient */}
          <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          
          <div className="relative px-6 pb-6">
            {/* Avatar */}
            <div className="absolute -top-16 left-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-200 overflow-hidden">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-100">
                      <span className="text-4xl font-bold text-indigo-600">
                        {profile.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Profile Info */}
            <div className="pt-20 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
                <p className="text-gray-500">{profile.email}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(profile.enrollmentStatus)}`}>
                    {profile.enrollmentStatus.charAt(0).toUpperCase() + profile.enrollmentStatus.slice(1)}
                  </span>
                  <span className="text-sm text-gray-500">Roll No: {profile.rollNumber}</span>
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-500">{profile.batchName}</span>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'tests', label: 'Test History' },
                { id: 'payments', label: 'Payments' },
                { id: 'settings', label: 'Settings' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Personal Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                  
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <textarea
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                          <input
                            type="text"
                            value={editForm.city}
                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                          <input
                            type="text"
                            value={editForm.state}
                            onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                          <input
                            type="text"
                            value={editForm.pincode}
                            onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleUpdateProfile}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  ) : (
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Phone</dt>
                        <dd className="text-sm font-medium text-gray-900">{profile.phone || 'Not provided'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Date of Birth</dt>
                        <dd className="text-sm font-medium text-gray-900">
                          {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : 'Not provided'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Gender</dt>
                        <dd className="text-sm font-medium text-gray-900">
                          {profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Not provided'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Address</dt>
                        <dd className="text-sm font-medium text-gray-900 text-right">
                          {profile.address ? `${profile.address}, ${profile.city}, ${profile.state} - ${profile.pincode}` : 'Not provided'}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>

                {/* Academic Stats */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Statistics</h3>
                  
                  {stats && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-indigo-50 rounded-lg p-4">
                        <p className="text-sm text-indigo-600">Total Tests</p>
                        <p className="text-2xl font-bold text-indigo-700">{stats.totalTests}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-green-600">Average Score</p>
                        <p className="text-2xl font-bold text-green-700">{stats.averageScore}%</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-sm text-purple-600">Highest Score</p>
                        <p className="text-2xl font-bold text-purple-700">{stats.highestScore}%</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-blue-600">Attendance</p>
                        <p className="text-2xl font-bold text-blue-700">{stats.attendancePercentage}%</p>
                      </div>
                      <div className="col-span-2 bg-yellow-50 rounded-lg p-4">
                        <p className="text-sm text-yellow-600">Batch Rank</p>
                        <p className="text-2xl font-bold text-yellow-700">
                          {stats.rank ? `#${stats.rank} of ${stats.totalStudentsInBatch}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Institute & Batch Info */}
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Institution Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Institute</p>
                      <p className="font-medium text-gray-900 mt-1">{profile.instituteName}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Branch</p>
                      <p className="font-medium text-gray-900 mt-1">{profile.branchName}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Batch</p>
                      <p className="font-medium text-gray-900 mt-1">{profile.batchName}</p>
                    </div>
                  </div>
                </div>

                {/* Parent/Guardian Info */}
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Parent/Guardian Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
                      <p className="font-medium text-gray-900 mt-1">{profile.parentName || 'Not provided'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Contact</p>
                      <p className="font-medium text-gray-900 mt-1">{profile.parentPhone || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Test History Tab */}
            {activeTab === 'tests' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Test History</h3>
                
                {testHistory.length === 0 ? (
                  <p className="text-gray-500">No test history available</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {testHistory.map((test) => (
                          <tr key={test.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-sm font-medium text-gray-900">{test.testTitle}</td>
                            <td className="px-4 py-4 text-sm text-gray-500">{new Date(test.date).toLocaleDateString()}</td>
                            <td className="px-4 py-4 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                test.score >= 80 ? 'bg-green-100 text-green-800' :
                                test.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {test.score}%
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              {test.rank ? `#${test.rank}` : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
                
                {payments.length === 0 ? (
                  <p className="text-gray-500">No payment records available</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt No.</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-sm font-medium text-gray-900">{payment.receiptNumber}</td>
                            <td className="px-4 py-4 text-sm text-gray-500">{payment.paymentType}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">₹{payment.amount.toLocaleString()}</td>
                            <td className="px-4 py-4 text-sm text-gray-500">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                            <td className="px-4 py-4 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="max-w-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h3>
                
                <div className="space-y-6">
                  {/* Change Password */}
                  <div className="border-b border-gray-200 pb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Change Password</h4>
                    <p className="text-sm text-gray-500 mb-4">Update your password to keep your account secure</p>
                    <button
                      onClick={() => router.push('/student/change-password')}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      Change Password
                    </button>
                  </div>

                  {/* Notification Preferences */}
                  <div className="border-b border-gray-200 pb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Notification Preferences</h4>
                    <p className="text-sm text-gray-500 mb-4">Manage how you receive notifications</p>
                    <div className="space-y-3">
                      {[
                        { id: 'email', label: 'Email notifications' },
                        { id: 'sms', label: 'SMS notifications' },
                        { id: 'test_reminders', label: 'Test reminders' },
                        { id: 'result_alerts', label: 'Result alerts' }
                      ].map((pref) => (
                        <label key={pref.id} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{pref.label}</span>
                          <input
                            type="checkbox"
                            defaultChecked
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div>
                    <h4 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h4>
                    <p className="text-sm text-gray-500 mb-4">Once you deactivate your account, there is no going back</p>
                    <button className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-100 transition-colors">
                      Deactivate Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}