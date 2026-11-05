import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { mediaKind, mediaUrl, type Post } from '@/features/posts/api';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

/** A post shared in a message: author, first photo (or video mark) and text; opens the post. */
export function SharedPost({ post }: { post: Post | undefined }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { client } = useAuth();
  const colors = useThemeColors();
  const box = [styles.card, { backgroundColor: colors.background, borderColor: colors.border }];

  if (!post) {
    return (
      <View style={box}>
        <ThemedText variant="caption" color="textSecondary">
          {t('messages.postUnavailable')}
        </ThemedText>
      </View>
    );
  }
  const first = post.media[0];
  const username = post.author?.username ?? '';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('messages.openPost', { username })}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
      style={({ pressed }) => [...box, pressed && styles.pressed]}>
      <ThemedText variant="caption" style={styles.author}>
        @{username}
      </ThemedText>
      {first && mediaKind(first) === 'photo' ? (
        <Image source={{ uri: mediaUrl(client, post, first, '300x300') }} style={styles.photo} />
      ) : first ? (
        <View style={[styles.photo, styles.video, { backgroundColor: colors.surface }]}>
          <Icon name="video" selected size={28} color={colors.text} />
        </View>
      ) : null}
      {post.text ? (
        <ThemedText variant="caption" numberOfLines={3}>
          {post.text}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    minWidth: 180,
  },
  author: { fontWeight: '700' },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.md },
  video: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
