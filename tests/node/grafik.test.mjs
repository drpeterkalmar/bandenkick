// n4 Qualitäts-Autopilot (Audit #2) ohne Browser: Bandenkick-Steuerung (src/render/grafik.js) um den Kern-Autopiloten mit
// künstlichen Geräten (Arbeitszeit je Bild aus einem Kostenmodell, 60-Hz-Bildschirm): starkes Handy kommt auf Stufe 2,
// schwaches regelt schnell herunter (Renderskala zuerst), CPU-gebundenes überspringt die Renderskala, kein Pendeln,
// feste Stufe/Start-Logik/Gerätespeicher/Kurzmessung. Das echte Verhalten im Browser prüft der Heavy-Job
// (tests/test_autoq.py, perf_gate Szene spiel_auto). Aufruf: node tests/node/grafik.test.mjs
import { report } from './report.mjs';
import { GrafikSteuerung, stufenWerte, skalaBereich, startStufe, startSkala, ladeStufe, merkeStufe, SKALA_DIREKT, DPR_CAP } from '../../src/render/grafik.js';
import { BK_PRESETS } from '../../src/render/kino_logik.js';

const rows = [];
const check = (name, value, lo, hi, unit = '', note = '') => { rows.push({ name, value, lo, hi, unit, target: null, ok: value >= lo && value <= hi, note }); };
const yes = (name, cond, note = '') => check(name, cond ? 1 : 0, 1, 1, '', note);

// Kino-Ersatz (nur was grafik.js braucht): Presets + Skalenbereich
const kinoFake = { presets: BK_PRESETS, stages: { scale: true }, scaleRangeOf: (l) => BK_PRESETS[l].scale || [1, 1, 1] };

// Künstliches Gerät: CPU-Zeit fest je Stufe (+ Deko), GPU-Zeit = Pixelanteil · Skala² (+ Menschen-Schatten auf Stufe 2)
function geraet({ cpu = [3, 4, 4.5], gpuVoll = [6, 12, 20], deko = 0.6, menschen = 1.5, gpuTimer = true }) {
  return (st) => {
    const l = st.level, s = st.skala;
    const c = cpu[l] + (st.dekoAn ? deko : 0) + (l === 2 && st.menschenAn ? 0.4 : 0);
    const g = gpuVoll[l] * s * s + (l === 2 && st.menschenAn ? menschen : 0);
    return { cpu: c, gpu: gpuTimer ? g : null, arbeit: Math.max(c, g) };
  };
}
// Läuft sek Sekunden; Bildabstand = Arbeit auf 60-Hz-Takt gerundet (vsync). Liefert Verlauf und Steuerung.
function lauf(dev, { level = 1, sek = 60, start = null } = {}) {
  const S = new GrafikSteuerung({ level, kino: kinoFake });
  S.start(start);
  const verlauf = []; let t = 0, n = 0;
  while (t < sek) {
    const w = dev(S);
    const takt = 1000 / 60, ab = Math.ceil(w.arbeit / takt - 1e-9) * takt;
    S.gpu = w.gpu != null ? { ms: w.gpu } : null;
    const ch = S.bild(ab / 1000, w.cpu);
    t += ab / 1000; n++;
    if (ch) verlauf.push({ t: +t.toFixed(2), level: S.level, skala: S.skala, deko: S.dekoAn, menschen: S.menschenAn });
  }
  return { S, verlauf, n };
}
const erste = (v, f) => { const e = v.find(f); return e ? e.t : Infinity; };
const aenderungenAb = (v, t0) => v.filter((e) => e.t >= t0).length;

