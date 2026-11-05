import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BadgeButton } from '@/components/BadgeButton';

import { useUnreadNotifications } from './hooks';

/** Bell for the top bar, with the number of unread notifications. */
export function NotificationsButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: unread = 0 } = useUnreadNotifications();
  return (
    <BadgeButton
      icon="notifications"
      label={t('notifications.title')}
      count={unread}
      countHint={t('notifications.unread', { count: unread })}
      onPress={() => router.push('/notifications')}
    />
  );
}
