import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo, type NetInfoState } from '@react-native-community/netinfo';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import type { Post } from '@/features/posts/api';
import { postToPlay } from '@/features/posts/FeedList';
import { MediaCarousel } from '@/features/posts/MediaCarousel';
import { VideoItem } from '@/features/posts/VideoItem';
import { setVideoSound } from '@/features/posts/videoSound';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { renderWith, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useIsFocused: () => mockScreen.focused }));
// A fake player: records what the app asks of it.
jest.mock('expo-video', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    useVideoPlayer: (_uri: string, setup?: (player: typeof mockPlayer) => void) => {
      React.useState(() => setup?.(mockPlayer));
      return mockPlayer;
    },
    VideoView: React.forwardRef(function VideoView(
      props: { accessibilityLabel?: string },
      ref: React.Ref<{ enterFullscreen: () => Promise<void> }>,
    ) {
      React.useImperativeHandle(ref, () => ({ enterFullscreen: mockEnterFullscreen }));
      return React.createElement(View, {
        testID: 'video-view',
        accessible: true,
        accessibilityLabel: props.accessibilityLabel,
      });
    }),
  };
});
jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  useEventListener: (_player: unknown, event: string, listener: (payload: unknown) => void) => {
    mockListeners[event] = listener;
  },
}));

const mockScreen = { focused: true };
const mockPlayer = { play: jest.fn(), pause: jest.fn(), muted: false, loop: false };
const mockEnterFullscreen = jest.fn(async () => undefined);
const mockListeners: Record<string, (payload: unknown) => void> = {};

