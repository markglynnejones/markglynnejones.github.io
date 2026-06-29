"use strict";

const MATCH_ID_PATTERN = /^\d{4}-\d{2}-\d{2}-\d{3}$/;

function validMatchId(value) {
  return MATCH_ID_PATTERN.test(String(value || ""));
}

function matchIdDate(value) {
  return validMatchId(value) ? String(value).slice(0, 10) : "";
}

function matchIdSequence(value) {
  return validMatchId(value) ? Number(String(value).slice(11)) : 0;
}

function formatMatchId(date, sequence) {
  return `${date}-${String(sequence).padStart(3, "0")}`;
}

function createMatchIdGenerator(existingMatches = []) {
  const nextByDate = new Map();

  for (const match of existingMatches) {
    const id = match?.id;
    if (!validMatchId(id)) continue;

    const date = matchIdDate(id);
    const sequence = matchIdSequence(id);
    nextByDate.set(date, Math.max(nextByDate.get(date) || 1, sequence + 1));
  }

  return function nextMatchId(date) {
    const key = String(date || "");
    const next = nextByDate.get(key) || 1;
    nextByDate.set(key, next + 1);
    return formatMatchId(key, next);
  };
}

function assignMissingMatchIds(matches = []) {
  const nextMatchId = createMatchIdGenerator(matches);
  let assigned = 0;

  for (const match of matches) {
    if (match?.id) continue;
    match.id = nextMatchId(match.date);
    assigned++;
  }

  return assigned;
}

module.exports = {
  MATCH_ID_PATTERN,
  assignMissingMatchIds,
  createMatchIdGenerator,
  formatMatchId,
  matchIdDate,
  validMatchId,
};
