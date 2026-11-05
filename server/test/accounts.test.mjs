// End-to-end tests of accounts against a real PocketBase: sign-up rules, verification,
// sign-in, privacy, profile editing, password change and recovery, and account deletion.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, PASSWORD, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { newAccount, signUp, signIn, verify, verifiedUser, superuserToken } = accountHelpers(
  () => pb,
);

describe('sign-up', () => {
  test('creates the account without exposing private data', async () => {
    const account = newAccount();
    const { status, body } = await signUp(account);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.username, account.username);
    assert.equal(body.verified, false);
    const privateFields = [
      'email',
      'birthdate',
      'dateOfBirth',
      'termsAcceptedAt',
      'name',
      'password',
    ];
    for (const field of privateFields) {
      assert.equal(body[field], undefined, `${field} must not be returned`);
    }
  });

  test('sends the verification email automatically', async () => {
    const account = newAccount();
    await signUp(account);
    const link = await pb.waitForMailLink(account.email, 'confirm-verification');
    assert.match(link, /confirm-verification\/[\w.-]+$/);
  });

  test('requires accepting the terms', async () => {
    const { status, body } = await signUp(newAccount({ acceptTerms: false }));
    assert.equal(status, 400);
    assert.equal(body.data.acceptTerms.code, 'terms_required');
  });

  test('rejects people younger than 13', async () => {
    const year = new Date().getUTCFullYear() - 12;
    const { status, body } = await signUp(
      newAccount({ dateOfBirth: `${year}-01-01 00:00:00.000Z` }),
    );
    assert.equal(status, 400);
    assert.equal(body.data.dateOfBirth.code, 'too_young');
  });

  test('requires a birth date', async () => {
    const { status, body } = await signUp(newAccount({ dateOfBirth: '' }));
    assert.equal(status, 400);
    assert.equal(body.data.dateOfBirth.code, 'birthdate_required');
  });

  test('rejects invalid usernames', async () => {
    for (const username of ['Juan Pérez', 'ab', 'con-guion', 'MAYUSCULAS', 'x'.repeat(31)]) {
      const { status, body } = await signUp(newAccount({ username }));
      assert.equal(status, 400, username);
      assert.ok(body.data.username, `${username}: ${JSON.stringify(body)}`);
    }
  });

  test('usernames are unique regardless of case', async () => {
    const first = newAccount({ username: `firulais${process.pid}` });
    assert.equal((await signUp(first)).status, 200);
    const { status, body } = await signUp(newAccount({ username: `firulais${process.pid}` }));
    assert.equal(status, 400);
    assert.equal(body.data.username.code, 'validation_not_unique');
  });

  test('requires a password of at least 8 characters', async () => {
    const { status, body } = await signUp(
      newAccount({ password: 'corta', passwordConfirm: 'corta' }),
    );
    assert.equal(status, 400);
    assert.ok(body.data.password);
  });
});

describe('verification and sign-in', () => {
  test('unverified accounts cannot sign in (403, unlike a wrong password)', async () => {
    const account = newAccount();
    await signUp(account);
    const { status } = await signIn(account.email);
    assert.equal(status, 403);
  });

  test('after verifying, the account can sign in', async () => {
    const account = newAccount();
    await signUp(account);
    const confirmed = await verify(account.email);
    assert.equal(confirmed.status, 204);
    const { status, body } = await signIn(account.email);
    assert.equal(status, 200);
    assert.ok(body.token);
    assert.equal(body.record.verified, true);
    assert.equal(body.record.email, account.email, 'the owner sees their own email');
  });

  test('a wrong password is rejected', async () => {
    const { account } = await verifiedUser();
    const { status } = await signIn(account.email, 'otra-clave-123');
    assert.equal(status, 400);
  });

  test('password recovery sends a reset link', async () => {
    const { account } = await verifiedUser();
    const { status } = await pb.api(`${USERS}/request-password-reset`, {
      method: 'POST',
      body: { email: account.email },
    });
    assert.equal(status, 204);
    const link = await pb.waitForMailLink(account.email, 'confirm-password-reset');
    assert.match(link, /confirm-password-reset\/[\w.-]+$/);
  });
});

