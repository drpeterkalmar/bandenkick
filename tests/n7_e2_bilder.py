# n7 E2: Bildfolge Nachdrall – derselbe Schuss (Mensch, 24 m/s, 15 m aufs Tor) ohne und mit Stick nach links direkt nach dem
# Kontakt. Kamera steil über der Schussbahn; je Schuss 7 Bilder (0,1 … 0,7 s, vor der Torlinie nach dem Kontakt) hell übereinandergelegt
# (Stroboskop: der Ball hinterlässt eine Spur). Links ohne, rechts mit Nachdrall.
# Aufruf: python3 tests/n7_e2_bilder.py [quer|hoch]
import sys, os
sys.path.insert(0, 'tests')
from util import *
from PIL import Image
form = sys.argv[1] if len(sys.argv) > 1 else 'quer'
SETUP = """(() => { __game.newGame({bots: true, seed: 7}); __game.bots(false); const g = __game.game, R = g.rules; if (g.human < 0) g.setHuman(0); R.phase = 'play'; R.updateKeepers(0, true);
  const hx = g.cage.hx, me = g.players[g.human], kp = g.players[R.keeper[1]];
  g.players.forEach((p, i) => { if (p !== me) p.place(-6, (i % 3 - 1) * 3.5, 0); });
  kp.place(hx + 3, 6, Math.PI); // Tormann aus dem Bild (nur die Kurve zählt)
  me.place(hx - 16.45, 0.6, 0); g.ball.place(hx - 16, g.ball.r, 0.6); g.ball.v.set(0, 0, 0);
  me.kickAt({kind: 'shot', target: [hx, 0.9], technique: 'vollspann', speed: 24, elev: 6, noise: 0});
  return g.t; })()"""
rows = []
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, form)
    s.open('?nosw&seed=7&play&nohelp&q=1&action=0&replay=0&zeitlupe=0')
    s.ev("(() => { const st = document.createElement('style'); st.textContent = '#touch, .hud-top { display: none !important; }'; document.head.appendChild(st); })()")
    hx = s.ev("__game.game.cage.hx")
    for name, stick in [('ohne', None), ('links', (0, -1))]:
        s.ev("__game.input({wx: 0, wz: 0}, 0.3)")
        s.ev(SETUP); s.ev(f"__game.cam([{hx} - 14, 11, 0.6], [{hx} - 6.5, 0, 0.6])"); s.ev("__game.freezeWhen(\"g.events.some(e => e.type === 'kick')\")")
        s.pg.wait_for_function("__game.frozen()", timeout=60000)
        t0 = s.ev("__game.game.t")
        if stick: s.ev(f"__game.input({{wx: {stick[0]}, wz: {stick[1]}}}, 0.4)")
        paths = []
        for k, off in enumerate([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]):
            s.ev("__game.freeze(false)")
            s.ev(f"__game.freezeWhen('g.t >= {t0 + off}')"); s.pg.wait_for_function("__game.frozen()", timeout=60000)
            s.frames(3)
            b = s.ev("[__game.game.ball.p.x, __game.game.ball.p.y, __game.game.ball.p.z]")
            print(f"  {name} +{off:.2f} s: Ball {[round(x, 2) for x in b]}")
            paths.append(s.shot(f'nachdrall_{name}_{form}_{k}', 'n7'))
        nd = s.ev("__game.game.events.filter(e => e.type === 'nachdrall').map(e => e.side.toFixed(1))")
        s.ev("__game.freeze(false)")
        rows.append(paths)
    print('Fehler:', s.errors[:3])
    s.close()
from PIL import ImageChops
cols = []
for r in rows:
    im = Image.open(r[0]).convert('RGB')
    for p in r[1:]: im = ImageChops.lighter(im, Image.open(p).convert('RGB'))
    cols.append(im)
w, h = cols[0].size; sc = 0.6 if form == 'quer' else 0.45
tw, th = int(w * sc), int(h * sc)
col = Image.new('RGB', (tw * 2 + 8, th), (255, 255, 255))
for i, im in enumerate(cols): col.paste(im.resize((tw, th)), (i * (tw + 8), 0))
out = os.path.join(ROOT, 'tests', 'shots', 'n7', f'e2_nachdrall_{form}.jpg'); col.save(out, quality=85)
for r in rows:
    for p in r: os.remove(p)
print('Collage (links ohne, rechts Stick links):', out)
