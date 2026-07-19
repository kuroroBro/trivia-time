const PREFIX = "trivia-time-room-";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
export const normalizeCode = (raw) => String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
const options = () => ({ debug: 0 });

export function hostRoom({ onMessage, onPeerClose, onError }, attempt = 0) {
  return new Promise((resolve, reject) => {
    if (typeof window.Peer !== "function") return reject(new Error("Room service failed to load."));
    const roomCode = code();
    const peer = new Peer(PREFIX + roomCode, options());
    const conns = new Map(); let opened = false;
    peer.on("open", () => { opened = true; resolve({ code: roomCode,
      broadcastEach(event, makePayload) { for (const [id, c] of conns) if (c.open) c.send(JSON.stringify({ event, payload: makePayload(id) })); },
      close() { peer.destroy(); },
    }); });
    peer.on("connection", (conn) => {
      const id = conn.peer;
      conn.on("open", () => conns.set(id, conn));
      conn.on("data", (raw) => { let msg; try { msg = JSON.parse(raw); } catch { return; }
        if (msg.event === "bye") { conn.close(); return; }
        const res = onMessage(id, msg.event, msg.payload);
        if (conn.open) conn.send(JSON.stringify({ reqId: msg.reqId, res }));
      });
      const drop = () => { if (conns.delete(id)) onPeerClose(id); };
      conn.on("close", drop); conn.on("error", drop);
    });
    peer.on("error", (err) => {
      if (!opened && err.type === "unavailable-id" && attempt < 5) { peer.destroy(); hostRoom({ onMessage, onPeerClose, onError }, attempt + 1).then(resolve, reject); }
      else if (!opened) reject(new Error("Could not create a room.")); else onError("Room connection lost.");
    });
  });
}

export function joinRoom(roomCode, { onPush, onClose }) {
  return new Promise((resolve, reject) => {
    if (typeof window.Peer !== "function") return reject(new Error("Room service failed to load."));
    const peer = new Peer(options()); let opened = false; let seq = 0; const pending = new Map();
    peer.on("open", () => {
      const conn = peer.connect(PREFIX + normalizeCode(roomCode), { reliable: true });
      conn.on("open", () => { opened = true; resolve({ id: peer.id,
        send(event, payload) { return new Promise((done) => { const reqId = ++seq; pending.set(reqId, done); conn.send(JSON.stringify({ reqId, event, payload })); }); },
        close() { peer.destroy(); },
      }); });
      conn.on("data", (raw) => { let msg; try { msg = JSON.parse(raw); } catch { return; }
        if (msg.reqId != null && pending.has(msg.reqId)) { const done = pending.get(msg.reqId); pending.delete(msg.reqId); done(msg.res); }
        else if (msg.event) onPush(msg.event, msg.payload);
      });
      conn.on("close", () => { if (opened) onClose("The Host closed the room."); });
    });
    peer.on("error", (err) => { peer.destroy(); if (!opened) reject(new Error(err.type === "peer-unavailable" ? `No room found with code ${normalizeCode(roomCode)}.` : "Could not join the room.")); });
  });
}
