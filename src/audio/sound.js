// Ton: alles selbst synthetisiert und einmal per OfflineAudioContext vorgerendert (kein Ruckeln durch Live-Synthese,
// keine fremden Aufnahmen). Im Spiel werden nur fertige Puffer abgespielt: Schuss, Pass, Ballkontakt, Aufsetzer,
// Bandenknall (hohles Kunststoffpaneel), Netz, Pfosten (Stahlrohr), Fangen, Körper, Pfiff, Rufe (Formant-Stimmen
// „Hey!“, „Hier!“, „Ja!“, „Tor!“) und Umgebung (Vögel, entfernter Verkehr) als nahtlose Schleifen.
// Handy: AudioContext wird erst mit einer echten Geste freigeschaltet (pointerup/touchend/click/keydown).
const SR = 44100;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// kleiner deterministischer Zufall für die Synthese (gleiche Klänge bei jedem Start)
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

async function render(sec, build, channels = 1) {
  const oc = new OfflineAudioContext(channels, Math.ceil(sec * SR), SR);
  build(oc, oc.destination);
  return oc.startRendering();
}
function noiseBuf(oc, sec, seed = 1, color = 'white') {
  const b = oc.createBuffer(1, Math.ceil(sec * SR), SR), d = b.getChannelData(0), r = rng(seed);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = r() * 2 - 1;
    if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
function env(g, t0, a, peak, dec, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(end, t0 + a + dec);
}
function noise(oc, out, t, dur, seed, { type = 'bandpass', f = 1000, q = 1, a = 0.002, peak = 0.5, dec = 0.05, color = 'white' } = {}) {
  const s = oc.createBufferSource(); s.buffer = noiseBuf(oc, dur + a + 0.05, seed, color);
  const fl = oc.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = oc.createGain(); env(g, t, a, peak, dec);
  s.connect(fl).connect(g).connect(out); s.start(t); s.stop(t + a + dec + 0.05);
}
function tone(oc, out, t, { f = 440, f2 = null, type = 'sine', a = 0.002, peak = 0.5, dec = 0.2, glide = 0.05 } = {}) {
  const o = oc.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + glide);
  const g = oc.createGain(); env(g, t, a, peak, dec);
  o.connect(g).connect(out); o.start(t); o.stop(t + a + dec + 0.05);
}

// Formant-Stimme: Sägezahn (Stimmlippen) durch drei Formant-Filter, Tonhöhen-Verlauf wie ein Ruf
function voice(oc, out, t, { vowel = 'a', f0 = 180, dur = 0.35, peak = 0.5, h = 0, cons = '' } = {}) {
  const F = { a: [760, 1250, 2600], e: [520, 1900, 2550], i: [320, 2350, 3000], o: [520, 900, 2450], ja: [300, 2200, 2900] }[vowel];
  const o = oc.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 0.92, t); o.frequency.linearRampToValueAtTime(f0 * 1.12, t + dur * 0.35); o.frequency.linearRampToValueAtTime(f0 * 0.8, t + dur);
  const vib = oc.createOscillator(); vib.frequency.value = 5.5; const vg = oc.createGain(); vg.gain.value = f0 * 0.02; vib.connect(vg).connect(o.frequency);
  const src = oc.createGain(); src.gain.value = 1;
  o.connect(src);
  const g = oc.createGain(); env(g, t + (h ? 0.06 : 0) + (cons === 't' ? 0.03 : 0), 0.03, peak, dur);
  F.forEach((f, i) => {
    const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = [6, 9, 10][i];
    const fg = oc.createGain(); fg.gain.value = [1, 0.55, 0.3][i];
    src.connect(bp).connect(fg).connect(g);
  });
  // Vokalwechsel „ja“ → a
  if (vowel === 'ja') { /* Anfang wie i, Filter bleiben; reicht für einen kurzen Ruf */ }
  g.connect(out);
  o.start(t); o.stop(t + dur + 0.15); vib.start(t); vib.stop(t + dur + 0.15);
  if (h) noise(oc, out, t, 0.08, 77, { type: 'bandpass', f: 1600, q: 0.7, a: 0.01, peak: 0.12 * h, dec: 0.07 }); // Hauch „H“
  if (cons === 't') noise(oc, out, t, 0.03, 78, { type: 'highpass', f: 3000, q: 0.7, a: 0.001, peak: 0.25, dec: 0.02 });
}

