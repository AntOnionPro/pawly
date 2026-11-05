import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { AdoptionForm } from '@/features/adoption/AdoptionForm';

/** Puts a pet up for adoption: `petId` comes from the pet's profile, or is chosen here. */
export default function NewAdoptionScreen() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const { user } = useAuth();
  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      <AdoptionForm
        petId={petId}
        onSaved={(adoption) =>
          router.replace({ pathname: '/adoption/[id]', params: { id: adoption.id } })
        }
      />
    </Screen>
  );
}
