# Leistungsvergleich unabhängig vom gedrosselten Headless-Bildtakt: Grafik-Kosten je Bild (Avatare, Rendern) und
# Simulation je Spieltakt getrennt; daraus die CPU-Zeit je Bild bei 60 fps (2 Takte à 120 Hz).
# Aufruf: python3 tests/perf_vergleich.py [repo-pfad]   (z. B. ein Worktree eines älteren Stands)
import sys, json, os
root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.getcwd()
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
os.chdir(root)
from util import *
rows = []
with Server(root) as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, (form, q) in enumerate([('hoch', 1), ('quer', 1), ('desktop', 2)]):
        if i: s.new_context(form)
        s.open(f'?nosw&gpu&seed=5&play&q={q}')
        s.ev("__game.human(-1)"); s.frames(10); s.wait_sim(1.0)
        s.ev("__game.perfReset()")
        f0, t0 = s.ev("__game.frames"), s.ev("__game.game.t")
        s.wait_sim(8.0, timeout=180000)
        f1, t1 = s.ev("__game.frames"), s.ev("__game.game.t")
        pf = s.ev("__game.perf()")
        steps_per_frame = (t1 - t0) / (1 / 120) / max(1, f1 - f0)
        sim_step = pf['simMs'] / steps_per_frame
        other = pf['frameCpuMs'] - pf['simMs']
        rows.append(dict(form=form, q=q, raf=pf['rafMs'], cpu=pf['frameCpuMs'], av=pf['avatarMs'], rd=pf['renderMs'], sim=pf['simMs'],
                         spf=steps_per_frame, simStep=sim_step, fps60=other + 2 * sim_step, gpu=pf['gpuMs']))
        print(json.dumps(rows[-1]), flush=True)
    s.close()
print('\n| Format | Stufe | Takte je Bild (headless) | Sim je Takt | Avatare je Bild | Rendern je Bild | CPU je Bild bei 60 fps | GPU je Bild |')
print('|---|---|---|---|---|---|---|---|')
for r in rows:
    print(f"| {r['form']} | {r['q']} | {r['spf']:.1f} | {r['simStep']:.3f} ms | {r['av']:.2f} ms | {r['rd']:.2f} ms | {r['fps60']:.2f} ms | {r['gpu']:.2f} ms |")
