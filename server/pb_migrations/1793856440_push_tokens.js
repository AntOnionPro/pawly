/// <reference path="../pb_data/types.d.ts" />

// Expo push tokens of each user's devices (stage 4), with the app language for the text of
// the notifications. Only the owner sees, saves and deletes theirs. A token belongs to one
// account at a time (pb_hooks/push.pb.js), and tokens are deleted with the account.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const owner = 'user = @request.auth.id';
    const tokens = new Collection({
      type: 'base',
      name: 'push_tokens',
      listRule: owner,
      viewRule: owner,
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: `${owner} && (@request.body.user:isset = false || @request.body.user = @request.auth.id)`,
      deleteRule: owner,
      fields: [
        {
          type: 'relation',
          name: 'user',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'text', name: 'token', required: true, max: 200 },
        { type: 'select', name: 'platform', maxSelect: 1, values: ['ios', 'android', 'web'] },
        { type: 'select', name: 'language', maxSelect: 1, values: ['es', 'en'] },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_push_tokens_token ON push_tokens (token)',
        'CREATE INDEX idx_push_tokens_user ON push_tokens (user)',
      ],
    });
    app.save(tokens);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('push_tokens'));
  },
);
