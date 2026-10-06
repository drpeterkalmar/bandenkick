# Feste Szenen für die Verschönerung (Deko): Fotos vorher/nachher und Leistungsmessung nutzen dieselben Abläufe.
# Jede Szene stellt einen wiederholbaren Zustand her (Seed, Bots, Platzierung) und hält ihn an bzw. lässt ihn laufen.
import json

DUEL = """() => { const G = __game; G.human(-1);
  for (let i = 0; i < 400; i++) {
    G.sim(0.05);
    const g = G.game, b = g.ball, bots = g.bots; if (!bots || b.held >= 0 || b.p.y > 0.4 || g.rules.phase !== 'play') continue;
    const own = bots.owner; if (own < 0) continue;
    const o = g.players[own];
    const opp = g.players.filter(p => p.team !== o.team && Math.hypot(p.x - o.x, p.z - o.z) < 1.3 && Math.hypot(p.x - b.p.x, p.z - b.p.z) < 1.4);
    if (opp.length && Math.abs(b.p.x) < 7.5) return { t: g.t, owner: own, opp: opp[0].id, ball: b.p.toArray() };
  } return null; }"""


def open_ready(s, q):
    """Seite öffnen und warten, bis die Deko fertig ist (Zuschauer werden kurz nach dem Start vorbereitet).
    Licht fest auf Tag, außer die Szene verlangt ?licht= (sonst hinge das Bild von der Uhrzeit ab)."""
    if 'licht=' not in q: q += '&licht=tag'
    s.open(q)
    s.pg.wait_for_function("!window.__game.deko || window.__game.deko.ready", timeout=60000)
    s.frames(3)


def hide_cards(s, on=True):
    s.ev(f"document.querySelectorAll('.overlay').forEach(o => o.style.visibility = {'\"hidden\"' if on else '\"\"'})")


def menu(s, extra=''):
    """Startbildschirm: Rundflug um den Käfig (Kamera wie beim ersten Öffnen)."""
    open_ready(s, f'?nosw&seed=7&q=1{extra}')
    s.ev("__game.gcam.menuT = 1.0")
    s.frames(6)


def kickoff(s, extra=''):
    open_ready(s, f'?nosw&seed=7&play&q=1&nohelp{extra}')
    s.wait_sim(0.4)
    s.ev("__game.freeze(true)"); s.frames(4)


def duel(s, extra=''):
    open_ready(s, f'?nosw&seed=7&play&q=1&nohelp{extra}')
    r = s.ev(DUEL)
    s.ev("__game.freeze(true)"); s.frames(4)
    return r


