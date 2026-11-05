// End-to-end tests of direct messages: conversations, who can read and write, read markers,
// blocks and reports.
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
const CONVERSATIONS = '/api/collections/conversations/records';
const MESSAGES = '/api/collections/messages/records';
const BLOCKS = '/api/collections/blocks/records';
const REPORTS = '/api/collections/reports/records';

function startConversation(user, other) {
  return pb.api(CONVERSATIONS, {
    method: 'POST',
    token: user.token,
    body: { userA: user.record.id, userB: other.record.id },
  });
}

function send(user, conversationId, text = 'Hola') {
  return pb.api(MESSAGES, {
    method: 'POST',
    token: user.token,
    body: { conversation: conversationId, sender: user.record.id, text },
  });
}

function view(user, id) {
  return pb.api(`${CONVERSATIONS}/${id}`, { token: user.token });
}

/** The filter the app uses to count unread conversations. */
function unreadFilter(userId) {
  const me = `"${userId}"`;
  return encodeURIComponent(
    `lastSender != ${me} && lastMessageAt != '' && ((userA = ${me} && (readA = '' || readA < lastMessageAt)) || (userB = ${me} && (readB = '' || readB < lastMessageAt)))`,
  );
}

async function unreadCount(user) {
  const { body } = await pb.api(`${CONVERSATIONS}?filter=${unreadFilter(user.record.id)}`, {
    token: user.token,
  });
  return body.totalItems;
}

describe('conversations', () => {
  test('one per pair, stored in order, never with yourself', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const created = await startConversation(sol, luna);
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const pair = [sol.record.id, luna.record.id].sort();
    assert.deepEqual([created.body.userA, created.body.userB], pair);

    const again = await startConversation(luna, sol);
    assert.equal(again.status, 400);
    const self = await startConversation(sol, sol);
    assert.equal(self.status, 400);
    assert.equal(self.body.data.userB.code, 'conversation_self');
  });

  test('only the participants see it; nobody starts one for others or as a visitor', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const { body } = await startConversation(sol, luna);
    assert.equal((await view(luna, body.id)).status, 200);
    assert.equal((await view(rocco, body.id)).status, 404);
    const list = await pb.api(CONVERSATIONS, { token: rocco.token });
    assert.deepEqual(list.body.items, []);

    const forOthers = await pb.api(CONVERSATIONS, {
      method: 'POST',
      token: rocco.token,
      body: { userA: sol.record.id, userB: luna.record.id },
    });
    assert.equal(forOthers.status, 400);
    const visitor = await pb.api(CONVERSATIONS, {
      method: 'POST',
      body: { userA: sol.record.id, userB: luna.record.id },
    });
    assert.equal(visitor.status, 400);
  });

  test('the preview and read fields belong to the server', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body } = await pb.api(CONVERSATIONS, {
      method: 'POST',
      token: sol.token,
      body: {
        userA: sol.record.id,
        userB: luna.record.id,
        lastMessageText: 'Falso',
        readB: '2030-01-01 00:00:00.000Z',
      },
    });
    assert.equal(body.lastMessageText, '');
    assert.equal(body.readB, '');
  });
});

describe('messages', () => {
  test('participants write; the conversation shows the last one and counts as unread', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body: conversation } = await startConversation(sol, luna);
    assert.equal(await unreadCount(luna), 0);

    const sent = await send(sol, conversation.id, '  ¿Sigue en adopción?  ');
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(sent.body.text, '¿Sigue en adopción?');

    const { body: updated } = await view(sol, conversation.id);
    assert.equal(updated.lastMessageText, '¿Sigue en adopción?');
    assert.equal(updated.lastSender, sol.record.id);
    assert.equal(updated.lastMessageAt, sent.body.created);
    assert.equal(await unreadCount(luna), 1);
    assert.equal(await unreadCount(sol), 0);

    const filter = encodeURIComponent(`conversation = "${conversation.id}"`);
    const list = await pb.api(`${MESSAGES}?filter=${filter}&sort=created`, { token: luna.token });
    assert.deepEqual(
      list.body.items.map((item) => item.text),
      ['¿Sigue en adopción?'],
    );
  });

  test('reading marks only your side, and nothing else changes', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body: conversation } = await startConversation(sol, luna);
    await send(sol, conversation.id);
    const read = await pb.api(`${CONVERSATIONS}/${conversation.id}`, {
      method: 'PATCH',
      token: luna.token,
      body: { lastMessageText: 'Cambiado', userA: luna.record.id, userB: luna.record.id },
    });
    assert.equal(read.status, 200, JSON.stringify(read.body));
    assert.equal(read.body.lastMessageText, 'Hola');
    assert.deepEqual([read.body.userA, read.body.userB], [conversation.userA, conversation.userB]);
    assert.equal(await unreadCount(luna), 0);

    await send(sol, conversation.id, 'Otro');
    assert.equal(await unreadCount(luna), 1);
  });

  test('text has 1 to 1000 characters', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body: conversation } = await startConversation(sol, luna);
    for (const text of ['', '   ', 'a'.repeat(1001)]) {
      assert.equal((await send(sol, conversation.id, text)).status, 400, `${text.length}`);
    }
    assert.equal((await send(sol, conversation.id, 'a'.repeat(1000))).status, 200);
  });

  test('outsiders cannot read or write, and nobody writes as someone else', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const { body: conversation } = await startConversation(sol, luna);
    const { body: message } = await send(sol, conversation.id);

    assert.equal((await send(rocco, conversation.id)).status, 403);
    const asSol = await pb.api(MESSAGES, {
      method: 'POST',
      token: luna.token,
      body: { conversation: conversation.id, sender: sol.record.id, text: 'Falso' },
    });
    assert.equal(asSol.status, 400);
    assert.equal((await pb.api(`${MESSAGES}/${message.id}`, { token: rocco.token })).status, 404);
    const filter = encodeURIComponent(`conversation = "${conversation.id}"`);
    const list = await pb.api(`${MESSAGES}?filter=${filter}`, { token: rocco.token });
    assert.deepEqual(list.body.items, []);
  });
});

