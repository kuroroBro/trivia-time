# Feature Specification: Trivia Time

**Feature branch**: `001-trivia-time`
**Status**: Draft
**Created**: 2026-07-19

## Overview

Trivia Time is a browser-based multiplayer party quiz. Every player receives
the same question on their own device and types an answer in secret. There are
no multiple-choice buttons. When all connected players have locked in, or the
timer expires, the Host reveals the accepted answer or answers, the short
explanation, and how each response was judged.

The room and networking structure should follow the proven `one-percent`
project: a static site, a Host-authoritative PeerJS room, full participants on
their own devices, optional spectator Host mode, player rejoin, and a pure
rules engine that can be tested without the DOM or network.

Trivia Time is score-based rather than elimination-based. A correct answer is
worth one point by default, everybody continues through the full game, and all
players tied for the highest score at the end are winners.

## Categories and themes

The initial question bank supports these top-level categories:

| Category | Example coverage |
| --- | --- |
| Movies | General popular cinema plus **Star Wars**, **Marvel Cinematic Universe**, **Disney & Pixar**, **The Lord of the Rings**, **Jurassic Park**, and **Studio Ghibli** themed sets |
| Books | General literature, with an optional **Harry Potter** themed set |
| The '90s | Events, entertainment, technology, fads, and year-specific trends from 1990–1999 |
| Food & Drink | Ingredients, dishes, cuisines, cooking, and food origins |
| Animals | Species, habitats, behavior, and records |
| Science | Biology, chemistry, physics, astronomy, Earth, and inventions |
| Sports | Rules, athletes, teams, events, and records |
| Music | Artists, bands, instruments, albums, composers, genres, and music terminology |
| TV Shows | General television plus **Friends**, **Grey's Anatomy**, **Young Sheldon**, **The Big Bang Theory**, and **How I Met Your Mother** themed sets |
| Japan Culture | Traditional arts, clothing, customs, festivals, theater, sports, and everyday cultural practices |
| General Knowledge | Geography, history, language, art, music, people, and everyday facts |
| Philippine History | Precolonial Philippines, major events, national figures, independence, and historical landmarks |
| Philippine Geography | Regions, provinces, cities, islands, bodies of water, landmarks, and natural features |
| Filipino Culture & Language | Filipino languages, customs, festivals, mythology, traditions, inventions, and everyday culture |
| Filipino Entertainment | Pinoy movies and television, OPM, artists, celebrities, iconic characters, and popular media |
| Filipino Food & Drink | Filipino dishes, desserts, ingredients, street food, regional specialties, and refreshments |
| Philippine Literature | Filipino novels, poetry, short stories, epics, writers, and literary figures |

`category` is always one of the top-level values. `theme` is optional and
narrows a question within a category, such as `Star Wars` under Movies or
`Harry Potter` under Books. Themes are filters, not separate categories, so a
Host can choose all Movies questions, only Star Wars questions, or a mixed
selection.

A theme selection automatically includes its parent category. The Host can
select Star Wars, Harry Potter, Friends, or another theme directly without
also checking Movies, Books, or TV Shows. The selection screen shows the
number of available questions beside every category and theme.

The popular-movie themes are independently selectable. Selecting Movies with
no theme restriction includes both franchise questions and general questions
about widely known films, actors, characters, quotes described without copying
long dialogue, awards, settings, and release history. No single franchise may
occupy more than one third of an unrestricted Movies deck.

The six Filipino categories are first-class top-level filters and may be
combined into an all-Filipino game. Filipino questions may use familiar
Filipino terms in their prompts, but instructions and explanations remain
clear to both Filipino and English readers. Where an answer has Filipino,
English, historical, or alternate-spelling forms, all factually equivalent
forms are stored as explicit accepted aliases.

The selection screen visually separates general categories from Filipino
categories. `Food & Drink` contains international food trivia, while `Filipino
Food & Drink` is independently selectable and contains the Filipino food pack.
On a first visit every category and theme is unchecked. After the Host starts a
game, the selected categories/themes, round count, timers, Host role, and name
are restored on later visits.

