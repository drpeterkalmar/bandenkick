// Alle Node-Tests nacheinander; Exit-Code 1, wenn einer rot ist. Aufruf: npm test
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let bad = 0;
for (const f of ['fifa.test.mjs', 'aero.test.mjs', 'cage.test.mjs', 'player.test.mjs', 'rules.test.mjs', 'gesture.test.mjs', 'tap.test.mjs', 'technique.test.mjs', 'pass.test.mjs', 'shot.test.mjs', 'curve.test.mjs', 'air.test.mjs', 'challenge.test.mjs', 'keeper.test.mjs', 'magnet.test.mjs', 'tackle.test.mjs', 'wucht.test.mjs', 'replay.test.mjs', 'stumm.test.mjs', 'halten.test.mjs', 'rueckpass.test.mjs', 'passsystem.test.mjs', 'selfplay.test.mjs', 'kino.test.mjs', 'grafik.test.mjs', 'schatten.test.mjs', 'avatar.test.mjs']) {
  const r = spawnSync(process.execPath, [join(here, f)], { stdio: 'inherit' });
  if (r.status !== 0) { bad++; console.log(`✗ ${f}`); }
}
console.log(bad ? `\n${bad} Testdatei(en) rot` : '\nAlle Node-Tests grün');
process.exit(bad ? 1 : 0);
