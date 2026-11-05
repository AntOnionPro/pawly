import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { useReportAction } from '@/features/moderation/hooks';
import { useRelativeDate } from '@/utils/useRelativeDate';

import type { Post } from './api';
import { usePawAction } from './paws';
import { PostCard } from './PostCard';
import { useRepostAction, useShareAction, useUndoRepostAction } from './reposts';

/** A post with every action of a list (feed): open, paw, comments, repost, share, links. */
function ListPostCard({ post }: { post: Post }) {
  const router = useRouter();
  const { user } = useAuth();
  const report = useReportAction();
  const paw = usePawAction();
  const repost = useRepostAction();
  const share = useShareAction();
  const open = () => router.push({ pathname: '/post/[id]', params: { id: post.id } });
  return (
    <PostCard
      post={post}
      onOpen={open}
      onPaw={() => paw(post)}
      onComments={open}
      onRepost={() => repost(post)}
      onShare={() => share(post)}
      onReport={
        user?.id === post.authorId ? undefined : () => report({ kind: 'post', id: post.id })
      }
      onPressAuthor={(id) => router.push({ pathname: '/user/[id]', params: { id } })}
      onPressPet={(id) => router.push({ pathname: '/pet/[id]', params: { id } })}
    />
  );
}

/** "@user reposted", their optional comment and the original post inside. */
function RepostCard({ repost }: { repost: Post }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const undo = useUndoRepostAction();
  const date = useRelativeDate(repost.created);
  const author = repost.author;
  const original = repost.repostOf;
  const isMine = user?.id === repost.authorId;

  return (
    <View style={styles.repost}>
      <View style={styles.header}>
        <Icon name="repost" size={18} color={colors.textSecondary} />
        <Pressable
          accessibilityRole={author ? 'link' : undefined}
          disabled={!author}
          onPress={() =>
            author && router.push({ pathname: '/user/[id]', params: { id: author.id } })
          }
          style={({ pressed }) => [styles.who, pressed && styles.pressed]}>
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
            <ThemedText variant="caption" style={styles.username}>
              {t('reposts.reposted', { username: author?.username ?? '' })}
            </ThemedText>
            {` · ${date}`}
          </ThemedText>
        </Pressable>
        {isMine && repost.repostOfId ? (
          <IconButton
            icon="delete"
            size={18}
            label={t('reposts.undo')}
            onPress={() => undo(repost.repostOfId ?? '', repost.id)}
          />
        ) : null}
      </View>
      {repost.text ? <ThemedText>{repost.text}</ThemedText> : null}
      <View style={[styles.original, { borderColor: colors.border }]}>
        {original ? (
          <ListPostCard post={original} />
        ) : (
          <ThemedText color="textSecondary">{t('reposts.unavailable')}</ThemedText>
        )}
      </View>
    </View>
  );
}

/** A post in a list: a regular post, or a repost with its original inside. */
export function PostListItem({ post }: { post: Post }) {
  return post.repostOfId ? <RepostCard repost={post} /> : <ListPostCard post={post} />;
}

const styles = StyleSheet.create({
  repost: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  who: { flex: 1 },
  username: { fontWeight: '600' },
  original: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  pressed: { opacity: 0.6 },
});
