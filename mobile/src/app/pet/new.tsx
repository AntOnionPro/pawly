import { Redirect, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { PetForm } from '@/features/pets/PetForm';

export default function NewPetScreen() {
  const router = useRouter();
  const { user } = useAuth();
  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      <PetForm
        onSaved={(pet) => router.replace({ pathname: '/pet/[id]', params: { id: pet.id } })}
      />
    </Screen>
  );
}
