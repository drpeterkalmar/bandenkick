# n16 Nachtrag 1 A (Peter 21.11.): im Spiel keine Boden-Markierungen mehr (Spieler-Ring + Pfeil, Traumpass-Ring, Tormann-Ring).
# Spielt je Stand (?marker=0 Standard, ?marker=1 alt) ein paar Sekunden mit Bots, Screenshots aus der Spielkamera (Handy quer) und
# zählt, wie oft ein Marker sichtbar war. Aufruf: py tests/n16_marker_bilder.py → tests/shots/n16/marker_*.png
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'shots', 'n16'); os.makedirs(OUT, exist_ok=True)
res = {}
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'quer')
    for m in ('0', '1'):
        s.open(f'?nosw&nohelp&play&startprobe=0&seed=5&action=0&replay=0&marker={m}')
        s.ev("__game.game.rules.phase = 'play'")
        n = {'spieler': 0, 'traumpass': 0, 'tormann': 0, 'proben': 0}
        for k in range(12):
            s.wait_sim(0.5)
            v = s.ev("__game.markerSicht()")
            n['proben'] += 1
            for key in ('spieler', 'traumpass', 'tormann'): n[key] += 1 if v[key] else 0
            if k in (3, 9): s.pg.screenshot(path=os.path.join(OUT, f'marker{m}_{k}.png'))
        res['marker=' + m] = n
        print('marker=' + m, n, flush=True)
    s.close()
json.dump(res, open(os.path.join(OUT, 'marker.json'), 'w'), indent=1)
ok = res['marker=0']['spieler'] == res['marker=0']['traumpass'] == res['marker=0']['tormann'] == 0 and res['marker=1']['spieler'] > 0
print('OK' if ok else 'FEHLER'); sys.exit(0 if ok else 1)
