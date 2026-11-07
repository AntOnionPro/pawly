import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { spacing } from '@/theme/typography';

import { ThemedText } from './ThemedText';

interface CollapsibleTextProps {
  children: string;
  /** Lines shown until "See more" is pressed. */
  lines?: number;
}

/**
 * Text cut to a few lines with "See more", which shows it whole. Short texts show as they are.
 *
 * To know whether the text is cut, a hidden copy without the limit is measured next to the
 * visible one (works the same on iOS, Android and the web).
 */
export function CollapsibleText({ children, lines = 3 }: CollapsibleTextProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const [shownHeight, setShownHeight] = useState(0);
  const height = (set: (value: number) => void) => (event: LayoutChangeEvent) =>
    set(event.nativeEvent.layout.height);
  const cut = !expanded && fullHeight > shownHeight + 1;

  return (
    <View>
      <View>
        <ThemedText numberOfLines={expanded ? undefined : lines} onLayout={height(setShownHeight)}>
          {children}
        </ThemedText>
        {expanded ? null : (
          <ThemedText
            testID="collapsible-measure"
            onLayout={height(setFullHeight)}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.measure}>
            {children}
          </ThemedText>
        )}
      </View>
      {cut ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <ThemedText color="textSecondary" style={styles.moreText}>
            {t('posts.seeMore')}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same width as the visible text, out of the layout and invisible.
  measure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
  more: { alignSelf: 'flex-start', paddingTop: spacing.xs },
  moreText: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
