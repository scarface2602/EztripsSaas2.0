import { requireAuth } from '@/lib/auth/require-role';
import { RegisterClient } from './register-client';

export default async function RegisterPage() {
  const { user } = await requireAuth();
  return <RegisterClient role={user.role} />;
}
