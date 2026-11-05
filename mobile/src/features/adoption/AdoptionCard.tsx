import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { petPhotoUrl } from '@/features/pets/api';
import { mediaKind, mediaUrl } from '@/features/posts/api';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import type { Adoption } from './api';
import { useAgeText } from './useAgeText';

/** URL of the picture of a listing: its first photo, or else the pet's photo. */
export function useAdoptionPhoto(adoption: Adoption): string | null {
  const { client } = useAuth();
  const photo = adoption.media.find((name) => mediaKind(name) === 'photo');
  if (photo) return mediaUrl(client, adoption, photo, '300x300');
  return adoption.pet ? petPhotoUrl(client, adoption.pet) : null;
}

/** Tile of the Adoption tab: photo, name, species, age, sex, size and zone. */
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
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[name, kind, traits, t('adoption.zoneLabel', { zone: adoption.zone })]
        .filter(Boolean)
        .join(', ')}
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
          <Icon name={hasVideo ? 'video' : 'paw'} selected size={40} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.text}>
        <ThemedText numberOfLines={1} style={styles.name}>
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  photo: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  text: { padding: spacing.sm, gap: 2 },
  name: { fontWeight: '700' },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  zoneText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