Questions about a decade must be unambiguous about the requested year. If the
answer is a year, the prompt states whether it asks when something debuted,
was released, was founded, or became a trend. The stored explanation records
the basis for the year.

## User Stories

### US-1: Create or join a room

As a player, I want to create a room or join one using a short code, so the
group can play together on separate devices.

Acceptance criteria:

- Creating a room produces a shareable 4-character code and opens a lobby.
- The creator is the fixed authoritative Host and may either play or run the
  room as a spectator display.
- Joining requires a unique display name of 1–20 characters.
- The lobby shows the room code, a scannable QR code, connected roster, and
  Host settings. The QR payload is the public game URL with the room code in a
  `room` query parameter, for example `https://example.com/trivia-time/?room=ABCD`.
- Scanning the QR code opens the join form with the room code prefilled; the
  player only needs to enter a name and tap Join.
- The QR code is generated locally in the browser, remains visible throughout
  the lobby, has a nearby copyable join link, and never contains a player name,
  rejoin token, answer, or other private state.
- If QR generation is unavailable, the room code and copyable join link remain
  fully usable as the fallback.
- A room supports up to 12 players.
- A failed join gives a plain-language error and a retry path.

### US-2: Configure categories and game length

As the Host, I want to choose the categories, themes, round count, and timer,
so the quiz fits the group.

Acceptance criteria:

- The Host selects one or more top-level categories.
- For categories with themes, the Host can include all questions or restrict
  the pool to one or more themes (for example, Star Wars or Harry Potter).
- The Host can choose 6–20 rounds, default 10, and a question timer of off,
  20, 30, 45, or 60 seconds, default 30.
- The Host chooses manual reveal advancement or automatic advancement after
  5, 8, or 12 seconds, default manual.
- The lobby previews how many fresh questions match the filters. Start is
  disabled if fewer questions are available than the selected round count.
- A mixed-category deck spreads rounds as evenly as possible across selected
  categories, then shuffles their order. No category is exhausted merely
  because it appears first in the selection list.
- A question previously used on the Host device is excluded until history is
  reset.

### US-3: Type and lock an answer

As a player, I want to type my answer privately and lock it in, so other
players cannot copy it.

Acceptance criteria:

- The question screen shows the round number, category, optional theme,
  prompt, optional image, timer, and one text field with a Lock Answer button.
- Pressing Enter and tapping Lock Answer are equivalent.
- Leading/trailing whitespace is ignored; an answer containing only
  whitespace cannot be submitted.
- A player may edit freely before locking. After locking, the answer is read
  only and clearly labeled “Locked in.” There is no unlock action.
- Before reveal, a player sees only their own submitted text. Other players'
  text is never broadcast; the roster shows only waiting/locked status.
- The round resolves when every connected player has locked an answer or the
  Host's timer expires. A timeout is stored as no answer and scores zero.
- Every player participates in every round regardless of current score.

### US-4: Accept equivalent and nearly equivalent answers

As a player, I want harmless formatting differences and clear spelling slips
to be accepted, so typing does not make the game feel unfair.

Acceptance criteria:

- Every question stores one canonical display answer and one or more explicit
  accepted answers/aliases. Examples include a full name and surname, an
  acronym and its expansion, or a common translated name.
- Matching first normalizes both response and accepted answers: Unicode and
  case folding, trimming, repeated-space collapse, typographic apostrophe and
  dash normalization, and removal of non-meaningful outer punctuation.
- A question may explicitly allow optional articles (`a`, `an`, `the`), units,
  honorifics, or parenthetical qualifiers. These are not removed globally.
- Exact normalized matches against any accepted answer are correct.
- Conservative fuzzy matching may accept a likely typo only when the question
  enables it. It compares the response with every accepted answer and uses
  the best candidate:
  - no fuzzy matching for answers shorter than 5 characters;
  - maximum edit distance 1 for 5–8 characters and 2 for 9 or more;
  - digits must match exactly, so `1996` never fuzzily matches `1997`;
  - token count must match unless the question explicitly permits an omitted
    token;
  - a response must not be accepted if it is equally close to two conflicting
    accepted answers in that question's judging context.
