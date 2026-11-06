// Creates in-app notifications (loaded with require() from the hooks).

/**
 * Notifies `recipient` that `actor` did something (`type`), unless it is about themselves, the
 * recipient blocked the actor, or (with `once`) the same notification already exists. `post`,
 * `comment`, `adoption`, `followup` and `rescue` say what it is about (and `distanceKm`, how far
 * a nearby case is). Never throws: a notification must
 * not make the user's action fail.
 */
function notify(
  app,
  {
    recipient,
    actor,
    type,
    post = '',
    comment = '',
    adoption = '',
    followup = '',
    rescue = '',
    distanceKm = 0,
    once = false,
  },
) {
  try {
    if (!recipient || !actor || recipient === actor) return;
    const { isBlockedBy } = require(`${__hooks}/lib/moderation.js`);
    if (isBlockedBy(app, actor, recipient)) return;
    if (once) {
      const existing = app.findRecordsByFilter(
        'notifications',
        'recipient = {:recipient} && actor = {:actor} && type = {:type} && post = {:post}',
        '',
        1,
        0,
        { recipient, actor, type, post },
      );
      if (existing.length > 0) return;
    }
    const collection = app.findCollectionByNameOrId('notifications');
    const record = new Record(collection);
    record.set('recipient', recipient);
    record.set('actor', actor);
    record.set('type', type);
    record.set('post', post);
    record.set('comment', comment);
    record.set('adoption', adoption);
    record.set('followup', followup);
    record.set('rescue', rescue);
    record.set('distanceKm', distanceKm);
    record.set('read', false);
    app.save(record);
  } catch (error) {
    console.log(`[pawly-notifications] could not notify: ${error}`);
  }
}

/**
 * Notifies `recipient` of something from Pawly itself (no actor): a report review.
 * `contentKind` and `reportReason` say what it is about. Never throws.
 */
function notifyFromPawly(app, { recipient, type, contentKind = '', reportReason = '' }) {
  try {
    if (!recipient) return;
    const record = new Record(app.findCollectionByNameOrId('notifications'));
    record.set('recipient', recipient);
    record.set('type', type);
    record.set('contentKind', contentKind);
    record.set('reportReason', reportReason);
    record.set('read', false);
    app.save(record);
  } catch (error) {
    console.log(`[pawly-notifications] could not notify: ${error}`);
  }
}

/** Author of a post, or '' if it does not exist. */
function postAuthor(app, postId) {
  try {
    return app.findRecordById('posts', postId).getString('author');
  } catch {
    return '';
  }
}

module.exports = { notify, notifyFromPawly, postAuthor };
