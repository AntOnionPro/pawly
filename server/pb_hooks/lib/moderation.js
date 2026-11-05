// Block checks shared by the hooks (loaded with require()).

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

module.exports = { hasBlock, isBlockedBy };
