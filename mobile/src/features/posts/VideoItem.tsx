import { useEventListener } from 'expo';
import { useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/typography';
import { useAppActive } from '@/utils/useAppActive';
import { useTaps } from '@/utils/useTaps';

import { useAutoplayAllowed } from './useAutoplay';
import { setVideoSound, useVideoSound } from './videoSound';

export interface VideoSize {
  width: number;
  height: number;
}

interface VideoItemProps {
  uri: string;
  label: string;
  /** Whether it is the photo or video shown in its carousel. */
  current: boolean;
  /** Whether it may start on its own (the post in view in the feed, or the post page). */
  autoPlay: boolean;
  /** A double tap on the video (a post's paw print). */
  onDoubleTap?: () => void;
  /** The size of the video, once it has loaded. */
  onSize?: (size: VideoSize) => void;
}

// The player is an object owned by expo-video: these change it outside of React's state.
function setMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}
function setPlaying(player: VideoPlayer, playing: boolean) {
  if (playing) player.play();
  else player.pause();
}

/**
 * A post video. In view, it plays on its own, muted and in a loop (not with "Reduce motion" or
 * when saving data: then a play button starts it). A tap turns the sound on or off, a button
 * opens it in fullscreen (with the platform's controls), and it pauses when it leaves the screen
 * or the app goes to the background.
 */
export function VideoItem({ uri, label, current, autoPlay, onDoubleTap, onSize }: VideoItemProps) {
  const { t } = useTranslation();
  const focused = useIsFocused();
  const appActive = useAppActive();
  const autoplayAllowed = useAutoplayAllowed();
  const soundOn = useVideoSound();
  const view = useRef<VideoView>(null);
  // Started with a tap (when it does not start on its own); forgotten once it is out of view.
  const [started, setStarted] = useState(false);
  const [size, setSize] = useState<VideoSize | null>(null);
  const shown = current && focused && appActive;
  if (!shown && started) setStarted(false);
  const playing = shown && ((autoPlay && autoplayAllowed) || started);

  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });
  useEffect(() => setMuted(player, !soundOn), [player, soundOn]);
  useEffect(() => setPlaying(player, playing), [player, playing]);
  useEventListener(player, 'sourceLoad', ({ availableVideoTracks }) => {
    const loaded = availableVideoTracks[0]?.size;
    if (loaded && loaded.width > 0 && loaded.height > 0) {
      setSize(loaded);
      onSize?.(loaded);
    }
  });

  function start() {
    setStarted(true);
    setVideoSound(true);
  }
  const tap = useTaps({
    onTap: () => (playing ? setVideoSound(!soundOn) : start()),
    onDoubleTap,
  });

  return (
    <View style={styles.container}>
      <Pressable accessible={false} onPress={tap} style={StyleSheet.absoluteFill}>
        <VideoView
          ref={view}
          player={player}
          nativeControls={false}
          // Vertical videos fill their (taller) frame; horizontal ones show whole.
          contentFit={size && size.width > size.height ? 'contain' : 'cover'}
          accessibilityLabel={label}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      </Pressable>
      {playing ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('posts.video.play')}
          onPress={start}
          style={({ pressed }) => [styles.play, pressed && styles.pressed]}>
          <Icon name="play" size={36} color={palette.white} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('posts.video.fullscreen')}
        hitSlop={8}
        onPress={() => {
          start();
          void view.current?.enterFullscreen();
        }}
        style={({ pressed }) => [styles.badge, styles.left, pressed && styles.pressed]}>
        <Icon name="fullscreen" size={18} color={palette.white} />
      </Pressable>
      {playing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={soundOn ? t('posts.video.mute') : t('posts.video.unmute')}
          accessibilityState={{ selected: soundOn }}
          hitSlop={8}
          onPress={() => setVideoSound(!soundOn)}
          style={({ pressed }) => [styles.badge, styles.right, pressed && styles.pressed]}>
          <Icon name={soundOn ? 'soundOn' : 'soundOff'} size={18} color={palette.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const BADGE = 32;

const styles = StyleSheet.create({
  // Black around videos that do not fill the frame.
  container: { flex: 1, backgroundColor: palette.black },
  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -32,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    // Black and white so the buttons show on any video.
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  badge: {
    position: 'absolute',
    bottom: spacing.sm,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  left: { left: spacing.sm },
  right: { right: spacing.sm },
  pressed: { opacity: 0.6 },
});
