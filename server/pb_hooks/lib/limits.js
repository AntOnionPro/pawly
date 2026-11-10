// Limits against spam: how many things each account can create in a period (loaded with
// require() from the hooks). `limitFor` is plain JavaScript and the Node tests use it; the
// rest needs PocketBase. PAWLY_LIMITS=off turns the limits off (the other test files do).

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * For each collection: who created the record (`owner`) and the most records per period
 * (`[count, milliseconds]`). Same table as the server README.
 */
const LIMITS = {
  posts: {
    owner: 'author',
    windows: [
      [10, HOUR],
      [30, DAY],
    ],
  },
  comments: {
    owner: 'author',
    windows: [
      [30, 10 * MINUTE],
      [300, DAY],
    ],
    repeat: true,
  },
  messages: {
    owner: 'sender',
    windows: [
      [60, 10 * MINUTE],
      [600, DAY],
    ],
    repeat: true,
  },
  conversations: { owner: 'startedBy', windows: [[20, DAY]] },
  follows: {
    owner: 'follower',
    windows: [
      [60, HOUR],
      [300, DAY],
    ],
  },
  reports: { owner: 'reporter', windows: [[20, DAY]] },
  adoptions: { owner: 'publisher', windows: [[5, DAY]] },
  adoption_requests: { owner: 'applicant', windows: [[10, DAY]] },
  rescue_reports: { owner: 'reporter', windows: [[10, DAY]] },
  rescue_helpers: { owner: 'helper', windows: [[20, DAY]] },
  verification_requests: { owner: 'user', windows: [[3, DAY]] },
};

/** Accounts younger than this get half of each limit. */
const NEW_ACCOUNT = DAY;

/** The same comment or message (this long or longer) only this many times in the period. */
const REPEAT = { times: 3, within: 10 * MINUTE, minLength: 20 };

/** The limit that applies to an account: half (rounded up) while it is new. */
function limitFor(max, isNew) {
  return isNew ? Math.ceil(max / 2) : max;
}

/** A date as PocketBase stores it, `ms` before `now`. */
function before(now, ms) {
  return new Date(now - ms).toISOString().replace('T', ' ');
}

function tooMany() {
  const message = 'Too many requests. Try again in a few minutes.';
  return new ApiError(429, message, { limit: new ValidationError('rate_limited', message) });
}

/**
 * Throws a 429 `rate_limited` when `user` already created as many records in `collection` as
 * a period allows, or (for comments and messages) sent the same text too many times.
 */
function checkLimits(app, collection, record, user, now = Date.now()) {
  const config = LIMITS[collection];
  if (!config || !user || $os.getenv('PAWLY_LIMITS') === 'off') return;
  const created = new Date(user.getString('created').replace(' ', 'T')).getTime();
  const isNew = !(now - created >= NEW_ACCOUNT);
  const owner = `[[${config.owner}]] = {:user}`;
  for (const [max, period] of config.windows) {
    const count = app.countRecords(
      collection,
      $dbx.exp(`${owner} AND [[created]] > {:since}`, {
        user: user.id,
        since: before(now, period),
      }),
    );
    if (count >= limitFor(max, isNew)) throw tooMany();
  }
  const text = config.repeat ? record.getString('text') : '';
  if (text.trim().length >= REPEAT.minLength) {
    const same = app.countRecords(
      collection,
      $dbx.exp(`${owner} AND [[created]] > {:since} AND [[text]] = {:text}`, {
        user: user.id,
        since: before(now, REPEAT.within),
        text,
      }),
    );
    if (same >= REPEAT.times) throw tooMany();
  }
}

module.exports = { LIMITS, NEW_ACCOUNT, REPEAT, limitFor, checkLimits };
