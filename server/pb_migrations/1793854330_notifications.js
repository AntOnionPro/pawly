/// <reference path="../pb_data/types.d.ts" />

// In-app notifications (stage 4): someone (`actor`) left a paw print, commented, followed or
// reposted. Only the server creates them (pb_hooks/notifications.pb.js); only the recipient
// sees them and marks them as read (POST /api/pawly/notifications/read). They are deleted
// with either account and with the related post or comment.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const posts = app.findCollectionByNameOrId('posts');
    const comments = app.findCollectionByNameOrId('comments');

    const notifications = new Collection({
      type: 'base',
      name: 'notifications',
      listRule: 'recipient = @request.auth.id',
      viewRule: 'recipient = @request.auth.id',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          type: 'relation',
          name: 'recipient',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'actor',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'select',
          name: 'type',
          required: true,
          maxSelect: 1,
          values: ['paw', 'comment', 'follow', 'repost'],
        },
        {
          type: 'relation',
          name: 'post',
          collectionId: posts.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'comment',
          collectionId: comments.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'bool', name: 'read' },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE INDEX idx_notifications_recipient ON notifications (recipient, created)',
        'CREATE INDEX idx_notifications_unread ON notifications (recipient, read)',
      ],
    });
    app.save(notifications);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('notifications'));
  },
);
