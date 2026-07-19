# Implementation Plan: Trivia Time

## Technical Context

| Area | Choice | Notes |
| --- | --- | --- |
| Runtime | Vanilla ES modules, HTML, CSS | Static GitHub Pages compatible; no build step |
| Networking | PeerJS/WebRTC, full-participant room | Adapt the room lifecycle from `one-percent` with a distinct peer prefix |
| Authority | Host-authoritative in-memory state | Player clients send intents and receive redacted snapshots |
| Rules | Pure JavaScript modules | Separate room transitions, deck building, and answer judging |
| Tests | `node --test` | Deterministic unit tests plus browser smoke tests |
| Question content | Curated local data | Validated at generation time; sources retained for maintainers |

## Proposed File Structure

```text
trivia-time/
├── index.html
├── css/style.css
├── images/questions/
├── js/
│   ├── game.js          room state and phase transitions
│   ├── matcher.js       normalization and match-mode judging
│   ├── questions.js     generated, browser-ready question bank
│   ├── main.js          screens, rendering, and event handling
│   ├── room.js          PeerJS transport wrapper
│   └── storage.js       settings, rejoin session, used-question history
├── tools/
│   ├── gen-questions.js
│   └── raw-questions.json
├── tests/
│   ├── game.test.mjs
│   ├── matcher.test.mjs
│   ├── questions.test.mjs
│   └── storage.test.mjs
├── vendor/peerjs.min.js
├── vendor/qrcode.min.js
└── specs/001-trivia-time/
    ├── spec.md
    ├── plan.md
    └── tasks.md
```

## Architecture

### Room lifecycle

The lifecycle is:

```text
lobby → question → reveal → question
                         └→ over
over → lobby (rematch)
```

`question` collects private responses. When the round closes, the Host device
runs `judgeAnswer()` for every response, awards scores exactly once, creates
the public result, and enters `reveal` automatically. The normal flow never
requires the Host to grade answers one at a time. During reveal, optional
Host-only controls can override an exceptional judgment and apply only the
necessary score delta. `advanceRound()` is the only transition out of reveal
and decides between the next question and `over`.

This flow provides immediate automatic validation while preserving a human
escape hatch and the reveal guarantee: no last-round or network edge case can
jump over the accepted answers.

### Authority and public state

All actions flow through one Host-side dispatcher whether initiated locally or
received through PeerJS. Mutating engine functions require the caller ID and
reject non-Host operations where appropriate.

`toPublicState(room, viewerId, now)` builds a new view rather than serializing
the internal room object. During `question`, it exposes the prompt and the
viewer's own locked answer but strips `acceptedAnswers`, `match`, `answer`,
`explanation`, judgments, and other players' response text. During `reveal`,
display-safe answers, responses, judgments, and scores become public. Only the
Host projection includes correction controls/metadata.

### Answer matcher

`matcher.js` exposes small pure functions:

```js
normalizeText(value, options)
editDistance(a, b, maxDistance)
judgeText(response, acceptedAnswers, options)
judgeNumber(response, acceptedAnswers, options)
judgeList(response, acceptedAnswers, options)
judgeAnswer(response, question)
```

The pipeline is deterministic:

1. Validate and length-limit the player response.
2. Normalize according to the question's explicit options.
3. Attempt exact matches against every alias.
4. Use the declared specialized parser for number, year, or list modes.
5. If `text` fuzzy matching is enabled, apply the length/edit-distance,
   digit, token-count, and ambiguity guards from the specification.
6. Return a structured judgment and never mutate the question or player.

The Host-side engine calls the matcher automatically at resolution. Host
override remains part of the game engine, not the matcher; this keeps automatic
judging deterministic and makes score corrections auditable in tests and UI.

### QR join flow

The lobby builds its join URL from the current public page URL and a validated
uppercase room code in the `room` query parameter. A small vendored QR encoder
generates the code locally into a canvas or SVG; no third-party QR service or
network request receives the room URL.

On page load, `main.js` reads `room`, validates the same four-character format
used by the engine, and prefills the Join view without auto-submitting. The QR
is accompanied by the human-readable room code and a Copy Join Link button.
Rejoin tokens stay exclusively in local storage and are never appended to the
URL. QR rendering failure is non-fatal and leaves both manual join paths intact.

### Deck construction

`buildDeck(pool, settings, usedIds, rng)`:

1. Validates selected categories/themes and filters the pool.
2. Removes IDs present in Host-local used history.
3. Groups candidates by selected category.
4. Allocates round slots with a round-robin strategy, randomizing which
   selected category receives any remainder.
5. Samples without replacement using injected randomness.
6. Shuffles the combined deck so categories are interleaved unpredictably.
7. Returns a clear insufficiency result rather than silently shortening a
   game or reusing a question.

### Question-bank validation

The generator rejects:

- duplicate or malformed IDs;
- categories outside the known taxonomy;
- blank prompts, answers, aliases, or explanations;
- a canonical answer absent from the accepted-answer set;
- unsupported match modes or invalid fuzzy/tolerance options;
- image paths without alt text;
- remote image URLs;
- list questions without declared separators/items;
- `year` answers that are not four digits;
- display aliases that duplicate after normalization.

