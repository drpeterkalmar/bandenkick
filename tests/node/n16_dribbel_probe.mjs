// n16 Dribbeltricks (Peter 18.11.: „Bandenkick fehlen mir die Dribbeltricks“): Bot-Selbstspiel, Team 0 spielt „als Mensch“ (der Ballführende
// von Team 0 ist game.human, gesteuert von der Bot-KI – Wahrscheinlichkeiten, Kick-Vorrang und HUD wie beim Menschen). Gemessen: Ballbesitz-
// dauer (erste bis letzte eigene Berührung bzw. bis ein anderer berührt), Anteil der Ballbesitze mit Trick, Tricks je Minute, Trickdauer,
// frei/unter Druck, Erfolg, Ballverlust ≤ 1 s nach dem Trick, Tore. Aufruf: node tests/node/n16_dribbel_probe.mjs [Spiele=3] ["qs" …]
import { playGame } from './selfplay.mjs';
import { pathToFileURL } from 'node:url';

export function dribbel(qs = '', games = 3, seed0 = 1600) {
  const r = { games, min: 0, bes: { m: [], b: [] }, mitTrick: { m: 0, b: 0 }, lang: { m: 0, b: 0 }, langTrick: { m: 0, b: 0 }, tricks: { m: 0, b: 0 }, frei: { m: 0, b: 0 }, ok: { m: 0, b: 0 }, dauer: [], v0: 0, v1: 0, vn: 0, verlust: 0, okN: 0, tore: 0, arten: {} };
  for (let s = 0; s < games; s++) {
    let cur = null, offen = [];
    const st = playGame(seed0 + s, { qs, onStep: (g, ev) => {
      const R = g.rules;
      // „Mensch“ = Ballführender von Team 0 (Feldspieler), wie der automatische Wechsel im Spiel
      const lt = g.lastTouch >= 0 ? g.players[g.lastTouch] : null;
      if (lt && lt.team === 0 && lt.id !== R.keeper[0] && g.human !== lt.id) g.setHuman(lt.id);
      else if (g.human < 0) g.setHuman(g.players.find((p) => p.team === 0 && p.id !== R.keeper[0]).id);
      for (const e of ev) {
        if (e.type === 'skill') {
          const k = e.human ? 'm' : 'b';
          r.tricks[k]++; if (e.frei) r.frei[k]++; if (e.ok) r.ok[k]++;
          r.arten[e.id] = (r.arten[e.id] || 0) + 1;
          if (cur && cur.pl === e.player && e.ok) cur.trick = true; // (nur sichtbare: gelungen)
          if (e.ok) offen.push({ team: g.players[e.player].team, t: g.t, pl: e.player });
        }
        if (e.type === 'goal') r.tore++;
        if (e.player != null && e.player >= 0 && ['touch', 'kick', 'tackle', 'catch', 'control'].includes(e.type)) for (const o of offen) if (!o.weg && g.players[e.player].team !== o.team) o.weg = true;
      }
      offen = offen.filter((o) => { if (g.t - o.t < 1) return true; r.okN++; if (o.weg) r.verlust++; return false; });
      for (const p of g.players) {
        if (p.skill2 && p.skill2.t < 1e-9 + 1 / 120) { r.dauer.push(p.skill2.dur); if (p.skill2.frei) p.skill2.v0 = p.speed; }
        if (p.skill2 && p.skill2.frei && p.skill2.v0 != null && p.skill2.t + 1 / 60 >= p.skill2.dur) { r.v0 += p.skill2.v0; r.v1 += p.speed; r.vn++; }
      }
      // Ballbesitz: lastTouch-Wechsel; Ende bei anderem Spieler, Ball in der Hand oder Spiel ruht
      const id = R.phase === 'play' && g.ball.held < 0 ? g.lastTouch : -1;
      if (cur && cur.pl !== id) {
        const k = cur.mensch ? 'm' : 'b', T = cur.last - cur.t0;
        if (T > 0.15) { r.bes[k].push(T); if (cur.trick) r.mitTrick[k]++; }
        if (T >= 0.6) { r.lang[k]++; if (cur.trick) r.langTrick[k]++; } // (Ballbesitz ≥ 0,6 s: Zeit für einen Trick)
        cur = null;
      }
      if (!cur && id >= 0 && id !== R.keeper[0] && id !== R.keeper[1]) cur = { pl: id, t0: g.t, last: g.t, mensch: g.players[id].team === 0, trick: false };
      if (cur && g.players[cur.pl].lastTouchT >= cur.last) cur.last = Math.max(cur.last, g.players[cur.pl].lastTouchT);
      if (cur) cur.last = Math.max(cur.last, g.lastTouchT);
    } });
    r.min += st.t / 60;
  }
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  r.medBes = { m: med(r.bes.m), b: med(r.bes.b) }; r.medDauer = med(r.dauer);
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const G = +(process.argv[2] || 3), qs = process.argv.slice(3);
  for (const q of qs.length ? qs : ['dribbel=0', '']) {
    const r = dribbel(q === '-' ? '' : q, G);
    const f = (k) => `Ballbesitze ${r.bes[k].length}, Median ${r.medBes[k].toFixed(2)} s, mit sichtbarem Trick ${(100 * r.mitTrick[k] / Math.max(1, r.bes[k].length)).toFixed(0)} % (Ballbesitz ≥ 0,6 s: ${(100 * r.langTrick[k] / Math.max(1, r.lang[k])).toFixed(0)} % von ${r.lang[k]}), Tricks ${r.tricks[k]} (frei ${r.frei[k]}, gelungen ${r.ok[k]})`;
    console.log(`${q || 'Standard'} | Mensch: ${f('m')} | Bots: ${f('b')} | Trickdauer Median ${r.medDauer.toFixed(2)} s · Tempo freier Trick Anfang/Ende ${(r.v0 / Math.max(1, r.vn)).toFixed(2)}/${(r.v1 / Math.max(1, r.vn)).toFixed(2)} m/s · Ballverlust ≤ 1 s nach gelungenem Trick ${(100 * r.verlust / Math.max(1, r.okN)).toFixed(0)} % · Tore ${(r.tore / G).toFixed(1)}/Spiel · ${JSON.stringify(r.arten)}`);
  }
}
