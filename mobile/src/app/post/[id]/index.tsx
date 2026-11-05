import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { FieldError } from '@/components/FieldError';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { useDeletePost, usePost } from '@/features/posts/hooks';
import { usePawAction } from '@/features/posts/paws';
import { PostCard } from '@/features/posts/PostCard';
import { confirm } from '@/utils/confirm';

export default function PostDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: post, error, refetch, isPending } = usePost(id);
  const remove = useDeletePost();
  const paw = usePawAction();
  const isAuthor = Boolean(post && user?.id === post.authorId);

  async function deletePost() {
    if (!post) return;
    const confirmed = await confirm({
      title: t('posts.deleteConfirmTitle'),
      message: t('posts.deleteConfirmMessage'),
      confirmLabel: t('posts.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(post.id);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch {
      // The error is shown below the post.
    }
  }

  const deleteError = remove.error
    ? t(requestErrorKey(requestErrorKind(remove.error)) ?? 'errors.generic')
    : null;

  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {post ? (
        <PostCard
          post={post}
          onPaw={() => paw(post)}
          onPressPet={(petId) => router.push({ pathname: '/pet/[id]', params: { id: petId } })}
          onPressAuthor={(authorId) =>
            router.push({ pathname: '/user/[id]', params: { id: authorId } })
          }
          onEdit={
            isAuthor
              ? () => router.push({ pathname: '/post/[id]/edit', params: { id: post.id } })
              : undefined
          }
          onDelete={isAuthor ? deletePost : undefined}
        />
      ) : null}
      <FieldError message={deleteError} />
    </Screen>
  );
}
