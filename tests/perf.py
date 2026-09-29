# Leistung (Gate: Frametime ≤ 16 ms, headless über Metal): je Format und Qualitätsstufe 6 s echtes 3-gegen-3-Spiel
# (6 animierte Rocketbox-Menschen, Bots spielen, Ton an), dann Mittel/p95 von Bildabstand (rAF), CPU-Zeit je Bild,
# GPU-Zeit (Timer-Query), Draw-Calls und Dreiecke. Aufruf: python3 tests/perf.py
import sys, time, json
sys.path.insert(0, 'tests')
from util import *
rows = []
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    first = True
    for form in ['hoch', 'quer', 'desktop']:
        for q in ([0, 1, 2] if form != 'desktop' else [1, 2]):
            if not first: s.new_context(form)
            first = False
            s.open(f'?nosw&gpu&seed=5&play&q={q}')
            s.ev("__game.human(-1)"); s.frames(10)
            s.wait_sim(1.0)
            s.ev("__game.perfReset()")
            f0, t0 = s.ev("__game.frames"), s.ev("__game.game.t")
            s.wait_sim(6.0, timeout=120000)
            f1, t1 = s.ev("__game.frames"), s.ev("__game.game.t")
            pf = s.ev("__game.perf()"); info = s.ev("__game.info()")
            spf = (t1 - t0) * 120 / max(1, f1 - f0)  # Spieltakte je Bild (headless gedrosselt: 6–12)
            rows.append(dict(form=form, q=q, **{k: pf[k] for k in ['rafMs', 'rafP95', 'frameCpuMs', 'frameCpuP95', 'gpuMs', 'gpuP95', 'gpuExt', 'n']},
                             calls=info['calls'], tris=info['triangles'], dpr=info['dpr'], size=info['size'], err=len(s.errors),
                             spf=spf, cpu60P95=pf['frameCpuP95'] - pf['simMs'] * (1 - 2 / max(2, spf))))
            print(json.dumps(rows[-1]), flush=True)
    s.close()
f = lambda v: '–' if v is None else f'{v:.1f}'
print('\n| Format | Stufe | Auflösung | Bildabstand Ø / p95 (ms) | CPU je Bild Ø / p95 (ms) | GPU je Bild Ø / p95 (ms) | Draw-Calls | Dreiecke |')
print('|---|---|---|---|---|---|---|---|')
for r in rows:
    print(f"| {r['form']} | {r['q']} | {r['size'][0]}×{r['size'][1]} (DPR {r['dpr']}) | {f(r['rafMs'])} / {f(r['rafP95'])} | {f(r['frameCpuMs'])} / {f(r['frameCpuP95'])} | {f(r['gpuMs'])} / {f(r['gpuP95'])} | {r['calls']} | {r['tris']:,} |".replace(',', '.'))
# Gate: Arbeit je Bild (CPU + GPU, jeweils p95) ≤ 16 ms, CPU auf 60 fps umgerechnet (2 Spieltakte je Bild statt der
# 6–12 Takte, die headless im gedrosselten Bildtakt anfallen). Der rAF-Abstand headless ist umgebungsbedingt
# gedrosselt (leere Seite ~25–30 Bilder/s) und wird nur mitprotokolliert.
print('Takte je Bild headless:', ', '.join(f"{r['form']} q{r['q']} {r['spf']:.1f}" for r in rows))
print('CPU p95 je Bild ungerechnet, schlechtester Fall:', f"{max(r['frameCpuP95'] or 0 for r in rows):.1f} ms")
worst = max((r['cpu60P95'] or 0) + (r['gpuP95'] or 0) for r in rows)
gate = all(r['gpuExt'] for r in rows) and worst <= 16
print(f'\nArbeit je Bild bei 60 fps (CPU p95 + GPU p95), schlechtester Fall: {worst:.1f} ms')
print('GATE Frametime ≤ 16 ms:', 'BESTANDEN' if gate else 'NICHT bestanden')
