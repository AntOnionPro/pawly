import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { VerificationContent } from '@/features/verification/VerificationContent';

/** "Shelter or rescuer account": asks Pawly to verify the account and shows the answer. */
export default function VerificationScreen() {
  const { status } = useAuth();
  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      <VerificationContent />
    </Screen>
  );
}
