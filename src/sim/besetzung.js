// n13 Zufallsteams (Peter 07.11.2026: „Spielfiguren spielen bei jedem neuen Match zufällig in oranger oder blauer Mannschaft“,
// „Spieler heißen wie das Tier“). Ohne DOM, geprüft in tests/node/n13.test.mjs.
// Besetzung = Tiername je Spieler-Platz (0–2 Orange, 3–5 Blau; der Mensch spielt Orange Mitte = Platz 1). Bei jedem neuen Match
// (nicht bei Halbzeit/Tor) werden die sechs Tiere gemischt: drei nach Orange, drei nach Blau, auch welches Tier der Mensch steuert.
// Leibchenfarbe und Rückennummer folgen dem Platz, nicht dem Tier.
import { Rng } from './rng.js';

// roster = [[3 Namen Orange], [3 Namen Blau]] (feste Besetzung bis 0.9.x); zufall = false → genau diese Reihenfolge
export function mischeBesetzung(roster, rng = null, zufall = true) {
  const alle = [...roster[0], ...roster[1]];
  if (!zufall) return alle;
  const r = rng || new Rng(String(Math.random()));
  for (let i = alle.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [alle[i], alle[j]] = [alle[j], alle[i]]; }
  return alle;
}

// Zufall für das n-te Match: mit ?seed= reproduzierbar (seed + Matchnummer), sonst echter Zufall
export function besetzungsRng(seed, nr) { return new Rng(seed != null && seed !== '' ? `${seed}_besetzung_${nr}` : String(Math.random())); }

// Anzeigename eines Platzes: Tiername (groß für Einblendungen), der Mensch mit „(DU)“
export function tierName(besetzung, platz, { gross = false, du = false } = {}) {
  const n = besetzung && besetzung[platz];
  if (!n) return null;
  const s = gross ? n.toUpperCase() : n;
  return du ? s + (gross ? ' (DU)' : ' (du)') : s;
}
