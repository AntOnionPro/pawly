/** WCAG 2.x contrast helpers. */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#RRGGBB` color. */
export function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Expected a #RRGGBB color, got "${hex}"`);
  }
  const value = parseInt(hex.slice(1), 16);
  const r = channel((value >> 16) & 0xff);
  const g = channel((value >> 8) & 0xff);
  const b = channel(value & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two `#RRGGBB` colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Minimum ratios from WCAG 2.x level AA. */
export const AA = {
  /** Body and small text. */
  text: 4.5,
  /** Large or bold text, icons and other UI components. */
  largeTextOrUi: 3,
} as const;