// ---- Stufenwerte / Bereiche ----
const w0 = stufenWerte(0, { dpr: 2.6 }), w1 = stufenWerte(1, { dpr: 2.6 }), w2 = stufenWerte(2, { dpr: 2.6 }), w2a = stufenWerte(2, { dpr: 2.6, schatten2: 1024 });
yes('Stufenwerte: Pixeldichte 1 / 1,5 / 2 (Deckel wie bisher)', w0.dpr === 1 && w1.dpr === 1.5 && w2.dpr === 2 && DPR_CAP.join() === '1,1.5,2');
yes('Stufenwerte: Schatten ab 1, Menschen-Schatten ab 2, MSAA-Canvas ab 1', !w0.shadows && w1.shadows && !w1.avatarShadows && w2.avatarShadows && !w0.aa && w1.aa);
yes('Schattenkarte: Stufe 1 = 1024, Stufe 2 = 2048 (wie bisher), ?schatten2=1024 möglich', w1.shadowSize === 1024 && w2.shadowSize === 2048 && w2a.shadowSize === 1024);
yes('Skalenbereich: Stufe 1 = Kino-Look 0,7–0,85 (Start 0,85), Stufe 0 direkt', skalaBereich(1, kinoFake).join() === '0.7,0.85,0.85' && skalaBereich(0, kinoFake).join() === SKALA_DIREKT[0].join());
yes('Skalenbereich ohne Kino-Look (?kino=0): Pixeldichte-Faktor', skalaBereich(1, null).join() === SKALA_DIREKT[1].join());
yes('Skalenbereich der Ziel-Stufe, auch wenn der Kino-Look gerade auf Stufe 0 steht; ?kl=-scale → direkt', skalaBereich(1, { ...kinoFake, stages: { contact: true } }).join() === '0.7,0.85,0.85'
  && skalaBereich(1, { ...kinoFake, overrides: { scale: false } }).join() === SKALA_DIREKT[1].join());

// ---- Start ----
yes('Start: ?q= fest, sonst gemerkt, sonst Touch 1 / Desktop 2', startStufe({ q: '0', gemerkt: 2, touch: true }).fest && startStufe({ q: '0' }).stufe === 0
  && startStufe({ gemerkt: 2, touch: true }).stufe === 2 && startStufe({ touch: true }).stufe === 1 && startStufe({ touch: false }).stufe === 2
  && startStufe({ gemerkt: 0, touch: true, autopilot: false }).stufe === 1);
const mem = new Map(), store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
merkeStufe(store, 2, 1000);
yes('Gerätespeicher: Stufe merken/laden, nach 21 Tagen verworfen, Unsinn → null', ladeStufe(store, 2000) === 2 && ladeStufe(store, 1000 + 22 * 864e5) === null
  && (mem.set('bk_grafik', '{"stufe":7}'), ladeStufe(store, 2000) === null) && (mem.set('bk_grafik', 'kaputt'), ladeStufe(store, 2000) === null));
check('Kurzmessung: 20 ms je Bild bei 0,8 → Startskala (Bereich 0,7–0,85)', startSkala(20, [0.7, 0.85], 0.8), 0.7, 0.7);
check('Kurzmessung: 6 ms je Bild bei 0,8 → Startskala', startSkala(6, [0.7, 0.85], 0.8), 0.85, 0.85);