- Numeric, year, ordered-list, and multi-part questions use explicit match
  modes instead of generic fuzzy text matching.
- When the round closes, the authoritative Host device automatically runs the
  declared matcher against every submitted answer and calculates scores. No
  Host-by-Host manual grading is required in the normal game flow.
- The result records the reason: exact alias, normalized match, fuzzy typo,
  Host override, incorrect, or no answer.
- During the reveal, the Host may correct an exceptional automatic judgment by
  marking a response correct or incorrect. An override immediately recalculates
  the score, is recorded, and is broadcast consistently to every player.

### US-5: Reveal accepted answers after every round

As a group, we want the Host to reveal the possible accepted answers and each
player's result before moving on.

Acceptance criteria:

- Resolution always enters a reveal phase before the next question or
  final results. There is no path that skips the answer reveal.
- The Host device automatically validates all answers and awards points as the
  round closes, then reveals the finalized automatic results to all devices.
- All devices show the canonical answer, all accepted alternatives intended
  for display, and a short explanation.
- The reveal lists every player's submitted answer (or “No answer”), whether
  it was accepted, the reason when relevant, points earned, and total score.
- Internal-only matching aliases can be hidden when they are merely spelling
  or punctuation variants; the canonical and meaningful possible answers are
  always shown.
- Only the Host can advance. In auto-advance mode, the Host device performs
  the same transition after the configured reveal delay; the Host may advance
  early.
- Host correction controls appear only on the Host's reveal screen. If the
  Host overrides a judgment, the reveal countdown restarts so players can see
  the corrected result before the next round.

### US-6: Finish and play again

As a group, we want final standings and a quick rematch.

Acceptance criteria:

- After the final reveal, the Host advances to final standings rather than a
  new question.
- Standings sort by score descending and show rank, correct answers, and total
  rounds.
- Everyone tied at the highest score is declared a winner. A zero-point tie is
  still shown honestly as a tie.
- The Host can return the same connected players to a fresh lobby. Scores and
  answers reset; settings remain editable; offline seats are removed.

### US-7: Rejoin and disconnect safely

As a player, I want a brief refresh or connection loss not to ruin the game.

Acceptance criteria:

- A private per-room rejoin token stored locally allows a browser to reclaim
  its seat and preserves score and a locked answer.
- A token is never included in public state or a QR/join URL.
- A disconnected unanswered player does not indefinitely block resolution if
  at least one connected player remains; that seat receives no answer for the
  round.
- A disconnected player who rejoins during an open round may answer if their
  seat has not already been resolved as no answer.
- If the Host disconnects, the in-memory room ends. Host migration and backend
  persistence are out of scope.

### US-8: Accessible input and display

As a player, I want to answer and understand results using a phone, keyboard,
or assistive technology.

Acceptance criteria:

- The answer field has a visible label, does not rely on placeholder text, and
  receives focus when a question opens unless reduced-interruption behavior is
  requested by the platform.
- All controls are keyboard operable and have visible focus states.
- Timer changes and lock/reveal status are announced without announcing every
  animation tick.
- Color is not the only indication of correct/incorrect state.
- Optional question images use local assets, scale without cropping, and have
  meaningful alt text.

## Functional Requirements

- **FR-1**: The app is a static HTML/CSS/JavaScript site suitable for GitHub
  Pages, with no backend or build step required to serve it.
- **FR-2**: Game logic and answer judging live in pure modules with no DOM,
  storage, clock, or network dependency; time and randomness are injected.
- **FR-3**: Only the Host mutates room state. Players send intents and render
  per-viewer public snapshots.
- **FR-4**: Before reveal, outbound state excludes the answer key, matching
  aliases, explanation, automatic judgment, and all other players' typed text.
- **FR-5**: The Host's own player view must not receive the answer key while
  the question is open. Host correction metadata becomes available only after
  the round closes and automatic results have been created.
