import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { isReportKind } from '@/features/moderation/api';
import { ReportForm } from '@/features/moderation/ReportForm';
import { notify } from '@/utils/notify';

export default function ReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const { status } = useAuth();

  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }
  if (!isReportKind(kind) || !id) {
    return <Redirect href="/" />;
  }

  return (
    <Screen edges={['bottom']}>
      <ReportForm
        target={{ kind, id }}
        onSent={() => {
          notify(t('report.sent'));
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      />
    </Screen>
  );
}
