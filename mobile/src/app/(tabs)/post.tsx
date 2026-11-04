import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';

export default function PostScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ComingSoon
        icon="post"
        title={t('post.title')}
        description={t('post.description')}
        stage={2}
      />
    </Screen>
  );
}
