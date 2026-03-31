'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components/ui';
import { useInstitute } from '@/hooks/useInstitute';
import { authApi } from '@/lib/apiClient';

type Role = 'super_admin' | 'branch_admin' | 'student';

interface LoginFormProps {
  role: Role;
  redirectPath: string;
}

export function LoginForm({ role, redirectPath }: LoginFormProps) {
  const router = useRouter();
  const config = useInstitute();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requires2FA, setRequires2FA] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let response;
      if (role === 'student') {
        response = await authApi.studentLogin(studentCode, password);
      } else if (role === 'super_admin') {
        if (requires2FA) {
          response = await authApi.superAdminLogin(email, password, totpCode);
        } else {
          response = await authApi.superAdminLogin(email, password);
        }
      } else {
        if (requires2FA) {
          response = await authApi.adminLogin(email, password, totpCode);
        } else {
          response = await authApi.adminLogin(email, password);
        }
      }

      if (response.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      router.push(redirectPath);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleTitle = () => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'branch_admin':
        return 'Branch Admin';
      case 'student':
        return 'Student';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src={config.logo.url}
            alt={config.name}
            className="h-12 mx-auto mb-4"
            width={config.logo.width}
            height={config.logo.height}
          />
          <h1 className="text-2xl font-bold text-gray-900">{getRoleTitle()} Login</h1>
          <p className="text-gray-500 mt-1">{config.tagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {role === 'student' ? (
            <Input
              label="Student Code"
              type="text"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
              placeholder="Enter your student code"
              required
            />
          ) : (
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          )}

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          {requires2FA && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Enter the 6-digit code from your authenticator app
              </p>
              <Input
                label="2FA Code"
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            className="w-full"
          >
            {requires2FA ? 'Verify & Login' : 'Login'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </a>
        </div>

        <div className="mt-4 text-center text-xs text-gray-500">
          Need help? Contact{' '}
          <a
            href={`mailto:${config.supportEmail}`}
            className="text-primary hover:underline"
          >
            {config.supportEmail}
          </a>
        </div>
      </Card>
    </div>
  );
}

export default LoginForm;