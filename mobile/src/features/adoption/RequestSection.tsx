import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { MessageButton } from '@/features/messages/MessageButton';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { confirm } from '@/utils/confirm';
import { notify } from '@/utils/notify';

import type { Adoption } from './api';
import { useMyRequest, usePendingRequestCount, useSetRequestStatus } from './requestHooks';
import type { AdoptionRequest } from './requests';

/** Shows a failed request change as a short message. */
export function useRequestErrorNotice() {
  const { t } = useTranslation();
  return (error: unknown) => {
    const [field] = Object.values(toFieldErrors(error));
    const key = field ?? requestErrorKey(requestErrorKind(error)) ?? 'errors.generic';
    notify(`${t('adoptionRequests.failed')} ${t(key)}`);
  };
}

/** The applicant's own request: its status, what comes next, and withdrawing it. */
function MyRequest({ adoption, request }: { adoption: Adoption; request: AdoptionRequest }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const setStatus = useSetRequestStatus();
  const showError = useRequestErrorNotice();
  const username = adoption.publisher?.username ?? '';
  const name = adoption.pet?.name ?? '';
  const canWithdraw =
    adoption.status === 'available' &&
    (request.status === 'pending' || request.status === 'accepted');
  const text = {
    pending: t('adoptionRequests.pendingText', { username }),
    accepted: t('adoptionRequests.acceptedText', { username, name }),
    rejected: t('adoptionRequests.rejectedText', { username }),
    withdrawn: t('adoptionRequests.withdrawnText'),
  }[request.status];

  async function withdraw() {
    const confirmed = await confirm({
      title: t('adoptionRequests.withdrawConfirmTitle'),
      message: t('adoptionRequests.withdrawConfirmMessage', { name }),
      confirmLabel: t('adoptionRequests.withdraw'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    setStatus.mutate({ id: request.id, status: 'withdrawn' }, { onError: showError });
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ThemedText variant="label" accessibilityRole="header">
        {t('adoptionRequests.yours', {
          status: t(`adoptionRequests.status.${request.status}`),
        })}
      </ThemedText>
      <ThemedText>{text}</ThemedText>
      {request.status === 'accepted' ? <MessageButton userId={adoption.publisherId} /> : null}
      {canWithdraw ? (
        <Button
          variant="link"
          label={t('adoptionRequests.withdraw')}
          onPress={withdraw}
          loading={setStatus.isPending}
        />
      ) : null}
    </View>
  );
}

/**
 * On a listing: the publisher sees its requests; anyone else asks to adopt ("I want to adopt",
 * which takes visitors to sign in) or sees how their request is going.
 */
export function RequestSection({ adoption }: { adoption: Adoption }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, user } = useAuth();
  const signedIn = status === 'signedIn' && user !== null;
  const isPublisher = signedIn && user.id === adoption.publisherId;
  const { data: pending = 0 } = usePendingRequestCount(adoption.id, isPublisher);
  const { data: request, isPending } = useMyRequest(
    signedIn && !isPublisher ? adoption.id : undefined,
  );

  if (isPublisher) {
    return (
      <Button
        icon="requests"
        label={
          pending > 0
            ? t('adoptionRequests.viewPending', { count: pending })
            : t('adoptionRequests.view')
        }
        onPress={() =>
          router.push({ pathname: '/adoption/[id]/requests', params: { id: adoption.id } })
        }
      />
    );
  }
  if (signedIn && isPending) return null;
  if (request) return <MyRequest adoption={adoption} request={request} />;
  if (adoption.status !== 'available') return null;
  return (
    <Button
      icon="adoption"
      label={t('adoptionRequests.want')}
      onPress={() =>
        signedIn
          ? router.push({ pathname: '/adoption/[id]/request', params: { id: adoption.id } })
          : router.push('/sign-in')
      }
    />
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
