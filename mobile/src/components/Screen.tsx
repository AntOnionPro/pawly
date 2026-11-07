import type { PropsWithChildren, ReactNode, Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';
import { useHeaderOverlap } from '@/utils/useHeaderOverlap';

interface ScreenProps extends PropsWithChildren {
  /** Safe area edges to pad. Screens under a native header only need the bottom. */
  edges?: Edge[];
  /** Stays under the scrolling content and above the keyboard (for example a message bar). */
  footer?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  onContentSizeChange?: (width: number, height: number) => void;
  /** Decoration drawn behind the content (for example `CatSilhouette`). */
  background?: ReactNode;
}

/** Scrollable screen with the theme background, safe area padding and room for the keyboard. */
export function Screen({
  children,
  edges = ['top'],
  footer,
  background,
  scrollRef,
  onContentSizeChange,
}: ScreenProps) {
  const colors = useThemeColors();
  // The keyboard is measured from the top of the window: the offset is where this screen
  // starts (under the see-through header of iOS 26+, below it elsewhere).
  const position = useHeaderOverlap();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {background}
      <View onLayout={position.onLayout} style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={position.keyboardOffset}>
          <ScrollView
            ref={scrollRef}
            onContentSizeChange={onContentSizeChange}
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.md, gap: spacing.md },
});
