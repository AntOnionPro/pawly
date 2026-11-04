/**
 * Pawly color tokens. The base palette is defined in the README ("Design" section).
 * Derived tints (secondary text, borders, tab indicator) are blends of the base colors;
 * `__tests__/contrast.test.ts` checks that every text/background pair meets WCAG AA.
 */

export const palette = {
  /** Primary: very light pastel pink. */
  blush: '#FFF5F7',
  /** Secondary: dark wine. */
  wine: '#4A0818',
  /** Tertiary: pink accent. */
  pink: '#D84080',
  white: '#FFFFFF',
  black: '#000000',
  gray1: '#1C1C1E',
  gray2: '#2C2C2E',
  gray3: '#3A3A3C',
  gray4: '#8E8E93',
} as const;

export type ColorSchemeName = 'light' | 'dark';

export interface ThemeColors {
  /** Screen background. */
  background: string;
  /** Cards, bars and grouped lists. */
  surface: string;
  /** Main text and icons. */
  text: string;
  /** Secondary text and inactive icons. */
  textSecondary: string;
  /** Accents: active paw print, main button, active tab icon. Not for small text. */
  accent: string;
  /** Content drawn on top of `accent`. */
  onAccent: string;
  /** Borders and dividers. */
  border: string;
  /** Pill behind the active tab on Android. */
  tabIndicator: string;
}

export const colors: Record<ColorSchemeName, ThemeColors> = {
  light: {
    background: palette.blush,
    surface: palette.white,
    text: palette.wine,
    // Wine at 70% over blush.
    textSecondary: '#804F5B',
    accent: palette.pink,
    onAccent: palette.white,
    // Wine at 15% over blush.
    border: '#E4D1D6',
    // Pink at 12% over white.
    tabIndicator: '#FAE8F0',
  },
  dark: {
    background: palette.black,
    surface: palette.gray1,
    text: palette.white,
    textSecondary: palette.gray4,
    accent: palette.white,
    onAccent: palette.black,
    border: palette.gray3,
    tabIndicator: palette.gray3,
  },
};
