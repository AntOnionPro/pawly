import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';

export default function RescueScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ComingSoon
        icon="rescue"
        title={t('rescue.title')}
        description={t('rescue.description')}
        stage={6}
      />
    </Screen>
  );
}
