# n8 (Peter 26.10.: „Buttons größer machen“, „Spielerwechsel braucht keiner“): Knöpfe im 3 gegen 3 (Pixel 7 hoch und quer, dazu
# ein schmales Handy 375 px) – Größe, Lage (Abstand zur Ecke unten rechts = Daumenbogen), keine Überlappung (Rechtecke und Kreise
# mit Aufladering), nichts liegt auf dem Stick (Ruhelage und typische Daumenlagen), ⇄ nur mit ?wechsel=1. Fotos für die
# Sichtprüfung unter tests/shots/n8/. Aufruf: python3 tests/n8_hud.py [Zusatz-Query, z. B. "&wechsel=1"]
import sys, json
sys.path.insert(0, 'tests')
from util import *
q = sys.argv[1] if len(sys.argv) > 1 else ''
tag = 'wechsel' if 'wechsel=1' in q else 'neu'
SMALL = dict(PIXEL7_HOCH, viewport={"width": 375, "height": 740})
DEVICES['schmal'] = SMALL
bad = []
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(['hoch', 'quer', 'schmal']):
        if i: s.new_context(form)
        s.open('?nosw&seed=5&play&nohelp&q=1' + q)
        s.ev("document.body.classList.add('touch')")
        s.wait_sim(2.5, timeout=120000)
        lag = s.ev("""() => { const W = innerWidth, H = innerHeight, o = { W, H, knopf: {} };
          for (const id of ['bShot', 'bPass', 'bSwitch', 'bSprint']) { const e = document.getElementById(id); const r = e.getBoundingClientRect();
            if (getComputedStyle(e).display === 'none') { o.knopf[id] = 'aus'; continue; }
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            o.knopf[id] = { mitte: [Math.round(W - cx), Math.round(H - cy)], ecke: Math.round(Math.hypot(W - cx, H - cy)), d: Math.round(r.width), r: [r.left, r.top, r.right, r.bottom] }; }
          const z = document.querySelector('.stickzone').getBoundingClientRect(), b = document.querySelector('.stickbase').getBoundingClientRect();
          o.zone = [z.left, z.top, z.right, z.bottom]; o.base = [b.left, b.top, b.right, b.bottom];
          return o; }""")
        K = {k: v for k, v in lag['knopf'].items() if v != 'aus'}
        print(form, json.dumps({k: {kk: vv for kk, vv in v.items() if kk != 'r'} for k, v in K.items()}, ensure_ascii=False), '· aus:', [k for k, v in lag['knopf'].items() if v == 'aus'])
        ov = s.overlaps(['#bShot', '#bPass', '#bSprint', '#bSwitch', '.score', '.iconbtn', '.kickinfo'])
        # Kreise mit Aufladering (9 px): Abstand der Knopfränder
        ks = list(K.items()); gaps = []
        for a in range(len(ks)):
            for c in range(a + 1, len(ks)):
                (na, A), (nc, C) = ks[a], ks[c]
                ax, ay = (A['r'][0] + A['r'][2]) / 2, (A['r'][1] + A['r'][3]) / 2; cx, cy = (C['r'][0] + C['r'][2]) / 2, (C['r'][1] + C['r'][3]) / 2
                gaps.append((f'{na}–{nc}', round(((ax - cx) ** 2 + (ay - cy) ** 2) ** 0.5 - A['d'] / 2 - C['d'] / 2, 1)))
        # Stick: Ruhelage (Grundkreis) und Daumenlagen in der unteren linken Hälfte (Grundkreis 132 px um den Finger)
        W, H = lag['W'], lag['H']
        spots = [((lag['base'][0] + lag['base'][2]) / 2, (lag['base'][1] + lag['base'][3]) / 2)] + [(W * fx, H - dy) for fx in (0.15, 0.25, 0.35) for dy in (90, 160, 240)]
        hit = []
        for (x, y) in spots:
            for k, v in K.items():
                L, T, R, B = v['r']; nx, ny = max(L, min(R, x)), max(T, min(B, y))
                if ((nx - x) ** 2 + (ny - y) ** 2) ** 0.5 < 66: hit.append((k, round(x), round(y)))
        links = {k: round(max(0, W / 2 - v['r'][0]), 1) for k, v in K.items()}
        print('  Überlappung (Rechtecke):', ov, '· Abstand der Knopfränder:', gaps, '· Stick-Grundkreis berührt:', hit, '· in die linke Hälfte:', links, '· Fehler:', s.errors[:3])
        if ov: bad.append(f'{form}: Überlappung {ov}')
        if any(g < 18 for _, g in gaps): bad.append(f'{form}: Knöpfe zu nah {gaps}')
        if hit: bad.append(f'{form}: Knopf auf dem Stick {hit}')
        if s.errors: bad.append(f'{form}: Fehler {s.errors[:2]}')
        if 'wechsel=1' not in q and lag['knopf']['bSwitch'] != 'aus': bad.append(f'{form}: ⇄ sichtbar')
        if 'wechsel=1' in q and lag['knopf']['bSwitch'] == 'aus': bad.append(f'{form}: ⇄ fehlt mit ?wechsel=1')
        if K.get('bShot', {}).get('d', 0) < 128 or K.get('bPass', {}).get('d', 0) < 104: bad.append(f'{form}: Knöpfe zu klein')
        p = s.shot(f'hud_{tag}_{form}', 'n8'); from PIL import Image; im = Image.open(p).convert('RGB'); im.thumbnail((1100, 1100)); im.save(p[:-4] + '.jpg', quality=82); os.remove(p); print('  Foto:', p[:-4] + '.jpg')
    s.close()
print('OK' if not bad else 'FEHLER: ' + ' | '.join(bad))
sys.exit(1 if bad else 0)
