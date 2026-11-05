import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { parseServerDate, relativeTime } from '@/utils/time';

import type { Post } from './api';
import { MediaCarousel } from './MediaCarousel';

interface PostCardProps {
  post: Post;
  onPressPet?: (petId: string) => void;
  onPressAuthor?: (authorId: string) => void;
  /** Opens the post page (from the feed). */
  onOpen?: () => void;
  /** Author actions; shown only when given. */
  onEdit?: () => void;
  onDelete?: () => void;
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: 'edit' | 'delete';
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Icon name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

/** "2 h", "3 d"… or the date after a week. */
function usePostDate(created: string): string {
  const { t, i18n } = useTranslation();
  const date = parseServerDate(created);
  if (!date) return '';
  const relative = relativeTime(date);
  switch (relative.unit) {
    case 'now':
      return t('time.now');
    case 'minutes':
    case 'hours':
    case 'days':
      return t(`time.${relative.unit}`, { count: relative.count });
    default:
      return relative.date.toLocaleDateString(i18n.language, { dateStyle: 'medium' });
  }
}

/** Author, date, photos and videos, text and tagged pets of a post. */
export function PostCard({
  post,
  onPressPet,
  onPressAuthor,
  onOpen,
  onEdit,
  onDelete,
}: PostCardProps) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const colors = useThemeColors();
  const author = post.author;
  const date = usePostDate(post.created);

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
      </View>
      <MediaCarousel post={post} />
      {post.text ? <ThemedText>{post.text}</ThemedText> : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  date: { paddingVertical: spacing.xs },
  username: { fontWeight: '600' },
  iconButton: { padding: spacing.xs },
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
