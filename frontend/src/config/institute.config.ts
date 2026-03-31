// Institute Configuration - White-Label Settings
// Change these values to customize the platform for different institutes

export interface InstituteConfig {
  name: string;
  tagline: string;
  supportEmail: string;
  currencyCode: string;
  logo: {
    url: string;
    width: number;
    height: number;
  };
  features: {
    complaints: boolean;
    feedback: boolean;
    studyMaterial: boolean;
    practiceTests: boolean;
    emailNotifications: boolean;
    darkMode: boolean;
    offlineMode: boolean;
    leaderboard: boolean;
    attendanceQR: boolean;
    timetable: boolean;
    pushNotifications: boolean;
    webhooks: boolean;
    batches: boolean;
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
    sidebarBg: string;
    borderRadius: string;
  };
  email: {
    headerColor: string;
    logoUrl: string;
    footerText: string;
  };
}

export const instituteConfig: InstituteConfig = {
  name: process.env.NEXT_PUBLIC_INSTITUTE_NAME || 'EdTech Platform',
  tagline: process.env.NEXT_PUBLIC_INSTITUTE_TAGLINE || 'Your Learning Partner',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com',
  currencyCode: process.env.NEXT_PUBLIC_CURRENCY_CODE || 'INR',
  
  logo: {
    url: '/brand/logo.svg',
    width: 180,
    height: 50,
  },
  
  features: {
    complaints: true,
    feedback: true,
    studyMaterial: true,
    practiceTests: true,
    emailNotifications: true,
    darkMode: true,
    offlineMode: true,
    leaderboard: true,
    attendanceQR: true,
    timetable: true,
    pushNotifications: false,
    webhooks: true,
    batches: true,
  },
  
  theme: {
    primaryColor: '#4F46E5',
    secondaryColor: '#6B7280',
    sidebarBg: '#1F2937',
    borderRadius: '8px',
  },
  
  email: {
    headerColor: '#4F46E5',
    logoUrl: '/brand/logo.png',
    footerText: '© 2024 EdTech Platform. All rights reserved.',
  },
};

export default instituteConfig;