/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Push notifications need the native module, which tests do not have: nothing is allowed and
// no push arrives. Tests that need more replace these mocks.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  setNotificationChannelAsync: jest.fn(async () => null),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

// Native maps cannot run in tests: plain views stand in for the map and its markers.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = ({ children, ...props }) => React.createElement(View, props, children);
  const Marker = ({ children, ...props }) =>
    React.createElement(
      View,
      { ...props, accessible: true, accessibilityRole: 'button' },
      children,
    );
  return { __esModule: true, default: MapView, Marker };
});

// The connection is unknown in tests: the mock says mobile data. Tests that need Wi-Fi change it.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);
