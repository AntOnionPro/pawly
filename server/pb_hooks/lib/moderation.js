// Blocks and reports, shared by the hooks (loaded with require()).

/** Whether `userId` is blocked by `byId`. */
function isBlockedBy(app, userId, byId) {
  const found = app.findRecordsByFilter(
    'blocks',
    'blocker = {:by} && blocked = {:user}',
    '',
    1,
    0,
    { by: byId, user: userId },
  );
  return found.length > 0;
}

/** Whether either user blocked the other. */
function hasBlock(app, a, b) {
  return isBlockedBy(app, a, b) || isBlockedBy(app, b, a);
}

/** What can be reported: a user, or content that has an author and some text. */
const REPORT_KINDS = ['post', 'comment', 'user', 'message', 'adoption', 'rescue'];
const CONTENT = {
  post: { collection: 'posts', author: 'author', text: ['text'] },
  comment: { collection: 'comments', author: 'author', text: ['text'] },
  message: { collection: 'messages', author: 'sender', text: ['text'] },
  adoption: {
    collection: 'adoptions',
    author: 'publisher',
    text: ['description', 'requirements', 'health'],
  },
  rescue: { collection: 'rescue_reports', author: 'reporter', text: ['description', 'place'] },
};
/** Same as `targetText` in pb_migrations/…_report_review.js. */
const TARGET_TEXT_MAX = 2200;

/**
 * What a report is about: its kind and id, who wrote it (or the reported user) and a copy of
 * its text. `author` and `text` are empty when it does not exist.
 */
function reportTarget(app, report) {
  const kind = REPORT_KINDS.find((name) => report.getString(name) !== '') || '';
  const id = kind ? report.getString(kind) : '';
  let author = '';
  let text = '';
  try {
    if (kind === 'user') {
      const user = app.findRecordById('users', id);
      author = user.id;
      text = `@${user.getString('username')}\n${user.getString('bio')}`.trim();
    } else if (kind) {
      const content = CONTENT[kind];
      const record = app.findRecordById(content.collection, id);
      author = record.getString(content.author);
      text = content.text
        .map((field) => record.getString(field))
        .filter(Boolean)
        .join('\n');
    }
  } catch {
    // Not found: the report is rejected by its relation field.
  }
  return { kind, id, author, text: text.slice(0, TARGET_TEXT_MAX) };
}

/** Deletes the reported content, if it still exists. Returns whether it deleted it. */
function removeContent(app, kind, id) {
  const content = CONTENT[kind];
  if (!content || !id) return false;
  let record;
  try {
    record = app.findRecordById(content.collection, id);
  } catch {
    return false;
  }
  app.delete(record);
  return true;
}

module.exports = { hasBlock, isBlockedBy, REPORT_KINDS, reportTarget, removeContent };
