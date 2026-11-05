import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { MessageButton } from '@/features/messages/MessageButton';
import { useBlockedIds } from '@/features/moderation/hooks';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { useRelativeDate } from '@/utils/useRelativeDate';

import type { Adoption } from './api';
import { useAdoptionRequests, useSetRequestStatus } from './requestHooks';
import { useRequestErrorNotice } from './RequestSection';
import type { AdoptionRequest, RequestStatus } from './requests';

/** Status chip: pending, accepted, not accepted or withdrawn. */
export function RequestStatusChip({ status }: { status: RequestStatus }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: status === 'accepted' ? colors.tabIndicator : colors.background },
        { borderColor: colors.border },
      ]}>
      <ThemedText variant="caption" style={styles.chipText}>
        {t(`adoptionRequests.status.${status}`)}
      </ThemedText>
    </View>
  );
}

function RequestRow({ request, open }: { request: AdoptionRequest; open: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { client } = useAuth();
  const colors = useThemeColors();
  const setStatus = useSetRequestStatus();
  const showError = useRequestErrorNotice();
  const date = useRelativeDate(request.created);
  const applicant = request.applicant;
  const answer = (status: RequestStatus) =>
    setStatus.mutate({ id: request.id, status }, { onError: showError });
  // A withdrawn request is final; the others can still change while the pet is available.
  const canAnswer = open && request.status !== 'withdrawn';

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={applicant ? `@${applicant.username}` : undefined}
          disabled={!applicant}
          onPress={() =>
            router.push({ pathname: '/user/[id]', params: { id: request.applicantId } })
          }
          style={({ pressed }) => [styles.applicant, pressed && styles.pressed]}>
          {applicant ? (
            <Avatar
              uri={avatarUrl(client, applicant, '100x100')}
              username={applicant.username}
              size={40}
            />
          ) : null}
          <View style={styles.who}>
            <ThemedText style={styles.username}>@{applicant?.username}</ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              {date}
            </ThemedText>
          </View>
        </Pressable>
        <RequestStatusChip status={request.status} />
      </View>
      <ThemedText>{request.message}</ThemedText>
      <View style={styles.actions}>
        {canAnswer && request.status !== 'accepted' ? (
          <Button
            icon="check"
            label={t('adoptionRequests.accept')}
            onPress={() => answer('accepted')}
            disabled={setStatus.isPending}
          />
        ) : null}
        {canAnswer && request.status !== 'rejected' ? (
          <Button
            variant="secondary"
            label={t('adoptionRequests.reject')}
            onPress={() => answer('rejected')}
            disabled={setStatus.isPending}
          />
        ) : null}
        <MessageButton userId={request.applicantId} />
      </View>
    </View>
  );
}

/** The publisher's view of a listing's requests, newest first. */
export function RequestList({ adoption }: { adoption: Adoption }) {
  const { t } = useTranslation();
  const { data, error, isPending, refetch } = useAdoptionRequests(adoption.id);
  const blocked = useBlockedIds();
  const requests = (data ?? []).filter((request) => !blocked.has(request.applicantId));

  if (isPending) return <Loading />;
  if (error) return <LoadError error={error} onRetry={() => void refetch()} />;
  return (
    <View style={styles.list}>
      <ThemedText variant="title" accessibilityRole="header">
        {adoption.pet?.name}
      </ThemedText>
      {requests.length === 0 ? (
        <ThemedText color="textSecondary">
          {t('adoptionRequests.empty', { name: adoption.pet?.name ?? '' })}
        </ThemedText>
      ) : null}
      {requests.map((request) => (
        <RequestRow key={request.id} request={request} open={adoption.status === 'available'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  applicant: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  who: { flex: 1 },
  username: { fontWeight: '600' },
  chip: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: { fontWeight: '600' },
  actions: { gap: spacing.sm },
  pressed: { opacity: 0.6 },
});
