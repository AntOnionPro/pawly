/// <reference path="../pb_data/types.d.ts" />

// Counters stored on records: paw prints and comments per post, followers and follows per user.
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

// Users cannot set their follower counts when signing up or editing their profile.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set('followerCount', 0);
    e.record.set('followingCount', 0);
  }
  e.next();
}, 'users');

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const original = e.record.original();
    e.record.set('followerCount', original.getInt('followerCount'));
    e.record.set('followingCount', original.getInt('followingCount'));
  }
  e.next();
}, 'users');

// Recount the followers of the followed user and the follows of the follower. The `updated`
// date of the users does not change.
function recountFollows(e) {
  e.next();
  const db = e.app.db();
  db.newQuery(
    'UPDATE users SET followerCount = (SELECT COUNT(*) FROM follows WHERE following = {:id}) WHERE id = {:id}',
  )
    .bind({ id: e.record.getString('following') })
    .execute();
  db.newQuery(
    'UPDATE users SET followingCount = (SELECT COUNT(*) FROM follows WHERE follower = {:id}) WHERE id = {:id}',
  )
    .bind({ id: e.record.getString('follower') })
    .execute();
}

onRecordAfterCreateSuccess(recountPaws, 'paws');
onRecordAfterDeleteSuccess(recountPaws, 'paws');
onRecordAfterCreateSuccess(recountComments, 'comments');
onRecordAfterDeleteSuccess(recountComments, 'comments');
onRecordAfterCreateSuccess(recountFollows, 'follows');
onRecordAfterDeleteSuccess(recountFollows, 'follows');
