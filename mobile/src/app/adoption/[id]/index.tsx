import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { AdoptionDetail } from '@/features/adoption/AdoptionDetail';
import { useAdoption } from '@/features/adoption/hooks';
import { RequestSection } from '@/features/adoption/RequestSection';

export default function AdoptionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: adoption, error, refetch, isPending } = useAdoption(id);

  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {adoption ? (
        <AdoptionDetail
          adoption={adoption}
          action={<RequestSection adoption={adoption} />}
          onPressPet={(petId) => router.push({ pathname: '/pet/[id]', params: { id: petId } })}
          onPressUser={(userId) => router.push({ pathname: '/user/[id]', params: { id: userId } })}
          onEdit={
            user?.id === adoption.publisherId && adoption.status === 'available'
              ? () => router.push({ pathname: '/adoption/[id]/edit', params: { id: adoption.id } })
              : undefined
          }
        />
      ) : null}
    </Screen>
  );
}
