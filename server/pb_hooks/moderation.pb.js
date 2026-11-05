/// <reference path="../pb_data/types.d.ts" />

// Reports and blocks. Each handler runs on its own, so shared code lives in lib/moderation.js.

// A report is about exactly one post, comment, user or message, and nobody reports themselves
// or their own content.
onRecordCreateRequest((e) => {
  const record = e.record;
  const targets = ['post', 'comment', 'user', 'message'].filter(
    (field) => record.getString(field) !== '',
  );
  if (targets.length !== 1) {
    throw new BadRequestError('Invalid report.', {
      post: new ValidationError('report_target', 'Report one post, comment, user or message.'),
    });
  }
  const target = targets[0];
  let owner = '';
  try {
    if (target === 'user') owner = record.getString('user');
    if (target === 'post') {
      owner = e.app.findRecordById('posts', record.getString('post')).getString('author');
    }
    if (target === 'comment') {
      owner = e.app.findRecordById('comments', record.getString('comment')).getString('author');
    }
    if (target === 'message') {
      owner = e.app.findRecordById('messages', record.getString('message')).getString('sender');
    }
  } catch {
    // A missing target is rejected by its relation field.
  }
  if (owner && owner === record.getString('reporter')) {
    throw new BadRequestError('Invalid report.', {
      [target]: new ValidationError('report_own', 'You cannot report yourself or your content.'),
    });
  }
  e.next();
}, 'reports');

// Nobody follows across a block, in either direction.
onRecordCreateRequest((e) => {
  const { hasBlock } = require(`${__hooks}/lib/moderation.js`);
  if (hasBlock(e.app, e.record.getString('follower'), e.record.getString('following'))) {
    throw new BadRequestError('Blocked.', {
      following: new ValidationError('blocked', 'There is a block between these users.'),
    });
  }
  e.next();
}, 'follows');

// A blocked user cannot comment on the posts of whoever blocked them.
onRecordCreateRequest((e) => {
  const { isBlockedBy } = require(`${__hooks}/lib/moderation.js`);
  let postAuthor = '';
  try {
    postAuthor = e.app.findRecordById('posts', e.record.getString('post')).getString('author');
  } catch {
    // A missing post is rejected by the relation field.
  }
  if (postAuthor && isBlockedBy(e.app, e.record.getString('author'), postAuthor)) {
    throw new BadRequestError('Blocked.', {
      post: new ValidationError('blocked', 'The author of this post blocked you.'),
    });
  }
  e.next();
}, 'comments');

// Blocking removes the follows between both users (their counts are recalculated).
onRecordAfterCreateSuccess((e) => {
  e.next();
  const blocker = e.record.getString('blocker');
  const blocked = e.record.getString('blocked');
  const follows = e.app.findRecordsByFilter(
    'follows',
    '(follower = {:a} && following = {:b}) || (follower = {:b} && following = {:a})',
    '',
    0,
    0,
    { a: blocker, b: blocked },
  );
  for (const follow of follows) {
    e.app.delete(follow);
  }
}, 'blocks');
