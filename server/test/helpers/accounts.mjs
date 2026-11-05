// Account helpers for tests: sign up, verify (through the dev email log) and sign in.
import assert from 'node:assert/strict';

import { SUPERUSER } from './pocketbase.mjs';

export const USERS = '/api/collections/users';
export const PASSWORD = 'una-clave-segura-123';

let counter = 0;

export function accountHelpers(getPb) {
  const pb = () => getPb();

  function newAccount(overrides = {}) {
    counter += 1;
    return {
      username: `perro.${counter}.${process.pid}`,
      email: `persona${counter}.${process.pid}@pawly.test`,
      password: PASSWORD,
      passwordConfirm: PASSWORD,
      dateOfBirth: '2000-05-20 00:00:00.000Z',
      acceptTerms: true,
      ...overrides,
    };
  }

  function signUp(account) {
    return pb().api(`${USERS}/records`, { method: 'POST', body: account });
  }

  function signIn(email, password = PASSWORD) {
    return pb().api(`${USERS}/auth-with-password`, {
      method: 'POST',
      body: { identity: email, password },
    });
  }

  async function verify(email) {
    const link = await pb().waitForMailLink(email, 'confirm-verification');
    const token = link.split('/').pop();
    return pb().api(`${USERS}/confirm-verification`, { method: 'POST', body: { token } });
  }

  /** Signs up, verifies and signs in. Returns the account, the record and the auth token. */
  async function verifiedUser(overrides) {
    const account = newAccount(overrides);
    const created = await signUp(account);
    assert.equal(created.status, 200, JSON.stringify(created.body));
    await verify(account.email);
    const auth = await signIn(account.email);
    assert.equal(auth.status, 200, JSON.stringify(auth.body));
    return { account, record: auth.body.record, token: auth.body.token };
  }

  async function superuserToken() {
    const { body } = await pb().api('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body: { identity: SUPERUSER.email, password: SUPERUSER.password },
    });
    return body.token;
  }

  return { newAccount, signUp, signIn, verify, verifiedUser, superuserToken };
}
