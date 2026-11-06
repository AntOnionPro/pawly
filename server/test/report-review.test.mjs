// End-to-end tests of report review: the copy each report keeps, the moderation queue, and
// what happens when a superuser actions or dismisses a report.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;
let admin;

before(async () => {
  pb = await startPocketBase();
  admin = await superuserToken();
});

after(() => pb?.stop());

const { verifiedUser, superuserToken } = accountHelpers(() => pb);
const POSTS = '/api/collections/posts/records';
const COMMENTS = '/api/collections/comments/records';
const REPORTS = '/api/collections/reports/records';
const QUEUE = '/api/collections/moderation_queue/records';
const NOTIFICATIONS = '/api/collections/notifications/records';

async function create(user, collection, body) {
  const { status, body: record } = await pb.api(`/api/collections/${collection}/records`, {
    method: 'POST',
    token: user.token,
    body,
  });
  assert.equal(status, 200, JSON.stringify(record));
  return record;
}

function newPost(user, text = 'Hola') {
  return create(user, 'posts', { author: user.record.id, text });
}

async function newAdoption(user) {
  const pet = await create(user, 'pets', { owner: user.record.id, name: 'Luna', species: 'dog' });
  return create(user, 'adoptions', {
    publisher: user.record.id,
    pet: pet.id,
    sex: 'female',
    size: 'medium',
    vaccines: 'complete',
    zone: 'Coyoacán, CDMX',
    requirements: 'Casa con patio',
    description: 'Cachorros a la venta',
  });
}

function newRescue(user) {
  return create(user, 'rescue_reports', {
    reporter: user.record.id,
    kind: 'help',
    urgency: 'high',
    description: 'Perrito herido',
    latitude: 19.35,
    longitude: -99.16,
  });
}

function report(user, target, reason = 'spam', extra = {}) {
  return pb.api(REPORTS, {
    method: 'POST',
    token: user.token,
    body: { reporter: user.record.id, reason, ...target, ...extra },
  });
}

async function reported(user, target, reason) {
  const { status, body } = await report(user, target, reason);
  assert.equal(status, 200, JSON.stringify(body));
  return body;
}

function review(id, body, token = admin) {
  return pb.api(`${REPORTS}/${id}`, { method: 'PATCH', token, body });
}

async function asAdmin(id) {
  const { body } = await pb.api(`${REPORTS}/${id}`, { token: admin });
  return body;
}

async function noticesOf(user) {
  const filter = encodeURIComponent(
    "type = 'content_removed' || type = 'report_actioned' || type = 'report_dismissed'",
  );
  const { body } = await pb.api(`${NOTIFICATIONS}?filter=${filter}`, { token: user.token });
  return body.items.map((item) => [item.type, item.contentKind, item.reportReason, item.actor]);
}

describe('reporting', () => {
  test('a report keeps a copy of what was reported and always starts pending', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol, 'Vendo perritos');
    const created = await reported(luna, { post: post.id }, 'animal_sale');
    const record = await asAdmin(created.id);
    assert.equal(record.targetKind, 'post');
    assert.equal(record.targetId, post.id);
    assert.equal(record.targetAuthor, sol.record.id);
    assert.equal(record.targetText, 'Vendo perritos');
    assert.equal(record.status, 'pending');

    // Whoever reports cannot choose the status or the copy.
    const rocco = await verifiedUser();
    const tricky = await reported(rocco, { post: post.id }, 'spam');
    const forged = await report(await verifiedUser(), { post: post.id }, 'spam', {
      status: 'dismissed',
      targetText: 'otra cosa',
      targetAuthor: rocco.record.id,
    });
    assert.equal(forged.status, 200);
    const stored = await asAdmin(forged.body.id);
    assert.equal(stored.status, 'pending');
    assert.equal(stored.targetText, 'Vendo perritos');
    assert.equal(stored.targetAuthor, sol.record.id);
    assert.equal((await asAdmin(tricky.id)).status, 'pending');
  });

  test('adoption listings and rescue reports can be reported, but not your own', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const adoption = await newAdoption(sol);
    const rescue = await newRescue(sol);
    const first = await asAdmin(
      (await reported(luna, { adoption: adoption.id }, 'animal_sale')).id,
    );
    assert.equal(first.targetKind, 'adoption');
    assert.equal(first.targetText, 'Cachorros a la venta\nCasa con patio');
    const second = await asAdmin((await reported(luna, { rescue: rescue.id }, 'other')).id);
    assert.equal(second.targetKind, 'rescue');
    assert.equal(second.targetText, 'Perrito herido');

    assert.equal((await report(luna, { adoption: adoption.id })).status, 400);
    const own = await report(sol, { rescue: rescue.id });
    assert.equal(own.body.data.rescue.code, 'report_own');
    const two = await report(luna, { rescue: rescue.id, adoption: adoption.id });
    assert.equal(two.body.data.post.code, 'report_target');
  });
});

