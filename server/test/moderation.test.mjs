// End-to-end tests of reports and blocks.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { verifiedUser, superuserToken } = accountHelpers(() => pb);
const POSTS = '/api/collections/posts/records';
const COMMENTS = '/api/collections/comments/records';
const REPORTS = '/api/collections/reports/records';
const BLOCKS = '/api/collections/blocks/records';
const FOLLOWS = '/api/collections/follows/records';

async function newPost(user, text = 'Hola') {
  const { body } = await pb.api(POSTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, text },
  });
  return body;
}

function report(user, target, reason = 'spam', details = '') {
  return pb.api(REPORTS, {
    method: 'POST',
    token: user.token,
    body: { reporter: user.record.id, reason, details, ...target },
  });
}

function block(user, target) {
  return pb.api(BLOCKS, {
    method: 'POST',
    token: user.token,
    body: { blocker: user.record.id, blocked: target.record.id },
  });
}

function follow(user, target) {
  return pb.api(FOLLOWS, {
    method: 'POST',
    token: user.token,
    body: { follower: user.record.id, following: target.record.id },
  });
}

function comment(user, postId, text = 'Hola') {
  return pb.api(COMMENTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, post: postId, text },
  });
}

async function reportsBy(user) {
  const filter = encodeURIComponent(`reporter = "${user.record.id}"`);
  const { body } = await pb.api(`${REPORTS}?filter=${filter}`, { token: await superuserToken() });
  return body.items;
}

async function counts(user) {
  const { body } = await pb.api(`${USERS}/records/${user.record.id}`);
  return [body.followerCount, body.followingCount];
}

describe('reports', () => {
  test('users report a post, a comment or a user; only superusers see reports', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    const { body: solComment } = await comment(sol, post.id);

    for (const [target, reason] of [
      [{ post: post.id }, 'animal_sale'],
      [{ comment: solComment.id }, 'offensive'],
      [{ user: sol.record.id }, 'other'],
    ]) {
      const { status, body } = await report(luna, target, reason, 'Detalle');
      assert.ok([200, 204].includes(status), `${status} ${JSON.stringify(body)}`);
    }
    const stored = await reportsBy(luna);
    assert.deepEqual(stored.map((item) => item.reason).sort(), [
      'animal_sale',
      'offensive',
      'other',
    ]);
    assert.ok(stored.every((item) => item.details === 'Detalle'));

    const list = await pb.api(REPORTS, { token: luna.token });
    assert.equal(list.status, 403);
    const view = await pb.api(`${REPORTS}/${stored[0].id}`, { token: luna.token });
    assert.equal(view.status, 403);
  });

  test('the same thing cannot be reported twice by the same user', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const post = await newPost(sol);
    assert.ok([200, 204].includes((await report(luna, { post: post.id })).status));
    const again = await report(luna, { post: post.id }, 'offensive');
    assert.equal(again.status, 400);
    assert.equal(again.body.data.post.code, 'validation_not_unique');
    // Someone else can report it too.
    assert.ok([200, 204].includes((await report(rocco, { post: post.id })).status));
  });

  test('a report has one target, a valid reason, and is not about yourself', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    assert.equal((await report(luna, {})).body.data.post.code, 'report_target');
    const two = await report(luna, { post: post.id, user: sol.record.id });
    assert.equal(two.body.data.post.code, 'report_target');
    assert.equal((await report(luna, { post: post.id }, 'aburrido')).status, 400);
    const own = await report(sol, { post: post.id });
    assert.equal(own.body.data.post.code, 'report_own');
    const self = await report(sol, { user: sol.record.id });
    assert.equal(self.body.data.user.code, 'report_own');
    assert.deepEqual(await reportsBy(luna), []);
  });

  test('visitors cannot report and nobody reports for someone else', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    const visitor = await pb.api(REPORTS, {
      method: 'POST',
      body: { reporter: luna.record.id, post: post.id, reason: 'spam' },
    });
    assert.equal(visitor.status, 400);
    const impostor = await pb.api(REPORTS, {
      method: 'POST',
      token: sol.token,
      body: { reporter: luna.record.id, user: sol.record.id, reason: 'spam' },
    });
    assert.equal(impostor.status, 400);
    assert.deepEqual(await reportsBy(luna), []);
  });
});

describe('blocks', () => {
  test('blocking removes the follows between both users', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    await follow(luna, sol);
    await follow(sol, luna);
    assert.deepEqual(await counts(sol), [1, 1]);

    const blocked = await block(sol, luna);
    assert.equal(blocked.status, 200, JSON.stringify(blocked.body));
    assert.deepEqual(await counts(sol), [0, 0]);
    assert.deepEqual(await counts(luna), [0, 0]);
  });

  test('nobody follows across a block, in either direction, until unblocked', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body } = await block(sol, luna);
    const lunaFollows = await follow(luna, sol);
    assert.equal(lunaFollows.status, 400);
    assert.equal(lunaFollows.body.data.following.code, 'blocked');
    assert.equal((await follow(sol, luna)).status, 400);

    const unblocked = await pb.api(`${BLOCKS}/${body.id}`, { method: 'DELETE', token: sol.token });
    assert.equal(unblocked.status, 204);
    assert.equal((await follow(luna, sol)).status, 200);
  });

  test("a blocked user cannot comment on the blocker's posts", async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const solPost = await newPost(sol);
    const roccoPost = await newPost(rocco);
    await block(sol, luna);

    const denied = await comment(luna, solPost.id);
    assert.equal(denied.status, 400);
    assert.equal(denied.body.data.post.code, 'blocked');
    assert.equal((await comment(luna, roccoPost.id)).status, 200);
    assert.equal((await comment(rocco, solPost.id)).status, 200);
  });

  test('only the blocker sees and removes their blocks; no self or repeated blocks', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body } = await block(sol, luna);
    const filter = encodeURIComponent(`blocker = "${sol.record.id}"`);
    const mine = await pb.api(`${BLOCKS}?filter=${filter}&expand=blocked`, { token: sol.token });
    assert.deepEqual(
      mine.body.items.map((item) => item.expand.blocked.username),
      [luna.record.username],
    );
    const theirs = await pb.api(BLOCKS, { token: luna.token });
    assert.deepEqual(theirs.body.items, []);
    const removed = await pb.api(`${BLOCKS}/${body.id}`, { method: 'DELETE', token: luna.token });
    assert.equal(removed.status, 404);

    assert.equal((await block(sol, luna)).status, 400);
    assert.equal((await block(sol, sol)).status, 400);
    const impostor = await pb.api(BLOCKS, {
      method: 'POST',
      token: sol.token,
      body: { blocker: luna.record.id, blocked: sol.record.id },
    });
    assert.equal(impostor.status, 400);
  });

  test('deleting an account removes its blocks', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body } = await block(sol, luna);
    await pb.api(`${USERS}/records/${luna.record.id}`, { method: 'DELETE', token: luna.token });
    const { status } = await pb.api(`${BLOCKS}/${body.id}`, { token: sol.token });
    assert.equal(status, 404);
  });
});
