import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { petPhotoUrl, type Pet } from './api';

/** Photo, name, species, breed and owner of a pet in a list; opens the pet's page. */
export function PetRow({ pet, onPress }: { pet: Pet; onPress: () => void }) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const colors = useThemeColors();
  const photo = petPhotoUrl(client, pet, '100x100');
  const details = [
    t(`pets.speciesNames.${pet.species}`),
    pet.breed,
    pet.ownerUsername ? t('search.petOwner', { username: pet.ownerUsername }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${pet.name}, ${details}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.photo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} />
        ) : (
          <Icon name="paw" selected size={22} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.names}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {pet.name}
        </ThemedText>
        <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
          {details}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  photo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: { flex: 1 },
  name: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
