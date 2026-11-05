import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { targetPost } from '@/features/posts/api';
import { usePost } from '@/features/posts/hooks';
import { RepostForm } from '@/features/posts/RepostForm';

export default function RepostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useAuth();
  const { data: post, error, refetch, isPending } = usePost(id);

  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {post ? (
        <RepostForm
          post={targetPost(post)}
          onDone={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        />
      ) : null}
    </Screen>
  );
}
