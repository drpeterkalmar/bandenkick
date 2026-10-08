# Rauchtest im Browser (Pixel 7 hoch/quer, Desktop): Laden ohne Fehler, Spielstart, Führen, Pass, Schuss,
# Schüsse gegen Bande und ins Dachnetz (Ball bleibt im Käfig), Tor. Aufruf: python3 tests/smoke.py
import sys, time, json
sys.path.insert(0, 'tests')
from util import *
fails = []
def ok(cond, msg):
    print(('  ✅ ' if cond else '  ❌ ') + msg, flush=True)
    if not cond: fails.append(msg)

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, 'hoch')
    for i, form in enumerate(['hoch', 'quer', 'desktop']):
        if i: s.new_context(form)
        print(form)
        s.open('?nosw&solo=1&seed=11&q=' + ('2' if form == 'desktop' else '1'))
        ok(any(n in str(s.gl) for n in GPU_NAME), f'WebGL auf der GPU ({s.gl})')
        ok(s.boot_s < 15, f'Boot {s.boot_s:.1f} s')
        s.tap('[data-act="play"]')
        s.frames(3)
        # erster Start: Hilfekarte (Steuerung/Gesten), einmal bestätigen
        ok(s.state()['mode'] == 'help', 'Hilfekarte beim ersten Start')
        s.tap('[data-act="helpok"]')
        s.frames(5)
        st = s.state()
        ok(st['mode'] == 'play' and st['cam'] == ('hoch' if form == 'hoch' else 'quer'), f"Spiel läuft, Kamera {st['cam']}")
        # Führen
        s.ev("__game.placePlayer(-5, 0, 0); __game.placeBall(-4.6, 0.11, 0)")
        s.ev("__game.input({wx: 1, wz: 0}, 2.0)"); s.wait_sim(2.0)
        st = s.state()
        d = abs(st['ball']['p'][0] - st['player']['x'])
        ok(st['player']['x'] > -1.5 and d < 2.0, f"Führen: Spieler {st['player']['x']:.1f} m, Ball {d:.2f} m voraus")
        # Pass (Einzeltipp: nach dem Doppeltipp-Fenster von 0,25 s gespielt)
        s.ev("__game.input({pass: true}, 0.05)"); s.wait_sim(1.0)
        lk = s.state()['lastKick']
        ok(lk and lk['kind'] == 'pass', f"Pass: {lk and round(lk['speed'], 1)} m/s")
        # Nacht 2c: Schuss tippen = Vollspann (kaum Drall), doppeltippen = angeschnitten (Innen-/Außenrist mit Drall)
        s.ev("__game.placePlayer(-5, 1, 0); __game.placeBall(-4.6, 0.11, 1)")
        s.ev("__game.game.players[0].lastKick = null")
        s.ev("__game.press([[0, 0.07, 'shot']])")
        try: s.pg.wait_for_function("__game.state().lastKick && __game.state().lastKick.kind === 'shot'", timeout=15000)
        except Exception: pass
        lk = s.state()['lastKick']
        ok(lk and lk['kind'] == 'shot' and lk['tech'] == 'vollspann' and abs(lk['sideRps']) < 0.3, f"Schuss tippen = Vollspann: {lk and lk['tech']}, {lk and round(lk['speed'], 1)} m/s, {lk and round(lk['sideRps'], 2)} U/s")
        s.ev("__game.placePlayer(-5, 1, 0); __game.placeBall(-4.6, 0.11, 1)")
        s.ev("__game.game.players[0].lastKick = null")
        s.ev("__game.press([[0, 0.06, 'shot'], [0.14, 0.2, 'shot']])")
        try: s.pg.wait_for_function("__game.state().lastKick && __game.state().lastKick.kind === 'shot'", timeout=15000)
        except Exception: pass
        lk = s.state()['lastKick']
        ok(lk and lk['tech'] in ('innenrist', 'aussenrist') and abs(lk['sideRps']) > 4, f"Doppeltipp = angeschnitten: {lk and lk['tech']}, {lk and round(lk['sideRps'], 1)} U/s")
        # Bande und Dach: Ball bleibt im Käfig
        r = s.ev("__game.kick({from:[-2, 0.11, 0], v:[4, 3, 28], w:[0, 50, 0]}); __game.sim(3)")
        ev = [e['type'] for e in r['events']]
        ok('board' in ev and r['state']['faults'] == 0 and r['state']['state'] == 'play', f"Schuss 28 m/s gegen die Bande: {sorted(set(ev))}")
        z = r['state']['ball']['p'][2]
        ok(abs(z) < 6.5, f'Ball danach im Feld (z = {z:.2f} m)')
        r = s.ev("__game.kick({from:[0, 0.11, 0], v:[3, 29, -2], w:[0, 0, 0]}); __game.sim(4)")
        ev = [e['type'] for e in r['events']]
        tags = [e.get('tag') for e in r['events'] if e['type'] == 'net']
        ok('roof' in tags and r['state']['state'] == 'play' and r['state']['faults'] == 0, f"Schuss 29 m/s ins Dachnetz: Netz-Treffer {tags}, Zustand {r['state']['state']}")
        p = r['state']['ball']['p']
        ok(abs(p[0]) < 10 and abs(p[2]) < 6.5 and p[1] < 5.5, f'Ball danach im Käfig ({p[0]:.1f}, {p[1]:.2f}, {p[2]:.1f})')
        # Tor
        r = s.ev("__game.kick({from:[5, 0.11, 0], v:[20, 2, 0.4], w:[0, 0, 0]}); __game.sim(1.5)")
        ok(any(e['type'] == 'goal' for e in r['events']), 'Tor erkannt')
        s.wait_sim(0.3)
        s.shot(f'smoke_{form}', 'dev')
        info = s.ev("__game.info()")
        print('  info', json.dumps(info))
        ok(s.small_buttons() == [], f'Knöpfe ≥ 48 px, im Bild: {s.small_buttons()}')
        # ---- 3 gegen 3 (Standard) ----
        s.open('?nosw&seed=11&play&q=' + ('2' if form == 'desktop' else '1'))
        st = s.state()
        ok(st['match'] and st['avatars'] and len(st['players']) == 6, f"3 gegen 3 mit Rocketbox-Menschen: {len(st['players'])} Spieler, Avatare {st['avatars']}")
        ok(st['rules']['keeper'] == [0, 3], f"letzte Hand zum Anstoß: {st['rules']['keeper']}")
        s.ev("__game.human(-1)")
        b0 = st['ball']['p']
        s.wait_sim(6.0, timeout=120000)
        st = s.state()
        moved = abs(st['ball']['p'][0] - b0[0]) + abs(st['ball']['p'][2] - b0[2])
        roles = sorted(set(p['role'] for p in st['players']))
        ok(moved > 0.5 and st['rules']['phase'] in ('play', 'goal') and st['faults'] == 0, f"Bots spielen 6 s: Ball bewegt, Phase {st['rules']['phase']}, Rollen {roles}")
        # Tor → Jubel → Anstoß in der Mitte für die Mannschaft, die das Tor bekommen hat (Standard seit 30.09.)
        s.ev("__game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false)")
        s.ev("__game.kick({from:[__game.game.cage.hx - 3, 0.3, 0.4], v:[16, 0.5, 0], w:[0,0,0]})")  # 3 m vor dem Tor (Feldgröße egal)
        s.wait_sim(0.6)
        st = s.state()
        ok(st['score'] == [1, 0] and st['rules']['phase'] == 'goal', f"Tor Orange: {st['score']}, Phase {st['rules']['phase']}")
        s.ev("__game.bots(true)")
        s.wait_sim(2.6)
        st = s.state()
        kt = s.ev("__game.game.rules.kickoffTeam")
        ok(kt == 1 and st['ball']['held'] == -1 and st['rules']['phase'] in ('kickoff', 'play'), f"Anstoß nach Tor: Blau stößt an (Team {kt}, Ball frei {st['ball']['held']}, Phase {st['rules']['phase']})")
        # Nacht 2d: Tor-Wiederholung – Mensch schießt per Tipp ins leere Tor, 1 s Jubel, alle Abschnitte, dann Anstoß;
        # beim zweiten Tor überspringt ein Tipp die Wiederholung
        def goal_shot():
            hx = s.ev("__game.game.cage.hx")
            s.ev("__game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
            s.frames(2)
            s.ev(f"__game.placePlayer({hx - 7.4}, 0.6, 0, 1); __game.placeBall({hx - 7.0}, 0.11, 0.6); __game.placePlayer({hx - 0.6}, -2.8, Math.PI, 3)")
            s.frames(2)
            s.ev("__game.press([[0, 0.07, 'shot']], [1, -0.1], 0.3)")
        goal_shot()
        seen, t0 = [], time.time()
        while time.time() - t0 < 25:
            r = s.ev("__game.replay()")
            if r['active'] and (not seen or seen[-1] != r['phase']): seen.append(r['phase'])
            if seen and not r['active']: break
            time.sleep(0.05)
        s.wait_sim(2.2, timeout=60000)
        st = s.state()
        ok('kontakt' in seen and 'fancam' in seen and st['rules']['phase'] in ('kickoff', 'play') and st['score'] == [1, 0],
           f"Tor-Wiederholung: Abschnitte {seen} ({r.get('label', '')}), danach Phase {st['rules']['phase']}, Stand {st['score']}")
        goal_shot()
        s.pg.wait_for_function("__game.replay().active && __game.replay().real > 0.5", timeout=20000)
        box = s.pg.locator('#c').bounding_box()
        s.pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        time.sleep(0.4)
        ok(not s.ev("__game.replay().active"), 'Tor-Wiederholung: Tippen überspringt')
        # Mensch als letzte Hand mit Ball: Knöpfe werden Abwurf/Abschlag, Abwurf per Pass-Taste
        s.ev("__game.newGame(); __game.game.rules.phase = 'play'; __game.game.rules.giveKeeper(0)")
        s.frames(4)
        st = s.state()
        lbl = s.ev("document.querySelector('#bPass .pl').textContent + '/' + document.querySelector('#bShot .kw').textContent")
        ok(st['keeperMode'] == 'hold' and st['human'] == 0 and lbl == 'Abwurf/Abschlag', f"Tormann mit Ball gesteuert, Knöpfe {lbl}")
        s.ev("__game.input({pass: true}, 0.05)"); s.wait_sim(0.3)
        st = s.state()
        ok(st['ball']['held'] == -1, f"Abwurf per Pass-Taste: Ball frei ({st['ball']['held']})")
        # Nacht 2c: Auto-Torwart – Mensch als letzte Hand im Torraum hat keine Tormann-Knöpfe, fängt ohne Knopf
        s.ev("__game.newGame(); __game.game.rules.phase = 'play'; __game.placePlayer(-8.6, 0, 0, 0); __game.human(0)")
        r = s.ev("(() => { const g = __game.game; const kbox = []; __game.kick({from:[-3, 0.3, 0.3], v:[-15, 1.2, 0.35], w:[0,0,0]}); const out = __game.sim(0.9); return { ev: out.events.filter(e => e.type === 'catch' || e.type === 'parry' || e.type === 'goal').map(e => e.type + ':' + e.player), held: g.ball.held, kbox: document.body.classList.contains('kbox') }; })()")
        # (Nacht 2e: ohne Eingabe im Zeitraffer steuert die Tormann-Logik und wirft nach 0,3–0,7 s ab → Fang-Ereignis zählt)
        ok('catch:0' in r['ev'] and not r['kbox'], f"Auto-Torwart fängt ohne Knopf: {r['ev']}, keine grünen Knöpfe ({r['kbox']})")
        # Spielerwechsel per Taste (⇄ / C) in ruhiger Szene (Bots aus, Ball liegt)
        s.ev("__game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.placeBall(0, 0.11, 3)")
        s.wait_sim(0.7)
        h0 = s.state()['human']
        s.ev("__game.input({switch: true}, 0.05)"); s.wait_sim(0.3)
        h1 = s.state()['human']
        s.ev("__game.input({switch: true}, 0.05)"); s.wait_sim(0.3)
        h2 = s.state()['human']
        ok(h1 != h0 and h2 != h1 and all(s.state()['players'][h]['team'] == 0 for h in (h0, h1, h2)), f"Spielerwechsel per Taste: {h0} → {h1} → {h2} (nur Orange)")
        s.ev("__game.bots(true)")
        # Nacht 2e: kein Ton – im Menü, Spiel, Tor-Wiederholung, Training (Übung) und nach Taps kein Audio-Objekt
        s.tap('.iconbtn'); s.frames(2)
        ok(s.ev("document.querySelector('[data-act=\"sound\"]')") is None, 'Pause-Menü ohne Ton-Knopf')
        s.tap('.overlay.on [data-act="trainmenu"]'); s.tap('.overlay.on [data-act="challenge"][data-id="torwand"]'); s.tap('.overlay.on [data-act="chgo"]')
        s.frames(10); s.ev("__game.press([[0, 0.07, 'shot']])"); s.wait_sim(1.5)
        ac = s.ev("window.__audioCalls")
        ok(ac == [] and s.ev("__game.sound.ctx") is None and s.ev("document.querySelectorAll('audio').length") == 0, f'Ton aus: 0 Audio-Objekte in Menü, Spiel, Wiederholung, Training ({ac})')
        ok(s.small_buttons() == [], f'Knöpfe ≥ 48 px im Spiel: {s.small_buttons()}')
        ok(s.overlaps(['#bShot', '#bPass', '#bSprint', '#bSwitch', '.score', '.iconbtn']) == [], 'Knöpfe überlappen nicht')
        errs = s.errors + ['JSERR ' + e for e in s.ev('window.__errors')]
        ok(errs == [], f'0 Page-/Console-Fehler {errs[:3]}')
    s.close()
print('\nRAUCHTEST', 'GRÜN' if not fails else f'ROT ({len(fails)})')
sys.exit(1 if fails else 0)
