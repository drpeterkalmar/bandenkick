# Avatar-Prüfstand im Browser (tools/avatar_view.html): Fotos je Avatar und Clip-Satz + Messwerte (Füße im Boden,
# Blickrichtung, Größe). Aufruf: python3 tests/avatar_view.py [Avatar …]
import sys, json
sys.path.insert(0, 'tests')
from util import *

names = sys.argv[1:] or ['Sports_Male_02']
sets = [('idle,walk,run,sprint,cheer', 0.25), ('jog,start,stop,turnL90,clap', 0.5), ('idle,walk,run,sprint,cheer', 0.7)]
with Server() as srv, sync_playwright() as pw:
    b = pw.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 1400, 'height': 700})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    for n in names:
        for i, (clips, t) in enumerate(sets):
            for yaw in ([35, 90] if i == 0 else [35]):
                pg.goto(f"{srv.base}tools/avatar_view.html?avatar={n}&clips={clips}&t={t}&yaw={yaw}")
                pg.wait_for_function('window.__ready === true', timeout=60000)
                d = os.path.join(ROOT, 'tests', 'shots', 'avatars'); os.makedirs(d, exist_ok=True)
                pg.screenshot(path=os.path.join(d, f'{n}_{i}_{yaw}.png'))
                if yaw == 35:
                    print(n, t, json.dumps(pg.evaluate('window.__view')))
    print('Fehler:', errs)
    b.close()
