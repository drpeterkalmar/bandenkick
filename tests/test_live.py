# Live-Prüfung gegen GitHub Pages: HTTP 200, Boot ohne Fehler (hoch + quer), Version = lokal, kurzer Spielablauf,
# PWA installierbar (keine Installability-Fehler), Service-Worker aktiv, offline neu laden.
# Aufruf: python3 tests/test_live.py [URL]
import sys, time, json, re, os, urllib.request
sys.path.insert(0, 'tests')
from util import *
URL = sys.argv[1] if len(sys.argv) > 1 else 'https://drpeterkalmar.github.io/bandenkick/'
local = re.search(r"'(\w+)'", open(os.path.join(ROOT, 'src', 'build.js')).read()).group(1)
fails = []
def ok(cond, msg):
    print(('  ✅ ' if cond else '  ❌ ') + msg, flush=True)
    if not cond: fails.append(msg)
r = urllib.request.urlopen(urllib.request.Request(URL, headers={'User-Agent': 'bandenkick-live-check'}), timeout=30)
ok(r.status == 200, f'HTTP {r.status} {URL}')
with sync_playwright() as pw:
    b = pw.chromium.launch(args=ARGS)
    for form in ['hoch', 'quer']:
        print(form)
        ctx = b.new_context(**DEVICES[form]); pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE ' + m.text) if m.type == 'error' else None)
        pg.goto(URL)
        pg.wait_for_function("window.__game && window.__game.ready && window.__game.frames > 3", timeout=90000)
        build = pg.evaluate("__game.build")
        ok(build == local, f'Version live {build} = lokal {local}')
        pg.evaluate("__game.start()")
        pg.evaluate("__game.placePlayer(-4, 0, 0); __game.placeBall(-3.6, 0.11, 0)")
        pg.evaluate("__game.input({wx: 1, wz: 0.1, shootHeld: true, cx: 0.5}, 0.6)")
        t0 = pg.evaluate("__game.game.t"); pg.wait_for_function(f"__game.game.t > {t0 + 1.2}", timeout=60000)
        lk = pg.evaluate("__game.state().lastKick")
        ok(lk is not None and lk['kind'] == 'shot', f"Schuss live: {lk and round(lk['speed'], 1)} m/s, Effet {lk and round(lk['sideRps'], 1)} U/s")
        pg.screenshot(path=os.path.join(ROOT, 'tests', 'shots', 'final', f'live_{form}.jpg'), type='jpeg', quality=82)
        if form == 'quer':
            cdp = ctx.new_cdp_session(pg)
            inst = cdp.send('Page.getInstallabilityErrors')
            ok(inst.get('installabilityErrors') == [], f"PWA installierbar {inst.get('installabilityErrors')}")
            sw = pg.evaluate("navigator.serviceWorker.ready.then(r => !!r.active)")
            ok(sw, 'Service-Worker aktiv')
            # alle Dateien im Cache? kurz warten, dann offline neu laden
            time.sleep(2)
            pg.reload()
            pg.wait_for_function("window.__game && window.__game.ready", timeout=60000)
            ctx.set_offline(True)
            pg.reload()
            try:
                pg.wait_for_function("window.__game && window.__game.ready && window.__game.frames > 3", timeout=60000)
                ok(True, 'offline neu geladen (aus dem Cache)')
            except Exception as e:
                ok(False, f'offline neu laden: {e}')
            ctx.set_offline(False)
        ok(errs == [], f'0 Fehler {errs[:3]}')
        ctx.close()
    b.close()
print('\nLIVE', 'GRÜN' if not fails else f'ROT ({len(fails)})')
sys.exit(1 if fails else 0)
