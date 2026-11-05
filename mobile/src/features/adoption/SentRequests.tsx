import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { useRelativeDate } from '@/utils/useRelativeDate';

import type { Adoption } from './api';
import { useAdoptionPhoto } from './AdoptionCard';
import { useSentRequests } from './requestHooks';
import { RequestStatusChip } from './RequestList';
import type { AdoptionRequest } from './requests';

function SentRow({ request, adoption }: { request: AdoptionRequest; adoption: Adoption }) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const photo = useAdoptionPhoto(adoption);
  const date = useRelativeDate(request.created);
  const name = adoption.pet?.name ?? '';
  const status = t(`adoptionRequests.status.${request.status}`);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${name}, ${status}, ${date}`}
      onPress={() => router.push({ pathname: '/adoption/[id]', params: { id: adoption.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.photo, { backgroundColor: colors.background }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />
        ) : (
          <Icon name="paw" selected size={28} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.text}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {name}
        </ThemedText>
        {adoption.publisher ? (
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
            {t('adoption.publishedBy', { username: adoption.publisher.username })}
          </ThemedText>
        ) : null}
        <ThemedText variant="caption" color="textSecondary">
          {date}
        </ThemedText>
      </View>
      <RequestStatusChip status={request.status} />
    </Pressable>
  );
}

/** "My requests": the pets the user asked to adopt, and how each request is going. */
export function SentRequests() {
  const { t } = useTranslation();
  const { data, error, isPending, refetch } = useSentRequests();

  if (isPending) return <Loading />;
  if (error) return <LoadError error={error} onRetry={() => void refetch()} />;
  const requests = data ?? [];
  return (
    <View style={styles.list}>
      {requests.length === 0 ? (
        <ThemedText color="textSecondary">{t('adoptionRequests.sentEmpty')}</ThemedText>
      ) : null}
      {requests.map((request) =>
        request.adoption ? (
          <SentRow key={request.id} request={request} adoption={request.adoption} />
        ) : null,
      )}
    </View>
  );
}

const PHOTO = 64;

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  name: { fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
