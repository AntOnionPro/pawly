import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BadgeButton } from '@/components/BadgeButton';

import { useUnreadConversations } from './hooks';

/** Messages icon for the top bar, with the number of unread conversations. */
export function MessagesButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: unread = 0 } = useUnreadConversations();
  return (
    <BadgeButton
      icon="messages"
      label={t('messages.title')}
      count={unread}
      countHint={t('messages.unread', { count: unread })}
      onPress={() => router.push('/messages')}
    />
  );
}
