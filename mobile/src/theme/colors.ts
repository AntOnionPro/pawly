/**
 * Pawly color tokens. The base palettes are defined in the README ("Design" section).
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

/** The light theme palettes people can choose in settings (pink is the default). */
export type PaletteName = 'pink' | 'orange' | 'green' | 'blue' | 'purple';

export const PALETTE_NAMES: readonly PaletteName[] = ['pink', 'orange', 'green', 'blue', 'purple'];

/**
 * Base colors of each light palette (README, "Colors"): a very light background, a very
 * dark text color and an accent. No yellow: a bright yellow accent is not visible on a light
 * background.
 */
export const LIGHT_PALETTES: Record<
  PaletteName,
  { background: string; text: string; accent: string }
> = {
  pink: { background: palette.blush, text: palette.wine, accent: palette.pink },
  orange: { background: '#FFF7F0', text: '#4A1C04', accent: '#D2560F' },
  green: { background: '#F2FAF4', text: '#0E3B1F', accent: '#2E8A4F' },
  blue: { background: '#F2F7FF', text: '#0B2447', accent: '#2F6BD8' },
  purple: { background: '#F8F5FF', text: '#2E1065', accent: '#7C3AED' },
};

/** `color` at `amount` (0 to 1) over `base`, as an opaque `#RRGGBB`. */
export function mix(color: string, base: string, amount: number): string {
  const channels = (hex: string) =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const top = channels(color);
  const bottom = channels(base);
  return `#${top
    .map((value, index) => Math.round(value * amount + bottom[index]! * (1 - amount)))
    .map((value) => value.toString(16).padStart(2, '0').toUpperCase())
    .join('')}`;
}

/** A light theme from its base colors: the rest are blends of them. */
function lightTheme({
  background,
  text,
  accent,
}: (typeof LIGHT_PALETTES)[PaletteName]): ThemeColors {
  return {
    background,
    surface: palette.white,
    text,
    textSecondary: mix(text, background, 0.7),
    accent,
    onAccent: palette.white,
    border: mix(text, background, 0.15),
    tabIndicator: mix(accent, palette.white, 0.12),
  };
}

export const lightThemes = Object.fromEntries(
  PALETTE_NAMES.map((name) => [name, lightTheme(LIGHT_PALETTES[name])]),
) as Record<PaletteName, ThemeColors>;

/** The default light theme (pink) and the dark theme, which is the same for every palette. */
export const colors: Record<ColorSchemeName, ThemeColors> = {
  light: lightThemes.pink,
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

/** The colors to use: the chosen palette in the light theme; black and white in the dark one. */
export function themeColors(scheme: ColorSchemeName, paletteName: PaletteName): ThemeColors {
  return scheme === 'dark' ? colors.dark : lightThemes[paletteName];
}
