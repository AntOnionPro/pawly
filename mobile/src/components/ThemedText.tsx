import { StyleSheet, Text, type TextProps } from 'react-native';

import { usePreferences, useThemeColors } from '@/preferences/PreferencesProvider';
import type { ThemeColors } from '@/theme/colors';
import { fontFor } from '@/theme/fonts';
import { typography, type TypographyVariant } from '@/theme/typography';

type TextColor = Extract<keyof ThemeColors, 'text' | 'textSecondary'>;

interface ThemedTextProps extends TextProps {
  variant?: TypographyVariant;
  /** Text only uses `text` or `textSecondary`; `accent` is not readable at small sizes. */
  color?: TextColor;
}

/** Text in the theme's colors and the chosen font (Ubuntu or the system's), at its weight. */
export function ThemedText({ variant = 'body', color = 'text', style, ...rest }: ThemedTextProps) {
  const colors = useThemeColors();
  const { font } = usePreferences();
  const flat = StyleSheet.flatten([typography[variant], { color: colors[color] }, style]);
  return <Text style={[flat, fontFor(font, flat?.fontWeight)]} {...rest} />;
}
