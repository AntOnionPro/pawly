import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import type { Pet } from '@/features/pets/api';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

interface PetPickerProps {
  pets: Pet[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Chips to tag several of your own pets in a post. */
export function PetPicker({ pets, selected, onChange }: PetPickerProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  if (pets.length === 0) {
    return null;
  }
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);

  return (
    <View style={styles.container}>
      <ThemedText variant="label" color="textSecondary">
        {t('posts.tagPets')}
      </ThemedText>
      <View style={styles.row}>
        {pets.map((pet) => {
          const isSelected = selected.includes(pet.id);
          return (
            <Pressable
              key={pet.id}
              accessibilityRole="checkbox"
              accessibilityLabel={pet.name}
              accessibilityState={{ checked: isSelected }}
              onPress={() => toggle(pet.id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.tabIndicator : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth * 2,
                },
                pressed && styles.pressed,
              ]}>
              <Icon name="paw" selected={isSelected} size={16} color={colors.text} />
              <ThemedText style={isSelected ? styles.selectedText : undefined}>
                {pet.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectedText: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
