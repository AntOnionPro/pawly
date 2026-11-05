import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing, typography } from '@/theme/typography';

/** Search box with a magnifying glass; by default it gets the keyboard when the screen opens. */
export function SearchField({
  value,
  onChangeText,
  label,
  placeholder,
  autoFocus = true,
}: {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name="search" size={20} color={colors.textSecondary} />
      <TextInput
        accessibilityLabel={label ?? t('search.title')}
        placeholder={placeholder ?? t('search.placeholder')}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={[styles.input, typography.body, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, paddingVertical: spacing.sm },
});
