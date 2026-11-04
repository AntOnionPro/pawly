import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ComingSoon } from '@/components/ComingSoon';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <Screen>
      <ComingSoon
        icon="profile"
        title={t('profile.title')}
        description={t('profile.description')}
        stage={1}
      />
      <Link href="/settings" asChild>
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: colors.tabIndicator }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}>
          <Icon name="settings" color={colors.text} />
          <ThemedText style={styles.label}>{t('profile.settings')}</ThemedText>
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
