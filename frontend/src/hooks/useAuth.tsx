'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/apiClient';

export type UserRole = 'super_admin' | 'branch_admin' | 'student' | null;

export interface User {
  id: string;
  email?: string;
  role: UserRole;
  branch_id?: string;
  student_id?: string;
  name?: string;
  student_code?: string;
  branch?: {
    id: string;
    name: string;
    location?: string;
  };
  course?: {
    id: string;
    title: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (role: 'super_admin' | 'branch_admin' | 'student', credentials: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authApi.getCurrentUser();
      
      if (response.user) {
        const userData = response.user;
        
        if (userData.role === 'student') {
          setUser({
            id: userData.users?.id || userData.id,
            student_id: userData.id,
            name: userData.name,
            student_code: userData.student_code,
            role: 'student',
            branch_id: userData.branches?.id,
            branch: userData.branches,
            course: userData.courses,
          });
        } else if (userData.role === 'branch_admin') {
          const admin = userData.admins?.[0];
          setUser({
            id: userData.id,
            email: userData.email,
            role: 'branch_admin',
            branch_id: admin?.branch_id,
            name: admin?.name,
            branch: admin?.branches,
          });
        } else {
          setUser({
            id: userData.id,
            email: userData.email,
            role: userData.role,
          });
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (
    role: 'super_admin' | 'branch_admin' | 'student',
    credentials: Record<string, string>
  ) => {
    try {
      setError(null);
      setLoading(true);

      let response;
      if (role === 'super_admin') {
        response = await authApi.superAdminLogin(credentials.email, credentials.password, credentials.totp_code);
      } else if (role === 'branch_admin') {
        response = await authApi.adminLogin(credentials.email, credentials.password, credentials.totp_code);
      } else {
        response = await authApi.studentLogin(credentials.student_code, credentials.password);
      }

      // Check if 2FA is required
      if (response.requires2FA) {
        setError('2FA_REQUIRED');
        return;
      }

      // Redirect based on role
      if (role === 'super_admin') {
        router.push('/super-admin');
      } else if (role === 'branch_admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }

      await checkAuth();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      router.push('/');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to require authentication for a page
 * Redirects to login if not authenticated
 */
export function useRequireAuth(allowedRoles?: UserRole[]) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Redirect to appropriate login
      const path = window.location.pathname;
      if (path.startsWith('/super-admin')) {
        router.push('/super-admin/login');
      } else if (path.startsWith('/admin')) {
        router.push('/admin/login');
      } else {
        router.push('/');
      }
    }

    if (!loading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      // User doesn't have required role
      router.push('/');
    }
  }, [user, loading, isAuthenticated, allowedRoles, router]);

  return { user, loading, isAuthenticated };
}

export default useAuth;