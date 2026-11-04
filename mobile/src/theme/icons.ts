import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/**
 * Every icon in the app, with its SF Symbol (iOS) and Material Symbol (Android and web).
 * The interface never uses emojis: add new icons here.
 */
export interface IconDefinition {
  sf: { default: SFSymbol; selected: SFSymbol };
  md: AndroidSymbol;
}

export const icons = {
  home: { sf: { default: 'house', selected: 'house.fill' }, md: 'home' },
  adoption: {
    sf: { default: 'heart.circle', selected: 'heart.circle.fill' },
    md: 'volunteer_activism',
  },
  post: { sf: { default: 'plus.app', selected: 'plus.app.fill' }, md: 'add_box' },
  rescue: { sf: { default: 'cross.case', selected: 'cross.case.fill' }, md: 'medical_services' },
  profile: {
    sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' },
    md: 'account_circle',
  },
  settings: { sf: { default: 'gearshape', selected: 'gearshape.fill' }, md: 'settings' },
  paw: { sf: { default: 'pawprint', selected: 'pawprint.fill' }, md: 'pets' },
  check: { sf: { default: 'checkmark', selected: 'checkmark' }, md: 'check' },
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof icons;
