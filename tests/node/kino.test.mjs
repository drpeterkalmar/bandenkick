// n4 Kino-Look (Audit #1) ohne Browser: Bandenkick-Stufen (Renderskala am Handy kleiner als heute, AO 0,4 m, kein Dunst),
// Tag/Abend (Farbkorrektur, Bloom nur auf Leuchtendes), URL-Regler, Tiefenschärfe nur im Replay, Kontaktschatten (Größe,
// Ausrichtung in Blickrichtung, Verblassen beim Springen) und der KinoLook aus dem Grafik-Kern mit Bandenkick-Presets.
// Das Bild selbst (Shader) prüft erst der Heavy-Job im Browser. Aufruf: node tests/node/kino.test.mjs
import { report } from './report.mjs';
import { BK_PRESETS, BK_GRADES, lichtLook, kinoOptionen, kinoStufe, replayDof, kontaktFigur, kontaktBall } from '../../src/render/kino_logik.js';

await import('./three_hook.mjs');
const THREE = await import('three');
const { KinoLook, GRADES, STAGES } = await import('../../src/render/kern/kinolook.js');
const { makeKino, kinoStufeSetzen, kinoLicht, KontaktSchatten } = await import('../../src/render/kino.js');

const rows = [];
const check = (name, value, lo, hi, unit = '', note = '') => { rows.push({ name, value, lo, hi, unit, target: null, ok: value >= lo && value <= hi, note }); };
const yes = (name, cond, note = '') => check(name, cond ? 1 : 0, 1, 1, '', note);

// ---- Stufen ----
const [S0, S1, S2] = BK_PRESETS;
yes('Stufe 0 zeichnet direkt (kein Render-Target), Kontaktschatten an', !S0.pipeline && S0.stages.contact);
yes('Stufe 1: Renderskala 0,7–0,85, Start 0,85 (n4-Abnahme: 0,8 zu weich)', S1.scale[1] === 0.7 && S1.scale[2] === 0.85 && S1.scale[0] === 0.85);
// heute: Handy Stufe 1 = DPR 1,5 mit MSAA; neu: Szene in 1,5 × 0,85 höchstens, ohne MSAA → weniger Szenen-Pixel
check('Stufe 1: Szenen-Pixel neu/alt bei Renderskala max (DPR 1,5)', (1.5 * S1.scale[2]) ** 2 / 1.5 ** 2, 0, 0.75, '×', 'heute 1,5² mit MSAA');
yes('Stufe 1 ohne MSAA, mit Kantenglättung + Nachschärfen', S1.msaa === 0 && S1.stages.aa && S1.stages.sharpen);
check('Stufe 2: AO-Radius (m)', S2.ao.radius, 0.4, 0.4, 'm', 'Figuren-Maßstab');
yes('Stufe 2: MSAA 4 + Umgebungsverdeckung', S2.msaa === 4 && S2.stages.ssao);
yes('Dunst, Bewegungsunschärfe, Hitzeflimmern, Blendung überall aus', BK_PRESETS.every((p) => !p.stages.aerial && !p.stages.blur && !p.stages.haze && !p.stages.flare));
yes('Tiefenschärfe-Stufe an (wirkt nur, wenn das Replay sie anfordert)', S1.stages.dof && S2.stages.dof);
yes('Bloom ohne Himmel (bloomSky 0), dezente Vignette ≤ 0,15', [S1, S2].every((p) => p.bloomSky === 0 && p.vignette <= 0.15));
yes('alle Stufen-Schlüssel sind Kern-Stufen', [S1, S2].every((p) => Object.keys(p.stages).every((k) => STAGES.includes(k))));

