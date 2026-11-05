import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { PetAdoptionButton } from '@/features/adoption/PetAdoptionButton';
import { usePet } from '@/features/pets/hooks';
import { PetProfile } from '@/features/pets/PetProfile';
import { PostGrid } from '@/features/posts/PostGrid';

export default function PetScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: pet, error, refetch, isPending } = usePet(id);

  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {pet ? (
        <>
          <PetProfile
            pet={pet}
            onEdit={
              user?.id === pet.ownerId
                ? () => router.push({ pathname: '/pet/[id]/edit', params: { id: pet.id } })
                : undefined
            }
            onPressOwner={(ownerId) =>
              router.push({ pathname: '/user/[id]', params: { id: ownerId } })
            }
          />
          <PetAdoptionButton pet={pet} isOwner={user?.id === pet.ownerId} />
          <PostGrid filter={{ petId: pet.id }} title={t('user.posts')} empty={t('user.noPosts')} />
        </>
      ) : null}
    </Screen>
  );
}
