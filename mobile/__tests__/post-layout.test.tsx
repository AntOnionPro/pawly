import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';

import { CollapsibleText } from '@/components/CollapsibleText';
import type { Post } from '@/features/posts/api';
import { PostCard } from '@/features/posts/PostCard';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { renderWith, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));

const TEXT = 'Luna aprendió a dar la pata. Llevamos dos semanas practicando todas las tardes.';

const POST: Post = {
  id: 'p1',
  collectionId: 'posts',
  authorId: 'u2',
  author: { ...TEST_USER, id: 'u2', username: 'sol' },
  text: TEXT,
  media: ['foto.jpg'],
  petIds: ['pet1'],
  pets: [{ id: 'pet1', name: 'Luna' } as Post['pets'][number]],
  created: new Date().toISOString(),
  pawCount: 3,
  commentCount: 1,
  pawedByMe: false,
  myPawId: null,
  repostCount: 2,
  repostOfId: null,
  repostedByMe: false,
  myRepostId: null,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
});

/** Where each text appears in the rendered tree, to check the reading order. */
function order(...needles: string[]) {
  const tree = JSON.stringify(screen.toJSON());
  return needles.map((needle) => tree.indexOf(needle));
}

/** Layout events for the visible text and its hidden, uncut copy. */
async function measure(shown: number, full: number) {
  const [visible] = screen.getAllByText(TEXT);
  await fireEvent(visible!, 'layout', { nativeEvent: { layout: { height: shown } } });
  const copy = screen.getByTestId('collapsible-measure', { includeHiddenElements: true });
  await fireEvent(copy, 'layout', { nativeEvent: { layout: { height: full } } });
}

describe('PostCard', () => {
  it('reads author, text, pets, photos and then the counts', async () => {
    await renderWith(<PostCard post={POST} onPaw={jest.fn()} />);
    await screen.findByText('@sol');
    const [author, text, pet, photos, paw] = order(
      '@sol',
      'Luna aprendió',
      '"accessibilityLabel":"Luna"',
      'testID":"media"',
      'Dar huella',
    );
    expect(author).toBeLessThan(text!);
    expect(text).toBeLessThan(pet!);
    expect(pet).toBeLessThan(paw!);
    expect(photos === -1 || (photos! > pet! && photos! < paw!)).toBe(true);
    // Paw prints, comments and reposts (shared in the app) with their counts.
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
  });

  it('shows the whole text on the post page', async () => {
    await renderWith(<PostCard post={POST} fullText />);
    expect(await screen.findByText(TEXT)).not.toHaveProp('numberOfLines');
    expect(screen.queryByTestId('collapsible-measure', { includeHiddenElements: true })).toBeNull();
  });
});

describe('CollapsibleText', () => {
  it('cuts a long text to three lines with "ver más", which shows it whole', async () => {
    await renderWith(<CollapsibleText>{TEXT}</CollapsibleText>);
    const [visible] = await screen.findAllByText(TEXT);
    expect(visible).toHaveProp('numberOfLines', 3);
    expect(screen.queryByRole('button', { name: 'ver más' })).toBeNull();

    await measure(66, 132);
    await fireEvent.press(screen.getByRole('button', { name: 'ver más' }));
    expect(screen.getByText(TEXT)).not.toHaveProp('numberOfLines');
    expect(screen.queryByRole('button', { name: 'ver más' })).toBeNull();
  });

  it('shows a short text as it is', async () => {
    await renderWith(<CollapsibleText>{TEXT}</CollapsibleText>);
    await screen.findAllByText(TEXT);
    await measure(44, 44);
    expect(screen.queryByRole('button', { name: 'ver más' })).toBeNull();
  });
});
