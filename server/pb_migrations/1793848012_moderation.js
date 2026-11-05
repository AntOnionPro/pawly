/// <reference path="../pb_data/types.d.ts" />

// Reports and blocks (stage 3).
// - reports: a user reports one post, comment or user, with a reason and optional details.
//   Only superusers see them (PocketBase admin panel). One report per user and target.
// - blocks: `blocker` blocks `blocked`. Only the blocker sees and removes their blocks. The
//   effects (no comments on the blocker's posts, no follows, follows removed) live in
//   pb_hooks/moderation.pb.js.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const posts = app.findCollectionByNameOrId('posts');
    const comments = app.findCollectionByNameOrId('comments');

    const reports = new Collection({
      type: 'base',
      name: 'reports',
      listRule: null,
      viewRule: null,
      createRule: "@request.auth.id != '' && @request.body.reporter = @request.auth.id",
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          type: 'relation',
          name: 'reporter',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        // Exactly one of these three (checked in pb_hooks/moderation.pb.js).
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
        {
          type: 'relation',
          name: 'user',
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'select',
          name: 'reason',
          required: true,
          maxSelect: 1,
          values: ['spam', 'offensive', 'animal_abuse', 'animal_sale', 'other'],
        },
        { type: 'text', name: 'details', max: 500 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_reports_post ON reports (reporter, post) WHERE post != ''",
        "CREATE UNIQUE INDEX idx_reports_comment ON reports (reporter, comment) WHERE comment != ''",
        "CREATE UNIQUE INDEX idx_reports_user ON reports (reporter, user) WHERE user != ''",
      ],
    });
    app.save(reports);

    const blocks = new Collection({
      type: 'base',
      name: 'blocks',
      listRule: 'blocker = @request.auth.id',
      viewRule: 'blocker = @request.auth.id',
      createRule:
        "@request.auth.id != '' && @request.body.blocker = @request.auth.id && @request.body.blocked != @request.auth.id",
      updateRule: null,
      deleteRule: 'blocker = @request.auth.id',
      fields: [
        {
          type: 'relation',
          name: 'blocker',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'blocked',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_blocks_pair ON blocks (blocker, blocked)',
        'CREATE INDEX idx_blocks_blocked ON blocks (blocked)',
      ],
    });
    app.save(blocks);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('reports'));
    app.delete(app.findCollectionByNameOrId('blocks'));
  },
);
