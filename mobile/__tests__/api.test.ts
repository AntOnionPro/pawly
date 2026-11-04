import { ClientResponseError } from 'pocketbase';

import { resolveApiUrl } from '@/api/config';
import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';

function responseError(status: number, data: Record<string, unknown> = {}) {
  return new ClientResponseError({ status, response: { status, message: 'x', data } });
}

describe('resolveApiUrl', () => {
  it('uses EXPO_PUBLIC_API_URL when set', () => {
    expect(resolveApiUrl({ envUrl: 'https://api.pawly.mx/', hostUri: '192.168.1.5:8081' })).toBe(
      'https://api.pawly.mx',
    );
  });

  it('uses the computer running Expo, on port 8090', () => {
    expect(resolveApiUrl({ hostUri: '192.168.1.5:8081' })).toBe('http://192.168.1.5:8090');
  });

  it('uses the browser host on the web', () => {
    expect(resolveApiUrl({ webHostname: 'localhost' })).toBe('http://localhost:8090');
  });

  it('falls back to this machine', () => {
    expect(resolveApiUrl({})).toBe('http://127.0.0.1:8090');
  });
});

describe('toFieldErrors', () => {
  it('translates PocketBase validation codes per field', () => {
    const error = responseError(400, {
      username: { code: 'validation_not_unique' },
      email: { code: 'validation_not_unique' },
      password: { code: 'validation_min_text_constraint' },
      passwordConfirm: { code: 'validation_values_mismatch' },
      dateOfBirth: { code: 'too_young' },
      acceptTerms: { code: 'terms_required' },
      bio: { code: 'validation_max_text_constraint' },
      oldPassword: { code: 'validation_invalid_old_password' },
    });
    expect(toFieldErrors(error)).toEqual({
      username: 'errors.usernameTaken',
      email: 'errors.emailTaken',
      password: 'errors.passwordTooShort',
      passwordConfirm: 'errors.passwordMismatch',
      dateOfBirth: 'errors.tooYoung',
      acceptTerms: 'errors.termsRequired',
      bio: 'errors.tooLong',
      oldPassword: 'errors.passwordWrong',
    });
  });

  it('uses a generic message for unknown codes', () => {
    expect(toFieldErrors(responseError(400, { foo: { code: 'weird' } }))).toEqual({
      foo: 'errors.invalid',
    });
  });

  it('ignores errors that are not from PocketBase', () => {
    expect(toFieldErrors(new Error('boom'))).toEqual({});
  });
});

describe('requestErrorKind', () => {
  it('tells apart network, unverified, credentials and validation errors', () => {
    expect(requestErrorKind(responseError(0))).toBe('network');
    expect(requestErrorKind(responseError(403))).toBe('unverified');
    expect(requestErrorKind(responseError(400))).toBe('invalidCredentials');
    expect(requestErrorKind(responseError(400, { email: { code: 'validation_required' } }))).toBe(
      'validation',
    );
    expect(requestErrorKind(responseError(500))).toBe('unknown');
    expect(requestErrorKind(new Error('boom'))).toBe('unknown');
  });

  it('has a message for errors that are not tied to a field', () => {
    expect(requestErrorKey('network')).toBe('errors.network');
    expect(requestErrorKey('unverified')).toBe('errors.unverified');
    expect(requestErrorKey('invalidCredentials')).toBe('errors.invalidCredentials');
    expect(requestErrorKey('unknown')).toBe('errors.generic');
    expect(requestErrorKey('validation')).toBeNull();
  });
});