describe('the moderation queue', () => {
  test('has one row per reported content with pending reports, only for superusers', async () => {
    const sol = await verifiedUser();
    const post = await newPost(sol, 'Spam spam');
    const { body: comment } = await pb.api(COMMENTS, {
      method: 'POST',
      token: sol.token,
      body: { author: sol.record.id, post: post.id, text: 'Compra aquí' },
    });
    for (const reason of ['spam', 'offensive', 'spam']) {
      await reported(await verifiedUser(), { post: post.id }, reason);
    }
    await reported(await verifiedUser(), { comment: comment.id }, 'spam');

    const filter = encodeURIComponent(`author = "${sol.record.id}"`);
    const { status, body } = await pb.api(`${QUEUE}?filter=${filter}&sort=-pending`, {
      token: admin,
    });
    assert.equal(status, 200, JSON.stringify(body));
    const rows = body.items.map((row) => [row.kind, row.target, row.pending, row.text]);
    assert.deepEqual(rows, [
      ['post', post.id, 3, 'Spam spam'],
      ['comment', comment.id, 1, 'Compra aquí'],
    ]);
    assert.deepEqual(body.items[0].reasons.split(',').sort(), ['offensive', 'spam']);

    assert.equal((await pb.api(QUEUE, { token: sol.token })).status, 403);
    assert.equal((await pb.api(QUEUE)).status, 403);
  });
});

