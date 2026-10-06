# Leistung vorher/nachher für die Verschönerung (Deko): Handy-Ansicht (Pixel 7), CPU 4× gedrosselt per CDP
# (Emulation.setCPUThrottlingRate). Headless liefert auf diesem Mac schon für eine leere Seite nur ~30 Bilder/s mit
# starken Schwankungen – deshalb läuft die Messung mit fester 60-fps-Taktung: eine virtuelle Uhr (performance.now)
# rückt je Bild genau 1/60 s vor, jedes Bild hat also dieselbe Arbeit wie am Handy bei 60 fps (2 Spieltakte).
# Gemessen je Bild mit der echten Uhr: CPU-Zeit der Spielschleife (p50/p95), dazu GPU-Zeit (Timer-Query des Spiels, ?gpu)
# und renderer.info. Der echte Bildabstand headless wird nur mitprotokolliert. Je Szene 600 Bilder = 10 s Spielzeit.
# Aufruf: python3 tests/deko_perf.py [repo-pfad] [url-zusatz] [szenen,…] [runden]
#   Vergleich alt/neu abwechselnd: REPOS="alt=/pfad/worktree,neu=." python3 tests/deko_perf.py . "" spiel_hoch 2
import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from util import *
import deko_scenes as S

RAF_HOOK = """(() => { const realNow = performance.now.bind(performance), raf = window.requestAnimationFrame.bind(window);
  const P = window.__pf = { on: false, virt: false, vt: 0, n: 0, iv: [], cpu: [], last: 0 };
  performance.now = () => (P.virt ? P.vt : realNow());
  P.setVirt = (on) => { if (on && !P.virt) P.vt = realNow(); P.virt = on; };
  // nur die Spielschleife (function frame) zählt und rückt die Uhr vor, nicht Abfrage-Callbacks der Tests
  window.requestAnimationFrame = (cb) => (cb.name !== 'frame' ? raf(cb) : raf((ts) => { const t0 = realNow(); if (P.virt) P.vt += 1000 / 60;
    cb(P.virt ? P.vt : ts); const t1 = realNow(); P.n++;
    if (P.on) { if (P.last) P.iv.push(t0 - P.last); P.cpu.push(t1 - t0); } P.last = t0; }));
})();"""

SCENES = {
    # name: (Format, URL, Vorbereitung)
    'spiel_hoch': ('hoch', '?nosw&gpu&seed=5&play&q=1&nohelp', 'bots'),
    'spiel_quer': ('quer', '?nosw&gpu&seed=5&play&q=1&nohelp', 'bots'),
    'tor_hoch': ('hoch', '?nosw&gpu&seed=7&play&q=1&nohelp', 'tor'),
    'tor_quer': ('quer', '?nosw&gpu&seed=7&play&q=1&nohelp', 'tor'),
    'menu_hoch': ('hoch', '?nosw&gpu&seed=5&q=1', 'menu'),
    'spiel_hoch_q0': ('hoch', '?nosw&gpu&seed=5&play&q=0&nohelp', 'bots'),
    'tor_hoch_q0': ('hoch', '?nosw&gpu&seed=7&play&q=0&nohelp', 'tor'),
    'tor_hoch_q0_ohnegpu': ('hoch', '?nosw&seed=7&play&q=0&nohelp', 'tor'),
    'tor_hoch_ohnegpu': ('hoch', '?nosw&seed=7&play&q=1&nohelp', 'tor'),
    'abend_spiel_hoch': ('hoch', '?nosw&gpu&seed=5&play&q=1&nohelp&licht=abend', 'bots'),
    'abend_tor_hoch': ('hoch', '?nosw&gpu&seed=7&play&q=1&nohelp&licht=abend', 'tor'),
    'abend_menu_hoch': ('hoch', '?nosw&gpu&seed=5&q=1&licht=abend', 'menu'),
    'abend_spiel_hoch_q0': ('hoch', '?nosw&gpu&seed=5&play&q=0&nohelp&licht=abend', 'bots'),
}
FRAMES = int(os.environ.get('BILDER', '600'))
RATE = float(os.environ.get('DROSSEL', '4'))
pct = lambda a, p: sorted(a)[min(len(a) - 1, int(len(a) * p))] if a else None


def wait_frames(s, n, timeout=300000):
    n0 = s.ev("window.__pf.n")
    s.pg.wait_for_function(f"window.__pf.n >= {n0 + n}", timeout=timeout, polling=100)


