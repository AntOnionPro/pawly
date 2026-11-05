import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { EditPostForm } from '@/features/posts/EditPostForm';
import { usePost } from '@/features/posts/hooks';

export default function EditPostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: post, error, refetch, isPending } = usePost(id);

  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (post && post.authorId !== user.id) {
    return <Redirect href={{ pathname: '/post/[id]', params: { id: post.id } }} />;
  }

  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {post ? <EditPostForm post={post} onSaved={() => router.back()} /> : null}
    </Screen>
  );
}
