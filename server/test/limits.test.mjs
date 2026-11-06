// Tests of the limits against spam: per account (with PAWLY_LIMITS on, unlike the other test
// files) and per connection (PocketBase's rate limiter). The connection test goes last, since
// it uses up this address's sign-ins for a minute.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

const require = createRequire(import.meta.url);
const { LIMITS, limitFor } = require('../pb_hooks/lib/limits.js');

let pb;

before(async () => {
  pb = await startPocketBase({ env: { PAWLY_LIMITS: 'on' } });
});

after(() => pb?.stop());

const { verifiedUser, superuserToken } = accountHelpers(() => pb);
const POSTS = '/api/collections/posts/records';
const COMMENTS = '/api/collections/comments/records';
const CONVERSATIONS = '/api/collections/conversations/records';

function post(user, text) {
  return pb.api(POSTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, text },
  });
}

function comment(user, postId, text) {
  return pb.api(COMMENTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, post: postId, text },
  });
}

function assertLimited(response) {
  assert.equal(response.status, 429, JSON.stringify(response.body));
  assert.equal(response.body.data.limit.code, 'rate_limited');
}

describe('limits per account', () => {
  test('new accounts get half of each limit', () => {
    assert.equal(limitFor(10, true), 5);
    assert.equal(limitFor(5, true), 3);
    assert.equal(limitFor(10, false), 10);
    assert.deepEqual(LIMITS.posts.windows[0], [10, 60 * 60 * 1000]);
  });

  test('stop an account that publishes too much, and only that account', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const allowed = limitFor(LIMITS.posts.windows[0][0], true);
    for (let i = 1; i <= allowed; i += 1) {
      assert.equal((await post(sol, `Publicación ${i}`)).status, 200);
    }
    assertLimited(await post(sol, 'Una más'));
    assert.equal((await post(luna, 'Hola')).status, 200);

    // Superusers have no limits.
    const admin = await superuserToken();
    const byAdmin = await pb.api(POSTS, {
      method: 'POST',
      token: admin,
      body: { author: sol.record.id, text: 'Desde el panel' },
    });
    assert.equal(byAdmin.status, 200);
  });

  test('reject the same long comment sent again and again', async () => {
    const sol = await verifiedUser();
    const { body: target } = await post(sol, 'Mi perrita');
    const spam = 'Visita mi página para ganar dinero rápido';
    for (let i = 0; i < 3; i += 1) {
      assert.equal((await comment(sol, target.id, spam)).status, 200);
    }
    assertLimited(await comment(sol, target.id, spam));
    // Other texts, and short ones repeated, still go through.
    assert.equal((await comment(sol, target.id, 'Otra cosa que decir sobre ella')).status, 200);
    for (let i = 0; i < 4; i += 1) {
      assert.equal((await comment(sol, target.id, '¡Qué linda!')).status, 200);
    }
  });

  test('conversations remember who started them', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const [a, b] = [sol.record.id, luna.record.id].sort();
    const { status, body } = await pb.api(CONVERSATIONS, {
      method: 'POST',
      token: luna.token,
      body: { userA: a, userB: b, startedBy: sol.record.id },
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.startedBy, luna.record.id);
    const updated = await pb.api(`${CONVERSATIONS}/${body.id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { startedBy: sol.record.id },
    });
    assert.equal(updated.body.startedBy, luna.record.id);
  });
});

describe('limits per connection', () => {
  test('stop too many sign-ins from one address', async () => {
    const { status, body } = await pb.api('/api/settings', { token: await superuserToken() });
    assert.equal(status, 200);
    assert.equal(body.rateLimits.enabled, true);
    assert.deepEqual(body.trustedProxy.headers, ['CF-Connecting-IP']);

    let refused = null;
    for (let i = 0; i < 25 && !refused; i += 1) {
      const attempt = await pb.api(`${USERS}/auth-with-password`, {
        method: 'POST',
        body: { identity: 'nadie@pawly.test', password: 'una-clave-cualquiera' },
      });
      if (attempt.status === 429) refused = i;
      else assert.equal(attempt.status, 400);
    }
    assert.notEqual(refused, null);
  });
});
