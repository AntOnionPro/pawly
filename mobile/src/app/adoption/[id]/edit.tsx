import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { AdoptionForm } from '@/features/adoption/AdoptionForm';
import { useAdoption } from '@/features/adoption/hooks';

export default function EditAdoptionScreen() {
  const router = useRouter();
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
      {adoption ? (
        <AdoptionForm
          adoption={adoption}
          onSaved={() => router.back()}
          onDeleted={() =>
            router.canDismiss() ? router.dismissAll() : router.replace('/adoption')
          }
        />
      ) : null}
    </Screen>
  );
}
