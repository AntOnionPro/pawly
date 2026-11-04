import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';
import { AuthPrompt } from '@/features/auth/AuthPrompt';

export default function PostScreen() {
  const { t } = useTranslation();
  const { status } = useAuth();
  return (
    <Screen>
      {status === 'signedIn' ? (
        <ComingSoon
          icon="post"
          title={t('post.title')}
          description={t('post.description')}
          stage={2}
        />
      ) : (
        <AuthPrompt icon="post" message={t('auth.prompt.post')} />
      )}
    </Screen>
  );
}
