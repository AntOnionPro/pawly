import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { ButtonRow } from '@/components/ButtonRow';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { FollowButton } from '@/features/follows/FollowButton';
import { MessageButton } from '@/features/messages/MessageButton';
import { useBlockedIds } from '@/features/moderation/hooks';
import { BlockedProfile, ProfileModeration } from '@/features/moderation/ProfileModeration';
import { PetList } from '@/features/pets/PetList';
import { PostGrid } from '@/features/posts/PostGrid';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { useUser } from '@/features/users/hooks';

export default function UserScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const { data: user, error, refetch, isPending } = useUser(id);
  const blocked = useBlockedIds();

  if (me && id === me.id) {
    return <Redirect href="/profile" />;
  }

  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {user && blocked.has(user.id) ? (
        <>
          <ProfileHeader user={user} />
          <BlockedProfile user={user} />
        </>
      ) : user ? (
        <>
          <ProfileHeader user={user} />
          <ButtonRow align="center">
            <FollowButton userId={user.id} />
            <MessageButton userId={user.id} />
          </ButtonRow>
          <ProfileModeration user={user} />
          <PetList ownerId={user.id} />
          <PostGrid
            filter={{ authorId: user.id }}
            title={t('user.posts')}
            empty={t('user.noPosts')}
          />
        </>
      ) : null}
    </Screen>
  );
}
