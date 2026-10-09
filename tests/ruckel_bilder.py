# n5 Bilder zur Ruckel-Messung: (1) Kontaktabzug der Wiederholung rund um den Ballkontakt (Zeitlupe, angehalten in festen
# Schritten) vorher (?glatt=0&rcam=alt) / nachher, (2) Kurven aus den Rohdaten von tests/ruckel.py: Kamera-Lage und
# -Blick in der ersten Wiederholung sowie Fuß des Schützen um den Kontakt, vorher/nachher übereinander.
# Aufruf: py tests/ruckel_bilder.py [abzug] [kurven]   → tests/shots/fluessig/*.jpg|png
import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'tests', 'shots', 'fluessig_raw')
OUT = os.path.join(ROOT, 'tests', 'shots', 'fluessig')
os.makedirs(OUT, exist_ok=True)
teile = sys.argv[1:] or ['abzug', 'kurven']
VARIANTEN = [('vorher', '&glatt=0&rcam=alt', 'vorher (n4: ?glatt=0&rcam=alt)'), ('nachher', '', 'nachher (n5)')]


def abzug(form='quer'):
    from util import Server, Session, sync_playwright, ARGS
    import deko_scenes as S
    import ruckel as R
    if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
    schritte = [('aufbau', 0.55), ('aufbau', 0.8), ('aufbau', 0.95), ('kontakt', 0.25), ('kontakt', 0.4), ('kontakt', 0.48), ('kontakt', 0.56), ('kontakt', 0.64),
                ('kontakt', 0.8), ('fancam', 0.2), ('fancam', 0.5), ('fancam', 0.8)]
    with Server() as srv, sync_playwright() as pw:
        s = Session(pw, srv.base, form)
        for name, q, _ in VARIANTEN:
            S.open_ready(s, '?nosw&seed=3&q=2&nohelp&play&startprobe=0' + q)
            hx = s.ev("__game.game.cage.hx")
            s.ev("__game.freeze(false); __game.newGame(); __game.game.rules.phase = 'play'")
            sx, sz = R.TOR_SZENEN[0][1]; bx, bz = R.TOR_SZENEN[0][2]; vx, vz = R.TOR_SZENEN[0][3]
            s.ev("__game.replayHold(null); __game.bots(false); __game.human(1)")
            s.ev(f"__game.placePlayer({hx + sx}, {sz}, 0, 1); __game.placeBall({hx + bx}, 0.11, {bz}); __game.placePlayer({hx - 0.6}, {-2.6 if sz > 0 else 2.6}, Math.PI, 3);"
                 f" __game.placePlayer(-4, 4, 0, 4); __game.placePlayer(-4, -4, 0, 5); __game.placePlayer(-8, 0, 0, 0); __game.placePlayer({hx - 15}, {-3 if sz > 0 else 3}, 0, 2)")
            s.wait_sim(2.4)
            s.ev(f"__game.replayHold('{schritte[0][0]}', {schritte[0][1]})")
            s.ev(f"__game.kick({{from:[{hx + bx}, 0.11, {bz}], v:[{vx}, 0, {vz}], w:[0,0,0]}}); __game.game.lastTouch = 0")
            r = s.ev(R.ANLAUF_JS, [hx, 6, 0.9 if sz > 0 else -0.9])
            print(name, 'Tor' if r == 'tor' else 'kein Tor', r)
            d = os.path.join(RAW, f'{name}_{form}'); os.makedirs(d, exist_ok=True)
            segs = None
            for k, (ph, fr) in enumerate(schritte):
                s.ev(f"__game.replayHold('{ph}', {fr})")
                try: s.pg.wait_for_function(f"(() => {{ const r = __game.replay(); return r.held && r.phase === '{ph}'; }})()", timeout=20000)
                except Exception: print('  nicht erreicht', ph, fr); continue
                segs = s.ev("__game.replay().segs")
                s.frames(3)
                s.pg.screenshot(path=os.path.join(d, f'{k:02d}_{ph}_{fr}.png'))
            print('  Abschnitte', segs)
            s.ev("__game.replayHold(null)")
            s.pg.wait_for_function("!__game.replay().active", timeout=30000)
        s.close()
    collage(form, [f'{k:02d}_{ph}_{fr}' for k, (ph, fr) in enumerate(schritte)])


