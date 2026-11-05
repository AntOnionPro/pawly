/// <reference path="../pb_data/types.d.ts" />

// Direct messages (stage 4).
// - conversations: one per pair of users (`userA` < `userB`), with a preview of the last
//   message and a "read up to" date for each participant. Only the server writes those
//   fields (pb_hooks/messages.pb.js); a participant marks the conversation as read with an
//   empty update.
// - messages: text of 1 to 1000 characters in a conversation. Only participants see and write
//   them, and nobody writes across a block.
// Reports can also be about a message.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const participant = 'userA = @request.auth.id || userB = @request.auth.id';

    const conversations = new Collection({
      type: 'base',
      name: 'conversations',
      listRule: participant,
      viewRule: participant,
      createRule:
        "@request.auth.id != '' && (@request.body.userA = @request.auth.id || @request.body.userB = @request.auth.id)",
      updateRule: participant,
      deleteRule: null,
      fields: [
        {
          type: 'relation',
          name: 'userA',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'userB',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'text', name: 'lastMessageText', max: 200 },
        { type: 'date', name: 'lastMessageAt' },
        { type: 'relation', name: 'lastSender', collectionId: users.id, maxSelect: 1 },
        { type: 'date', name: 'readA' },
        { type: 'date', name: 'readB' },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_conversations_pair ON conversations (userA, userB)',
        'CREATE INDEX idx_conversations_userB ON conversations (userB)',
        'CREATE INDEX idx_conversations_last ON conversations (lastMessageAt)',
      ],
    });
    app.save(conversations);

    const messages = new Collection({
      type: 'base',
      name: 'messages',
      listRule: 'conversation.userA = @request.auth.id || conversation.userB = @request.auth.id',
      viewRule: 'conversation.userA = @request.auth.id || conversation.userB = @request.auth.id',
      createRule: "@request.auth.id != '' && @request.body.sender = @request.auth.id",
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          type: 'relation',
          name: 'conversation',
          required: true,
          collectionId: conversations.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'sender',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        // Trimmed in pb_hooks/messages.pb.js, so only spaces count as empty.
        { type: 'text', name: 'text', required: true, min: 1, max: 1000 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE INDEX idx_messages_conversation ON messages (conversation, created)'],
    });
    app.save(messages);

    const reports = app.findCollectionByNameOrId('reports');
    reports.fields.add(
      new RelationField({
        name: 'message',
        collectionId: messages.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );
    reports.addIndex('idx_reports_message', true, 'reporter, message', "message != ''");
    app.save(reports);
  },
  (app) => {
    const reports = app.findCollectionByNameOrId('reports');
    reports.removeIndex('idx_reports_message');
    reports.fields.removeByName('message');
    app.save(reports);
    app.delete(app.findCollectionByNameOrId('messages'));
    app.delete(app.findCollectionByNameOrId('conversations'));
  },
);
