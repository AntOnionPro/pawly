import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useFontStyle, useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing, typography } from '@/theme/typography';

import { Icon } from './Icon';

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

/** A search box with the magnifying glass and a button to clear it. */
export function SearchField({ value, onChangeText, placeholder }: SearchFieldProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const fontStyle = useFontStyle();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name="search" size={20} color={colors.textSecondary} />
      <TextInput
        accessibilityLabel={t('search.title')}
        accessibilityRole="search"
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
        style={[styles.input, typography.body, fontStyle, { color: colors.text }]}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('search.clear')}
          hitSlop={10}
          onPress={() => onChangeText('')}
          style={({ pressed }) => pressed && styles.pressed}>
          <Icon name="remove" size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md * 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  input: { flex: 1, paddingVertical: spacing.sm },
  pressed: { opacity: 0.6 },
});
