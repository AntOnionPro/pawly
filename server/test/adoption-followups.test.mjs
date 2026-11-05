// End-to-end tests of the follow-up after an adoption: the four follow-ups, the daily
// reminders (run with simulated dates), posts that count as updates, pushes, and reporting an
// adopter whose follow-up went overdue.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';

import { accountHelpers } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;
let expo;
let received = [];

before(async () => {
  expo = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const messages = JSON.parse(body);
      received.push(...messages);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ data: messages.map(() => ({ status: 'ok' })) }));
    });
  });
  await new Promise((resolve) => expo.listen(0, '127.0.0.1', resolve));
  pb = await startPocketBase({
    env: { PAWLY_PUSH_URL: `http://127.0.0.1:${expo.address().port}/push` },
  });
});

after(() => {
  pb?.stop();
  expo?.close();
});

beforeEach(() => {
  received = [];
});

const { verifiedUser, superuserToken } = accountHelpers(() => pb);
const ADOPTIONS = '/api/collections/adoptions/records';
const REQUESTS = '/api/collections/adoption_requests/records';
const FOLLOWUPS = '/api/collections/adoption_followups/records';
const POSTS = '/api/collections/posts/records';
const REPORTS = '/api/collections/reports/records';
const NOTIFICATIONS = '/api/collections/notifications/records';
const DAY = 24 * 60 * 60 * 1000;

const create = (path, user, body) => pb.api(path, { method: 'POST', token: user.token, body });
const serverDate = (date) => date.toISOString().replace('T', ' ');
const parse = (text) => new Date(text.replace(' ', 'T'));

/** Sol gives Michi up for adoption and Luna adopts her. */
async function adopted() {
  const sol = await verifiedUser();
  const luna = await verifiedUser();
  const { body: pet } = await create('/api/collections/pets/records', sol, {
    owner: sol.record.id,
    name: 'Michi',
    species: 'cat',
  });
  const { body: listing } = await create(ADOPTIONS, sol, {
    publisher: sol.record.id,
    pet: pet.id,
    sex: 'female',
    size: 'small',
    vaccines: 'complete',
    zone: 'Tlalpan, CDMX',
  });
  const { body: request } = await create(REQUESTS, luna, {
    adoption: listing.id,
    applicant: luna.record.id,
    message: 'Hola',
  });
  await pb.api(`${REQUESTS}/${request.id}`, {
    method: 'PATCH',
    token: sol.token,
    body: { status: 'accepted' },
  });
  const { status, body: adoption } = await pb.api(`/api/pawly/adoptions/${listing.id}/adopt`, {
    method: 'POST',
    token: sol.token,
    body: { request: request.id },
  });
  assert.equal(status, 200, JSON.stringify(adoption));
  return { sol, luna, pet, adoption };
}

async function followups(user, adoption) {
  const filter = encodeURIComponent(`adoption = "${adoption.id}"`);
  const { body } = await pb.api(`${FOLLOWUPS}?filter=${filter}&sort=dueAt`, { token: user.token });
  return body.items;
}

async function runDaily(now) {
  const { status, body } = await pb.api('/api/pawly/followups/run', {
    method: 'POST',
    token: await superuserToken(),
    body: { now: now.toISOString() },
  });
  assert.equal(status, 200, JSON.stringify(body));
  return body.reminded;
}

/** Moves a follow-up's date (the admin panel can; users cannot). */
async function moveDue(followup, dueAt) {
  const { status } = await pb.api(`${FOLLOWUPS}/${followup.id}`, {
    method: 'PATCH',
    token: await superuserToken(),
    body: { dueAt: serverDate(dueAt) },
  });
  assert.equal(status, 200);
}

async function notifications(user) {
  const { body } = await pb.api(`${NOTIFICATIONS}?sort=-created,-id`, { token: user.token });
  return body.items;
}

describe('follow-ups', () => {
  test('an adoption gets four, at 1 week, 1 month, 3 months and 6 months', async () => {
    const { sol, luna, adoption } = await adopted();
    const items = await followups(luna, adoption);
    assert.deepEqual(
      items.map((item) => item.milestone),
      ['week1', 'month1', 'month3', 'month6'],
    );
    const start = parse(adoption.adoptedAt).getTime();
    assert.deepEqual(
      items.map((item) => Math.round((parse(item.dueAt).getTime() - start) / DAY)),
      [7, 30, 90, 180],
    );
    assert.equal((await followups(sol, adoption)).length, 4);
  });

  test('only the adopter and the previous owner see them, and only the server changes them', async () => {
    const { luna, adoption } = await adopted();
    const rocco = await verifiedUser();
    assert.equal((await followups(rocco, adoption)).length, 0);
    const [first] = await followups(luna, adoption);
    const url = `${FOLLOWUPS}/${first.id}`;
    assert.equal((await pb.api(url, { token: rocco.token })).status, 404);
    assert.equal((await pb.api(url)).status, 404);
    const edited = await pb.api(url, { method: 'PATCH', token: luna.token, body: { post: '' } });
    assert.equal(edited.status, 403);
    assert.equal((await pb.api(url, { method: 'DELETE', token: luna.token })).status, 403);
    const made = await create(FOLLOWUPS, luna, { adoption: adoption.id, milestone: 'week1' });
    assert.equal(made.status, 403);
  });
});

