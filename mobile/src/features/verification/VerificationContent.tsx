import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { USERS, useAuth, type User } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { confirm } from '@/utils/confirm';

import type { VerificationRequest } from './api';
import { useCancelVerification, useLatestVerification } from './hooks';
import { VerificationForm } from './VerificationForm';

/** Whether the account in this session is older than the review of its request. */
function isStale(user: User, latest: VerificationRequest): boolean {
  if (latest.status === 'approved') {
    return user.accountKind !== latest.kind || user.publicName !== latest.publicName;
  }
  return latest.status === 'revoked' && user.accountKind !== '';
}

function Card({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

/**
 * "Shelter or rescuer account", from settings: what it is, the state of the person's request
 * (in review, approved, rejected or revoked) and the form to ask.
 */
export function VerificationContent() {
  const { t } = useTranslation();
  const { client, user } = useAuth();
  const { data: latest, isPending, error, refetch } = useLatestVerification();
  const cancel = useCancelVerification();
  const [cancelError, setCancelError] = useState<string | null>(null);
  // A verified account asks for a change of name or kind.
  const [asking, setAsking] = useState(false);

  // The review happens in the admin panel, so the session may not know about it yet.
  const stale = Boolean(user && latest && isStale(user, latest));
  useEffect(() => {
    if (!stale) return;
    void client
      .collection(USERS)
      .authRefresh()
      .catch(() => undefined);
  }, [stale, client]);

  if (!user) return null;
  if (isPending) return <Loading />;
  if (error) return <LoadError error={error} onRetry={() => void refetch()} />;

  async function confirmCancel(request: VerificationRequest) {
    const confirmed = await confirm({
      title: t('verification.cancelConfirmTitle'),
      message: t('verification.cancelConfirmMessage'),
      confirmLabel: t('verification.cancel'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    setCancelError(null);
    try {
      await cancel.mutateAsync(request.id);
    } catch (failure) {
      setCancelError(t(requestErrorKey(requestErrorKind(failure)) ?? 'errors.generic'));
    }
  }

  const verified = user.accountKind !== '';
  const pending = latest?.status === 'pending' ? latest : null;
  const rejected = latest?.status === 'rejected' ? latest : null;
  const revoked = !verified && latest?.status === 'revoked' ? latest : null;
  const showForm = !pending && (!verified || asking);

  return (
    <View style={styles.container}>
      <ThemedText color="textSecondary">{t('verification.intro')}</ThemedText>

      {user.accountKind ? (
        <Card>
          <VerifiedBadge kind={user.accountKind} showLabel size={22} />
          <ThemedText variant="heading">{user.publicName}</ThemedText>
          <ThemedText color="textSecondary">{t('verification.verifiedText')}</ThemedText>
        </Card>
      ) : null}

      {pending ? (
        <Card>
          <ThemedText variant="heading" accessibilityRole="header">
            {t('verification.pendingTitle')}
          </ThemedText>
          <ThemedText>
            {t('verification.pendingText', {
              kind: t(`verification.kindsInText.${pending.kind}`),
              name: pending.publicName,
            })}
          </ThemedText>
          {pending.documents.length > 0 ? (
            <ThemedText variant="caption" color="textSecondary">
              {t('verification.documentsSent', { count: pending.documents.length })}
            </ThemedText>
          ) : null}
          <FieldError message={cancelError} />
          <Button
            variant="secondary"
            label={t('verification.cancel')}
            onPress={() => void confirmCancel(pending)}
            loading={cancel.isPending}
          />
        </Card>
      ) : null}

      {rejected ? (
        <Card>
          <ThemedText variant="heading" accessibilityRole="header">
            {t('verification.rejectedTitle')}
          </ThemedText>
          {rejected.reviewNote ? (
            <ThemedText>{t('verification.reason', { reason: rejected.reviewNote })}</ThemedText>
          ) : null}
          <ThemedText color="textSecondary">{t('verification.askAgain')}</ThemedText>
        </Card>
      ) : null}

      {revoked ? (
        <Card>
          <ThemedText variant="heading" accessibilityRole="header">
            {t('verification.revokedTitle')}
          </ThemedText>
          {revoked.reviewNote ? (
            <ThemedText>{t('verification.reason', { reason: revoked.reviewNote })}</ThemedText>
          ) : null}
          <ThemedText color="textSecondary">{t('verification.askAgain')}</ThemedText>
        </Card>
      ) : null}

      {verified && !pending && !asking ? (
        <Button
          variant="secondary"
          label={t('verification.askChange')}
          onPress={() => setAsking(true)}
        />
      ) : null}

      {showForm ? (
        <VerificationForm
          // A verified account starts from what it has; the others, from their last request.
          previous={verified ? null : (rejected ?? revoked)}
          onSent={() => setAsking(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
