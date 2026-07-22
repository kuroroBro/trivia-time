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

const NUMBER_WORDS = new Map(Object.entries({
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}));
const NUMBER_SCALES = new Map(Object.entries({ thousand: 1000, million: 1000000 }));

export function numberWordValue(text) {
  const tokens = String(text).toLocaleLowerCase("en").split(/[\s-]+/).filter((t) => t && t !== "and");
  if (!tokens.length) return null;
  let total = 0;
  let current = 0;
  for (const token of tokens) {
    if (NUMBER_WORDS.has(token)) current += NUMBER_WORDS.get(token);
    else if (token === "hundred") current = (current || 1) * 100;
    else if (NUMBER_SCALES.has(token)) { total += (current || 1) * NUMBER_SCALES.get(token); current = 0; }
    else return null;
  }
  return total + current;
}

function numericValue(normalized) {
  const cleaned = normalized.replace(/,/g, "");
  if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) return Number(cleaned);
  return numberWordValue(normalized);
}

function compactForm(normalized) {
  return normalized.replace(/[\s-]/g, "");
}

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

// Every trailing token run of a multi-word name, so "da vinci" and "vinci"
// both count as the surname of "leonardo da vinci".
function surnameForms(normalized) {
  const tokens = normalized.split(" ").filter((t) => !NAME_SUFFIXES.has(t.replace(/\./g, "")));
  if (tokens.length < 2) return [];
  return tokens.slice(1).map((_, i) => tokens.slice(i + 1).join(" "));
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
  const compact = compactForm(normalized);
  if (compact) {
    const spacing = candidates.find((a) => compactForm(a.normalized) === compact);
    if (spacing) return result(true, "normalized match", spacing.text);
  }
  const responseNumber = numericValue(normalized);
  if (responseNumber != null) {
    const numeric = candidates.find((a) => numericValue(a.normalized) === responseNumber);
    if (numeric) return result(true, "number match", numeric.text);
  }
  if (opts.surname) {
    const surname = candidates.find((a) =>
      surnameForms(a.normalized).some((s) => s === normalized || compactForm(s) === compact));
    if (surname) return result(true, "surname match", surname.text);
  }
  if (!opts.fuzzy || compact.length < 5 || /\d/.test(normalized)) return result(false, "incorrect");
  const limit = compact.length <= 8 ? 1 : 2;
  const targets = [];
  for (const a of candidates) {
    if (/\d/.test(a.normalized)) continue;
    targets.push({ a, key: compactForm(a.normalized) });
    if (opts.surname) for (const s of surnameForms(a.normalized)) targets.push({ a, key: compactForm(s) });
  }
  const ranked = targets
    .map((t) => ({ ...t, distance: editDistance(compact, t.key, limit) }))
    .filter((t) => t.distance <= limit)
    .sort((x, y) => x.distance - y.distance);
  if (!ranked.length || (ranked[1] && ranked[1].distance === ranked[0].distance && ranked[1].key !== ranked[0].key)) {
    return result(false, "incorrect");
  }
  return result(true, "fuzzy typo", ranked[0].a.text);
}

function parseNumeric(text) {
  const cleaned = normalizeText(text).replace(/,/g, "");
  const parsed = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*([^\d]*)$/);
  if (parsed) return { value: Number(parsed[1]), unit: parsed[2].trim() };
  const worded = numberWordValue(cleaned);
  return worded == null ? null : { value: worded, unit: "" };
}

function judgeNumber(response, question) {
  const parsed = parseNumeric(response);
  if (!parsed) return result(false, "incorrect");
  const tolerance = Number(question.match?.tolerance || 0);
  for (const alias of aliases(question)) {
    const expected = parseNumeric(alias.text);
    if (!expected) continue;
    const sameUnit = !expected.unit || !parsed.unit || expected.unit === parsed.unit;
    if (sameUnit && Math.abs(parsed.value - expected.value) <= tolerance) return result(true, "numeric match", alias.text);
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
