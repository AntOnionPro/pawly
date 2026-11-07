import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, Text } from 'react-native';

import { FloatingAction } from '@/components/FloatingAction';
import { GlassButton } from '@/components/GlassButton';
import { HeaderAction } from '@/components/HeaderAction';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { lightThemes } from '@/theme/colors';

import { renderWith } from '../test-utils/render';

// The real component (jest.setup.js replaces it with an inline button for the forms).
jest.unmock('@/components/HeaderAction');
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
// A fake top bar: records what the screen asks for, and draws `headerRight`.
jest.mock('expo-router', () => {
  const Toolbar = ({ children, ...props }: { children: ReactNode }) => {
    mockTopBar.toolbar = props;
    return children;
  };
  Toolbar.Button = function ToolbarButton(props: { children: string }) {
    mockTopBar.button = props;
    return null;
  };
  const Screen = ({ options }: { options: { headerRight?: () => ReactNode } }) =>
    options.headerRight?.() ?? null;
  return { Stack: { Toolbar, Screen } };
});

const mockTopBar: { toolbar?: object; button?: Record<string, unknown> } = {};
const pink = lightThemes.pink;

async function withTheme(theme: 'light' | 'dark') {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ theme, language: 'es' }));
}

beforeEach(async () => {
  jest.clearAllMocks();
  delete mockTopBar.toolbar;
  delete mockTopBar.button;
  await AsyncStorage.clear();
  await withTheme('light');
  jest.mocked(isLiquidGlassAvailable).mockReturnValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the main action of a form, in the top bar', () => {
  it('on iOS is a native button, prominent and tinted with the accent (Liquid Glass)', async () => {
    const onPress = jest.fn();
    await renderWith(<HeaderAction label="Guardar" onPress={onPress} />);
    expect(mockTopBar.toolbar).toEqual({ placement: 'right' });
    expect(mockTopBar.button).toMatchObject({
      children: 'Guardar',
      accessibilityLabel: 'Guardar',
      variant: 'prominent',
      tintColor: pink.accent,
      disabled: false,
    });
    (mockTopBar.button?.onPress as () => void)();
    expect(onPress).toHaveBeenCalled();
  });

  it('cannot be pressed while saving, and says so', async () => {
    await renderWith(
      <HeaderAction label="Publicar" pendingLabel="Publicando…" loading onPress={jest.fn()} />,
    );
    expect(mockTopBar.button).toMatchObject({ children: 'Publicando…', disabled: true });
  });

  it('uses plain glass in the dark theme, whose accent is white', async () => {
    await withTheme('dark');
    await renderWith(<HeaderAction label="Guardar" onPress={jest.fn()} />);
    expect(mockTopBar.button).toMatchObject({ variant: 'plain' });
  });

  it('on Android is a Material text button with a 48 dp touch area', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const onPress = jest.fn();
    await renderWith(<HeaderAction label="Guardar" onPress={onPress} />);
    expect(mockTopBar.button).toBeUndefined();
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toHaveStyle({ minHeight: 48, minWidth: 48 });
    expect(screen.getByText('Guardar')).toHaveStyle({ color: pink.accent });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
  });

  it('on the web is a compact button', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await renderWith(<HeaderAction label="Guardar" disabled onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });
});

describe('glass buttons', () => {
  it('without Liquid Glass are filled with the accent, with white text', async () => {
    const onPress = jest.fn();
    await renderWith(<GlassButton label="Publicar" onPress={onPress} />);
    expect(screen.queryByTestId('glass')).toBeNull();
    expect(screen.getByText('Publicar')).toHaveStyle({ color: pink.onAccent });
    const button = screen.getByRole('button', { name: 'Publicar' });
    expect(button).toHaveStyle({ minHeight: 44 });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalled();
  });

  it('use Liquid Glass tinted with the accent when the phone has it', async () => {
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    await renderWith(<GlassButton label="Publicar" onPress={jest.fn()} />);
    expect(screen.getByTestId('glass').props).toMatchObject({
      isInteractive: true,
      tintColor: pink.accent,
    });
  });

  it('use plain glass in the dark theme', async () => {
    await withTheme('dark');
    jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
    await renderWith(<GlassButton label="Publicar" onPress={jest.fn()} />);
    expect(screen.getByTestId('glass').props.tintColor).toBeUndefined();
  });

  it('cannot be pressed while disabled', async () => {
    const onPress = jest.fn();
    await renderWith(<GlassButton label="Publicar" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  });

  it('float over the content with a 56 point touch area', async () => {
    await renderWith(
      <>
        <Text>Lista</Text>
        <FloatingAction icon="add" label="Dar en adopción" onPress={jest.fn()} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Dar en adopción' })).toHaveStyle({
      minHeight: 56,
    });
  });
});
