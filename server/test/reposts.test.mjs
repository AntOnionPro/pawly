// End-to-end tests of reposts: a post that points to an original one, with an optional
// comment, and the repostCount that only the server updates.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers } from './helpers/accounts.mjs';
import { png } from './helpers/files.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { verifiedUser } = accountHelpers(() => pb);
const POSTS = '/api/collections/posts/records';
const PETS = '/api/collections/pets/records';

async function newPost(user, text = 'Mi perrita') {
  const { body } = await pb.api(POSTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, text },
  });
  return body;
}

function repost(user, postId, text = '') {
  return pb.api(POSTS, {
    method: 'POST',
    token: user.token,
    body: { author: user.record.id, repostOf: postId, text },
  });
}

async function repostCount(postId) {
  return (await pb.api(`${POSTS}/${postId}`)).body.repostCount;
}

describe('reposting', () => {
  test('users repost with or without a comment; the count follows', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const original = await newPost(sol);
    assert.equal(original.repostCount, 0);

    const plain = await repost(luna, original.id);
    assert.equal(plain.status, 200, JSON.stringify(plain.body));
    assert.equal(plain.body.repostOf, original.id);
    assert.equal(plain.body.text, '');
    const commented = await repost(rocco, original.id, '¡Ayuden a compartir!');
    assert.equal(commented.status, 200, JSON.stringify(commented.body));
    assert.equal(await repostCount(original.id), 2);

    const { body } = await pb.api(
      `${POSTS}/${commented.body.id}?expand=author,repostOf,repostOf.author`,
    );
    assert.equal(body.text, '¡Ayuden a compartir!');
    assert.equal(body.expand.repostOf.text, 'Mi perrita');
    assert.equal(body.expand.repostOf.expand.author.username, sol.record.username);
  });

  test('reposting a repost reposts the original', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const original = await newPost(sol);
    const { body: first } = await repost(luna, original.id);
    const { status, body } = await repost(rocco, first.id);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.repostOf, original.id);
    assert.equal(await repostCount(original.id), 2);
    assert.equal(await repostCount(first.id), 0);
  });

  test('each user reposts a post only once', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const original = await newPost(sol);
    assert.equal((await repost(luna, original.id)).status, 200);
    const again = await repost(luna, original.id, 'Otra vez');
    assert.equal(again.status, 400);
    assert.ok(again.body.data.repostOf, JSON.stringify(again.body));
    assert.equal(await repostCount(original.id), 1);
    // Plain posts are not affected by the rule.
    assert.ok(await newPost(luna, 'Uno'));
    assert.equal(
      (
        await pb.api(POSTS, {
          method: 'POST',
          token: luna.token,
          body: { author: luna.record.id, text: 'Dos' },
        })
      ).status,
      200,
    );
  });

  test('a repost has no files or pets', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const original = await newPost(sol);
    const { body: pet } = await pb.api(PETS, {
      method: 'POST',
      token: luna.token,
      body: { owner: luna.record.id, name: 'Michi', species: 'cat' },
    });
    const withPet = await pb.api(POSTS, {
      method: 'POST',
      token: luna.token,
      body: { author: luna.record.id, repostOf: original.id, pets: [pet.id] },
    });
    assert.equal(withPet.status, 400);
    assert.equal(withPet.body.data.pets.code, 'repost_pets');

    const form = new FormData();
    form.append('author', luna.record.id);
    form.append('repostOf', original.id);
    form.append('media', new Blob([png()], { type: 'image/png' }), 'foto.png');
    const response = await fetch(`${pb.baseUrl}${POSTS}`, {
      method: 'POST',
      headers: { Authorization: luna.token },
      body: form,
    });
    const withPhoto = await response.json();
    assert.equal(response.status, 400);
    assert.equal(withPhoto.data.media.code, 'repost_media');
    assert.equal(await repostCount(original.id), 0);
  });

  test('a repost needs an existing post', async () => {
    const luna = await verifiedUser();
    assert.equal((await repost(luna, 'doesnotexist123')).status, 400);
  });

  test('visitors cannot repost and nobody reposts for someone else', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const original = await newPost(sol);
    const visitor = await pb.api(POSTS, {
      method: 'POST',
      body: { author: luna.record.id, repostOf: original.id },
    });
    assert.equal(visitor.status, 400);
    const impostor = await pb.api(POSTS, {
      method: 'POST',
      token: sol.token,
      body: { author: luna.record.id, repostOf: original.id },
    });
    assert.equal(impostor.status, 400);
    assert.equal(await repostCount(original.id), 0);
  });
});

describe('editing and deleting reposts', () => {
  test('the comment can change, but the repost keeps pointing to the same post', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const original = await newPost(sol);
    const other = await newPost(sol, 'Otra');
    const { body: created } = await repost(luna, original.id, 'Hola');
    const edited = await pb.api(`${POSTS}/${created.id}`, {
      method: 'PATCH',
      token: luna.token,
      body: { text: '', repostOf: other.id },
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.text, '');
    assert.equal(edited.body.repostOf, original.id);
    assert.equal(await repostCount(other.id), 0);

    // A plain post cannot become a repost either.
    const plain = await newPost(luna, 'Normal');
    const turned = await pb.api(`${POSTS}/${plain.id}`, {
      method: 'PATCH',
      token: luna.token,
      body: { repostOf: original.id },
    });
    assert.equal(turned.status, 200);
    assert.equal(turned.body.repostOf, '');
  });

  test('deleting a repost undoes it; deleting the original deletes its reposts', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const original = await newPost(sol);
    const { body: first } = await repost(luna, original.id);
    const { body: second } = await repost(rocco, original.id);

    const undone = await pb.api(`${POSTS}/${first.id}`, { method: 'DELETE', token: luna.token });
    assert.equal(undone.status, 204);
    assert.equal(await repostCount(original.id), 1);
    assert.equal((await repost(luna, original.id)).status, 200);

    await pb.api(`${POSTS}/${original.id}`, { method: 'DELETE', token: sol.token });
    assert.equal((await pb.api(`${POSTS}/${second.id}`)).status, 404);
  });

  test('authors cannot set the repost count', async () => {
    const sol = await verifiedUser();
    const { body: created } = await pb.api(POSTS, {
      method: 'POST',
      token: sol.token,
      body: { author: sol.record.id, text: 'Trampa', repostCount: 50 },
    });
    assert.equal(created.repostCount, 0);
    const { body: edited } = await pb.api(`${POSTS}/${created.id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { repostCount: 9 },
    });
    assert.equal(edited.repostCount, 0);
  });
});
