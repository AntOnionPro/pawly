import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ComingSoon
        icon="paw"
        title={t('home.title')}
        description={t('home.description')}
        stage={2}
      />
    </Screen>
  );
}
