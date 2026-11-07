import { useRouter } from 'expo-router';

import { CatSilhouette } from '@/components/CatSilhouette';
import { Screen } from '@/components/Screen';
import { SignUpForm } from '@/features/auth/SignUpForm';

export default function SignUpScreen() {
  const router = useRouter();
  return (
    <Screen edges={['bottom']} background={<CatSilhouette />}>
      <SignUpForm
        onSignedUp={(email) => router.replace({ pathname: '/check-email', params: { email } })}
        onSignIn={() => router.replace('/sign-in')}
        onOpenLegal={(doc) => router.push({ pathname: '/legal/[doc]', params: { doc } })}
      />
    </Screen>
  );
}
