import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/theme/icons';
import { spacing } from '@/theme/typography';

import { GlassButton } from './GlassButton';

/** Room to leave at the end of a list so its last item is not under the floating button. */
export const FLOATING_ACTION_SPACE = 56 + spacing.md * 2;

interface FloatingActionProps {
  icon: IconName;
  label: string;
  onPress: () => void;
}

/**
 * The main action of a tab, floating at the bottom right over the content (Liquid Glass on
 * iOS 26, a Material 3 FAB on Android). Render it last, over the list.
 */
export function FloatingAction({ icon, label, onPress }: FloatingActionProps) {
  const insets = useSafeAreaInsets();
  // On iOS each tab has its own safe area, which already counts the tab bar. On Android the tab
  // content ends above the tab bar.
  const bottom = (Platform.OS === 'ios' ? insets.bottom : 0) + spacing.md;
  return (
    <View pointerEvents="box-none" style={[styles.place, { bottom }]}>
      <GlassButton kind="floating" icon={icon} label={label} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  place: { position: 'absolute', right: spacing.md },
});
