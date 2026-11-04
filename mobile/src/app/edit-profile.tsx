import { Redirect, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { EditProfileForm } from '@/features/profile/EditProfileForm';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      <EditProfileForm user={user} onSaved={() => router.back()} />
    </Screen>
  );
}
