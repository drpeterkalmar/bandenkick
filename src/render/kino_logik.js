// Kino-Look für Bandenkick (n4-Technik, Audit #1): reine Daten und Rechnungen ohne three.js (in Node testbar,
// tests/node/kino.test.mjs). Der Anschluss mit three.js steht in kino.js, das Endbild selbst in kern/kinolook.js.
//
// Stufen = Grafikstufen des Spiels (0 niedrig, 1 mittel/Handy, 2 hoch/Desktop):
//   0 Einfach  – direktes Zeichnen wie bisher (kein Render-Target), nur Kontaktschatten.
//   1 Standard – Szene in Renderskala 0,7–0,85 der Bildschirmauflösung (Start 0,8) ohne MSAA, kantenbewusstes
//                Hochskalieren (FXAA-Art) + Nachschärfen, Bloom (Viertel-Auflösung, nur sehr Helles = Leuchtendes),
//                TV-Farbkorrektur, dezente Vignette, Dither. Keine Umgebungsverdeckung, kein Dunst.
//   2 Kino     – wie Standard, dazu MSAA 4 im Render-Target und Umgebungsverdeckung mit 0,4 m Radius (Figuren-Maßstab),
//                Renderskala 0,7–1 (Start 0,9).
// Dunst (aerial) ist aus: der Käfig ist klein, scene.fog (45–140 m) reicht. Bewegungsunschärfe, Hitzeflimmern und
// Sonnen-Blendung sind aus (kein Tempo, bewölkter Himmel). Tiefenschärfe nur im Replay (replayDof).
// TODO n4-Heavy: Bloom-Schwellen, Schärfe, Vignette und Farbkorrektur am Bild abstimmen (Startwerte, nie gesehen).

const STAGES_STD = { scale: true, aa: true, sharpen: true, ssao: false, bloom: true, flare: false, aerial: false, grade: true, vignette: true, blur: false, haze: false, dither: true, contact: true, dof: true };

export const BK_PRESETS = [
  { name: 'Einfach', pipeline: false, stages: { contact: true } },
  {
    name: 'Standard', pipeline: true, msaa: 0, scale: [0.85, 0.7, 0.85], stages: { ...STAGES_STD },
    sharpen: 0.7, bloom: { levels: 3, strength: 0.32, threshold: 0.93 }, bloomSky: 0, vignette: 0.12, blurHalf: true,
  },
  {
    name: 'Kino', pipeline: true, msaa: 4, scale: [0.9, 0.7, 1], stages: { ...STAGES_STD, aa: false, ssao: true },
    sharpen: 0.3, ao: { taps: 8, radius: 0.4, strength: 0.5 }, bloom: { levels: 4, strength: 0.36, threshold: 0.9 }, bloomSky: 0, vignette: 0.12, blurHalf: false,
  },
];

// Farbkorrektur „TV-Look“ (Katalog Teil 3b #12: Neutral-Tonemapping + leicht gesättigt + dezente Vignette). Keine
// Grün-Bremse: der Kunstrasen darf satt bleiben wie im Fernsehen. Abend: LED-Flutlicht leicht kühl, etwas mehr Kontrast.
export const BK_GRADES = {
  tv: { wb: [1, 1, 1], lift: [0.002, 0.003, 0.006], gamma: [1, 1, 1], gain: [1.01, 1.01, 1.0], shadow: [-0.006, 0, 0.01], high: [0.008, 0.004, -0.006], split: 1, sat: 1.07, vib: 0.12, contrast: 0.14, green: 0 },
  // n4-Abnahme: Kontrast 0,18 machte den Abend am Handy zu dunkel (Rasen/Figuren absaufen) → 0,08 und etwas mehr Gain
  tvAbend: { wb: [0.98, 0.995, 1.03], lift: [0.006, 0.008, 0.014], gamma: [0.97, 0.97, 0.96], gain: [1.05, 1.05, 1.07], shadow: [-0.006, 0, 0.018], high: [0.006, 0.006, 0], split: 1, sat: 1.05, vib: 0.1, contrast: 0.08, green: 0 },
  // n6 Fan-Edit: kräftiges Teal/Orange (Schatten türkis, Lichter orange), satt und hart wie ein Handy-Edit
  edit: { wb: [1.02, 1.0, 0.99], lift: [-0.02, -0.004, 0.012], gamma: [1.02, 1.0, 0.98], gain: [1.12, 1.04, 0.99], shadow: [-0.075, 0.025, 0.12], high: [0.11, 0.035, -0.08], split: 1.8, sat: 1.45, vib: 0.26, contrast: 0.5, green: 0.3 },
};

