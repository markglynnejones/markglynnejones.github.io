const SESSION_ID_PATTERN = /^session-\d{4}-\d{2}-\d{2}-\d{3}$/;

function formatSessionId(date, sequence = 1) {
  return `session-${date}-${String(sequence).padStart(3, "0")}`;
}

function validSessionId(value) {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

function sessionIdDate(sessionId) {
  return validSessionId(sessionId) ? sessionId.slice(8, 18) : "";
}

function assignMissingSessionIds(matches) {
  const sessionByDate = new Map();

  for (const match of matches || []) {
    if (validSessionId(match.sessionId)) {
      const date = sessionIdDate(match.sessionId);
      if (!sessionByDate.has(date)) sessionByDate.set(date, match.sessionId);
    }
  }

  let changed = 0;
  for (const match of matches || []) {
    if (!match?.date) continue;
    if (!sessionByDate.has(match.date)) sessionByDate.set(match.date, formatSessionId(match.date));
    const sessionId = sessionByDate.get(match.date);
    if (match.sessionId !== sessionId) {
      match.sessionId = sessionId;
      changed += 1;
    }
  }

  return changed;
}

module.exports = {
  assignMissingSessionIds,
  formatSessionId,
  sessionIdDate,
  validSessionId,
};
