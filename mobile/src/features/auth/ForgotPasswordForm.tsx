import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { validateEmail } from '@/auth/validation';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const invalid = validateEmail(email);
    setError(invalid ? t(invalid) : null);
    if (invalid) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      // Same answer whether the account exists or not, so nobody can probe emails.
      setSentTo(email.trim());
    } catch (err) {
      const key = requestErrorKey(requestErrorKind(err));
      setError(key ? t(key) : null);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <ThemedText accessibilityRole="alert">{t('auth.forgot.sent', { email: sentTo })}</ThemedText>
    );
  }

  return (
    <View style={styles.form}>
      <ThemedText color="textSecondary">{t('auth.forgot.message')}</ThemedText>
      <TextField
        label={t('auth.forgot.email')}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={submit}
      />
      <FieldError message={error} />
      <Button label={t('auth.forgot.submit')} onPress={submit} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
