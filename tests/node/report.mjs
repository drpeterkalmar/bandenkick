// Gemeinsame Ausgabe der Node-Tests: Markdown-Tabelle (für den Bericht) + JSON unter tests/out/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out');

const fmt = (v) => (typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 10 ? v.toFixed(2) : v.toFixed(3)) : String(v));

export function report(title, rows, file = null) {
  console.log(`\n### ${title}\n`);
  console.log('| Prüfung | Messwert | Fenster | Ziel | Ergebnis | Hinweis |');
  console.log('|---|---|---|---|---|---|');
  let ok = true;
  for (const r of rows) {
    ok = ok && r.ok;
    const info = r.lo === -Infinity && r.hi === Infinity;
    const win = info ? 'Info' : r.lo === -Infinity ? `≤ ${fmt(r.hi)} ${r.unit}` : r.hi === Infinity ? `≥ ${fmt(r.lo)} ${r.unit}` : `${fmt(r.lo)}–${fmt(r.hi)} ${r.unit}`;
    console.log(`| ${r.name} | ${fmt(r.value)} ${r.unit} | ${win} | ${r.target == null ? '–' : fmt(r.target) + ' ' + r.unit} | ${r.ok ? '✅' : '❌'} | ${r.note || ''} |`);
  }
  console.log(`\n${ok ? 'ALLE GRÜN' : 'FEHLER'} (${rows.filter((r) => r.ok).length}/${rows.length})`);
  try {
    mkdirSync(OUT, { recursive: true });
    const name = file || title.toLowerCase().replace(/[^a-z0-9äöü]+/g, '_').slice(0, 40);
    writeFileSync(join(OUT, name + '.json'), JSON.stringify({ title, ok, rows }, null, 1));
  } catch { /* nur Ausgabe */ }
  return ok;
}
