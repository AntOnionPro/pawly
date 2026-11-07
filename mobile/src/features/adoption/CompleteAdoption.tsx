import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { HeaderAction } from '@/components/HeaderAction';
import { Icon } from '@/components/Icon';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { useBlockedIds } from '@/features/moderation/hooks';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { confirm } from '@/utils/confirm';

import type { Adoption } from './api';
import { useCompleteAdoption } from './hooks';
import { useAdoptionRequests } from './requestHooks';

/**
 * "Mark as adopted": the publisher chooses who adopted the pet among the requests they
 * accepted, and confirms. The pet's profile then moves to the adopter.
 */
export function CompleteAdoption({ adoption, onDone }: { adoption: Adoption; onDone: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { client } = useAuth();
  const colors = useThemeColors();
  const { data, error, isPending, refetch } = useAdoptionRequests(adoption.id);
  const blocked = useBlockedIds();
  const complete = useCompleteAdoption();
  const [chosen, setChosen] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const name = adoption.pet?.name ?? '';
  const accepted = (data ?? []).filter(
    (request) => request.status === 'accepted' && !blocked.has(request.applicantId),
  );

  async function submit() {
    setFormError(null);
    const request = accepted.find((item) => item.id === chosen);
    if (!request) {
      setFormError(t('adoption.complete.choose'));
      return;
    }
    const username = request.applicant?.username ?? '';
    const confirmed = await confirm({
      title: t('adoption.complete.confirmTitle', { username, name }),
      message: t('adoption.complete.confirmMessage', { username, name }),
      confirmLabel: t('adoption.complete.confirmLabel'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    try {
      await complete.mutateAsync({ adoptionId: adoption.id, requestId: request.id });
      onDone();
    } catch (completeError) {
      const [field] = Object.values(toFieldErrors(completeError));
      const key = field ?? requestErrorKey(requestErrorKind(completeError)) ?? 'errors.generic';
      setFormError(t(key));
    }
  }

  if (isPending) return <Loading />;
  if (error) return <LoadError error={error} onRetry={() => void refetch()} />;
  if (accepted.length === 0) {
    return (
      <View style={styles.container}>
        <ThemedText color="textSecondary">{t('adoption.complete.none', { name })}</ThemedText>
        <Button
          variant="secondary"
          icon="requests"
          label={t('adoptionRequests.view')}
          onPress={() =>
            router.replace({ pathname: '/adoption/[id]/requests', params: { id: adoption.id } })
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderAction
        label={t('adoption.complete.confirm')}
        loading={complete.isPending}
        onPress={() => void submit()}
      />
      <FieldError message={formError} />
      <ThemedText variant="title" accessibilityRole="header">
        {name}
      </ThemedText>
      <ThemedText color="textSecondary">{t('adoption.complete.intro', { name })}</ThemedText>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {accepted.map((request) => {
          const selected = request.id === chosen;
          const applicant = request.applicant;
          return (
            <Pressable
              key={request.id}
              accessibilityRole="radio"
              accessibilityLabel={`@${applicant?.username ?? ''}`}
              accessibilityState={{ checked: selected }}
              onPress={() => setChosen(request.id)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? colors.tabIndicator : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                  borderWidth: selected ? 2 : StyleSheet.hairlineWidth * 2,
                },
                pressed && styles.pressed,
              ]}>
              {applicant ? (
                <Avatar
                  uri={avatarUrl(client, applicant, '100x100')}
                  username={applicant.username}
                  size={40}
                />
              ) : null}
              <ThemedText style={[styles.username, selected && styles.selected]}>
                @{applicant?.username}
              </ThemedText>
              {selected ? <Icon name="check" size={20} color={colors.text} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    minHeight: 56,
  },
  username: { flex: 1 },
  selected: { fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
