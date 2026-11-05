import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import type { Pet } from '@/features/pets/api';

import { usePetAdoption } from './hooks';

/**
 * On a pet's page: opens its adoption listing when it is up for adoption, or lets the owner
 * put it up for adoption.
 */
export function PetAdoptionButton({ pet, isOwner }: { pet: Pet; isOwner: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: adoption, isPending } = usePetAdoption(pet.id);
  if (isPending) return null;
  if (adoption) {
    return (
      <Button
        icon="adoption"
        label={t('adoption.view')}
        onPress={() => router.push({ pathname: '/adoption/[id]', params: { id: adoption.id } })}
      />
    );
  }
  if (!isOwner) return null;
  return (
    <Button
      variant="secondary"
      icon="adoption"
      label={t('adoption.give')}
      onPress={() => router.push({ pathname: '/adoption/new', params: { petId: pet.id } })}
    />
  );
}
