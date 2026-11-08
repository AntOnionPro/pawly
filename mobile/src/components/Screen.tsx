import { useState, type PropsWithChildren, type ReactNode, type Ref } from 'react';
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
import { column, tabBarTopSpace } from '@/theme/layout';
import { spacing } from '@/theme/typography';
import { useHeaderOverlap } from '@/utils/useHeaderOverlap';

interface ScreenProps extends PropsWithChildren {
  /** Safe area edges to pad. Screens under a native header only need the bottom. */
  edges?: Edge[];
  /** Stays under the scrolling content and above the keyboard (for example a message bar). */
  footer?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  onContentSizeChange?: (width: number, height: number) => void;
  /** A tab screen: on the web, it leaves room at the top for the floating tab bar. */
  tab?: boolean;
}

/** Scrollable screen with the theme background, safe area padding and room for the keyboard. */
export function Screen({
  children,
  edges = ['top'],
  footer,
  scrollRef,
  onContentSizeChange,
  tab = false,
}: ScreenProps) {
  const colors = useThemeColors();
  // The keyboard is measured from the top of the window: the offset is where this screen
  // starts (under the see-through header of iOS 26+, below it elsewhere).
  const position = useHeaderOverlap();
  // The content fills what can be seen. Under the see-through header of iOS 26+ the scroll view
  // also leaves room for the header at the top, so filling its whole height would make every
  // screen scroll by the header's height (and hide what sits at the bottom).
  const [frameHeight, setFrameHeight] = useState(0);
  const visibleHeight = Math.max(0, frameHeight - position.overlap);
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      <View onLayout={position.onLayout} style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={position.keyboardOffset}>
          <ScrollView
            ref={scrollRef}
            testID="screen-scroll"
            onContentSizeChange={onContentSizeChange}
            onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}
            contentContainerStyle={[
              styles.content,
              styles.column,
              tab && { paddingTop: spacing.md + tabBarTopSpace() },
              visibleHeight > 0 ? { minHeight: visibleHeight } : styles.grow,
            ]}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.column}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  grow: { flexGrow: 1 },
  column: column(),
});
