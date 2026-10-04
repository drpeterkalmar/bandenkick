# Nacht 2e: Passsystem mit echten Touch-Ereignissen (CDP) wie am Handy, Pixel 7 hoch und quer, dazu Desktop-Lauf:
# 3 gegen 3 mit Bots, Stick in Bildschirm-Richtung des Mitspielers halten, Pass tippen, Daumen bleibt 1 s auf dem Stick
# (Kinderhand). Gezählt: Pass kommt beim gemeinten Mitspieler an (er berührt den Ball als Erster). Fotos: Vorschau-Ring
# beim Führen, Ring am Empfänger während der Ball rollt (tests/shots/final/n2e_*.jpg). Danach 3 min Spiel (1 min mit
# Grafik, 2 min Zeitraffer), Training und Tor-Wiederholung: 0 JS-Fehler, 0 Audio-Objekte.
# Aufruf: python3 tests/pass_touch.py [N je Format, Standard 12]
import sys, time, json, math
sys.path.insert(0, 'tests')
from util import *

N = int(sys.argv[1]) if len(sys.argv) > 1 else 12
fails = []
def ok(cond, msg):
    print(('  ✅ ' if cond else '  ❌ ') + msg, flush=True)
    if not cond: fails.append(msg)
def touch(cdp, typ, pts):
    cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in pts]})

HOOK = """(() => { const g = __game.game; if (g.__hooked) return; g.__hooked = true; const st = g.step.bind(g); window.__ev = [];
  g.step = (ins) => { const ev = st(ins); for (const e of ev) if (['kick','touch','control','catch','parry'].includes(e.type)) __ev.push({ type: e.type, player: e.player, kind: e.kind, to: e.to, t: g.t }); return ev; }; })()"""
