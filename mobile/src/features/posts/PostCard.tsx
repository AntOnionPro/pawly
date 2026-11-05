import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import type { Post } from './api';
import { MediaCarousel } from './MediaCarousel';

interface PostCardProps {
  post: Post;
  onPressPet?: (petId: string) => void;
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

/** Author, date, photos and videos, text and tagged pets of a post. */
export function PostCard({ post, onPressPet, onEdit, onDelete }: PostCardProps) {
  const { t, i18n } = useTranslation();
  const { client } = useAuth();
  const colors = useThemeColors();
  const author = post.author;
  const date = post.created
    ? new Date(post.created.replace(' ', 'T')).toLocaleDateString(i18n.language, {
        dateStyle: 'medium',
      })
    : '';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {author ? (
          <Avatar uri={avatarUrl(client, author, '100x100')} username={author.username} size={40} />
        ) : null}
        <View style={styles.headerText}>
          {author ? <ThemedText style={styles.username}>@{author.username}</ThemedText> : null}
          <ThemedText variant="caption" color="textSecondary">
            {date}
          </ThemedText>
        </View>
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
  headerText: { flex: 1 },
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
