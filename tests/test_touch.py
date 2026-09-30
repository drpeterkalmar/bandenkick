# Touch-Steuerung mit echten Touch-Ereignissen (CDP Input.dispatchTouchEvent), hoch und quer:
# Stick bewegt die Figur in Bildschirmrichtung, Pass tippen, Schuss tippen/doppeltippen, Pass doppeltippen (Chip),
# Knöpfe ≥ 48 px, im Bild, ohne Überlappung. Aufruf: python3 tests/test_touch.py
import sys, time, json, math
sys.path.insert(0, 'tests')
from util import *

def touch(cdp, typ, pts):
    cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in pts]})

fails = []
def ok(cond, msg):
    print(('  ✅ ' if cond else '  ❌ ') + msg)
    if not cond: fails.append(msg)

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(['hoch', 'quer']):
        if i: s.new_context(form)
        print(form)
        s.open('?nosw&solo=1&seed=3&q=1&nohelp&tipp=0.45&doppel=0.6')  # headless: CDP-Touch braucht je Ereignis 50–250 ms, Tipp-Grenzen großzügiger (am Handy 0,2 / 0,11 s)
        s.tap('[data-act="trainmenu"]'); s.tap('[data-act="free"]')
        s.frames(5)
        cdp = s.ctx.new_cdp_session(s.pg)
        # Knopf-Flanken mit Ereignis-Zeitstempel mitschreiben (Diagnose bei Rot)
        s.ev("(() => { const I = __game.inputs, n = I.note.bind(I); window.__edges = []; I.note = (e) => { const b = I.edges.length; n(e); if (I.edges.length > b) __edges.push(I.edges.at(-1)); }; })()")
        W, H = s.ev("[innerWidth, innerHeight]")
        ok(s.ev("document.body.classList.contains('touch')"), 'Touch-Oberfläche aktiv')
        ok(s.small_buttons() == [], f'alle Knöpfe ≥ 48 px und im Bild {s.small_buttons()}')
        ov = s.overlaps(['#bShot', '#bPass', '#bSprint', '.score', '.iconbtn'])
        ok(ov == [], f'keine Überlappung der Knöpfe {ov}')
        # 1) Stick: Finger links unten aufsetzen, nach oben schieben (Bildschirm-oben)
        s.ev("__game.placePlayer(-4, 0, 0); __game.placeBall(8, 0.11, 5)")
        p0 = s.state()['player']
        sx, sy = W * 0.22, H * 0.82
        touch(cdp, 'touchStart', [(0, (sx, sy))])
        for k in range(1, 8):
            touch(cdp, 'touchMove', [(0, (sx, sy - 10 * k))])
            time.sleep(0.02)
        s.wait_sim(1.0)
        p1 = s.state()['player']
        touch(cdp, 'touchEnd', [])
        s.pg.wait_for_function("__game.inputs.touch.stickId === null", timeout=5000)
        s.frames(3)
        # Bildschirm-oben in Welt: aus der Kamera
        ax = s.ev("(() => { const a = __game.gcam.groundAxes(); return [a.fx, a.fz]; })()")
        dx, dz = p1['x'] - p0['x'], p1['z'] - p0['z']
        d = math.hypot(dx, dz)
        cosang = (dx * ax[0] + dz * ax[1]) / max(d, 1e-6)
        ok(d > 2.0, f'Stick bewegt die Figur ({d:.2f} m)')
        ok(cosang > 0.9, f'Richtung = Bildschirm-oben (cos {cosang:.2f})')
        # 2) Pass antippen: Ball vor den Fuß, Knopf tippen → Ball rollt mit ~10,5 m/s
        s.ev("__game.placePlayer(-4, 0, 0); __game.placeBall(-3.6, 0.11, 0)")
        s.frames(3)
        box = s.pg.locator('#bPass').bounding_box()
        cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        s.ev("__game.game.players[0].lastKick = null")
        touch(cdp, 'touchStart', [(1, (cx, cy))]); time.sleep(0.05); touch(cdp, 'touchEnd', [])
        try: s.pg.wait_for_function("__game.state().lastKick !== null", timeout=8000)
        except Exception: pass
        lk = s.state()['lastKick']
        ok(lk is not None and lk['kind'] == 'pass', f"Pass ausgelöst ({lk and round(lk['speed'], 1)} m/s)")
        # 3) Gesten mit echten Touch-Ereignissen (Nacht 2c): tippen und doppeltippen auf beiden Knöpfen. Nach dem
        #    ersten Tipp zeigt der Ring den Modus, solange das Fenster für den zweiten Tipp läuft.
        def gesture(sel, pid, second=True):
            box = s.pg.locator(sel).bounding_box()
            cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            touch(cdp, 'touchStart', [(pid, (cx, cy))]); time.sleep(0.06); touch(cdp, 'touchEnd', [])
            sym, cls = '', ''
            if second:
                time.sleep(0.08); touch(cdp, 'touchStart', [(pid, (cx, cy))]); time.sleep(0.05); touch(cdp, 'touchEnd', [])
            else:
                try: s.pg.wait_for_function(f"document.querySelector('{sel} .sym').textContent !== ''", timeout=3000)
                except Exception: pass
                sym = s.ev(f"document.querySelector('{sel} .sym').textContent")
                cls = s.ev(f"document.querySelector('{sel}').className")
            return sym, cls
        def last(kind):
            try: s.pg.wait_for_function(f"__game.state().lastKick && __game.state().lastKick.kind === '{kind}'", timeout=10000)
            except Exception: pass
            return s.state()['lastKick']
        s.ev("__game.placePlayer(-4, 1.5, 0); __game.placeBall(-3.6, 0.11, 1.5); __game.game.players[0].lastKick = null"); s.frames(3)
        gesture('#bShot', 2)
        lk = last('shot'); s.shot(f'touch_{form}_schuss', 'dev')
        if not (lk and lk['tech'] in ('innenrist', 'aussenrist')): print('     Flanken:', [(e['btn'], e['down'], round(e['t'], 3)) for e in s.ev('__edges')[-4:]])
        ok(lk is not None and lk['tech'] in ('innenrist', 'aussenrist') and abs(lk['sideRps']) > 3, f"Schuss doppeltippen = angeschnitten: {lk and lk['tech']}, {lk and round(lk['speed'], 1)} m/s, {lk and round(lk['sideRps'], 1)} U/s")
        s.ev("__game.placePlayer(-4, 0, 0); __game.placeBall(-3.6, 0.11, 0); __game.game.players[0].lastKick = null"); s.frames(3)
        sym, cls = gesture('#bShot', 3, second=False)
        lk = last('shot')
        ok(sym == '⚡' and lk is not None and lk['tech'] == 'vollspann', f"Schuss tippen: Ring {sym!r}, {lk and lk['tech']} {lk and round(lk['speed'], 1)} m/s")
        # Tor im freien Training → nach 2,4 s Neustart (versetzt Spieler und Ball): erst abwarten
        s.wait_sim(3.0)
        s.ev("__game.placePlayer(-4, 0, 0); __game.placeBall(-3.6, 0.11, 0); __game.game.players[0].lastKick = null"); s.frames(3)
        gesture('#bPass', 4)
        lk = last('pass')
        ok(lk is not None and lk['tech'] == 'chip' and lk['elevDeg'] > 15, f"Pass doppeltippen = hoch: {lk and lk['tech']} {lk and round(lk['elevDeg'])}°")
        # 4) Kein Scrollen/Zoomen durch Wischen
        sc = s.ev("[scrollX, scrollY, visualViewport ? visualViewport.scale : 1]")
        ok(sc == [0, 0, 1], f'keine Verschiebung/Zoom durch Touch ({sc})')
        ok(s.errors == [], f'0 Fehler {s.errors[:3]}')
    s.close()
print('\nTOUCH', 'GRÜN' if not fails else f'ROT ({len(fails)})')
sys.exit(1 if fails else 0)
