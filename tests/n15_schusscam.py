# n15 E3: Torschuss-Zeitlupe im Hoch- und Querformat (Bot gegen Bot, Action-Momente „oft“): je Form ≥ 6 Momente rund um einen Schuss
# (Schuss selbst oder Parade/Hechtsprung/Fang danach – seit n15 mit Rückblick auf den Schuss), je Moment 4 Bilder → Collage in tests/shots/n15/.
# Prüffrage (Vision): Schütze + Ball im Kontaktbild sichtbar? Ballflug sichtbar? Tormann erst danach?
# Aufruf: python3 tests/n15_schusscam.py [hoch|quer] [anzahl=6] [url-zusatz]
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import Server, Session, sync_playwright, ARGS
from action_bilder import collage
import action_bilder
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'shots', 'n15'); RAW = os.path.join(ROOT, 'tests', 'shots', 'n15_raw')
os.makedirs(OUT, exist_ok=True); os.makedirs(RAW, exist_ok=True)
action_bilder.OUT = OUT
if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
FORM = sys.argv[1] if len(sys.argv) > 1 else 'hoch'
ANZ = int(sys.argv[2]) if len(sys.argv) > 2 else 6
ZUSATZ = sys.argv[3] if len(sys.argv) > 3 else ''
ZEITEN = [0.12, 0.3, 0.5, 0.75]
SCHUSS = ('schuss', 'kreuzeck', 'vollspann', 'innenrist', 'aussenrist', 'volley', 'dropkick', 'fallrueck', 'seitfall', 'flugkopf', 'kopf', 'salto', 'ferse', 'traumpass', 'chip')
mess = {'form': FORM, 'momente': []}
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, FORM)
    s.open('?nosw&nohelp&play&startprobe=0&q=1&seed=3&action=2&replay=0' + ZUSATZ)
    s.ev("__game.newGame({bots: true, seed: 11}); __game.aktionZufall(0); __game.aktionStufe('oft')")
    n = 0; tries = 0
    while n < ANZ and tries < 40:
        tries += 1
        s.ev(f"__game.aktionHalt({ZEITEN[0]})")
        try: s.pg.wait_for_function("__game.aktion().aktiv", timeout=120000)
        except Exception: print('kein Moment mehr'); break
        info = s.ev("__game.aktion()")
        if not any(k in (info['grund'] or '') for k in SCHUSS):
            s.ev("__game.aktionHalt(null)"); s.pg.wait_for_function("!__game.aktion().aktiv", timeout=10000); continue
        bilder = []
        for j, z in enumerate(ZEITEN):
            s.ev(f"__game.aktionHalt({z})")
            s.pg.wait_for_function(f"__game.aktion().real >= {z} - 1e-6", timeout=10000)
            s.frames(3)
            p = os.path.join(RAW, f'{FORM}_{n}_{j}.png'); s.pg.screenshot(path=p)
            bilder.append((p, f"{z:.2f} s"))
        s.ev("__game.aktionHalt(null)")
        s.pg.wait_for_function("!__game.aktion().aktiv", timeout=10000)
        c = collage(f'schusscam_{FORM}_{n}', bilder, f"Schuss-Zeitlupe {n + 1}: {info['grund']} · {FORM}")
        mess['momente'].append({'grund': info['grund'], 'art': info['art'], 'collage': os.path.relpath(c, ROOT)})
        print(mess['momente'][-1], flush=True); n += 1
    print('Fehler', s.errors if hasattr(s, 'errors') else '')
json.dump(mess, open(os.path.join(OUT, f'schusscam_{FORM}.json'), 'w'), ensure_ascii=False, indent=1)
