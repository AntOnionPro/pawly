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
  comment: { sf: { default: 'bubble.right', selected: 'bubble.right.fill' }, md: 'chat_bubble' },
  repost: {
    sf: { default: 'arrow.2.squarepath', selected: 'arrow.2.squarepath' },
    md: 'repeat',
  },
  share: { sf: { default: 'square.and.arrow.up', selected: 'square.and.arrow.up' }, md: 'share' },
  flag: { sf: { default: 'flag', selected: 'flag.fill' }, md: 'flag' },
  block: { sf: { default: 'hand.raised', selected: 'hand.raised.fill' }, md: 'block' },
  notifications: { sf: { default: 'bell', selected: 'bell.fill' }, md: 'notifications' },
  messages: {
    sf: { default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' },
    md: 'forum',
  },
  search: { sf: { default: 'magnifyingglass', selected: 'magnifyingglass' }, md: 'search' },
  send: { sf: { default: 'paperplane.fill', selected: 'paperplane.fill' }, md: 'send' },
  check: { sf: { default: 'checkmark', selected: 'checkmark' }, md: 'check' },
  mail: { sf: { default: 'envelope', selected: 'envelope.fill' }, md: 'mail' },
  chevron: { sf: { default: 'chevron.right', selected: 'chevron.right' }, md: 'chevron_right' },
  checkboxOff: { sf: { default: 'square', selected: 'square' }, md: 'check_box_outline_blank' },
  checkboxOn: {
    sf: { default: 'checkmark.square.fill', selected: 'checkmark.square.fill' },
    md: 'check_box',
  },
  error: {
    sf: { default: 'exclamationmark.circle', selected: 'exclamationmark.circle.fill' },
    md: 'error',
  },
  calendar: { sf: { default: 'calendar', selected: 'calendar' }, md: 'calendar_month' },
  document: { sf: { default: 'doc.text', selected: 'doc.text' }, md: 'description' },
  lock: { sf: { default: 'lock', selected: 'lock.fill' }, md: 'lock' },
  signOut: {
    sf: {
      default: 'rectangle.portrait.and.arrow.right',
      selected: 'rectangle.portrait.and.arrow.right',
    },
    md: 'logout',
  },
  delete: { sf: { default: 'trash', selected: 'trash' }, md: 'delete' },
  edit: { sf: { default: 'pencil', selected: 'pencil' }, md: 'edit' },
  camera: { sf: { default: 'camera', selected: 'camera' }, md: 'photo_camera' },
  add: { sf: { default: 'plus', selected: 'plus' }, md: 'add' },
  remove: { sf: { default: 'xmark.circle.fill', selected: 'xmark.circle.fill' }, md: 'cancel' },
  video: { sf: { default: 'video', selected: 'video.fill' }, md: 'videocam' },
  filter: {
    sf: {
      default: 'line.3.horizontal.decrease.circle',
      selected: 'line.3.horizontal.decrease.circle.fill',
    },
    md: 'filter_list',
  },
  location: {
    sf: { default: 'mappin.and.ellipse', selected: 'mappin.and.ellipse' },
    md: 'location_on',
  },
  requests: {
    sf: { default: 'list.bullet.clipboard', selected: 'list.bullet.clipboard.fill' },
    md: 'assignment',
  },
  gallery: {
    sf: { default: 'photo.on.rectangle', selected: 'photo.on.rectangle' },
    md: 'photo_library',
  },
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof icons;