# Lage k: Mensch (Orange Mitte, id 1) mit Ball, zwei Mitspieler, Gegner abseits des Passwegs; Ziel abwechselnd 0 / 2
SETUP = """(k) => { const g = __game.game, hx = g.cage.hx, hz = g.cage.hz; g.rules.phase = 'play'; g.rules.phaseT = 9;
  const L = [[-2, 0, 4, 3.5, 3, -3.5], [0, 2, 6, -1, -4, -3], [-4, -2, 2, 2.5, 3.5, -4.5], [2, 1, 8, 3, -3, 4], [-1, -3, 5, -4.5, 6, 2], [1, 3, -4, 4, 7, -1]][k % 6];
  const me = g.players[1]; me.place(L[0], L[1], 0); g.ball.place(L[0] + 0.4, 0.11, L[1]); g.ball.held = -1;
  g.players[0].place(L[2], L[3], 0); g.players[2].place(L[4], L[5], 0);
  const opp = [[hx - 1.5, 0], [0, hz - 1], [-hx + 6, -hz + 1]]; g.players.slice(3).forEach((o, i) => o.place(opp[i][0], opp[i][1], Math.PI));
  g.lastTouch = 1; g.lastTouchT = g.t; me.lastTouchT = g.t; g.rules.updateKeepers(0, true); g.passPlan = null; g.passTo = -1;
  __game.human(1); window.__ev = []; const want = k % 2 ? 2 : 0; const m = g.players[want];
  return { want, dx: m.x - g.ball.p.x, dz: m.z - g.ball.p.z }; }"""

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(['hoch', 'quer', 'desktop']):
        if i: s.new_context(form)
        print(form, flush=True)
        s.open('?nosw&seed=21&play&nohelp&q=' + ('2' if form == 'desktop' else '1'))
        W, H = s.ev("[innerWidth, innerHeight]")
        if form != 'desktop':
            cdp = s.ctx.new_cdp_session(s.pg)
            box = s.pg.locator('#bPass').bounding_box(); bx, by = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            sx0, sy0 = W * 0.22, H * 0.8
            hits, res = 0, []
            for k in range(N):
                s.ev(HOOK)
                sc = s.ev(SETUP, k)
                s.frames(2)
                ax = s.ev("(() => { const a = __game.gcam.groundAxes(); return [a.rx, a.rz, a.fx, a.fz]; })()")
                d = math.hypot(sc['dx'], sc['dz']); wx, wz = sc['dx'] / d, sc['dz'] / d
                u, v = wx * ax[0] + wz * ax[1], wx * ax[2] + wz * ax[3]; l = math.hypot(u, v) or 1
                tx, ty = sx0 + u / l * 45, sy0 - v / l * 45   # Stick 45 px Richtung Mitspieler (Bildschirm)
                touch(cdp, 'touchStart', [(0, (sx0, sy0))]); touch(cdp, 'touchMove', [(0, (tx, ty))])
                time.sleep(0.12)
                touch(cdp, 'touchStart', [(0, (tx, ty)), (1, (bx, by))]); time.sleep(0.06); touch(cdp, 'touchEnd', [(0, (tx, ty))])
                if k == 0:  # Foto: Ring am Empfänger, während der Ball rollt
                    try: s.pg.wait_for_function("__game.game.passPlan && __game.game.passPlan.to >= 0", timeout=4000); s.frames(4); s.shot(f'n2e_pass_unterwegs_{form}', 'final')
                    except Exception: pass
                t0 = s.ev("__game.game.t")
                s.pg.wait_for_function(f"__game.game.t > {t0 + 1.0}", timeout=30000)
                touch(cdp, 'touchEnd', [])
                try: s.pg.wait_for_function("(() => { const k = __ev.findIndex(e => e.type === 'kick' && e.player === 1); return k >= 0 && __ev.slice(k + 1).some(e => e.player !== 1); })()", timeout=8000)
                except Exception: pass
                ev = s.ev("__ev")
                kk = next((j for j, e in enumerate(ev) if e['type'] == 'kick' and e['player'] == 1), -1)
                nxt = next((e['player'] for e in ev[kk + 1:] if e['player'] != 1), None) if kk >= 0 else None
                res.append((sc['want'], ev[kk]['to'] if kk >= 0 else None, nxt))
                if nxt == sc['want']: hits += 1
            ok(hits >= math.ceil(N * 0.8), f'Touch: Stick zum Mitspieler + Pass tippen, Daumen bleibt 1 s drauf → kommt an {hits}/{N} (gemeint, gewählt, erster am Ball: {res})')
            # Foto: Vorschau-Ring beim Führen (Stick zum Mitspieler, noch nicht getippt)
            s.ev(HOOK); sc = s.ev(SETUP, 1); s.frames(2)
            ax = s.ev("(() => { const a = __game.gcam.groundAxes(); return [a.rx, a.rz, a.fx, a.fz]; })()")
            d = math.hypot(sc['dx'], sc['dz']); wx, wz = sc['dx'] / d, sc['dz'] / d
            u, v = wx * ax[0] + wz * ax[1], wx * ax[2] + wz * ax[3]; l = math.hypot(u, v) or 1
            touch(cdp, 'touchStart', [(0, (sx0, sy0))]); touch(cdp, 'touchMove', [(0, (sx0 + u / l * 20, sy0 - v / l * 20))])
            s.frames(6)
            vis = s.ev("(() => { const g = __game.game, r = __game.scene.children.find(o => o.geometry && o.geometry.type === 'RingGeometry' && o.geometry.parameters.innerRadius === 0.42); const m = g.players[%d]; return { ring: !!r && r.visible && Math.hypot(r.position.x - m.x, r.position.z - m.z) < 0.3 }; })()" % sc['want'])
            s.shot(f'n2e_pass_vorschau_{form}', 'final')
            touch(cdp, 'touchEnd', [])
            ok(vis['ring'], 'Vorschau-Ring am Mitspieler sichtbar, solange der Ball am Fuß ist')
        # 3 min Spiel: 1 min mit Grafik (Mensch ohne Eingabe), 2 min Zeitraffer, dann Tor-Wiederholung und Training
        s.ev("__game.newGame()"); s.frames(5)
        t0 = time.time()
        while time.time() - t0 < 60: time.sleep(5)
        s.ev("__game.sim(120)")
        s.frames(20)
        st = s.state()
        ok(st['faults'] == 0 and st['rules']['clock'] > 60, f"3 min Spiel: Uhr {st['rules']['clock']:.0f} s, Stand {st['score']}, Fehler {st['faults']}")
        s.ev("__game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)"); s.frames(2)
        hx = s.ev("__game.game.cage.hx")
        s.ev(f"__game.placePlayer({hx - 7.4}, 0.6, 0, 1); __game.placeBall({hx - 7.0}, 0.11, 0.6); __game.placePlayer({hx - 0.6}, -2.8, Math.PI, 3)"); s.frames(2)
        s.ev("__game.press([[0, 0.07, 'shot']], [1, -0.1], 0.3)")
        try: s.pg.wait_for_function("__game.replay().active", timeout=15000); seen = True
        except Exception: seen = False
        ok(seen, 'Tor-Wiederholung läuft')
        try: s.pg.wait_for_function("!__game.replay().active", timeout=20000)
        except Exception: pass
        s.ev("__game.bots(true); __game.challenge('doppelpass')"); s.frames(5)
        s.ev("__game.autoplay(true)"); s.wait_sim(8, timeout=120000); s.ev("__game.autoplay(false)")
        ok(s.ev("window.__audioCalls") == [], f"0 Audio-Objekte ({s.ev('window.__audioCalls')})")
        errs = s.errors + ['JSERR ' + e for e in s.ev('window.__errors')]
        ok(errs == [], f'0 JS-Fehler {errs[:3]}')
    s.close()
print('\nPASS-TOUCH', 'GRÜN' if not fails else f'ROT ({len(fails)})')
sys.exit(1 if fails else 0)
