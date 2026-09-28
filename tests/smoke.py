# Rauchtest im Browser (Pixel 7 hoch/quer, Desktop): Laden ohne Fehler, Spielstart, Führen, Pass, Schuss,
# Schüsse gegen Bande und ins Dachnetz (Ball bleibt im Käfig), Tor. Aufruf: python3 tests/smoke.py
import sys, time, json
sys.path.insert(0, 'tests')
from util import *
fails = []
def ok(cond, msg):
    print(('  ✅ ' if cond else '  ❌ ') + msg, flush=True)
    if not cond: fails.append(msg)

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(['hoch', 'quer', 'desktop']):
        if i: s.new_context(form)
        print(form)
        s.open('?nosw&seed=11')
        ok('Metal' in str(s.gl), f'WebGL auf der GPU ({s.gl})')
        ok(s.boot_s < 15, f'Boot {s.boot_s:.1f} s')
        s.tap('[data-act="play"]')
        s.frames(5)
        st = s.state()
        ok(st['mode'] == 'play' and st['cam'] == ('hoch' if form == 'hoch' else 'quer'), f"Spiel läuft, Kamera {st['cam']}")
        # Führen
        s.ev("__game.placePlayer(-5, 0, 0); __game.placeBall(-4.6, 0.11, 0)")
        s.ev("__game.input({wx: 1, wz: 0}, 2.0)"); s.wait_sim(2.0)
        st = s.state()
        d = abs(st['ball']['p'][0] - st['player']['x'])
        ok(st['player']['x'] > -1.5 and d < 2.0, f"Führen: Spieler {st['player']['x']:.1f} m, Ball {d:.2f} m voraus")
        # Pass
        s.ev("__game.input({pass: true}, 0.05)"); s.wait_sim(0.4)
        lk = s.state()['lastKick']
        ok(lk and lk['kind'] == 'pass', f"Pass: {lk and round(lk['speed'], 1)} m/s")
        # Schuss 0,6 s halten, Treffpunkt links
        s.ev("__game.placePlayer(-5, 1, 0); __game.placeBall(-4.6, 0.11, 1)")
        s.ev("__game.input({wx: 1, wz: 0, shootHeld: true, cx: -0.7}, 0.6)"); s.wait_sim(1.0)
        lk = s.state()['lastKick']
        ok(lk and lk['kind'] == 'shot' and lk['sideRps'] < -3, f"Schuss mit Effet: {lk and round(lk['speed'], 1)} m/s, {lk and round(lk['sideRps'], 1)} U/s")
        # Bande und Dach: Ball bleibt im Käfig
        r = s.ev("__game.kick({from:[-2, 0.11, 0], v:[4, 3, 28], w:[0, 50, 0]}); __game.sim(3)")
        ev = [e['type'] for e in r['events']]
        ok('board' in ev and r['state']['faults'] == 0 and r['state']['state'] == 'play', f"Schuss 28 m/s gegen die Bande: {sorted(set(ev))}")
        z = r['state']['ball']['p'][2]
        ok(abs(z) < 6.5, f'Ball danach im Feld (z = {z:.2f} m)')
        r = s.ev("__game.kick({from:[0, 0.11, 0], v:[3, 29, -2], w:[0, 0, 0]}); __game.sim(4)")
        ev = [e['type'] for e in r['events']]
        tags = [e.get('tag') for e in r['events'] if e['type'] == 'net']
        ok('roof' in tags and r['state']['state'] == 'play' and r['state']['faults'] == 0, f"Schuss 29 m/s ins Dachnetz: Netz-Treffer {tags}, Zustand {r['state']['state']}")
        p = r['state']['ball']['p']
        ok(abs(p[0]) < 10 and abs(p[2]) < 6.5 and p[1] < 5.5, f'Ball danach im Käfig ({p[0]:.1f}, {p[1]:.2f}, {p[2]:.1f})')
        # Tor
        r = s.ev("__game.kick({from:[5, 0.11, 0], v:[20, 2, 0.4], w:[0, 0, 0]}); __game.sim(1.5)")
        ok(any(e['type'] == 'goal' for e in r['events']), 'Tor erkannt')
        s.wait_sim(0.3)
        s.shot(f'smoke_{form}', 'dev')
        info = s.ev("__game.info()")
        print('  info', json.dumps(info))
        ok(s.small_buttons() == [], f'Knöpfe ≥ 48 px, im Bild: {s.small_buttons()}')
        errs = s.errors + ['JSERR ' + e for e in s.ev('window.__errors')]
        ok(errs == [], f'0 Page-/Console-Fehler {errs[:3]}')
    s.close()
print('\nRAUCHTEST', 'GRÜN' if not fails else f'ROT ({len(fails)})')
sys.exit(1 if fails else 0)
