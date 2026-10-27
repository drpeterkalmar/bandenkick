// n8 Etappe 2: Stick-Richtung im Bild ↔ Richtung auf dem Feld. Ein Kind zeigt mit dem Stick im Bild auf den Mitspieler (vom eigenen
// Spieler zum Mitspieler, wie es ihn auf dem Bildschirm sieht). Bis n8 E1 bildet das Spiel den Stick linear über die Bodenachsen der
// Kamera ab (groundAxes) – durch die schräge Kamera stimmt das nicht mit dem Feld überein. Gemessen mit der echten Spielkamera
// (GameCamera, three.js in Node) hoch (412 × 915) und quer (915 × 412), Mitspieler 4–12 m entfernt und im Bild.
// Export: kamera(form), richtungen(cam, me, mate) → Winkel; stickAusBild(cam, me, mate, neu) → Welt-Stick wie im Spiel.
// Aufruf: node tests/node/stickbild.mjs [N]
import { makeParams } from '../../src/sim/params.js';
import { Game } from '../../src/sim/step.js';
import { Rng } from '../../src/sim/rng.js';
import { pathToFileURL } from 'node:url';

await import('./three_hook.mjs');
const THREE = await import('three');
const { GameCamera } = await import('../../src/render/camera.js');

export const FORMEN = { hoch: [412, 915], quer: [915, 412] };
const DEG = 180 / Math.PI;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

export function kamera(form, cage) {
  const [W, H] = FORMEN[form];
  const c = new GameCamera(W / H, cage); c.setAspect(W / H, form);
  return c;
}
// Kamera eingeschwungen auf Ball/Spieler (wie im Spiel nach ≥ 2 s)
export function folgen(c, ball, player, sec = 3) { for (let i = 0; i < sec * 60; i++) c.update(1 / 60, ball, player, 'play'); }
// Bildpunkt (Pixel, y nach unten) eines Bodenpunkts
export function bild(c, x, z) {
  const v = new THREE.Vector3(x, 0, z).project(c.cam);
  return { x: v.x, y: v.y, ok: Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98 && v.z < 1 };
}
// Stick, den ein Kind hält, wenn es im Bild vom eigenen Spieler auf den Mitspieler zeigt: [sx rechts, sy oben], Länge 1
export function stickImBild(c, me, mate) {
  const a = bild(c, me.x, me.z), b = bild(c, mate.x, mate.z);
  const sx = (b.x - a.x) * c.cam.aspect, sy = b.y - a.y, l = Math.hypot(sx, sy) || 1;
  return [sx / l, sy / l];
}
// Welt-Stick wie im Spiel: alt = Bodenachsen (main.js worldInput bis n8 E1), neu = bildschirmtreu (GameCamera.stickWelt)
export function stickWelt(c, me, s, neu) {
  if (neu) { const w = c.stickWelt(me.x, me.z, s[0], s[1]); if (w) return w; }
  const ax = c.groundAxes();
  return [s[0] * ax.rx + s[1] * ax.fx, s[0] * ax.rz + s[1] * ax.fz];
}

export function messen(form, N = 400, seed = 1) {
  const g = new Game(makeParams(''), 1, { match: true, human: 0 });
  const R = new Rng('sb' + form + seed), hx = g.cage.hx, hz = g.cage.hz;
  const c = kamera(form, g.cage);
  const out = { alt: [], neu: [], n: 0 };
  while (out.n < N) {
    const me = { x: R.range(-hx + 2, hx - 2), z: R.range(-hz + 1, hz - 1) };
    const D = R.range(4, 12), a = R.range(-Math.PI, Math.PI);
    const mate = { x: me.x + Math.cos(a) * D, z: me.z + Math.sin(a) * D };
    if (Math.abs(mate.x) > hx - 0.6 || Math.abs(mate.z) > hz - 0.6) continue;
    folgen(c, { x: me.x + 0.4, z: me.z, vx: 0, vz: 0 }, me, 2);
    if (!bild(c, me.x, me.z).ok || !bild(c, mate.x, mate.z).ok) continue;
    const s = stickImBild(c, me, mate), phi = Math.atan2(mate.z - me.z, mate.x - me.x);
    for (const neu of [false, true]) { const w = stickWelt(c, me, s, neu); out[neu ? 'neu' : 'alt'].push(angDiff(Math.atan2(w[1], w[0]), phi) * DEG); }
    out.n++;
  }
  const q = (arr, p) => { const b = [...arr].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
  const st = (arr) => ({ p50: q(arr, 0.5), p90: q(arr, 0.9), max: Math.max(...arr), ueber15: 100 * arr.filter((x) => x > 15).length / arr.length, ueber30: 100 * arr.filter((x) => x > 30).length / arr.length });
  return { form, n: out.n, alt: st(out.alt), neu: st(out.neu) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const N = +(process.argv[2] || 400);
  console.log('| Format | Fälle | alt p50 / p90 / max | alt > 15° / > 30° | neu p50 / p90 / max | neu > 15° |\n|---|---|---|---|---|---|');
  for (const f of ['hoch', 'quer']) {
    const r = messen(f, N), F = (x) => x.toFixed(1);
    console.log(`| ${f} | ${r.n} | ${F(r.alt.p50)}° / ${F(r.alt.p90)}° / ${F(r.alt.max)}° | ${F(r.alt.ueber15)} % / ${F(r.alt.ueber30)} % | ${F(r.neu.p50)}° / ${F(r.neu.p90)}° / ${F(r.neu.max)}° | ${F(r.neu.ueber15)} % |`);
  }
}
