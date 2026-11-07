import sys
sys.path.insert(0, 'tests')
from util import *
out = 'tests/out/start_simpel'
import os; os.makedirs(out, exist_ok=True)
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(['hoch', 'quer', 'desktop']):
        if i: s.new_context(form)
        s.open('?nosw&seed=11&q=1')
        s.frames(5)
        s.pg.screenshot(path=f'{out}/{form}.png')
        print(form, 'buttons', s.pg.eval_on_selector_all('.overlay.on .btn', 'e=>e.map(x=>x.textContent)'))
    s.tap('[data-act="play"]'); s.frames(5)
    print('nach play overlay on:', s.pg.eval_on_selector_all('.overlay.on', 'e=>e.length'))
    print('overlay-klassen', s.pg.eval_on_selector_all('.overlay.on', 'e=>e.map(x=>x.innerText.slice(0,40))'))