def goal_setup(s):
    """Orange (Mensch = Spieler 1) trifft rechts; Bots aus, damit niemand hält. Danach läuft die Simulation."""
    s.ev("__game.freeze(false); __game.replayHold(null); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
    s.frames(2)
    s.ev("__game.placePlayer(5.8, 1.6, 0, 1); __game.placePlayer(4.2, -1.8, 0, 2); __game.placePlayer(6.5, -0.4, Math.PI, 4); __game.placePlayer(9.6, 2.3, Math.PI, 3)")
    s.ev("__game.kick({from:[6.6, 0.2, 1.0], v:[16, 0.6, -0.3], w:[0,0,0]}); __game.game.rules.touch(__game.game.players[1])")


def jubel(s, extra=''):
    """Live-Jubel 0,75 s nach dem Tor (vor der Wiederholung)."""
    open_ready(s, f'?nosw&seed=7&play&q=1&nohelp{extra}')
    goal_setup(s)
    s.pg.wait_for_function("__game.game.rules.phase === 'goal'", timeout=30000)
    s.wait_sim(0.75)
    s.ev("__game.freeze(true)"); s.frames(4)


def replay_shots(s, shoot, extra=''):
    """Tor-Wiederholung: Schuss aus 9 m (Mensch Orange 2), angehalten im Aufbau (TV-Kamera) und in der Fan-Cam.
    shoot(name) wird in jedem Abschnitt aufgerufen."""
    open_ready(s, f'?nosw&seed=3&q=1&nohelp&play{extra}')
    hx = s.ev("__game.game.cage.hx")
    s.ev("__game.freeze(false); __game.replayHold(null); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
    s.frames(3)
    s.ev(f"__game.placePlayer({hx - 9.4}, 1.2, -0.12, 1); __game.placeBall({hx - 9.0}, 0.11, 1.15); __game.placePlayer({hx - 0.6}, -2.6, Math.PI, 3);"
         f" __game.placePlayer(-4, 4, 0, 4); __game.placePlayer(-4, -4, 0, 5); __game.placePlayer(-8, 0, 0, 0); __game.placePlayer(-3, 3, 0, 2)")
    s.frames(2)
    s.ev("__game.replayHold('aufbau', 0.75); __game.press([[0, 0.07, 'shot']], [1, -0.25], 0.3)")
    out = {}
    for k, (ph, fr) in enumerate([('aufbau', 0.75), ('kontakt', 0.6), ('fancam', 0.55)]):
        if k and ph not in (s.ev("__game.replay().segs") or []):
            continue
        s.ev(f"__game.replayHold('{ph}', {fr})")
        try:
            s.pg.wait_for_function(f"(() => {{ const r = __game.replay(); return r.held && r.phase === '{ph}'; }})()", timeout=30000)
        except Exception:
            print('  (Abschnitt nicht erreicht)', ph)
            continue
        s.frames(4)
        out[ph] = shoot('replay_' + ph)
    s.ev("__game.replayHold(null)")
    try:
        s.pg.wait_for_function("!__game.replay().active", timeout=30000)
    except Exception:
        pass
    return out


def training_result(s, extra=''):
    """Training Elfmeter mit Skript-Spieler bis zur Ergebniskarte (Erfolg mit Sternen)."""
    open_ready(s, f'?nosw&seed=5&q=1&nohelp{extra}')
    s.ev("__game.challenge('elfmeter')"); s.frames(3)
    s.ev("__game.autoplay(true)")
    s.pg.wait_for_function("__game.state().mode === 'result'", timeout=400000)
    s.frames(8)
    return s.ev("__game.lastResult")


def freeze_when(s, cond, timeout=15000):
    s.ev(f"__game.freezeWhen({cond!r})")
    try:
        s.pg.wait_for_function("__game.frozen()", timeout=timeout)
    except Exception:
        print('  (nicht eingefroren)', cond)
    s.frames(4)


def tor_konfetti(s, shoot, extra=''):
    """Tor ohne Wiederholung: Konfetti 0,6 s und 2,2 s nach dem Tor (Spiel läuft weiter)."""
    open_ready(s, f'?nosw&seed=7&play&q=1&nohelp&replay=0{extra}')
    goal_setup(s)
    s.pg.wait_for_function("__game.game.rules.phase === 'goal'", timeout=30000)
    s.wait_sim(0.6); shoot('08_konfetti_a')
    s.wait_sim(1.6); shoot('08_konfetti_b')


def schuss_spur(s, extra=''):
    """Harter Vollspann (Tipp) aus 9 m, angehalten, wenn der Ball ~5 m unterwegs ist (Ballspur)."""
    open_ready(s, f'?nosw&seed=3&q=1&nohelp&play&replay=0{extra}')
    hx = s.ev("__game.game.cage.hx")
    s.ev("__game.freeze(false); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
    s.frames(3)
    s.ev(f"__game.placePlayer({hx - 10.4}, 1.2, -0.12, 1); __game.placeBall({hx - 10.0}, 0.11, 1.15); __game.placePlayer({hx - 0.6}, -2.6, Math.PI, 3);"
         f" __game.placePlayer(-4, 4, 0, 4); __game.placePlayer(-4, -4, 0, 5); __game.placePlayer(-8, 0, 0, 0); __game.placePlayer(-3, 3, 0, 2)")
    s.frames(2)
    s.ev("__game.press([[0, 0.07, 'shot']], [1, -0.25], 0.3)")
    freeze_when(s, f"Math.hypot(g.ball.v.x, g.ball.v.z) > 25 && g.ball.p.x > {hx - 6.5}")


def graetsche(s, shoot, extra=''):
    """Grätsche: Orange 1 grätscht Blau 4 den Ball weg; Foto im Rutschen und 1,2 s später (Rutschspur)."""
    open_ready(s, f'?nosw&seed=11&play&q=1&nohelp{extra}')
    s.ev("__game.freeze(false); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false)")
    s.frames(3)
    s.ev("__game.human(1); __game.placePlayer(-2.2, 0.4, 0, 1); __game.placePlayer(0.4, 0.5, 0, 4); __game.placeBall(0.0, 0.11, 0.45); __game.game.lastTouch = 4; __game.press([[0, 0.07, 'shot']])")
    freeze_when(s, "g.players[1].slide && g.players[1].slide.phase === 'slide' && g.players[1].slide.t > 0.22")
    shoot('09_graetsche_a')
    s.ev("__game.freeze(false)"); s.wait_sim(1.2); s.ev("__game.freeze(true)"); s.frames(4)
    shoot('09_graetsche_b')
    s.ev("__game.freeze(false)")


def nummern(s, extra=''):
    """Rückennummern: Kamera hinter Orange 10 (Mensch) und Blau 11 beim Anstoß."""
    open_ready(s, f'?nosw&seed=7&play&q=1&nohelp{extra}')
    s.wait_sim(0.3); s.ev("__game.freeze(true)")
    p = s.ev("(() => { const a = __game.game.players[1], b = __game.game.players[4]; return [a.x, a.z, a.face, b.x, b.z, b.face]; })()")
    import math
    ax, az, af, bx, bz, bf = p
    s.ev(f"__game.cam([{ax - math.cos(af) * 2.3 + 0.4}, 1.55, {az - math.sin(af) * 2.3 - 0.6}], [{ax}, 1.15, {az}])"); s.frames(4)


def hechten(s, shoot, extra=''):
    """Auto-Torwart (Orange 0) hechtet; Foto bei der Landung (Rasenfetzen) und 1 s später (Spur)."""
    open_ready(s, f'?nosw&seed=11&play&q=1&nohelp&replay=0{extra}')
    hx = s.ev("__game.game.cage.hx")
    s.ev("__game.freeze(false); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false)")
    s.frames(3)
    s.ev(f"__game.bots(true); __game.human(0); __game.placePlayer({-hx + 1.0}, -0.6, 0, 0); __game.placePlayer(-2, 5, 0, 1); __game.placePlayer(-2, -5, 0, 2); __game.kick({{from:[{-hx + 9.5}, 0.3, -2], v:[-19.5, 1.6, 6.6], w:[0,0,0]}})")
    freeze_when(s, "g.players[0].hand.mode === 'ground' && g.players[0].hand.t > 0.06")
    shoot('12_hechten_a')
    s.ev("__game.freeze(false)"); s.wait_sim(0.9); s.ev("__game.freeze(true)"); s.frames(4)
    shoot('12_hechten_b')
    s.ev("__game.freeze(false)")
