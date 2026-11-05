/// <reference path="../pb_data/types.d.ts" />

// Counters stored on records (paw prints and comments per post, and later followers…).
// Only the server writes them: users cannot set them in their requests, and they are
// recalculated from the source table after every change, so they never drift.
// (Each handler runs on its own, so code outside a handler is not shared between them.)

// Users cannot set counters when creating or editing a post.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set('pawCount', 0);
    e.record.set('commentCount', 0);
  }
  e.next();
}, 'posts');

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const original = e.record.original();
    e.record.set('pawCount', original.getInt('pawCount'));
    e.record.set('commentCount', original.getInt('commentCount'));
  }
  e.next();
}, 'posts');

// Recount the paw prints or comments of a post after one is added or removed (also when
// removed by a cascade, e.g. when an account is deleted). The `updated` date of the post does
// not change.
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

function recountComments(e) {
  e.next();
  e.app
    .db()
    .newQuery(
      'UPDATE posts SET commentCount = (SELECT COUNT(*) FROM comments WHERE post = {:post}) WHERE id = {:post}',
    )
    .bind({ post: e.record.getString('post') })
    .execute();
}

onRecordAfterCreateSuccess(recountPaws, 'paws');
onRecordAfterDeleteSuccess(recountPaws, 'paws');
onRecordAfterCreateSuccess(recountComments, 'comments');
onRecordAfterDeleteSuccess(recountComments, 'comments');
