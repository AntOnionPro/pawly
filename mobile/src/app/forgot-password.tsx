import { Screen } from '@/components/Screen';
import { ForgotPasswordForm } from '@/features/auth/ForgotPasswordForm';

export default function ForgotPasswordScreen() {
  return (
    <Screen edges={['bottom']}>
      <ForgotPasswordForm />
    </Screen>
  );
}
