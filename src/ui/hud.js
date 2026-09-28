// Oberfläche: Anzeige oben, Meldungen, Touch-Knöpfe, Start-/Menü-/Credits-Karten (alles Deutsch).
import { BUILD } from '../build.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function buildHud(root, canvas) {
  root.innerHTML = '';
  const top = h('div', 'hud-top');
  const score = h('div', 'score', 'Tore 0<small>rechts 0 · links 0</small>');
  const kick = h('div', 'kickinfo');
  const menuBtn = h('button', 'iconbtn', '☰'); menuBtn.setAttribute('aria-label', 'Menü');
  top.append(score, kick, h('div', 'spacer'), menuBtn);
  const banner = h('div', 'banner');
  const charge = h('div', 'charge');
  charge.style.cssText = 'position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);width:220px;height:12px;margin-left:-110px;border-radius:6px;background:rgba(0,0,0,.4);overflow:hidden;display:none';
  const chargeFill = h('div'); chargeFill.style.cssText = 'height:100%;width:0;background:linear-gradient(90deg,#9be15d,#ffd84a,#ff6a3d)';
  charge.append(chargeFill);

  // Touch
  const touch = h('div'); touch.id = 'touch';
  const stickZone = h('div', 'stickzone hit');
  const stickBase = h('div', 'stickbase');
  const stickKnob = h('div', 'stickknob');
  stickBase.append(stickKnob);
  const bShot = h('button', 'tb', '<span class="ring"></span><span class="mini"><i class="dot"></i></span><span class="lbl">Schuss (halten)</span>'); bShot.id = 'bShot';
  const bPass = h('button', 'tb', 'Pass'); bPass.id = 'bPass';
  const bSprint = h('button', 'tb', 'Sprint'); bSprint.id = 'bSprint';
  touch.append(stickZone, stickBase, bShot, bPass, bSprint);

  const dbg = h('div'); dbg.id = 'dbg';

  // Karten
  const start = h('div', 'overlay');
  start.innerHTML = `<div class="card">
    <h1>Bandenkick</h1>
    <div class="sub">Kleinfeld im Käfig mit Bande, Netz und Dach – der Ball bleibt immer im Spiel.</div>
    <div class="cols">
      <p><b>Nacht 1: Ball und Käfig.</b> Ball führen, gegen die Bande spielen, ins Netz schießen. Der Ball fliegt nach
      Windkanal-Messungen (Drag-Crisis, Magnus, Flatterball), der Kunstrasen springt und rollt nach FIFA-Prüfnorm.</p>
      <ul class="howto"></ul>
    </div>
    <div class="row"><button class="btn" data-act="play">Spielen</button><button class="btn sec" data-act="credits">Credits</button></div>
    <div class="small" style="margin-top:10px">Version ${BUILD}</div>
  </div>`;
  const menu = h('div', 'overlay');
  menu.innerHTML = `<div class="card">
    <h2>Pause</h2>
    <div class="row">
      <button class="btn" data-act="resume">Weiter</button>
      <button class="btn sec" data-act="fetch">Ball holen</button>
      <button class="btn sec" data-act="kickoff">Anstoß</button>
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
      <li><b>Physik-Quellen:</b> Hong &amp; Asai 2014 (Sci. Rep. 4:5068), Asai et al. 2007 (Sports Eng. 10), Goff &amp; Carré 2009/2010,
        FIFA Quality Programme for Football Turf – Handbook of Test Methods 2015, Test Manual 2024.</li>
    </ul>
    <p class="small">Ball, Käfig, Figur, Linien, Netze, Physik und Code: eigene Arbeit. Keine Vereins- oder Markenlogos.</p>
    <div class="row"><button class="btn" data-act="back">Zurück</button></div>
  </div>`;
  root.append(top, banner, charge, touch, dbg, start, menu, credits);

  const howto = (touchUI) => touchUI
    ? `<li><b>Stick links:</b> laufen · ganz außen oder Knopf = Sprint</li>
       <li><b>Pass:</b> tippen · <b>Schuss:</b> halten = aufladen, loslassen</li>
       <li><b>Treffpunkt:</b> Finger auf dem Schuss-Knopf schieben – seitlich Effet, unten Heber, Mitte Vollspann (flattert)</li>`
    : `<li><b>WASD / Pfeile:</b> laufen, <b>Shift:</b> Sprint</li>
       <li><b>Maus zielt</b> · <b>Linksklick / J:</b> Pass · <b>Leertaste / Rechtsklick halten:</b> Schuss aufladen</li>
       <li><b>Treffpunkt beim Schuss:</b> Q/E = Effet links/rechts, R = Heber, F = flach mit Vorwärtsdrall</li>
       <li><b>Gamepad:</b> Stick laufen, A Pass, X/RT Schuss, rechter Stick Treffpunkt, LB/RB Sprint</li>`;
  const setHowto = (touchUI) => root.querySelectorAll('.howto').forEach((u) => { u.innerHTML = howto(touchUI); });

  let bannerT = 0, kickT = 0;
  return {
    root, score, kick, menuBtn, banner, touch, stickZone, stickBase, stickKnob, bShot, bPass, bSprint, dbg, start, menu, credits, canvas, charge, chargeFill,
    setHowto,
    show(which) { for (const o of [start, menu, credits]) o.classList.toggle('on', o === which); },
    setScore(sc) { score.innerHTML = `Tore ${sc[0] + sc[1]}<small>rechts ${sc[0]} · links ${sc[1]}</small>`; },
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
    setCharge(p, touchUI) {
      bShot.style.setProperty('--p', p.toFixed(3));
      charge.style.display = !touchUI && p > 0 ? 'block' : 'none';
      chargeFill.style.width = (p * 100).toFixed(1) + '%';
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
