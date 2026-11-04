import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import type { IconName } from '@/theme/icons';
import { spacing } from '@/theme/typography';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

interface ComingSoonProps {
  icon: IconName;
  title: string;
  description: string;
  /** Roadmap stage that delivers this section. */
  stage: number;
}

/** Placeholder for tabs whose content arrives in a later stage. */
export function ComingSoon({ icon, title, description, stage }: ComingSoonProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Icon name={icon} selected size={56} color={colors.accent} />
      <ThemedText variant="title" accessibilityRole="header" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText color="textSecondary" style={styles.center}>
        {description}
      </ThemedText>
      <ThemedText variant="label" color="textSecondary" style={styles.center}>
        {t('comingSoon.title')} · {t('comingSoon.stage', { stage })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  center: { textAlign: 'center' },
});
