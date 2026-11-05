import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { NotificationList } from '@/features/notifications/NotificationList';

export default function NotificationsScreen() {
  const { status } = useAuth();
  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }
  return <NotificationList />;
}
