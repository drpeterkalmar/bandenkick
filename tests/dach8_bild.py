import sys
sys.path.insert(0, 'tests')
from util import *
import os
out = 'tests/out/dach8'; os.makedirs(out, exist_ok=True)
with Server() as srv, sync_playwright() as pw:
    for form in ('hoch', 'quer'):
        s = Session(pw, srv.base, form)
        s.open('?nosw&solo=1&seed=11&q=1&nohelp')
        s.tap('[data-act="play"]'); s.frames(40)
        s.pg.screenshot(path=f'{out}/{form}.png')
        print(form, 'ok')
