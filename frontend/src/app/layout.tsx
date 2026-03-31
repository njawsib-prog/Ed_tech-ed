import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_INSTITUTE_NAME || 'EdTech Platform',
    template: `%s | ${process.env.NEXT_PUBLIC_INSTITUTE_NAME || 'EdTech Platform'}`,
  },
  description: process.env.NEXT_PUBLIC_INSTITUTE_TAGLINE || 'Your Learning Partner',
  keywords: ['education', 'learning', 'online courses', 'tests', 'study materials'],
  authors: [{ name: process.env.NEXT_PUBLIC_INSTITUTE_NAME || 'EdTech Platform' }],
  creator: process.env.NEXT_PUBLIC_INSTITUTE_NAME || 'EdTech Platform',
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: process.env.NEXT_PUBLIC_INSTITUTE_NAME || 'EdTech Platform',
    description: process.env.NEXT_PUBLIC_INSTITUTE_TAGLINE || 'Your Learning Partner',
    siteName: process.env.NEXT_PUBLIC_INSTITUTE_NAME || 'EdTech Platform',
    images: [
      {
        url: '/brand/og-image.png',
        width: 1200,
        height: 630,
        alt: process.env.NEXT_PUBLIC_INSTITUTE_NAME || 'EdTech Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: process.env.NEXT_PUBLIC_INSTITUTE_NAME || 'EdTech Platform',
    description: process.env.NEXT_PUBLIC_INSTITUTE_TAGLINE || 'Your Learning Partner',
    images: ['/brand/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/brand/logo.png',
    shortcut: '/favicon.ico',
    apple: '/brand/logo.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --color-primary: #4F46E5;
                --color-secondary: #6B7280;
                --color-sidebar-bg: #1F2937;
                --color-text: #1F2937;
                --color-background: #F9FAFB;
                --font-family: 'Inter', sans-serif;
                --border-radius: 8px;
                --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                --transition: 200ms;
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}