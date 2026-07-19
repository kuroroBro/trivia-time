# Trivia Time

A static, phone-friendly multiplayer trivia game. Players join a Host's room,
type answers privately, and receive automatic Host-side validation against
accepted aliases and conservative spelling tolerance.

## Play locally

Serve this repository with any static HTTP server:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/`. Creating and joining public rooms requires
internet access to the PeerJS client CDN and public PeerJS broker. QR images use
a public QR image service; the room code and copy-link controls remain
available if that image fails.

## Tests

```sh
node --test tests/*.test.mjs
```

The question bank contains 365 questions across fourteen categories,
including Music, TV Shows, ten questions in every named TV and popular-movie
theme, and four Filipino categories. The SDD lives in
[`specs/001-trivia-time`](specs/001-trivia-time/).