describe('daily reminders', () => {
  test('remind the adopter once, on the day each follow-up is due', async () => {
    const { sol, luna, pet, adoption } = await adopted();
    await create('/api/collections/push_tokens/records', luna, {
      user: luna.record.id,
      token: `ExponentPushToken[luna-${Date.now()}]`,
      language: 'es',
    });
    const start = parse(adoption.adoptedAt).getTime();
    const [week1, month1] = await followups(luna, adoption);

    assert.equal(await runDaily(new Date(start + 6 * DAY)), 0);
    received = [];
    assert.ok((await runDaily(new Date(start + 8 * DAY))) >= 1);
    const [reminder] = await notifications(luna);
    assert.equal(reminder.type, 'followup_due');
    assert.equal(reminder.actor, sol.record.id);
    assert.equal(reminder.adoption, adoption.id);
    assert.equal(reminder.followup, week1.id);
    assert.deepEqual(
      received.map((message) => [message.body, message.data]),
      [
        [
          `Ya pasó 1 semana desde que adoptaste a Michi. Comparte una foto o video para @${sol.record.username}.`,
          { type: 'followup_due', petId: pet.id, actorId: sol.record.id },
        ],
      ],
    );

    // Not again for the same follow-up; the next one on its own day.
    const count = (await notifications(luna)).length;
    await runDaily(new Date(start + 9 * DAY));
    assert.equal((await notifications(luna)).length, count);
    await runDaily(new Date(start + 31 * DAY));
    const [next] = await notifications(luna);
    assert.equal(next.followup, month1.id);
  });

  test('a follow-up that already closed is not reminded', async () => {
    const { luna, adoption } = await adopted();
    const start = parse(adoption.adoptedAt).getTime();
    await runDaily(new Date(start + 22 * DAY));
    const reminders = (await notifications(luna)).filter((item) => item.type === 'followup_due');
    assert.equal(reminders.length, 0);
  });

  test('only superusers run the task by hand', async () => {
    const luna = await verifiedUser();
    const byUser = await pb.api('/api/pawly/followups/run', { method: 'POST', token: luna.token });
    assert.ok(byUser.status === 401 || byUser.status === 403, String(byUser.status));
  });
});

describe('updates', () => {
  test("the adopter's post tagging the pet completes the open follow-up", async () => {
    const { sol, luna, pet, adoption } = await adopted();
    const [week1, month1] = await followups(luna, adoption);
    await moveDue(week1, new Date(Date.now() - DAY));

    const { body: untagged } = await create(POSTS, luna, {
      author: luna.record.id,
      text: 'Hoy llovió',
    });
    const { body: post } = await create(POSTS, luna, {
      author: luna.record.id,
      text: 'Michi ya duerme en su cama',
      pets: [pet.id],
    });
    const items = await followups(sol, adoption);
    assert.equal(items.find((item) => item.id === week1.id).post, post.id);
    assert.notEqual(items.find((item) => item.id === week1.id).post, untagged.id);
    assert.equal(items.find((item) => item.id === month1.id).post, '');

    const [update] = await notifications(sol);
    assert.equal(update.type, 'followup_posted');
    assert.equal(update.actor, luna.record.id);
    assert.equal(update.post, post.id);
    assert.equal(update.followup, week1.id);

    // A second post has no open follow-up to complete.
    await create(POSTS, luna, { author: luna.record.id, text: 'Otra', pets: [pet.id] });
    assert.equal(
      (await notifications(sol)).filter((item) => item.type === 'followup_posted').length,
      1,
    );
  });

  test('a post outside the window does not count', async () => {
    const { luna, pet, adoption } = await adopted();
    const [week1] = await followups(luna, adoption);
    await moveDue(week1, new Date(Date.now() - 15 * DAY));
    await create(POSTS, luna, { author: luna.record.id, text: 'Tarde', pets: [pet.id] });
    const [after] = await followups(luna, adoption);
    assert.equal(after.post, '');
  });
});

describe('reporting an overdue follow-up', () => {
  test('the previous owner reports the adopter once a follow-up is overdue', async () => {
    const { sol, luna, adoption } = await adopted();
    const report = () =>
      create(REPORTS, sol, {
        reporter: sol.record.id,
        user: luna.record.id,
        reason: 'adoption_followup',
      });
    const early = await report();
    assert.equal(early.status, 400);
    assert.equal(early.body.data.reason.code, 'followup_not_overdue');

    const [week1] = await followups(luna, adoption);
    await moveDue(week1, new Date(Date.now() - 15 * DAY));
    const { status, body } = await report();
    assert.equal(status, 200, JSON.stringify(body));
  });

  test('nobody else uses that reason', async () => {
    const { luna, adoption } = await adopted();
    const [week1] = await followups(luna, adoption);
    await moveDue(week1, new Date(Date.now() - 15 * DAY));
    const rocco = await verifiedUser();
    const { status, body } = await create(REPORTS, rocco, {
      reporter: rocco.record.id,
      user: luna.record.id,
      reason: 'adoption_followup',
    });
    assert.equal(status, 400);
    assert.equal(body.data.reason.code, 'followup_not_overdue');
  });
});
