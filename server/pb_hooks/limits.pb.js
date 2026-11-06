/// <reference path="../pb_data/types.d.ts" />

// Limits against spam for each account (the limits per connection are PocketBase's rate
// limiter, set up in pb_migrations/…_rate_limits.js). Each handler runs on its own, so the
// table lives in lib/limits.js. Superusers have no limits.

onRecordCreateRequest(
  (e) => {
    // The server remembers who started a conversation (its pair is stored in order).
    if (e.collection.name === 'conversations') {
      e.record.set('startedBy', e.auth ? e.auth.id : '');
    }
    if (e.hasSuperuserAuth() || !e.auth) return e.next();
    const { checkLimits } = require(`${__hooks}/lib/limits.js`);
    checkLimits(e.app, e.collection.name, e.record, e.auth);
    e.next();
  },
  'posts',
  'comments',
  'messages',
  'conversations',
  'follows',
  'reports',
  'adoptions',
  'adoption_requests',
  'rescue_reports',
  'rescue_helpers',
);

// Who started a conversation does not change.
onRecordUpdateRequest((e) => {
  e.record.set('startedBy', e.record.original().getString('startedBy'));
  e.next();
}, 'conversations');
