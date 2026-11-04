import { Pressable, StyleSheet } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import type { IconName } from '@/theme/icons';
import { spacing } from '@/theme/typography';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

interface NavRowProps {
  label: string;
  icon?: IconName;
  onPress: () => void;
  /** Draws a divider above the row (all rows of a group except the first). */
  divider?: boolean;
}

/** Row of a grouped list that opens another screen or runs an action. */
export function NavRow({ label, icon, onPress, divider = false }: NavRowProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: colors.tabIndicator }}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && styles.pressed,
      ]}>
      {icon ? <Icon name={icon} size={22} color={colors.text} /> : null}
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Icon name="chevron" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
