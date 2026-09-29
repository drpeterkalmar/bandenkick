// Eingabe: Touch (Stick links, Knöpfe rechts), Tastatur + Maus, Gamepad. Keine Wischgesten.
// Ergebnis je Bild: Bildschirm-Stick (sx, sy), Sprint, Pegel beider Knöpfe (passDown/shotDown – die Gesten
// halten / tipp + halten wertet src/input/gesture.js im Spieltakt aus), Treffpunkt (nur Profi ?treffpunkt=1).
// Ein Tipp kürzer als ein Bild wird trotzdem ein Bild lang als „gedrückt“ gemeldet (Latch).

export class Input {
  constructor(ui) {
    this.ui = ui;
    this.touch = { sx: 0, sy: 0, sprint: false, shoot: false, pass: false, cx: 0, cy: 0, stickId: null, shotId: null, passId: null, sprintId: null, ox: 0, oy: 0 };
    this.latch = { pass: false, shot: false };
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, moved: -99, l: false, r: false, lDown: 0 };
    this.switchQueued = false;
    this.shootWas = false;
    this.lastTouch = -99;
    this.aimWorld = null;         // Maus-Ziel am Boden (von main gesetzt)
    this.now = 0;
    this.pad = null;
    this.bind();
  }

  bind() {
    const t = this.touch, ui = this.ui;
    const R = 60; // Stick-Radius in px
    const zone = ui.stickZone, base = ui.stickBase, knob = ui.stickKnob;
    const place = (x, y) => { base.style.left = x + 'px'; base.style.top = y + 'px'; };
    this.resetStick = () => {
      const r = zone.getBoundingClientRect();
      t.ox = r.left + Math.min(110, r.width * 0.42); t.oy = r.bottom - Math.min(120, r.height * 0.4);
      place(t.ox, t.oy); knob.style.transform = ''; base.classList.remove('on');
    };
    const cap = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (_) { /* synthetische Events */ } };
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (t.stickId !== null) return;
      t.stickId = e.pointerId; t.ox = e.clientX; t.oy = e.clientY; t.sx = 0; t.sy = 0;
      place(t.ox, t.oy); base.classList.add('on'); cap(zone, e);
      this.lastTouch = this.now; document.body.classList.add('touch');
    });
    const moveStick = (e) => {
      if (e.pointerId !== t.stickId) return;
      let dx = e.clientX - t.ox, dy = e.clientY - t.oy;
      const l = Math.hypot(dx, dy);
      // Finger über den Rand hinaus: Stick wandert mit (Umkehr wirkt sofort)
      if (l > R * 1.25) { const k = (l - R * 1.25) / l; t.ox += dx * k; t.oy += dy * k; place(t.ox, t.oy); dx = e.clientX - t.ox; dy = e.clientY - t.oy; }
      const m = Math.min(1, Math.hypot(dx, dy) / R);
      const a = Math.atan2(dy, dx);
      t.sx = Math.cos(a) * m; t.sy = -Math.sin(a) * m;
      t.edge = Math.hypot(dx, dy) > R * 1.1;
      knob.style.transform = `translate(${Math.cos(a) * m * R}px, ${Math.sin(a) * m * R}px)`;
    };
    const endStick = (e) => { if (e.pointerId !== t.stickId) return; t.stickId = null; t.sx = 0; t.sy = 0; t.edge = false; this.resetStick(); };
    zone.addEventListener('pointermove', moveStick);
    zone.addEventListener('pointerup', endStick);
    zone.addEventListener('pointercancel', endStick);

    // Schuss: halten = aufladen; Fingerlage auf dem Knopf = Treffpunkt am Ball
    const shot = ui.bShot;
    const contact = (e) => {
      const r = shot.getBoundingClientRect();
      let cx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), cy = -(e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(cx, cy);
      if (l < 0.22) { cx = 0; cy = 0; } else if (l > 1) { cx /= l; cy /= l; }
      t.cx = cx; t.cy = cy;
    };
    shot.addEventListener('pointerdown', (e) => { e.preventDefault(); t.shotId = e.pointerId; t.shoot = true; this.latch.shot = true; contact(e); cap(shot, e); shot.classList.add('down'); this.lastTouch = this.now; document.body.classList.add('touch'); });
    shot.addEventListener('pointermove', (e) => { if (e.pointerId === t.shotId) contact(e); });
    const endShot = (e) => { if (e.pointerId !== t.shotId) return; t.shotId = null; t.shoot = false; shot.classList.remove('down'); };
    shot.addEventListener('pointerup', endShot); shot.addEventListener('pointercancel', endShot);

    const pass = ui.bPass;
    pass.addEventListener('pointerdown', (e) => { e.preventDefault(); t.passId = e.pointerId; t.pass = true; this.latch.pass = true; cap(pass, e); pass.classList.add('down'); this.lastTouch = this.now; document.body.classList.add('touch'); });
    const endPass = (e) => { if (e.pointerId !== t.passId) return; t.passId = null; t.pass = false; pass.classList.remove('down'); };
    pass.addEventListener('pointerup', endPass); pass.addEventListener('pointercancel', endPass);
    const sw = ui.bSwitch;
    if (sw) sw.addEventListener('pointerdown', (e) => { e.preventDefault(); this.switchQueued = true; sw.classList.add('down'); setTimeout(() => sw.classList.remove('down'), 140); });
    const sprint = ui.bSprint;
    sprint.addEventListener('pointerdown', (e) => { e.preventDefault(); t.sprintId = e.pointerId; t.sprint = true; cap(sprint, e); sprint.classList.add('down'); });
    const endSprint = (e) => { if (e.pointerId !== t.sprintId) return; t.sprintId = null; t.sprint = false; sprint.classList.remove('down'); };
    sprint.addEventListener('pointerup', endSprint); sprint.addEventListener('pointercancel', endSprint);

    // Tastatur
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyJ' || e.code === 'Enter') this.latch.pass = true;
      if (e.code === 'Space' || e.code === 'KeyK') this.latch.shot = true;
      if (e.code === 'KeyC' || e.code === 'Tab') this.switchQueued = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = false; });
    // Maus: zielen (Bodenpunkt unter dem Zeiger), links tippen = Pass, rechts halten = Schuss
    const cv = ui.canvas;
    cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = this.now; } });
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) { this.mouse.l = true; this.latch.pass = true; }
      if (e.button === 2) { this.mouse.r = true; this.latch.shot = true; }
      this.mouse.moved = this.now;
    });
    addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') return; if (e.button === 2) this.mouse.r = false; if (e.button === 0) this.mouse.l = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Liest alles zusammen; now in s
  sample(now) {
    this.now = now;
    const t = this.touch, k = this.keys;
    let sx = t.sx, sy = t.sy;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); sx = kx / l; sy = ky / l; }
    let sprint = t.sprint || !!t.edge || k.has('ShiftLeft') || k.has('ShiftRight');
    let shoot = t.shoot || k.has('Space') || this.mouse.r || k.has('KeyK') || this.latch.shot;
    let passDown = t.pass || k.has('KeyJ') || k.has('Enter') || this.mouse.l || this.latch.pass;
    this.latch.pass = false; this.latch.shot = false;
    let cx = t.shoot ? t.cx : 0, cy = t.shoot ? t.cy : 0;
    // Treffpunkt per Tastatur (nur Profi ?treffpunkt=1): Q/E seitlich (Effet), R unten (Heber), F oben (Aufsetzer)
    if (!t.shoot) {
      cx = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
      cy = (k.has('KeyF') ? 1 : 0) - (k.has('KeyR') ? 1 : 0);
      const l = Math.hypot(cx, cy); if (l > 1) { cx /= l; cy /= l; }
    }
    let swi = this.switchQueued; this.switchQueued = false;
    // Gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.18) { sx = ax; sy = -ay; }
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      if (b(0)) passDown = true;
      if (b(3) && !this.padY) swi = true;
      this.padY = b(3);
      if (b(2) || b(7)) shoot = true;
      if (b(4) || b(5) || b(6) || b(10)) sprint = true;
      const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
      if (Math.hypot(rx, ry) > 0.25) { cx = rx; cy = -ry; }
      this.pad = p.id;
    }
    const release = this.shootWas && !shoot;
    this.shootWas = shoot;
    // Treffpunkt beim Loslassen = zuletzt gehaltener (Finger verlässt den Knopf)
    if (shoot) this.lastC = [cx, cy];
    else if (release && this.lastC) { [cx, cy] = this.lastC; }
    const mouseAim = now - this.mouse.moved < 2.5 && !document.body.classList.contains('touch');
    return { sx, sy, sprint, passDown, shotDown: shoot, shootRelease: release, cx, cy, mouseAim, switch: swi };
  }
}
