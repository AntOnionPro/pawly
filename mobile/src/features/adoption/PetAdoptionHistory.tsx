import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import type { Pet } from '@/features/pets/api';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { parseServerDate } from '@/utils/time';

import { useAdoptedListing } from './hooks';

/** On the profile of a pet adopted in Pawly: when it joined its family, and its listing. */
export function PetAdoptionHistory({ pet }: { pet: Pet }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const adoptedAt = parseServerDate(pet.adoptedAt);
  const { data: listing } = useAdoptedListing(pet.id, adoptedAt !== null);
  if (!adoptedAt) return null;
  const date = adoptedAt.toLocaleDateString(i18n.language, { dateStyle: 'long' });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.title}>
        <Icon name="adoption" selected size={20} color={colors.accent} />
        <ThemedText variant="label" accessibilityRole="header">
          {t('pets.adoptionTitle')}
        </ThemedText>
      </View>
      <ThemedText>{t('pets.adoptedOn', { date })}</ThemedText>
      {listing ? (
        <Button
          variant="link"
          label={t('pets.viewAdoption')}
          onPress={() => router.push({ pathname: '/adoption/[id]', params: { id: listing.id } })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