// Licht → Farbkorrektur und Bloom. Bloom soll nur Leuchtendes treffen (Flutlicht-Strahler, Fenster, Handschuhe der
// letzten Hand), nicht weiße Linien/Ball/Leibchen in der Sonne: tagsüber leuchtet nichts (Strahler aus) → Bloom ganz aus
// (n4-Messung: spart 5 Durchgänge je Bild, die CPU ist der Engpass); abends die Preset-Schwelle (Strahler und Leuchthöfe
// liegen nach dem Tonemapping nahe 1). bloom = Vorgabe für die Stufe (?kl=+bloom/-bloom gewinnt).
export function lichtLook(licht, level) {
  const P = BK_PRESETS[level] || BK_PRESETS[1], B = P.bloom || BK_PRESETS[1].bloom;
  if (licht === 'abend') return { grade: 'tvAbend', bloom: true, bloomThreshold: B.threshold, bloomStrength: B.strength };
  return { grade: 'tv', bloom: false, bloomThreshold: Math.max(B.threshold, 0.97), bloomStrength: +(B.strength * 0.7).toFixed(3) };
}

// URL-Regler: ?kino=0 = alter Weg (direkt zeichnen, Blob-Schatten), ?look=0|1|2 = Kino-Stufe erzwingen (unabhängig von
// der Grafikstufe), ?kl=-bloom,+flare = einzelne Stufen des Endbilds an/aus
export function kinoOptionen(qs) {
  const g = (k) => (qs && qs.get ? qs.get(k) : null);
  const look = g('look');
  return { on: g('kino') !== '0', look: look != null && /^[012]$/.test(look) ? +look : null, stages: g('kl') || '' };
}
export const kinoStufe = (level, o) => (o && o.look != null ? o.look : Math.max(0, Math.min(2, Math.round(+level || 0))));

// Tiefenschärfe in der Tor-Wiederholung: extremer Zoom (Fuß + Ball scharf, Rest weich) und Fan-Cam (Ball scharf,
// Käfig/Netz davor weich). TV-Kamera ohne. focus = Abstand Kamera → Blickpunkt (die Replay-Kameras zielen auf Fuß/Ball).
// near/far: Anteil des Fokus-Abstands, ab dem es ganz unscharf ist (vorn/hinten). TODO n4-Heavy: am Bild abstimmen.
export function replayDof(camKind, pos, look, ball = null) {
  if (!pos || !look) return null;
  const d = (q) => Math.hypot(pos[0] - q[0], pos[1] - q[1], pos[2] - q[2]);
  const dL = d(look), dB = ball ? d(ball) : dL;
  // n4-Abnahme: im Hochformat liegt der Ball deutlich vor dem Blickpunkt und war unscharf → Fokus auf den Ball (das
  // Motiv; der Fuß steht beim Kontakt direkt dahinter), ohne Ball wie bisher auf den Blickpunkt
  const focus = Math.min(dL, dB);
  if (!(focus > 0)) return null;
  if (camKind === 'zoom') return { focus, k: 0.85, r: 0.014, near: 0.5, far: 0.9 };
  if (camKind === 'fan') return { focus, k: 0.6, r: 0.012, near: 0.6, far: 1.2 };
  return null;
}

// Kontaktschatten (statt Blob-Textur unter Ball und Spielern): Größe und Deckkraft je Figur bzw. Ball.
// Figur: Ellipse 0,85 m in Blickrichtung × 0,6 m quer, wächst beim Hechtsprung, verblasst beim Springen (0 ab 0,4 m).
export function kontaktFigur(jumpY = 0, dive = 0) {
  const a = Math.max(0, Math.min(1, 1 - (jumpY || 0) * 2.5));
  return { laengs: 0.85 * (1 + 0.9 * dive), quer: 0.6 * (1 + 0.5 * dive), a };
}
// Ball: wie der alte Blob (Durchmesser 2,3 r, wächst und verblasst mit der Höhe), aber dunkler Kern am Boden
export function kontaktBall(y, r) {
  const h = Math.max(0, y - r);
  return { s: r * 2.3 * (1 + h * 0.35), a: Math.max(0.1, 1 - h * 0.25) };
}
