// The native date picker cannot be driven in tests: a text field stands in for it.
// Use with: jest.mock('@/components/DateField', () => require('../test-utils/mocks/DateField'));
import { Text, TextInput, View } from 'react-native';

import type { DateFieldProps } from '@/components/DateField';

export function DateField({ label, value, onChange, error }: DateFieldProps) {
  return (
    <View>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} />
      {error ? <Text>{error}</Text> : null}
    </View>
  );
}
