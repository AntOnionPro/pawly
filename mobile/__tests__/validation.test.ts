import {
  ageOn,
  EMPTY_SIGN_UP,
  normalizeUsername,
  parseIsoDate,
  toIsoDate,
  validateDateOfBirth,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateSignIn,
  validateSignUp,
  validateUsername,
} from '@/auth/validation';

const today = new Date(2026, 10, 4); // 4 Nov 2026

describe('usernames', () => {
  it('are lowercased and trimmed', () => {
    expect(normalizeUsername('  Firulais.MX ')).toBe('firulais.mx');
  });

  it.each(['luna', 'perro_feliz', 'gato.123', 'abc', 'a'.repeat(30), '  Luna  '])(
    'accepts "%s"',
    (value) => expect(validateUsername(value)).toBeNull(),
  );

  it('requires a value', () => {
    expect(validateUsername('   ')).toBe('errors.required');
  });

  it.each(['ab', 'a'.repeat(31), 'con espacio', 'con-guion', 'ñandú', 'emoji🐶'])(
    'rejects "%s"',
    (value) => expect(validateUsername(value)).toBe('errors.usernameFormat'),
  );
});

describe('email and password', () => {
  it('validates the email', () => {
    expect(validateEmail('luna@ejemplo.com')).toBeNull();
    expect(validateEmail(' luna@ejemplo.com ')).toBeNull();
    expect(validateEmail('')).toBe('errors.required');
    expect(validateEmail('luna@')).toBe('errors.emailInvalid');
    expect(validateEmail('luna ejemplo.com')).toBe('errors.emailInvalid');
  });

  it('requires 8 characters for the password', () => {
    expect(validatePassword('12345678')).toBeNull();
    expect(validatePassword('1234567')).toBe('errors.passwordTooShort');
    expect(validatePassword('')).toBe('errors.required');
  });

  it('requires the confirmation to match', () => {
    expect(validatePasswordConfirm('12345678', '12345678')).toBeNull();
    expect(validatePasswordConfirm('12345678', '12345679')).toBe('errors.passwordMismatch');
    expect(validatePasswordConfirm('12345678', '')).toBe('errors.required');
  });
});

describe('dates', () => {
  it('parses and formats calendar dates', () => {
    expect(toIsoDate(new Date(2010, 4, 31))).toBe('2010-05-31');
    expect(parseIsoDate('2010-05-31')).toEqual(new Date(2010, 4, 31));
    expect(parseIsoDate('2010-02-30')).toBeNull();
    expect(parseIsoDate('31/05/2010')).toBeNull();
  });

  it('counts full years', () => {
    expect(ageOn(new Date(2013, 10, 4), today)).toBe(13);
    expect(ageOn(new Date(2013, 10, 5), today)).toBe(12);
  });

  it('requires being 13 or older (same rule as the server)', () => {
    expect(validateDateOfBirth('2013-11-04', today)).toBeNull();
    expect(validateDateOfBirth('1990-01-01', today)).toBeNull();
    expect(validateDateOfBirth('2013-11-05', today)).toBe('errors.tooYoung');
    expect(validateDateOfBirth('', today)).toBe('errors.dateRequired');
    expect(validateDateOfBirth('2030-01-01', today)).toBe('errors.dateInvalid');
    expect(validateDateOfBirth('1899-12-31', today)).toBe('errors.dateInvalid');
  });
});

describe('forms', () => {
  it('reports every missing sign-up field', () => {
    expect(validateSignUp(EMPTY_SIGN_UP, today)).toEqual({
      username: 'errors.required',
      email: 'errors.required',
      password: 'errors.required',
      passwordConfirm: 'errors.required',
      dateOfBirth: 'errors.dateRequired',
      acceptTerms: 'errors.termsRequired',
    });
  });

  it('accepts a complete sign-up', () => {
    expect(
      validateSignUp(
        {
          username: 'luna',
          email: 'luna@ejemplo.com',
          password: '12345678',
          passwordConfirm: '12345678',
          dateOfBirth: '1995-03-02',
          acceptTerms: true,
        },
        today,
      ),
    ).toEqual({});
  });

  it('validates sign-in', () => {
    expect(validateSignIn('', '')).toEqual({
      email: 'errors.required',
      password: 'errors.required',
    });
    expect(validateSignIn('luna@ejemplo.com', 'x')).toEqual({});
  });
});
