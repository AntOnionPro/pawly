import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';
import { Appearance } from 'react-native';

import { SettingsContent } from '@/features/settings/SettingsContent';
import { PreferencesProvider, usePreferences } from '@/preferences/PreferencesProvider';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { lightThemes } from '@/theme/colors';

jest.mock('expo-localization', () => {
  const locales = jest.fn(() => [{ languageCode: 'es', languageTag: 'es-MX' }]);
  return { getLocales: locales, useLocales: () => locales() };
});

function ReadyGate({ children }: { children: React.ReactNode }) {
  const { ready } = usePreferences();
  return ready ? children : null;
}

async function renderSettings() {
  await render(
    <PreferencesProvider>
      <ReadyGate>
        <SettingsContent />
      </ReadyGate>
    </PreferencesProvider>,
  );
  await screen.findByLabelText(/^(Tema|Theme)$/);
}

// Option groups are labelled containers (not focusable themselves), so find them by label.
const themeGroup = () => within(screen.getByLabelText(/^(Tema|Theme)$/));
const languageGroup = () => within(screen.getByLabelText(/^(Idioma|Language)$/));
const fontGroup = () => within(screen.getByLabelText(/^(Letra|Font)$/));
const paletteGroup = () => within(screen.getByLabelText(/^Color$/));

describe('SettingsContent', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest
      .mocked(getLocales)
      .mockReturnValue([
        { languageCode: 'es', languageTag: 'es-MX' } as ReturnType<typeof getLocales>[number],
      ]);
  });

  it('follows the phone language and system theme by default', async () => {
    await renderSettings();
    expect(screen.getByText('Tema')).toBeOnTheScreen();
    expect(themeGroup().getByRole('radio', { name: 'Sistema', checked: true })).toBeOnTheScreen();
    expect(
      languageGroup().getByRole('radio', { name: 'Sistema', checked: true }),
    ).toBeOnTheScreen();
  });

  it('falls back to English when the phone language is not supported', async () => {
    jest
      .mocked(getLocales)
      .mockReturnValue([
        { languageCode: 'fr', languageTag: 'fr-FR' } as ReturnType<typeof getLocales>[number],
      ]);
    await renderSettings();
    expect(screen.getByText('Theme')).toBeOnTheScreen();
  });

  it('switches the language and saves the choice', async () => {
    await renderSettings();
    await fireEvent.press(languageGroup().getByRole('radio', { name: 'English' }));
    expect(screen.getByText('Theme')).toBeOnTheScreen();
    expect(
      languageGroup().getByRole('radio', { name: 'English', checked: true }),
    ).toBeOnTheScreen();
    expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_KEY)) ?? '{}')).toEqual({
      theme: 'system',
      language: 'en',
      nearbyRadiusKm: 5,
      font: 'ubuntu',
      palette: 'pink',
    });
  });

  it('offers the palettes with their color, and switches and saves the choice', async () => {
    await renderSettings();
    expect(paletteGroup().getByRole('radio', { name: 'Rosa', checked: true })).toBeOnTheScreen();
    for (const name of ['Naranja', 'Verde', 'Azul', 'Morado']) {
      expect(paletteGroup().getByRole('radio', { name })).toBeOnTheScreen();
    }
    expect(paletteGroup().queryByRole('radio', { name: 'Amarillo' })).toBeNull();
    expect(
      screen.getByText('Se usa en el tema claro. El tema oscuro es negro y blanco.'),
    ).toBeOnTheScreen();

    await fireEvent.press(paletteGroup().getByRole('radio', { name: 'Verde' }));
    expect(paletteGroup().getByRole('radio', { name: 'Verde', checked: true })).toBeOnTheScreen();
    // The light theme changes at once: the label text takes the green palette's color.
    expect(screen.getByText('Color')).toHaveStyle({ color: lightThemes.green.textSecondary });
    expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_KEY)) ?? '{}')).toMatchObject({
      palette: 'green',
    });
  });

  it('uses Ubuntu by default and switches to the system font', async () => {
    await renderSettings();
    expect(fontGroup().getByRole('radio', { name: 'Ubuntu', checked: true })).toBeOnTheScreen();
    expect(screen.getByText('Letra')).toHaveStyle({ fontFamily: 'Ubuntu_500Medium' });

    await fireEvent.press(fontGroup().getByRole('radio', { name: 'Del sistema' }));
    expect(
      fontGroup().getByRole('radio', { name: 'Del sistema', checked: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Letra')).not.toHaveStyle({ fontFamily: 'Ubuntu_500Medium' });
    expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_KEY)) ?? '{}')).toMatchObject({
      font: 'system',
    });
  });

  it('applies the dark theme to native views and saves it', async () => {
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme');
    await renderSettings();
    await fireEvent.press(themeGroup().getByRole('radio', { name: 'Oscuro' }));
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');
    expect(themeGroup().getByRole('radio', { name: 'Oscuro', checked: true })).toBeOnTheScreen();
    expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_KEY)) ?? '{}')).toMatchObject({
      theme: 'dark',
    });
  });

  it('restores saved preferences on start', async () => {
    await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"en"}');
    await renderSettings();
    expect(themeGroup().getByRole('radio', { name: 'Light', checked: true })).toBeOnTheScreen();
    expect(
      languageGroup().getByRole('radio', { name: 'English', checked: true }),
    ).toBeOnTheScreen();
  });
});