describe('profiles', () => {
  test('anyone can view a profile, without private data', async () => {
    const { record } = await verifiedUser();
    const { status, body } = await pb.api(`${USERS}/records/${record.id}`);
    assert.equal(status, 200);
    assert.equal(body.username, record.username);
    for (const field of ['email', 'birthdate', 'termsAcceptedAt']) {
      assert.equal(body[field], undefined, `${field} must not be public`);
    }
  });

  test('visitors cannot list profiles', async () => {
    await verifiedUser();
    const { status, body } = await pb.api(`${USERS}/records`);
    assert.equal(status, 200);
    assert.equal(body.items.length, 0);
  });

  test('users edit their own profile', async () => {
    const { record, token } = await verifiedUser();
    const { status, body } = await pb.api(`${USERS}/records/${record.id}`, {
      method: 'PATCH',
      token,
      body: { bio: 'Tengo dos gatos.', username: `${record.username}.mx` },
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.bio, 'Tengo dos gatos.');
    assert.equal(body.username, `${record.username}.mx`);
  });

  test('the bio is limited to 150 characters', async () => {
    const { record, token } = await verifiedUser();
    const { status } = await pb.api(`${USERS}/records/${record.id}`, {
      method: 'PATCH',
      token,
      body: { bio: 'a'.repeat(151) },
    });
    assert.equal(status, 400);
  });

  test("users cannot edit someone else's profile", async () => {
    const owner = await verifiedUser();
    const other = await verifiedUser();
    const { status } = await pb.api(`${USERS}/records/${owner.record.id}`, {
      method: 'PATCH',
      token: other.token,
      body: { bio: 'hackeado' },
    });
    assert.equal(status, 404);
  });

  test('the birth date cannot be changed after sign-up', async () => {
    const { account, record, token } = await verifiedUser();
    await pb.api(`${USERS}/records/${record.id}`, {
      method: 'PATCH',
      token,
      body: { birthdate: '2020-01-01 00:00:00.000Z' },
    });
    const { body } = await pb.api(`${USERS}/records/${record.id}`, {
      token: await superuserToken(),
    });
    assert.equal(body.birthdate, account.dateOfBirth);
    assert.ok(body.termsAcceptedAt, 'the server recorded when the terms were accepted');
  });
});

describe('account management', () => {
  test('users change their password with the current one', async () => {
    const { account, record, token } = await verifiedUser();
    const newPassword = 'otra-clave-segura-456';
    const wrong = await pb.api(`${USERS}/records/${record.id}`, {
      method: 'PATCH',
      token,
      body: { oldPassword: 'no-es-la-clave', password: newPassword, passwordConfirm: newPassword },
    });
    assert.equal(wrong.status, 400);
    const changed = await pb.api(`${USERS}/records/${record.id}`, {
      method: 'PATCH',
      token,
      body: { oldPassword: PASSWORD, password: newPassword, passwordConfirm: newPassword },
    });
    assert.equal(changed.status, 200);
    assert.equal((await signIn(account.email, newPassword)).status, 200);
    assert.equal((await signIn(account.email, PASSWORD)).status, 400);
  });

  test('users delete their own account', async () => {
    const { account, record, token } = await verifiedUser();
    const other = await verifiedUser();
    const forbidden = await pb.api(`${USERS}/records/${record.id}`, {
      method: 'DELETE',
      token: other.token,
    });
    assert.equal(forbidden.status, 404);
    const deleted = await pb.api(`${USERS}/records/${record.id}`, { method: 'DELETE', token });
    assert.equal(deleted.status, 204);
    assert.equal((await pb.api(`${USERS}/records/${record.id}`)).status, 404);
    assert.equal((await signIn(account.email)).status, 400);
  });
});
