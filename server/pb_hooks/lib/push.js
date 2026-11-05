// Sends push notifications with Expo Push Service (loaded with require() from the hooks).
// PAWLY_PUSH_URL changes the address (the tests use a fake one).

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_BODY = 120;

/** Texts in each app language. */
const TEXTS = {
  es: {
    paw: (u) => `@${u} dejó una huella en tu publicación.`,
    comment: (u, text) => `@${u} comentó: “${text}”`,
    follow: (u) => `@${u} empezó a seguirte.`,
    repost: (u) => `@${u} republicó tu publicación.`,
    adoption_request: (u, _, pet) => `@${u} quiere adoptar a ${pet}.`,
    request_accepted: (u, _, pet) => `@${u} aceptó tu solicitud para adoptar a ${pet}.`,
    request_rejected: (u, _, pet) => `@${u} no aceptó tu solicitud para adoptar a ${pet}.`,
    sharedPost: 'Compartió una publicación',
  },
  en: {
    paw: (u) => `@${u} left a paw print on your post.`,
    comment: (u, text) => `@${u} commented: “${text}”`,
    follow: (u) => `@${u} started following you.`,
    repost: (u) => `@${u} reposted your post.`,
    adoption_request: (u, _, pet) => `@${u} wants to adopt ${pet}.`,
    request_accepted: (u, _, pet) => `@${u} accepted your request to adopt ${pet}.`,
    request_rejected: (u, _, pet) => `@${u} declined your request to adopt ${pet}.`,
    sharedPost: 'Shared a post',
  },
};

function short(text) {
  return text.length > MAX_BODY ? `${text.slice(0, MAX_BODY - 1)}…` : text;
}

function texts(language) {
  return TEXTS[language] || TEXTS.es;
}

/** Push types that share one preference: every adoption notification is "adoption". */
const PREFERENCE = {
  adoption_request: 'adoption',
  request_accepted: 'adoption',
  request_rejected: 'adoption',
};

/** Whether `userId` wants pushes of `type` (paw, comment, follow, repost, message, adoption…). */
function wantsPush(app, userId, type) {
  try {
    const prefs = app.findFirstRecordByFilter('notification_prefs', 'user = {:user}', {
      user: userId,
    });
    return !prefs.getBool(`${PREFERENCE[type] || type}Off`);
  } catch {
    // No preferences saved yet: everything is on.
    return true;
  }
}

/**
 * Sends a push to every device of `userId`, unless they turned off pushes of `data.type`.
 * `build(texts)` returns `{ title, body }` in the device's language; `data` tells the app what
 * to open. Tokens Expo reports as no longer
 * registered are deleted. Never throws: a push must not make the user's action fail.
 */
function sendPush(app, userId, build, data) {
  try {
    if (!wantsPush(app, userId, data.type)) return;
    const tokens = app.findRecordsByFilter('push_tokens', 'user = {:user}', '', 20, 0, {
      user: userId,
    });
    if (tokens.length === 0) return;
    const messages = tokens.map((token) => {
      const { title, body } = build(texts(token.getString('language')));
      return { to: token.getString('token'), title, body: short(body), data, sound: 'default' };
    });
    const response = $http.send({
      url: $os.getenv('PAWLY_PUSH_URL') || EXPO_PUSH_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
      timeout: 5,
    });
    if (response.statusCode !== 200) {
      console.log(`[pawly-push] Expo answered ${response.statusCode}`);
      return;
    }
    const tickets = (response.json && response.json.data) || [];
    tickets.forEach((ticket, index) => {
      const gone = ticket && ticket.details && ticket.details.error === 'DeviceNotRegistered';
      if (gone && tokens[index]) app.delete(tokens[index]);
    });
  } catch (error) {
    console.log(`[pawly-push] could not send: ${error}`);
  }
}

module.exports = { sendPush, wantsPush };
