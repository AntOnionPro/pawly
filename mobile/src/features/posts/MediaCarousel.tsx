import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { ThemedText } from '@/components/ThemedText';
import { palette } from '@/theme/colors';
import { radius, spacing } from '@/theme/typography';

import { mediaKind, mediaUrl, type MediaRecord } from './api';
import { VideoItem } from './VideoItem';

/** Two taps closer than this are a double tap. */
const DOUBLE_TAP_MS = 300;

interface MediaCarouselProps {
  record: MediaRecord;
  /** Runs on a double tap on a photo or video (a post's paw print). */
  onDoubleTap?: () => void;
  /** Drawn on top of the photos and videos (for example, the paw print of a double tap). */
  overlay?: ReactNode;
}

/** Swipeable square photos and videos of a post or an adoption listing, with a "2/5" counter. */
export function MediaCarousel({ record, onDoubleTap, overlay }: MediaCarouselProps) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);
  const count = record.media.length;
  if (count === 0) return null;

  function tap() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onDoubleTap?.();
    } else {
      lastTap.current = now;
    }
  }

  return (
    <View
      testID="media-carousel"
      style={styles.container}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          data={record.media}
          keyExtractor={(name) => name}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item, index: position }) => {
            const label = t('posts.mediaLabel', { number: position + 1, total: count });
            const media =
              mediaKind(item) === 'video' ? (
                <VideoItem uri={mediaUrl(client, record, item)} label={label} />
              ) : (
                <Image
                  source={{ uri: mediaUrl(client, record, item) }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessibilityLabel={label}
                />
              );
            // Only touches: screen readers reach the same action through the paw print button.
            return onDoubleTap ? (
              <Pressable accessible={false} onPress={tap} style={{ width, height: width }}>
                {media}
              </Pressable>
            ) : (
              <View style={{ width, height: width }}>{media}</View>
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
  container: { width: '100%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden' },
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
