# Fotos für die Sichtprüfung: Start, Spiel (Führen, Schuss), Bande, Dachnetz – Handy hoch/quer und Desktop.
# Aufruf: python3 tests/shots.py [unterordner] [formate…]   (Standard: final, hoch quer desktop)
import sys, time, json
sys.path.insert(0, 'tests')
from util import *
sub = sys.argv[1] if len(sys.argv) > 1 else 'final'
forms = sys.argv[2:] or ['hoch', 'quer', 'desktop']
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, forms[0])
    for i, f in enumerate(forms):
        if i: s.new_context(f)
        s.open('?nosw&seed=7&q=' + ('2' if f == 'desktop' else '1'))
        time.sleep(1.2)
        s.shot(f'{f}_01_start', sub)
        s.ev("__game.start()"); s.frames(5)
        # Führen: Ball vor den Fuß, dann in Richtung rechtes Tor (leicht schräg), 2,2 s
        s.ev("__game.placePlayer(-5, 1.5, 0); __game.placeBall(-4.5, 0.11, 1.5)")
        s.ev("__game.input({wx: 0.93, wz: -0.36}, 2.2)")
        s.wait_sim(1.4); s.shot(f'{f}_02_fuehren', sub)
        s.wait_sim(0.9)
        # Schuss aufladen mit Effet, dann loslassen
        s.ev("__game.input({wx: 1, wz: 0.1, shootHeld: true, cx: 0.8, cy: -0.1}, 0.75)")
        s.wait_sim(0.55); s.shot(f'{f}_03_aufladen', sub)
        s.wait_sim(0.3)
        s.wait_sim(0.25); s.shot(f'{f}_04_schuss', sub)
        # Bande: Ball quer gegen die ferne Längsseite
        s.ev("__game.placePlayer(-6, 3, 0); __game.kick({from:[-2, 0.11, 2], v:[7, 1.2, -16], w:[0, 30, 0]})")
        s.wait_sim(0.55); s.shot(f'{f}_05_bande', sub)
        # Dachnetz: steiler Schuss nach oben
        s.ev("__game.kick({from:[1, 0.11, 0], v:[2, 26, 1], w:[0,0,0]})")
        s.wait_sim(0.27); s.shot(f'{f}_06_dach', sub)
        # ins Tor (rechts)
        s.ev("__game.placePlayer(2, 0.5, 0); __game.kick({from:[4, 0.11, 0.3], v:[22, 2.2, -0.6], w:[0, 12, 0]})")
        s.wait_sim(0.42); s.shot(f'{f}_07_tor', sub)
        info = s.ev("__game.info()"); st = s.state()
        print(f, 'boot', round(s.boot_s, 1), 's', json.dumps(info), 'state', st['state'], st['score'], 'faults', st['faults'])
        print('  small buttons', s.small_buttons())
        print('  overlaps', s.overlaps(['#bShot', '#bPass', '#bSprint', '.score', '.iconbtn']))
        print('  errors', s.errors[:6])
    s.close()