describe('blocks and reports', () => {
  test('nobody starts a conversation or writes across a block', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const { body: conversation } = await startConversation(sol, luna);
    await pb.api(BLOCKS, {
      method: 'POST',
      token: luna.token,
      body: { blocker: luna.record.id, blocked: sol.record.id },
    });
    const denied = await send(sol, conversation.id);
    assert.equal(denied.status, 400);
    assert.equal(denied.body.data.conversation.code, 'blocked');
    assert.equal((await send(luna, conversation.id)).status, 400);

    await pb.api(BLOCKS, {
      method: 'POST',
      token: rocco.token,
      body: { blocker: rocco.record.id, blocked: sol.record.id },
    });
    const blockedStart = await startConversation(sol, rocco);
    assert.equal(blockedStart.status, 400);
    assert.equal(blockedStart.body.data.userB.code, 'blocked');
  });

  test('a participant reports a message from the other one, not their own', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body: conversation } = await startConversation(sol, luna);
    const { body: message } = await send(sol, conversation.id, 'Vendo perritos');
    const report = (user) =>
      pb.api(REPORTS, {
        method: 'POST',
        token: user.token,
        body: { reporter: user.record.id, message: message.id, reason: 'animal_sale' },
      });
    assert.equal((await report(luna)).status, 200);
    assert.equal((await report(luna)).status, 400);
    const own = await report(sol);
    assert.equal(own.body.data.message.code, 'report_own');
  });

  test('deleting an account deletes its conversations and messages', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body: conversation } = await startConversation(sol, luna);
    await send(sol, conversation.id);
    await pb.api(`${USERS}/records/${sol.record.id}`, { method: 'DELETE', token: sol.token });
    assert.equal((await view(luna, conversation.id)).status, 404);
  });
});

describe('sharing posts by message', () => {
  const POSTS = '/api/collections/posts/records';

  async function newPost(user, text = 'Firulais busca casa') {
    const { body } = await pb.api(POSTS, {
      method: 'POST',
      token: user.token,
      body: { author: user.record.id, text },
    });
    return body;
  }

  function share(user, conversationId, postId, text = '') {
    return pb.api(MESSAGES, {
      method: 'POST',
      token: user.token,
      body: { conversation: conversationId, sender: user.record.id, post: postId, text },
    });
  }

  test('a message can carry a post, with or without text', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const post = await newPost(rocco);
    const { body: conversation } = await startConversation(sol, luna);

    const alone = await share(sol, conversation.id, post.id);
    assert.equal(alone.status, 200, JSON.stringify(alone.body));
    assert.equal(alone.body.post, post.id);
    assert.equal(alone.body.hasPost, true);
    assert.equal(alone.body.text, '');
    const withText = await share(sol, conversation.id, post.id, ' ¡Mira! ');
    assert.equal(withText.body.text, '¡Mira!');

    const { body: updated } = await view(luna, conversation.id);
    assert.equal(updated.lastMessageText, '¡Mira!');
    const filter = encodeURIComponent(`conversation = "${conversation.id}"`);
    const list = await pb.api(`${MESSAGES}?filter=${filter}&sort=created&expand=post.author`, {
      token: luna.token,
    });
    assert.equal(list.body.items[0].expand.post.text, 'Firulais busca casa');
    assert.equal(list.body.items[0].expand.post.expand.author.username, rocco.record.username);
  });

  test('without a post the text is required; the post must exist; hasPost is not forged', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body: conversation } = await startConversation(sol, luna);
    const empty = await send(sol, conversation.id, '  ');
    assert.equal(empty.status, 400);
    assert.equal(empty.body.data.text.code, 'message_empty');
    assert.equal((await share(sol, conversation.id, 'doesnotexist123')).status, 400);
    const forged = await pb.api(MESSAGES, {
      method: 'POST',
      token: sol.token,
      body: { conversation: conversation.id, sender: sol.record.id, text: 'Hola', hasPost: true },
    });
    assert.equal(forged.body.hasPost, false);
  });

  test('deleting the post keeps the message and says it had one', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    const { body: conversation } = await startConversation(sol, luna);
    const { body: message } = await share(sol, conversation.id, post.id, 'Mira');
    await pb.api(`${POSTS}/${post.id}`, { method: 'DELETE', token: sol.token });
    const { status, body } = await pb.api(`${MESSAGES}/${message.id}`, { token: luna.token });
    assert.equal(status, 200);
    assert.equal(body.post, '');
    assert.equal(body.hasPost, true);
    assert.equal(body.text, 'Mira');
  });
});
