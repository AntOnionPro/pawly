import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { PhotoRow } from '@/components/PhotoRow';
import { ThemedText } from '@/components/ThemedText';
import { petPhotoUrl } from '@/features/pets/api';
import { SpeciesIcon } from '@/features/pets/SpeciesIcon';
import { mediaKind, mediaUrl } from '@/features/posts/api';
import { useThemeColors } from '@/preferences/PreferencesProvider';

import type { Adoption } from './api';
import { useAgeText } from './useAgeText';

/** URL of the picture of a listing: its first photo, or else the pet's photo. */
export function useAdoptionPhoto(adoption: Adoption): string | null {
  const { client } = useAuth();
  const photo = adoption.media.find((name) => mediaKind(name) === 'photo');
  if (photo) return mediaUrl(client, adoption, photo, '300x300');
  return adoption.pet ? petPhotoUrl(client, adoption.pet) : null;
}

/**
 * Row of the Adoption tab: the animal on the left; name, species, age, sex, size and zone in
 * the middle; and the photo on the right.
 */
export function AdoptionCard({ adoption, onPress }: { adoption: Adoption; onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const photo = useAdoptionPhoto(adoption);
  const ageText = useAgeText(adoption.pet?.birthDate ?? '');
  const name = adoption.pet?.name ?? '';
  const kind = [adoption.pet ? t(`pets.speciesNames.${adoption.pet.species}`) : '', ageText]
    .filter(Boolean)
    .join(' · ');
  const traits = [
    t(`adoption.sexNames.${adoption.sex}`),
    t(`adoption.sizeNames.${adoption.size}`),
  ].join(' · ');
  const hasVideo = adoption.media.some((file) => mediaKind(file) === 'video');

  return (
    <PhotoRow
      leading={<SpeciesIcon species={adoption.pet?.species ?? 'other'} color={colors.text} />}
      photo={photo}
      placeholder={hasVideo ? 'video' : undefined}
      accessibilityLabel={[name, kind, traits, t('adoption.zoneLabel', { zone: adoption.zone })]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}>
      <ThemedText variant="heading" numberOfLines={1} style={styles.name}>
        {name}
      </ThemedText>
      <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
        {kind}
      </ThemedText>
      <ThemedText variant="caption" numberOfLines={1}>
        {traits}
      </ThemedText>
      <View style={styles.zone}>
        <Icon name="location" size={14} color={colors.textSecondary} />
        <ThemedText
          variant="caption"
          color="textSecondary"
          numberOfLines={1}
          style={styles.zoneText}>
          {adoption.zone}
        </ThemedText>
      </View>
    </PhotoRow>
  );
}

const styles = StyleSheet.create({
  name: { fontWeight: '700' },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  zoneText: { flex: 1 },
});
