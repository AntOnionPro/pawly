import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';
import { Platform, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { AdoptionList } from '@/features/adoption/AdoptionList';
import { FeedList } from '@/features/posts/FeedList';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { column, COLUMN_WIDTH, tabBarTopSpace, WIDE_COLUMN_WIDTH } from '@/theme/layout';

import { authValue, renderWith } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
// Empty lists: only their layout matters here.
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(async () => ({ items: [], page: 1, hasMore: false })),
}));
jest.mock('@/features/adoption/api', () => ({
  ...jest.requireActual('@/features/adoption/api'),
  listAdoptions: jest.fn(async () => ({ items: [], page: 1, hasMore: false })),
}));

/** The flattened style of a scroll view's content. */
function contentStyle(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.contentContainerStyle);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('on a big screen (a computer or a tablet)', () => {
  it('the content goes in a centered column', () => {
    expect(column()).toEqual({ width: '100%', maxWidth: COLUMN_WIDTH, alignSelf: 'center' });
    expect(column(WIDE_COLUMN_WIDTH).maxWidth).toBe(WIDE_COLUMN_WIDTH);
  });

  it('screens, the feed and the Adoption list are centered columns', async () => {
    await renderWith(
      <Screen>
        <Text>Contenido</Text>
      </Screen>,
    );
    expect(contentStyle('screen-scroll')).toMatchObject({ maxWidth: 640, alignSelf: 'center' });

    await renderWith(<FeedList />, authValue());
    await screen.findByText('Aún no hay publicaciones. Sé el primero en compartir a tu mascota.');
    expect(contentStyle('feed')).toMatchObject({ maxWidth: 640, alignSelf: 'center' });

    await renderWith(<AdoptionList />, authValue());
    await screen.findByText('Por ahora no hay mascotas en adopción.');
    expect(contentStyle('adoptions')).toMatchObject({ maxWidth: 760, alignSelf: 'center' });
  });
});

describe('the tab bar of the web', () => {
  it('floats over the top of the page, so tab screens leave room for it', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    expect(tabBarTopSpace()).toBe(72);
    await renderWith(
      <Screen tab>
        <Text>Perfil</Text>
      </Screen>,
    );
    expect(contentStyle('screen-scroll')).toMatchObject({ paddingTop: 16 + 72 });
    await renderWith(<FeedList />, authValue());
    await screen.findByText('Aún no hay publicaciones. Sé el primero en compartir a tu mascota.');
    expect(contentStyle('feed')).toMatchObject({ paddingTop: 16 + 72 });
  });

  it('on iOS and Android it is at the bottom: no room at the top', async () => {
    expect(tabBarTopSpace()).toBe(0);
    await renderWith(
      <Screen tab>
        <Text>Perfil</Text>
      </Screen>,
    );
    expect(contentStyle('screen-scroll')).toMatchObject({ paddingTop: 16 });
  });

  it('only tab screens leave that room', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await renderWith(
      <Screen>
        <Text>Ajustes</Text>
      </Screen>,
    );
    expect(contentStyle('screen-scroll')).toMatchObject({ padding: 16 });
    expect(contentStyle('screen-scroll').paddingTop).toBeUndefined();
  });
});
