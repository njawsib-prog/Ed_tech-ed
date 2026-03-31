import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  timeout: 30000,
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // You can add custom headers here if needed
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<{ error?: string; code?: string }>) => {
    // Handle specific error codes
    if (error.response) {
      const status = error.response.status;
      const errorCode = error.response.data?.code;

      console.error(`[API Error] HTTP ${status}:`, error.response.data);

      // Handle 401 Unauthorized — only redirect when NOT already on a login page
      if (status === 401) {
        if (typeof window !== 'undefined') {
          // Strip query parameters and trailing slashes for comparison
          const path = window.location.pathname.replace(/\/$/, '');
          const isLoginPage =
            path === '' ||
            path === '/admin/login' ||
            path === '/super-admin/login';

          if (!isLoginPage) {
            if (path.startsWith('/super-admin')) {
              window.location.href = '/super-admin/login';
            } else if (path.startsWith('/admin')) {
              window.location.href = '/admin/login';
            } else if (path.startsWith('/dashboard')) {
              window.location.href = '/';
            }
          }
        }
      }

      // Handle token expired
      if (errorCode === 'TOKEN_EXPIRED') {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    } else {
      // Network error or CORS block — no response object
      console.error('[API Error] Network/CORS error:', error.message);
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  // Super Admin Login
  superAdminLogin: async (email: string, password: string, totp_code?: string) => {
    const response = await apiClient.post('/api/auth/super-admin/login', { email, password, totp_code });
    return response.data;
  },

  // Branch Admin Login
  adminLogin: async (email: string, password: string, totp_code?: string) => {
    const response = await apiClient.post('/api/auth/admin/login', { email, password, totp_code });
    return response.data;
  },

  // Student Login
  studentLogin: async (student_code: string, password: string) => {
    const response = await apiClient.post('/api/auth/student/login', { student_code, password });
    return response.data;
  },

  // Logout
  logout: async () => {
    const response = await apiClient.post('/api/auth/logout');
    return response.data;
  },

  // Get Current User
  getCurrentUser: async () => {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },

  // Setup 2FA
  setup2FA: async () => {
    const response = await apiClient.post('/api/auth/2fa/setup');
    return response.data;
  },

  // Verify 2FA
  verify2FA: async (totp_code: string) => {
    const response = await apiClient.post('/api/auth/2fa/verify', { totp_code });
    return response.data;
  },
};

// Export the axios instance for custom API calls
export default apiClient;