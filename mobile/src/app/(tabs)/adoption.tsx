import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';

export default function AdoptionScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ComingSoon
        icon="adoption"
        title={t('adoption.title')}
        description={t('adoption.description')}
        stage={5}
      />
    </Screen>
  );
}
