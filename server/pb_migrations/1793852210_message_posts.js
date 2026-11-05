/// <reference path="../pb_data/types.d.ts" />

// A message can carry a post (sharing a post by direct message, stage 4). Then its text is
// optional. If the post is deleted, `post` becomes empty but `hasPost` (set by the server)
// stays true, so the app can say the post is no longer available.
migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId('posts');
    const messages = app.findCollectionByNameOrId('messages');
    messages.fields.add(
      new RelationField({
        name: 'post',
        collectionId: posts.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );
    messages.fields.add(new BoolField({ name: 'hasPost' }));
    // Text or a post is required (checked in pb_hooks/messages.pb.js).
    const text = messages.fields.getByName('text');
    text.required = false;
    text.min = 0;
    app.save(messages);
  },
  (app) => {
    const messages = app.findCollectionByNameOrId('messages');
    messages.fields.removeByName('post');
    messages.fields.removeByName('hasPost');
    const text = messages.fields.getByName('text');
    text.required = true;
    text.min = 1;
    app.save(messages);
  },
);
