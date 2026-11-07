import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';

import { useMessageAction } from './hooks';

/** "Message" on someone's profile: opens (or starts) the conversation with them. */
export function MessageButton({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { open, opening } = useMessageAction();
  return (
    <Button
      size="compact"
      variant="secondary"
      icon="messages"
      label={t('messages.message')}
      loading={opening}
      onPress={() => open(userId)}
    />
  );
}
