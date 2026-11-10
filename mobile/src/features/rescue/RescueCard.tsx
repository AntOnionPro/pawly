import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { PhotoRow } from '@/components/PhotoRow';
import { ThemedText } from '@/components/ThemedText';
import { petPhotoUrl, type Species } from '@/features/pets/api';
import { SpeciesIcon } from '@/features/pets/SpeciesIcon';
import { mediaKind, mediaUrl } from '@/features/posts/api';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import type { IconName } from '@/theme/icons';
import { spacing } from '@/theme/typography';
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

/** The animal of a report: its own species, or else the lost pet's ('' when unknown). */
export function reportSpecies(report: RescueReport): Species | '' {
  return report.species || report.pet?.species || '';
}

interface RescueCardProps {
  report: RescueReport;
  /** How far the case is from the person looking, when known. */
  distanceKm?: number;
  onPress: () => void;
}

/**
 * Row of the Rescue tab: the animal on the left (or the kind of case, for reports without
 * one); kind, urgency or date, description, place and time in the middle; and the photo on the
 * right.
 */
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
  const species = reportSpecies(report);
  const animal = species ? t(`pets.speciesNames.${species}`) : '';
  const urgent = report.kind === 'help' && report.urgency === 'high';
  const hasVideo = report.media.some((file) => mediaKind(file) === 'video');

  return (
    <PhotoRow
      leading={
        species ? (
          <SpeciesIcon species={species} color={colors.text} />
        ) : (
          <Icon name={KIND_ICONS[report.kind]} selected size={24} color={colors.text} />
        )
      }
      photo={photo}
      placeholder={hasVideo ? 'video' : undefined}
      accessibilityLabel={[kind, animal, detail, report.description, where]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}>
      <View style={styles.kind}>
        {/* Without an animal, the icon on the left is already the kind. */}
        {species ? (
          <Icon
            name={KIND_ICONS[report.kind]}
            selected
            size={16}
            color={urgent ? colors.accent : colors.text}
          />
        ) : null}
        <ThemedText style={styles.kindText} numberOfLines={1}>
          {[kind, animal].filter(Boolean).join(' · ')}
        </ThemedText>
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
    </PhotoRow>
  );
}

const styles = StyleSheet.create({
  kind: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  kindText: { flex: 1, fontWeight: '700' },
  urgent: { fontWeight: '700' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  placeText: { flex: 1 },
});
