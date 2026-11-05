import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { NotificationSettings } from '@/features/push/NotificationSettings';

export default function NotificationSettingsScreen() {
  const { status } = useAuth();
  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      <NotificationSettings />
    </Screen>
  );
}
