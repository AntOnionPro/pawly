import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { petPhotoUrl, type Pet } from './api';

const SIZE = 88;

/** Square photo and name; opens the pet's page. */
export function PetCard({ pet, onPress }: { pet: Pet; onPress: () => void }) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const colors = useThemeColors();
  const photo = petPhotoUrl(client, pet, '100x100');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pet.name}, ${t(`pets.speciesNames.${pet.species}`)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.photo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />
        ) : (
          <Icon name="paw" selected size={36} color={colors.textSecondary} />
        )}
      </View>
      <ThemedText variant="caption" numberOfLines={1} style={styles.name}>
        {pet.name}
      </ThemedText>
    </Pressable>
  );
}

/** Same size as a pet card, to add a new pet. */
export function AddPetCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('pets.add')}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.photo, styles.dashed, { borderColor: colors.textSecondary }]}>
        <Icon name="add" size={32} color={colors.text} />
      </View>
      <ThemedText variant="caption" numberOfLines={1} style={styles.name}>
        {t('pets.addShort')}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: SIZE, gap: spacing.xs },
  photo: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dashed: { borderStyle: 'dashed', borderWidth: 2 },
  name: { textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