def collage(form, namen):
    from PIL import Image, ImageDraw, ImageFont
    fonts = ['C:/Windows/Fonts/arialbd.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
    fp = next((f for f in fonts if os.path.exists(f)), None)
    font = (lambda n: ImageFont.truetype(fp, n)) if fp else (lambda n: ImageFont.load_default())
    w = 300 if form == 'quer' else 160
    zeilen = []
    for name, _, titel in VARIANTEN:
        bilder = []
        for n in namen:
            p = os.path.join(RAW, f'{name}_{form}', n + '.png')
            if not os.path.exists(p): continue
            im = Image.open(p).convert('RGB'); im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            ImageDraw.Draw(im).text((6, 4), n.split('_', 1)[1].replace('_', ' '), font=font(13), fill='white')
            bilder.append(im)
        zeilen.append((titel, bilder))
    cols = 6
    h0 = max(im.height for _, b in zeilen for im in b)
    zeilenH = [(math.ceil(len(b) / cols)) * h0 for _, b in zeilen]
    C = Image.new('RGB', (cols * w, sum(zeilenH) + 34 * len(zeilen)), (18, 18, 18))
    dr = ImageDraw.Draw(C); y = 0
    for (titel, bilder), zh in zip(zeilen, zeilenH):
        dr.text((8, y + 6), titel, font=font(20), fill='white'); y += 34
        for i, im in enumerate(bilder): C.paste(im, ((i % cols) * w, y + (i // cols) * h0))
        y += zh
    p = os.path.join(OUT, f'abzug_replay_{form}.jpg'); C.save(p, quality=84); print(p)


def kurven(form='quer'):
    import numpy as np
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(3, 1, figsize=(10, 9))
    farben = {'vorher': '#c0392b', 'nachher': '#2471a3'}
    for name in ('vorher', 'nachher'):
        p = os.path.join(ROOT, 'tests', 'out', f'ruckel_{name}_{form}.json')
        if not os.path.exists(p): print('fehlt', p); continue
        d = json.load(open(p, encoding='utf-8'))
        n, S, K, NF = d['n'], d['stride'], d['kopf'], d['nf']
        B = np.array(d['buf']).reshape(n, S); t = B[:, 0] / 1000; ab = [d['abschnitte'][int(x)] for x in B[:, 9]]
        rep = [i for i, a in enumerate(ab) if a.startswith('r_')]
        if not rep: continue
        # erste Wiederholung: zusammenhängende Bilder ab dem ersten r_
        i0 = rep[0]; i1 = i0
        while i1 + 1 < n and ab[i1 + 1].startswith('r_'): i1 += 1
        tt = t[i0:i1 + 1] - t[i0]
        ax[0].plot(tt, B[i0:i1 + 1, 2], color=farben[name], label=f'{name}: Kamera x')
        ax[0].plot(tt, B[i0:i1 + 1, 4], color=farben[name], ls='--', label=f'{name}: Kamera z')
        yaw = np.degrees(np.unwrap(np.arctan2(B[i0:i1 + 1, 5], B[i0:i1 + 1, 7])))
        ax[1].plot(tt, yaw - yaw[0], color=farben[name], label=f'{name}: Blickrichtung')
        # Schütze = Orange 2 (Figur 1): Fuß rechts, vorwärts (Figuren-Raum) in der Wiederholung
        q = K + 1 * NF
        ax[2].plot(tt, B[i0:i1 + 1, q + 7 + 3 * 2 + 2] * 100, color=farben[name], label=f'{name}: rechter Fuß vor/zurück')
        ax[2].plot(tt, B[i0:i1 + 1, q + 7 + 3 * 1 + 2] * 100, color=farben[name], ls=':', label=f'{name}: linker Fuß')
        for k in range(i0 + 1, i1 + 1):
            if ab[k] != ab[k - 1]:
                for a in ax: a.axvline(t[k] - t[i0], color=farben[name], alpha=0.25)
    ax[0].set_ylabel('m'); ax[0].set_title('Wiederholung: Kamera-Lage (senkrechte Linien = Schnitte)')
    ax[1].set_ylabel('Grad'); ax[1].set_title('Kamera-Blickrichtung (seitlich)')
    ax[2].set_ylabel('cm'); ax[2].set_xlabel('Echtzeit der Wiederholung (s)'); ax[2].set_title('Schütze: Füße im Figuren-Raum (Sprünge = senkrechte Kanten)')
    for a in ax: a.legend(fontsize=7, loc='upper right'); a.grid(alpha=0.3)
    fig.tight_layout()
    p = os.path.join(OUT, f'kurven_replay_{form}.png'); fig.savefig(p, dpi=90); print(p)


if __name__ == '__main__':
    if 'abzug' in teile: abzug(os.environ.get('FORM', 'quer'))
    if 'kurven' in teile: kurven(os.environ.get('FORM', 'quer'))