The generated browser file includes content needed during play. Source notes
can remain in the generated data for attribution but must be redacted from
open-question public state if they reveal the answer.

## UI Screens

- **Home**: name, create/join, spectator Host option.
- **Lobby**: persistent locally generated QR code, copyable join link, room
  code, roster, category/theme filters, question count, timers, fresh-question
  count, history reset, and Start.
- **Question**: category/theme chip, prompt/image, labeled answer field, Lock
  Answer, timer, and locked/waiting roster.
- **Reveal**: canonical and meaningful accepted answers, explanation, every
  player's automatically validated result, round point, total score, Host-only
  correction controls, and Host advance control.
- **Over**: winners, ranked standings, and Host rematch.

The Host can also be a player. Its ordinary question UI is built from the same
redacted player projection, so creating the room never grants an answer-key
advantage. Host-only correction controls are unavailable until the round
closes.

## Testing Strategy

### Unit tests

- Exact alias, Unicode/case/space/punctuation normalization.
- Optional article behavior is question-specific, not global.
- Fuzzy thresholds at every length boundary; short answer rejection.
- Fuzzy digit mismatch, token mismatch, and ambiguous-best-match rejection.
- Exact year, number/unit, ordered list, unordered list, and multi-part modes.
- Deck category balance, theme filtering, no duplicates, used-history
  exclusion, deterministic RNG, and insufficient-pool behavior.
- Host authority, answer immutability after lock, timer/no-answer handling,
  automatic validation, overrides/score deltas, idempotent scoring, ties, and
  rematch.
- Public-state redaction in every phase, especially Host-as-player.
- Rejoin token privacy and locked-response recovery.
- QR URL encoding, query-prefill validation, and absence of private tokens.

### Browser validation

Run a real two-browser PeerJS flow:

1. Host creates a room and a second player joins.
2. Host selects at least two categories plus one named theme.
3. Both receive the same prompt and type different answers.
4. Each sees only their own locked text while the round is open.
5. The Host automatically validates one exact and one fuzzy answer and both
   devices immediately receive the same reveal, accepted answers, and scores.
6. Host overrides one judgment during reveal and both devices receive the same
   corrected score.
7. The last round still reveals before final standings.
8. A refresh/rejoin preserves one locked response and does not expose a token.

Also scan the lobby QR with a separate device and verify the room is prefilled.
Test keyboard-only answering, a timer expiry, spectator Host mode, manual and
automatic reveal advancement, narrow mobile layout, and optional image alt text.

## Content Plan

Launched with at least 550 curated questions, later expanded (see Changelog)
to at least 815:

- 30 or more in each of the seventeen top-level categories;
- at least 30 questions in each popular Movie theme: Star Wars, Marvel
  Cinematic Universe, Disney & Pixar, The Lord of the Rings, Jurassic Park,
  and Studio Ghibli;
- at least 15 additional Movies questions outside those named themes so a
  general Movies game remains varied;
- at least 30 Harry Potter questions within Books;
- at least 30 Music questions;
- at least 30 Japan Culture questions;
- at least 30 TV Show questions in each named theme: Friends, Grey's Anatomy,
  Young Sheldon, The Big Bang Theory, and How I Met Your Mother;
- at least 30 questions each for Philippine History, Philippine Geography,
  Filipino Culture & Language, Filipino Entertainment, Filipino Food & Drink,
  and Philippine Literature;
- enough additional general Books questions that enabling the category does
  not effectively force its named theme.

For Filipino content, retain diacritics in canonical display answers while
accepting common keyboard forms without diacritics where they refer to the same
answer. Include common Filipino/English names as aliases only when both are
factually valid. Historical and geographic questions should prefer Philippine
government, museum, cultural-institution, or other primary references.

Prefer stable facts and authoritative sources. Avoid trivia whose answer
changes frequently unless a date is part of the question. Verify every alias
manually: an alias is a factual accepted response, not merely a fuzzy spelling
variant. Store meaningful aliases for reveal and mechanical variants as
`display: false`.

## Delivery Order

1. Scaffold static app and test harness from the `one-percent` conventions.
2. Implement and exhaustively test matcher and question validation.
3. Implement deck construction and room engine with privacy projections.
4. Add storage/rejoin and PeerJS transport.
5. Build screens, automatic reveal, and Host correction interaction.
6. Curate and validate the initial question bank.
7. Complete unit, accessibility, responsive, and live multi-browser checks.

## Changelog

- **v2** (2026-07-19): Expanded every named Movie/TV theme from 10 to 30
  questions each (240 new questions total, bank now 815), per owner
  feedback. Content was verified against external sources for the
  higher-risk facts (character names, plot specifics, real-world release
  years) before shipping, and a couple of drafted questions were corrected
  or replaced after that check turned up inaccuracies (e.g. an early draft
  misattributed Ted Mosby's architecture-firm boss to the wrong How I Met
  Your Mother character, and understated the Slap Bet's final total).
  `tests/game.test.mjs`'s theme-count assertion was raised from `>= 10` to
  `>= 30` and now also covers Harry Potter, which the original assertion
  omitted.
