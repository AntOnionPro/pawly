import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform } from 'react-native';

import type { Species } from './api';

type CommunityIcon = keyof typeof MaterialCommunityIcons.glyphMap;

interface SpeciesSymbols {
  /** SF Symbol (iOS), when there is one, and the first iOS version that has it. */
  sf?: SFSymbol;
  sfSince?: number;
  /** Material Design community icon (Android, the web, and iOS without an SF Symbol). */
  community: CommunityIcon;
}

/**
 * The animal of each species. Material Symbols has no dog, cat, fish or reptile, so Android and
 * the web use the Material Design community icons. iOS uses SF Symbols where it has them: the
 * dog and the cat arrived in iOS 17, and there is no rodent.
 */
export const SPECIES_ICONS: Record<Species, SpeciesSymbols> = {
  dog: { sf: 'dog.fill', sfSince: 17, community: 'dog' },
  cat: { sf: 'cat.fill', sfSince: 17, community: 'cat' },
  bird: { sf: 'bird.fill', community: 'bird' },
  rabbit: { sf: 'hare.fill', community: 'rabbit-variant' },
  rodent: { community: 'rodent' },
  reptile: { sf: 'tortoise.fill', community: 'tortoise' },
  fish: { sf: 'fish.fill', community: 'fish' },
  other: { sf: 'pawprint.fill', community: 'paw' },
};

/** Which icon a species uses on this platform: an SF Symbol or a community icon. */
export function speciesSymbol(
  species: Species,
  os: string = Platform.OS,
  version: string | number = Platform.Version,
): { sf: SFSymbol } | { community: CommunityIcon } {
  const icon = SPECIES_ICONS[species];
  const iosVersion = parseFloat(String(version));
  if (os === 'ios' && icon.sf && (!icon.sfSince || iosVersion >= icon.sfSince)) {
    return { sf: icon.sf };
  }
  return { community: icon.community };
}

interface SpeciesIconProps {
  species: Species;
  size?: number;
  color: string;
}

/** The animal of a species, as a filled icon. Decorative: the text next to it names it. */
export function SpeciesIcon({ species, size = 24, color }: SpeciesIconProps) {
  const symbol = speciesSymbol(species);
  if ('sf' in symbol) {
    return (
      <SymbolView
        name={symbol.sf}
        size={size}
        tintColor={color}
        accessible={false}
        testID={`species-icon-${species}`}
      />
    );
  }
  return (
    <MaterialCommunityIcons
      name={symbol.community}
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no"
      testID={`species-icon-${species}`}
    />
  );
}
