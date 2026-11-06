import { fontFor } from '@/theme/fonts';

describe('fontFor', () => {
  it('picks the Ubuntu file for each weight (600 uses medium: there is no semibold)', () => {
    expect(fontFor('ubuntu')).toEqual({ fontFamily: 'Ubuntu_400Regular', fontWeight: 'normal' });
    expect(fontFor('ubuntu', '300').fontFamily).toBe('Ubuntu_300Light');
    expect(fontFor('ubuntu', 'normal').fontFamily).toBe('Ubuntu_400Regular');
    expect(fontFor('ubuntu', '500').fontFamily).toBe('Ubuntu_500Medium');
    expect(fontFor('ubuntu', '600').fontFamily).toBe('Ubuntu_500Medium');
    expect(fontFor('ubuntu', '700').fontFamily).toBe('Ubuntu_700Bold');
    expect(fontFor('ubuntu', 'bold').fontFamily).toBe('Ubuntu_700Bold');
    expect(fontFor('ubuntu', 800).fontFamily).toBe('Ubuntu_700Bold');
  });

  it('keeps the weight with the system font', () => {
    expect(fontFor('system')).toEqual({});
    expect(fontFor('system', '600')).toEqual({ fontWeight: '600' });
  });
});
