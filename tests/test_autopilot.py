# n4 E2 (Vorbau, noch nie gelaufen): Qualitäts-Autopilot im echten Browser – künstliche Last rauf und runter (Test-Haken
# __game.testLast = ms Arbeit je Bild), 3 gegen 3 nur mit Bots, Handy hochkant, kein ?q (Autopilot an). Vorlage:
# stuntbahn/tests/test_autopilot.py (n30). Geprüft:
#   0. Start: Stufe 1 (Touch), Startprobe aus (?startprobe=0)
#   1. ohne Last: in den ersten 10 s kein Schritt nach unten; ein starkes Gerät (Mac) kommt binnen 40 s auf Stufe 2
#   2. schwere Last: erster Schritt nach unten in ≤ 3 s, zuerst die Renderskala
#   3. Last weg: erster Schritt nach oben in ≤ 3 s, danach wieder volle Qualität (Stufe 2, Deko/Menschen-Schatten an)
#   4. Last an der Kante: kein Pendeln (≤ 3 Richtungswechsel in 40 s)
#   5. 0 Fehler
# Browser per `open` + CDP (perf_gate.OffenerBrowser), MIT 60-Hz-Deckel – sonst drosselt macOS die Zeitgeber einer
# Hintergrund-Queue auf ~15 Bilder/s und der Autopilot sähe nur Ruckeln. Aufruf: python3 tests/test_autopilot.py
import os, sys, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import perf_gate as PG
from playwright.sync_api import sync_playwright

fails = []
def check(c, m):
    print(('OK   ' if c else 'FEHLER ') + m, flush=True)
    if not c: fails.append(m)

Q = '?nosw&startprobe=0&seed=5&play&nohelp&licht=tag'
ZUSTAND = "(() => { const a = __game.info().auto; return { t: performance.now() / 1000, ap: a.autopilot, log: a.log || [] }; })()"

def warte_log(pg, bed, max_s):
    # wartet, bis ein neuer Log-Eintrag die Bedingung erfüllt; liefert (Eintrag, Wartezeit in s) oder (None, max_s)
    t0 = pg.evaluate("performance.now() / 1000")
    n0 = pg.evaluate(ZUSTAND)['ap']['aenderungen']
    while True:
        z = pg.evaluate(ZUSTAND)
        if z['ap']['aenderungen'] > n0:
            neu = z['log'][-(z['ap']['aenderungen'] - n0):]
            for e in neu:
                if bed(e): return e, z['t'] - t0
            n0 = z['ap']['aenderungen']
        if z['t'] - t0 > max_s: return None, max_s
        time.sleep(0.1)

def voll(z):
    ap = z['ap']
    return ap['level'] == 2 and ap['deko'] and ap['menschenschatten'] and ap['skala'] >= ap['bereich'][1] - 1e-6

with PG.Server(PG.REPO) as srv, sync_playwright() as pw:
    b = PG.OffenerBrowser(pw, PG.GPU_ARGS) if PG.START == 'open' else pw.chromium.launch(args=PG.GPU_ARGS)
    try:
        ctx = b.new_context(**PG.profil('hoch', 2.6))
        pg = ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
        pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' else None)
        pg.goto(srv.base + 'index.html' + Q)
        pg.wait_for_function("window.__game && window.__game.ready && window.__game.frames > 3", timeout=120000)
        pg.wait_for_function("!__game.deko || __game.deko.ready", timeout=60000)
        pg.evaluate("__game.human(-1)")
        z0 = pg.evaluate(ZUSTAND)
        check(z0['ap'] is not None and z0['ap']['level'] == 1, f"Start mit Autopilot auf Stufe 1 (Touch): {json.dumps(z0['ap'], ensure_ascii=False)}")
        # 1. ohne Last
        time.sleep(10)
        z = pg.evaluate(ZUSTAND)
        runter = [e for e in z['log'] if e['richtung'] < 0]
        check(not runter, f"ohne Last 10 s: kein Schritt nach unten ({runter[:3]}), {z['ap']['fps']} fps, Stufe {z['ap']['level']}, Arbeit {z['ap']['arbeit']} ms")
        t0 = time.time()
        while time.time() - t0 < 40 and pg.evaluate(ZUSTAND)['ap']['level'] < 2: time.sleep(0.5)
        z = pg.evaluate(ZUSTAND)
        check(z['ap']['level'] == 2, f"starkes Gerät: Stufe 2 nach {10 + time.time() - t0:.1f} s (Skala {z['ap']['skala']}, Engpass {z['ap']['engpass']})")
        # 2. schwere Last (45 ms je Bild ≈ 20 Bilder/s)
        pg.evaluate("__game.testLast = 45")
        e, dt = warte_log(pg, lambda e: e['richtung'] < 0, 8)
        check(e is not None and dt <= 3.0, f'schwere Last: erster Schritt nach unten nach {dt:.2f} s ({e})')
        time.sleep(20)
        z = pg.evaluate(ZUSTAND)
        print('  nach 20 s Last:', json.dumps(z['ap']['stufen']), 'Skala', z['ap']['skala'], 'Engpass', z['ap']['engpass'], 'Stufe', z['ap']['level'], flush=True)
        # 3. Last weg
        pg.evaluate("__game.testLast = 0")
        e, dt = warte_log(pg, lambda e: e['richtung'] > 0, 8)
        check(e is not None and dt <= 3.0, f'Last weg: erster Schritt nach oben nach {dt:.2f} s ({e})')
        t0 = time.time()
        while time.time() - t0 < 90 and not voll(pg.evaluate(ZUSTAND)): time.sleep(0.5)
        z = pg.evaluate(ZUSTAND)
        check(voll(z), f"wieder volle Qualität nach {time.time() - t0:.1f} s: Stufe {z['ap']['level']}, {z['ap']['stufen']}, Skala {z['ap']['skala']}")
        # 4. Kante: Last so, dass das Bild knapp an 60 Bildern/s liegt (am Gerät anpassen: Arbeit + Last ≈ 15–16 ms)
        pg.evaluate("__game.testLast = 11")
        time.sleep(5)
        n0 = pg.evaluate(ZUSTAND)['ap']['aenderungen']
        time.sleep(40)
        z = pg.evaluate(ZUSTAND)
        n = z['ap']['aenderungen'] - n0
        log = z['log'][-n:] if n else []
        richt = [e['richtung'] for e in log]
        wechsel = sum(1 for a, c in zip(richt, richt[1:]) if a != c)
        check(wechsel <= 3, f"Kante (11 ms Last), 40 s: {n} Änderungen, {wechsel} Richtungswechsel: {[(e['was'], e['richtung']) for e in log]}")
        pg.evaluate("__game.testLast = 0")
        errors += ['JSERR ' + x for x in pg.evaluate("window.__errors")]
        check(not errors, f'0 Fehler ({errors[:3]})')
        ctx.close()
    finally:
        b.close()

print(f'\n{len(fails)} FEHLER' if fails else '\nAutopilot-Test OK')
sys.exit(1 if fails else 0)
