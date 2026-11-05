// End-to-end tests of in-app notifications: which actions create them, who sees them, and
// marking them as read.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { verifiedUser } = accountHelpers(() => pb);
const POSTS = '/api/collections/posts/records';
const PAWS = '/api/collections/paws/records';
const COMMENTS = '/api/collections/comments/records';
const FOLLOWS = '/api/collections/follows/records';
const BLOCKS = '/api/collections/blocks/records';
const NOTIFICATIONS = '/api/collections/notifications/records';

async function newPost(user, text = 'Mi perrita') {
  const { body } = await pb.api(POSTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, text },
  });
  return body;
}

const create = (path, user, body) => pb.api(path, { method: 'POST', token: user.token, body });
const paw = (user, post) => create(PAWS, user, { user: user.record.id, post: post.id });
const comment = (user, post, text = '¡Qué linda!') =>
  create(COMMENTS, user, { author: user.record.id, post: post.id, text });
const follow = (user, target) =>
  create(FOLLOWS, user, { follower: user.record.id, following: target.record.id });

async function notificationsOf(user) {
  const { body } = await pb.api(`${NOTIFICATIONS}?sort=created&expand=actor`, {
    token: user.token,
  });
  return body.items.map((item) => [item.type, item.expand.actor.username, item.read]);
}

describe('notifications', () => {
  test('paw prints, comments, follows and reposts notify the author', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    await paw(luna, post);
    const { body: lunaComment } = await comment(luna, post);
    await follow(luna, sol);
    await create(POSTS, luna, { author: luna.record.id, repostOf: post.id });

    const name = luna.record.username;
    assert.deepEqual(await notificationsOf(sol), [
      ['paw', name, false],
      ['comment', name, false],
      ['follow', name, false],
      ['repost', name, false],
    ]);
    const { body } = await pb.api(
      `${NOTIFICATIONS}?filter=${encodeURIComponent("type = 'comment'")}`,
      {
        token: sol.token,
      },
    );
    assert.equal(body.items[0].post, post.id);
    assert.equal(body.items[0].comment, lunaComment.id);
  });

  test('nobody is notified about themselves, and paw prints and follows count once', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    await paw(sol, post);
    await comment(sol, post);
    const { body: first } = await paw(luna, post);
    await pb.api(`${PAWS}/${first.id}`, { method: 'DELETE', token: luna.token });
    await paw(luna, post);
    const { body: followed } = await follow(luna, sol);
    await pb.api(`${FOLLOWS}/${followed.id}`, { method: 'DELETE', token: luna.token });
    await follow(luna, sol);
    assert.deepEqual(await notificationsOf(sol), [
      ['paw', luna.record.username, false],
      ['follow', luna.record.username, false],
    ]);
  });

  test('blocked users do not notify', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    await create(BLOCKS, sol, { blocker: sol.record.id, blocked: luna.record.id });
    await paw(luna, post);
    assert.deepEqual(await notificationsOf(sol), []);
  });

  test('only the recipient sees them, and nobody creates or edits them', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    await paw(luna, post);
    assert.deepEqual(await notificationsOf(luna), []);
    const { body } = await pb.api(NOTIFICATIONS, { token: sol.token });
    const id = body.items[0].id;
    assert.equal((await pb.api(`${NOTIFICATIONS}/${id}`, { token: luna.token })).status, 404);
    const forged = await create(NOTIFICATIONS, luna, {
      recipient: sol.record.id,
      actor: luna.record.id,
      type: 'follow',
    });
    assert.equal(forged.status, 403);
    const edit = await pb.api(`${NOTIFICATIONS}/${id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { read: true },
    });
    assert.equal(edit.status, 403);
  });

  test('the recipient marks all of theirs as read', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    const lunaPost = await newPost(luna);
    await paw(luna, post);
    await paw(sol, lunaPost);

    assert.equal((await pb.api('/api/pawly/notifications/read', { method: 'POST' })).status, 401);
    const read = await pb.api('/api/pawly/notifications/read', {
      method: 'POST',
      token: sol.token,
    });
    assert.equal(read.status, 200);
    assert.deepEqual(await notificationsOf(sol), [['paw', luna.record.username, true]]);
    assert.deepEqual(await notificationsOf(luna), [['paw', sol.record.username, false]]);
  });

  test('they are deleted with the post and with the account', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const post = await newPost(sol);
    await comment(luna, post);
    await follow(rocco, sol);
    await pb.api(`${POSTS}/${post.id}`, { method: 'DELETE', token: sol.token });
    assert.deepEqual(await notificationsOf(sol), [['follow', rocco.record.username, false]]);
    await pb.api(`${USERS}/records/${rocco.record.id}`, { method: 'DELETE', token: rocco.token });
    assert.deepEqual(await notificationsOf(sol), []);
  });
});
