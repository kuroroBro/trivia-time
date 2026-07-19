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

The question bank contains 295 questions: at least 20 in each of twelve
categories, including ten questions in every popular movie theme and
four Filipino categories. The SDD lives in
[`specs/001-trivia-time`](specs/001-trivia-time/).
