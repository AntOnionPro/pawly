import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { CompleteAdoption } from '@/features/adoption/CompleteAdoption';
import { useAdoption } from '@/features/adoption/hooks';

/** The publisher marks the listing as adopted by someone whose request they accepted. */
export default function CompleteAdoptionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: adoption, error, refetch, isPending } = useAdoption(id);

  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (adoption && (adoption.publisherId !== user.id || adoption.status !== 'available')) {
    return <Redirect href={{ pathname: '/adoption/[id]', params: { id: adoption.id } }} />;
  }
  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {adoption ? <CompleteAdoption adoption={adoption} onDone={() => router.back()} /> : null}
    </Screen>
  );
}
