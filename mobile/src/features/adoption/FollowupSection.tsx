import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { parseServerDate } from '@/utils/time';

import type { Adoption } from './api';
import {
  followupDeadline,
  followupState,
  listFollowups,
  type Followup,
  type FollowupState,
} from './followups';

export const followupKeys = {
  forAdoption: (adoptionId: string) => ['adoptionFollowups', adoptionId] as const,
};

function FollowupRow({
  followup,
  isAdopter,
  petId,
}: {
  followup: Followup;
  isAdopter: boolean;
  petId: string;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const state: FollowupState = followupState(followup);
  const format = (date: Date | null) =>
    date ? date.toLocaleDateString(i18n.language, { dateStyle: 'medium' }) : '';
  const when = {
    upcoming: t('adoption.followups.upcomingOn', { date: format(parseServerDate(followup.dueAt)) }),
    due: t('adoption.followups.dueUntil', { date: format(followupDeadline(followup)) }),
    overdue: t('adoption.followups.overdueOn', { date: format(followupDeadline(followup)) }),
    done: '',
  }[state];
  const icon = state === 'done' ? 'checkboxOn' : state === 'overdue' ? 'error' : 'checkboxOff';

  return (
    <View style={styles.row}>
      <Icon
        name={icon}
        selected
        size={22}
        color={state === 'done' ? colors.accent : colors.textSecondary}
      />
      <View style={styles.text}>
        <ThemedText style={styles.milestone}>
          {t(`adoption.followups.milestones.${followup.milestone}`)}
        </ThemedText>
        <ThemedText variant="caption" color="textSecondary">
          {[t(`adoption.followups.status.${state}`), when].filter(Boolean).join(' · ')}
        </ThemedText>
        {state === 'done' && followup.postId ? (
          <Button
            variant="link"
            label={t('adoption.followups.viewPost')}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: followup.postId } })}
          />
        ) : null}
        {state === 'due' && isAdopter ? (
          <Button
            variant="secondary"
            icon="post"
            label={t('adoption.followups.share')}
            onPress={() => router.push({ pathname: '/post', params: { petId } })}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * On an adopted listing, for the adopter and the previous owner: the four follow-ups, which
 * ones are done (with their posts), and reporting a missed one (previous owner).
 */
export function FollowupSection({ adoption }: { adoption: Adoption }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { client, user } = useAuth();
  const colors = useThemeColors();
  const isAdopter = Boolean(user) && user?.id === adoption.adopterId;
  const isPublisher = Boolean(user) && user?.id === adoption.publisherId;
  const visible = adoption.status === 'adopted' && (isAdopter || isPublisher);
  const { data: followups = [] } = useQuery({
    queryKey: followupKeys.forAdoption(adoption.id),
    queryFn: () => listFollowups(client, adoption.id),
    enabled: visible,
  });
  if (!visible || followups.length === 0) return null;
  const name = adoption.pet?.name ?? '';
  const anyOverdue = followups.some((followup) => followupState(followup) === 'overdue');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ThemedText variant="label" accessibilityRole="header">
        {t('adoption.followups.title')}
      </ThemedText>
      <ThemedText color="textSecondary">
        {isAdopter
          ? t('adoption.followups.introAdopter', { name })
          : t('adoption.followups.introPublisher', {
              name,
              username: adoption.adopter?.username ?? '',
            })}
      </ThemedText>
      {followups.map((followup) => (
        <FollowupRow
          key={followup.id}
          followup={followup}
          isAdopter={isAdopter}
          petId={adoption.petId}
        />
      ))}
      {isPublisher && anyOverdue ? (
        <Button
          variant="secondary"
          icon="flag"
          label={t('adoption.followups.report')}
          onPress={() =>
            router.push({
              pathname: '/report',
              params: { kind: 'user', id: adoption.adopterId, reason: 'adoption_followup' },
            })
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  text: { flex: 1, gap: 2 },
  milestone: { fontWeight: '600' },
});
