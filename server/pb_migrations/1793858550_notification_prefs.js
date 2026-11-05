/// <reference path="../pb_data/types.d.ts" />

// Which push notifications each user wants (stage 4): paw prints, comments, new followers,
// reposts and messages. One record per user, created when they first change something; without
// it every type is on. Only the owner sees and changes it. The in-app list always shows
// everything; these only stop pushes (pb_hooks/push.pb.js).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const owner = 'user = @request.auth.id';
    const prefs = new Collection({
      type: 'base',
      name: 'notification_prefs',
      listRule: owner,
      viewRule: owner,
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: `${owner} && (@request.body.user:isset = false || @request.body.user = @request.auth.id)`,
      deleteRule: null,
      fields: [
        {
          type: 'relation',
          name: 'user',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        // Stored as "off" so a missing value (and a missing record) means on.
        { type: 'bool', name: 'pawOff' },
        { type: 'bool', name: 'commentOff' },
        { type: 'bool', name: 'followOff' },
        { type: 'bool', name: 'repostOff' },
        { type: 'bool', name: 'messageOff' },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_notification_prefs_user ON notification_prefs (user)'],
    });
    app.save(prefs);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('notification_prefs'));
  },
);