// ---- Licht ----
const T1 = lichtLook('tag', 1), A1 = lichtLook('abend', 1), A2 = lichtLook('abend', 2);
check('Tag: Bloom-Schwelle (nur Leuchtendes)', T1.bloomThreshold, 0.97, 1);
check('Abend: Bloom-Schwelle Stufe 1', A1.bloomThreshold, 0.85, 0.95);
yes('Tag schwächerer Bloom als Abend', T1.bloomStrength < A1.bloomStrength);
yes('Tag ohne Bloom (nichts leuchtet), Abend mit', T1.bloom === false && A1.bloom === true && A2.bloom === true);
yes('Farbkorrektur tv / tvAbend', T1.grade === 'tv' && A1.grade === 'tvAbend' && A2.grade === 'tvAbend' && BK_GRADES.tv && BK_GRADES.tvAbend);
yes('TV-Look ohne Grün-Bremse, leicht gesättigt', BK_GRADES.tv.green === 0 && BK_GRADES.tv.sat > 1 && BK_GRADES.tv.sat < 1.15);

// ---- URL ----
const q = (s) => new URLSearchParams(s);
yes('?kino=0 → alter Weg', kinoOptionen(q('?kino=0')).on === false && kinoOptionen(q('')).on === true);
yes('?look=2 erzwingt Kino-Stufe, ?look=x ignoriert', kinoStufe(1, kinoOptionen(q('?look=2'))) === 2 && kinoStufe(1, kinoOptionen(q('?look=x'))) === 1);
// „+“ kommt aus der URL als Leerzeichen an – der Kern trimmt, ohne „-“ heißt an
yes('?kl= wird durchgereicht', kinoOptionen(q('?kl=-bloom,%2Bflare')).stages === '-bloom,+flare' && kinoOptionen(q('?kl=-bloom,+flare')).stages.split(',')[1].trim() === 'flare');

// ---- Replay-Tiefenschärfe ----
const dz = replayDof('zoom', [0, 0.5, 2], [0, 0.3, 0]), df = replayDof('fan', [14, 1.65, 3], [10, 0.8, 1]);
yes('Replay: Tiefenschärfe im Zoom und in der Fan-Cam, nicht in der TV-Kamera', !!dz && !!df && replayDof('tv', [0, 6, 14], [0, 0.7, 0]) === null);
check('Replay-Zoom: Fokus = Abstand Kamera → Blickpunkt', dz.focus, 2.0, 2.02, 'm');
yes('Fan-Cam weicher als Zoom', df.k < dz.k);
const db = replayDof('zoom', [0, 0.5, 2], [0, 0.3, 0], [0, 0.11, 1]);
check('Replay-Zoom: Ball vor dem Blickpunkt → Fokus auf den Ball', db.focus, 1.0, 1.1, 'm');

// ---- Kontaktschatten (Logik) ----
const K0 = kontaktFigur(0, 0), Kj = kontaktFigur(0.2, 0), Kd = kontaktFigur(0, 1);
yes('Figur: länglich in Blickrichtung, am Boden voll', K0.laengs > K0.quer && K0.a === 1);
check('Figur: Deckkraft bei 0,2 m Sprunghöhe', Kj.a, 0.45, 0.55);
yes('Figur: Hechtsprung → größer', Kd.laengs > K0.laengs && Kd.quer > K0.quer);
const B0 = kontaktBall(0.11, 0.11), B2 = kontaktBall(2.11, 0.11);
yes('Ball: am Boden dunkel und klein, hoch größer und blasser', B0.a === 1 && B2.s > B0.s && B2.a < B0.a && B2.a >= 0.1);

