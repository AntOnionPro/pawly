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