const DEFS = {
  kick: [0.35, (oc, o) => { // Vollspann: dumpfer Schlag + Leder-Knall + Klick
    tone(oc, o, 0, { f: 140, f2: 55, peak: 0.9, dec: 0.09, glide: 0.06 });
    noise(oc, o, 0, 0.05, 3, { type: 'bandpass', f: 1400, q: 1.1, peak: 0.55, dec: 0.035 });
    noise(oc, o, 0, 0.02, 4, { type: 'highpass', f: 3500, q: 0.7, peak: 0.25, dec: 0.008 });
  }],
  pass: [0.25, (oc, o) => {
    tone(oc, o, 0, { f: 170, f2: 80, peak: 0.55, dec: 0.06, glide: 0.04 });
    noise(oc, o, 0, 0.04, 5, { type: 'bandpass', f: 1200, q: 1.2, peak: 0.3, dec: 0.025 });
  }],
  touch: [0.15, (oc, o) => {
    tone(oc, o, 0, { f: 210, f2: 110, peak: 0.28, dec: 0.04, glide: 0.03 });
    noise(oc, o, 0, 0.03, 6, { type: 'bandpass', f: 900, q: 1, peak: 0.12, dec: 0.02 });
  }],
  bounce: [0.2, (oc, o) => {
    tone(oc, o, 0, { f: 95, f2: 60, peak: 0.45, dec: 0.07, glide: 0.05 });
    noise(oc, o, 0, 0.05, 7, { type: 'lowpass', f: 700, q: 0.7, peak: 0.25, dec: 0.04 });
    noise(oc, o, 0.005, 0.08, 8, { type: 'bandpass', f: 3500, q: 0.6, peak: 0.05, dec: 0.06 }); // Granulat
  }],
  board: [0.7, (oc, o) => { // hohles Kunststoffpaneel: Resonanzen + Rahmenklappern
    noise(oc, o, 0, 0.02, 9, { type: 'lowpass', f: 2500, peak: 0.6, dec: 0.015 });
    [[165, 0.5, 0.28], [410, 0.35, 0.18], [930, 0.18, 0.1], [1850, 0.08, 0.06]].forEach(([f, p, d], i) => {
      const s = oc.createBufferSource(); s.buffer = noiseBuf(oc, 0.02, 10 + i);
      const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 18;
      const g = oc.createGain(); env(g, 0, 0.001, p * 14, d);
      s.connect(bp).connect(g).connect(o); s.start(0);
    });
    tone(oc, o, 0, { f: 90, f2: 70, peak: 0.5, dec: 0.12 });
    noise(oc, o, 0.04, 0.2, 14, { type: 'bandpass', f: 2600, q: 3, a: 0.004, peak: 0.07, dec: 0.18 }); // Klappern
  }],
  net: [0.8, (oc, o) => { // Netz: Rauschen mit weichem Einsatz + dumpfes „Wumm“ + Kettenklirren
    noise(oc, o, 0, 0.6, 15, { type: 'bandpass', f: 2600, q: 0.8, a: 0.03, peak: 0.28, dec: 0.45 });
    tone(oc, o, 0, { f: 70, f2: 45, a: 0.015, peak: 0.35, dec: 0.2, glide: 0.15 });
    for (let k = 0; k < 6; k++) noise(oc, o, 0.05 + k * 0.05, 0.03, 16 + k, { type: 'bandpass', f: 4200 + k * 300, q: 8, peak: 0.08, dec: 0.03 });
  }],
  post: [1.6, (oc, o) => { // Stahlrohr Ø 80 mm: unharmonische Teiltöne, lange Ausklingzeit
    noise(oc, o, 0, 0.02, 22, { type: 'highpass', f: 2000, peak: 0.5, dec: 0.01 });
    [[523, 0.35, 1.2], [1291, 0.22, 0.9], [2170, 0.14, 0.6], [3310, 0.08, 0.4], [4480, 0.05, 0.25]].forEach(([f, p, d]) => tone(oc, o, 0, { f, peak: p, dec: d }));
    tone(oc, o, 0, { f: 110, f2: 80, peak: 0.35, dec: 0.1 });
  }],
  catch: [0.25, (oc, o) => { // Handschuhe fassen den Ball
    noise(oc, o, 0, 0.06, 30, { type: 'lowpass', f: 1400, q: 0.8, peak: 0.55, dec: 0.05 });
    tone(oc, o, 0, { f: 120, f2: 70, peak: 0.4, dec: 0.06 });
  }],
  body: [0.2, (oc, o) => {
    tone(oc, o, 0, { f: 110, f2: 65, peak: 0.45, dec: 0.07 });
    noise(oc, o, 0, 0.04, 31, { type: 'lowpass', f: 900, peak: 0.25, dec: 0.03 });
  }],
  dive: [0.45, (oc, o) => { // Aufprall am Kunstrasen
    tone(oc, o, 0, { f: 80, f2: 45, peak: 0.55, dec: 0.12 });
    noise(oc, o, 0, 0.3, 32, { type: 'bandpass', f: 1800, q: 0.6, a: 0.01, peak: 0.18, dec: 0.25 });
  }],
  whoosh: [0.35, (oc, o) => noise(oc, o, 0, 0.3, 33, { type: 'bandpass', f: 900, q: 1.5, a: 0.08, peak: 0.25, dec: 0.18 })],
  whistle: [0.55, (oc, o) => { // Trillerpfeife ~3 kHz mit Kugel-Triller
    const osc = oc.createOscillator(); osc.frequency.value = 3050;
    const am = oc.createOscillator(); am.frequency.value = 28; const amg = oc.createGain(); amg.gain.value = 0.35;
    const g = oc.createGain(); g.gain.value = 0; g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.35, 0.02); g.gain.setValueAtTime(0.35, 0.38); g.gain.linearRampToValueAtTime(0, 0.45);
    const trem = oc.createGain(); trem.gain.value = 0.65; am.connect(amg).connect(trem.gain);
    osc.connect(trem).connect(g).connect(o); osc.start(0); osc.stop(0.5); am.start(0); am.stop(0.5);
    noise(oc, o, 0, 0.45, 34, { type: 'bandpass', f: 3000, q: 4, a: 0.02, peak: 0.05, dec: 0.4 });
  }],
  hey: [0.5, (oc, o) => voice(oc, o, 0, { vowel: 'e', f0: 190, dur: 0.28, peak: 0.45, h: 1 })],
  hier: [0.55, (oc, o) => voice(oc, o, 0, { vowel: 'i', f0: 210, dur: 0.32, peak: 0.4, h: 1 })],
  ja: [0.5, (oc, o) => voice(oc, o, 0, { vowel: 'a', f0: 175, dur: 0.3, peak: 0.45 })],
  tor: [0.9, (oc, o) => { // mehrere Stimmen „Tooor!“
    [[165, 0], [205, 0.03], [140, 0.05], [230, 0.02]].forEach(([f0, dt], i) => voice(oc, o, dt, { vowel: 'o', f0, dur: 0.7, peak: 0.28, cons: i === 0 ? 't' : '' }));
  }],
  oh: [0.8, (oc, o) => { [[150, 0], [185, 0.04], [125, 0.06]].forEach(([f0, dt]) => voice(oc, o, dt, { vowel: 'o', f0: f0 * 0.9, dur: 0.6, peak: 0.2 })); }],
};

