import { LoginForm } from '@/components/auth/LoginForm';

export default function AdminLoginPage() {
  return (
    <LoginForm
      role="branch_admin"
      redirectPath="/admin"
    />
  );
}