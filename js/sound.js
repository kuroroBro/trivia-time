// Tiny, dependency-free sound effects synthesized with the Web Audio API —
// no external audio files, so there's nothing to source, license, or ship
// as a binary asset. Every "sound" here is just oscillators with a gain
// envelope, generated on the fly.

let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Browsers block audio until a user gesture unlocks it. Call this from an
// early click handler (Create room / Join) so the context is already
// running by the time playGameStart() actually needs to fire later —
// that moment isn't itself a fresh click for every player (joined players
// hear it from a network broadcast, not a tap).
export function unlockAudio() {
  getCtx();
}

function tone(c, freq, startSec, durationSec, { type = "sine", peakGain = 0.2, attack = 0.012, release = 0.12 } = {}) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + startSec);
  gain.gain.setValueAtTime(0, c.currentTime + startSec);
  gain.gain.linearRampToValueAtTime(peakGain, c.currentTime + startSec + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + startSec + durationSec + release);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + startSec);
  osc.stop(c.currentTime + startSec + durationSec + release + 0.02);
}

// A short, clean rising chime — matches the site's minimal neon vibe better
// than a full fanfare. Plays once, right when the room leaves the lobby for
// the first question (see main.js's phase-transition check), never on
// every re-render.
export function playGameStart() {
  const c = getCtx();
  if (!c) return;
  const notes = [659.25, 830.61, 1046.5]; // E5 G#5 C6
  notes.forEach((freq, i) => tone(c, freq, i * 0.1, 0.14, { type: "sine", peakGain: 0.2 }));
}
