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
  const hold = h('div', 'holdbar', '<i></i><span>Abwurf in 3 s</span>'); hold.id = 'hold';
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
    <div class="row"><button class="btn" data-act="play">Spielen</button><button class="btn sec" data-act="trainmenu">Training</button><button class="btn sec" data-act="help">Steuerung</button><button class="btn sec" data-act="credits">Credits</button></div>
    <div class="small" style="margin-top:10px">Version ${BUILD}</div>
  </div>`;
  const menu = h('div', 'overlay');
  menu.innerHTML = `<div class="card">
    <h2>Pause</h2>
    <div class="row">
      <button class="btn" data-act="resume">Weiter</button>
      <button class="btn sec" data-act="newgame">Neu starten</button>
      <button class="btn sec" data-act="help">Steuerung</button>
    </div>
    <div class="row"><button class="btn sec" data-act="slowmo">Zeitlupe: an</button><button class="btn sec" data-act="replay">Tor-Wiederholung: Fan-Edit</button><button class="btn sec" data-act="licht">Licht: Tag</button></div>
    <div class="row"><button class="btn sec" data-act="blitze">Blitze reduzieren: aus</button><button class="btn sec" data-act="cliphoch">Clip im Hochformat: aus</button></div>
    <div class="row"><button class="btn sec" data-act="trainmenu">Training</button></div>
    <p class="small lastshot"></p>
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
      <li><b>Physik-Quellen:</b> Hong &amp; Asai 2014 (Sci. Rep. 4:5068), Asai et al. 2007 (Sports Eng. 10), Goff &amp; Carré 2009/2010,
        FIFA Quality Programme for Football Turf – Handbook of Test Methods 2015, Test Manual 2024.</li>
    </ul>
    <p class="small">Ball, Käfig, Figur, Linien, Netze, Physik und Code: eigene Arbeit. Keine Vereins- oder Markenlogos.</p>
    <p class="small deko-only">Umgebung, Bäume, Konfetti, Flutlicht und Abendhimmel: eigene Arbeit, zur Laufzeit gemalt. Die Zuschauer werden beim Start aus den Rocketbox-Menschen gerendert.</p>
    <div class="row"><button class="btn" data-act="back">Zurück</button></div>
  </div>`;
  // Training: Challenges je Gruppe, Hinweis vor dem Start, Ergebnis mit Sternen, Steuerungskarte
  const train = h('div', 'overlay');
  train.innerHTML = `<div class="card wide">
    <h2>Training</h2>
    <div class="cols2 trcols"><div><h3>Schütze</h3><div class="chlist" data-group="schuetze"></div></div>
    <div><h3>Torwart</h3><div class="chlist" data-group="torwart"></div></div></div>
    <div class="row"><button class="btn sec" data-act="free">Freies Training</button><button class="btn sec" data-act="title">Zurück</button></div>
  </div>`;
  const hint = h('div', 'overlay');
  hint.innerHTML = `<div class="card"><h2 class="ht"></h2><p class="hx"></p><p class="small hb"></p>
    <div class="row"><button class="btn" data-act="chgo">Los</button><button class="btn sec" data-act="trainmenu">Zurück</button></div></div>`;
  const result = h('div', 'overlay');
  result.innerHTML = `<div class="card"><h2 class="rt"></h2><div class="stars big"></div><p class="rs"></p><p class="small rb"></p>
    <div class="row"><button class="btn" data-act="chagain">Nochmal</button><button class="btn sec" data-act="trainmenu">Andere Challenge</button><button class="btn sec" data-act="title">Menü</button></div></div>`;
  const help = h('div', 'overlay');
  help.innerHTML = `<div class="card wide"><h2>Steuerung</h2>
    <table class="gest"><tr><th></th><th>Pass</th><th>Schuss</th></tr>
    <tr><td><b>tippen</b></td><td>flach in den Laufweg →</td><td>Vollspann ⚡ (nah platziert, weit hart)</td></tr>
    <tr><td><b>doppeltippen</b></td><td>hoch (Flanke, Chip) ⌒</td><td>angeschnitten ↪ Innen- / ↩ Außenrist</td></tr>
    <tr><td><b>Ball in der Luft</b></td><td></td><td>Schuss tippen: Kopfball, Volley, Seitfall-, Fallrückzieher – den besten Moment wählt das Spiel</td></tr>
    <tr><td><b>Gegner hat den Ball</b> (bis 2,5 m)</td><td>Grätsche, erobert → Pass</td><td>Grätsche, erobert → Schuss aufs Tor bzw. weg</td></tr></table>
    <p class="small">Kein Aufladen: die Stärke wählt das Spiel. Du darfst schon tippen, bevor der Ball am Fuß ist.</p>
    <ul class="howto"></ul>
    <p class="small">Der Pass geht zum Mitspieler, auf den der Stick zeigt (±35°), in seinen Laufweg – zeigst du auf die Bande, geht er über die Bande.
    Kein Rückpass: zum eigenen Torwart wird nicht gepasst, und einen Ball vom Mitspieler darf er nicht in die Hand nehmen.
    Der Schuss geht immer aufs Tor: Stick seitlich = flache Ecke, schräg nach vorn = hohe Ecke. Schlechte Lage (spitzer Winkel, Rücken zum Tor, Gegner dran) = langsamer und zentraler.</p>
    <div class="row stick"><button class="btn" data-act="helpok">Verstanden</button></div></div>`;
  // Tor-Wiederholung (Nacht 2d): Kinobalken, Vignette, Blitz, Einblendungen – reines CSS (kein Nachbearbeitungs-Pass)
  const replay = h('div', 'replay', '<i class="lb t"></i><i class="lb b"></i><i class="vig"></i><i class="flash"></i>' +
    '<div class="rp-label"><b>WIEDERHOLUNG</b><span></span></div><div class="fancam"><i></i>FAN-CAM</div><div class="rp-skip">Tippen = weiter</div>');
  replay.id = 'replay';
  // n6 Fan-Edit (TikTok-Stil): Rahmen (Hochformat-Ausschnitt auf Querformat möglich), Bildunterschrift, Einschlag-Texte,
  // km/h-Zähler, Stempel, Emojis, Speed-Lines, Schlag-Puls, Kontur um den Schützen im Standbild, Fortschritt, „Clip nochmal“
  const fe = h('div', 'fe', '<i class="fe-side l"></i><i class="fe-side r"></i><div class="fe-frame">' +
    '<i class="fe-lines"></i><i class="fe-puls"></i><i class="fe-flash"></i><i class="fe-spot"></i><div class="fe-ring"><span></span></div>' +
    '<div class="fe-pov"></div><div class="fe-big"></div><div class="fe-kmh"></div><div class="fe-stamp"></div><div class="fe-name"></div>' +
    '<div class="fe-gag"></div><div class="fe-emoji"></div><div class="fe-tag">@bandenkick<small>#golazo #hallenkick #fyp</small></div>' +
    '<div class="fe-prog"><i></i></div><i class="fe-fade"></i><button class="fe-again" data-act="clipnochmal">↻ Clip nochmal</button></div>');
  replay.append(fe);
  const clipAgain = h('button', 'clipagain', '↻ Clip nochmal'); clipAgain.dataset.act = 'clipnochmal'; // kurz nach dem Clip im Spiel
  const tds = h('button', 'tds', '🏆 Tor des Spiels'); tds.dataset.act = 'tordesspiels'; // nach dem Abpfiff
  // n6 Action-Momente live: Vignette, Speed-Lines, Blitz (ohne Kino-Look) – Steuerung bleibt sichtbar und bedienbar
  const amEl = h('div', 'am', '<i class="am-vig"></i><i class="am-lines"></i><i class="am-flash"></i>');
  const AM = { vig: amEl.children[0], lines: amEl.children[1], flash: amEl.children[2], st: {} };
  // Emojis und Speed-Lines beim Laden einmal in Bilder malen: Farb-Emojis in Clip-Größe zu rastern kostete im ersten Clip
  // bis 160 ms (Handy-Profil), der Verlaufs-Strahlenkranz mit Maske ähnlich viel
  const EMO = {};
  const emojiBild = (ch) => EMO[ch] || (EMO[ch] = (() => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 144; const g = c.getContext('2d');
      g.font = '112px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ch, 72, 80); return c.toDataURL('image/png');
    } catch (_) { return ''; }
  })());
  for (const ch of ['🔥', '⚡', '💥', '😱', '🐐', '🥶', '💣', '👑', '🚀', '🤯', '⚽', '💯', '😳', '✨']) emojiBild(ch);
  try {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    const gr = g.createRadialGradient(256, 256, 60, 256, 256, 256); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.strokeStyle = gr;
    for (let i = 0; i < 56; i++) { const a = i / 56 * Math.PI * 2 + (i % 3) * 0.03; g.lineWidth = i % 2 ? 3.5 : 7; g.beginPath(); g.moveTo(256 + Math.cos(a) * 90, 256 + Math.sin(a) * 90); g.lineTo(256 + Math.cos(a) * 362, 256 + Math.sin(a) * 362); g.stroke(); }
    const u = `url(${c.toDataURL('image/png')})`; fe.querySelector('.fe-lines').style.backgroundImage = u; amEl.children[1].style.backgroundImage = u;
  } catch (_) { /* ohne Speed-Lines */ }
  // Malstile des Clips (Verlauf-Spotlight, leuchtende Kontur, Text mit Kontur) einmal unsichtbar malen: der Rasterer übersetzt
  // dafür beim ersten Mal eigene Shader (im ersten Clip ≈ 150 ms)
  const warm = h('div', 'fe-warm', '<i class="w1"></i><i class="w2"></i><b>GOLAZO! 10/10</b>');
  root.append(amEl, top, banner, charge, hold, touch, dbg, start, menu, credits, train, hint, result, help, replay, clipAgain, tds, warm);

  const howto = (touchUI) => touchUI
    ? `<li><b>Stick links:</b> laufen · ganz außen oder Knopf = Sprint · <b>⇄</b> Spieler wechseln (sonst automatisch)</li>
       <li><b>Pass/Schuss:</b> tippen = flach/Vollspann, <b>doppeltippen</b> = hoch/angeschnitten (Ring zeigt den Modus)</li>
       <li><b>Torwart</b> (letzte Hand im Torraum): fängt und hechtet von selbst. Mit Ball: Pass = <b>Abwurf</b>, Schuss = <b>Abschlag</b> – sonst wirft er nach 1 s selbst ab</li>`
    : `<li><b>WASD / Pfeile:</b> laufen, <b>Shift:</b> Sprint, <b>C / Tab:</b> Spieler wechseln</li>
       <li><b>J / Enter / Linksklick:</b> Pass · <b>Leertaste / K / Rechtsklick:</b> Schuss – tippen = flach/Vollspann, <b>doppeltippen</b> = hoch/angeschnitten; Maus zielt</li>
       <li><b>Torwart</b> (letzte Hand im Torraum): fängt und hechtet von selbst; mit Ball J = Abwurf, Leertaste = Abschlag (sonst nach 1 s von selbst)</li>
       <li><b>Gamepad:</b> Stick laufen, A Pass/Abwurf, X/RT Schuss/Abschlag, Y Wechsel, LB/RB Sprint</li>`;
  const setHowto = (touchUI) => root.querySelectorAll('.howto').forEach((u) => { u.innerHTML = howto(touchUI); });

  let bannerT = 0, kickT = 0, lastScore = '', lastKeeper = '', lastCharge = null, lastStatus = '';
  const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const rpLabel = replay.querySelector('.rp-label span'), rpFlash = replay.querySelector('.flash');
  const F = Object.fromEntries(['frame', 'lines', 'puls', 'flash', 'spot', 'ring', 'pov', 'big', 'kmh', 'stamp', 'name', 'gag', 'emoji', 'prog', 'fade', 'again'].map((k) => [k, fe.querySelector('.fe-' + k)]));
  const ed = { info: null, next: 0, last: -1, kmh: null, lw: 0, st: new Map(), z: 1, zuf() { this.z = (this.z * 16807) % 2147483647; return this.z / 2147483647; } };
  // Stil nur schreiben, wenn er sich ändert (je Bild: Deckkraft/Drehung der Ebenen)
  const setz = (el, k, v) => { const m = ed.st.get(el) || ed.st.set(el, {}).get(el); if (m[k] !== v) { m[k] = v; el.style[k] = v; } };
  // Text-Element mit Einschlag-Animation (Klasse neu setzen → CSS-Animation startet neu)
  // (Neustart der Einschlag-Animation ohne erzwungenes Layout: abwechselnd zwei gleiche Animationen „go“/„go2“ –
  // `offsetWidth` kostete im ersten Clip ≈ 100 ms am Handy-Profil)
  const slam = (el, html, cls = '', fit = 0, n = 0) => {
    const g2 = !el.classList.contains('go2');
    el.innerHTML = html; el.className = el.className.split(' ')[0] + ' an' + (cls ? ' ' + cls : '');
    // fit = Schriftgröße in cqmin; n = Zeichen der längsten Zeile: lange Wörter passen sich der Rahmenbreite an
    if (fit) el.style.fontSize = `min(${fit}cqmin, ${(86 / Math.max(1, n)).toFixed(1)}cqw)`; else el.style.fontSize = '';
    el.style.setProperty('--rot', (ed.zuf() * 10 - 6).toFixed(1) + 'deg'); el.style.setProperty('--dy', (ed.zuf() * 6 - 3).toFixed(1) + '%');
    el.classList.add(g2 ? 'go2' : 'go');
  };
  const weg = (el) => { el.className = el.className.split(' ')[0]; };
  const feTrigger = (e, I) => {
    if (e.emoji) { const im = emojiBild(e.emoji); slam(F.emoji, im ? `<i><img src="${im}" alt=""></i>`.repeat(3) : `<i>${e.emoji}</i>`.repeat(3)); }
    switch (e.text) {
      case 'pov': { // Wort für Wort, das letzte Wort gelb
        const w = I.pov.split(' ');
        slam(F.pov, w.map((x, i) => `<span style="animation-delay:${(i * 0.06).toFixed(2)}s"${i === w.length - 1 ? ' class="hl"' : ''}>${x}</span>`).join(' '));
        break;
      }
      case 'technik': { const z = I.tech.split('|'); slam(F.big, z.join('<br>'), 'tech', 21, Math.max(...z.map((x) => x.length))); break; }
      // langsame Schüsse: Entfernung (ab 6 m) oder Schwierigkeit 10/10 statt km/h
      case 'kmh': ed.kmh = { t0: e.t, art: I.kmh >= 60 ? 'kmh' : I.dist >= 6 ? 'm' : 'sw', v: I.kmh >= 60 ? I.kmh : I.dist >= 6 ? I.dist : 10 }; weg(F.big); F.kmh.className = 'fe-kmh an'; break;
      case 'kmhStempel': slam(F.kmh, I.kmh >= 60 ? `${I.kmh}<small>KM/H</small>` : I.dist >= 6 ? `${I.dist.toFixed(1).replace('.', ',')} M<small>DISTANZ</small>` : `10/10<small>SCHWIERIGKEIT</small>`, 'stempel'); ed.kmh = null; break;
      case 'warte': slam(F.big, I.hook || 'WARTE AB 👀', 'warte', 16, (I.hook || 'WARTE AB 👀').length); break;
      case 'zurueck': slam(F.big, '⏪ ZURÜCK', 'warte', 14, 10); break;
      case 'golazo': weg(F.kmh); weg(F.stamp); slam(F.big, I.own ? 'EIGEN-<br>TOR!' : 'GOLAZO!', 'golazo', 32, I.own ? 6 : 7); break;
      case 'golazo2': slam(F.stamp, I.wort || 'TOOOR!', 'wort', 15, (I.wort || 'TOOOR!').length); break;
      case 'kontur': weg(F.big); weg(F.stamp); break;
      case 'leer': weg(F.big); break;
      case 'leer2': weg(F.stamp); weg(F.kmh); break;
      case 'x1': case 'x2': case 'x3': weg(F.big); slam(F.stamp, '×' + e.text[1]); break;
      case 'name': weg(F.stamp); slam(F.name, `${I.name}<small>${I.team}</small>`, '', document.body.classList.contains('quer') && !I.hoch ? 14 : 22, I.name.length); break;
      case 'gag': slam(F.gag, I.gag); break;
      case 'titel': if (I.titel) slam(F.stamp, I.titel, 'wort titel', 17, I.titel.length); break;
      case 'ende': F.again.classList.add('on'); break;
    }
  };
  return {
    // Wiederholung: an/aus mit Text (Schütze · Technik · km/h), Fan-Cam-Abzeichen, Blitz-Stärke 0…1
    replayShow(on, text = '') { document.body.classList.toggle('replaying', on); if (on) rpLabel.textContent = text; },
    replayState(fan, flash) { replay.classList.toggle('fan', fan); rpFlash.style.opacity = flash.toFixed(3); },
    // n6 Action-Moment: an/aus, je Bild Stärken (v aus action.js verlauf)
    aktion(on) { amEl.classList.toggle('on', !!on); document.body.classList.toggle('aktion', !!on); if (!on) { AM.st = {}; for (const e of [AM.vig, AM.lines, AM.flash]) e.style.opacity = '0.001'; } },
    aktionBild(v, cssFlash) {
      const s = (el, k, x) => { if (AM.st[k] !== x) { AM.st[k] = x; el.style.opacity = x; } };
      s(AM.vig, 'v', v.sat.toFixed(2)); s(AM.lines, 'l', (0.85 * v.lines).toFixed(2)); s(AM.flash, 'f', cssFlash ? v.flash.toFixed(2) : '0');
      if (v.lines > 0.01) AM.lines.style.transform = `rotate(${(performance.now() * 0.4) % 360}deg) scale(1.5)`;
    },
    // n6 Fan-Edit: Start (info = {events, total, pov, tech, kmh, name, team, gag, own, hoch (9:16-Ausschnitt), reduce, cssFlash})
    // schon beim Tor (Live-Jubel): Overlay unsichtbar aufbauen, damit der erste Clip-Schlag nicht stockt
    editVorbereiten(on) { document.body.classList.toggle('fevor', !!on); replay.classList.toggle('edit', !!on || !!ed.info); },
    editStart(info) {
      fe.style.setProperty('--akzent', info.farbe || '#ffe600'); // Akzentfarbe je Clip (Technik, GOLAZO!, Stempel)
      fe.classList.toggle('vb', info.variante === 1); // Variante B: GOLAZO! unten, Texte gleiten seitlich ein
      document.body.classList.remove('fevor');
      ed.info = info; ed.next = 0; ed.last = -1; ed.kmh = null; ed.z = (info.seed || 7) % 2147483646 + 1;
      replay.classList.add('edit'); replay.classList.toggle('reduce', !!info.reduce);
      document.body.classList.toggle('cliphoch', !!info.hoch);
      for (const k of ['big', 'kmh', 'stamp', 'name', 'gag', 'emoji', 'pov']) weg(F[k]);
      F.again.classList.remove('on'); ed.st.clear(); F.ring.style.display = 'none';
    },
    // je Bild: r = Clip-Zeit (s), fx = Effekte (FanEdit.fx), ring = {x, y, h} Schütze im Bild (Pixel) oder null
    editFrame(r, fx, ring) {
      const I = ed.info; if (!I) return;
      if (r < ed.last) { ed.next = 0; ed.z = (I.seed || 7) % 2147483646 + 1; for (const k of ['big', 'kmh', 'stamp', 'name', 'gag', 'emoji', 'pov']) weg(F[k]); F.again.classList.remove('on'); } // nochmal
      ed.last = r;
      while (ed.next < I.events.length && I.events[ed.next].t <= r) feTrigger(I.events[ed.next++], I);
      if (ed.kmh) {
        const u = Math.min(1, (r - ed.kmh.t0) / 0.42), v = ed.kmh.v * (1 - (1 - u) ** 3);
        F.kmh.innerHTML = ed.kmh.art === 'm' ? `${v.toFixed(1).replace('.', ',')} M<small>DISTANZ</small>` : ed.kmh.art === 'sw' ? `${Math.round(v)}/10<small>SCHWIERIGKEIT</small>` : `${Math.round(v)}<small>KM/H</small>`;
      }
      ed.lw = (ed.lw + 37) % 360;
      setz(F.lines, 'opacity', (fx.lines * (I.reduce ? 0.45 : 1)).toFixed(2));
      if (fx.lines > 0.01) setz(F.lines, 'transform', `rotate(${I.reduce ? 0 : ed.lw}deg) scale(1.6)`);
      setz(F.puls, 'opacity', (fx.puls * (I.reduce ? 0.05 : 0.12)).toFixed(2));
      setz(F.flash, 'opacity', I.cssFlash ? fx.white.toFixed(2) : '0');
      setz(F.fade, 'opacity', (fx.fade || 0).toFixed(2));
      setz(F.prog.firstChild, 'transform', `scaleX(${(r / I.total).toFixed(3)})`);
      if (ring && fx.freeze) {
        const H0 = F.frame.clientHeight, w = Math.max(90, ring.w * 1.4 + 30), hh = Math.min(H0 * 0.8, Math.max(110, ring.h * 1.35 + 30)), x = ring.x.toFixed(0), y = Math.min(H0 - hh / 2 - 6, Math.max(hh / 2 + 6, ring.y)).toFixed(0);
        setz(F.ring, 'display', 'block');
        setz(F.ring, 'left', x + 'px'); setz(F.ring, 'top', y + 'px'); setz(F.ring, 'width', w.toFixed(0) + 'px'); setz(F.ring, 'height', hh.toFixed(0) + 'px');
        // Namensschild über dem Ring; oben kein Platz → darunter; auch unten keiner → innen oben
        const H = F.frame.clientHeight, obenEng = ring.y - hh / 2 < H * 0.22, untenEng = ring.y + hh / 2 > H * 0.86;
        F.ring.classList.toggle('unten', obenEng && !untenEng); F.ring.classList.toggle('innen', obenEng && untenEng);
        // Spotlight: alles außer dem Schützen abdunkeln (Standbild → einmal gemalt)
        setz(F.spot, 'display', 'block');
        setz(F.spot, 'background', `radial-gradient(ellipse ${(w * 0.62).toFixed(0)}px ${(hh * 0.62).toFixed(0)}px at ${x}px ${y}px, rgba(0,0,0,0) 78%, rgba(0,0,0,.3) 100%)`);
        if (F.ring.firstChild.textContent !== '⬇ ' + I.name) F.ring.firstChild.textContent = '⬇ ' + I.name;
      } else { setz(F.ring, 'display', 'none'); setz(F.spot, 'display', 'none'); }
    },
    // Rahmen des Clips (für die Kontur in Pixeln relativ zum Rahmen)
    editRahmen() { return F.frame.getBoundingClientRect(); },
    editEnd(nochmalSek = 0) {
      ed.info = null; replay.classList.remove('edit', 'reduce'); document.body.classList.remove('cliphoch', 'fevor');
      document.body.classList.toggle('clipnochmal', nochmalSek > 0);
      clearTimeout(ed.nt); if (nochmalSek > 0) ed.nt = setTimeout(() => document.body.classList.remove('clipnochmal'), nochmalSek * 1000);
    },
    root, score, kick, menuBtn, banner, touch, stickZone, stickBase, stickKnob, bShot, bPass, bSprint, bSwitch, dbg, start, menu, credits, canvas, charge, chargeFill, hold,
    train, hint, result, help,
    setHowto,
    show(which) { for (const o of [start, menu, credits, train, hint, result, help]) o.classList.toggle('on', o === which); },
    // Training-Menü: Liste je Gruppe mit Sternen und Bestwert (records: id → {best, stars})
    buildTraining(list, records, fmt) {
      for (const box of train.querySelectorAll('.chlist')) {
        box.innerHTML = list.filter((c) => c.group === box.dataset.group).map((c) => {
          const r = records[c.id] || {};
          const st = '★'.repeat(r.stars || 0) + '☆'.repeat(3 - (r.stars || 0));
          return `<button class="chbtn" data-act="challenge" data-id="${c.id}"><span class="ci">${c.icon}</span><span class="cn">${c.name}</span><span class="cs">${st}</span><span class="cb">${r.best != null ? 'Best: ' + fmt(c, r.best) : 'neu'}</span></button>`;
        }).join('');
      }
    },
    showHint(def, rec, fmt) {
      hint.querySelector('.ht').textContent = `${def.icon} ${def.name}`;
      hint.querySelector('.hx').textContent = def.hint;
      hint.querySelector('.hb').textContent = `Sterne ab ${def.stars.map((x) => fmt(def, x)).join(' / ')}${rec && rec.best != null ? ` · dein Bestwert: ${fmt(def, rec.best)}` : ''}`;
    },
    showResult(def, res, rec, isBest, fmt) {
      result.querySelector('.rt').textContent = `${def.icon} ${def.name}`;
      result.querySelector('.stars').innerHTML = [0, 1, 2].map((i) => (i < res.stars ? '<i class="voll">★</i>' : '<i>☆</i>')).join('');
      result.querySelector('.rs').textContent = res.score == null ? 'Nicht geschafft' : `Ergebnis: ${fmt(def, res.score)}${def.better === 'hi' ? ` von ${def.attempts}` : ''}`;
      result.querySelector('.rb').textContent = isBest ? 'Neuer Bestwert!' : rec && rec.best != null ? `Bestwert: ${fmt(def, rec.best)} (${'★'.repeat(rec.stars || 0)})` : '';
    },
    setStatus(text) { if (text !== lastStatus) { score.innerHTML = text; lastStatus = text; lastScore = ''; } },
    setScore(sc) { score.innerHTML = `Tore ${sc[0] + sc[1]}<small>rechts ${sc[0]} · links ${sc[1]}</small>`; },
    // Spielstand mit Uhr: rest = Restzeit der Halbzeit (s), half 1|2, golden
    setMatch(sc, rest, half, golden, end) {
      const t = end ? 'Abpfiff' : golden ? 'Golden Goal' : `${half}. Halbzeit · ${clock(Math.max(0, rest))}`;
      const html = `<span class="t0">Orange</span> ${sc[0]} : ${sc[1]} <span class="t1">Blau</span><small>${t}</small>`;
      if (html !== lastScore) { score.innerHTML = html; lastScore = html; lastStatus = ''; }
    },
    // Knöpfe als „letzte Hand“ im Torraum umbeschriften: mode '' | 'box' | 'hold'
    setKeeperMode(mode, manual = true) {
      if (mode + manual === lastKeeper) return;
      lastKeeper = mode + manual;
      document.body.classList.toggle('kbox', mode === 'box');
      document.body.classList.toggle('khold', mode === 'hold');
      bShot.querySelector('.kw').textContent = mode === 'hold' ? 'Abschlag' : 'Fangen';
      bShot.querySelector('.lbl').textContent = mode === 'hold' ? (manual ? 'Abschlag (halten)' : 'Abschlag') : mode === 'box' ? 'Fangen (halten)' : 'Schuss';
      bPass.querySelector('.pl').textContent = mode === 'hold' ? 'Abwurf' : mode === 'box' ? 'Hechten' : 'Pass';
    },
    setHold(frac, secLeft) {
      hold.style.display = frac >= 0 ? 'block' : 'none';
      if (frac >= 0) { hold.firstChild.style.width = (frac * 100).toFixed(1) + '%'; hold.lastChild.textContent = `Ball in der Hand – Abwurf in ${Math.ceil(secLeft)} s`; }
    },
    // cls (Deko): z. B. 'tor t0' – Aufspringen und Leuchten in Mannschaftsfarbe (nur mit body.deko sichtbar)
    flash(text, sub = '', dur = 1.8, cls = '') {
      banner.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
      if (cls || banner.dataset.cls) {
        banner.className = 'banner' + (cls ? ' ' + cls : ''); banner.dataset.cls = cls;
        if (cls) void banner.offsetWidth; // Animation neu starten
      }
      banner.classList.add('on'); bannerT = dur;
    },
    kickInfo(k) {
      const kmh = Math.round(k.speed * 3.6);
      const names = { vollspann: 'Vollspann', innenrist: 'Innenrist', aussenrist: 'Außenrist', innen: 'Innenseite', aussen: 'Außenrist', ferse: 'Hacke', chip: 'Chip',
        volley: 'Volley', dropkick: 'Dropkick', seitfall: 'Seitfallzieher', fallrueck: 'Fallrückzieher', kopf: 'Kopfball', flugkopf: 'Flugkopfball' };
      const parts = [`${names[k.tech] || (k.kind === 'pass' ? 'Pass' : 'Schuss')} ${kmh} km/h`];
      if (k.kind === 'shot') {
        if (Math.abs(k.sideRps) >= 1) parts.push(`Effet ${Math.abs(k.sideRps).toFixed(1).replace('.', ',')} U/s`);
        else if (k.tech === 'vollspann' && k.spinRps < 1) parts.push('flattert');
        if (k.q != null) parts.push(`Lage ${k.q > 0.75 ? 'gut' : k.q > 0.45 ? 'mittel' : 'schlecht'}`);
        if (k.timing != null) parts.push(`Timing ${Math.round(k.timing * 100)} %`);
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
