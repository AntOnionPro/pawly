/// <reference path="../pb_data/types.d.ts" />

// Reports and blocks. Each handler runs on its own, so shared code lives in lib/moderation.js.

// A report is about exactly one post, comment, user, message, adoption listing or rescue
// report, and nobody reports themselves or their own content. It keeps a copy of what was
// reported, and starts pending.
onRecordCreateRequest((e) => {
  const { REPORT_KINDS, reportTarget } = require(`${__hooks}/lib/moderation.js`);
  const record = e.record;
  const targets = REPORT_KINDS.filter((field) => record.getString(field) !== '');
  if (targets.length !== 1) {
    throw new BadRequestError('Invalid report.', {
      post: new ValidationError(
        'report_target',
        'Report one post, comment, user, message, adoption listing or rescue report.',
      ),
    });
  }
  const target = reportTarget(e.app, record);
  if (target.author && target.author === record.getString('reporter')) {
    throw new BadRequestError('Invalid report.', {
      [target.kind]: new ValidationError(
        'report_own',
        'You cannot report yourself or your content.',
      ),
    });
  }
  record.set('targetKind', target.kind);
  record.set('targetId', target.id);
  record.set('targetAuthor', target.author);
  record.set('targetText', target.text);
  record.set('status', 'pending');
  record.set('reviewedAt', '');
  record.set('reviewNote', '');
  e.next();
}, 'reports');

// Reviewing a report (only superusers can update reports, from the admin panel). Only the
// review changes: `status`, `reviewNote` and `reviewedAt`, which the server sets.
// - "actioned" on content deletes it and tells its author; on a user it only closes the report
//   (the suspension is done on the user).
// - The other pending reports about the same thing get the same status, and everyone who
//   reported it is told the result.
onRecordUpdateRequest((e) => {
  const { REPORT_KINDS, removeContent } = require(`${__hooks}/lib/moderation.js`);
  const { notifyFromPawly } = require(`${__hooks}/lib/notifications.js`);
  const record = e.record;
  const original = record.original();
  const fixed = [
    'reporter',
    ...REPORT_KINDS,
    'reason',
    'details',
    'targetKind',
    'targetId',
    'targetAuthor',
    'targetText',
  ];
  for (const field of fixed) record.set(field, original.get(field));

  const before = original.getString('status') || 'pending';
  const status = record.getString('status') || 'pending';
  record.set('status', status);
  if (status === 'pending') {
    record.set('reviewedAt', '');
  } else if (before === 'pending' || !original.getString('reviewedAt')) {
    record.set('reviewedAt', new DateTime());
  } else {
    record.set('reviewedAt', original.get('reviewedAt'));
  }
  const reviewed = before === 'pending' && status !== 'pending';
  const kind = record.getString('targetKind');
  const targetId = record.getString('targetId');

  let removed = false;
  if (reviewed && status === 'actioned' && kind !== 'user') {
    removed = removeContent(e.app, kind, targetId);
    // Deleting the content empties the relation of every report about it.
    if (removed) record.set(kind, '');
  }

  e.next();
  if (!reviewed) return;

  const others = e.app.findRecordsByFilter(
    'reports',
    "targetKind = {:kind} && targetId = {:id} && status = 'pending' && id != {:me}",
    '',
    0,
    0,
    { kind, id: targetId, me: record.id },
  );
  for (const other of others) {
    other.set('status', status);
    other.set('reviewedAt', record.get('reviewedAt'));
    e.app.save(other);
  }

  const reporters = new Set(
    [record, ...others].map((report) => report.getString('reporter')).filter(Boolean),
  );
  for (const reporter of reporters) {
    notifyFromPawly(e.app, {
      recipient: reporter,
      type: status === 'actioned' ? 'report_actioned' : 'report_dismissed',
      contentKind: kind,
    });
  }
  if (removed) {
    notifyFromPawly(e.app, {
      recipient: record.getString('targetAuthor'),
      type: 'content_removed',
      contentKind: kind,
      reportReason: record.getString('reason'),
    });
  }
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
