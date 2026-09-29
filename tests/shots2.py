# Fotos Nacht 2 (3 gegen 3): Anstoß, Zweikampf, Tormann mit Ball im Torraum, Hechtsprung, Tor-Jubel, Pause –
# Handy hoch/quer und Desktop. Feste Szenen (Seed, Bots zeitweise aus), damit die Fotos wiederholbar sind.
# Aufruf: python3 tests/shots2.py [unterordner] [formate…]   (Standard: final, hoch quer desktop)
import sys, time, json
sys.path.insert(0, 'tests')
from util import *
sub = sys.argv[1] if len(sys.argv) > 1 else 'final'
forms = sys.argv[2:] or ['hoch', 'quer', 'desktop']

DUEL = """() => { const G = __game; G.human(-1);
  for (let i = 0; i < 400; i++) {
    G.sim(0.05);
    const g = G.game, b = g.ball, bots = g.bots; if (!bots || b.held >= 0 || b.p.y > 0.4 || g.rules.phase !== 'play') continue;
    const own = bots.owner; if (own < 0) continue;
    const o = g.players[own];
    const opp = g.players.filter(p => p.team !== o.team && Math.hypot(p.x - o.x, p.z - o.z) < 1.3 && Math.hypot(p.x - b.p.x, p.z - b.p.z) < 1.4);
    if (opp.length && Math.abs(b.p.x) < 7.5) return { t: g.t, owner: own, opp: opp[0].id, ball: b.p.toArray() };
  } return null; }"""

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, forms[0])
    for i, f in enumerate(forms):
        if i: s.new_context(f)
        q = '2' if f == 'desktop' else '1'
        # 1) Anstoß
        s.open(f'?nosw&seed=7&play&q={q}')
        s.wait_sim(0.4)
        s.ev("__game.freeze(true)"); s.frames(4)
        s.shot(f'n2_{f}_01_anstoss', sub)
        s.ev("__game.freeze(false)")
        # 2) Zweikampf aus dem Bot-Spiel
        duel = s.ev(DUEL)
        s.ev("__game.freeze(true)"); s.frames(4)
        s.shot(f'n2_{f}_02_zweikampf', sub)
        s.ev("__game.freeze(false)")
        # 3) Tormann (Orange, gesteuert) mit Ball im Torraum: Knöpfe werden Abwurf/Abschlag
        s.ev("__game.newGame(); __game.game.rules.phase = 'play'")
        s.ev("__game.placePlayer(-3, -2, 0, 4); __game.placePlayer(-2, 2.5, 0, 5); __game.placePlayer(-5.2, 3, 0, 2)")
        s.ev("__game.game.rules.giveKeeper(0)")
        s.wait_sim(0.6)
        s.ev("__game.freeze(true)"); s.frames(4)
        s.shot(f'n2_{f}_03_tormann_ball', sub)
        km = s.state()['keeperMode']
        s.ev("__game.freeze(false)")
        # 4) Hechtsprung: Schuss ins lange Eck, Mensch (Tormann Orange) hechtet
        s.ev("__game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false)")
        s.ev("__game.placePlayer(-8.9, -0.3, 0, 0); __game.human(0); __game.placePlayer(-3, 3, Math.PI, 4)")
        s.ev("__game.kick({from:[-4, 0.3, 0.6], v:[-13, 1.2, 1.6], w:[0,0,0]})")
        s.ev("__game.input({wx: 0.15, wz: 1, pass: true}, 0.05)")
        s.wait_sim(0.26)
        s.ev("__game.freeze(true)"); s.frames(4)
        s.shot(f'n2_{f}_04_hechtsprung', sub)
        dive = s.state()['players'][0]['hand']
        s.ev("__game.freeze(false)")
        # 5) Tor-Jubel: Orange trifft (Bots aus, damit niemand hält)
        s.ev("__game.newGame(); __game.game.rules.phase = 'play'; __game.bots(false)")
        s.ev("__game.placePlayer(5.8, 1.6, 0, 1); __game.placePlayer(4.2, -1.8, 0, 2); __game.placePlayer(6.5, -0.4, Math.PI, 4); __game.placePlayer(9.6, 2.3, Math.PI, 3)")
        s.ev("__game.kick({from:[6.6, 0.2, 1.0], v:[16, 0.6, -0.3], w:[0,0,0]}); __game.game.rules.touch(__game.game.players[1])")
        s.wait_sim(1.1)
        s.ev("__game.freeze(true)"); s.frames(4)
        s.shot(f'n2_{f}_05_torjubel', sub)
        st = s.state()
        # Nahaufnahme Jubel (Kamera vor den Torschützen)
        pj = st['players'][1]
        s.ev(f"__game.cam([{pj['x'] - 3.2}, 1.6, {pj['z'] + 2.2}], [{pj['x'] + 0.4}, 1.05, {pj['z'] - 0.8}])"); s.frames(20)
        s.shot(f'n2_{f}_07_jubel_nah', sub)
        s.ev("__game.cam(null)")
        s.ev("__game.freeze(false)")
        # 6) Pause-Menü (hoch/quer)
        if f != 'desktop':
            s.ev("document.querySelector('.iconbtn').click()"); s.frames(3)
            s.shot(f'n2_{f}_06_pause', sub)
            s.ev("document.querySelector('[data-act=resume]').click()")
        info = s.ev("__game.info()")
        print(f, 'Zweikampf', json.dumps(duel), '| Tormann-Knöpfe', km, '| Hechten', dive, '| Tor', st['score'], st['rules']['phase'])
        print('  info', json.dumps({k: info[k] for k in ['calls', 'triangles', 'dpr', 'size', 'shadows']}))
        print('  small buttons', s.small_buttons())
        print('  overlaps', s.overlaps(['#bShot', '#bPass', '#bSprint', '#bSwitch', '.score', '.iconbtn']))
        print('  errors', s.errors[:6], s.ev('window.__errors'))
    s.close()
