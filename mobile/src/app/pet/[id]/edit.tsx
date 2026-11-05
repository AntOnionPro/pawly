import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { usePet } from '@/features/pets/hooks';
import { PetForm } from '@/features/pets/PetForm';

export default function EditPetScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: pet, error, refetch, isPending } = usePet(id);

  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (pet && pet.ownerId !== user.id) {
    return <Redirect href={{ pathname: '/pet/[id]', params: { id: pet.id } }} />;
  }

  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {pet ? (
        <PetForm
          pet={pet}
          onSaved={() => router.back()}
          onDeleted={() => (router.canDismiss() ? router.dismissAll() : router.replace('/'))}
        />
      ) : null}
    </Screen>
  );
}
