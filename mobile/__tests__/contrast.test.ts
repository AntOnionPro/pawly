import { colors, palette } from '@/theme/colors';
import { AA, contrastRatio } from '@/theme/contrast';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio(palette.wine, palette.blush)).toBeCloseTo(
      contrastRatio(palette.blush, palette.wine),
      10,
    );
  });

  it('rejects colors that are not #RRGGBB', () => {
    expect(() => contrastRatio('red', '#FFFFFF')).toThrow();
  });
});

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  const theme = colors[scheme];

  it.each([
    ['text', 'background'],
    ['text', 'surface'],
    ['textSecondary', 'background'],
    ['textSecondary', 'surface'],
  ] as const)('%s on %s is readable as small text', (fg, bg) => {
    expect(contrastRatio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(AA.text);
  });

  it.each([
    ['accent', 'background'],
    ['accent', 'surface'],
    ['accent', 'tabIndicator'],
    ['onAccent', 'accent'],
  ] as const)('%s on %s is visible for icons and bold text', (fg, bg) => {
    expect(contrastRatio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(AA.largeTextOrUi);
  });
});

describe('palette', () => {
  it('keeps the colors agreed in the README', () => {
    expect(colors.light).toMatchObject({
      background: '#FFF5F7',
      text: '#4A0818',
      accent: '#D84080',
    });
    expect(colors.dark).toMatchObject({ background: '#000000', text: '#FFFFFF' });
  });

  it('does not use pink or wine in the dark theme', () => {
    const darkValues = Object.values(colors.dark);
    expect(darkValues).not.toContain(palette.pink);
    expect(darkValues).not.toContain(palette.wine);
    expect(darkValues).not.toContain(palette.blush);
  });
});
