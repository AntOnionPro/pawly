/// <reference path="../pb_data/types.d.ts" />

// Posts: text, up to 10 photos or videos, and tagged pets. Anyone can see them; only the
// author creates, edits and deletes them. Deleting the author's account deletes their posts.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const pets = app.findCollectionByNameOrId('pets');

    const posts = new Collection({
      type: 'base',
      name: 'posts',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.body.author = @request.auth.id",
      updateRule:
        'author = @request.auth.id && (@request.body.author:isset = false || @request.body.author = @request.auth.id)',
      deleteRule: 'author = @request.auth.id',
      fields: [
        {
          type: 'relation',
          name: 'author',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'text', name: 'text', max: 2200 },
        {
          type: 'file',
          name: 'media',
          maxSelect: 10,
          // Videos up to 50 MB; photos are limited to 10 MB in pb_hooks/posts.pb.js.
          maxSize: 50 * 1024 * 1024,
          mimeTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'video/mp4',
            'video/quicktime',
          ],
          // Thumbnails apply to photos only: a square for grids and a 1080 px wide one for the feed.
          thumbs: ['300x300', '1080x0'],
        },
        {
          type: 'relation',
          name: 'pets',
          collectionId: pets.id,
          cascadeDelete: false,
          maxSelect: 10,
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_posts_author ON posts (author)',
        'CREATE INDEX idx_posts_created ON posts (created)',
      ],
    });

    app.save(posts);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('posts'));
  },
);
