import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { usePet } from '@/features/pets/hooks';
import { PetProfile } from '@/features/pets/PetProfile';

export default function PetScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: pet, error, refetch, isPending } = usePet(id);

  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {pet ? (
        <PetProfile
          pet={pet}
          onEdit={
            user?.id === pet.ownerId
              ? () => router.push({ pathname: '/pet/[id]/edit', params: { id: pet.id } })
              : undefined
          }
        />
      ) : null}
    </Screen>
  );
}