def measure(s, scene, extra):
    form, url, prep = SCENES[scene]
    s.new_context(form)
    s.ctx.add_init_script(RAF_HOOK)
    s.pg.close(); s.pg = s.ctx.new_page()
    s.errors = []
    s.pg.on("pageerror", lambda e: s.errors.append("PAGEERROR " + str(e)))
    s.open(url + extra + ('' if 'licht=' in url + extra else '&licht=tag'))
    s.pg.wait_for_function("!window.__game.deko || window.__game.deko.ready", timeout=60000, polling=100)
    if prep == 'bots':
        s.ev("__game.human(-1)")
    cdp = s.ctx.new_cdp_session(s.pg)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': RATE})
    s.ev("window.__pf.setVirt(true)")
    if prep == 'tor':
        S.goal_setup(s)
    wait_frames(s, 60)  # einschwingen (1 s Spielzeit)
    s.ev("__game.perfReset(); Object.assign(window.__pf, { iv: [], cpu: [], last: 0, on: true })")
    g0 = s.ev("__game.game.t"); t0 = time.time()
    wait_frames(s, FRAMES)
    pf = s.ev("(() => { window.__pf.on = false; return { iv: window.__pf.iv, cpu: window.__pf.cpu }; })()")
    real = time.time() - t0
    g1 = s.ev("__game.game.t")
    gp = s.ev("__game.perf()"); info = s.ev("__game.info()")
    rp = s.ev("__game.replay ? __game.replay().recCount : 0")
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    s.ev("window.__pf.setVirt(false)")
    errs = s.errors + ['JSERR ' + e for e in s.ev('window.__errors')]
    iv, cpu = pf['iv'], pf['cpu']
    return dict(scene=scene, n=len(cpu), real=round(real, 1), simS=round(g1 - g0, 2),
                cpu50=pct(cpu, 0.5), cpu95=pct(cpu, 0.95), cpuMean=sum(cpu) / max(1, len(cpu)),
                raf50=pct(iv, 0.5), raf95=pct(iv, 0.95),
                gpu=gp['gpuMs'], gpu95=gp['gpuP95'], calls=info['calls'], tris=info['triangles'], tex=info['textures'],
                geo=info['geometries'], prog=info['programs'], dpr=info['dpr'], err=errs[:3])


if __name__ == '__main__':
    repos = os.environ.get('REPOS')
    if repos:
        repos = [tuple(x.split('=', 1)) for x in repos.split(',')]
    else:
        repos = [('neu', os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.'))]
    extra = sys.argv[2] if len(sys.argv) > 2 else ''
    scenes = (sys.argv[3] if len(sys.argv) > 3 else 'spiel_hoch,spiel_quer,tor_hoch,menu_hoch,spiel_hoch_q0').split(',')
    rounds = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    rows = []
    with sync_playwright() as pw:
        servers = {name: Server(path).__enter__() for name, path in repos}
        s = Session(pw, list(servers.values())[0].base, 'hoch')
        try:
            for r in range(rounds):
                for sc in scenes:
                    for name, _ in (repos if r % 2 == 0 else repos[::-1]):
                        s.base = servers[name].base
                        row = measure(s, sc, os.environ.get('EXTRA_' + name.upper(), extra))
                        row['repo'] = name; row['round'] = r
                        rows.append(row)
                        print(json.dumps(row), flush=True)
        finally:
            s.close()
            for v in servers.values(): v.__exit__()
    f = lambda v: '–' if v is None else f'{v:.1f}'
    print(f'\n| Szene | Stand | Bilder | CPU je Bild p50 / p95 (ms, {RATE:g}× gedrosselt) | GPU je Bild Ø / p95 (ms) | Arbeit p95 (CPU+GPU) | Draw-Calls | Dreiecke | Texturen | Bildabstand headless p50 / p95 |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for r in rows:
        work = (r['cpu95'] or 0) + (r['gpu95'] or 0)
        print(f"| {r['scene']} | {r['repo']} | {r['n']} | {f(r['cpu50'])} / {f(r['cpu95'])} | {f(r['gpu'])} / {f(r['gpu95'])} | {work:.1f} | {r['calls']} | {r['tris']:,} | {r['tex']} | {f(r['raf50'])} / {f(r['raf95'])} |".replace(',', '.'))
    out = os.environ.get('JSON_OUT')
    if out:
        json.dump(rows, open(out, 'w'), indent=1)
