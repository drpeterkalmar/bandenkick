// Nacht 2e: alle Sounds raus (Peter 03.10.: „es brutzelt noch immer ab Spielstart“). Prüft den ausgelieferten Code
// (Precache-Liste des Service-Workers + index.html): kein AudioContext/webkitAudioContext/OfflineAudioContext, kein
// navigator.audioSession, keine <audio>-Elemente, kein new Audio(). Dazu: der Stub hat die alte Schnittstelle und tut
// nichts. Die Laufzeit-Prüfung im Browser (0 Konstruktor-Aufrufe in Menü, Spiel, Training, Wiederholung) steht in smoke.py.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { report } from './report.mjs';
import { Sound } from '../../src/audio/sound.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rows = [];
const check = (name, value, lo, hi, unit = '', target = null, note = '') => rows.push({ name, value, lo, hi, unit, target, ok: value >= lo && value <= hi, note });

const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const files = [...sw.matchAll(/'([^']+\.(?:js|html|css))'/g)].map((m) => m[1]).filter((f) => !f.startsWith('lib/'));
files.push('index.html');
// lib/three enthält THREE.AudioContext/AudioListener (nur bei Benutzung aktiv) – unser Code darf sie nicht anfassen
const BAD = [/AudioListener|PositionalAudio|THREE\.Audio/, /AudioContext/, /webkitAudioContext/, /audioSession/, /<audio\b/i, /new\s+Audio\s*\(/, /createElement\(\s*['"]audio['"]/];
const hits = [];
for (const f of new Set(files)) {
  let src; try { src = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
  // Kommentare zählen nicht (der Stub erklärt, was fehlt)
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  for (const re of BAD) if (re.test(code)) hits.push(`${f}: ${re}`);
}
check(`ausgelieferter Code (${new Set(files).size} Dateien): Audio-Erzeuger`, hits.length, 0, 0, '', 0, hits.slice(0, 4).join(', '));

const s = new Sound(true);
let threw = 0;
try {
  await s.init(); s.unlock(); s.toggle(); s.startAmbience(); s.play('kick'); s.tick(0.016, {}, true);
  s.event({ type: 'kick', x: 0 }, { cage: { hx: 12 }, players: [] }); s.shout('hey', {}, 0);
} catch { threw = 1; }
check('Stub: alte Schnittstelle ruft ohne Fehler', threw, 0, 0);
check('Stub: kein Kontext, aus', s.ctx === null && s.on === false ? 1 : 0, 1, 1);
check('Pause-Menü ohne Ton-Knopf', /data-act="sound"/.test(readFileSync(join(ROOT, 'src/ui/hud.js'), 'utf8')) ? 1 : 0, 0, 0);

process.exit(report('Ton aus (Nacht 2e)', rows, 'stumm') ? 0 : 1);
