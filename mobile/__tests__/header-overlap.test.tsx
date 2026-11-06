import { fireEvent, render, screen } from '@testing-library/react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { Text, View } from 'react-native';

import { useHeaderOverlap } from '@/utils/useHeaderOverlap';

function Probe() {
  const { onLayout, overlap } = useHeaderOverlap();
  return (
    <View testID="probe" onLayout={onLayout} style={{ paddingTop: overlap }}>
      <Text>{`overlap:${overlap}`}</Text>
    </View>
  );
}

/** A layout event whose view says where it is in the window. */
function layoutAt(y: number | null) {
  return {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    currentTarget:
      y === null
        ? undefined
        : { measureInWindow: (done: (x: number, top: number) => void) => done(0, y) },
  };
}

async function renderUnderHeader(headerHeight: number) {
  await render(
    <HeaderHeightContext.Provider value={headerHeight}>
      <Probe />
    </HeaderHeightContext.Provider>,
  );
}

describe('useHeaderOverlap', () => {
  it('leaves room for a see-through header drawn over the view (iOS 26+)', async () => {
    await renderUnderHeader(106);
    expect(screen.getByText('overlap:0')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('probe'), 'layout', layoutAt(0));
    expect(screen.getByText('overlap:106')).toBeOnTheScreen();
  });

  it('leaves nothing when the view already starts below the header', async () => {
    await renderUnderHeader(106);
    await fireEvent(screen.getByTestId('probe'), 'layout', layoutAt(106));
    expect(screen.getByText('overlap:0')).toBeOnTheScreen();
  });

  it('leaves nothing without a header', async () => {
    await render(<Probe />);
    await fireEvent(screen.getByTestId('probe'), 'layout', layoutAt(0));
    expect(screen.getByText('overlap:0')).toBeOnTheScreen();
  });

  it('leaves nothing when the view cannot be measured (web)', async () => {
    await renderUnderHeader(106);
    await fireEvent(screen.getByTestId('probe'), 'layout', layoutAt(null));
    expect(screen.getByText('overlap:0')).toBeOnTheScreen();
  });
});
