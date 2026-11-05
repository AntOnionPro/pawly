import { HeaderHeightContext } from 'expo-router/react-navigation';
import { use, type PropsWithChildren, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

interface ScreenProps extends PropsWithChildren {
  /** Safe area edges to pad. Screens under a native header only need the bottom. */
  edges?: Edge[];
  /** Stays under the scrolling content and above the keyboard (for example a message bar). */
  footer?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  onContentSizeChange?: (width: number, height: number) => void;
}

/** Scrollable screen with the theme background, safe area padding and room for the keyboard. */
export function Screen({
  children,
  edges = ['top'],
  footer,
  scrollRef,
  onContentSizeChange,
}: ScreenProps) {
  const colors = useThemeColors();
  // The keyboard is measured from the top of the window, so a header above the screen counts.
  const headerHeight = use(HeaderHeightContext) ?? 0;
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.md, gap: spacing.md },
});
