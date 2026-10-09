// n5 Ruckel-Messung (nur Tests, tests/ruckel.py): je Bild Knochen-Lagen der Figuren im Figuren-Raum (Becken, Füße,
// Hände, Kopf – ohne Lauf-Weg und Drehung, damit nur die Pose zählt), Lage/Blickrichtung der Figur, Summe der
// Clip-Gewichte, Sichtbarkeit sowie Kamera (Lage, Blickrichtung, Öffnungswinkel) und Wiederholungs-Abschnitt.
// Ausgewertet wird in Python (Ruck = zweite Ableitung, Pose-Sprünge, Kamera-Ruck). Kostet nichts, solange aus.
import * as THREE from 'three';

export const RUCK_KNOCHEN = ['Bip01_Pelvis', 'Bip01_L_Foot', 'Bip01_R_Foot', 'Bip01_L_Hand', 'Bip01_R_Hand', 'Bip01_Head'];
// Felder je Figur: sichtbar, gespart, x, y, z, yaw, Gewichtssumme, je Knochen x y z (Figuren-Raum), dann Zustand zur
// Zuordnung der Sprünge: Zeit seit Schuss, Gewicht Sonderbewegung, Gewicht Technik-Pose, Tempo, Stemmschritt
export const RUCK_ZUSTAND = ['kickT', 'specialW', 'tpW', 'speed', 'plant'];
const NF = 7 + RUCK_KNOCHEN.length * 3 + RUCK_ZUSTAND.length;
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _fr = new THREE.Frustum(), _m = new THREE.Matrix4(), _s = new THREE.Sphere(new THREE.Vector3(), 1.1);

export class RuckMessung {
  constructor(nFig, maxBilder = 9000) {
    this.nFig = nFig; this.max = maxBilder;
    this.kopf = 12; // t, dt, Kamera x y z, Blick x y z, fov, Abschnitt-Nr., Tempo, Spielzeit
    this.stride = this.kopf + nFig * NF;
    this.buf = new Float32Array(this.max * this.stride);
    this.n = 0; this.abschnitte = [''];
  }
  bild(t, dt, cam, figs, ab, rate, spielT, spieler = []) {
    if (this.n >= this.max) return;
    const o = this.n * this.stride, B = this.buf;
    let ai = this.abschnitte.indexOf(ab); if (ai < 0) { ai = this.abschnitte.length; this.abschnitte.push(ab); }
    cam.updateMatrixWorld();
    cam.getWorldDirection(_d);
    B[o] = t; B[o + 1] = dt; B[o + 2] = cam.position.x; B[o + 3] = cam.position.y; B[o + 4] = cam.position.z;
    B[o + 5] = _d.x; B[o + 6] = _d.y; B[o + 7] = _d.z; B[o + 8] = cam.fov; B[o + 9] = ai; B[o + 10] = rate; B[o + 11] = spielT;
    _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_m);
    for (let i = 0; i < this.nFig; i++) {
      const f = figs[i], q = o + this.kopf + i * NF;
      if (!f || !f.bones || !f.root.visible) { B[q] = 0; continue; }
      const r = f.root;
      _s.center.set(r.position.x, r.position.y + 1, r.position.z);
      B[q] = _fr.intersectsSphere(_s) ? 1 : 0;
      B[q + 1] = f.gespartBild ? 1 : 0; // in diesem Bild nicht neu gestellt (n4-Sparen außerhalb des Bildes)
      B[q + 2] = r.position.x; B[q + 3] = r.position.y; B[q + 4] = r.position.z; B[q + 5] = r.rotation.y;
      let ws = 0; for (const a of Object.values(f.act)) ws += a.getEffectiveWeight();
      B[q + 6] = ws;
      const c = Math.cos(-r.rotation.y), s = Math.sin(-r.rotation.y);
      for (let k = 0; k < RUCK_KNOCHEN.length; k++) {
        _v.setFromMatrixPosition(f.bones[RUCK_KNOCHEN[k]].matrixWorld).sub(r.position);
        const j = q + 7 + k * 3;
        B[j] = _v.x * c + _v.z * s; B[j + 1] = _v.y; B[j + 2] = -_v.x * s + _v.z * c;
      }
      const z = q + 7 + RUCK_KNOCHEN.length * 3, pl = spieler[i] || {};
      B[z] = Math.min(9, pl.kickT ?? 9); B[z + 1] = f.specialW || 0; B[z + 2] = f.tpW || 0; B[z + 3] = pl.speed || 0; B[z + 4] = pl.plant || 0;
    }
    this.n++;
  }
  // als einfache Arrays für page.evaluate (Float32 → Zahlen)
  daten() { return { n: this.n, stride: this.stride, kopf: this.kopf, nf: NF, knochen: RUCK_KNOCHEN, zustand: RUCK_ZUSTAND, abschnitte: this.abschnitte, buf: Array.from(this.buf.subarray(0, this.n * this.stride)) }; }
}
