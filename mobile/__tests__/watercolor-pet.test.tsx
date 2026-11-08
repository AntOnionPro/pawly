import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import SignInScreen from '@/app/sign-in';
import SignUpScreen from '@/app/sign-up';
import { Screen } from '@/components/Screen';
import { petsFor } from '@/components/WatercolorPet';
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
function shownPet() {
  const id = screen.getByTestId(/^watercolor-pet-/, { includeHiddenElements: true }).props
    .testID as string;
  return id.replace('watercolor-pet-', '');
}

/** Gives the sign-in cat the room left under the form, as the layout would. */
async function roomForPet(height: number) {
  await fireEvent(screen.getByTestId('watercolor-pet', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
  });
}

function petImage() {
  return screen.queryByTestId(/^watercolor-pet-/, { includeHiddenElements: true });
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

  it('show a watercolor cat or dog at the end, hidden from screen readers and touches', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await renderWith(<SignUpScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    expect(screen.queryByTestId('watercolor-pet')).toBeNull();
    const cat = screen.getByTestId('watercolor-pet', { includeHiddenElements: true });
    expect(cat).toHaveProp('pointerEvents', 'none');
    expect(cat).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(cat).toHaveProp('accessibilityElementsHidden', true);
    // Pushed to the bottom of the screen: it never sits under the fields.
    expect(cat).toHaveStyle({ marginTop: 'auto' });
    expect(shownPet()).toBe('blackCat');
  });

  it.each([
    [0.2, 'siameseCat'],
    [0.4, 'gingerCat'],
    [0.5, 'husky'],
    [0.7, 'pitbull'],
    [0.99, 'dachshund'],
  ])('choose a cat or a dog at random (%s → %s)', async (random, name) => {
    jest.spyOn(Math, 'random').mockReturnValue(random);
    await renderWith(<SignInScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    await roomForPet(300);
    expect(shownPet()).toBe(name);
  });

  it('never show the black cat on the black of the dark theme', async () => {
    await withTheme('dark');
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await renderWith(<SignInScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    await roomForPet(300);
    expect(shownPet()).toBe('siameseCat');
    expect(petsFor('dark')).not.toContain('blackCat');
    expect(petsFor('dark')).toHaveLength(5);
    expect(petsFor('light')).toEqual([
      'blackCat',
      'siameseCat',
      'gingerCat',
      'husky',
      'pitbull',
      'dachshund',
    ]);
  });
});

describe('the sign-in pet fits the screen', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('takes the room left under the form, up to 260 points, so nothing needs scrolling', async () => {
    await renderWith(<SignInScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    const room = screen.getByTestId('watercolor-pet', { includeHiddenElements: true });
    // It takes exactly the room left: the image never makes it taller.
    expect(room).toHaveStyle({ flex: 1 });
    await roomForPet(400);
    expect(petImage()).toHaveStyle({ height: 260 });
    await roomForPet(150);
    expect(petImage()).toHaveStyle({ height: 150 });
  });

  it('does not show when there is too little room (a small phone, or the keyboard open)', async () => {
    await renderWith(<SignInScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    await roomForPet(60);
    expect(petImage()).toBeNull();
  });

  it('on sign up it goes after the content, which scrolls anyway', async () => {
    await renderWith(<SignUpScreen />);
    await screen.findByRole('header', { name: 'Pawly' });
    expect(screen.getByTestId('watercolor-pet', { includeHiddenElements: true })).toHaveStyle({
      marginTop: 'auto',
    });
    expect(petImage()).toBeOnTheScreen();
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
