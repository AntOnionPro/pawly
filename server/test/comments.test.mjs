// End-to-end tests of comments: who can write, edit and delete them, their length, and the
// commentCount that only the server updates.
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
const COMMENTS = '/api/collections/comments/records';

async function newPost(user, text = 'Hola') {
  const { body } = await pb.api(POSTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, text },
  });
  return body;
}

function comment(user, postId, text = '¡Qué bonita!') {
  return pb.api(COMMENTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, post: postId, text },
  });
}

async function commentCount(postId) {
  return (await pb.api(`${POSTS}/${postId}`)).body.commentCount;
}

function edit(user, commentId, body) {
  return pb.api(`${COMMENTS}/${commentId}`, { method: 'PATCH', token: user.token, body });
}

function remove(user, commentId) {
  return pb.api(`${COMMENTS}/${commentId}`, { method: 'DELETE', token: user.token });
}

describe('writing comments', () => {
  test('a new post has no comments', async () => {
    const author = await verifiedUser();
    assert.equal((await newPost(author)).commentCount, 0);
  });

  test('users comment; the count follows and anyone reads them oldest first', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);

    const first = await comment(fan, post.id, '  ¿Cómo se llama?  ');
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.text, '¿Cómo se llama?');
    assert.equal((await comment(author, post.id, 'Se llama Luna')).status, 200);
    assert.equal(await commentCount(post.id), 2);

    const query = `filter=${encodeURIComponent(`post = "${post.id}"`)}&sort=created,id&expand=author`;
    const { status, body } = await pb.api(`${COMMENTS}?${query}`);
    assert.equal(status, 200);
    assert.deepEqual(
      body.items.map((item) => [item.expand.author.username, item.text]),
      [
        [fan.record.username, '¿Cómo se llama?'],
        [author.record.username, 'Se llama Luna'],
      ],
    );
  });

  test('a comment has 1 to 500 characters', async () => {
    const author = await verifiedUser();
    const post = await newPost(author);
    for (const text of ['', '   ', 'a'.repeat(501)]) {
      const { status, body } = await comment(author, post.id, text);
      assert.equal(status, 400, `"${text.slice(0, 10)}" (${text.length})`);
      assert.ok(body.data.text, JSON.stringify(body));
    }
    assert.equal((await comment(author, post.id, 'a'.repeat(500))).status, 200);
    assert.equal(await commentCount(post.id), 1);
  });

  test('visitors cannot comment and nobody comments for someone else', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    const visitor = await pb.api(COMMENTS, {
      method: 'POST',
      body: { author: fan.record.id, post: post.id, text: 'Hola' },
    });
    assert.equal(visitor.status, 400);
    const impostor = await pb.api(COMMENTS, {
      method: 'POST',
      token: author.token,
      body: { author: fan.record.id, post: post.id, text: 'Hola' },
    });
    assert.equal(impostor.status, 400);
    assert.equal(await commentCount(post.id), 0);
  });

  test('a comment needs an existing post', async () => {
    const author = await verifiedUser();
    const { status } = await comment(author, 'doesnotexist123');
    assert.equal(status, 400);
  });
});

describe('editing and deleting comments', () => {
  test('only the author edits a comment, and it stays on its post', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    const other = await newPost(author, 'Otra');
    const { body: created } = await comment(fan, post.id);

    const edited = await edit(fan, created.id, { text: ' ¡Qué bonita es! ' });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.text, '¡Qué bonita es!');
    assert.notEqual(edited.body.updated, created.updated);

    assert.equal((await edit(fan, created.id, { text: '  ' })).status, 400);
    assert.equal((await edit(author, created.id, { text: 'Cambiado' })).status, 404);
    assert.equal((await edit(fan, created.id, { post: other.id })).status, 404);
    assert.equal((await edit(fan, created.id, { author: author.record.id })).status, 404);

    const { body } = await pb.api(`${COMMENTS}/${created.id}`);
    assert.equal(body.text, '¡Qué bonita es!');
    assert.equal(body.post, post.id);
    assert.equal(body.author, fan.record.id);
  });

  test('the author deletes their comment; the count follows', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    const { body } = await comment(fan, post.id);
    assert.equal(await commentCount(post.id), 1);
    assert.equal((await remove(fan, body.id)).status, 204);
    assert.equal(await commentCount(post.id), 0);
  });

  test('the author of the post deletes comments on it; nobody else does', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const stranger = await verifiedUser();
    const post = await newPost(author);
    const { body: first } = await comment(fan, post.id);
    const { body: second } = await comment(fan, post.id, 'Otro');

    assert.equal((await remove(stranger, first.id)).status, 404);
    assert.equal(await commentCount(post.id), 2);
    assert.equal((await remove(author, first.id)).status, 204);
    assert.equal(await commentCount(post.id), 1);

    // On someone else's post, the author of a post is just another user.
    const strangersPost = await newPost(stranger);
    const { body: third } = await comment(fan, strangersPost.id);
    assert.equal((await remove(author, third.id)).status, 404);
    assert.equal((await pb.api(`${COMMENTS}/${second.id}`)).status, 200);
  });
});

describe('the comment count belongs to the server', () => {
  test('authors cannot set it when creating or editing a post', async () => {
    const author = await verifiedUser();
    const { body: created } = await pb.api(POSTS, {
      method: 'POST',
      token: author.token,
      body: { author: author.record.id, text: 'Trampa', commentCount: 999 },
    });
    assert.equal(created.commentCount, 0);
    await comment(author, created.id);
    const { body: edited } = await pb.api(`${POSTS}/${created.id}`, {
      method: 'PATCH',
      token: author.token,
      body: { commentCount: 500, text: 'Trampa 2' },
    });
    assert.equal(edited.commentCount, 1);
    assert.equal(edited.text, 'Trampa 2');
  });

  test("deleting a commenter's account deletes their comments from the count", async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    const { body } = await comment(fan, post.id);
    await comment(author, post.id);
    assert.equal(await commentCount(post.id), 2);
    await pb.api(`${USERS}/records/${fan.record.id}`, { method: 'DELETE', token: fan.token });
    assert.equal(await commentCount(post.id), 1);
    assert.equal((await pb.api(`${COMMENTS}/${body.id}`)).status, 404);
  });

  test('deleting a post deletes its comments', async () => {
    const author = await verifiedUser();
    const fan = await verifiedUser();
    const post = await newPost(author);
    const { body } = await comment(fan, post.id);
    await pb.api(`${POSTS}/${post.id}`, { method: 'DELETE', token: author.token });
    assert.equal((await pb.api(`${COMMENTS}/${body.id}`)).status, 404);
  });
});