beforeEach(async () => {
  jest.clearAllMocks();
  mockScreen.focused = true;
  mockPlayer.muted = false;
  mockPlayer.loop = false;
  setVideoSound(false);
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Whether the player is playing now (the last thing asked of it). */
function isPlaying() {
  const lastPlay = Math.max(-1, ...mockPlayer.play.mock.invocationCallOrder);
  const lastPause = Math.max(-1, ...mockPlayer.pause.mock.invocationCallOrder);
  return lastPlay > lastPause;
}

/** A video whose place on screen changes with a button ("Next" shows another item). */
function Harness({
  autoPlay = true,
  onDoubleTap,
}: {
  autoPlay?: boolean;
  onDoubleTap?: () => void;
}) {
  const [current, setCurrent] = useState(true);
  const [, rerender] = useState(0);
  return (
    <>
      <VideoItem
        uri="https://pawly.test/clip.mp4"
        label="Archivo 1 de 2"
        current={current}
        autoPlay={autoPlay}
        onDoubleTap={onDoubleTap}
      />
      <Pressable accessibilityRole="button" onPress={() => setCurrent((value) => !value)}>
        <Text>Siguiente</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => rerender((value) => value + 1)}>
        <Text>Actualizar</Text>
      </Pressable>
    </>
  );
}

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe('post videos', () => {
  it('play on their own, muted and in a loop, only while on screen', async () => {
    await renderWith(<Harness />);
    expect(mockPlayer.loop).toBe(true);
    expect(mockPlayer.muted).toBe(true);
    expect(isPlaying()).toBe(true);
    expect(screen.getByRole('button', { name: 'Activar sonido' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reproducir video' })).toBeNull();

    // Another photo or video of the carousel is shown.
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    expect(isPlaying()).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
    expect(isPlaying()).toBe(true);
  });

  it('pause when the screen is left', async () => {
    await renderWith(<Harness />);
    expect(isPlaying()).toBe(true);
    mockScreen.focused = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Actualizar' }));
    expect(isPlaying()).toBe(false);
  });

  it('do not start on their own when it is not their turn; the play button starts them', async () => {
    await renderWith(<Harness autoPlay={false} />);
    expect(isPlaying()).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Reproducir video' }));
    expect(isPlaying()).toBe(true);
    // Started on purpose: with sound.
    expect(mockPlayer.muted).toBe(false);
    expect(screen.getByRole('button', { name: 'Quitar sonido' })).toBeOnTheScreen();
  });

  it('do not start on their own with "Reduce motion"', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderWith(<Harness />);
    expect(isPlaying()).toBe(false);
    expect(screen.getByRole('button', { name: 'Reproducir video' })).toBeOnTheScreen();
  });

  it('a tap turns the sound on and off', async () => {
    await renderWith(<Harness />);
    await fireEvent.press(screen.getByLabelText('Archivo 1 de 2'));
    expect(mockPlayer.muted).toBe(false);
    expect(screen.getByRole('button', { name: 'Quitar sonido' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar sonido' }));
    expect(mockPlayer.muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Activar sonido' })).toBeOnTheScreen();
  });

  it('a double tap gives the paw print without changing the sound', async () => {
    const onDoubleTap = jest.fn();
    await renderWith(<Harness onDoubleTap={onDoubleTap} />);
    const video = screen.getByLabelText('Archivo 1 de 2');

    await fireEvent.press(video);
    await fireEvent.press(video);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    await wait(350);
    expect(mockPlayer.muted).toBe(true);

    // A single tap waits a moment, in case a second one follows.
    await fireEvent.press(video);
    expect(mockPlayer.muted).toBe(true);
    await wait(350);
    expect(mockPlayer.muted).toBe(false);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it('open in fullscreen, playing with sound', async () => {
    await renderWith(<Harness autoPlay={false} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ver en pantalla completa' }));
    expect(mockEnterFullscreen).toHaveBeenCalled();
    expect(isPlaying()).toBe(true);
    expect(mockPlayer.muted).toBe(false);
  });

  it('the sound choice carries to the next videos', async () => {
    setVideoSound(true);
    await renderWith(<Harness />);
    expect(mockPlayer.muted).toBe(false);
    expect(screen.getByRole('button', { name: 'Quitar sonido' })).toBeOnTheScreen();
  });
});

describe('the "Autoplay videos" setting', () => {
  async function withSetting(autoplay: string, network: Partial<NetInfoState>) {
    await AsyncStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ theme: 'light', language: 'es', autoplay }),
    );
    jest.mocked(useNetInfo).mockReturnValue(network as NetInfoState);
    await renderWith(<Harness />);
  }
  const wifi = { type: 'wifi', details: { isConnectionExpensive: false } } as NetInfoState;
  const mobileData = { type: 'cellular', details: { isConnectionExpensive: true } } as NetInfoState;
  const hotspot = { type: 'wifi', details: { isConnectionExpensive: true } } as NetInfoState;

  it('"Always" plays them on mobile data too', async () => {
    await withSetting('always', mobileData);
    expect(isPlaying()).toBe(true);
  });

  it('"Wi-Fi only" plays them on Wi-Fi', async () => {
    await withSetting('wifi', wifi);
    expect(isPlaying()).toBe(true);
  });

  it('"Wi-Fi only" does not play them on mobile data', async () => {
    await withSetting('wifi', mobileData);
    expect(isPlaying()).toBe(false);
    expect(screen.getByRole('button', { name: 'Reproducir video' })).toBeOnTheScreen();
  });

  it('"Wi-Fi only" does not play them on a phone\'s hotspot', async () => {
    await withSetting('wifi', hotspot);
    expect(isPlaying()).toBe(false);
  });

  it('"Never" does not play them on their own', async () => {
    await withSetting('never', wifi);
    expect(isPlaying()).toBe(false);
  });
});

describe('the frame of photos and videos', () => {
  const record = { id: 'post1', collectionId: 'posts', media: ['clip.mp4', 'foto.jpg'] };

  async function carouselWithVideo(width: number, height: number) {
    await renderWith(<MediaCarousel record={record} autoPlay />);
    const carousel = screen.getByTestId('media-carousel');
    await fireEvent(carousel, 'layout', { nativeEvent: { layout: { width: 400, height: 400 } } });
    await act(() =>
      mockListeners.sourceLoad?.({ availableVideoTracks: [{ size: { width, height } }] }),
    );
    return screen.getByTestId('media-carousel');
  }

  it('is taller (4:5) when the first file is a vertical video', async () => {
    expect(await carouselWithVideo(720, 1280)).toHaveStyle({ aspectRatio: 0.8 });
  });

  it('stays square for horizontal videos', async () => {
    expect(await carouselWithVideo(1920, 1080)).toHaveStyle({ aspectRatio: 1 });
  });
});

describe('which video plays in the feed', () => {
  const post = (id: string, media: string[]): Post => ({
    id,
    collectionId: 'posts',
    authorId: 'u1',
    author: TEST_USER,
    text: '',
    media,
    petIds: [],
    pets: [],
    created: '2026-11-05 10:00:00.000Z',
    pawCount: 0,
    commentCount: 0,
    pawedByMe: false,
    myPawId: null,
    repostCount: 0,
    repostOfId: null,
    repostedByMe: false,
    myRepostId: null,
  });

  it('is the first post in view with a video, also inside a repost', () => {
    const photo = post('a', ['foto.jpg']);
    const video = post('b', ['foto.jpg', 'clip.mp4']);
    const later = post('c', ['otro.mov']);
    const repost = { ...post('r', []), repostOfId: 'b', repostOf: video };
    const inView = (item: Post, isViewable = true) => ({ item, isViewable });

    expect(postToPlay([inView(photo), inView(video), inView(later)])).toBe('b');
    expect(postToPlay([inView(video, false), inView(later)])).toBe('c');
    expect(postToPlay([inView(repost)])).toBe('r');
    expect(postToPlay([inView(photo)])).toBeNull();
  });
});
