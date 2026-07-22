import test from "node:test";
import assert from "node:assert/strict";
import { editDistance, judgeAnswer, normalizeText, numberWordValue } from "../js/matcher.js";
import { QUESTIONS } from "../js/questions.js";

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

test("digits and number words are interchangeable", () => {
  assert.equal(judgeAnswer("7", q("Seven")).correct, true);
  assert.equal(judgeAnswer("seven", q("7")).correct, true);
  assert.equal(judgeAnswer("Twenty-one", q("21")).correct, true);
  assert.equal(judgeAnswer("ninety", q("90", ["90"], { mode: "number" })).correct, true);
  assert.equal(judgeAnswer("8", q("Seven")).correct, false);
  assert.equal(numberWordValue("one hundred five"), 105);
  assert.equal(numberWordValue("not a number"), null);
});

test("space and hyphen differences are ignored", () => {
  const spidey = q("Spider-Man");
  assert.equal(judgeAnswer("Spider Man", spidey).correct, true);
  assert.equal(judgeAnswer("spiderman", spidey).correct, true);
  assert.equal(judgeAnswer("spider-man", spidey).correct, true);
  assert.equal(judgeAnswer("spido man", spidey).correct, false);
});

test("surname alone is accepted when the question allows it", () => {
  const who = (answer) => q(answer, [answer], { mode: "text", fuzzy: true, optionalArticles: true, surname: true });
  assert.equal(judgeAnswer("Miyazaki", who("Hayao Miyazaki")).reason, "surname match");
  assert.equal(judgeAnswer("da Vinci", who("Leonardo da Vinci")).correct, true);
  assert.equal(judgeAnswer("Vinci", who("Leonardo da Vinci")).correct, true);
  assert.equal(judgeAnswer("Leonardo", who("Leonardo da Vinci")).correct, false);
  assert.equal(judgeAnswer("Ocean", q("Pacific Ocean")).correct, false);
});

test("question bank enables surname matching for who-questions", () => {
  const leia = QUESTIONS.find((item) => item.prompt === "Who is Luke Skywalker's twin sister?");
  assert.equal(judgeAnswer("Organa", leia).correct, true);
  const nemo = QUESTIONS.find((item) => item.prompt === "What kind of fish is Nemo?");
  assert.equal(nemo.match.surname, false);
});

test("lumpiang shanghai is accepted for the lumpia question", () => {
  const lumpia = QUESTIONS.find((item) => item.answer === "Lumpia");
  assert.equal(judgeAnswer("Lumpiang Shanghai", lumpia).correct, true);
  assert.equal(judgeAnswer("lumpiang-shanghai", lumpia).correct, true);
});

test("edit distance is bounded", () => {
  assert.equal(editDistance("kitten", "sitten", 1), 1);
  assert.equal(editDistance("kitten", "sunday", 1), 2);
});
