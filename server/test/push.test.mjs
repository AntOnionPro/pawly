// End-to-end tests of push notifications, with a fake Expo Push Service that records what it
// receives (tests never call Expo).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';

import { accountHelpers } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;
let expo;
/** Requests received by the fake Expo, and tokens it reports as no longer registered. */
let received = [];
let goneTokens = [];

before(async () => {
  expo = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const messages = JSON.parse(body);
      received.push(...messages);
      const data = messages.map((message) =>
        goneTokens.includes(message.to)
          ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok', id: 'ticket' },
      );
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ data }));
    });
  });
  await new Promise((resolve) => expo.listen(0, '127.0.0.1', resolve));
  const { port } = expo.address();
  pb = await startPocketBase({ env: { PAWLY_PUSH_URL: `http://127.0.0.1:${port}/push` } });
});

after(() => {
  pb?.stop();
  expo?.close();
});

beforeEach(() => {
  received = [];
  goneTokens = [];
});

const { verifiedUser } = accountHelpers(() => pb);
const TOKENS = '/api/collections/push_tokens/records';
const POSTS = '/api/collections/posts/records';
const CONVERSATIONS = '/api/collections/conversations/records';
const MESSAGES = '/api/collections/messages/records';
const ADOPTIONS = '/api/collections/adoptions/records';
const REQUESTS = '/api/collections/adoption_requests/records';
let counter = 0;

async function device(user, language = 'es') {
  counter += 1;
  const token = `ExponentPushToken[test-${counter}-${process.pid}]`;
  const { status, body } = await pb.api(TOKENS, {
    method: 'POST',
    token: user.token,
    body: { user: user.record.id, token, platform: 'ios', language },
  });
  assert.equal(status, 200, JSON.stringify(body));
  return body;
}

const create = (path, user, body) => pb.api(path, { method: 'POST', token: user.token, body });

describe('push tokens', () => {
  test('only the owner sees and deletes them; a token belongs to one account', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const solDevice = await device(sol);
    assert.equal((await pb.api(`${TOKENS}/${solDevice.id}`, { token: luna.token })).status, 404);
    const forOther = await create(TOKENS, luna, {
      user: sol.record.id,
      token: 'ExponentPushToken[otro]',
    });
    assert.equal(forOther.status, 400);

    // Luna signs in on Sol's phone: the token now belongs to Luna only.
    const moved = await create(TOKENS, luna, { user: luna.record.id, token: solDevice.token });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal((await pb.api(`${TOKENS}/${solDevice.id}`, { token: sol.token })).status, 404);

    const removed = await pb.api(`${TOKENS}/${moved.body.id}`, {
      method: 'DELETE',
      token: luna.token,
    });
    assert.equal(removed.status, 204);
  });
});

