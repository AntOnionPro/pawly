import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { FieldError } from './FieldError';
import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
}

export function Checkbox({ label, checked, onChange, error }: CheckboxProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        hitSlop={8}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <Icon
          name={checked ? 'checkboxOn' : 'checkboxOff'}
          size={26}
          color={checked ? colors.accent : colors.text}
        />
        <ThemedText style={styles.label}>{label}</ThemedText>
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
