import test from "node:test";
import assert from "node:assert/strict";
import { editDistance, judgeAnswer, normalizeText } from "../js/matcher.js";

const q = (answer, acceptedAnswers = [answer], match = { mode: "text", fuzzy: true, optionalArticles: true }) => ({ answer, acceptedAnswers, match });

test("normalizes case, diacritics, spacing, and optional articles", () => {
  assert.equal(normalizeText("  The  JOSÉ   RIZAL! ", { optionalArticles: true }), "jose rizal");
  assert.equal(judgeAnswer("Jose Rizal", q("José Rizal")).correct, true);
});

test("accepts explicit aliases and conservative typos", () => {
  assert.equal(judgeAnswer("Princess Leia", q("Leia Organa", ["Leia Organa", "Princess Leia"])).correct, true);
  assert.equal(judgeAnswer("Millenium Falcon", q("Millennium Falcon")).reason, "fuzzy typo");
  assert.equal(judgeAnswer("cat", q("car")).correct, false);
});

test("accepts cacao aliases for the chocolate bean question", () => {
  const chocolate = q("Cocoa bean", ["Cocoa bean", "cacao", "cacao bean", "cacao beans", "cocoa", "cocoa beans"]);
  for (const answer of ["cacao", "cacao bean", "cacao beans", "cocoa", "cocoa beans"]) {
    assert.equal(judgeAnswer(answer, chocolate).correct, true, answer);
  }
});

test("years require an exact four digit answer", () => {
  const year = q("1997", ["1997"], { mode: "year" });
  assert.equal(judgeAnswer("1997", year).correct, true);
  assert.equal(judgeAnswer("1998", year).correct, false);
});

test("edit distance is bounded", () => {
  assert.equal(editDistance("kitten", "sitten", 1), 1);
  assert.equal(editDistance("kitten", "sunday", 1), 2);
});
