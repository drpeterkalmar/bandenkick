// Sim-Zustand eines Spielers für Figuren-Tests (wie avatar.test.mjs spieler())
export function spieler(o = {}) {
  return { face: 0, speed: 0, vx: 0, vz: 0, plant: 0, kickT: 9, kickFoot: 1, techT: 9, tech: '', hand: { mode: 'none', dx: 0, dz: 0, t: 0, T: 0.38 }, jumpY: 0, air: null, fall: null, slide: null, P: { slideGroundT: 0.6 }, ...o };
}
