import { useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { SettingsContent } from '@/features/settings/SettingsContent';

export default function SettingsScreen() {
  const router = useRouter();
  return (
    <Screen edges={['bottom']}>
      <SettingsContent
        onOpenLegal={(doc) => router.push({ pathname: '/legal/[doc]', params: { doc } })}
      />
    </Screen>
  );
}
