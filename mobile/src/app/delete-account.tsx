import { Redirect, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { DeleteAccountForm } from '@/features/account/DeleteAccountForm';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  if (!user) {
    return <Redirect href="/" />;
  }
  return (
    <Screen edges={['bottom']}>
      <DeleteAccountForm
        onDeleted={() => (router.canDismiss() ? router.dismissAll() : router.replace('/'))}
      />
    </Screen>
  );
}
