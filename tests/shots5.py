# Fotos Nacht 2d (hoch/quer): alle sechs Luftball-Techniken im Moment des Ballkontakts (Volley-Station, Skript-Spieler),
# CPU-Tormann im Hechtsprung gegen einen harten Schuss. Etappe 3 ergänzt die Tor-Wiederholung (Abschnitt „replay“).
# Aufruf: python3 tests/shots5.py [final] [teile…]  (teile: luft, hechten, replay; Standard alle)
#   → tests/shots/final/n2d_*.jpg (sonst tests/shots/dev)
import sys, json
sys.path.insert(0, 'tests')
from util import *
sub = sys.argv[1] if len(sys.argv) > 1 else 'dev'
parts = sys.argv[2:] or ['luft', 'hechten', 'replay']
TECHS = ['volley', 'kopf', 'seitfall', 'fallrueck', 'dropkick', 'flugkopf']

def freeze_at(s, cond, sec=90):
    s.ev(f"__game.freezeWhen({json.dumps(cond)})")
    t0 = s.ev("__game.game.t")
    try: s.pg.wait_for_function(f"__game.frozen() || __game.game.t > {t0 + sec}", timeout=int(sec / 0.3 * 1000))
    except Exception: pass
    s.frames(4)
    return s.ev("__game.frozen()")

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(os.environ.get('FORMS', 'hoch,quer').split(',')):
        if i or form != 'hoch': s.new_context(form)
        s.open('?nosw&seed=3&q=2&nohelp&play')
        res = {}
        if 'luft' in parts:
            # Volley-Station: Skript drückt im besten Moment; eingefroren im Moment des Kontakts (≤ 1 Takt davor).
            # Je Technik zwei Fotos: Spielkamera und Seitenkamera (5 m bzw. hoch 7,5 m quer zum Blick)
            todo = list(TECHS)
            s.ev("__game.challenge('volley')"); s.frames(3)
            s.ev("__game.autoplay(true)")
            for _ in range(30):
                if not todo: break
                if s.ev("__game.state().mode") == 'result':
                    s.ev("__game.autoplay(false); __game.challenge('volley')"); s.frames(3); s.ev("__game.autoplay(true)")
                cond = "g.players[0].air && g.players[0].air.go && " + json.dumps(todo) + ".includes(g.players[0].air.tech) && g.players[0].air.tc - g.t < 0.012"
                if not freeze_at(s, cond, 30): continue
                st = s.ev("(() => { const g = __game.game, p = g.players[0], b = g.ball, a = p.air;"
                          " const gx = g.cage.hx - b.p.x, gz = -b.p.z, gl = Math.hypot(gx, gz);"
                          " return { tech: a.tech, face_goal: +((Math.cos(p.face) * gx + Math.sin(p.face) * gz) / gl).toFixed(2), ball_h: +b.p.y.toFixed(2),"
                          " ball_vs_body: +(((b.p.x - p.x) * Math.cos(p.face) + (b.p.z - p.z) * Math.sin(p.face))).toFixed(2), x: p.x, z: p.z, f: p.face, b: [b.p.x, b.p.y, b.p.z] }; })()")
                tech = st['tech']; todo.remove(tech); k = TECHS.index(tech) + 1
                res[tech] = {kk: v for kk, v in st.items() if kk not in ('x', 'z', 'f', 'b')}
                print(s.shot(f'n2d_{form}_luft_{k}_{tech}', sub))
                import math
                sx, sz = -math.sin(st['f']), math.cos(st['f'])
                bx, by, bz = st['b']; mx, mz = (st['x'] + bx) / 2, (st['z'] + bz) / 2
                D = 5.0 if form == 'quer' else 7.5
                s.ev(f"__game.cam([{mx + sx * D}, 1.2, {mz + sz * D}], [{mx}, {max(0.9, by * 0.8)}, {mz}])"); s.frames(3)
                print(s.shot(f'n2d_{form}_luft_{k}_{tech}_seite', sub))
                s.ev("__game.cam(null); __game.freeze(false)")
            s.ev("__game.autoplay(false)")
        if 'hechten' in parts:
            # CPU-Tormann (Blau, rechtes Tor) hechtet gegen einen harten Eckschuss (35 m/s)
            s.open('?nosw&seed=3&q=2&nohelp&play')
            hx = s.ev("__game.game.cage.hx")
            s.ev("__game.freeze(false); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(true); __game.human(-1)")
            s.frames(3)
            s.ev(f"__game.placePlayer({hx - 1.0}, 0.3, Math.PI, 3); __game.placePlayer(-6, 5, 0, 4); __game.placePlayer(-6, -5, 0, 5); __game.placePlayer(-8, 0, 0, 0); __game.placePlayer(-4, 4, 0, 1); __game.placePlayer(-4, -4, 0, 2)")
            s.frames(2)
            s.ev(f"__game.kick({{from:[{hx - 9}, 0.3, 1.5], v:[33.5, 2.2, -9.2], w:[0,0,0]}}); __game.game.lastTouch = 0; __game.game.lastTouchT = __game.game.t")
            res['hechten'] = freeze_at(s, "g.players.some(p => p.team === 1 && p.hand.mode === 'dive' && p.hand.t > 0.12)", 3)
            print(s.shot(f'n2d_{form}_hechten', sub))
            # nah: vom Feld aus aufs Tor (Seitenkamera wie im Fernsehen)
            s.ev(f"__game.cam([{hx - 5.5}, 1.5, 3.2], [{hx - 0.6}, 0.7, -0.6])"); s.frames(3)
            print(s.shot(f'n2d_{form}_hechten_nah', sub))
            s.ev("__game.cam(null)")
            s.ev("__game.freeze(false)")
        if 'replay' in parts:
            # Tor-Wiederholung: Orange 2 (Mensch) schießt per Tipp aus 9 m ins Tor (Blau ohne Bots, Tormann zur Seite),
            # nach 1 s Live-Jubel läuft die Wiederholung; Fotos in jedem Abschnitt (angehalten), danach Anstoß
            s.open('?nosw&seed=3&q=2&nohelp&play')
            hx = s.ev("__game.game.cage.hx")
            s.ev("__game.freeze(false); __game.replayHold(null); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
            s.frames(3)
            s.ev(f"__game.placePlayer({hx - 9.4}, 1.2, -0.12, 1); __game.placeBall({hx - 9.0}, 0.11, 1.15); __game.placePlayer({hx - 0.6}, -2.6, Math.PI, 3);"
                 f" __game.placePlayer(-4, 4, 0, 4); __game.placePlayer(-4, -4, 0, 5); __game.placePlayer(-8, 0, 0, 0); __game.placePlayer(-3, 3, 0, 2)")
            s.frames(2)
            s.ev("__game.replayHold('aufbau', 0.75); __game.press([[0, 0.07, 'shot']], [1, -0.25], 0.3)")
            for k, (ph, fr) in enumerate([('aufbau', 0.75), ('kontakt', 0.55 if form == 'quer' else 0.62), ('flug', 0.5), ('fancam', 0.55)]):
                if k and ph not in s.ev("__game.replay().segs"): continue  # Flug fehlt bei sehr harten Schüssen
                s.ev(f"__game.replayHold('{ph}', {fr})")
                try: s.pg.wait_for_function(f"(() => {{ const r = __game.replay(); return r.held && r.phase === '{ph}'; }})()", timeout=20000)
                except Exception: print('  (Abschnitt nicht erreicht)', ph); continue
                s.frames(4)
                res['replay_' + ph] = s.ev("__game.replay()")
                print(s.shot(f'n2d_{form}_replay_{k + 1}_{ph}', sub))
            s.ev("__game.replayHold(null)")
            s.pg.wait_for_function("!__game.replay().active", timeout=20000)
            s.wait_sim(2.0, timeout=30000)
            res['nach_replay'] = s.ev("({ phase: __game.game.rules.phase, score: __game.game.score })")
        print(form, json.dumps(res, ensure_ascii=False))
    errs = s.errors + ['JSERR ' + e for e in s.ev('window.__errors')]
    print('Fehler:', errs[:5])
    s.close()
