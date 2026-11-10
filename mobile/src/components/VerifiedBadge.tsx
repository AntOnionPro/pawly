import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { AccountKind } from '@/auth/AuthProvider';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

interface VerifiedBadgeProps {
  kind: AccountKind;
  /** With the words ("Verified shelter") next to the icon. Without them, the icon says it. */
  showLabel?: boolean;
  size?: number;
}

/** The mark of an account that Pawly verified as a shelter or as a rescuer. */
export function VerifiedBadge({ kind, showLabel = false, size = 18 }: VerifiedBadgeProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const label = t(`verification.badge.${kind}`);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={`verified-badge-${kind}`}
      style={styles.badge}>
      <Icon name="verified" selected size={size} color={colors.accent} />
      {showLabel ? <ThemedText variant="caption">{label}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
