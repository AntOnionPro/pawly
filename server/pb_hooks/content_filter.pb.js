/// <reference path="../pb_data/types.d.ts" />

// Content filter: the texts people save are checked against `blocked_terms`. A blocking term
// stops the save; a review term saves it and sends it to the moderation queue. Superusers are
// not filtered. Each handler runs on its own, so shared code lives in lib/filter.js (the list
// of collections and fields is FILTERED there).

onRecordCreateRequest(
  (e) => {
    if (e.hasSuperuserAuth()) return e.next();
    const { checkContent, fileReview } = require(`${__hooks}/lib/filter.js`);
    const review = checkContent(e.app, e.record, null);
    e.next();
    if (review) fileReview(e.app, e.record, review);
  },
  'users',
  'pets',
  'posts',
  'comments',
  'messages',
  'adoptions',
  'rescue_reports',
);

// On an update, only the texts that changed are checked.
onRecordUpdateRequest(
  (e) => {
    if (e.hasSuperuserAuth()) return e.next();
    const { checkContent, fileReview } = require(`${__hooks}/lib/filter.js`);
    const review = checkContent(e.app, e.record, e.record.original());
    e.next();
    if (review) fileReview(e.app, e.record, review);
  },
  'users',
  'pets',
  'posts',
  'comments',
  'messages',
  'adoptions',
  'rescue_reports',
);
