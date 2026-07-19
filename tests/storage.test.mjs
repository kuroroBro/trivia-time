import test from "node:test";
import assert from "node:assert/strict";
import { defaults, loadSettings, loadUsedIds, markUsedIds, resetUsedIds, saveSettings } from "../js/storage.js";

test("first-run settings have no preselected categories or themes", () => {
  assert.deepEqual(defaults.categories, []);
  assert.deepEqual(defaults.themes, []);
  assert.equal(defaults.questionCount, 10);
  assert.equal(defaults.timerSeconds, 30);
  assert.equal(defaults.revealAdvanceSeconds, 0);
});

test("question-history reset clears used IDs but retains Host settings", () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  saveSettings({ ...defaults, name: "Host", categories: ["Science"] });
  markUsedIds(["science-001", "science-002", "science-001"]);
  assert.deepEqual(loadUsedIds(), ["science-001", "science-002"]);
  assert.equal(resetUsedIds(), 2);
  assert.deepEqual(loadUsedIds(), []);
  assert.equal(loadSettings().name, "Host");
  assert.deepEqual(loadSettings().categories, ["Science"]);
  delete globalThis.localStorage;
});
