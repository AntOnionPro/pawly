/// <reference path="../pb_data/types.d.ts" />

// Reposts: a post whose `repostOf` points to the original post, with an optional comment in
// `text` and no files or pets. A repost always points to an original (pb_hooks/posts.pb.js),
// each user reposts a post once, and deleting the original deletes its reposts. Each post
// keeps a `repostCount` that only the server updates (pb_hooks/counters.pb.js).
migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    posts.fields.add(
      new RelationField({
        name: 'repostOf',
        collectionId: posts.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );
    posts.fields.add(new NumberField({ name: 'repostCount', min: 0, onlyInt: true }));
    posts.addIndex('idx_posts_repost', true, 'author, repostOf', "repostOf != ''");
    posts.addIndex('idx_posts_repost_of', false, 'repostOf', '');
    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    posts.removeIndex('idx_posts_repost');
    posts.removeIndex('idx_posts_repost_of');
    posts.fields.removeByName('repostOf');
    posts.fields.removeByName('repostCount');
    app.save(posts);
  },
);
