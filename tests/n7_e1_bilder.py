# n7 E1: Fotos Tormann – Handschuhe frisch (Energie 100) und müde (Energie 15), Blocken mit gespreizten Beinen außerhalb des
# Torraums, Stolpern nach einem Heber. Aufruf: python3 tests/n7_e1_bilder.py [quer|hoch]
import sys, os
sys.path.insert(0, 'tests')
from util import *
from PIL import Image
form = sys.argv[1] if len(sys.argv) > 1 else 'quer'
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, form)
    s.open('?nosw&seed=7&play&nohelp&q=1&action=0&replay=0&licht=abend')
    s.ev("(() => { const st = document.createElement('style'); st.textContent = '#touch, .hud-top { display: none !important; }'; document.head.appendChild(st); })()")
    s.ev("__game.newGame({bots: true, seed: 7}); __game.bots(false); const g = __game.game; g.rules.phase = 'play'; g.rules.updateKeepers(0, true)")
    paths = []
    for name, js in [
        ('frisch', "g.rules.energy[1] = 100; kp.place(g.cage.hx - 1.2, 0, Math.PI); kp.tech = ''; kp.block = 0"),
        ('muede', "g.rules.energy[1] = 15; kp.place(g.cage.hx - 1.2, 0, Math.PI); kp.tech = ''; kp.block = 0"),
        ('blocken', "g.rules.energy[1] = 100; kp.place(g.cage.hx - 5.2, 0.2, Math.PI); kp.block = 1; kp.tech = 'blocken'; kp.techT = 0.2"),
        ('stolpern', "kp.place(g.cage.hx - 2, 0, Math.PI); kp.block = 0; kp.tech = 'stolpern'; kp.techT = 0.2; kp.stumbleT = 0.6"),
    ]:
        s.ev("(() => { const g = __game.game, kp = g.players[g.rules.keeper[1]]; g.players.forEach((p) => { if (p !== kp) p.place(-6, p.z, 0); }); " + js + "; g.ball.place(g.cage.hx - 7, 0.11, 2); })()")
        kx = s.ev("__game.game.players[__game.game.rules.keeper[1]].x")
        s.ev(f"__game.cam([{kx} - 3.2, 1.4, 1.6], [{kx}, 0.9, 0])")
        s.frames(4); s.ev("__game.freeze(true)"); s.frames(4)  # (eingefroren werden die Figuren nicht aktualisiert)
        paths.append(s.shot('e1_' + name, 'n7')); s.ev("__game.freeze(false)")
    print('Fehler:', s.errors[:3])
    s.close()
ims = [Image.open(p).convert('RGB') for p in paths]
w, h = ims[0].size; sc = 0.45
col = Image.new('RGB', (int(w * sc) * 2, int(h * sc) * 2))
for i, im in enumerate(ims): col.paste(im.resize((int(w * sc), int(h * sc))), ((i % 2) * int(w * sc), (i // 2) * int(h * sc)))
out = os.path.join(ROOT, 'tests', 'shots', 'n7', f'e1_tormann_{form}.jpg'); col.save(out, quality=82)
for p in paths: os.remove(p)
print('Collage (frisch, müde, blocken, stolpern):', out)
