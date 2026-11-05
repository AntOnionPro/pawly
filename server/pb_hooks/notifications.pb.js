/// <reference path="../pb_data/types.d.ts" />

// In-app notifications, created after each action. Each handler runs on its own, so shared
// code lives in lib/notifications.js.

// A paw print on your post (once per person and post, even if they remove it and add it again).
onRecordAfterCreateSuccess((e) => {
  e.next();
  const { notify, postAuthor } = require(`${__hooks}/lib/notifications.js`);
  const post = e.record.getString('post');
  notify(e.app, {
    recipient: postAuthor(e.app, post),
    actor: e.record.getString('user'),
    type: 'paw',
    post,
    once: true,
  });
}, 'paws');

// A comment on your post.
onRecordAfterCreateSuccess((e) => {
  e.next();
  const { notify, postAuthor } = require(`${__hooks}/lib/notifications.js`);
  const post = e.record.getString('post');
  notify(e.app, {
    recipient: postAuthor(e.app, post),
    actor: e.record.getString('author'),
    type: 'comment',
    post,
    comment: e.record.id,
  });
}, 'comments');

// A new follower (once per person).
onRecordAfterCreateSuccess((e) => {
  e.next();
  const { notify } = require(`${__hooks}/lib/notifications.js`);
  notify(e.app, {
    recipient: e.record.getString('following'),
    actor: e.record.getString('follower'),
    type: 'follow',
    once: true,
  });
}, 'follows');

// A repost of your post (once per person and post).
onRecordAfterCreateSuccess((e) => {
  e.next();
  const original = e.record.getString('repostOf');
  if (!original) return;
  const { notify, postAuthor } = require(`${__hooks}/lib/notifications.js`);
  notify(e.app, {
    recipient: postAuthor(e.app, original),
    actor: e.record.getString('author'),
    type: 'repost',
    post: original,
    once: true,
  });
}, 'posts');

// A new adoption request, for the publisher of the listing.
onRecordAfterCreateSuccess((e) => {
  e.next();
  const { notify } = require(`${__hooks}/lib/notifications.js`);
  try {
    const adoption = e.app.findRecordById('adoptions', e.record.getString('adoption'));
    notify(e.app, {
      recipient: adoption.getString('publisher'),
      actor: e.record.getString('applicant'),
      type: 'adoption_request',
      adoption: adoption.id,
    });
  } catch (error) {
    console.log(`[pawly-notifications] adoption request: ${error}`);
  }
}, 'adoption_requests');

// The publisher accepted or rejected a request: tell the applicant.
onRecordUpdateRequest((e) => {
  const from = e.record.original().getString('status');
  e.next();
  const to = e.record.getString('status');
  if (from === to || (to !== 'accepted' && to !== 'rejected')) return;
  const { notify } = require(`${__hooks}/lib/notifications.js`);
  try {
    const adoption = e.app.findRecordById('adoptions', e.record.getString('adoption'));
    notify(e.app, {
      recipient: e.record.getString('applicant'),
      actor: adoption.getString('publisher'),
      type: to === 'accepted' ? 'request_accepted' : 'request_rejected',
      adoption: adoption.id,
    });
  } catch (error) {
    console.log(`[pawly-notifications] adoption request status: ${error}`);
  }
}, 'adoption_requests');

// Marks all of the signed-in user's notifications as read.
routerAdd(
  'POST',
  '/api/pawly/notifications/read',
  (e) => {
    e.app
      .db()
      .newQuery('UPDATE notifications SET read = 1 WHERE recipient = {:id} AND read = 0')
      .bind({ id: e.auth.id })
      .execute();
    return e.json(200, { status: 'ok' });
  },
  $apis.requireAuth('users'),
);
