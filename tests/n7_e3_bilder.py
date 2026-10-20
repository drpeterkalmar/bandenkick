# n7 E3: Bilder Traumpass – Pass von hinten auf einen freien Mitspieler vor dem Tor: goldener Ring unter dem Empfänger und
# goldene Ballspur, dann die Direktabnahme. 4 Bilder (0,15 / 0,3 / 0,45 s nach dem Pass, Schuss). Aufruf: python3 tests/n7_e3_bilder.py [quer|hoch]
import sys, os
sys.path.insert(0, 'tests')
from util import *
from PIL import Image
form = sys.argv[1] if len(sys.argv) > 1 else 'quer'
SETUP = """(() => { __game.newGame({bots: true, seed: 7}); __game.bots(false); const g = __game.game, R = g.rules; R.phase = 'play';
  const hx = g.cage.hx, P = g.players, mine = P.filter((p) => p.team === 0), opp = P.filter((p) => p.team === 1);
  mine[0].place(hx - 13.4, -1, 0); mine[1].place(hx - 5.8, 2.2, 0); mine[2].place(-hx + 1, 0, 0);
  opp[0].place(hx - 0.8, 0, Math.PI); opp[1].place(-4, -5, 0); opp[2].place(-4, 5, 0);
  g.ball.place(hx - 13, g.ball.r, -1); g.ball.v.set(0, 0, 0); R.updateKeepers(0, true);
  g.setHuman(mine[1].id); g.lastTouch = mine[0].id; g.lastTouchT = g.t;
  mine[0].kickAt({kind: 'pass', lead: true, to: mine[1].id, noise: 0});
  return g.t; })()"""
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, form)
    s.open('?nosw&seed=7&play&nohelp&q=1&action=0&replay=0&zeitlupe=0&perfektBot=1')
    s.ev("(() => { const st = document.createElement('style'); st.textContent = '#touch, .hud-top { display: none !important; }'; document.head.appendChild(st); })()")
    hx = s.ev("__game.game.cage.hx")
    s.ev(SETUP); s.ev(f"__game.cam([{hx} - 12, 6.5, -7.5], [{hx} - 7, 0.3, 0.8])")
    s.ev("__game.freezeWhen(\"g.events.some(e => e.type === 'perfektpass')\")")
    s.pg.wait_for_function("__game.frozen()", timeout=60000)
    t0 = s.ev("__game.game.t"); print('Traumpass:', s.ev("JSON.stringify(__game.game.perfekt)"))
    paths = []
    for k, off in enumerate([0.15, 0.3, 0.45]):
        s.ev("__game.freeze(false)"); s.ev(f"__game.freezeWhen('g.t >= {t0 + off}')"); s.pg.wait_for_function("__game.frozen()", timeout=60000)
        s.frames(3); paths.append(s.shot(f'traum_{form}_{k}', 'n7'))
    # Mensch steuert den Empfänger: Schuss antippen, Direktabnahme
    s.ev("__game.freeze(false)"); s.ev("__game.input({shotDown: true}, 0.08)")
    s.ev("__game.freezeWhen(\"g.events.some(e => e.type === 'kick' && e.kind === 'shot')\")")
    s.pg.wait_for_function("__game.frozen()", timeout=60000)
    print('Schuss:', s.ev("JSON.stringify(__game.game.events.filter(e => e.type === 'kick').map(e => ({perfekt: e.perfekt, speed: Math.round(e.speed * 3.6), q: e.q && +e.q.toFixed(2)})))"))
    s.ev("__game.freeze(false)"); s.ev(f"__game.freezeWhen('g.t >= {s.ev('__game.game.t')} + 0.12')"); s.pg.wait_for_function("__game.frozen()", timeout=60000)
    s.frames(3); paths.append(s.shot(f'traum_{form}_3', 'n7'))
    s.ev("__game.freeze(false)")
    print('Fehler:', s.errors[:3])
    s.close()
ims = [Image.open(p).convert('RGB') for p in paths]
w, h = ims[0].size; sc = 0.45 if form == 'quer' else 0.3
tw, th = int(w * sc), int(h * sc)
col = Image.new('RGB', (tw * 2, th * 2))
for i, im in enumerate(ims): col.paste(im.resize((tw, th)), ((i % 2) * tw, (i // 2) * th))
out = os.path.join(ROOT, 'tests', 'shots', 'n7', f'e3_traumpass_{form}.jpg'); col.save(out, quality=84)
for p in paths: os.remove(p)
print('Collage:', out)
