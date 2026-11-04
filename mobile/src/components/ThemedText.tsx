import { Text, type TextProps } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import type { ThemeColors } from '@/theme/colors';
import { typography, type TypographyVariant } from '@/theme/typography';

type TextColor = Extract<keyof ThemeColors, 'text' | 'textSecondary'>;

interface ThemedTextProps extends TextProps {
  variant?: TypographyVariant;
  /** Text only uses `text` or `textSecondary`; `accent` is not readable at small sizes. */
  color?: TextColor;
}

export function ThemedText({ variant = 'body', color = 'text', style, ...rest }: ThemedTextProps) {
  const colors = useThemeColors();
  return <Text style={[typography[variant], { color: colors[color] }, style]} {...rest} />;
}