- **FR-6**: Submitted answers are limited to 100 Unicode characters, treated
  as plain text, and rendered with `textContent`; they are never interpreted
  as HTML.
- **FR-7**: Every question is validated at load time and must have a unique
  ID, category, prompt, canonical display answer, non-empty accepted-answer
  list, explanation, and supported match mode.
- **FR-8**: The question bank contains at least 15 launch-ready questions in
  each top-level category, at least 10 in each named launch theme, and enough
  non-themed popular Movie questions that an unrestricted Movies game is not
  dominated by one franchise.
- **FR-9**: Used-question history is local to the Host device and can be reset
  from the lobby.
- **FR-10**: No ads, analytics, accounts, player-uploaded questions, remote
  images, or real-money stakes.

## Answer Matching Model

Each question declares its judging behavior instead of relying on one global
fuzzy rule:

```js
{
  id: "movies-star-wars-001",
  category: "movies",
  theme: "Star Wars",
  prompt: "Which character ...?",
  answer: "Canonical answer shown on reveal",
  acceptedAnswers: [
    { text: "Canonical answer", display: true },
    { text: "Unambiguous alias", display: true },
    { text: "punctuation-only variant", display: false }
  ],
  match: {
    mode: "text",
    fuzzy: true,
    optionalArticles: false,
    optionalTokens: []
  },
  explanation: "A concise fact that confirms why the answer is correct.",
  source: "https://authoritative-source.example/..."
}
```

Supported `match.mode` values are:

- `text`: aliases plus optional conservative fuzzy matching;
- `number`: parsed numeric value with optional explicit tolerance and unit;
- `year`: exactly four digits, exact match only;
- `unordered-list`: required normalized items in any order, with the question
  declaring whether partial credit is allowed (off at launch by default);
- `ordered-list`: required normalized items in order;
- `multi-part`: named parts judged separately, with the question declaring
  whether all parts are required.

Fuzzy matching is an input convenience, not a knowledge model. It must not
infer synonyms or facts that are absent from `acceptedAnswers`. Ambiguous
responses are automatically marked incorrect rather than guessed correct; the
Host can correct that judgment during reveal.

## Key Entities

- **QuestionEntry**: `id`, `category`, optional `theme`, `prompt`, `answer`,
  `acceptedAnswers`, `match`, `explanation`, optional `image`/`imageAlt`, and
  optional `source`.
- **Player**: `id`, `name`, `score`, `connected`, private `resumeToken`, and
  current `answerText`/`lockedAt`.
- **Judgment**: `playerId`, submitted text or null, `correct`, `reason`,
  optional `matchedAlias`, the original automatic result, and optional Host
  override.
- **RoundResult**: question display data, finalized judgments, points awarded,
  and updated standings.
- **Room**: `code`, fixed `hostId`, phase (`lobby`, `question`, `reveal`,
  `over`), players, settings, deck, round index, timing fields, last result,
  and winner IDs.

## State and Privacy Invariants

1. An open question never exposes its answer key or judging configuration to
   any player's public state, including the Host's player snapshot.
2. A player can see their own locked text but only locked/waiting status for
   everyone else until public reveal.
3. Scores are awarded exactly once by Host-side automatic validation; a later
   Host override applies only the score delta from the changed judgment.
4. A resolved round always passes through public `reveal` before `over` or the
   next `question`.
5. A Host override changes both the awarded point and the displayed result.
6. Replaying or duplicating a network intent cannot award a point twice.

## Non-goals

- No multiple-choice mode in the initial release.
- No elimination ladder or difficulty-percent tiers.
- No AI/LLM judging, semantic embeddings, or internet lookup during play.
- No player-authored or uploaded question packs in the initial release.
- No partial credit by default; a question may explicitly opt in later.
- No dedicated backend, account system, cross-device history, or Host
  recovery.
- No copyrighted book passages, movie clips, logos, or screenshots. Themed
  questions use original text and locally created/licensed visual assets.
