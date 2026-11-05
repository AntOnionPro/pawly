import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKind } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { FieldError } from '@/components/FieldError';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';
import { confirm } from '@/utils/confirm';

/** Deletes the account for good, after the password and two confirmations. */
export function DeleteAccountForm({ onDeleted }: { onDeleted: () => void }) {
  const { t } = useTranslation();
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function submit() {
    if (!password) {
      setError(t('errors.required'));
      return;
    }
    if (!understood) {
      setError(t('account.delete.mustConfirm'));
      return;
    }
    setError(null);
    const confirmed = await confirm({
      title: t('account.delete.confirmTitle'),
      message: t('account.delete.confirmMessage'),
      confirmLabel: t('account.delete.submit'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (err) {
      const kind = requestErrorKind(err);
      setError(
        kind === 'invalidCredentials'
          ? t('errors.passwordWrong')
          : t(kind === 'network' ? 'errors.network' : 'errors.generic'),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={styles.form}>
      <ThemedText variant="heading" accessibilityRole="header">
        {t('account.delete.title')}
      </ThemedText>
      <ThemedText>{t('account.delete.explanation')}</ThemedText>
      <TextField
        label={t('account.password.current')}
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setError(null);
        }}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <Checkbox
        label={t('account.delete.understand')}
        checked={understood}
        onChange={(checked) => {
          setUnderstood(checked);
          setError(null);
        }}
      />
      <FieldError message={error} />
      <Button
        variant="secondary"
        icon="delete"
        label={t('account.delete.submit')}
        onPress={submit}
        loading={deleting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
