import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { CheckEmail } from '@/features/auth/CheckEmail';

export default function CheckEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  return (
    <Screen edges={['bottom']}>
      <CheckEmail email={email ?? ''} onSignIn={() => router.replace('/sign-in')} />
    </Screen>
  );
}