// Umgebung als nahtlose Schleifen (Enden überblendet)
async function ambience(kind) {
  const sec = 16;
  const buf = await render(sec + 1, (oc, out) => {
    const r = rng(kind === 'birds' ? 101 : 202);
    if (kind === 'traffic') {
      const s = oc.createBufferSource(); s.buffer = noiseBuf(oc, sec + 1, 5, 'brown');
      const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      const g = oc.createGain(); g.gain.value = 0.5;
      const lfo = oc.createOscillator(); lfo.frequency.value = 0.07; const lg = oc.createGain(); lg.gain.value = 0.18; lfo.connect(lg).connect(g.gain);
      s.connect(lp).connect(g).connect(out); s.start(0); lfo.start(0);
      for (let k = 0; k < 3; k++) { // vorbeifahrende Autos in der Ferne
        const t0 = 1 + k * 5 + r() * 2;
        const c = oc.createBufferSource(); c.buffer = noiseBuf(oc, 4, 40 + k, 'brown');
        const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260 + r() * 120; bp.Q.value = 0.8;
        const cg = oc.createGain(); cg.gain.setValueAtTime(0.0001, t0); cg.gain.exponentialRampToValueAtTime(0.5, t0 + 1.6); cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6);
        c.connect(bp).connect(cg).connect(out); c.start(t0); c.stop(t0 + 3.8);
      }
    } else {
      for (let k = 0; k < 34; k++) { // Vogelzwitschern: kurze Frequenz-Sweeps in Gruppen
        const t0 = r() * sec, base = 2600 + r() * 2600, n = 2 + Math.floor(r() * 5);
        for (let j = 0; j < n; j++) {
          const t = t0 + j * (0.07 + r() * 0.05);
          const o = oc.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(base * (0.9 + r() * 0.3), t); o.frequency.exponentialRampToValueAtTime(base * (1.2 + r() * 0.5), t + 0.05);
          const g = oc.createGain(); env(g, t, 0.005, 0.05 + r() * 0.06, 0.06);
          o.connect(g).connect(out); o.start(t); o.stop(t + 0.1);
        }
      }
    }
  });
  // Ende weich in den Anfang überblenden (1 s)
  const d = buf.getChannelData(0), n = Math.floor(SR * 1), L = Math.floor(sec * SR);
  const out = new AudioBuffer({ length: L, numberOfChannels: 1, sampleRate: SR });
  const o = out.getChannelData(0);
  for (let i = 0; i < L; i++) o[i] = d[i];
  for (let i = 0; i < n; i++) { const w = i / n; o[i] = d[i] * w + d[L + i] * (1 - w); }
  return out;
}

