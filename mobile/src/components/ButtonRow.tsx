import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/typography';

interface ButtonRowProps {
  /** center: under a centered header (profiles); start: with the content (details). */
  align?: 'start' | 'center';
}

/** Compact buttons side by side, wrapping to a new line when they do not fit. */
export function ButtonRow({ align = 'start', children }: PropsWithChildren<ButtonRowProps>) {
  return <View style={[styles.row, align === 'center' && styles.center]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  center: { justifyContent: 'center' },
});
