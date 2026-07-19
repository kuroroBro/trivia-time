import test from "node:test";
import assert from "node:assert/strict";
import { defaults } from "../js/storage.js";

test("first-run settings have no preselected categories or themes", () => {
  assert.deepEqual(defaults.categories, []);
  assert.deepEqual(defaults.themes, []);
  assert.equal(defaults.questionCount, 10);
  assert.equal(defaults.timerSeconds, 30);
  assert.equal(defaults.revealAdvanceSeconds, 0);
});
