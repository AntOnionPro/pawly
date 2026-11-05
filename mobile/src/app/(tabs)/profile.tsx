import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { AuthPrompt } from '@/features/auth/AuthPrompt';
import { PetList } from '@/features/pets/PetList';
import { PostGrid } from '@/features/posts/PostGrid';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { useUser } from '@/features/users/hooks';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, user } = useAuth();
  // The session has the profile as the user edits it, but its follower counts are from
  // sign-in: take the current counts from the server.
  const { data: current } = useUser(status === 'signedIn' ? user?.id : undefined);

  return (
    <Screen>
      {status === 'signedIn' && user ? (
        <>
          <ProfileHeader
            user={{
              ...user,
              followerCount: current?.followerCount ?? user.followerCount,
              followingCount: current?.followingCount ?? user.followingCount,
            }}
          />
          <Button
            variant="secondary"
            icon="edit"
            label={t('profile.editButton')}
            onPress={() => router.push('/edit-profile')}
          />
          <PetList ownerId={user.id} canAdd />
          <PostGrid
            filter={{ authorId: user.id }}
            title={t('user.posts')}
            empty={t('user.noPosts')}
          />
        </>
      ) : (
        <AuthPrompt icon="profile" message={t('auth.prompt.profile')} />
      )}
      <Button
        variant="secondary"
        icon="settings"
        label={t('profile.settings')}
        onPress={() => router.push('/settings')}
      />
    </Screen>
  );
}
