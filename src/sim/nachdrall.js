// n7 Vorlagen E2 #5 (Vorlage C, angepasst): Nachdrall nach dem Schuss. In einem kurzen Fenster (P.nachdrallT s) nach dem
// Kontakt gibt der Stick dem fliegenden Ball zusätzlichen Drall – die echte Magnus-Physik (ball.js) macht daraus die Kurve,
// die Bahn wird nie direkt verschoben. Stick seitlich = Seitendrall (Seite wird beim ersten deutlichen Ausschlag festgelegt,
// danach zählt nur noch die Stärke in diese Richtung), zurück = Rückdrall (steigt), vor = Vorwärtsdrall (taucht ab).
// Die Wirkung klingt über das Fenster ab: zehn gleich lange Abschnitte mit den Gewichten 5-4-3-2-2-2-2-1-1-1 (gut die
// Hälfte in den ersten drei). Gezählt wird die Stick-Änderung gegenüber dem Kontakt (wer zum Zielen den Stick zur Ecke
// hält und ihn so lässt, gibt keinen Nachdrall). Bots geben mit einer kleinen Chance je Stufe Nachdrall vom Tormann weg.
// Endet bei jeder Berührung (Tormann, Spieler), Bande/Pfosten/Netz oder Ball in der Hand.
export const ND_W = [5, 4, 3, 2, 2, 2, 2, 1, 1, 1];
const ND_SUM = ND_W.reduce((a, b) => a + b, 0);
const TAU = 2 * Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Anteil der Gesamtwirkung im Takt [t, t + dt) nach dem Kontakt (Fenster T s)
export function ndShare(t, dt, T) {
  if (t >= T || t + dt <= 0) return 0;
  const seg = T / ND_W.length;
  let s = 0, a = Math.max(0, t);
  const e = Math.min(T, t + dt);
  while (a < e - 1e-12) {
    const k = Math.min(ND_W.length - 1, Math.floor(a / seg + 1e-9));
    const b = Math.min(e, (k + 1) * seg);
    s += ND_W[k] / ND_SUM * (b - a) / seg;
    a = b;
  }
  return s;
}

// Stick (Welt-x/z) relativ zur Schussrichtung (dx, dz): lat > 0 = links (Kurve nach links), lon > 0 = nach vorn
export function ndStick(mx, mz, dx, dz) {
  return { lat: mx * dz - mz * dx, lon: mx * dx + mz * dz };
}

// Neuer Schuss → Zustand des Nachdralls (oder null). stick0 = Stick beim Kontakt; bot = { lat, lon } fester Bot-Ausschlag
export function ndStart(g, e, stick0, bot = null) {
  const P = g.P;
  if (!P.nachdrall || e.type !== 'kick' || e.kind !== 'shot' || e.player == null) return null;
  return { pl: e.player, t0: g.t, dx: e.dx, dz: e.dz, f: clamp((e.speed || 0) / 25, 0, 1), s0: stick0 || [0, 0], bot, side: 0, sum: 0, sumB: 0, n: 0 };
}

// Ein Takt: zusätzlicher Drall auf den Ball; → false, wenn das Fenster vorbei ist
export function ndStep(g, st, inp, dt) {
  const P = g.P, b = g.ball, t = g.t - st.t0;
  if (t >= P.nachdrallT || b.held >= 0) return false;
  // jede neue Berührung (Tormann, Spieler, auch der Schütze selbst) beendet ihn; ohne Spielregeln (Training) zählt der Schütze
  if (g.match ? g.lastTouch !== st.pl || g.lastTouchT > st.t0 + 1e-9 : g.players[st.pl].lastTouchT > st.t0 + 1e-9) return false;
  let lat, lon;
  if (st.bot) ({ lat, lon } = st.bot);
  else {
    const mx = (inp && inp.mx) || 0, mz = (inp && inp.mz) || 0;
    ({ lat, lon } = ndStick(mx - st.s0[0], mz - st.s0[1], st.dx, st.dz));
    lat = clamp(lat, -1, 1); lon = clamp(lon, -1, 1);
  }
  if (!st.side && Math.abs(lat) > 0.35) st.side = Math.sign(lat);
  const w = ndShare(t, dt, P.nachdrallT) * P.nachdrall * st.f;
  if (w <= 0) return true;
  const side = st.side ? st.side * Math.max(0, lat * st.side) * P.nachdrallSeite * TAU * w : 0;
  // zurück (lon < 0) = Rückdrall (+), vor = Vorwärtsdrall (−); kleine Ausschläge zählen nicht
  const lv = Math.abs(lon) > 0.35 ? -lon : 0;
  const back = lv * P.nachdrallHoch * TAU * w;
  if (side || back) {
    b.w.x += -st.dz * back; b.w.y += side; b.w.z += st.dx * back;
    st.sum += side / TAU; st.sumB += back / TAU; st.n++;
  }
  return true;
}

// Bot-Nachdrall: mit der Chance der Stufe ein Ausschlag vom Tormann weg (Stärke 0,3–0,7), sonst null
export function ndBot(g, pl, e, chance) {
  if (!(chance > 0) || g.rng.next() >= chance) return null;
  const kpId = g.rules && g.rules.keeper ? g.rules.keeper[1 - pl.team] : -1, kp = kpId >= 0 ? g.players[kpId] : null;
  const gx = pl.team === 0 ? g.cage.hx : -g.cage.hx;
  // wo kreuzt der Schuss die Torlinie? Kurve weg vom Tormann
  const k = Math.abs(e.dx) > 1e-3 ? (gx - e.x) / e.dx : 0, zc = e.z + e.dz * k;
  const away = kp ? Math.sign(zc - kp.z) || 1 : (g.rng.next() < 0.5 ? -1 : 1);
  const lat = -away * Math.sign(e.dx || 1); // links in Schussrichtung = (dz, −dx): z-Anteil −dx
  return { lat: lat * (0.3 + 0.4 * g.rng.next()), lon: 0 };
}
