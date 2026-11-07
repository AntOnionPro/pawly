import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { ThemedText } from '@/components/ThemedText';
import { palette } from '@/theme/colors';
import { radius, spacing } from '@/theme/typography';
import { useTaps } from '@/utils/useTaps';

import { mediaKind, mediaUrl, type MediaRecord } from './api';
import { VideoItem, type VideoSize } from './VideoItem';

/** The tallest frame (width / height): vertical videos show up to 4:5, like a portrait photo. */
const TALLEST = 4 / 5;

interface MediaCarouselProps {
  record: MediaRecord;
  /** Its video may start on its own (the post in view in the feed, or the post page). */
  autoPlay?: boolean;
  /** Runs on a double tap on a photo or video (a post's paw print). */
  onDoubleTap?: () => void;
  /** Drawn on top of the photos and videos (for example, the paw print of a double tap). */
  overlay?: ReactNode;
}

/**
 * Swipeable photos and videos of a post, an adoption listing or a rescue report, with a "2/5"
 * counter. The frame is square, or taller (up to 4:5) when the first file is a vertical video.
 * Only the video on screen plays.
 */
export function MediaCarousel({
  record,
  autoPlay = false,
  onDoubleTap,
  overlay,
}: MediaCarouselProps) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  // Width / height of the frame.
  const [ratio, setRatio] = useState(1);
  const tapPhoto = useTaps({ onDoubleTap });
  const count = record.media.length;
  if (count === 0) return null;
  const height = width / ratio;

  function firstVideoSize({ width: w, height: h }: VideoSize) {
    setRatio(Math.min(1, Math.max(TALLEST, w / h)));
  }

  return (
    <View
      testID="media-carousel"
      style={[styles.container, { aspectRatio: ratio }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          data={record.media}
          keyExtractor={(name) => name}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // Items change with the item on screen, autoplay and the frame height.
          extraData={`${index}|${autoPlay}|${height}`}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item, index: position }) => {
            const label = t('posts.mediaLabel', { number: position + 1, total: count });
            if (mediaKind(item) === 'video') {
              return (
                <View style={{ width, height }}>
                  <VideoItem
                    uri={mediaUrl(client, record, item)}
                    label={label}
                    current={position === index}
                    autoPlay={autoPlay}
                    onDoubleTap={onDoubleTap}
                    onSize={position === 0 ? firstVideoSize : undefined}
                  />
                </View>
              );
            }
            const photo = (
              <Image
                source={{ uri: mediaUrl(client, record, item) }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                accessibilityLabel={label}
              />
            );
            // Only touches: screen readers reach the same action through the paw print button.
            return onDoubleTap ? (
              <Pressable accessible={false} onPress={tapPhoto} style={{ width, height }}>
                {photo}
              </Pressable>
            ) : (
              <View style={{ width, height }}>{photo}</View>
            );
          }}
        />
      ) : null}
      {overlay}
      {count > 1 ? (
        <View style={styles.counter} accessibilityElementsHidden importantForAccessibility="no">
          <ThemedText variant="caption" style={styles.counterText}>
            {index + 1}/{count}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', borderRadius: radius.md, overflow: 'hidden' },
  counter: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    // Black and white so the counter is readable on any photo.
    backgroundColor: palette.black,
  },
  counterText: { color: palette.white, fontWeight: '600' },
});