describe('reviewing', () => {
  test('actioning content deletes it, closes its other reports and tells everyone', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const post = await newPost(sol, 'Algo ofensivo');
    const first = await reported(luna, { post: post.id }, 'offensive');
    const second = await reported(rocco, { post: post.id }, 'spam');

    // Users cannot review reports.
    assert.equal((await review(first.id, { status: 'actioned' }, luna.token)).status, 403);

    const { status, body } = await review(first.id, {
      status: 'actioned',
      reviewNote: 'Insultos',
      reason: 'other',
      targetText: 'cambiado',
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal((await pb.api(`${POSTS}/${post.id}`)).status, 404);

    const done = await asAdmin(first.id);
    assert.equal(done.status, 'actioned');
    assert.equal(done.reviewNote, 'Insultos');
    assert.ok(done.reviewedAt);
    // What was reported stays, even with the post gone.
    assert.equal(done.reason, 'offensive');
    assert.equal(done.post, '');
    assert.equal(done.targetId, post.id);
    assert.equal(done.targetText, 'Algo ofensivo');
    const other = await asAdmin(second.id);
    assert.equal(other.status, 'actioned');
    assert.equal(other.reviewedAt, done.reviewedAt);

    assert.deepEqual(await noticesOf(sol), [['content_removed', 'post', 'offensive', '']]);
    assert.deepEqual(await noticesOf(luna), [['report_actioned', 'post', '', '']]);
    assert.deepEqual(await noticesOf(rocco), [['report_actioned', 'post', '', '']]);

    const filter = encodeURIComponent(`target = "${post.id}"`);
    const queue = await pb.api(`${QUEUE}?filter=${filter}`, { token: admin });
    assert.equal(queue.body.items.length, 0);

    // Reviewing it again does nothing more.
    await review(first.id, { status: 'dismissed' });
    assert.equal((await noticesOf(luna)).length, 1);
  });

  test('dismissing keeps the content and tells whoever reported it', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(sol);
    const first = await reported(luna, { post: post.id }, 'spam');
    await review(first.id, { status: 'dismissed' });
    assert.equal((await pb.api(`${POSTS}/${post.id}`)).status, 200);
    assert.equal((await asAdmin(first.id)).status, 'dismissed');
    assert.deepEqual(await noticesOf(luna), [['report_dismissed', 'post', '', '']]);
    assert.deepEqual(await noticesOf(sol), []);

    // Back to pending clears the review date.
    await review(first.id, { status: 'pending' });
    assert.equal((await asAdmin(first.id)).reviewedAt, '');
  });

  test('comments, messages, listings and rescue reports are removed too', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await newPost(luna);
    const comment = await create(sol, 'comments', {
      author: sol.record.id,
      post: post.id,
      text: 'Feo',
    });
    const conversation = await create(sol, 'conversations', {
      userA: sol.record.id,
      userB: luna.record.id,
    });
    const message = await create(sol, 'messages', {
      conversation: conversation.id,
      sender: sol.record.id,
      text: 'Feo',
    });
    const adoption = await newAdoption(sol);
    const rescue = await newRescue(sol);
    const targets = [
      ['comment', comment.id, 'comments'],
      ['message', message.id, 'messages'],
      ['adoption', adoption.id, 'adoptions'],
      ['rescue', rescue.id, 'rescue_reports'],
    ];
    for (const [kind, id, collection] of targets) {
      const created = await reported(luna, { [kind]: id }, 'offensive');
      const { status, body } = await review(created.id, { status: 'actioned' });
      assert.equal(status, 200, JSON.stringify(body));
      const gone = await pb.api(`/api/collections/${collection}/records/${id}`, { token: admin });
      assert.equal(gone.status, 404, kind);
    }
    assert.deepEqual((await noticesOf(sol)).map(([type, kind]) => `${type}:${kind}`).sort(), [
      'content_removed:adoption',
      'content_removed:comment',
      'content_removed:message',
      'content_removed:rescue',
    ]);
  });

  test('a user report is only closed, and content already deleted is not "removed" again', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const created = await reported(luna, { user: sol.record.id }, 'spam');
    await review(created.id, { status: 'actioned' });
    assert.equal((await pb.api(`${USERS}/records/${sol.record.id}`)).status, 200);
    assert.deepEqual(await noticesOf(luna), [['report_actioned', 'user', '', '']]);
    assert.deepEqual(await noticesOf(sol), []);

    // The author deleted the post before the review: it stays in the queue by its copy.
    const post = await newPost(sol, 'Ya no está');
    const second = await reported(luna, { post: post.id }, 'spam');
    await pb.api(`${POSTS}/${post.id}`, { method: 'DELETE', token: sol.token });
    const kept = await asAdmin(second.id);
    assert.equal(kept.post, '');
    assert.equal(kept.targetText, 'Ya no está');
    await review(second.id, { status: 'actioned' });
    assert.deepEqual(await noticesOf(sol), []);
  });
});

describe('deleting accounts', () => {
  test('reports stay without whoever reported, and go with the reported account', async () => {
    const sol = await verifiedUser();
    const post = await newPost(sol);
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const first = await reported(luna, { post: post.id }, 'spam');
    const second = await reported(rocco, { post: post.id }, 'spam');
    for (const user of [luna, rocco]) {
      const deleted = await pb.api(`${USERS}/records/${user.record.id}`, {
        method: 'DELETE',
        token: user.token,
      });
      assert.equal(deleted.status, 204);
    }
    assert.equal((await asAdmin(first.id)).reporter, '');
    assert.equal((await asAdmin(second.id)).reporter, '');

    await pb.api(`${USERS}/records/${sol.record.id}`, { method: 'DELETE', token: sol.token });
    assert.equal((await pb.api(`${REPORTS}/${first.id}`, { token: admin })).status, 404);
    assert.equal((await pb.api(`${REPORTS}/${second.id}`, { token: admin })).status, 404);
  });
});