export class Sound {
  constructor(on = true) {
    this.on = on; this.ctx = null; this.buf = {}; this.voices = []; this.amb = []; this.lastT = {};
    this.shoutT = 0; this.rendered = false;
    const unlock = () => this.unlock();
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, { capture: true, passive: true });
  }

  async init() {
    if (typeof OfflineAudioContext === 'undefined') return;
    // max. 3 Renderings gleichzeitig
    const names = Object.keys(DEFS);
    const VOICE = new Set(['hey', 'hier', 'ja', 'tor', 'oh']);
    const work = async (name) => {
      const [sec, fn] = DEFS[name];
      const b = await render(sec, fn);
      // auf einheitliche Spitze normalisieren (Effekte 0,85, Stimmen 0,6) → Lautstärke steuert nur noch das Ereignis
      const d = b.getChannelData(0); let pk = 0;
      for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
      const k = pk > 1e-6 ? (VOICE.has(name) ? 0.6 : 0.85) / pk : 1;
      for (let i = 0; i < d.length; i++) d[i] *= k;
      this.buf[name] = b;
    };
    for (let i = 0; i < names.length; i += 3) await Promise.all(names.slice(i, i + 3).map(work));
    [this.buf.birds, this.buf.traffic] = await Promise.all([ambience('birds'), ambience('traffic')]);
    this.rendered = true;
    if (this.ctx && this.on) this.startAmbience();
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* nur iPhone */ }
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
        const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 2.5; comp.attack.value = 0.005; comp.release.value = 0.2;
        const lim = c.createDynamicsCompressor(); lim.threshold.value = -2; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
        this.master.connect(comp).connect(lim).connect(c.destination);
        this.fx = c.createGain(); this.fx.connect(this.master);
        this.ambBus = c.createGain(); this.ambBus.gain.value = 0.55; this.ambBus.connect(this.master);
        // stiller Puffer in der Geste (Handy-Freischaltung)
        const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
        if (this.rendered && this.on) this.startAmbience();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* ohne Ton weiter */ }
  }

  toggle() {
    this.on = !this.on;
    if (this.master) this.master.gain.setTargetAtTime(this.on ? 0.8 : 0, this.ctx.currentTime, 0.05);
    if (this.on) { this.unlock(); if (!this.amb.length && this.rendered) this.startAmbience(); }
  }

  startAmbience() {
    if (!this.ctx || this.amb.length) return;
    for (const [name, gain] of [['birds', 0.5], ['traffic', 0.35]]) {
      const s = this.ctx.createBufferSource(); s.buffer = this.buf[name]; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = gain;
      s.connect(g).connect(this.ambBus); s.start(this.ctx.currentTime + 0.05);
      this.amb.push(s);
    }
  }

  // Einen Puffer abspielen: gain 0…1, pan −1…1, rate (Tonhöhe), minGap (s) gegen Maschinengewehr-Effekte
  play(name, gain = 1, pan = 0, rate = 1, minGap = 0.03) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running' || !this.buf[name]) return;
    const c = this.ctx, now = c.currentTime;
    if (now - (this.lastT[name] || -9) < minGap) return;
    this.lastT[name] = now;
    // Stimmen begrenzen (12): älteste leiseste zuerst weg
    this.voices = this.voices.filter((v) => v.end > now);
    if (this.voices.length >= 12) { const v = this.voices.shift(); try { v.src.stop(); } catch (_) { /* schon aus */ } }
    const s = c.createBufferSource(); s.buffer = this.buf[name]; s.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = clamp(gain, 0, 1.2);
    let node = s.connect(g);
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node = node.connect(p); }
    node.connect(this.fx);
    s.start(now);
    s.onended = () => { s.disconnect(); g.disconnect(); };
    this.voices.push({ src: s, end: now + s.buffer.duration / rate });
  }

  // Ereignisse der Spielwelt → Klänge (Lautstärke nach Tempo, Stereo nach Lage im Käfig)
  event(e, game) {
    if (!this.on || !this.ctx) return;
    const hx = game.cage.hx;
    const pan = e.x != null ? clamp(e.x / hx, -1, 1) * 0.6 : 0;
    const sp = e.speed || 0;
    switch (e.type) {
      case 'kick':
        if (e.kind === 'pass') this.play('pass', 0.35 + sp / 30, pan, 0.95 + Math.random() * 0.1);
        else this.play('kick', 0.35 + sp / 30, pan, 0.92 + Math.random() * 0.12);
        if (e.kind === 'pass' && e.to >= 0 && e.to !== e.player && Math.random() < 0.5) this.shout(Math.random() < 0.5 ? 'hier' : 'ja', game, e.to, 0.12);
        break;
      case 'touch': this.play('touch', 0.28, pan, 0.9 + Math.random() * 0.2, 0.06); break;
      case 'ground': if (sp > 2) this.play('bounce', clamp(sp / 14, 0.1, 0.8), pan, 0.9 + Math.random() * 0.2, 0.05); break;
      case 'board': if (sp > 1.5) this.play('board', clamp(sp / 16, 0.12, 1.1), pan, 0.9 + Math.random() * 0.15, 0.05); break;
      case 'post': this.play('post', clamp(sp / 14, 0.2, 1.1), pan, 0.97 + Math.random() * 0.06, 0.08); break;
      case 'net': this.play('net', clamp(sp / 18, 0.15, 1), pan, 0.9 + Math.random() * 0.2, 0.15); break;
      case 'catch': this.play('catch', 0.7, pan); break;
      case 'parry': this.play('body', 0.8, pan); break;
      case 'body': this.play('body', clamp(sp / 12, 0.15, 0.7), pan, 1, 0.08); break;
      case 'dive': setTimeout(() => this.play('dive', 0.55, pan), 330); break;
      case 'throw': this.play('whoosh', 0.5, pan); break;
      case 'punt': this.play('kick', 0.8, pan); break;
      case 'goal': this.play('net', 1, pan); setTimeout(() => this.play('tor', 0.8, pan * 0.5), 180); break;
      case 'halftime': this.play('whistle', 0.55); setTimeout(() => this.play('whistle', 0.55), 520); break;
      case 'end': this.play('whistle', 0.6); setTimeout(() => this.play('whistle', 0.6), 520); setTimeout(() => this.play('whistle', 0.6, 0, 0.97, 0), 1100); break;
      case 'restart': if (e.mode === 'kickoff') this.play('whistle', 0.5); break;
      case 'bump': if (sp > 4) this.play('body', 0.25, pan, 0.8, 0.2); break;
      default:
    }
  }

  // Rufe: ein Spieler ruft (Stereo nach seiner Lage), höchstens alle ~1,5 s
  shout(name, game, id, delay = 0) {
    const now = performance.now() / 1000;
    if (now - this.shoutT < 1.5) return;
    this.shoutT = now;
    const pl = game.players[id]; if (!pl) return;
    const pan = clamp(pl.x / game.cage.hx, -1, 1) * 0.6;
    const rate = 0.85 + (id % 3) * 0.12 + (/Female/.test(String(pl.avatarName || '')) ? 0.3 : 0);
    setTimeout(() => this.play(name, 0.35, pan, rate, 0.3), delay * 1000);
  }

  tick(dt, game, playing) {
    if (this.ambBus && this.ctx) this.ambBus.gain.setTargetAtTime(this.on ? (playing ? 0.55 : 0.4) : 0, this.ctx.currentTime, 0.3);
    // gelegentlicher Ruf der freien Anspielstation
    if (playing && game.bots && Math.random() < dt * 0.12) {
      const sup = game.players.find((p) => game.bots.brain[p.id].role === 'support' && p.id !== game.human);
      if (sup) this.shout('hey', game, sup.id);
    }
  }
}