// ---- KinoLook aus dem Kern mit Bandenkick-Presets ----
const fakeR = { capabilities: { isWebGL2: true }, getDrawingBufferSize: (v) => v.set(1000, 500) };
const k = makeKino(fakeR, 1, kinoOptionen(q('')));
yes('makeKino: Standard, Pipeline, Startskala 0,85', k.level === 1 && k.pipeline && k.renderScale === 0.85);
yes('makeKino: Farbe tv, Tag-Bloom gesetzt', k.grade === 'tv' && k.bloomThreshold >= 0.97 && GRADES.tv === BK_GRADES.tv);
kinoStufeSetzen(k, 2);
yes('Stufe 2: Kino mit AO, Skala 0,9', k.level === 2 && k.stages.ssao && k.renderScale === 0.9 && k.msaa() === 4);
kinoLicht(k, 'abend');
yes('Abend: tvAbend, Preset-Schwelle', k.grade === 'tvAbend' && k.bloomThreshold === BK_PRESETS[2].bloom.threshold);
kinoStufeSetzen(k, 0);
yes('Stufe 0: kein Render-Target (direkt)', !k.pipeline);
const kf = makeKino(fakeR, 1, kinoOptionen(q('?look=2&kl=-bloom')));
kinoStufeSetzen(kf, 0);
yes('?look=2 bleibt trotz Stufenwechsel, ?kl=-bloom wirkt', kf.level === 2 && !kf.stages.bloom);
const orig = new KinoLook(fakeR, { level: 1 });
yes('Kern ohne neue Optionen = Stuntbahn-Verhalten (Standard 0,84, AO aus)', orig.renderScale === 0.84 && !orig.stages.ssao && orig.presets !== BK_PRESETS);

// ---- Kontaktschatten (InstancedMesh) ----
const fig = (x, z, face, y = 0, dive = 0) => { const root = new THREE.Group(); root.position.set(x, y, z); root.rotation.y = Math.PI / 2 - face; root.visible = true; return { root, dive }; };
const figs = [fig(1, 2, 0), fig(-3, 1, Math.PI / 2), fig(0, 0, 0, 0.5)];
figs.push({ root: Object.assign(new THREE.Group(), { visible: false }), dive: 0 });
const ks = new KontaktSchatten(figs, 0.11);
ks.update(4, 0.11, -2);
const m = new THREE.Matrix4(), p = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), c = new THREE.Color();
const at = (i) => { ks.mesh.getMatrixAt(i, m); m.decompose(p, qq, sc); ks.mesh.getColorAt(i, c); return { p: p.clone(), s: sc.clone(), a: c.r, z: new THREE.Vector3(0, 0, 1).applyQuaternion(qq) }; };
const i0 = at(0), i1 = at(1), i2 = at(2), i3 = at(3), ib = at(4);
yes('Instanzen: 4 Figuren + Ball', ks.n === 5 && ks.mesh.count === 5);
check('Figur 0 (Blick +x): lange Achse zeigt in +x', i0.z.x, 0.999, 1.001, '', `Länge ${i0.s.z.toFixed(2)} m, Breite ${i0.s.x.toFixed(2)} m`);
check('Figur 1 (Blick +z): lange Achse zeigt in +z', Math.abs(i1.z.z), 0.999, 1.001);
yes('Figur 0 liegt unter der Figur, knapp über dem Rasen', Math.abs(i0.p.x - 1) < 1e-6 && Math.abs(i0.p.z - 2) < 1e-6 && i0.p.y > 0 && i0.p.y < 0.01);
check('Figur 2 in 0,5 m Höhe: unsichtbar', i2.a, 0, 0.001);
ks.mesh.getMatrixAt(3, m);
check('unsichtbare Figur: Größe 0 (x- und z-Spalte leer)', Math.hypot(m.elements[0], m.elements[2], m.elements[8], m.elements[10]), 0, 1e-9);
yes('Ball: rund, unter dem Ball, volle Deckkraft am Boden', Math.abs(ib.s.x - ib.s.z) < 1e-9 && Math.abs(ib.p.x - 4) < 1e-9 && Math.abs(ib.p.z + 2) < 1e-9 && ib.a === 1);
ks.night = true; ks.update(4, 0.11, -2);
yes('Abend: Kontaktschatten etwas heller (Flutlicht von allen Seiten)', ks.mat.opacity < ks.base);

const ok = report('n4 Kino-Look (Logik, ohne Browser)', rows, 'kino');
process.exit(ok ? 0 : 1);
