/// <reference path="../pb_data/types.d.ts" />

// Paw prints: the only reaction in Pawly. One per user and post. Each post keeps a
// `pawCount` that only the server updates (pb_hooks/counters.pb.js).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const posts = app.findCollectionByNameOrId('posts');

    posts.fields.add(new NumberField({ name: 'pawCount', min: 0, onlyInt: true }));
    app.save(posts);

    const paws = new Collection({
      type: 'base',
      name: 'paws',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: null,
      deleteRule: 'user = @request.auth.id',
      fields: [
        {
          type: 'relation',
          name: 'user',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'post',
          required: true,
          collectionId: posts.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_paws_user_post ON paws (user, post)',
        'CREATE INDEX idx_paws_post ON paws (post)',
      ],
    });
    app.save(paws);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('paws'));
    const posts = app.findCollectionByNameOrId('posts');
    posts.fields.removeByName('pawCount');
    app.save(posts);
  },
);
