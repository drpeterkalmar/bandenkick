# Touch-Steuerung mit echten Touch-Ereignissen (CDP Input.dispatchTouchEvent), hoch und quer:
# Stick bewegt die Figur in Bildschirmrichtung, Pass tippen, Schuss halten + Treffpunkt seitlich → Effet,
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
        s.open('?nosw&solo=1&seed=3&q=1')
        s.tap('[data-act="play"]')
        s.frames(5)
        cdp = s.ctx.new_cdp_session(s.pg)
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
        # 3) Schuss halten 0,7 s mit Finger am rechten Rand des Knopfs → Effet
        s.ev("__game.placePlayer(-4, 0, 0); __game.placeBall(-3.6, 0.11, 0)")
        s.frames(3)
        box = s.pg.locator('#bShot').bounding_box()
        cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        touch(cdp, 'touchStart', [(2, (cx, cy))])
        touch(cdp, 'touchMove', [(2, (cx + box['width'] * 0.42, cy))])
        t0 = s.ev("__game.game.t")
        s.pg.wait_for_function(f"__game.game.t >= {t0 + 0.7}")
        charging = s.state()['player']['charging']
        dot = s.ev("getComputedStyle(document.querySelector('#bShot .dot')).left")
        touch(cdp, 'touchEnd', [])
        held = s.ev("__game.game.t") - t0
        s.wait_sim(0.3)
        s.shot(f'touch_{form}_schuss', 'dev')
        lk = s.state()['lastKick']
        ok(charging, 'Schuss lädt auf, solange der Finger liegt')
        exp = min(1, (held + 0.02) / 1.0)
        # Ladung ≈ Haltedauer (± ein Bild headless, bis 0,1 s Spielzeit je Bild)
        ok(lk is not None and lk['kind'] == 'shot' and abs(lk['power'] - min(1, held)) < 0.2, f"Schuss ausgelöst: {lk and round(lk['speed'], 1)} m/s, Ladung {lk and round(lk['power'], 2)} nach {held:.2f} s gehalten")
        ok(lk is not None and abs(lk['sideRps']) > 4, f"Treffpunkt seitlich → Effet ({lk and round(lk['sideRps'], 1)} U/s), Punkt bei {dot}")
        # 4) Kein Scrollen/Zoomen durch Wischen
        sc = s.ev("[scrollX, scrollY, visualViewport ? visualViewport.scale : 1]")
        ok(sc == [0, 0, 1], f'keine Verschiebung/Zoom durch Touch ({sc})')
        ok(s.errors == [], f'0 Fehler {s.errors[:3]}')
    s.close()
print('\nTOUCH', 'GRÜN' if not fails else f'ROT ({len(fails)})')
sys.exit(1 if fails else 0)
