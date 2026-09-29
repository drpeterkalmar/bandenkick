// Oberfläche: Anzeige oben, Meldungen, Touch-Knöpfe, Start-/Menü-/Credits-Karten (alles Deutsch).
import { BUILD } from '../build.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function buildHud(root, canvas) {
  root.innerHTML = '';
  const top = h('div', 'hud-top');
  const score = h('div', 'score', '<span class="t0">Orange</span> 0 : 0 <span class="t1">Blau</span><small>1. Halbzeit · 4:00</small>');
  const kick = h('div', 'kickinfo');
  const menuBtn = h('button', 'iconbtn', '☰'); menuBtn.setAttribute('aria-label', 'Menü');
  top.append(score, kick, h('div', 'spacer'), menuBtn);
  const banner = h('div', 'banner');
  // Desktop: Aufladebalken mit Modus (Symbol + Name + Stärke)
  const charge = h('div', 'charge', '<i></i><span></span>');
  const chargeFill = charge.firstChild, chargeLbl = charge.lastChild;

  // Touch
  const touch = h('div'); touch.id = 'touch';
  const stickZone = h('div', 'stickzone hit');
  const stickBase = h('div', 'stickbase');
  const stickKnob = h('div', 'stickknob');
  stickBase.append(stickKnob);
  const bShot = h('button', 'tb', '<span class="ring"></span><span class="mini"><i class="dot"></i></span><span class="sym"></span><span class="kw">Fangen</span><span class="lbl">Schuss</span>'); bShot.id = 'bShot';
  const bPass = h('button', 'tb', '<span class="ring"></span><span class="sym"></span><span class="pl">Pass</span>'); bPass.id = 'bPass';
  const bSprint = h('button', 'tb', 'Sprint'); bSprint.id = 'bSprint';
  const bSwitch = h('button', 'tb', '⇄'); bSwitch.id = 'bSwitch'; bSwitch.setAttribute('aria-label', 'Spieler wechseln');
  const hold = h('div', 'holdbar', '<i></i><span>Abwurf in 6 s</span>'); hold.id = 'hold';
  touch.append(stickZone, stickBase, bShot, bPass, bSprint, bSwitch);

  const dbg = h('div'); dbg.id = 'dbg';

  // Karten
  const start = h('div', 'overlay');
  start.innerHTML = `<div class="card">
    <h1>Bandenkick</h1>
    <div class="sub">Kleinfeld im Käfig mit Bande, Netz und Dach – der Ball bleibt immer im Spiel.</div>
    <div class="cols">
      <p><b>3 gegen 3</b> mit Trainingsleibchen: du spielst <b style="color:#ff8a3d">Orange</b> gegen <b style="color:#5d9bff">Blau</b>.
      Der hinterste Spieler ist die „letzte Hand“ (leuchtende Handschuhe) und darf im eigenen Torraum die Hände nehmen.
      Ball fliegt nach Windkanal-Messungen, Kunstrasen nach FIFA-Prüfnorm.</p>
      <ul class="howto"></ul>
    </div>
    <div class="row"><button class="btn" data-act="play">Spielen</button><button class="btn sec" data-act="training">Training (allein)</button><button class="btn sec" data-act="credits">Credits</button></div>
    <div class="small" style="margin-top:10px">Version ${BUILD}</div>
  </div>`;
  const menu = h('div', 'overlay');
  menu.innerHTML = `<div class="card">
    <h2>Pause</h2>
    <div class="row">
      <button class="btn" data-act="resume">Weiter</button>
      <button class="btn sec" data-act="newgame">Neues Spiel</button>
      <button class="btn sec" data-act="sound">Ton: an</button>
    </div>
    <ul class="howto"></ul>
    <p class="small physics"></p>
    <div class="row"><button class="btn sec" data-act="credits">Credits</button><button class="btn sec" data-act="title">Startbildschirm</button></div>
  </div>`;
  const credits = h('div', 'overlay');
  credits.innerHTML = `<div class="card">
    <h2>Credits</h2>
    <ul>
      <li><b>Himmel/Licht:</b> „Suburban Football Field“ von Grzegorz Wronkowski, <a href="https://polyhaven.com/a/suburban_football_field" target="_blank" rel="noopener">Poly Haven</a>, CC0.</li>
      <li><b>Rasen-Texturen:</b> Grass004 und Grass005 von <a href="https://ambientcg.com" target="_blank" rel="noopener">ambientCG</a>, CC0 (Kunstrasen umgefärbt, Faser-Normalmap selbst erzeugt).</li>
      <li><b>3D-Bibliothek:</b> <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> r186, MIT.</li>
      <li><b>Menschen und Bewegungen:</b> <a href="https://github.com/microsoft/Microsoft-Rocketbox" target="_blank" rel="noopener">Microsoft Rocketbox</a>
        (Sports_Male_02/03/04, Sports_Female_02, Male_Adult_10, Female_Adult_12 und 16 Bewegungen), MIT-Lizenz, © 2020 Microsoft.
        Umgerechnet mit Blender; Leibchen, Handschuhe und Posen für Tormann/Schuss eigene Arbeit.</li>
      <li><b>Geräusche:</b> alle selbst synthetisiert (Web Audio, vorgerendert), keine fremden Aufnahmen.</li>
      <li><b>Physik-Quellen:</b> Hong &amp; Asai 2014 (Sci. Rep. 4:5068), Asai et al. 2007 (Sports Eng. 10), Goff &amp; Carré 2009/2010,
        FIFA Quality Programme for Football Turf – Handbook of Test Methods 2015, Test Manual 2024.</li>
    </ul>
    <p class="small">Ball, Käfig, Figur, Linien, Netze, Physik und Code: eigene Arbeit. Keine Vereins- oder Markenlogos.</p>
    <div class="row"><button class="btn" data-act="back">Zurück</button></div>
  </div>`;
  root.append(top, banner, charge, hold, touch, dbg, start, menu, credits);

  const howto = (touchUI) => touchUI
    ? `<li><b>Stick links:</b> laufen · ganz außen oder Knopf = Sprint · <b>⇄</b> Spieler wechseln (sonst automatisch)</li>
       <li><b>Pass:</b> tippen · <b>Schuss:</b> halten = aufladen, loslassen · Treffpunkt: Finger auf dem Knopf schieben</li>
       <li><b>Als letzte Hand im Torraum:</b> Schuss-Knopf = <b>Fangen</b> (halten), Pass-Knopf = <b>Hechten</b>; mit Ball: <b>Abwurf</b> / <b>Abschlag</b></li>`
    : `<li><b>WASD / Pfeile:</b> laufen, <b>Shift:</b> Sprint, <b>C / Tab:</b> Spieler wechseln</li>
       <li><b>Maus zielt</b> · <b>Linksklick / J:</b> Pass · <b>Leertaste / Rechtsklick halten:</b> Schuss (Q/E Effet, R Heber)</li>
       <li><b>Letzte Hand im Torraum:</b> Leertaste = Fangen, J = Hechten; mit Ball J = Abwurf, Leertaste = Abschlag</li>
       <li><b>Gamepad:</b> Stick laufen, A Pass/Hechten/Abwurf, X/RT Schuss/Fangen, Y Wechsel, LB/RB Sprint</li>`;
  const setHowto = (touchUI) => root.querySelectorAll('.howto').forEach((u) => { u.innerHTML = howto(touchUI); });

  let bannerT = 0, kickT = 0, lastScore = '', lastKeeper = '', lastCharge = null;
  const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  return {
    root, score, kick, menuBtn, banner, touch, stickZone, stickBase, stickKnob, bShot, bPass, bSprint, bSwitch, dbg, start, menu, credits, canvas, charge, chargeFill, hold,
    setHowto,
    show(which) { for (const o of [start, menu, credits]) o.classList.toggle('on', o === which); },
    setScore(sc) { score.innerHTML = `Tore ${sc[0] + sc[1]}<small>rechts ${sc[0]} · links ${sc[1]}</small>`; },
    // Spielstand mit Uhr: rest = Restzeit der Halbzeit (s), half 1|2, golden
    setMatch(sc, rest, half, golden, end) {
      const t = end ? 'Abpfiff' : golden ? 'Golden Goal' : `${half}. Halbzeit · ${clock(Math.max(0, rest))}`;
      const html = `<span class="t0">Orange</span> ${sc[0]} : ${sc[1]} <span class="t1">Blau</span><small>${t}</small>`;
      if (html !== lastScore) { score.innerHTML = html; lastScore = html; }
    },
    // Knöpfe als „letzte Hand“ im Torraum umbeschriften: mode '' | 'box' | 'hold'
    setKeeperMode(mode) {
      if (mode === lastKeeper) return;
      lastKeeper = mode;
      document.body.classList.toggle('kbox', mode === 'box');
      document.body.classList.toggle('khold', mode === 'hold');
      bShot.querySelector('.kw').textContent = mode === 'hold' ? 'Abschlag' : 'Fangen';
      bShot.querySelector('.lbl').textContent = mode === 'hold' ? 'Abschlag (halten)' : mode === 'box' ? 'Fangen (halten)' : 'Schuss';
      bPass.querySelector('.pl').textContent = mode === 'hold' ? 'Abwurf' : mode === 'box' ? 'Hechten' : 'Pass';
    },
    setHold(frac, secLeft) {
      hold.style.display = frac >= 0 ? 'block' : 'none';
      if (frac >= 0) { hold.firstChild.style.width = (frac * 100).toFixed(1) + '%'; hold.lastChild.textContent = `Ball in der Hand – Abwurf in ${Math.ceil(secLeft)} s`; }
    },
    flash(text, sub = '', dur = 1.8) { banner.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); banner.classList.add('on'); bannerT = dur; },
    kickInfo(k) {
      const kmh = Math.round(k.speed * 3.6);
      const parts = [`${k.kind === 'pass' ? 'Pass' : 'Schuss'} ${kmh} km/h`];
      if (k.kind === 'shot') {
        if (Math.abs(k.sideRps) >= 1) parts.push(`Effet ${Math.abs(k.sideRps).toFixed(1).replace('.', ',')} U/s`);
        else if (k.spinRps < 1) parts.push('Vollspann – flattert');
        if (k.elevDeg > 14) parts.push(`Heber ${Math.round(k.elevDeg)}°`);
      }
      kick.textContent = parts.join(' · ');
      kick.classList.add('on'); kickT = 3.5;
    },
    // Aufladering: st = {kind: 'pass'|'shot', p, sym, color, label, wait, air} oder null
    setCharge(st, touchUI) {
      const key = st ? `${st.kind}|${st.sym}|${st.color}|${st.wait ? 1 : 0}|${(st.p || 0).toFixed(2)}|${st.label}` : '';
      if (key === lastCharge) return;
      lastCharge = key;
      for (const b of [bShot, bPass]) {
        const on = st && (b === bShot ? st.kind === 'shot' : st.kind === 'pass');
        b.style.setProperty('--p', on && !st.wait ? st.p.toFixed(3) : '0');
        b.style.setProperty('--rc', on && st.color ? st.color : '#ffd84a');
        b.classList.toggle('charging', !!on && !st.wait);
        b.classList.toggle('armed', !!on && !!st.wait);
        b.querySelector('.sym').textContent = on && !st.wait ? st.sym || '' : '';
      }
      const show = !touchUI && st && !st.wait;
      charge.style.display = show ? 'block' : 'none';
      if (show) {
        chargeFill.style.width = (st.p * 100).toFixed(1) + '%'; chargeFill.style.background = st.color || '#ffd84a';
        chargeLbl.textContent = `${st.sym ? st.sym + ' ' : ''}${st.label || ''}${st.air ? '' : ` ${Math.round(st.p * 100)} %`}`;
      }
    },
    setContact(cx, cy) {
      const dot = bShot.querySelector('.dot');
      dot.style.left = (50 + cx * 38) + '%'; dot.style.top = (50 - cy * 38) + '%';
    },
    tick(dt) {
      if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.classList.remove('on'); }
      if (kickT > 0) { kickT -= dt; if (kickT <= 0) kick.classList.remove('on'); }
    },
  };
}
