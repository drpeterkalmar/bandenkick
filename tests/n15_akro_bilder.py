# n15 E5: je neuer Akrobatik-/Kampfsport-Technik eine Bildfolge (Absprung, kurz vor dem Kontakt, Kontakt) im Querformat → Collage
# tests/shots/n15/akro_<tech>.jpg und Übersicht akro_alle.jpg. Prüffrage (Vision): richtiges Körperteil am Ball? Bewegung erkennbar? Clipping?
# Aufruf: python3 tests/n15_akro_bilder.py [technik …]
import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'shots', 'n15'); RAW = os.path.join(ROOT, 'tests', 'shots', 'n15_raw')
os.makedirs(OUT, exist_ok=True); os.makedirs(RAW, exist_ok=True)
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
src = open(os.path.join(ROOT, 'src', 'sim', 'technique.js'), encoding='utf8').read()
import re
TECHS = {}
for m in re.finditer(r"  (\w+): \{ (?:prior: [0-9.]+, )?name: '([^']+)', teil: '([^']+)', h: \[([0-9., ]+)\].*?frame: '(\w+)'", src):
    h = [float(x) for x in m.group(4).split(',')]
    TECHS[m.group(1)] = dict(name=m.group(2), teil=m.group(3), h=(h[1] + h[2]) / 2 * 1.1, frame=m.group(5))
nur = sys.argv[1:]
res = []
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'quer')
    s.open('?nosw&nohelp&play&startprobe=0&q=2&seed=3&action=0&replay=0')
    for tech, T in TECHS.items():
        if nur and tech not in nur: continue
        bilder = []
        for versuch in range(3):
            s.ev("__game.freeze(false); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
            s.ev(f"window.BK_AIR_NUR = {tech!r}")
            s.ev("__game.placePlayer(2, 0, 0, 1); __game.placePlayer(-11, 0, 0, 0); __game.placePlayer(-6, -5, 0, 2); __game.placePlayer(11.5, 0, Math.PI, 3); __game.placePlayer(-8, 6, 0, 4); __game.placePlayer(-9, -6, 0, 5); __game.game.rules.updateKeepers(0, true)")
            src_pt = {'vor': (8.5, 3.5), 'seit': (2.6, 6.5), 'rueck': (-5.0, 1.2)}[T['frame']]
            Tf = 0.95 + 0.1 * versuch; g = 8.8; h0 = 0.4
            vx = (2.3 - src_pt[0]) / Tf; vz = (0 - src_pt[1]) / Tf; vy = (T['h'] - h0 + 0.5 * g * Tf * Tf) / Tf
            s.ev(f"__game.kick({{from: [{src_pt[0]}, {h0}, {src_pt[1]}], v: [{vx * 1.06:.3f}, {vy:.3f}, {vz * 1.06:.3f}]}})")
            s.ev("__game.press([[0.25, 0.32, 'shot']])")
            fr = []
            for cond, lab in [("g.players[1].air && g.players[1].air.go", 'Absprung'), (f"g.players[1].air && g.players[1].air.go && g.players[1].air.tc - g.t < 0.09", 'kurz davor'), (f"g.players[1].lastKick && g.players[1].lastKick.tech === {tech!r}", 'Kontakt')]:
                s.ev(f"__game.freezeWhen({cond!r})")
                try: s.pg.wait_for_function("__game.frozen()", timeout=6000)
                except Exception: s.ev("__game.freezeWhen('false')"); break
                # Nahaufnahme von der Seite (quer zur Blickrichtung), ganze Figur und Ball
                s.ev("(() => { const p = __game.game.players[1], b = __game.game.ball.p, cx = (p.x + b.x) / 2, cz = (p.z + b.z) / 2, nx = -Math.sin(p.face), nz = Math.cos(p.face); __game.cam([cx + nx * 3.6, 1.25, cz + nz * 3.6], [cx, 0.85 + (p.jumpY || 0) * 0.5, cz]); })()")
                s.frames(3)
                p = os.path.join(RAW, f'akro_{tech}_{len(fr)}.png'); s.pg.screenshot(path=p); fr.append((p, lab))
                s.ev("__game.cam(null); __game.freeze(false)")
            if len(fr) == 3: bilder = fr; break
        s.ev("window.BK_AIR_NUR = null")
        ok = len(bilder) == 3
        res.append({'tech': tech, 'name': T['name'], 'teil': T['teil'], 'ok': ok})
        print(tech, 'ok' if ok else 'NICHT ERREICHT', flush=True)
        if ok:
            ims = [Image.open(p).convert('RGB').resize((420, 189)) for p, _ in bilder]
            C = Image.new('RGB', (1260, 215), (14, 14, 16)); d = ImageDraw.Draw(C)
            d.text((6, 4), f"{T['name']} ({T['teil']})", fill='white')
            for i, (im, (_, lab)) in enumerate(zip(ims, bilder)): C.paste(im, (i * 420, 24)); d.text((i * 420 + 6, 26), lab, fill=(255, 230, 0))
            C.save(os.path.join(OUT, f'akro_{tech}.jpg'), quality=82)
json.dump(res, open(os.path.join(OUT, 'akro_bilder.json'), 'w'), ensure_ascii=False, indent=1)
