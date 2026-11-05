/// <reference path="../pb_data/types.d.ts" />

// Comments on posts: 1 to 500 characters. Anyone can see them; only the author edits them,
// and the author or the author of the post deletes them. They are deleted with the post or
// the account. Each post keeps a `commentCount` that only the server updates
// (pb_hooks/counters.pb.js).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const posts = app.findCollectionByNameOrId('posts');

    posts.fields.add(new NumberField({ name: 'commentCount', min: 0, onlyInt: true }));
    app.save(posts);

    const comments = new Collection({
      type: 'base',
      name: 'comments',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.body.author = @request.auth.id",
      // A comment cannot move to another post or change its author.
      updateRule:
        'author = @request.auth.id && (@request.body.author:isset = false || @request.body.author = author) && (@request.body.post:isset = false || @request.body.post = post)',
      deleteRule: 'author = @request.auth.id || post.author = @request.auth.id',
      fields: [
        {
          type: 'relation',
          name: 'post',
          required: true,
          collectionId: posts.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'author',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        // Trimmed in pb_hooks/comments.pb.js, so only spaces count as empty.
        { type: 'text', name: 'text', required: true, min: 1, max: 500 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_comments_post_created ON comments (post, created)',
        'CREATE INDEX idx_comments_author ON comments (author)',
      ],
    });
    app.save(comments);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('comments'));
    const posts = app.findCollectionByNameOrId('posts');
    posts.fields.removeByName('commentCount');
    app.save(posts);
  },
);
