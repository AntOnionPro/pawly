import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useColorSchemeName,
  usePreferences,
  useThemeColors,
} from '@/preferences/PreferencesProvider';
import { palette } from '@/theme/colors';
import { fontFor } from '@/theme/fonts';
import type { IconName } from '@/theme/icons';
import { spacing, typography } from '@/theme/typography';

import { Icon } from './Icon';

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** floating: over the content, bigger (a Material 3 extended FAB on Android). */
  kind?: 'inline' | 'floating';
}

/**
 * A main action with Liquid Glass on iOS 26 and later: glass tinted with the accent (plain glass
 * in the dark theme, whose accent is white). Elsewhere a pill filled with the accent; on Android,
 * floating buttons take the shape and elevation of a Material 3 FAB. The text keeps the button
 * size: 19 pt bold counts as large text, so white on the accent passes.
 */
export function GlassButton({
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  kind = 'inline',
}: GlassButtonProps) {
  const colors = useThemeColors();
  const scheme = useColorSchemeName();
  const { font } = usePreferences();
  const glass = isLiquidGlassAvailable();
  const inactive = disabled || loading;
  const foreground = glass ? (scheme === 'dark' ? colors.text : palette.white) : colors.onAccent;
  const floating = kind === 'floating';
  const shape = [
    styles.shape,
    floating ? styles.floating : styles.inline,
    floating && Platform.OS === 'android' && styles.material,
  ];

  const content = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={{ color: colors.tabIndicator, foreground: true }}
      style={({ pressed }) => [
        styles.content,
        floating ? styles.floatingContent : styles.inlineContent,
        (pressed || inactive) && !glass && styles.dimmed,
      ]}>
      {loading ? <ActivityIndicator color={foreground} /> : null}
      {icon && !loading ? <Icon name={icon} size={22} color={foreground} /> : null}
      <Text style={[typography.button, fontFor(font, '700'), { color: foreground }]}>{label}</Text>
    </Pressable>
  );

  if (glass) {
    return (
      <GlassView
        testID="glass"
        isInteractive
        glassEffectStyle="regular"
        tintColor={scheme === 'dark' ? undefined : colors.accent}
        colorScheme={scheme}
        style={[shape, inactive && styles.dimmed]}>
        {content}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        shape,
        { backgroundColor: colors.accent },
        floating && Platform.OS !== 'android' && styles.shadow,
      ]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  shape: { overflow: 'hidden' },
  inline: { borderRadius: 22 },
  floating: { borderRadius: 28 },
  // Material 3 extended FAB: large rounded corners and a raised surface.
  material: { borderRadius: 16, elevation: 3 },
  shadow: {
    shadowColor: palette.black,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  inlineContent: { minHeight: 44, paddingHorizontal: spacing.lg },
  floatingContent: { minHeight: 56, paddingHorizontal: spacing.lg },
  dimmed: { opacity: 0.6 },
});
