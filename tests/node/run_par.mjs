// Wie run_all.mjs, aber mehrere Testdateien gleichzeitig (n7: schneller Durchlauf während der Arbeit). Aufruf:
// node tests/node/run_par.mjs [Prozesse=4] [Datei …]   – ohne Dateien alle aus run_all.mjs; Ausgabe je Datei unter tests/out/par/
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const W = +(process.argv[2] || 4);
let files = process.argv.slice(3);
if (!files.length) files = JSON.parse(readFileSync(join(here, 'run_all.mjs'), 'utf8').match(/for \(const f of (\[[^\]]+\])/)[1].replace(/'/g, '"'));
// lange Läufer zuerst
const LONG = ['selfplay.test.mjs', 'magnet.test.mjs', 'keeper.test.mjs', 'passsystem.test.mjs', 'tackle.test.mjs', 'action.test.mjs', 'challenge.test.mjs'];
files.sort((a, b) => (LONG.includes(b) ? 1 : 0) - (LONG.includes(a) ? 1 : 0));
const out = join(here, '..', 'out', 'par'); mkdirSync(out, { recursive: true });
const t0 = Date.now(); let bad = [], i = 0;
await Promise.all(Array.from({ length: W }, async () => {
  while (i < files.length) {
    const f = files[i++];
    const code = await new Promise((res) => {
      let log = '';
      const p = spawn(process.execPath, [join(here, f)]);
      p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
      p.on('exit', (c) => { writeFileSync(join(out, f + '.txt'), log); res(c); });
    });
    const fails = code ? readFileSync(join(out, f + '.txt'), 'utf8').split('\n').filter((l) => l.includes('❌') || /Error|FEHLER/.test(l)).slice(0, 6) : [];
    console.log(`${code ? '✗' : '✓'} ${f} (${((Date.now() - t0) / 1000).toFixed(0)} s)${fails.length ? '\n   ' + fails.join('\n   ') : ''}`);
    if (code) bad.push(f);
  }
}));
console.log(bad.length ? `\n${bad.length} Testdatei(en) rot: ${bad.join(', ')}` : '\nAlle Node-Tests grün');
process.exit(bad.length ? 1 : 0);
