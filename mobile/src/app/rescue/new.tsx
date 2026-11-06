import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { RESCUE_KINDS, type RescueKind } from '@/features/rescue/api';
import { RescueForm } from '@/features/rescue/RescueForm';

/** New rescue report. `kind` and `petId` come from "Report as lost" on a pet's profile. */
export default function NewRescueScreen() {
  const router = useRouter();
  const { kind, petId } = useLocalSearchParams<{ kind?: string; petId?: string }>();
  const { user } = useAuth();
  if (!user) {
    return <Redirect href="/sign-in" />;
  }
  const presetKind = RESCUE_KINDS.find((value) => value === kind) as RescueKind | undefined;
  return (
    <Screen edges={['bottom']}>
      <RescueForm
        kind={presetKind}
        petId={petId}
        onSaved={(report) =>
          router.replace({ pathname: '/rescue/[id]', params: { id: report.id } })
        }
      />
    </Screen>
  );
}
