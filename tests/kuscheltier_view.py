# n9 Kuscheltier-Prüfstand (tools/kuscheltier_view.html): Fotos der sechs Figuren je Pose.
# Aufruf: python3 tests/kuscheltier_view.py [pose[:yaw[:extra]] …]   z. B. stehen sprint:90 stehen:20:&nah=1
# → tests/shots/kuscheltiere_raw/<pose>_<yaw><extra>.png
import sys, os, json, re
sys.path.insert(0, 'tests')
from util import *

args = sys.argv[1:] or ['stehen', 'stehen:20:&nah=1', 'sprint:90', 'schuss:60', 'hecht:20', 'jubel:20']
d = os.path.join(ROOT, 'tests', 'shots', 'kuscheltiere_raw'); os.makedirs(d, exist_ok=True)
with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1500, 'height': 760})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
    for a in args:
        q = a.split(':'); pose = q[0]; yaw = q[1] if len(q) > 1 else '25'; extra = q[2] if len(q) > 2 else ''
        pg.goto(f"{srv.base}tools/kuscheltier_view.html?pose={pose}&yaw={yaw}{extra}")
        pg.wait_for_function('window.__ready === true', timeout=90000)
        fn = os.path.join(d, f"{pose}_{yaw}{re.sub(r'[^a-z0-9=]+', '_', extra)}.png")
        pg.screenshot(path=fn)
        print(fn, json.dumps(pg.evaluate('window.__info')))
    print('Fehler:', errs[:10])
    b.close()
