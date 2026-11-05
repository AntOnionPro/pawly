import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { SentRequests } from '@/features/adoption/SentRequests';

/** "My requests": the pets the user asked to adopt. */
export default function SentRequestsScreen() {
  const { user } = useAuth();
  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      <SentRequests />
    </Screen>
  );
}
