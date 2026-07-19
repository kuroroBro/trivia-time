const SETTINGS = "triviaTime.settings.v1";
const USED = "triviaTime.used.v1";
const SESSIONS = "triviaTime.sessions.v1";
const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
export const defaults = { name: "", questionCount: 10, timerSeconds: 30, revealAdvanceSeconds: 0, spectatorHost: false, categories: [], themes: [] };
export const loadSettings = () => ({ ...structuredClone(defaults), ...read(SETTINGS, {}) });
export const saveSettings = (value) => write(SETTINGS, value);
export const loadUsedIds = () => { const v = read(USED, []); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; };
export const markUsedIds = (ids) => write(USED, [...new Set([...loadUsedIds(), ...ids])]);
export const resetUsedIds = () => write(USED, []);
export function createResumeToken() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function loadSession(code) { const all = read(SESSIONS, {}); return all[String(code).toUpperCase()] || null; }
export function saveSession(code, session) { const all = read(SESSIONS, {}); all[String(code).toUpperCase()] = session; write(SESSIONS, all); }
