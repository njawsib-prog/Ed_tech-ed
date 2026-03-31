import { AuthProvider } from '@/hooks/useAuth';

export default function SuperAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}