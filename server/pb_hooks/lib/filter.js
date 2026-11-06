// Content filter (loaded with require() from the hooks). `normalize` and `findTerm` are plain
// JavaScript, so the Node tests use them directly; the rest needs PocketBase.

/** Common look-alike substitutions: "p3nd3jo", "put@". */
const LOOK_ALIKES = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

/**
 * Text reduced for comparing: lowercase, without accents, look-alikes replaced, each letter
 * once in a row ("puuuto"), and words separated by one space (punctuation is a separator).
 */
function normalize(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[013457@$]/g, (character) => LOOK_ALIKES[character])
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])\1+/g, '$1')
    .trim();
}

/**
 * The term (`{ term, action, reason }`) that appears in `text` as a whole word or phrase, or
 * `null`. A blocking term wins over one that sends to review. Words that only contain a term
 * ("computadora" and "puta") do not count.
 */
function findTerm(text, terms) {
  const haystack = ` ${normalize(text)} `;
  let review = null;
  for (const entry of terms) {
    const needle = normalize(entry.term);
    if (!needle || !haystack.includes(` ${needle} `)) continue;
    if (entry.action === 'block') return entry;
    if (!review) review = entry;
  }
  return review;
}

/**
 * The texts the filter checks in each collection, and what a review report is about (a pet
 * is reported through its owner).
 */
const FILTERED = {
  users: { kind: 'user', fields: ['username', 'bio'] },
  pets: { kind: 'user', owner: 'owner', fields: ['name', 'breed'] },
  posts: { kind: 'post', fields: ['text'] },
  comments: { kind: 'comment', fields: ['text'] },
  messages: { kind: 'message', fields: ['text'] },
  adoptions: { kind: 'adoption', fields: ['description', 'requirements', 'health', 'zone'] },
  rescue_reports: { kind: 'rescue', fields: ['description', 'place'] },
};

function loadTerms(app) {
  return app.findAllRecords('blocked_terms').map((record) => ({
    term: record.getString('term'),
    action: record.getString('action'),
    reason: record.getString('reason'),
  }));
}

/**
 * Checks the texts of a record that is being saved (on an update, only the ones that
 * changed against `original`). Throws a 400 `content_blocked` on the field with a blocking
 * term. Returns what to send to review (`{ field, term, reason }`), or `null`.
 */
function checkContent(app, record, original) {
  const config = FILTERED[record.collection().name];
  if (!config) return null;
  const terms = loadTerms(app);
  if (terms.length === 0) return null;
  let review = null;
  for (const field of config.fields) {
    const value = record.getString(field);
    if (!value || (original && original.getString(field) === value)) continue;
    const found = findTerm(value, terms);
    if (!found) continue;
    if (found.action === 'block') {
      throw new BadRequestError('This text is not allowed.', {
        [field]: new ValidationError(
          'content_blocked',
          'This text has words that are not allowed in Pawly.',
        ),
      });
    }
    if (!review) review = { field, term: found.term, reason: found.reason || 'other' };
  }
  return review;
}

/**
 * Sends a saved record to the moderation queue with an automatic report (no reporter), unless
 * one is already pending for it. Never throws: the user's action already succeeded.
 */
function fileReview(app, record, review) {
  try {
    const config = FILTERED[record.collection().name];
    const id = config.owner ? record.getString(config.owner) : record.id;
    const pending = app.findRecordsByFilter(
      'reports',
      "reporter = '' && targetKind = {:kind} && targetId = {:id} && status = 'pending'",
      '',
      1,
      0,
      { kind: config.kind, id },
    );
    if (pending.length > 0) return;
    const { reportTarget } = require(`${__hooks}/lib/moderation.js`);
    const report = new Record(app.findCollectionByNameOrId('reports'));
    report.set(config.kind, id);
    report.set('reason', review.reason);
    report.set('details', `Content filter: "${review.term}" (${review.field})`.slice(0, 500));
    const target = reportTarget(app, report);
    report.set('targetKind', target.kind);
    report.set('targetId', target.id);
    report.set('targetAuthor', target.author);
    report.set('targetText', target.text);
    report.set('status', 'pending');
    app.save(report);
  } catch (error) {
    console.log(`[pawly-filter] could not send to review: ${error}`);
  }
}

module.exports = { normalize, findTerm, FILTERED, checkContent, fileReview };
