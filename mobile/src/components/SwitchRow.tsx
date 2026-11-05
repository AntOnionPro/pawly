import { Platform, StyleSheet, Switch, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { ThemedText } from './ThemedText';

interface SwitchRowProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Draws a divider above the row (all rows of a group except the first). */
  divider?: boolean;
}

/** Row of a grouped list with an on/off switch (native look on each platform). */
export function SwitchRow({
  label,
  value,
  onValueChange,
  disabled,
  divider = false,
}: SwitchRowProps) {
  const colors = useThemeColors();
  // iOS keeps its native white thumb. Android and web color it from the palette (the web would
  // otherwise use its own teal for the "on" thumb).
  const thumbColor =
    Platform.OS === 'ios' ? undefined : value ? colors.onAccent : colors.textSecondary;
  const webColors =
    Platform.OS === 'web'
      ? { activeThumbColor: colors.onAccent, activeTrackColor: colors.accent }
      : {};
  return (
    <View
      style={[
        styles.row,
        divider && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={thumbColor}
        ios_backgroundColor={colors.border}
        {...webColors}
      />
    </View>
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
});
