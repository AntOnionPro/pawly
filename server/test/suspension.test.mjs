// End-to-end tests of account suspension: who can suspend, signing in, open sessions, the end
// of a suspension and pushes.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;
let admin;

before(async () => {
  pb = await startPocketBase();
  admin = await superuserToken();
});

after(() => pb?.stop());

const { verifiedUser, signIn, superuserToken } = accountHelpers(() => pb);
const POSTS = '/api/collections/posts/records';
const TOKENS = '/api/collections/push_tokens/records';

const inDays = (days) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ');

function suspend(user, fields) {
  return pb.api(`${USERS}/records/${user.record.id}`, {
    method: 'PATCH',
    token: admin,
    body: fields,
  });
}

async function suspensionOf(user) {
  const { body } = await pb.api(`${USERS}/records/${user.record.id}`, {
    token: admin,
  });
  return [body.suspendedUntil, body.suspendedForever, body.suspensionReason];
}

describe('suspending', () => {
  test('only superusers suspend, and only they see it', async () => {
    const sol = await verifiedUser();
    const tried = await pb.api(`${USERS}/records/${sol.record.id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { suspendedForever: true, suspensionReason: 'yo', bio: 'Hola' },
    });
    assert.equal(tried.status, 200);
    assert.equal(tried.body.bio, 'Hola');
    assert.equal(tried.body.suspendedForever, undefined);
    assert.deepEqual(await suspensionOf(sol), ['', false, '']);

    const until = inDays(3);
    assert.equal(
      (await suspend(sol, { suspendedUntil: until, suspensionReason: 'Spam' })).status,
      200,
    );
    const [savedUntil, forever, reason] = await suspensionOf(sol);
    assert.equal(
      new Date(savedUntil.replace(' ', 'T')).getTime(),
      new Date(until.replace(' ', 'T')).getTime(),
    );
    assert.deepEqual([forever, reason], [false, 'Spam']);
    const { body: profile } = await pb.api(`${USERS}/records/${sol.record.id}`);
    assert.equal(profile.suspendedUntil, undefined);
  });
});

describe('a suspended account', () => {
  test('cannot sign in, and learns until when and why', async () => {
    const sol = await verifiedUser();
    const until = inDays(3);
    await suspend(sol, {
      suspendedUntil: until,
      suspensionReason: 'Spam repetido',
    });
    const { status, body } = await signIn(sol.account.email);
    assert.equal(status, 403);
    assert.equal(body.data.account.code, 'account_suspended');
    assert.equal(body.token, undefined);
    assert.equal(body.suspension.forever, false);
    assert.equal(body.suspension.reason, 'Spam repetido');
    assert.equal(
      new Date(body.suspension.until.replace(' ', 'T')).getTime(),
      new Date(until.replace(' ', 'T')).getTime(),
    );

    // A wrong password says nothing about the suspension.
    const wrong = await signIn(sol.account.email, 'otra-clave-123');
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.suspension, undefined);
  });

  test('loses its open session on the next request, also when renewing it', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    await suspend(sol, {
      suspendedForever: true,
      suspensionReason: 'Maltrato animal',
    });

    const posting = await pb.api(POSTS, {
      method: 'POST',
      token: sol.token,
      body: { author: sol.record.id, text: 'Hola' },
    });
    assert.equal(posting.status, 403);
    assert.equal(posting.body.data.account.code, 'account_suspended');
    assert.deepEqual(posting.body.suspension, {
      until: '',
      forever: true,
      reason: 'Maltrato animal',
    });
    const reading = await pb.api('/api/collections/notifications/records', {
      token: sol.token,
    });
    assert.equal(reading.status, 403);
    const refresh = await pb.api(`${USERS}/auth-refresh`, {
      method: 'POST',
      token: sol.token,
    });
    assert.equal(refresh.status, 403);
    assert.equal(refresh.body.data.account.code, 'account_suspended');

    // Everyone else is not affected, and the profile is still public.
    const other = await pb.api(POSTS, {
      method: 'POST',
      token: luna.token,
      body: { author: luna.record.id, text: 'Hola' },
    });
    assert.equal(other.status, 200);
    assert.equal((await pb.api(`${USERS}/records/${sol.record.id}`)).status, 200);
  });

  test('works again when the date passes or the suspension is lifted', async () => {
    const sol = await verifiedUser();
    await suspend(sol, {
      suspendedUntil: inDays(-1),
      suspensionReason: 'Spam',
    });
    assert.equal((await signIn(sol.account.email)).status, 200);

    const luna = await verifiedUser();
    await suspend(luna, { suspendedForever: true });
    assert.equal((await signIn(luna.account.email)).status, 403);
    await suspend(luna, { suspendedForever: false, suspensionReason: '' });
    const back = await signIn(luna.account.email);
    assert.equal(back.status, 200);
    const posting = await pb.api(POSTS, {
      method: 'POST',
      token: back.body.token,
      body: { author: luna.record.id, text: 'Volví' },
    });
    assert.equal(posting.status, 200);
  });

  test('gets no pushes: its phones are forgotten', async () => {
    const sol = await verifiedUser();
    const saved = await pb.api(TOKENS, {
      method: 'POST',
      token: sol.token,
      body: {
        user: sol.record.id,
        token: `ExponentPushToken[sol-${Date.now()}]`,
        language: 'es',
      },
    });
    assert.equal(saved.status, 200);
    await suspend(sol, { suspendedUntil: inDays(7) });
    const filter = encodeURIComponent(`user = "${sol.record.id}"`);
    const { body } = await pb.api(`${TOKENS}?filter=${filter}`, {
      token: admin,
    });
    assert.equal(body.items.length, 0);
  });
});
