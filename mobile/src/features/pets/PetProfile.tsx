import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { petPhotoUrl, type Pet } from './api';
import { petAge } from './age';

interface PetProfileProps {
  pet: Pet;
  /** Shown only to the owner. */
  onEdit?: () => void;
  /** Opens the owner's profile. */
  onPressOwner?: (ownerId: string) => void;
}

/** Photo, name, species, breed, age and owner of a pet. */
export function PetProfile({ pet, onEdit, onPressOwner }: PetProfileProps) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const colors = useThemeColors();
  const photo = petPhotoUrl(client, pet);
  const age = petAge(pet.birthDate);
  const kind = [t(`pets.speciesNames.${pet.species}`), pet.breed].filter(Boolean).join(' · ');

  return (
    <View style={styles.container}>
      <View style={[styles.photo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Icon name="paw" selected size={64} color={colors.textSecondary} />
        )}
      </View>
      <ThemedText variant="title" accessibilityRole="header">
        {pet.name}
      </ThemedText>
      <ThemedText color="textSecondary">{kind}</ThemedText>
      {age ? (
        <ThemedText>
          {age.unit === 'newborn'
            ? t('pets.age.newborn')
            : t(`pets.age.${age.unit}`, { count: age.count })}
        </ThemedText>
      ) : null}
      {pet.ownerUsername ? (
        <Pressable
          accessibilityRole={onPressOwner ? 'link' : undefined}
          disabled={!onPressOwner}
          onPress={() => onPressOwner?.(pet.ownerId)}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText color="textSecondary">
            {t('pets.owner', { username: pet.ownerUsername })}
          </ThemedText>
        </Pressable>
      ) : null}
      {onEdit ? (
        <View style={styles.actions}>
          <Button
            size="compact"
            variant="secondary"
            icon="edit"
            label={t('pets.edit')}
            onPress={onEdit}
          />
        </View>
      ) : null}
    </View>
  );
}

const PHOTO = 180;

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: radius.md * 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  actions: { marginTop: spacing.md },
  pressed: { opacity: 0.6 },
});
