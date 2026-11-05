import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

interface CheckEmailProps {
  email: string;
  onSignIn: () => void;
}

/** Shown after signing up: the account works once the email link is opened. */
export function CheckEmail({ email, onSignIn }: CheckEmailProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { requestVerification } = useAuth();
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setError(null);
    try {
      await requestVerification(email);
      setResent(true);
    } catch (err) {
      const key = requestErrorKey(requestErrorKind(err));
      setError(key ? t(key) : null);
    }
  }

  return (
    <View style={styles.container}>
      <Icon name="mail" selected size={56} color={colors.accent} />
      <ThemedText variant="title" accessibilityRole="header" style={styles.center}>
        {t('auth.checkEmail.title')}
      </ThemedText>
      <ThemedText style={styles.center}>{t('auth.checkEmail.message', { email })}</ThemedText>
      <FieldError message={error} />
      {resent ? (
        <ThemedText color="textSecondary" style={styles.center}>
          {t('auth.checkEmail.resent')}
        </ThemedText>
      ) : null}
      <View style={styles.actions}>
        <Button label={t('auth.checkEmail.goToSignIn')} onPress={onSignIn} />
        {resent ? null : (
          <Button
            variant="secondary"
            icon="mail"
            label={t('auth.checkEmail.resend')}
            onPress={resend}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
});
