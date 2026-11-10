import { Stack, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useColorSchemeName,
  useFontStyle,
  usePreferences,
  useThemeColors,
} from '@/preferences/PreferencesProvider';
import { fontFor } from '@/theme/fonts';
import { spacing, typography } from '@/theme/typography';

import { Button } from './Button';

export interface HeaderActionProps {
  label: string;
  /** Shown while saving (for example "Saving…"); the action cannot be pressed meanwhile. */
  pendingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/**
 * The main action of a form ("Save", "Publish") on the right of the top bar. It draws nothing
 * where it is rendered.
 * - iOS: a native bar button, with Liquid Glass tinted with the accent on iOS 26 (plain glass
 *   in the dark theme, whose accent is white) and bold text in the accent before.
 * - Android: a Material 3 text button in the top app bar.
 * - Web: a compact button.
 *
 * When it stops being rendered (a form that goes away while its screen stays), the button
 * leaves the top bar too.
 */
export function HeaderAction({
  label,
  pendingLabel,
  loading = false,
  disabled = false,
  onPress,
}: HeaderActionProps) {
  const colors = useThemeColors();
  const scheme = useColorSchemeName();
  const labelFont = useFontStyle('700');
  const text = loading && pendingLabel ? pendingLabel : label;
  const inactive = disabled || loading;
  const navigation = useNavigation();

  // iOS takes the toolbar button away by itself. On Android and the web the top bar keeps
  // the last `headerRight` it was given, so it is cleared here.
  useEffect(() => {
    if (Platform.OS === 'ios') return undefined;
    return () => navigation.setOptions({ headerRight: undefined });
  }, [navigation]);

  if (Platform.OS === 'ios') {
    return (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant={scheme === 'dark' ? 'plain' : 'prominent'}
          tintColor={colors.accent}
          disabled={inactive}
          accessibilityLabel={text}
          style={labelFont}
          onPress={onPress}>
          {text}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    );
  }
  return (
    <Stack.Screen
      options={{
        headerRight: () =>
          Platform.OS === 'android' ? (
            <MaterialTextButton label={text} disabled={inactive} onPress={onPress} />
          ) : (
            <View style={styles.web}>
              <Button
                size="compact"
                label={text}
                onPress={onPress}
                loading={loading}
                disabled={disabled}
              />
            </View>
          ),
      }}
    />
  );
}

/** Material 3 text button: the label in the accent, with a ripple and a 48 dp touch area. */
function MaterialTextButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const { font } = usePreferences();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: colors.tabIndicator, borderless: true }}
      style={[styles.material, disabled && styles.dimmed]}>
      <Text style={[typography.link, fontFor(font, '700'), { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  web: { marginRight: spacing.md },
  material: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.6 },
});
