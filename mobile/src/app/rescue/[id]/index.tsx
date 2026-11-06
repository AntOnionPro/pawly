import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Loading, LoadError } from '@/components/QueryState';
import { Screen } from '@/components/Screen';
import { useRescueReport } from '@/features/rescue/hooks';
import { RescueDetail } from '@/features/rescue/RescueDetail';

export default function RescueReportScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: report, error, refetch, isPending } = useRescueReport(id);

  return (
    <Screen edges={['bottom']}>
      {isPending ? <Loading /> : null}
      {error ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {report ? (
        <RescueDetail
          report={report}
          onPressPet={(petId) => router.push({ pathname: '/pet/[id]', params: { id: petId } })}
          onPressUser={(userId) => router.push({ pathname: '/user/[id]', params: { id: userId } })}
          onEdit={
            user?.id === report.reporterId
              ? () => router.push({ pathname: '/rescue/[id]/edit', params: { id: report.id } })
              : undefined
          }
        />
      ) : null}
    </Screen>
  );
}
