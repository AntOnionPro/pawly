import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { AuthPrompt } from '@/features/auth/AuthPrompt';
import { ProfileHeader } from '@/features/profile/ProfileHeader';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, user } = useAuth();

  return (
    <Screen>
      {status === 'signedIn' && user ? (
        <>
          <ProfileHeader user={user} />
          <Button
            variant="secondary"
            icon="edit"
            label={t('profile.editButton')}
            onPress={() => router.push('/edit-profile')}
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
