import { displayAnswers, judgeAnswer } from "./matcher.js";

export const MAX_PLAYERS = 12;
export const CATEGORIES = [
  "Movies", "Books", "The '90s", "Food & Drink", "Animals", "Science",
  "Sports", "Music", "TV Shows", "General Knowledge", "Philippine History", "Philippine Geography",
  "Filipino Culture & Language", "Filipino Entertainment",
];

const fail = (error) => ({ ok: false, error });
const cleanName = (name) => String(name || "").trim().slice(0, 20);

export function createRoom(code, hostId) {
  return {
    code, hostId, phase: "lobby", players: [], deck: [], roundIndex: -1,
    settings: { categories: [...CATEGORIES], themes: [], questionCount: 10, timerSeconds: 30, revealAdvanceSeconds: 0 },
    questionStartedAt: null, questionDeadlineAt: null, revealStartedAt: null,
    lastResult: null, winnerIds: [], scoredRound: null,
  };
}

export function addPlayer(room, id, name, resumeToken = null) {
  if (room.phase !== "lobby") return fail("The game has already started.");
  const safe = cleanName(name);
  if (!safe) return fail("Enter a name.");
  if (room.players.length >= MAX_PLAYERS) return fail("This room is full.");
  if (room.players.some((p) => p.name.toLowerCase() === safe.toLowerCase())) return fail("That name is already taken.");
  room.players.push({ id, name: safe, score: 0, connected: true, resumeToken, answerText: null, locked: false });
  return { ok: true };
}

export function rejoinPlayer(room, newId, token) {
  const player = room.players.find((p) => token && p.resumeToken === token);
  if (!player) return fail("Saved seat not found.");
  player.id = newId;
  player.connected = true;
  return { ok: true, player };
}

export function renamePlayer(room, id, name) {
  if (room.phase !== "lobby") return fail("Names can only change in the lobby.");
  const player = room.players.find((p) => p.id === id);
  const safe = cleanName(name);
  if (!player || !safe) return fail("Enter a valid name.");
  if (room.players.some((p) => p.id !== id && p.name.toLowerCase() === safe.toLowerCase())) return fail("That name is already taken.");
  player.name = safe;
  return { ok: true };
}

export function disconnectPlayer(room, id, now = Date.now()) {
  const p = room.players.find((x) => x.id === id);
  if (!p) return;
  if (room.phase === "lobby") room.players = room.players.filter((x) => x.id !== id);
  else p.connected = false;
  if (room.phase === "question" && room.players.some((x) => x.connected) && allAnswered(room)) resolveRound(room, now);
}

