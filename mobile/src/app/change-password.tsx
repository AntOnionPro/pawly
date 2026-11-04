import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { confirm } from '@/utils/confirm';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  return (
    <Screen edges={['bottom']}>
      <ChangePasswordForm
        onChanged={() => {
          router.back();
          void confirm({
            title: t('account.password.title'),
            message: t('account.password.changed'),
            confirmLabel: 'OK',
            cancelLabel: t('common.cancel'),
          });
        }}
      />
    </Screen>
  );
}
