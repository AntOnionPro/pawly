import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { petPhotoUrl } from '@/features/pets/api';
import { mediaKind, mediaUrl } from '@/features/posts/api';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import type { IconName } from '@/theme/icons';
import { radius, spacing } from '@/theme/typography';
import { parseServerDate } from '@/utils/time';
import { useRelativeDate } from '@/utils/useRelativeDate';

import type { RescueKind, RescueReport } from './api';

export const KIND_ICONS: Record<RescueKind, IconName> = {
  help: 'rescue',
  lost: 'lost',
  found: 'found',
};

/** URL of the picture of a report: its first photo, or else the lost pet's photo. */
export function useRescuePhoto(report: RescueReport): string | null {
  const { client } = useAuth();
  const photo = report.media.find((name) => mediaKind(name) === 'photo');
  if (photo) return mediaUrl(client, report, photo, '300x300');
  return report.pet ? petPhotoUrl(client, report.pet) : null;
}

/** Urgency for animals that need help, or when a lost pet was last seen. */
export function useRescueDetail(report: RescueReport): string {
  const { t, i18n } = useTranslation();
  if (report.kind === 'help' && report.urgency) {
    return t(`rescue.urgencyBadge.${report.urgency}`);
  }
  const lastSeen = parseServerDate(report.lastSeenAt);
  if (report.kind === 'lost' && lastSeen) {
    return t('rescue.lastSeen', {
      date: lastSeen.toLocaleDateString(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }),
    });
  }
  return '';
}

/** "350 m away", "1.2 km away", "12 km away". */
export function useDistanceText(km: number | undefined): string {
  const { t } = useTranslation();
  if (km === undefined) return '';
  if (km < 1) {
    return t('rescue.distanceM', { distance: Math.max(10, Math.round((km * 1000) / 10) * 10) });
  }
  // A decimal point, as written in Mexico (and in English).
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return t('rescue.distanceKm', { distance: String(rounded) });
}

interface RescueCardProps {
  report: RescueReport;
  /** How far the case is from the person looking, when known. */
  distanceKm?: number;
  onPress: () => void;
}

/** Row of the Rescue tab: photo, kind, urgency or date, description, place and time. */
export function RescueCard({ report, distanceKm, onPress }: RescueCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const photo = useRescuePhoto(report);
  const detail = useRescueDetail(report);
  const relative = useRelativeDate(report.created);
  const distance = useDistanceText(distanceKm);
  // How far, where and when, in one line under the description.
  const where = [distance, report.place, relative].filter(Boolean).join(' · ');
  const kind = t(`rescue.kinds.${report.kind}`);
  const urgent = report.kind === 'help' && report.urgency === 'high';

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[kind, detail, report.description, where].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.photo, { backgroundColor: colors.background }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />
        ) : (
          <Icon name={KIND_ICONS[report.kind]} selected size={36} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.text}>
        <View style={styles.kind}>
          <Icon
            name={KIND_ICONS[report.kind]}
            selected
            size={16}
            color={urgent ? colors.accent : colors.text}
          />
          <ThemedText style={styles.kindText}>{kind}</ThemedText>
        </View>
        {detail ? (
          <ThemedText variant="caption" style={urgent ? styles.urgent : undefined}>
            {detail}
          </ThemedText>
        ) : null}
        <ThemedText numberOfLines={2}>{report.description}</ThemedText>
        <View style={styles.place}>
          <Icon name="location" size={14} color={colors.textSecondary} />
          <ThemedText
            variant="caption"
            color="textSecondary"
            numberOfLines={1}
            style={styles.placeText}>
            {where}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const PHOTO = 96;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
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
  kind: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  kindText: { fontWeight: '700' },
  urgent: { fontWeight: '700' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  placeText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
