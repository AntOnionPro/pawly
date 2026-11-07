import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { CollapsibleText } from '@/components/CollapsibleText';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { ThemedText } from '@/components/ThemedText';
import { CommentButton } from '@/features/comments/CommentButton';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { useReduceMotion } from '@/utils/useReduceMotion';
import { useRelativeDate } from '@/utils/useRelativeDate';

import type { Post } from './api';
import { MediaCarousel } from './MediaCarousel';
import { PawBurst } from './PawBurst';
import { PawButton } from './PawButton';
import { RepostButton } from './RepostButton';

interface PostCardProps {
  post: Post;
  onPressPet?: (petId: string) => void;
  onPressAuthor?: (authorId: string) => void;
  /** Opens the post page (from the feed). */
  onOpen?: () => void;
  /**
   * Adds or removes the paw print. Without it the count is shown read-only. A double tap on the
   * photos and videos also calls it, only to give the paw print (never to remove it).
   */
  onPaw?: () => void;
  /** Opens or focuses the comments. Without it the count is shown read-only. */
  onComments?: () => void;
  /** Reposts the post or undoes the repost. Without it the count is shown read-only. */
  onRepost?: () => void;
  /** Shares the link outside the app. Without it there is no share button. */
  onShare?: () => void;
  /** Author actions; shown only when given. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** Reports the post (for posts by someone else). */
  onReport?: () => void;
  /** The whole text (the post page); otherwise long texts are cut with "See more". */
  fullText?: boolean;
}

/**
 * A post, in reading order: author and date, text, tagged pets, photos and videos, and the
 * paw prints, comments and reposts with their counts.
 */
export function PostCard({
  post,
  onPressPet,
  onPressAuthor,
  onOpen,
  onPaw,
  onComments,
  onRepost,
  onShare,
  onEdit,
  onDelete,
  onReport,
  fullText = false,
}: PostCardProps) {
  const { t } = useTranslation();
  const { client, status } = useAuth();
  const reduceMotion = useReduceMotion();
  // Each double tap shows a new big paw print (a new key restarts it).
  const [burst, setBurst] = useState(0);
  const author = post.author;
  const date = useRelativeDate(post.created);
  const pets = <TaggedPets post={post} onPressPet={onPressPet} />;

  function doubleTap() {
    if (!post.pawedByMe) onPaw?.();
    // Visitors go to sign in instead.
    if (status === 'signedIn' && !reduceMotion) setBurst((current) => current + 1);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole={onPressAuthor ? 'link' : undefined}
          accessibilityLabel={author ? `@${author.username}` : undefined}
          disabled={!onPressAuthor || !author}
          onPress={() => author && onPressAuthor?.(author.id)}
          style={({ pressed }) => [styles.author, pressed && styles.pressed]}>
          {author ? (
            <Avatar
              uri={avatarUrl(client, author, '100x100')}
              username={author.username}
              size={40}
            />
          ) : null}
          {author ? <ThemedText style={styles.username}>@{author.username}</ThemedText> : null}
        </Pressable>
        <Pressable
          accessibilityRole={onOpen ? 'link' : undefined}
          accessibilityLabel={onOpen ? t('posts.open', { date }) : date}
          disabled={!onOpen}
          hitSlop={8}
          onPress={onOpen}
          style={({ pressed }) => [styles.date, pressed && styles.pressed]}>
          <ThemedText variant="caption" color="textSecondary">
            {date}
          </ThemedText>
        </Pressable>
        {onEdit ? <IconButton icon="edit" label={t('posts.edit')} onPress={onEdit} /> : null}
        {onDelete ? (
          <IconButton icon="delete" label={t('posts.delete')} onPress={onDelete} />
        ) : null}
        {onReport ? (
          <IconButton icon="flag" size={20} label={t('report.post')} onPress={onReport} />
        ) : null}
      </View>
      {post.text ? (
        fullText ? (
          <ThemedText>{post.text}</ThemedText>
        ) : (
          <CollapsibleText>{post.text}</CollapsibleText>
        )
      ) : null}
      {pets}
      <MediaCarousel
        record={post}
        onDoubleTap={onPaw ? doubleTap : undefined}
        overlay={burst > 0 ? <PawBurst key={burst} onEnd={() => setBurst(0)} /> : null}
      />
      <View style={styles.actions}>
        <PawButton count={post.pawCount} pawed={post.pawedByMe} onPress={onPaw} />
        <CommentButton count={post.commentCount} onPress={onComments} />
        <RepostButton count={post.repostCount} reposted={post.repostedByMe} onPress={onRepost} />
        {onShare ? (
          <View style={styles.share}>
            <IconButton icon="share" label={t('share.label')} onPress={onShare} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Chips of the pets tagged in a post, which open their pages. */
function TaggedPets({ post, onPressPet }: Pick<PostCardProps, 'post' | 'onPressPet'>) {
  const colors = useThemeColors();
  return (
    <>
      {post.pets.length > 0 ? (
        <View style={styles.pets}>
          {post.pets.map((pet) => (
            <Pressable
              key={pet.id}
              accessibilityRole="link"
              accessibilityLabel={pet.name}
              onPress={() => onPressPet?.(pet.id)}
              style={({ pressed }) => [
                styles.pet,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <Icon name="paw" selected size={14} color={colors.text} />
              <ThemedText variant="caption" style={styles.petName}>
                {pet.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  date: { paddingVertical: spacing.xs },
  username: { fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  share: { marginLeft: 'auto' },
  pets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 32,
    borderRadius: radius.md * 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  petName: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
