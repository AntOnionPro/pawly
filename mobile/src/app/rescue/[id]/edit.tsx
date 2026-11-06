import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { useRescueReport } from '@/features/rescue/hooks';
import { RescueForm } from '@/features/rescue/RescueForm';

export default function EditRescueScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: report, error, refetch, isPending } = useRescueReport(id);

  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  if (report && report.reporterId !== user.id) {
    return <Redirect href={{ pathname: '/rescue/[id]', params: { id: report.id } }} />;
  }
  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {report ? (
        <RescueForm
          report={report}
          onSaved={() => router.back()}
          onDeleted={() => (router.canDismiss() ? router.dismissAll() : router.replace('/rescue'))}
        />
      ) : null}
    </Screen>
  );
}
