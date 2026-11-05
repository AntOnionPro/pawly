import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { SharePostView } from '@/features/messages/SharePostView';

export default function SharePostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useAuth();
  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      <SharePostView postId={id ?? ''} />
    </Screen>
  );
}
