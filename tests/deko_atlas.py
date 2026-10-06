# Prüfbilder der Deko-Atlanten (Bäume/Büsche, Zuschauer-Posen, Boden-Details) → tests/shots/deko_raw/atlas_*.png
import sys, base64, os
sys.path.insert(0, 'tests')
from util import *
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'quer')
    s.open('?nosw&seed=7&q=1')
    s.pg.wait_for_function("window.__game.deko && window.__game.deko.ready", timeout=60000)
    imgs = s.ev("__game.deko.debugImages(__game.renderer)")
    d = os.path.join(ROOT, 'tests', 'shots', 'deko_raw'); os.makedirs(d, exist_ok=True)
    for k, v in imgs.items():
        p = os.path.join(d, f'atlas_{k}.png'); open(p, 'wb').write(base64.b64decode(v.split(',')[1])); print(p)
    print('errors', s.errors[:5], s.ev('window.__errors'))
    s.close()
