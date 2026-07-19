import test from "node:test";
import assert from "node:assert/strict";
import { reconcileDraft } from "../js/draft.js";

test("same-question broadcasts preserve an unlocked local draft and focus", () => {
  const result = reconcileDraft({
    questionId: "science-001",
    draftQuestionId: "science-001",
    answerDraft: "partially typed ans",
    serverAnswer: null,
    locked: false,
  });
  assert.equal(result.answerDraft, "partially typed ans");
  assert.equal(result.shouldWrite, false);
  assert.equal(result.shouldFocus, false);
});

test("a new question clears the old draft and requests initial focus", () => {
  const result = reconcileDraft({
    questionId: "science-002",
    draftQuestionId: "science-001",
    answerDraft: "old answer",
    serverAnswer: null,
    locked: false,
  });
  assert.equal(result.answerDraft, "");
  assert.equal(result.shouldWrite, true);
  assert.equal(result.shouldFocus, true);
});

test("the locked server answer becomes authoritative", () => {
  const result = reconcileDraft({
    questionId: "science-001",
    draftQuestionId: "science-001",
    answerDraft: "draft",
    serverAnswer: "final answer",
    locked: true,
  });
  assert.equal(result.answerDraft, "final answer");
  assert.equal(result.shouldWrite, true);
  assert.equal(result.shouldFocus, false);
});
