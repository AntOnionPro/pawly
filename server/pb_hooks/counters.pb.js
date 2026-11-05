/// <reference path="../pb_data/types.d.ts" />

// Counters stored on records (paw prints per post, and later comments, followers…).
// Only the server writes them: users cannot set them in their requests, and they are
// recalculated from the source table after every change, so they never drift.

// Users cannot set counters when creating or editing a post.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set('pawCount', 0);
  }
  e.next();
}, 'posts');

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set('pawCount', e.record.original().getInt('pawCount'));
  }
  e.next();
}, 'posts');

// Recount the paw prints of a post after one is added or removed (also when removed by a
// cascade, e.g. when an account is deleted). The `updated` date of the post does not change.
function recountPaws(e) {
  e.next();
  e.app
    .db()
    .newQuery(
      'UPDATE posts SET pawCount = (SELECT COUNT(*) FROM paws WHERE post = {:post}) WHERE id = {:post}',
    )
    .bind({ post: e.record.getString('post') })
    .execute();
}

onRecordAfterCreateSuccess(recountPaws, 'paws');
onRecordAfterDeleteSuccess(recountPaws, 'paws');
