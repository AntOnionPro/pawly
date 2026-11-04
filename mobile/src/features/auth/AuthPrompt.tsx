import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import type { IconName } from '@/theme/icons';
import { spacing } from '@/theme/typography';

interface AuthPromptProps {
  icon: IconName;
  message: string;
}

/** What visitors see where an account is needed: sign up or sign in. */
export function AuthPrompt({ icon, message }: AuthPromptProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <Icon name={icon} selected size={56} color={colors.accent} />
      <ThemedText variant="title" accessibilityRole="header" style={styles.center}>
        {t('auth.prompt.title')}
      </ThemedText>
      <ThemedText color="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      <View style={styles.actions}>
        <Button label={t('auth.prompt.signUp')} onPress={() => router.push('/sign-up')} />
        <Button
          variant="secondary"
          label={t('auth.prompt.signIn')}
          onPress={() => router.push('/sign-in')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
});
