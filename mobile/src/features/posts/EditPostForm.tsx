import { useTranslation } from 'react-i18next';

import type { Post } from './api';
import { useUpdatePost } from './hooks';
import { PostEditor } from './PostEditor';

/** Edits a post: its text, its photos and videos (removing and adding) and the tagged pets. */
export function EditPostForm({ post, onSaved }: { post: Post; onSaved: () => void }) {
  const { t } = useTranslation();
  const update = useUpdatePost();

  return (
    <PostEditor
      post={post}
      submitLabel={t('posts.save')}
      pendingLabel={t('posts.saving')}
      pending={update.isPending}
      onSubmit={async ({ text, petIds, add, remove }) => {
        await update.mutateAsync({
          id: post.id,
          changes: {
            text,
            petIds,
            ...(add.length > 0 ? { addMedia: add } : {}),
            ...(remove.length > 0 ? { removeMedia: remove } : {}),
          },
        });
        onSaved();
      }}
    />
  );
}
