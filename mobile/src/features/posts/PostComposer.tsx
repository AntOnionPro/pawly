import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

import type { Post } from './api';
import { useCreatePost } from './hooks';
import { PostEditor } from './PostEditor';

interface PostComposerProps {
  /** A pet to tag from the start (for example, from an adoption follow-up reminder). */
  petId?: string;
  onPublished: (post: Post) => void;
}

/** New post: who posts, the text, photos and videos and tagged pets. */
export function PostComposer({ petId, onPublished }: PostComposerProps) {
  const { t } = useTranslation();
  const create = useCreatePost();

  return (
    <View style={styles.container}>
      <ThemedText variant="title" accessibilityRole="header">
        {t('post.title')}
      </ThemedText>
      <PostEditor
        petId={petId}
        submitLabel={t('posts.publish')}
        pendingLabel={t('posts.publishing')}
        pending={create.isPending}
        onSubmit={async ({ text, petIds, add }) => {
          const post = await create.mutateAsync({ text, media: add, petIds });
          onPublished(post);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
