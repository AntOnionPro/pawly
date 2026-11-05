// End-to-end tests of follows: who can follow whom, the follower counts that only the
// server updates, and the "Following" feed filter.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { newAccount, signUp, verifiedUser } = accountHelpers(() => pb);
const FOLLOWS = '/api/collections/follows/records';
const POSTS = '/api/collections/posts/records';

function follow(user, target) {
  return pb.api(FOLLOWS, {
    method: 'POST',
    token: user.token,
    body: { follower: user.record.id, following: target.record.id },
  });
}

async function counts(user) {
  const { body } = await pb.api(`${USERS}/records/${user.record.id}`);
  return [body.followerCount, body.followingCount];
}

describe('following users', () => {
  test('a new account has no followers and follows nobody', async () => {
    const user = await verifiedUser();
    assert.deepEqual(await counts(user), [0, 0]);
  });

  test('users follow and unfollow; both counts follow', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();

    const followed = await follow(luna, sol);
    assert.equal(followed.status, 200, JSON.stringify(followed.body));
    assert.equal((await follow(rocco, sol)).status, 200);
    assert.equal((await follow(luna, rocco)).status, 200);
    assert.deepEqual(await counts(sol), [2, 0]);
    assert.deepEqual(await counts(luna), [0, 2]);
    assert.deepEqual(await counts(rocco), [1, 1]);

    const removed = await pb.api(`${FOLLOWS}/${followed.body.id}`, {
      method: 'DELETE',
      token: luna.token,
    });
    assert.equal(removed.status, 204);
    assert.deepEqual(await counts(sol), [1, 0]);
    assert.deepEqual(await counts(luna), [0, 1]);
  });

  test('one follow per pair, and nobody follows themselves', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    assert.equal((await follow(luna, sol)).status, 200);
    assert.equal((await follow(luna, sol)).status, 400);
    assert.equal((await follow(sol, sol)).status, 400);
    assert.deepEqual(await counts(sol), [1, 0]);
  });

  test('visitors cannot follow and nobody follows for someone else', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const visitor = await pb.api(FOLLOWS, {
      method: 'POST',
      body: { follower: luna.record.id, following: sol.record.id },
    });
    assert.equal(visitor.status, 400);
    const impostor = await pb.api(FOLLOWS, {
      method: 'POST',
      token: sol.token,
      body: { follower: luna.record.id, following: sol.record.id },
    });
    assert.equal(impostor.status, 400);
    assert.deepEqual(await counts(sol), [0, 0]);
  });

  test('only the follower removes their follow', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body } = await follow(luna, sol);
    const bySol = await pb.api(`${FOLLOWS}/${body.id}`, { method: 'DELETE', token: sol.token });
    assert.equal(bySol.status, 404);
    assert.deepEqual(await counts(sol), [1, 0]);
  });

  test('anyone sees the followers of a user, with their usernames', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    await follow(luna, sol);
    const filter = encodeURIComponent(`following = "${sol.record.id}"`);
    const { status, body } = await pb.api(`${FOLLOWS}?filter=${filter}&expand=follower`);
    assert.equal(status, 200);
    assert.deepEqual(
      body.items.map((item) => item.expand.follower.username),
      [luna.record.username],
    );
    assert.equal(body.items[0].expand.follower.email, undefined);
  });
});

describe('the follower counts belong to the server', () => {
  test('users cannot set them when signing up or editing their profile', async () => {
    const account = newAccount({ followerCount: 500, followingCount: 7 });
    const { status, body } = await signUp(account);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.followerCount, 0);
    assert.equal(body.followingCount, 0);

    const user = await verifiedUser();
    const edited = await pb.api(`${USERS}/records/${user.record.id}`, {
      method: 'PATCH',
      token: user.token,
      body: { followerCount: 999, bio: 'Hola' },
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.followerCount, 0);
    assert.equal(edited.body.bio, 'Hola');
  });

  test('deleting an account removes its follows from both sides', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    await follow(luna, sol);
    await follow(sol, luna);
    await follow(rocco, luna);
    await pb.api(`${USERS}/records/${luna.record.id}`, { method: 'DELETE', token: luna.token });
    assert.deepEqual(await counts(sol), [0, 0]);
    assert.deepEqual(await counts(rocco), [0, 0]);
  });
});

describe('the Following feed', () => {
  test('lists only posts by the people a user follows', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    for (const [user, text] of [
      [sol, 'De Sol'],
      [rocco, 'De Rocco'],
      [luna, 'De Luna'],
    ]) {
      await pb.api(POSTS, {
        method: 'POST',
        token: user.token,
        body: { author: user.record.id, text },
      });
    }
    await follow(luna, sol);

    const filter = encodeURIComponent(
      `author.follows_via_following.follower ?= "${luna.record.id}"`,
    );
    const { status, body } = await pb.api(`${POSTS}?filter=${filter}&sort=-created`, {
      token: luna.token,
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.deepEqual(
      body.items.map((item) => item.text),
      ['De Sol'],
    );
  });
});
