// n7: Skript-Mensch dribbelt gegen einen Stufe-2-Verteidiger (Haltedauer, Ballverluste je Minute am Ball, Erfolg).
// Aufruf: node tests/node/hold_probe.mjs [Query] [Seeds=20]
import { humanHold } from './n7_probe.mjs';
const qs = process.argv[2] || '', n = +(process.argv[3] || 20);
const r = humanHold(qs, n);
console.log(`Mensch gegen Stufe-2-Verteidiger „${qs || 'Standard'}“: ${r.att} Versuche, Haltedauer Ø ${r.holdMean.toFixed(2)} s, Ballverluste ${r.lostPerMin.toFixed(2)} je Minute am Ball (${r.lostShare.toFixed(0)} % der Versuche), verspringt ${r.freeShare.toFixed(0)} %, bis vors Tor ${r.okShare.toFixed(0)} %, Zeit um ${r.timeout}`);
