/// <reference path="../pb_data/types.d.ts" />

// Direct messages. Each handler runs on its own, so shared code lives in lib/moderation.js.

// A new conversation: the pair is stored in order (userA < userB) so each pair has one
// conversation, nobody talks to themselves, nobody talks across a block, and the preview and
// read fields start empty.
onRecordCreateRequest((e) => {
  const { hasBlock } = require(`${__hooks}/lib/moderation.js`);
  const record = e.record;
  let a = record.getString('userA');
  let b = record.getString('userB');
  if (a && b && a > b) {
    [a, b] = [b, a];
    record.set('userA', a);
    record.set('userB', b);
  }
  if (a && a === b) {
    throw new BadRequestError('Invalid conversation.', {
      userB: new ValidationError('conversation_self', 'You cannot message yourself.'),
    });
  }
  if (a && b && hasBlock(e.app, a, b)) {
    throw new BadRequestError('Blocked.', {
      userB: new ValidationError('blocked', 'There is a block between these users.'),
    });
  }
  for (const field of ['lastMessageText', 'lastMessageAt', 'lastSender', 'readA', 'readB']) {
    record.set(field, '');
  }
  e.next();
}, 'conversations');

// Updating a conversation only marks it as read for the participant who sends the request;
// every other field keeps its value.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }
  const record = e.record;
  const original = record.original();
  const fields = [
    'userA',
    'userB',
    'lastMessageText',
    'lastMessageAt',
    'lastSender',
    'readA',
    'readB',
  ];
  for (const field of fields) {
    record.set(field, original.get(field));
  }
  const me = e.auth ? e.auth.id : '';
  if (me === original.getString('userA')) record.set('readA', new DateTime());
  if (me === original.getString('userB')) record.set('readB', new DateTime());
  e.next();
}, 'conversations');

// A message: trimmed text or a post (or both), written by a participant, and not across a
// block. `hasPost` is set here, never by the app.
onRecordCreateRequest((e) => {
  const { hasBlock } = require(`${__hooks}/lib/moderation.js`);
  const record = e.record;
  record.set('text', record.getString('text').trim());
  const hasPost = record.getString('post') !== '';
  record.set('hasPost', hasPost);
  if (!hasPost && !record.getString('text')) {
    throw new BadRequestError('Invalid message.', {
      text: new ValidationError('message_empty', 'Write a message or share a post.'),
    });
  }
  let conversation = null;
  try {
    conversation = e.app.findRecordById('conversations', record.getString('conversation'));
  } catch {
    // A missing conversation is rejected by the relation field.
  }
  if (conversation) {
    const a = conversation.getString('userA');
    const b = conversation.getString('userB');
    const sender = record.getString('sender');
    if (sender !== a && sender !== b) {
      throw new ForbiddenError('Only the participants can write in this conversation.');
    }
    if (hasBlock(e.app, a, b)) {
      throw new BadRequestError('Blocked.', {
        conversation: new ValidationError('blocked', 'There is a block between these users.'),
      });
    }
  }
  e.next();
}, 'messages');

// After a message: the conversation shows it as the last one, and the sender has read it.
onRecordAfterCreateSuccess((e) => {
  e.next();
  const message = e.record;
  const conversation = e.app.findRecordById('conversations', message.getString('conversation'));
  const sender = message.getString('sender');
  const sentAt = message.getDateTime('created');
  conversation.set('lastMessageText', message.getString('text').slice(0, 200));
  conversation.set('lastMessageAt', sentAt);
  conversation.set('lastSender', sender);
  conversation.set(sender === conversation.getString('userA') ? 'readA' : 'readB', sentAt);
  e.app.save(conversation);
}, 'messages');
