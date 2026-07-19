import test from "node:test";
import assert from "node:assert/strict";
import * as game from "../js/game.js";
import { QUESTIONS } from "../js/questions.js";

function started(count = 6) {
  const room = game.createRoom("TEST", "host");
  game.addPlayer(room, "host", "Host", "h");
  game.addPlayer(room, "p2", "Player", "p");
  const res = game.startGame(room, "host", { pool: QUESTIONS, settings: { categories: ["Science"], themes: [], questionCount: count, timerSeconds: 30, revealAdvanceSeconds: 0 }, rng: () => 0.2, now: 1000 });
  assert.equal(res.ok, true);
  return room;
}

test("bank has at least 20 questions in all 15 categories", () => {
  assert.equal(QUESTIONS.length, 385);
  for (const category of game.CATEGORIES) assert.ok(QUESTIONS.filter((q) => q.category === category).length >= 20, category);
  for (const theme of ["Star Wars", "Marvel Cinematic Universe", "Disney & Pixar", "The Lord of the Rings", "Jurassic Park", "Studio Ghibli", "Friends", "Grey's Anatomy", "Young Sheldon", "The Big Bang Theory", "How I Met Your Mother"]) {
    assert.ok(QUESTIONS.filter((q) => q.theme === theme).length >= 10, theme);
  }
});

test("general and Filipino categories are separate exhaustive groups", () => {
  assert.equal(game.GENERAL_CATEGORIES.includes("Food & Drink"), true);
  assert.equal(game.GENERAL_CATEGORIES.includes("Filipino Food & Drink"), false);
  assert.equal(game.FILIPINO_CATEGORIES.includes("Filipino Food & Drink"), true);
  assert.equal(game.FILIPINO_CATEGORIES.includes("Food & Drink"), false);
  assert.deepEqual([...game.GENERAL_CATEGORIES, ...game.FILIPINO_CATEGORIES], game.CATEGORIES);
});

test("typed answers are private before reveal", () => {
  const room = started();
  game.submitAnswer(room, "host", room.deck[0].answer, 1100);
  const playerView = game.toPublicState(room, "p2", 1100);
  assert.equal(playerView.players.find((p) => p.id === "host").myAnswer, undefined);
  assert.equal(playerView.question.answer, undefined);
});

test("Host automatically judges and scores when everyone locks", () => {
  const room = started();
  const answer = room.deck[0].answer;
  game.submitAnswer(room, "host", answer.toLowerCase(), 1100);
  game.submitAnswer(room, "p2", "definitely wrong", 1200);
  assert.equal(room.phase, "reveal");
  assert.equal(room.players.find((p) => p.id === "host").score, 1);
  assert.equal(room.lastResult.results.find((r) => r.playerId === "p2").correct, false);
});

test("Host correction applies only the score delta", () => {
  const room = started();
  game.submitAnswer(room, "host", "wrong", 1100);
  game.submitAnswer(room, "p2", "wrong", 1200);
  game.overrideJudgment(room, "host", "p2", true, 1300);
  game.overrideJudgment(room, "host", "p2", true, 1400);
  assert.equal(room.players.find((p) => p.id === "p2").score, 1);
});

test("last round reveals before final standings", () => {
  const room = started(6);
  for (let i = 0; i < 6; i++) {
    game.submitAnswer(room, "host", room.deck[i].answer, 1100 + i);
    game.submitAnswer(room, "p2", "wrong", 1200 + i);
    assert.equal(room.phase, "reveal");
    game.advanceRound(room, "host", 1300 + i);
  }
  assert.equal(room.phase, "over");
  assert.deepEqual(room.winnerIds, ["host"]);
});

test("theme filtering selects the requested movie theme", () => {
  const res = game.buildDeck(QUESTIONS, { categories: ["Movies"], themes: ["Star Wars"], questionCount: 6 }, [], () => 0.1);
  assert.equal(res.ok, true);
  assert.ok(res.deck.every((q) => q.theme === "Star Wars"));
});

test("selecting a theme includes its parent category automatically", () => {
  const res = game.buildDeck(QUESTIONS, { categories: [], themes: ["Friends"], questionCount: 6 }, [], () => 0.1);
  assert.equal(res.ok, true);
  assert.ok(res.deck.every((q) => q.category === "TV Shows" && q.theme === "Friends"));
});
