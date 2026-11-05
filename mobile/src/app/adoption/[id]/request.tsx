import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { useAdoption } from '@/features/adoption/hooks';
import { RequestForm } from '@/features/adoption/RequestForm';

export default function AdoptionRequestScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: adoption, error, refetch, isPending } = useAdoption(id);

  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {adoption ? <RequestForm adoption={adoption} onSent={() => router.back()} /> : null}
    </Screen>
  );
}
