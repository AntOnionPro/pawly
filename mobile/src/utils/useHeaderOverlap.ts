import { HeaderHeightContext } from 'expo-router/react-navigation';
import { use, useState } from 'react';
import type { HostInstance, LayoutChangeEvent } from 'react-native';

/**
 * Where a view starts on the screen and how much of it is under the header.
 *
 * Since iOS 26 the navigation bar is see-through and screens are drawn under it, so a view
 * that is not a scroll view (which adjusts on its own with `contentInsetAdjustmentBehavior`)
 * must leave room for it. Elsewhere the view starts below the header and the overlap is 0.
 * Pass `onLayout` to the view.
 *
 * `keyboardOffset` is the `keyboardVerticalOffset` for a KeyboardAvoidingView placed at the
 * top of the view: where the view really starts. Using the header height instead leaves a gap
 * above the keyboard as tall as the header when the screen is drawn under it.
 */
export function useHeaderOverlap() {
  const headerHeight = use(HeaderHeightContext) ?? 0;
  const [top, setTop] = useState<number | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    // The view itself (on the web there is nothing to measure: no header covers it).
    const view = event.currentTarget as unknown as Partial<HostInstance> | undefined;
    view?.measureInWindow?.((_x, y) => setTop(y));
  };
  return {
    onLayout,
    /** The view's distance from the top of the window, once measured. */
    top,
    /** How much of the view the header covers. */
    overlap: top === null ? 0 : Math.max(0, Math.round(headerHeight - top)),
    /** Until it is measured, the view is assumed to start below the header. */
    keyboardOffset: top === null ? headerHeight : Math.max(0, Math.round(top)),
  };
}
