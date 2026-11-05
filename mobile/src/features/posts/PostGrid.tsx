import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { mediaKind, mediaUrl, type Post, type PostFilter } from './api';
import { usePostList } from './hooks';

function Tile({ post, onPress }: { post: Post; onPress: () => void }) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const colors = useThemeColors();
  const first = post.media[0];
  const label = post.text || t('posts.textOnly');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      {first && mediaKind(first) === 'photo' ? (
        <Image
          source={{ uri: mediaUrl(client, post, first, '300x300') }}
          style={StyleSheet.absoluteFill}
        />
      ) : first ? (
        <View style={styles.centered}>
          <Icon name="video" selected size={28} color={colors.text} />
        </View>
      ) : (
        <View style={styles.centered}>
          <ThemedText variant="caption" numberOfLines={4} style={styles.text}>
            {post.text}
          </ThemedText>
        </View>
      )}
      {post.media.length > 1 ? (
        <View style={styles.badge}>
          <Icon name="gallery" size={14} color={colors.text} />
        </View>
      ) : null}
    </Pressable>
  );
}

interface PostGridProps {
  filter: PostFilter;
  title: string;
  empty: string;
}

/** Three-column grid of posts (a user's or a pet's), with "Show more". */
export function PostGrid({ filter, title, empty }: PostGridProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePostList(filter);
  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View style={styles.section}>
      <ThemedText variant="label" color="textSecondary">
        {title}
      </ThemedText>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {!isPending && !error && posts.length === 0 ? (
        <ThemedText color="textSecondary">{empty}</ThemedText>
      ) : null}
      <View style={styles.grid}>
        {posts.map((post) => (
          <Tile
            key={post.id}
            post={post}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
          />
        ))}
      </View>
      {hasNextPage ? (
        <Button
          variant="secondary"
          label={t('posts.loadMore')}
          onPress={() => void fetchNextPage()}
          loading={isFetchingNextPage}
        />
      ) : null}
    </View>
  );
}

const GAP = 2;

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    width: `${(100 - 2) / 3}%`,
    aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xs },
  text: { textAlign: 'center' },
  badge: { position: 'absolute', top: spacing.xs, right: spacing.xs },
  pressed: { opacity: 0.6 },
});
