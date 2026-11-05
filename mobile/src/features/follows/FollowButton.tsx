import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';

import { useFollowAction } from './hooks';

/** "Follow" (main button) or "Following" (outlined; tap to unfollow) on someone's profile. */
export function FollowButton({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { following, loading, toggle } = useFollowAction(userId);
  return (
    <Button
      variant={following ? 'secondary' : 'primary'}
      icon={following ? 'check' : 'add'}
      label={following ? t('follows.following') : t('follows.follow')}
      accessibilityHint={following ? t('follows.unfollowHint') : undefined}
      loading={loading}
      onPress={toggle}
    />
  );
}