describe('sending', () => {
  test('a notification reaches every device of the recipient, in its language', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const phone = await device(sol, 'es');
    const tablet = await device(sol, 'en');
    const { body: post } = await create(POSTS, sol, { author: sol.record.id, text: 'Hola' });
    await create('/api/collections/paws/records', luna, { user: luna.record.id, post: post.id });

    const name = luna.record.username;
    assert.deepEqual(
      received.map((message) => [message.to, message.title, message.body]).sort(),
      [
        [phone.token, 'Pawly', `@${name} dejó una huella en tu publicación.`],
        [tablet.token, 'Pawly', `@${name} left a paw print on your post.`],
      ].sort(),
    );
    assert.deepEqual(received[0].data, { type: 'paw', postId: post.id, actorId: luna.record.id });
  });

  test('a message reaches the other participant, never the sender', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const solDevice = await device(sol);
    await device(luna);
    const { body: conversation } = await create(CONVERSATIONS, luna, {
      userA: luna.record.id,
      userB: sol.record.id,
    });
    await create(MESSAGES, luna, {
      conversation: conversation.id,
      sender: luna.record.id,
      text: '¿Sigue en adopción?',
    });
    assert.deepEqual(received, [
      {
        to: solDevice.token,
        title: `@${luna.record.username}`,
        body: '¿Sigue en adopción?',
        data: { type: 'message', conversationId: conversation.id },
        sound: 'default',
      },
    ]);
  });

  test('adoption requests and answers reach both sides and open the listing', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const solDevice = await device(sol, 'es');
    const lunaDevice = await device(luna, 'en');
    const { body: pet } = await create('/api/collections/pets/records', sol, {
      owner: sol.record.id,
      name: 'Firulais',
      species: 'dog',
    });
    const { body: adoption } = await create(ADOPTIONS, sol, {
      publisher: sol.record.id,
      pet: pet.id,
      sex: 'male',
      size: 'medium',
      vaccines: 'complete',
      zone: 'Coyoacán',
    });
    const { body: request } = await create(REQUESTS, luna, {
      adoption: adoption.id,
      applicant: luna.record.id,
      message: 'Hola',
    });
    await pb.api(`${REQUESTS}/${request.id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { status: 'accepted' },
    });
    assert.deepEqual(
      received.map((message) => [message.to, message.body, message.data]),
      [
        [
          solDevice.token,
          `@${luna.record.username} quiere adoptar a Firulais.`,
          { type: 'adoption_request', adoptionId: adoption.id, actorId: luna.record.id },
        ],
        [
          lunaDevice.token,
          `@${sol.record.username} accepted your request to adopt Firulais.`,
          { type: 'request_accepted', adoptionId: adoption.id, actorId: sol.record.id },
        ],
      ],
    );

    // Marking the pet as adopted congratulates the adopter and opens the pet's profile.
    received = [];
    await pb.api(`/api/pawly/adoptions/${adoption.id}/adopt`, {
      method: 'POST',
      token: sol.token,
      body: { request: request.id },
    });
    assert.deepEqual(
      received.map((message) => [message.to, message.body, message.data]),
      [
        [
          lunaDevice.token,
          'Congratulations! Firulais is now part of your family.',
          { type: 'adopted', petId: pet.id, actorId: sol.record.id },
        ],
      ],
    );

    // One preference turns off every adoption push.
    received = [];
    await create('/api/collections/notification_prefs/records', luna, {
      user: luna.record.id,
      adoptionOff: true,
    });
    const { body: other } = await create('/api/collections/pets/records', sol, {
      owner: sol.record.id,
      name: 'Sol',
      species: 'cat',
    });
    const { body: second } = await create(ADOPTIONS, sol, {
      publisher: sol.record.id,
      pet: other.id,
      sex: 'female',
      size: 'small',
      vaccines: 'none',
      zone: 'Coyoacán',
    });
    const { body: secondRequest } = await create(REQUESTS, luna, {
      adoption: second.id,
      applicant: luna.record.id,
      message: 'Hola',
    });
    await pb.api(`${REQUESTS}/${secondRequest.id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { status: 'rejected' },
    });
    assert.deepEqual(
      received.map((message) => message.data.type),
      ['adoption_request'],
    );
  });

  test('tokens Expo no longer recognizes are deleted', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const old = await device(sol);
    goneTokens = [old.token];
    await create('/api/collections/follows/records', luna, {
      follower: luna.record.id,
      following: sol.record.id,
    });
    assert.equal(received.length, 1);
    assert.equal((await pb.api(`${TOKENS}/${old.id}`, { token: sol.token })).status, 404);
  });

  test('a push service that cannot be reached does not break the action', async () => {
    const down = await startPocketBase({ env: { PAWLY_PUSH_URL: 'http://127.0.0.1:9/push' } });
    try {
      const helpers = accountHelpers(() => down);
      const sol = await helpers.verifiedUser();
      const luna = await helpers.verifiedUser();
      const token = await down.api(TOKENS, {
        method: 'POST',
        token: sol.token,
        body: { user: sol.record.id, token: 'ExponentPushToken[caido]', language: 'es' },
      });
      assert.equal(token.status, 200);
      const followed = await down.api('/api/collections/follows/records', {
        method: 'POST',
        token: luna.token,
        body: { follower: luna.record.id, following: sol.record.id },
      });
      assert.equal(followed.status, 200, JSON.stringify(followed.body));
      const { body } = await down.api('/api/collections/notifications/records', {
        token: sol.token,
      });
      assert.equal(body.items.length, 1);
    } finally {
      down.stop();
    }
  });
});

describe('preferences', () => {
  const PREFS = '/api/collections/notification_prefs/records';

  test('only the owner sees and changes theirs, one record per user', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { status, body } = await create(PREFS, sol, { user: sol.record.id, pawOff: true });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal((await create(PREFS, sol, { user: sol.record.id })).status, 400);
    assert.equal((await create(PREFS, luna, { user: sol.record.id })).status, 400);
    assert.equal((await pb.api(`${PREFS}/${body.id}`, { token: luna.token })).status, 404);
    const edited = await pb.api(`${PREFS}/${body.id}`, {
      method: 'PATCH',
      token: luna.token,
      body: { pawOff: false },
    });
    assert.equal(edited.status, 404);
    const own = await pb.api(`${PREFS}/${body.id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { pawOff: false, messageOff: true },
    });
    assert.equal(own.status, 200);
    assert.equal(own.body.messageOff, true);
  });

  test('a type turned off sends no push, but the in-app notification stays', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    await device(sol);
    await create(PREFS, sol, { user: sol.record.id, pawOff: true, messageOff: true });
    const { body: post } = await create(POSTS, sol, { author: sol.record.id, text: 'Hola' });

    await create('/api/collections/paws/records', luna, { user: luna.record.id, post: post.id });
    const { body: conversation } = await create(CONVERSATIONS, luna, {
      userA: luna.record.id,
      userB: sol.record.id,
    });
    await create(MESSAGES, luna, {
      conversation: conversation.id,
      sender: luna.record.id,
      text: 'Hola',
    });
    assert.deepEqual(received, []);
    const { body } = await pb.api('/api/collections/notifications/records', { token: sol.token });
    assert.deepEqual(
      body.items.map((item) => item.type),
      ['paw'],
    );

    // Other types still arrive.
    await create('/api/collections/comments/records', luna, {
      author: luna.record.id,
      post: post.id,
      text: '¡Linda!',
    });
    assert.deepEqual(
      received.map((message) => message.data.type),
      ['comment'],
    );
  });
});
