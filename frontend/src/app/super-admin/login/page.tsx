import { LoginForm } from '@/components/auth/LoginForm';

export default function SuperAdminLoginPage() {
  return (
    <LoginForm
      role="super_admin"
      redirectPath="/super-admin"
    />
  );
}