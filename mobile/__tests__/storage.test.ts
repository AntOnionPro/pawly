import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  parsePreferences,
  PREFERENCES_KEY,
  savePreferences,
} from '@/preferences/storage';

describe('parsePreferences', () => {
  it('returns the defaults when nothing is saved', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it('reads valid preferences', () => {
    expect(parsePreferences('{"theme":"dark","language":"es"}')).toEqual({
      theme: 'dark',
      language: 'es',
    });
  });

  it('replaces unknown values with the defaults', () => {
    expect(parsePreferences('{"theme":"purple","language":"fr"}')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"theme":"light"}')).toEqual({ theme: 'light', language: 'system' });
  });

  it('survives corrupted data', () => {
    expect(parsePreferences('not json')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('42')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('null')).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('loadPreferences / savePreferences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saves and loads the preferences', async () => {
    await savePreferences({ theme: 'light', language: 'en' });
    expect(await AsyncStorage.getItem(PREFERENCES_KEY)).toBe('{"theme":"light","language":"en"}');
    expect(await loadPreferences()).toEqual({ theme: 'light', language: 'en' });
  });

  it('falls back to the defaults if storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk error'));
    expect(await loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});
