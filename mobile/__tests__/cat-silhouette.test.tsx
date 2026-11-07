import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CatSilhouette, SILHOUETTE_OPACITY } from '@/components/CatSilhouette';
import { Screen } from '@/components/Screen';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { colors, lightThemes, mix, PALETTE_NAMES } from '@/theme/colors';
import { AA, contrastRatio } from '@/theme/contrast';

import { renderWith } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    PREFERENCES_KEY,
    '{"theme":"light","language":"es","palette":"green"}',
  );
});

describe('CatSilhouette', () => {
  it('is a faint cat in the text color, behind the content and hidden from screen readers', async () => {
    await renderWith(
      <Screen background={<CatSilhouette />}>
        <Text>Iniciar sesión</Text>
      </Screen>,
    );
    expect(await screen.findByText('Iniciar sesión')).toBeOnTheScreen();
    // Screen readers do not see it: by default the queries do not find it either.
    expect(screen.queryByTestId('cat-silhouette')).toBeNull();
    const silhouette = screen.getByTestId('cat-silhouette', { includeHiddenElements: true });
    expect(silhouette).toHaveProp('pointerEvents', 'none');
    expect(silhouette).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(silhouette).toHaveProp('accessibilityElementsHidden', true);
    const cat = screen.getByTestId('cat-silhouette-image', { includeHiddenElements: true });
    expect(cat).toHaveStyle({ tintColor: lightThemes.green.text, opacity: SILHOUETTE_OPACITY });
  });

  it.each([...PALETTE_NAMES.map((name) => lightThemes[name]), colors.dark])(
    'keeps small text readable on top of it',
    (theme) => {
      const under = mix(theme.text, theme.background, SILHOUETTE_OPACITY);
      expect(contrastRatio(theme.text, under)).toBeGreaterThanOrEqual(AA.text);
      expect(contrastRatio(theme.textSecondary, under)).toBeGreaterThanOrEqual(AA.text);
    },
  );
});
