import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { SettingsContent } from '@/features/settings/SettingsContent';
import { confirm } from '@/utils/confirm';

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { status, signOut } = useAuth();

  async function confirmSignOut() {
    const confirmed = await confirm({
      title: t('account.signOut.confirmTitle'),
      message: t('account.signOut.confirmMessage'),
      confirmLabel: t('account.signOut.label'),
      cancelLabel: t('common.cancel'),
    });
    if (confirmed) {
      signOut();
      router.back();
    }
  }

  return (
    <Screen edges={['bottom']}>
      <SettingsContent
        account={
          status === 'signedIn'
            ? {
                onNotifications: () => router.push('/notification-settings'),
                onBlockedUsers: () => router.push('/blocked'),
                onChangePassword: () => router.push('/change-password'),
                onSignOut: confirmSignOut,
                onDeleteAccount: () => router.push('/delete-account'),
              }
            : undefined
        }
        onOpenLegal={(doc) => router.push({ pathname: '/legal/[doc]', params: { doc } })}
      />
    </Screen>
  );
}
