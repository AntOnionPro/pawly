import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { useAdoption } from '@/features/adoption/hooks';
import { RequestList } from '@/features/adoption/RequestList';

/** The requests of a listing, for its publisher. */
export default function AdoptionRequestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: adoption, error, refetch, isPending } = useAdoption(id);

  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (adoption && adoption.publisherId !== user.id) {
    return <Redirect href={{ pathname: '/adoption/[id]', params: { id: adoption.id } }} />;
  }
  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {adoption ? <RequestList adoption={adoption} /> : null}
    </Screen>
  );
}
