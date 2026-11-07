import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePreferences, useThemeColors } from '@/preferences/PreferencesProvider';
import { fontFor } from '@/theme/fonts';
import type { IconName } from '@/theme/icons';
import { radius, spacing, typography } from '@/theme/typography';

import { Icon } from './Icon';

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary: main action (accent). secondary: outlined. link: text only. */
  variant?: 'primary' | 'secondary' | 'link';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  /**
   * compact: a pill as wide as its label (for example "Publish" at the top of a screen). The
   * text keeps the button size: 19 pt bold counts as large text, so white on the accent passes.
   */
  size?: 'regular' | 'compact';
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  accessibilityHint,
  size = 'regular',
}: ButtonProps) {
  const colors = useThemeColors();
  const { font } = usePreferences();
  const text = variant === 'link' ? typography.link : typography.button;
  const inactive = disabled || loading;
  const foreground = variant === 'primary' ? colors.onAccent : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={variant === 'link' ? undefined : { color: colors.tabIndicator }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: colors.accent },
        variant === 'secondary' && {
          borderColor: colors.text,
          borderWidth: StyleSheet.hairlineWidth * 2,
        },
        variant === 'link' && styles.link,
        size === 'compact' && variant !== 'link' && styles.compact,
        (pressed || inactive) && styles.dimmed,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={20} color={foreground} /> : null}
          <Text style={[text, fontFor(font, text.fontWeight), { color: foreground }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { minHeight: 44, paddingHorizontal: spacing.xs },
  compact: { minHeight: 44, borderRadius: 22, paddingHorizontal: spacing.lg },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dimmed: { opacity: 0.6 },
});
