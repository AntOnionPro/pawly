import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScrollViewInstance, TextInputInstance } from 'react-native';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { FieldError } from '@/components/FieldError';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { CommentComposer } from '@/features/comments/CommentComposer';
import { CommentList } from '@/features/comments/CommentList';
import { useDeletePost, usePost } from '@/features/posts/hooks';
import { usePawAction } from '@/features/posts/paws';
import { PostCard } from '@/features/posts/PostCard';
import { confirm } from '@/utils/confirm';

export default function PostDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, user } = useAuth();
  const { data: post, error, refetch, isPending } = usePost(id);
  const remove = useDeletePost();
  const paw = usePawAction();
  const commentInput = useRef<TextInputInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  // After sending a comment, scroll to it once it is on the screen.
  const scrollToNewComment = useRef(false);
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

  function openUser(userId: string) {
    router.push({ pathname: '/user/[id]', params: { id: userId } });
  }

  const deleteError = remove.error
    ? t(requestErrorKey(requestErrorKind(remove.error)) ?? 'errors.generic')
    : null;

  return (
    <Screen
      edges={['bottom']}
      scrollRef={scroll}
      onContentSizeChange={() => {
        if (!scrollToNewComment.current) return;
        scrollToNewComment.current = false;
        scroll.current?.scrollToEnd({ animated: true });
      }}
      footer={
        post ? (
          <CommentComposer
            postId={post.id}
            inputRef={commentInput}
            onSent={() => {
              scrollToNewComment.current = true;
            }}
          />
        ) : null
      }>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {post ? (
        <>
          <PostCard
            post={post}
            onPaw={() => paw(post)}
            onComments={() => {
              if (status === 'signedIn') commentInput.current?.focus();
              else router.push('/sign-in');
            }}
            onPressPet={(petId) => router.push({ pathname: '/pet/[id]', params: { id: petId } })}
            onPressAuthor={openUser}
            onEdit={
              isAuthor
                ? () => router.push({ pathname: '/post/[id]/edit', params: { id: post.id } })
                : undefined
            }
            onDelete={isAuthor ? deletePost : undefined}
          />
          <FieldError message={deleteError} />
          <CommentList postId={post.id} postAuthorId={post.authorId} onPressAuthor={openUser} />
        </>
      ) : null}
    </Screen>
  );
}
