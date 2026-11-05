// End-to-end tests of paw prints: one per user and post, who can add and remove them,
// and the pawCount that only the server updates.
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

async function newPost(user, text = 'Hola') {
  const { body } = await pb.api(POSTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, text },
  });
  return body;
}

function paw(user, postId) {
  return pb.api(PAWS, {
    method: 'POST',
    token: user.token,
    body: { user: user.record.id, post: postId },
  });
}

async function pawCount(postId) {
  return (await pb.api(`${POSTS}/${postId}`)).body.pawCount;
}

describe('paw prints', () => {
  test('a new post has no paw prints', async () => {
    const author = await verifiedUser();
    const post = await newPost(author);
    assert.equal(post.pawCount, 0);
  });

  test('users add and remove their paw print; the count follows', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);

    const added = await paw(fan, post.id);
    assert.equal(added.status, 200, JSON.stringify(added.body));
    assert.equal(await pawCount(post.id), 1);

    assert.equal((await paw(author, post.id)).status, 200);
    assert.equal(await pawCount(post.id), 2);

    const removed = await pb.api(`${PAWS}/${added.body.id}`, {
      method: 'DELETE',
      token: fan.token,
    });
    assert.equal(removed.status, 204);
    assert.equal(await pawCount(post.id), 1);
  });

  test('only one paw print per user and post', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    assert.equal((await paw(fan, post.id)).status, 200);
    const again = await paw(fan, post.id);
    assert.equal(again.status, 400);
    assert.equal(await pawCount(post.id), 1);
  });

  test('visitors cannot add paw prints and nobody adds them for someone else', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    const visitor = await pb.api(PAWS, {
      method: 'POST',
      body: { user: fan.record.id, post: post.id },
    });
    assert.equal(visitor.status, 400);
    const impostor = await pb.api(PAWS, {
      method: 'POST',
      token: author.token,
      body: { user: fan.record.id, post: post.id },
    });
    assert.equal(impostor.status, 400);
    assert.equal(await pawCount(post.id), 0);
  });

  test("nobody removes someone else's paw print", async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    const { body } = await paw(fan, post.id);
    const byAuthor = await pb.api(`${PAWS}/${body.id}`, { method: 'DELETE', token: author.token });
    assert.equal(byAuthor.status, 404);
    assert.equal(await pawCount(post.id), 1);
  });

  test('anyone sees who left a paw print on a post', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    await paw(fan, post.id);
    const filter = encodeURIComponent(`post = "${post.id}"`);
    const { status, body } = await pb.api(`${PAWS}?filter=${filter}`);
    assert.equal(status, 200);
    assert.deepEqual(
      body.items.map((item) => item.user),
      [fan.record.id],
    );
  });
});

describe('the count belongs to the server', () => {
  test('authors cannot set the count when creating or editing a post', async () => {
    const author = await verifiedUser();
    const { body: created } = await pb.api(POSTS, {
      method: 'POST',
      token: author.token,
      body: { author: author.record.id, text: 'Trampa', pawCount: 999 },
    });
    assert.equal(created.pawCount, 0);
    const { body: edited } = await pb.api(`${POSTS}/${created.id}`, {
      method: 'PATCH',
      token: author.token,
      body: { pawCount: 500, text: 'Trampa 2' },
    });
    assert.equal(edited.pawCount, 0);
    assert.equal(edited.text, 'Trampa 2');
  });

  test("deleting a fan's account removes their paw print from the count", async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    await paw(fan, post.id);
    assert.equal(await pawCount(post.id), 1);
    await pb.api(`${USERS}/records/${fan.record.id}`, { method: 'DELETE', token: fan.token });
    assert.equal(await pawCount(post.id), 0);
  });

  test('deleting a post deletes its paw prints', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    const { body } = await paw(fan, post.id);
    await pb.api(`${POSTS}/${post.id}`, { method: 'DELETE', token: author.token });
    assert.equal((await pb.api(`${PAWS}/${body.id}`)).status, 404);
  });
});