function shuffle(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildDeck(pool, settings, usedIds = [], rng = Math.random) {
  const selectedThemes = settings.themes || [];
  const explicitCategories = settings.categories?.length ? settings.categories : (selectedThemes.length ? [] : CATEGORIES);
  const impliedCategories = pool.filter((q) => selectedThemes.includes(q.theme)).map((q) => q.category);
  const categories = [...new Set([...explicitCategories, ...impliedCategories])];
  const themedCategories = new Set(pool.filter((q) => selectedThemes.includes(q.theme)).map((q) => q.category));
  const eligible = pool.filter((q) => categories.includes(q.category) && !usedIds.includes(q.id) &&
    (!themedCategories.has(q.category) || selectedThemes.includes(q.theme)));
  const count = Math.max(6, Math.min(20, Number(settings.questionCount) || 10));
  if (eligible.length < count) return fail(`Only ${eligible.length} fresh questions match these filters. Choose more categories or reset history.`);
  const groups = new Map(categories.map((c) => [c, shuffle(eligible.filter((q) => q.category === c), rng)]));
  const deck = [];
  const order = shuffle(categories.filter((c) => groups.get(c)?.length), rng);
  while (deck.length < count) {
    let added = false;
    for (const category of order) {
      const item = groups.get(category).pop();
      if (item) { deck.push(item); added = true; }
      if (deck.length === count) break;
    }
    if (!added) break;
  }
  return { ok: true, deck: shuffle(deck, rng) };
}

function resetAnswers(room) {
  for (const p of room.players) { p.answerText = null; p.locked = false; }
}

export function startGame(room, byId, { pool, settings, usedIds = [], rng = Math.random, now = Date.now() }) {
  if (byId !== room.hostId) return fail("Only the Host can start.");
  if (room.phase !== "lobby") return fail("The game has already started.");
  room.players = room.players.filter((p) => p.connected);
  if (!room.players.length) return fail("At least one player must join.");
  const built = buildDeck(pool, settings, usedIds, rng);
  if (!built.ok) return built;
  room.settings = { ...room.settings, ...settings };
  room.deck = built.deck;
  room.roundIndex = 0;
  room.phase = "question";
  room.lastResult = null;
  room.winnerIds = [];
  for (const p of room.players) p.score = 0;
  resetAnswers(room);
  room.questionStartedAt = now;
  room.questionDeadlineAt = room.settings.timerSeconds ? now + room.settings.timerSeconds * 1000 : null;
  return { ok: true, usedIds: room.deck.map((q) => q.id) };
}

export function allAnswered(room) {
  const connected = room.players.filter((p) => p.connected);
  return connected.length > 0 && connected.every((p) => p.locked);
}

export function submitAnswer(room, playerId, answerText, now = Date.now()) {
  if (room.phase !== "question") return fail("Answers are closed.");
  const player = room.players.find((p) => p.id === playerId && p.connected);
  if (!player) return fail("Player not found.");
  if (player.locked) return fail("Your answer is already locked.");
  const answer = String(answerText || "").trim().slice(0, 100);
  if (!answer) return fail("Type an answer first.");
  player.answerText = answer;
  player.locked = true;
  if (allAnswered(room)) resolveRound(room, now);
  return { ok: true };
}

export function checkTimerExpired(room, now = Date.now()) {
  if (room.phase !== "question" || !room.questionDeadlineAt || now < room.questionDeadlineAt) return false;
  resolveRound(room, now);
  return true;
}

export function resolveRound(room, now = Date.now()) {
  if (room.phase !== "question") return fail("Round is not open.");
  const q = room.deck[room.roundIndex];
  const results = room.players.map((p) => {
    const auto = judgeAnswer(p.locked ? p.answerText : null, q);
    if (auto.correct) p.score += 1;
    return { playerId: p.id, name: p.name, answerText: p.locked ? p.answerText : null, correct: auto.correct,
      autoCorrect: auto.correct, reason: auto.reason, matchedAlias: auto.matchedAlias, override: null, score: p.score };
  });
  room.lastResult = { questionId: q.id, category: q.category, theme: q.theme || null, prompt: q.prompt,
    answer: q.answer, acceptedAnswers: displayAnswers(q), explanation: q.explanation, results };
  room.phase = "reveal";
  room.scoredRound = room.roundIndex;
  room.revealStartedAt = now;
  room.questionDeadlineAt = null;
  return { ok: true };
}

export function overrideJudgment(room, byId, playerId, correct, now = Date.now()) {
  if (byId !== room.hostId || room.phase !== "reveal") return fail("Only the Host can correct revealed answers.");
  const res = room.lastResult?.results.find((r) => r.playerId === playerId);
  const player = room.players.find((p) => p.id === playerId);
  if (!res || !player) return fail("Player result not found.");
  const next = Boolean(correct);
  if (res.correct !== next) player.score += next ? 1 : -1;
  res.correct = next;
  res.override = next;
  res.reason = "Host override";
  for (const row of room.lastResult.results) row.score = room.players.find((p) => p.id === row.playerId)?.score || 0;
  room.revealStartedAt = now;
  return { ok: true };
}

export function advanceRound(room, byId, now = Date.now()) {
  if (byId !== room.hostId || room.phase !== "reveal") return fail("Only the Host can advance.");
  if (room.roundIndex + 1 >= room.deck.length) {
    room.phase = "over";
    const best = Math.max(...room.players.map((p) => p.score));
    room.winnerIds = room.players.filter((p) => p.score === best).map((p) => p.id);
    return { ok: true };
  }
  room.roundIndex += 1;
  room.phase = "question";
  room.lastResult = null;
  resetAnswers(room);
  room.questionStartedAt = now;
  room.questionDeadlineAt = room.settings.timerSeconds ? now + room.settings.timerSeconds * 1000 : null;
  return { ok: true };
}

export function resetToLobby(room, byId) {
  if (byId !== room.hostId || room.phase !== "over") return fail("Only the Host can start a rematch.");
  room.phase = "lobby"; room.deck = []; room.roundIndex = -1; room.lastResult = null; room.winnerIds = [];
  room.players = room.players.filter((p) => p.connected).map((p) => ({ ...p, score: 0, answerText: null, locked: false }));
  return { ok: true };
}

export function toPublicState(room, viewerId, now = Date.now()) {
  const common = { code: room.code, hostId: room.hostId, phase: room.phase, settings: room.settings,
    roundIndex: room.roundIndex, deckLength: room.deck.length, questionDeadlineAt: room.questionDeadlineAt,
    revealStartedAt: room.revealStartedAt, winnerIds: [...room.winnerIds], hostNow: now,
    players: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score, connected: p.connected,
      locked: room.phase === "question" ? p.locked : undefined,
      myAnswer: room.phase === "question" && p.id === viewerId ? p.answerText : undefined })),
  };
  if (room.phase === "question") {
    const q = room.deck[room.roundIndex];
    common.question = { id: q.id, category: q.category, theme: q.theme || null, prompt: q.prompt, image: q.image, imageAlt: q.imageAlt };
  }
  if (room.phase === "reveal") common.lastResult = structuredClone(room.lastResult);
  if (room.phase === "over") common.standings = [...room.players].sort((a, b) => b.score - a.score).map((p) => ({ id: p.id, name: p.name, score: p.score }));
  return common;
}
