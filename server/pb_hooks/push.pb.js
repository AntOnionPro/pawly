/// <reference path="../pb_data/types.d.ts" />

// Push notifications. Each handler runs on its own, so shared code lives in lib/push.js.

// A token belongs to one account: saving it again (for example after switching accounts on
// the same phone) replaces the old record.
onRecordCreateRequest((e) => {
  const token = e.record.getString('token');
  if (token) {
    const existing = e.app.findRecordsByFilter('push_tokens', 'token = {:token}', '', 0, 0, {
      token,
    });
    for (const record of existing) e.app.delete(record);
  }
  e.next();
}, 'push_tokens');

// A new message: push to the other participant, unless there is a block.
onRecordAfterCreateSuccess((e) => {
  e.next();
  const { sendPush } = require(`${__hooks}/lib/push.js`);
  try {
    const message = e.record;
    const conversation = e.app.findRecordById('conversations', message.getString('conversation'));
    const sender = message.getString('sender');
    const recipient =
      conversation.getString('userA') === sender
        ? conversation.getString('userB')
        : conversation.getString('userA');
    const username = e.app.findRecordById('users', sender).getString('username');
    const text = message.getString('text');
    sendPush(e.app, recipient, (t) => ({ title: `@${username}`, body: text || t.sharedPost }), {
      type: 'message',
      conversationId: conversation.id,
    });
  } catch (error) {
    console.log(`[pawly-push] message: ${error}`);
  }
}, 'messages');

// A new in-app notification: the same as a push.
onRecordAfterCreateSuccess((e) => {
  e.next();
  const { sendPush } = require(`${__hooks}/lib/push.js`);
  try {
    const notification = e.record;
    const type = notification.getString('type');
    const actor = notification.getString('actor');
    const username = e.app.findRecordById('users', actor).getString('username');
    let comment = '';
    if (notification.getString('comment')) {
      comment = e.app
        .findRecordById('comments', notification.getString('comment'))
        .getString('text');
    }
    const adoptionId = notification.getString('adoption');
    const postId = notification.getString('post');
    let pet = '';
    let milestone = '';
    let data = { type, postId, actorId: actor };
    if (notification.getString('rescue')) {
      data = { type, rescueId: notification.getString('rescue'), actorId: actor };
    }
    if (adoptionId) {
      const adoption = e.app.findRecordById('adoptions', adoptionId);
      const petId = adoption.getString('pet');
      pet = e.app.findRecordById('pets', petId).getString('name');
      if (notification.getString('followup')) {
        milestone = e.app
          .findRecordById('adoption_followups', notification.getString('followup'))
          .getString('milestone');
      }
      // A new family and a follow-up reminder open the pet (the reminder, to post about it);
      // a follow-up update opens the post; the other adoption pushes open the listing.
      if (type === 'adopted' || type === 'followup_due') {
        data = { type, petId, actorId: actor };
      } else if (type === 'followup_posted') {
        data = { type, postId, actorId: actor };
      } else {
        data = { type, adoptionId, actorId: actor };
      }
    }
    sendPush(
      e.app,
      notification.getString('recipient'),
      (t) => ({
        title: 'Pawly',
        body: t[type](username, comment, pet, milestone ? t.milestones[milestone] : ''),
      }),
      data,
    );
  } catch (error) {
    console.log(`[pawly-push] notification: ${error}`);
  }
}, 'notifications');
