import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { ThemedText } from '@/components/ThemedText';
import { palette } from '@/theme/colors';
import { radius, spacing } from '@/theme/typography';

import { mediaKind, mediaUrl, type Post } from './api';
import { VideoItem } from './VideoItem';

/** Swipeable square photos and videos of a post, with a "2/5" counter. */
export function MediaCarousel({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const count = post.media.length;
  if (count === 0) return null;

  return (
    <View
      style={styles.container}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          data={post.media}
          keyExtractor={(name) => name}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item, index: position }) => {
            const label = t('posts.mediaLabel', { number: position + 1, total: count });
            return (
              <View style={{ width, height: width }}>
                {mediaKind(item) === 'video' ? (
                  <VideoItem uri={mediaUrl(client, post, item)} label={label} />
                ) : (
                  <Image
                    source={{ uri: mediaUrl(client, post, item) }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessibilityLabel={label}
                  />
                )}
              </View>
            );
          }}
        />
      ) : null}
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
