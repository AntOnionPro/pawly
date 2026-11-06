import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import type { Pet } from '@/features/pets/api';

/** On the owner's pet page: report the pet as lost, with the pet already chosen. */
export function PetLostButton({ pet }: { pet: Pet }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      icon="lost"
      label={t('rescue.reportLost')}
      onPress={() =>
        router.push({ pathname: '/rescue/new', params: { kind: 'lost', petId: pet.id } })
      }
    />
  );
}
