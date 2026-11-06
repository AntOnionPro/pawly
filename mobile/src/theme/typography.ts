import type { TextStyle } from 'react-native';

/**
 * Type scale: sizes and weights. The font family is applied on top (`fontFor` in fonts.ts):
 * Ubuntu by default, or the system font (San Francisco on iOS, Roboto on Android) if chosen
 * in settings.
 */
export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', textTransform: 'uppercase' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  // 19 pt bold counts as large text (WCAG), so white on the pink accent (4.23:1) passes AA.
  button: { fontSize: 19, lineHeight: 24, fontWeight: '700' },
  link: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  md: 12,
} as const;
