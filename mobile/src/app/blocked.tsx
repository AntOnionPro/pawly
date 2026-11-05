import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { BlockedList } from '@/features/moderation/BlockedList';

export default function BlockedScreen() {
  const { status } = useAuth();
  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      <BlockedList />
    </Screen>
  );
}
