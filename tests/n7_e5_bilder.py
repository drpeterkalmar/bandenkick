# n7 E5: Fotos der Eck-Schrägen – eine Ecke von schräg oben (Spielkamera-Höhe) und von innen, je für ?eckschraege=0 / 1 / 1.5.
# Aufruf: python3 tests/n7_e5_bilder.py [quer|hoch]
import sys, os
sys.path.insert(0, 'tests')
from util import *
from PIL import Image
form = sys.argv[1] if len(sys.argv) > 1 else 'quer'
rows = []
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, form)
    for e in ['0', '1', '1.5']:
        s.open(f'?nosw&seed=7&play&nohelp&q=1&action=0&replay=0&eckschraege={e}')
        s.ev("(() => { const st = document.createElement('style'); st.textContent = '#touch, .hud-top { display: none !important; }'; document.head.appendChild(st); })()")
        s.ev("__game.bots(false)")
        hx, hz = s.ev("__game.game.cage.hx"), s.ev("__game.game.cage.hz")
        s.ev(f"(() => {{ const g = __game.game; g.players.forEach((p, i) => p.place(-3 - i, (i % 3 - 1) * 2, 0)); g.ball.place({hx} - 0.7, 0.11, {hz} - 1.6); g.ball.v.set(0, 0, 0); }})()")
        paths = []
        for name, pos, look in [('oben', [hx - 7, 7.5, hz - 7], [hx - 0.8, 0, hz - 0.8]), ('innen', [hx - 4.5, 1.6, hz - 3.2], [hx, 0.6, hz])]:
            s.ev(f"__game.cam({pos}, {look})"); s.frames(6)
            paths.append(s.shot(f'ecke_{e}_{name}_{form}', 'n7'))
        rows.append(paths)
    print('Fehler:', s.errors[:3])
    s.close()
ims = [[Image.open(p).convert('RGB') for p in r] for r in rows]
w, h = ims[0][0].size; sc = 0.4 if form == 'quer' else 0.28
tw, th = int(w * sc), int(h * sc)
col = Image.new('RGB', (tw * 3, th * 2))
for i, r in enumerate(ims):
    for j, im in enumerate(r): col.paste(im.resize((tw, th)), (i * tw, j * th))
out = os.path.join(ROOT, 'tests', 'shots', 'n7', f'e5_ecken_{form}.jpg'); col.save(out, quality=84)
for r in rows:
    for p in r: os.remove(p)
print('Collage (Spalten: eckig, 1 m, 1,5 m; oben von oben, unten von innen):', out)
