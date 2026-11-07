import { useRouter } from 'expo-router';

import { CatSilhouette } from '@/components/CatSilhouette';
import { Screen } from '@/components/Screen';
import { SignInForm } from '@/features/auth/SignInForm';

export default function SignInScreen() {
  const router = useRouter();
  return (
    <Screen edges={['bottom']} background={<CatSilhouette />}>
      <SignInForm
        onSignedIn={() => (router.canDismiss() ? router.dismissAll() : router.replace('/'))}
        onForgotPassword={() => router.push('/forgot-password')}
        onSignUp={() => router.replace('/sign-up')}
      />
    </Screen>
  );
}
