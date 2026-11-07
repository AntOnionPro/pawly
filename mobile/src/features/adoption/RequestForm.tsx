import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { FieldError } from '@/components/FieldError';
import { HeaderAction } from '@/components/HeaderAction';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

import type { Adoption } from './api';
import { useSendRequest } from './requestHooks';
import { REQUEST_MESSAGE_MAX } from './requests';

/** "I want to adopt": a presentation message for the publisher. */
export function RequestForm({ adoption, onSent }: { adoption: Adoption; onSent: () => void }) {
  const { t } = useTranslation();
  const send = useSendRequest();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const name = adoption.pet?.name ?? '';

  async function submit() {
    setError(null);
    if (!message.trim()) {
      setError(t('errors.required'));
      return;
    }
    try {
      await send.mutateAsync({ adoptionId: adoption.id, message });
      onSent();
    } catch (sendError) {
      const [field] = Object.values(toFieldErrors(sendError));
      const key = field ?? requestErrorKey(requestErrorKind(sendError));
      setError(key ? t(key) : null);
    }
  }

  return (
    <View style={styles.container}>
      <HeaderAction
        label={t('adoptionRequests.send')}
        pendingLabel={t('adoptionRequests.sending')}
        loading={send.isPending}
        onPress={() => void submit()}
      />
      <FieldError message={error} />
      <ThemedText variant="title" accessibilityRole="header">
        {t('adoptionRequests.heading', { name })}
      </ThemedText>
      <ThemedText color="textSecondary">
        {t('adoptionRequests.intro', { username: adoption.publisher?.username ?? '' })}
      </ThemedText>
      <TextField
        label={t('adoptionRequests.message')}
        hint={t('posts.textCount', { used: message.length, max: REQUEST_MESSAGE_MAX })}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={REQUEST_MESSAGE_MAX}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
