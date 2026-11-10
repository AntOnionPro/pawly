import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';
import { Dimensions, Text } from 'react-native';

import { PhotoRow, ROW_PHOTO, WIDE_ROW_PHOTO } from '@/components/PhotoRow';
import { SPECIES } from '@/features/pets/api';
import { SPECIES_ICONS, speciesSymbol } from '@/features/pets/SpeciesIcon';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { renderWith } from '../test-utils/render';

describe('species icons', () => {
  it('has an icon for every species', () => {
    for (const species of SPECIES) {
      expect(SPECIES_ICONS[species].community).toBeTruthy();
    }
  });

  it('uses SF Symbols on iOS when the system has them', () => {
    expect(speciesSymbol('dog', 'ios', '17.0')).toEqual({ sf: 'dog.fill' });
    expect(speciesSymbol('cat', 'ios', '26.1')).toEqual({ sf: 'cat.fill' });
    expect(speciesSymbol('bird', 'ios', '16.4')).toEqual({ sf: 'bird.fill' });
    // The dog and the cat arrived in iOS 17, and there is no rodent.
    expect(speciesSymbol('dog', 'ios', '16.4')).toEqual({ community: 'dog' });
    expect(speciesSymbol('rodent', 'ios', '26.1')).toEqual({ community: 'rodent' });
  });

  it('uses the Material Design community icons on Android and the web', () => {
    expect(speciesSymbol('cat', 'android', 35)).toEqual({ community: 'cat' });
    expect(speciesSymbol('fish', 'web', '')).toEqual({ community: 'fish' });
    expect(speciesSymbol('other', 'android', 35)).toEqual({ community: 'paw' });
  });
});

describe('row with a photo', () => {
  async function renderRow(
    windowWidth: number,
    photo: string | null = 'https://example.com/a.jpg',
  ) {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: windowWidth, height: 900, scale: 1, fontScale: 1 });
    await renderWith(
      <PhotoRow leading={null} photo={photo} accessibilityLabel="Luna" onPress={jest.fn()}>
        <Text>Luna</Text>
      </PhotoRow>,
    );
  }

  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows a square photo on a phone', async () => {
    await renderRow(390);
    expect(await screen.findByTestId('row-photo')).toHaveStyle({ width: ROW_PHOTO });
  });

  it('shows a wider photo on a wide screen', async () => {
    await renderRow(1440);
    expect(await screen.findByTestId('row-photo')).toHaveStyle({ width: WIDE_ROW_PHOTO });
  });

  it('leaves out the photo when there is none', async () => {
    await renderRow(390, null);
    expect(await screen.findByRole('link', { name: 'Luna' })).toBeOnTheScreen();
    expect(screen.queryByTestId('row-photo')).toBeNull();
  });
});
