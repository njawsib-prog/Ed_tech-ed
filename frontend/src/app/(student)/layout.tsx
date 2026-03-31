import { AuthProvider } from '@/hooks/useAuth';

export default function StudentRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}