# Tasks: Trivia Time

## Phase 1 — Scaffold

- [ ] Create the static app structure, README, license, `.nojekyll`, and
  vendored PeerJS client.
- [ ] Adapt `one-percent`'s full-participant room wrapper with a unique
  `trivia-time-room-` PeerJS prefix.
- [ ] Vendor a lightweight QR encoder for local, offline join-code generation.
- [ ] Set up ES modules and the `node --test` harness.

## Phase 2 — Answer matcher

- [ ] Implement question-specific text normalization.
- [ ] Implement bounded edit distance with short-answer, digit, token-count,
  and ambiguity guards.
- [ ] Implement text, number, year, ordered-list, unordered-list, and
  multi-part match modes.
- [ ] Return structured judgment reasons and closest-alias metadata.
- [ ] Add exhaustive matcher boundary and false-positive tests.

## Phase 3 — Question bank and validation

- [ ] Define raw and generated question schemas.
- [ ] Build a generator that validates IDs, categories, themes, aliases,
  matching options, explanations, sources, and image accessibility.
- [ ] Curate at least 15 questions each for Movies, Books, The '90s, Food &
  Drink, Animals, Science, Sports, Music, TV Shows, General Knowledge, Philippine History,
  Philippine Geography, Filipino Culture & Language, and Filipino
  Entertainment.
- [ ] Include at least 10 questions each for Star Wars, Marvel Cinematic
  Universe, Disney & Pixar, The Lord of the Rings, Jurassic Park, and Studio
  Ghibli, plus at least 15 general Movie questions outside those themes.
- [ ] Include at least 10 Harry Potter themed Book questions without making the
  theme the whole Books category.
- [ ] Include at least 10 questions each for Friends, Grey's Anatomy, Young
  Sheldon, The Big Bang Theory, and How I Met Your Mother.
- [ ] Show category/theme question counts and let selecting a theme imply its
  parent category without another checkbox.
- [ ] Add Filipino/English and diacritic-free aliases where factually valid,
  and test that normalization does not turn distinct Filipino answers into the
  same answer.
- [ ] Verify an all-Filipino category selection can build a balanced full game
  and unrestricted Movies decks never allocate more than one third of rounds
  to a single franchise when alternatives are available.
- [ ] Fact-check canonical answers and every accepted alias against stable,
  authoritative sources.
- [ ] Add generator and coverage-count tests.

## Phase 4 — Rules engine

- [ ] Implement room/player lifecycle, fixed Host identity, spectator Host,
  rejoin, and rematch.
- [ ] Implement category-balanced, theme-aware, no-repeat deck construction.
- [ ] Implement private answer entry, lock-in, all-answered detection, and
  timer resolution.
- [ ] Run automatic answer validation on the authoritative Host as soon as a
  round closes; no manual grading step in the normal flow.
- [ ] Implement idempotent score finalization, public reveal, and Host-only
  correction with score-delta recalculation.
- [ ] Ensure `advanceRound` is the only reveal exit and always reveals the
  last round before final standings.
- [ ] Implement per-viewer state redaction and privacy tests for every phase.

## Phase 5 — Storage and networking

- [ ] Persist player name, Host settings, room-scoped rejoin token, and
  Host-local used-question history with malformed-data tolerance.
- [ ] Implement the Host event dispatcher and full-participant PeerJS sync.
- [ ] Implement a sanitized `?room=ABCD` join URL, query-prefilled join form,
  and private-token exclusion.
- [ ] Handle disconnects, offline unanswered seats, and player rejoin without
  leaking tokens or duplicate-scoring a round.

## Phase 6 — Interface

- [ ] Build Home and Lobby screens with a locally generated QR, copyable join
  link, room-code fallback, filters, fresh-question count, settings, and
  history reset.
- [ ] Build the free-text Question screen with keyboard/Enter support,
  100-character limit, locked state, timer, and roster status.
- [ ] Build Reveal with meaningful accepted answers, explanation, responses,
  automatic judgment reasons, round points, total scores, and Host-only
  correction controls.
- [ ] Build final standings, tied-winner handling, and rematch.
- [ ] Add spectator Host and manual/automatic reveal advancement UI.
- [ ] Add responsive styling, visible focus, status announcements, and
  non-color result indicators.

## Phase 7 — Verification and documentation

- [ ] Run all matcher, question, engine, privacy, storage, and deck tests.
- [ ] Complete a real two-browser PeerJS game including exact, fuzzy,
  overridden, wrong, and timed-out responses.
- [ ] Scan the QR on a second device and verify room prefill, copy-link fallback,
  malformed-code handling, and absence of private data in the URL.
- [ ] Verify the final round cannot skip reveal.
- [ ] Verify Host-as-player cannot inspect the answer key before round close.
- [ ] Verify rejoin, spectator Host, auto-advance, keyboard-only use, mobile
  layout, and accessible image behavior.
- [ ] Document play instructions, development commands, question sourcing,
  matching limitations, and the Host's final say on ambiguous answers.
