import { Screen } from '@/components/Screen';
import { SettingsContent } from '@/features/settings/SettingsContent';

export default function SettingsScreen() {
  return (
    <Screen edges={['bottom']}>
      <SettingsContent />
    </Screen>
  );
}
