import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { Button } from './Button';
import { FieldError } from './FieldError';

/** Spinner while loading. */
export function Loading() {
  const colors = useThemeColors();
  return (
    <View style={styles.center} accessibilityLabel="…" accessibilityRole="progressbar">
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/** Explains why something could not load and offers to try again. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const key = requestErrorKey(requestErrorKind(error)) ?? 'errors.generic';
  return (
    <View style={[styles.center, styles.gap]}>
      <FieldError message={t(key)} />
      <Button variant="secondary" label={t('common.retry')} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  gap: { gap: spacing.md },
});
