// Aerodynamik des Balls: Luftwiderstand mit Drag-Crisis, Magnus-Auftrieb, Flatterball.
// Quellen:
//  - Hong S., Asai T. (2014) Effect of panel shape of soccer ball on its flight characteristics.
//    Sci. Rep. 4:5068 – cD(Re) je Ball, kritisches Re, Schwankung der Seiten-/Auftriebskräfte, Kick-Roboter.
//  - Asai T., Seo K., Kobayashi O., Sakashita R. (2007) Fundamental aerodynamics of the soccer ball.
//    Sports Eng. 10:101–110 – Windkanal cL(Sp), cD(Sp).
//  - Goff J. E., Carré M. J. (2009) Trajectory analysis of a soccer ball. Am. J. Phys. 77:1020 und
//    (2010) Soccer ball lift coefficients via trajectory analysis. Eur. J. Phys. 31:775 – Fit-Formeln
//    (Gl. 3, Gl. 4) und cL für große Sp.

// Reynoldszahl mit Balldurchmesser d = 2r
export function reynolds(v, P) { return v * 2 * P.ballR / P.nu; }

// cD ohne Spin: logistischer Abfall (Drag-Crisis) von cdSub auf cdSuper um reMid.
export function cdNoSpin(Re, P) {
  return P.cdSuper + (P.cdSub - P.cdSuper) / (1 + Math.exp((Re - P.reMid) / P.reWidth));
}

// cD mit Spin: überkritisch steigt cD mit dem Spin-Parameter (Goff & Carré 2010, Gl. 4), im
// Übergangsbereich anteilig eingeblendet.
export function cdOf(Re, Sp, P) {
  const c0 = cdNoSpin(Re, P);
  if (Sp <= 0) return c0;
  const s = (P.cdSub - c0) / (P.cdSub - P.cdSuper);          // 0 unterkritisch … 1 überkritisch
  const cs = P.cdSpinC * Math.pow(Sp, P.cdSpinD);
  return c0 + s * Math.max(0, cs - P.cdSuper);
}

// Magnus-Auftrieb |cL|(Sp): Mediane der fünf Windkanal-Reihen von Asai et al. 2007 (Re 3,3–4,6·10⁵,
// 32-Felder-Ball; abgelesen aus Goff & Carré 2010, Abb. 6), für Sp > 0,3 die Flugbahn-Werte von
// Goff & Carré 2009 (Sp 0,49 → 0,285; Sp 0,71 → 0,31). Darüber konstant (Abb. 7: Plateau bis Sp ≈ 1).
export const CL_TABLE = [
  [0.00, 0.000],
  [0.05, 0.050],
  [0.11, 0.220],
  [0.16, 0.240],
  [0.20, 0.290],
  [0.27, 0.290],
  [0.49, 0.285],
  [0.71, 0.310],
];
export function clOf(Sp) {
  const T = CL_TABLE;
  if (Sp <= 0) return 0;
  for (let i = 1; i < T.length; i++) {
    if (Sp <= T[i][0]) {
      const [s0, c0] = T[i - 1], [s1, c1] = T[i];
      return c0 + (c1 - c0) * (Sp - s0) / (s1 - s0);
    }
  }
  return T[T.length - 1][1];
}
// Umkehrung (für Tests): kleinstes Sp mit cL(Sp) = c auf dem ansteigenden Ast
export function spForCl(c) {
  const T = CL_TABLE;
  for (let i = 1; i < T.length; i++) {
    const [s0, c0] = T[i - 1], [s1, c1] = T[i];
    if (c >= c0 && c <= c1 && c1 > c0) return s0 + (s1 - s0) * (c - c0) / (c1 - c0);
  }
  return NaN;
}

// Flatterball: SD der Schwankungskraft je Achse [N] bei Tempo v und Spin-Parameter Sp.
export function knuckleSD(v, Sp, P) {
  if (v < 3) return 0;
  let k = 1;
  if (Sp > P.knuckleSp0) k = Math.max(0, 1 - (Sp - P.knuckleSp0) / (P.knuckleSp1 - P.knuckleSp0));
  return k * P.knuckleF30 * Math.pow(v / 30, P.knuckleExp);
}

// Vier Sinus-Anteile je Achse um die gemessene Spektrum-Spitze (Strouhal-Faktoren und Gewichte);
// Phasen und kleine Frequenz-Streuung pro Schuss aus dem Seed. Gewichte so, dass die SD der Summe 1 ist.
export const KNUCKLE_PARTS = [
  [0.45, 0.70], [0.75, 0.95], [1.00, 1.00], [1.40, 0.60],
];
const W2 = KNUCKLE_PARTS.reduce((s, p) => s + p[1] * p[1] / 2, 0);
export const KNUCKLE_NORM = 1 / Math.sqrt(W2);
