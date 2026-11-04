import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { icons, type IconName } from '@/theme/icons';

interface IconProps {
  name: IconName;
  /** Uses the filled variant on iOS. */
  selected?: boolean;
  size?: number;
  color: ColorValue;
}

/** SF Symbol on iOS and Material Symbol on Android and web. */
export function Icon({ name, selected = false, size = 24, color }: IconProps) {
  const icon = icons[name];
  return (
    <SymbolView
      name={{ ios: selected ? icon.sf.selected : icon.sf.default, android: icon.md, web: icon.md }}
      size={size}
      tintColor={color}
      accessible={false}
    />
  );
}