// ---- Geräte ----
// starkes Handy: Stufe 1 hat viel Luft → Skala hoch auf 0,85, dann Stufe 2 (am Minimum 0,7), dann Skala nachführen
const A = lauf(geraet({ cpu: [2.5, 3, 3.5], gpuVoll: [3, 5, 9] }), { level: 1, sek: 60 });
check('starkes Handy: Stufe nach 60 s', A.S.level, 2, 2, '', `rauf nach ${erste(A.verlauf, (e) => e.level === 2)} s, Skala ${A.S.skala}`);
check('starkes Handy: Zeit bis Stufe 2', erste(A.verlauf, (e) => e.level === 2), 0, 25, 's');
check('starkes Handy: Änderungen in den letzten 20 s (kein Pendeln)', aenderungenAb(A.verlauf, 40), 0, 2);
// schwaches Handy: Stufe 1 bei 0,8 ≈ 26 ms GPU → erst Skala, dann Deko, dann Stufe 0
const B = lauf(geraet({ cpu: [4, 5, 6], gpuVoll: [9, 40, 60] }), { level: 1, sek: 30 });
check('schwaches Handy: erster Schritt nach unten', erste(B.verlauf, () => true), 0, 3, 's', B.verlauf.slice(0, 4).map((e) => `${e.t}s L${e.level} s${e.skala}${e.deko ? '' : ' -deko'}`).join(' · '));
yes('schwaches Handy: erster Schritt ist die Renderskala', B.verlauf[0] && B.verlauf[0].level === 1 && B.verlauf[0].skala < 0.8 && B.verlauf[0].deko);
check('schwaches Handy: Zeit bis Stufe 0', erste(B.verlauf, (e) => e.level === 0), 0, 10, 's');
check('schwaches Handy: Änderungen in den letzten 15 s (ein Fehlversuch, dann gelernt)', aenderungenAb(B.verlauf, 15), 0, 0, '', B.verlauf.slice(3).map((e) => `${e.t}s L${e.level} s${e.skala}${e.deko ? '' : ' -deko'}${e.menschen ? '' : ' -m'}`).join(' · '));
check('schwaches Handy: gelernte Kosten der Stufe (Schätzung 0,3)', B.S.ap.ding('stufe').kosten, 0.8, 5);
// mittleres Handy: Stufe 1 knapp zu teuer → nur Renderskala, Stufe bleibt
const C = lauf(geraet({ cpu: [3, 4, 5], gpuVoll: [6, 27, 40] }), { level: 1, sek: 40 });
yes('mittleres Handy: bleibt auf Stufe 1, nur die Renderskala sinkt', C.S.level === 1 && C.S.skala < 0.8 && C.S.skala >= 0.7, `Skala ${C.S.skala}, Deko ${C.S.dekoAn}`);
// CPU-gebunden: GPU klein, CPU 17 ms → Renderskala hilft nicht → Deko/Menschen/Stufe
const D = lauf(geraet({ cpu: [12, 17, 19], gpuVoll: [3, 4, 6] }), { level: 1, sek: 20 });
yes('CPU-gebunden: Renderskala bleibt, zuerst Deko aus', D.verlauf[0] && D.verlauf[0].skala === 0.85 && !D.verlauf[0].deko, D.verlauf.slice(0, 3).map((e) => `L${e.level} s${e.skala}${e.deko ? '' : ' -deko'}`).join(' · '));
// ohne GPU-Zeit (viele Android-Geräte): starkes Gerät tastet sich hoch, schwaches regelt herunter
const E = lauf(geraet({ cpu: [2.5, 3, 3.5], gpuVoll: [3, 5, 9], gpuTimer: false }), { level: 1, sek: 90 });
check('ohne GPU-Zeit, starkes Gerät: Stufe nach 90 s', E.S.level, 2, 2, '', `Skala ${E.S.skala}`);
const F = lauf(geraet({ cpu: [4, 5, 6], gpuVoll: [9, 40, 60], gpuTimer: false }), { level: 1, sek: 30 });
check('ohne GPU-Zeit, schwaches Gerät: Zeit bis Stufe 0', erste(F.verlauf, (e) => e.level === 0), 0, 15, 's');
// Rückrufe: Stufe, Skala, Deko, Menschen, Merken
const calls = [];
const G = new GrafikSteuerung({ level: 2, kino: kinoFake, wirkung: { stufe: (l) => calls.push('stufe' + l), skala: (s, l) => calls.push(`skala${s}@${l}`), deko: (a) => calls.push('deko' + a), menschenschatten: (a) => calls.push('menschen' + a), merke: (z) => calls.push('merke' + z.level) } });
G.start(0.8);
for (let i = 0; i < 600; i++) { G.gpu = { ms: 40 }; G.bild(1 / 20, 10); }
yes('Rückrufe in Reihenfolge Skala → Deko → Menschen → Stufe, je Änderung gemerkt', calls[0] === 'skala0.8@2' && calls.indexOf('dekofalse') < calls.indexOf('menschenfalse') && calls.indexOf('menschenfalse') < calls.indexOf('stufe1') && calls.includes('merke1'), calls.slice(0, 9).join(' '));
yes('info: Schritte als Text', G.schritte().length > 0 && /skala|deko|stufe/.test(G.schritte()[0]));

const ok = report('n4 Qualitäts-Autopilot (künstliche Geräte)', rows, 'grafik');
process.exit(ok ? 0 : 1);
