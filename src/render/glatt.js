// n5 Glättung ohne three.js (läuft auch in Node): kritisch gedämpfte Feder – folgt einem Ziel ohne Überschwingen und
// ohne Knick in der Geschwindigkeit (anders als ein einfacher Tiefpass). w = Eigenkreisfrequenz in 1/s (halber Weg
// nach ~1,68/w s). Exakte Lösung je Schritt → unabhängig von der Bildrate.
// Ergebnis [x, v] in out (ohne Neuanlage je Bild, Standard: gemeinsamer Puffer – sofort auslesen)
const _fk = [0, 0];
export function federKrit(x, v, ziel, dt, w, out = _fk) {
  const d = x - ziel, e = Math.exp(-w * dt), k = (v + w * d) * dt;
  out[0] = ziel + (d + k) * e; out[1] = (v - w * k) * e;
  return out;
}
// dasselbe für Vektoren (Arrays gleicher Länge), schreibt in x und v
export function federKritVek(x, v, ziel, dt, w) {
  const e = Math.exp(-w * dt);
  for (let i = 0; i < x.length; i++) {
    const d = x[i] - ziel[i], k = (v[i] + w * d) * dt;
    x[i] = ziel[i] + (d + k) * e; v[i] = (v[i] - w * k) * e;
  }
}
