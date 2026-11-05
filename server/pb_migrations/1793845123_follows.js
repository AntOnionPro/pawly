/// <reference path="../pb_data/types.d.ts" />

// Follows: `follower` follows `following`. One per pair, and nobody follows themselves.
// Anyone can see them; only the follower creates or deletes theirs. They are deleted with
// either account. Each user keeps a `followerCount` and a `followingCount` that only the
// server updates (pb_hooks/counters.pb.js).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    users.fields.add(new NumberField({ name: 'followerCount', min: 0, onlyInt: true }));
    users.fields.add(new NumberField({ name: 'followingCount', min: 0, onlyInt: true }));
    app.save(users);

    const follows = new Collection({
      type: 'base',
      name: 'follows',
      listRule: '',
      viewRule: '',
      createRule:
        "@request.auth.id != '' && @request.body.follower = @request.auth.id && @request.body.following != @request.auth.id",
      updateRule: null,
      deleteRule: 'follower = @request.auth.id',
      fields: [
        {
          type: 'relation',
          name: 'follower',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'following',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_follows_pair ON follows (follower, following)',
        'CREATE INDEX idx_follows_following ON follows (following)',
      ],
    });
    app.save(follows);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('follows'));
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('followerCount');
    users.fields.removeByName('followingCount');
    app.save(users);
  },
);
