import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { AuthPrompt } from '@/features/auth/AuthPrompt';
import { PostComposer } from '@/features/posts/PostComposer';

export default function PostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useAuth();
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  return (
    <Screen>
      {status === 'signedIn' ? (
        <PostComposer
          // A new pet to tag starts a fresh composer.
          key={petId ?? ''}
          petId={petId}
          onPublished={(post) => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
        />
      ) : (
        <AuthPrompt icon="post" message={t('auth.prompt.post')} />
      )}
    </Screen>
  );
}
