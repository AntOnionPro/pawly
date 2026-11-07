// End-to-end tests of posts: creating them with text, photos, videos and pets, limits,
// who can see, edit and delete them, and what happens when accounts or pets are deleted.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { png, video } from './helpers/files.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { verifiedUser } = accountHelpers(() => pb);
const POSTS = '/api/collections/posts/records';
const PETS = '/api/collections/pets/records';
const MB = 1024 * 1024;

/** Sends a multipart request with fields and files ({ name, bytes, type }). */
async function upload(method, urlPath, token, fields = {}, files = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of [].concat(value)) form.append(key, item);
  }
  for (const file of files) {
    form.append('media', new Blob([file.bytes], { type: file.type }), file.name);
  }
  const response = await fetch(`${pb.baseUrl}${urlPath}`, {
    method,
    headers: token ? { Authorization: token } : {},
    body: form,
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function createPost(token, body) {
  return pb.api(POSTS, { method: 'POST', token, body });
}

async function createPet(user, name = 'Luna') {
  const { body } = await pb.api(PETS, {
    method: 'POST',
    token: user.token,
    body: { owner: user.record.id, name, species: 'dog' },
  });
  return body;
}

const photo = (name = 'foto.png', bytes = png()) => ({ name, bytes, type: 'image/png' });
const clip = (name = 'clip.mp4', bytes = video()) => ({ name, bytes, type: 'video/mp4' });

describe('creating posts', () => {
  test('a post can be only text', async () => {
    const { record, token } = await verifiedUser();
    const { status, body } = await createPost(token, { author: record.id, text: 'Hola Pawly' });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.text, 'Hola Pawly');
    assert.deepEqual(body.media, []);
    assert.ok(body.created);
  });

  test('a post can have photos and videos, with thumbnails for photos', async () => {
    const { record, token } = await verifiedUser();
    const { status, body } = await upload('POST', POSTS, token, { author: record.id }, [
      photo(),
      clip(),
      { name: 'clip.mov', bytes: video(2048, 'qt  '), type: 'video/quicktime' },
    ]);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.media.length, 3);
    const thumb = await fetch(
      `${pb.baseUrl}/api/files/posts/${body.id}/${body.media[0]}?thumb=300x300`,
    );
    assert.equal(thumb.status, 200);
    assert.match(thumb.headers.get('content-type'), /^image\//);
  });

  test('a post needs text or a file', async () => {
    const { record, token } = await verifiedUser();
    const { status, body } = await createPost(token, { author: record.id, text: '   ' });
    assert.equal(status, 400);
    assert.equal(body.data.text.code, 'post_empty');
  });

  test('visitors cannot post, and nobody posts as someone else', async () => {
    const victim = await verifiedUser();
    const other = await verifiedUser();
    assert.equal(
      (await createPost(undefined, { author: victim.record.id, text: 'x' })).status,
      400,
    );
    assert.equal(
      (await createPost(other.token, { author: victim.record.id, text: 'x' })).status,
      400,
    );
  });

  test('the text is limited to 2,200 characters', async () => {
    const { record, token } = await verifiedUser();
    assert.equal(
      (await createPost(token, { author: record.id, text: 'a'.repeat(2200) })).status,
      200,
    );
    const { status, body } = await createPost(token, { author: record.id, text: 'a'.repeat(2201) });
    assert.equal(status, 400);
    assert.ok(body.data.text);
  });

  test('photos up to 10 MB and videos up to 50 MB', async () => {
    const { record, token } = await verifiedUser();
    const bigPhoto = await upload('POST', POSTS, token, { author: record.id }, [
      photo('grande.png', png(8, 11 * MB)),
    ]);
    assert.equal(bigPhoto.status, 400);
    assert.equal(bigPhoto.body.data.media.code, 'photo_too_large');

    const okVideo = await upload('POST', POSTS, token, { author: record.id }, [
      clip('largo.mp4', video(40 * MB)),
    ]);
    assert.equal(okVideo.status, 200, JSON.stringify(okVideo.body));

    const hugeVideo = await upload('POST', POSTS, token, { author: record.id }, [
      clip('enorme.mp4', video(51 * MB)),
    ]);
    assert.ok(hugeVideo.status >= 400 && hugeVideo.status < 500, String(hugeVideo.status));
  });

  test('at most 10 files, and only photos and videos', async () => {
    const { record, token } = await verifiedUser();
    const eleven = Array.from({ length: 11 }, (_, i) => photo(`f${i}.png`));
    const tooMany = await upload('POST', POSTS, token, { author: record.id }, eleven);
    assert.equal(tooMany.status, 400);
    assert.ok(tooMany.body.data.media);

    const textFile = await upload('POST', POSTS, token, { author: record.id }, [
      { name: 'notas.txt', bytes: Buffer.from('hola'), type: 'text/plain' },
    ]);
    assert.equal(textFile.status, 400);
    assert.ok(textFile.body.data.media);
  });

  test('only your own pets can be tagged', async () => {
    const owner = await verifiedUser();
    const other = await verifiedUser();
    const mine = await createPet(owner, 'Mía');
    const theirs = await createPet(other, 'Ajena');
    const ok = await createPost(owner.token, {
      author: owner.record.id,
      text: 'Con mi mascota',
      pets: [mine.id],
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual(ok.body.pets, [mine.id]);

    const bad = await createPost(owner.token, {
      author: owner.record.id,
      text: 'Con una ajena',
      pets: [mine.id, theirs.id],
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.data.pets.code, 'pet_not_owned');
  });
});

describe('seeing posts', () => {
  test('anyone lists posts, newest first, by author or by pet', async () => {
    const user = await verifiedUser();
    const pet = await createPet(user);
    await createPost(user.token, { author: user.record.id, text: 'primera' });
    await createPost(user.token, { author: user.record.id, text: 'segunda', pets: [pet.id] });

    const byAuthor = encodeURIComponent(`author = "${user.record.id}"`);
    const { status, body } = await pb.api(`${POSTS}?filter=${byAuthor}&sort=-created,-id`);
    assert.equal(status, 200);
    assert.deepEqual(
      body.items.map((post) => post.text),
      ['segunda', 'primera'],
    );

    const byPet = encodeURIComponent(`pets ~ "${pet.id}"`);
    const tagged = await pb.api(`${POSTS}?filter=${byPet}&expand=author,pets`);
    assert.deepEqual(
      tagged.body.items.map((post) => post.text),
      ['segunda'],
    );
    assert.equal(tagged.body.items[0].expand.author.username, user.record.username);
    assert.equal(tagged.body.items[0].expand.author.email, undefined);
    assert.equal(tagged.body.items[0].expand.pets[0].name, 'Luna');
  });
});

describe('editing and deleting posts', () => {
  test('the author edits the text; others cannot, and the author cannot be changed', async () => {
    const author = await verifiedUser();
    const other = await verifiedUser();
    const { body: post } = await createPost(author.token, { author: author.record.id, text: 'v1' });

    const edited = await pb.api(`${POSTS}/${post.id}`, {
      method: 'PATCH',
      token: author.token,
      body: { text: 'v2' },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.text, 'v2');

    const byOther = await pb.api(`${POSTS}/${post.id}`, {
      method: 'PATCH',
      token: other.token,
      body: { text: 'hack' },
    });
    assert.equal(byOther.status, 404);

    const reassigned = await pb.api(`${POSTS}/${post.id}`, {
      method: 'PATCH',
      token: author.token,
      body: { author: other.record.id },
    });
    assert.equal(reassigned.status, 404);
  });

  test('an edit cannot leave the post empty', async () => {
    const { record, token } = await verifiedUser();
    const { body: post } = await createPost(token, { author: record.id, text: 'algo' });
    const { status, body } = await pb.api(`${POSTS}/${post.id}`, {
      method: 'PATCH',
      token,
      body: { text: '' },
    });
    assert.equal(status, 400);
    assert.equal(body.data.text.code, 'post_empty');
  });

  test('removing the last file of a post without text is rejected', async () => {
    const { record, token } = await verifiedUser();
    const { body: post } = await upload('POST', POSTS, token, { author: record.id }, [photo()]);
    const removed = await pb.api(`${POSTS}/${post.id}`, {
      method: 'PATCH',
      token,
      body: { 'media-': [post.media[0]] },
    });
    assert.equal(removed.status, 400);
    assert.equal(removed.body.data.text.code, 'post_empty');
    const withText = await pb.api(`${POSTS}/${post.id}`, {
      method: 'PATCH',
      token,
      body: { 'media-': [post.media[0]], text: 'Ahora con texto' },
    });
    assert.equal(withText.status, 200);
    assert.deepEqual(withText.body.media, []);
  });

  test('an edit adds and removes photos and videos, up to 10 files', async () => {
    const { record, token } = await verifiedUser();
    const { body: post } = await upload('POST', POSTS, token, { author: record.id, text: 'Hola' }, [
      photo('a.png'),
      photo('b.png'),
    ]);
    const [first, second] = post.media;
    const edited = await upload('PATCH', `${POSTS}/${post.id}`, token, { 'media-': [first] }, []);
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.deepEqual(edited.body.media, [second]);

    const form = new FormData();
    form.append('media+', new Blob([png()], { type: 'image/png' }), 'c.png');
    form.append('media+', new Blob([video()], { type: 'video/mp4' }), 'd.mp4');
    const added = await fetch(`${pb.baseUrl}${POSTS}/${post.id}`, {
      method: 'PATCH',
      headers: { Authorization: token },
      body: form,
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(added.status, 200, JSON.stringify(added.body));
    assert.equal(added.body.media.length, 3);
    assert.equal(added.body.media[0], second);

    const tooMany = new FormData();
    for (let i = 0; i < 8; i += 1) {
      tooMany.append('media+', new Blob([png()], { type: 'image/png' }), `extra-${i}.png`);
    }
    const rejected = await fetch(`${pb.baseUrl}${POSTS}/${post.id}`, {
      method: 'PATCH',
      headers: { Authorization: token },
      body: tooMany,
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.data.media.code, 'validation_too_many_files');
  });

  test('only the author deletes a post', async () => {
    const author = await verifiedUser();
    const other = await verifiedUser();
    const { body: post } = await createPost(author.token, { author: author.record.id, text: 'x' });
    assert.equal(
      (await pb.api(`${POSTS}/${post.id}`, { method: 'DELETE', token: other.token })).status,
      404,
    );
    assert.equal(
      (await pb.api(`${POSTS}/${post.id}`, { method: 'DELETE', token: author.token })).status,
      204,
    );
  });

  test('deleting a pet removes it from posts; deleting the account deletes its posts', async () => {
    const user = await verifiedUser();
    const pet = await createPet(user);
    const { body: post } = await createPost(user.token, {
      author: user.record.id,
      text: 'Con Luna',
      pets: [pet.id],
    });
    await pb.api(`${PETS}/${pet.id}`, { method: 'DELETE', token: user.token });
    const afterPet = await pb.api(`${POSTS}/${post.id}`);
    assert.equal(afterPet.status, 200);
    assert.deepEqual(afterPet.body.pets, []);

    await pb.api(`${USERS}/records/${user.record.id}`, { method: 'DELETE', token: user.token });
    assert.equal((await pb.api(`${POSTS}/${post.id}`)).status, 404);
  });
});
