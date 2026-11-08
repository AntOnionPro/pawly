import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import SignInScreen from '@/app/sign-in';
import SignUpScreen from '@/app/sign-up';
import { Screen } from '@/components/Screen';
import { catsFor } from '@/components/WatercolorCat';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { renderWith } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), canDismiss: () => false }),
}));

async function withTheme(theme: 'light' | 'dark') {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ theme, language: 'es' }));
}

/** Which cat is on screen (hidden from screen readers, so the query includes hidden ones). */
function shownCat() {
  const id = screen.getByTestId(/^watercolor-cat-/, { includeHiddenElements: true }).props
    .testID as string;
  return id.replace('watercolor-cat-', '');
}

/** Gives the sign-in cat the room left under the form, as the layout would. */
async function roomForCat(height: number) {
  await fireEvent(screen.getByTestId('watercolor-cat', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
  });
}

function catImage() {
  return screen.queryByTestId(/^watercolor-cat-/, { includeHiddenElements: true });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await withTheme('light');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('sign in and sign up', () => {
  it('show the name of the app above the fields', async () => {
    await renderWith(<SignInScreen />);
    expect(await screen.findByRole('header', { name: 'Pawly' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Correo')).toBeOnTheScreen();
  });

  it('show a watercolor cat at the end, hidden from screen readers and touches', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await renderWith(<SignUpScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    expect(screen.queryByTestId('watercolor-cat')).toBeNull();
    const cat = screen.getByTestId('watercolor-cat', { includeHiddenElements: true });
    expect(cat).toHaveProp('pointerEvents', 'none');
    expect(cat).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(cat).toHaveProp('accessibilityElementsHidden', true);
    // Pushed to the bottom of the screen: it never sits under the fields.
    expect(cat).toHaveStyle({ marginTop: 'auto' });
    expect(shownCat()).toBe('black');
  });

  it.each([
    [0.5, 'siamese'],
    [0.99, 'ginger'],
  ])('choose the cat at random (%s → %s)', async (random, name) => {
    jest.spyOn(Math, 'random').mockReturnValue(random);
    await renderWith(<SignInScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    await roomForCat(300);
    expect(shownCat()).toBe(name);
  });

  it('never show the black cat on the black of the dark theme', async () => {
    await withTheme('dark');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await renderWith(<SignInScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    await roomForCat(300);
    expect(shownCat()).toBe('siamese');
    expect(catsFor('dark')).not.toContain('black');
    expect(catsFor('light')).toEqual(['black', 'siamese', 'ginger']);
  });
});

describe('the sign-in cat fits the screen', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('takes the room left under the form, up to 260 points, so nothing needs scrolling', async () => {
    await renderWith(<SignInScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    const room = screen.getByTestId('watercolor-cat', { includeHiddenElements: true });
    // It takes exactly the room left: the image never makes it taller.
    expect(room).toHaveStyle({ flex: 1 });
    await roomForCat(400);
    expect(catImage()).toHaveStyle({ height: 260 });
    await roomForCat(150);
    expect(catImage()).toHaveStyle({ height: 150 });
  });

  it('does not show when there is too little room (a small phone, or the keyboard open)', async () => {
    await renderWith(<SignInScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    await roomForCat(60);
    expect(catImage()).toBeNull();
  });

  it('on sign up it goes after the content, which scrolls anyway', async () => {
    await renderWith(<SignUpScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    expect(screen.getByTestId('watercolor-cat', { includeHiddenElements: true })).toHaveStyle({
      marginTop: 'auto',
    });
    expect(catImage()).toBeOnTheScreen();
  });
});

describe('Screen', () => {
  it('fills the visible height of the screen, not more', async () => {
    await renderWith(
      <Screen>
        <Text>Contenido</Text>
      </Screen>,
    );
    const scroll = await screen.findByTestId('screen-scroll');
    await fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } },
    });
    expect(screen.getByTestId('screen-scroll').props.contentContainerStyle).toEqual(
      expect.arrayContaining([{ minHeight: 800 }]),
    );
  });
});
