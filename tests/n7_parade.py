# n7 Etappe 0: Bildfolge einer Parade (Abklatschen bzw. Fausten) im Browser – Bot-Tormann Blau, scharfer Schuss, Bilder um den
# Kontakt herum (Simulation wird je Bild angehalten), Collage für die Sichtprüfung. Aufruf: python3 tests/n7_parade.py [hoch|quer] [flach|hoch]
import sys, json, os
sys.path.insert(0, 'tests')
from util import *
from PIL import Image
form = sys.argv[1] if len(sys.argv) > 1 else 'quer'
art = sys.argv[2] if len(sys.argv) > 2 else 'flach'
Y, Z = (1.95, 0.35) if art == 'hoch' else (0.9, 0.45)
SETUP = f"""(() => {{ __game.newGame({{bots: true, seed: 7}}); const g = __game.game, R = g.rules; R.phase = 'play'; R.updateKeepers(0, true);
  const hx = g.cage.hx, kp = g.players[R.keeper[1]];
  g.players.forEach((p, i) => {{ if (p !== kp) p.place(-4 - i, (i % 3 - 1) * 3, 0); }}); kp.place(hx - 1.1, 0, Math.PI);
  __game.kick({{from: [hx - 9, 0.35, -1.0], v: [21.5, 0, 0], w: [0, 0, 0]}});
  const b = g.ball; const dz = ({Z} - (-1.0)), t = 9 / 21.5; b.v.set(21.5, ({Y} - 0.35 + 4.9 * t * t) / t, dz / t);
  return g.t; }})()"""
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, form)
    s.open('?nosw&seed=7&play&nohelp&q=1&action=0&replay=0&zeitlupe=0')
    s.ev("__game.cam([__game.game.cage.hx - 4.2, 1.5, 3.4], [__game.game.cage.hx - 1.3, 1.05, -0.2])")
    s.ev("(() => { const st = document.createElement('style'); st.textContent = '#touch, .hud-top { display: none !important; }'; document.head.appendChild(st); })()")
    # 1) Parade-Zeitpunkt finden (deterministisch: gleiches Setup)
    s.ev(SETUP); s.ev("__game.freezeWhen(\"g.events.some(e => e.type === 'parry' || e.type === 'catch' || e.type === 'goal')\")")
    s.pg.wait_for_function("__game.frozen()", timeout=60000)
    tP = s.ev("__game.game.t"); ev = s.ev("__game.game.events.map(e => e.type + (e.high ? '(hoch)' : '') + (e.speed ? ' ' + e.speed.toFixed(1) : ''))")
    t0 = s.ev(SETUP); s.ev("__game.freeze(false)")
    print('Kontakt bei', round(tP - t0, 3), 's nach dem Schuss:', ev)
    paths = []
    for k, off in enumerate([-0.12, -0.04, 0.0, 0.06, 0.14, 0.24, 0.4, 0.6]):
        if k: s.ev("__game.freeze(false)")
        s.ev(f"__game.freezeWhen('g.t >= {t0 + (tP - t0) + off}')"); s.pg.wait_for_function("__game.frozen()", timeout=60000)
        s.frames(3)
        st = s.ev("(() => { const g = __game.game, kp = g.players[g.rules.keeper[1]]; return {t: g.t, tech: kp.tech, techT: kp.techT, hand: kp.hand.mode, b: [g.ball.p.x, g.ball.p.y, g.ball.p.z], v: [g.ball.v.x, g.ball.v.z]}; })()")
        print(f"  {off:+.2f} s: Tormann {st['tech']} ({st['techT']:.2f} s) {st['hand']}, Ball {[round(x, 2) for x in st['b']]} v {[round(x, 1) for x in st['v']]}")
        paths.append(s.shot(f'parade_{art}_{form}_{k}', 'n7'))
    s.ev("__game.freeze(false)")
    print('Fehler:', s.errors[:3])
    s.close()
ims = [Image.open(p) for p in paths]
w, h = ims[0].size; sc = 0.42 if form == 'quer' else 0.3
tw, th = int(w * sc), int(h * sc)
col = Image.new('RGB', (tw * 4, th * 2))
for i, im in enumerate(ims): col.paste(im.convert('RGB').resize((tw, th)), ((i % 4) * tw, (i // 4) * th))
out = os.path.join(ROOT, 'tests', 'shots', 'n7', f'parade_{art}_{form}.jpg'); col.save(out, quality=82)
for p in paths: os.remove(p)
print('Collage:', out)
