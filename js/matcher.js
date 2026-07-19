export function normalizeText(value, options = {}) {
  let text = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[‘’´`]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .trim()
    .replace(/^[\s.,!?;:"'()[\]{}]+|[\s.,!?;:"'()[\]{}]+$/g, "")
    .replace(/\s+/g, " ");
  if (options.optionalArticles) text = text.replace(/^(a|an|the)\s+/, "");
  return text;
}

export function editDistance(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

function aliases(question) {
  const raw = question.acceptedAnswers?.length ? question.acceptedAnswers : [question.answer];
  return raw.map((a) => typeof a === "string" ? { text: a, display: true } : a);
}

function result(correct, reason, matchedAlias = null) {
  return { correct, reason, matchedAlias };
}

function judgeText(response, question) {
  const opts = question.match || {};
  const normalized = normalizeText(response, opts);
  const candidates = aliases(question).map((a) => ({ ...a, normalized: normalizeText(a.text, opts) }));
  const exact = candidates.find((a) => a.normalized === normalized);
  if (exact) {
    const rawSame = String(response).trim().toLocaleLowerCase("en") === String(exact.text).trim().toLocaleLowerCase("en");
    return result(true, rawSame ? "exact alias" : "normalized match", exact.text);
  }
  if (!opts.fuzzy || normalized.length < 5 || /\d/.test(normalized)) return result(false, "incorrect");
  const limit = normalized.length <= 8 ? 1 : 2;
  const tokenCount = normalized.split(" ").length;
  const ranked = candidates
    .filter((a) => !/\d/.test(a.normalized) && a.normalized.split(" ").length === tokenCount)
    .map((a) => ({ a, distance: editDistance(normalized, a.normalized, limit) }))
    .filter((x) => x.distance <= limit)
    .sort((x, y) => x.distance - y.distance);
  if (!ranked.length || (ranked[1] && ranked[1].distance === ranked[0].distance && ranked[1].a.normalized !== ranked[0].a.normalized)) {
    return result(false, "incorrect");
  }
  return result(true, "fuzzy typo", ranked[0].a.text);
}

function judgeNumber(response, question) {
  const cleaned = normalizeText(response).replace(/,/g, "");
  const parsed = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*([^\d]*)$/);
  if (!parsed) return result(false, "incorrect");
  const value = Number(parsed[1]);
  const tolerance = Number(question.match?.tolerance || 0);
  for (const alias of aliases(question)) {
    const expected = normalizeText(alias.text).replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s*([^\d]*)$/);
    if (!expected) continue;
    const sameUnit = !expected[2] || !parsed[2] || expected[2].trim() === parsed[2].trim();
    if (sameUnit && Math.abs(value - Number(expected[1])) <= tolerance) return result(true, "numeric match", alias.text);
  }
  return result(false, "incorrect");
}

export function judgeAnswer(response, question) {
  if (response == null || !String(response).trim()) return result(false, "no answer");
  const mode = question.match?.mode || "text";
  if (mode === "year") {
    const value = String(response).trim();
    const exact = aliases(question).find((a) => /^\d{4}$/.test(value) && value === String(a.text));
    return exact ? result(true, "exact year", exact.text) : result(false, "incorrect");
  }
  if (mode === "number") return judgeNumber(response, question);
  return judgeText(response, question);
}

export function displayAnswers(question) {
  const shown = aliases(question).filter((a) => a.display !== false).map((a) => a.text);
  return [...new Set([question.answer, ...shown])];
}
