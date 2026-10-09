# n5 Ruckel-Messung: „Figurenbewegungen abgehackt, Replays janky“ sichtbar machen.
#   Ablauf (ein Browser, stumm): 20 s Spiel Bot gegen Bot, dann 3 Tore (Mensch läuft an und schießt, Wiederholung läuft
#   ganz durch, Jubel davor und danach). Je Bild zeichnet das Spiel (src/render/ruckmess.js) Knochen-Lagen im Figuren-Raum,
#   Figuren-Lage/-Drehung, Summe der Clip-Gewichte und die Kamera auf.
#   Kennzahlen (je Abschnitt live / Wiederholung):
#     Pose-Ruck   = zweite Ableitung der Knochen-Lage (Figuren-Raum), auf 60 Bilder/s normiert (cm je Bild²)
#     Pose-Sprung = Bild, in dem ein Knochen stärker ruckt als die sauberen Lauf-Clips selbst bei diesem Tempo je tun
#                   (Hülle a + b·Tempo je Knochen, geeicht mit tests/node/fluessig.test.mjs an stetigem Laufen 0…8,5 m/s,
#                   ×1,25 Reserve; Tempo = größtes Tempo ±3 Bilder × Abspieltempo der Wiederholung) UND > 3× Median des
#                   Umfelds (±6 Bilder) – die eigene Bewegung der Clips (Jubel, Schwung) ist stetig, ein Sprung eine Spitze
#     Dreh-Sprung = wie oben für die Blickrichtung der Figur (Grad je Bild²)
#     Gewicht<1   = Bilder, in denen die Clip-Gewichte einer Figur zusammen < 0,98 sind (Figur zieht Richtung Ruhepose)
#     Kamera-Ruck = zweite Ableitung von Kamera-Lage (cm) und Blickrichtung (Grad), normiert; Schnitte (Kamerawechsel
#                   zwischen Abschnitten der Wiederholung) zählen getrennt
#   Nur sichtbare Figuren (im Bild) und Bilder ohne Figuren-Sparen zählen.
# Aufruf: py tests/ruckel.py <name> [--query "&glatt=0"] [--form quer|hoch] [--drossel 4] [--tore 3] [--live 20]
#         py tests/ruckel.py --vergleich A.json B.json
# → tests/out/ruckel_<name>_<form>.json (roh), tests/perf/ruckel_<name>_<form>.json (Kennzahlen) + Tabelle
import os, sys, json, time, argparse, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Hülle je Knochen (cm/Bild² bei 60 Hz): a + b·Tempo (m/s) – größter Ruck der Lauf-Clips im stetigen Lauf (6 Figuren-Typen)
HUELLE = {'Bip01_Pelvis': (0.6, 0.4), 'Bip01_L_Foot': (1.0, 1.8), 'Bip01_R_Foot': (1.0, 1.8), 'Bip01_L_Hand': (0.6, 1.0),
          'Bip01_R_Hand': (0.6, 1.0), 'Bip01_Head': (0.6, 0.45)}
RESERVE = 1.25
SPRUNG_CM = 1.2     # (nur für spitzen(): Mindestwert)
UMFELD_K = 3.0
DREH_GRAD = 1.5     # Dreh-Sprung der Blickrichtung (Grad/Bild² normiert)
GROSS_CM = 8.0      # „großer Sprung“: deutlich sichtbares Schnappen (Ruck > 8 cm/Bild², Spitze)
CAM_CM = 1.0        # Kamera-Ruck-Ausreißer: Lage (cm/Bild²) …
CAM_GRAD = 0.25     # … bzw. Blickrichtung (Grad/Bild²)
F60 = 1 / 60


def zweite_ableitung(t, x):
    """Zweite Ableitung bei ungleichen Abständen, normiert auf 60 Hz (Einheit von x je Bild²). t in s, x (n, d)."""
    dt1 = t[1:-1] - t[:-2]; dt2 = t[2:] - t[1:-1]
    ok = (dt1 > 1e-4) & (dt2 > 1e-4)
    dt1 = np.where(ok, dt1, 1); dt2 = np.where(ok, dt2, 1)
    v1 = (x[1:-1] - x[:-2]) / dt1[:, None]; v2 = (x[2:] - x[1:-1]) / dt2[:, None]
    a = 2 * (v2 - v1) / (dt1 + dt2)[:, None]
    r = np.linalg.norm(a, axis=1) * F60 * F60
    r[~ok] = 0
    return np.concatenate([[0], r, [0]])


def spitzen(r, schwelle, k=UMFELD_K, w=6):  # noqa: E302
    """Bilder, deren Wert über der Schwelle UND k× über dem Median des Umfelds (ohne ±1 Nachbarn) liegt."""
    n = len(r); out = np.zeros(n, bool)
    for i in np.nonzero(r > schwelle)[0]:
        um = np.concatenate([r[max(0, i - w):max(0, i - 1)], r[i + 2:i + w + 1]])
        if len(um) and r[i] > k * max(np.median(um), 1e-6): out[i] = True
    return out


def ursache(B, i, z):
    """Zustand rund um einen Pose-Sprung (±3 Bilder) → wahrscheinliche Ursache."""
    w = B[max(0, i - 3):i + 4]
    kt, sw, tp, v, pl = (w[:, z + k] for k in range(5))
    if (kt < 0.2).any(): return 'schuss'
    if ((sw > 0.005) & (sw < 0.995)).any() or (np.ptp(sw) > 0.01): return 'sonderbewegung'
    if (tp > 0.01).any(): return 'technik'
    if (pl > 0.01).any(): return 'stemmschritt'
    if np.max(np.abs(np.diff(v))) > 0.25: return 'tempo'
    return 'sonst'


def auswerten(d):
    n, S, K, NF = d['n'], d['stride'], d['kopf'], d['nf']
    B = np.array(d['buf'], dtype=np.float64).reshape(n, S)
    t = B[:, 0] / 1000; ab = B[:, 9].astype(int); namen = d['abschnitte']; nk = len(d['knochen'])
    nfig = (S - K) // NF
    erg = {}
    gruppen = {'live': [i for i, a in enumerate(namen) if a == 'live'], 'replay': [i for i, a in enumerate(namen) if a.startswith('r_')]}
    for a in namen:
        if a.startswith('r_'): gruppen[a] = [namen.index(a)]
    # Figuren
    # Schnitte (Abschnittswechsel) und Bild-Hänger (Bildabstand > 2,5× Nachbar) nehmen die Bilder darum aus
    schnitt0 = np.zeros(n, bool); schnitt0[1:] = ab[1:] != ab[:-1]
    dtt = np.diff(t, prepend=t[0]); dtt[0] = dtt[1] if n > 1 else 0.0167
    haenger = np.zeros(n, bool); haenger[1:] = (dtt[1:] > 2.5 * np.minimum(np.roll(dtt, 1)[1:], np.roll(dtt, -1)[1:])) & (dtt[1:] > 0.03)
    aus = schnitt0 | haenger
    aus = aus | np.roll(aus, -1) | np.roll(aus, 1)
    pose_r = np.zeros((n, nfig)); dreh_r = np.zeros((n, nfig)); gilt = np.zeros((n, nfig), bool); wsum = np.ones((n, nfig))
    sprung = np.zeros((n, nfig), bool); dsprung = np.zeros((n, nfig), bool); gross = np.zeros((n, nfig), bool)
    gleit = [[] for _ in range(n)]  # Fußgleiten: Weltgeschwindigkeit (cm/s) aufgesetzter Füße je Bild
    for f in range(nfig):
        q = K + f * NF
        vis = B[:, q] > 0.5; gesp = B[:, q + 1] > 0.5
        g = vis.copy(); g[1:] &= vis[:-1]; g[:-1] &= vis[1:]; g &= ~gesp; g[1:] &= ~gesp[:-1]
        # Teleport (Aufstellen, Anstoß): Figur springt > 0,6 m → kein Ruckeln der Pose, Bilder darum ausnehmen
        sprungweit = np.zeros(n, bool); sprungweit[1:] = np.hypot(np.diff(B[:, q + 2]), np.diff(B[:, q + 4])) > 0.6
        g &= ~(sprungweit | np.roll(sprungweit, -1) | np.roll(sprungweit, 1) | np.roll(sprungweit, 2)) & ~aus
        gilt[:, f] = g
        wsum[:, f] = np.where(vis | (B[:, q + 6] > 0), B[:, q + 6], 1)
        rb = np.zeros(n); bone_sp = np.zeros(n, bool)
        zq = q + 7 + 3 * nk
        v = np.abs(B[:, zq + 3]) * B[:, 10] if len(d.get('zustand', [])) else np.zeros(n)
        vmax = np.max(np.stack([np.roll(v, s) for s in range(-3, 4)]), axis=0)
        for k in range(nk):
            x = B[:, q + 7 + 3 * k: q + 10 + 3 * k] * 100  # cm
            r = zweite_ableitung(t, x)
            ha, hb = HUELLE[d['knochen'][k]]
            ueber = r / ((ha + hb * vmax) * RESERVE)  # > 1 = über der Hülle
            rb = np.maximum(rb, r)
            bone_sp |= (ueber > 1) & spitzen(r, 0, UMFELD_K)  # … und eine Spitze gegenüber dem Umfeld (Clip-eigene Bewegung ist stetig)
        pose_r[:, f] = rb; sprung[:, f] = bone_sp & g; gross[:, f] = sprung[:, f] & (rb > GROSS_CM)
        # Fußgleiten: Fuß in Welt = Figur + Drehung(Figuren-Raum); aufgesetzt = Knöchel ≤ tiefster Stand + 2,5 cm, Figur läuft
        c, sn = np.cos(-B[:, q + 5]), np.sin(-B[:, q + 5])
        for kf in (1, 2):
            lx, ly, lz = (B[:, q + 7 + 3 * kf + a] for a in range(3))
            wx = B[:, q + 2] + lx * c - lz * sn; wz = B[:, q + 4] + lx * sn + lz * c
            boden = ly <= np.percentile(ly[g], 2) + 0.025 if g.any() else np.zeros(n, bool)
            vf = np.zeros(n); vf[1:] = np.hypot(np.diff(wx), np.diff(wz)) / np.maximum(np.diff(t), 1e-3) * 100
            ok = boden & np.roll(boden, 1) & g & (np.abs(B[:, q + 7 + 3 * nk + 3]) > 0.5) & (B[:, 10] > 0.99)
            for i in np.nonzero(ok)[0]: gleit[i].append(vf[i])
        yaw = np.unwrap(B[:, q + 5]) * 180 / math.pi
        dr = zweite_ableitung(t, yaw[:, None]); dreh_r[:, f] = dr; dsprung[:, f] = spitzen(dr, DREH_GRAD) & g
    # Kamera
    cp = B[:, 2:5] * 100; cd = B[:, 5:8]
    cam_r = zweite_ableitung(t, cp)
    ang = zweite_ableitung(t, cd) * 180 / math.pi
    fov = B[:, 8]
    schnitt = np.zeros(n, bool); schnitt[1:] = ab[1:] != ab[:-1]
    nah = schnitt.copy(); nah[1:] |= schnitt[:-1]; nah[:-1] |= schnitt[1:]  # Bilder am Schnitt nicht als Ruck zählen
    rate = B[:, 10]
    dtv = np.diff(t) * 1000
    for gname, ids in gruppen.items():
        m = np.isin(ab, ids)
        if not m.any(): continue
        mf = gilt & m[:, None]
        pr = pose_r[mf]; dr = dreh_r[mf]
        mc = m & ~nah; mc[0] = False; mc[-1] = False
        e = {
            'bilder': int(m.sum()), 'sek': round(float(np.sum(np.diff(t)[m[1:]])), 2),
            'bild_ms_p50': round(float(np.percentile(dtv[m[1:]], 50)), 2) if m[1:].any() else None,
            'bild_ms_p95': round(float(np.percentile(dtv[m[1:]], 95)), 2) if m[1:].any() else None,
            'figur_bilder': int(mf.sum()),
            'haenger': int((haenger & m).sum()),
            'sichtbar_gespart': int(((B[:, [K + f * NF for f in range(nfig)]] > 0.5) & (B[:, [K + f * NF + 1 for f in range(nfig)]] > 0.5) & m[:, None]).sum()),
            'pose_ruck_p50': round(float(np.percentile(pr, 50)), 3) if len(pr) else None,
            'pose_ruck_p99': round(float(np.percentile(pr, 99)), 3) if len(pr) else None,
            'pose_ruck_max': round(float(pr.max()), 2) if len(pr) else None,
            'pose_spruenge': int(sprung[mf].sum()),
            'pose_spruenge_je_min': round(float(sprung[mf].sum()) / max(1e-6, mf.sum() / 60 / 60), 1),
            'grosse_spruenge': int(gross[mf].sum()),
            'fussgleiten_cm_s': round(float(np.mean([v for i in np.nonzero(m)[0] for v in gleit[i]])), 1) if any(gleit[i] for i in np.nonzero(m)[0]) else None,
            'fussgleiten_p90': round(float(np.percentile([v for i in np.nonzero(m)[0] for v in gleit[i]], 90)), 1) if any(gleit[i] for i in np.nonzero(m)[0]) else None,
            'dreh_spruenge': int(dsprung[mf].sum()),
            'gewicht_unter_1': int(((wsum < 0.98) & m[:, None]).sum()),
            'gewicht_min': round(float(wsum[m].min()), 3),
            'cam_lage_p50': round(float(np.percentile(cam_r[mc], 50)), 3) if mc.any() else None,
            'cam_lage_p99': round(float(np.percentile(cam_r[mc], 99)), 3) if mc.any() else None,
            'cam_lage_max': round(float(cam_r[mc].max()), 2) if mc.any() else None,
            'cam_lage_ausreisser': int((cam_r[mc] > CAM_CM).sum()) if mc.any() else 0,
            'cam_blick_p99': round(float(np.percentile(ang[mc], 99)), 3) if mc.any() else None,
            'cam_blick_max': round(float(ang[mc].max()), 2) if mc.any() else None,
            'cam_blick_ausreisser': int((ang[mc] > CAM_GRAD).sum()) if mc.any() else 0,
            'cam_ruck_summe': round(float(cam_r[mc].sum() + 10 * ang[mc].sum()), 1) if mc.any() else 0,
            'schnitte': int((schnitt & m).sum()),
            'fov_spruenge': int(((np.abs(np.diff(fov, prepend=fov[0])) > 3) & m).sum()),
            'tempo_spruenge': int(((np.abs(np.diff(rate, prepend=rate[0])) > 0.1) & m).sum()),
        }
        erg[gname] = e
    # schlimmste Stellen (für Kontaktabzüge): Bild-Index, Abschnitt, Figur, Wert
    schlimm = []; zk = len(d.get('zustand', []))
    ursachen = {g: {} for g in gruppen}
    for f in range(nfig):
        z = K + f * NF + 7 + 3 * nk
        for i in np.nonzero(sprung[:, f])[0]:
            u = ursache(B, i, z) if zk else '?'
            schlimm.append({'i': int(i), 'ab': namen[ab[i]], 'fig': f, 'cm': round(float(pose_r[i, f]), 2), 'spielT': round(float(B[i, 11]), 3), 'ursache': u})
            for g, ids in gruppen.items():
                if ab[i] in ids: ursachen[g][u] = ursachen[g].get(u, 0) + 1
    for g in erg: erg[g]['ursachen'] = dict(sorted(ursachen[g].items(), key=lambda x: -x[1]))
    schlimm.sort(key=lambda s: -s['cm'])
    cams = [{'i': int(i), 'ab': namen[ab[i]], 'cm': round(float(cam_r[i]), 2), 'grad': round(float(ang[i]), 3), 'spielT': round(float(B[i, 11]), 3)}
            for i in np.argsort(-(cam_r + 10 * ang))[:12] if namen[ab[i]].startswith('r_') and not nah[i]]
    return {'gruppen': erg, 'schlimm_figur': schlimm[:20], 'schlimm_kamera': cams,
            'schwellen': {'huelle': HUELLE, 'reserve': RESERVE, 'dreh_grad': DREH_GRAD, 'cam_cm': CAM_CM, 'cam_grad': CAM_GRAD}}


def tabelle(name, erg):
    zeilen = [f'### {name}', '| Abschnitt | Bilder | ms p50/p95 | Pose-Ruck p50/p99/max (cm) | Pose-Sprünge (/min) · groß | Fußgleiten Ø/p90 (cm/s) | Dreh-Spr. | Gewicht<1 (min) | Kamera Lage p99/max (cm) · Ausr. | Blick p99/max (°) · Ausr. | Kamera-Ruck Σ | Schnitte/FOV/Tempo |',
              '|---|---|---|---|---|---|---|---|---|---|---|---|']
    for g, e in erg['gruppen'].items():
        zeilen.append(f"| {g} | {e['bilder']} | {e['bild_ms_p50']}/{e['bild_ms_p95']} | {e['pose_ruck_p50']}/{e['pose_ruck_p99']}/{e['pose_ruck_max']} | {e['pose_spruenge']} ({e['pose_spruenge_je_min']}) · {e['grosse_spruenge']} | {e['fussgleiten_cm_s']}/{e['fussgleiten_p90']} | {e['dreh_spruenge']} | {e['gewicht_unter_1']} ({e['gewicht_min']}) | {e['cam_lage_p99']}/{e['cam_lage_max']} · {e['cam_lage_ausreisser']} | {e['cam_blick_p99']}/{e['cam_blick_max']} · {e['cam_blick_ausreisser']} | {e['cam_ruck_summe']} | {e['schnitte']}/{e['fov_spruenge']}/{e['tempo_spruenge']} |")
    return '\n'.join(zeilen)


# ---------------- Browser-Lauf ----------------
# Tore mit rollendem Ball (der Aufbau der Wiederholung soll arbeiten wie bei echten Toren): Ball wird zugespielt
# (Querpass, Bandenabpraller, Steilpass), Orange 2 (Mensch) läuft entgegen und schießt per Tipp, sobald er dran ist.
# (Name, Schütze x/z, Ball von x/z, Ball-Tempo vx/vz)
TOR_SZENEN = [
    ('querpass', (-10.0, 1.0), (-8.5, -5.5), (0.6, 7.5)),
    ('bande', (-5.0, 1.5), (-12.0, 1.0), (6.0, 11.0)),
    ('steilpass', (-12.5, -1.0), (-16.0, -2.0), (9.0, 0.6)),
]
# Im Browser: je Bild Stick zum Ball, Tipp sobald ≤ 0,9 m; Schussrichtung = Tormitte etwas versetzt
ANLAUF_JS = """([hx, maxS, zZiel]) => new Promise((res) => { const G = __game, g = G.game, p = g.players[1], t0 = g.t;
  const k = () => { const b = g.ball.p, dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
    if (G.replay().wait > 0 || G.replay().active) { res('tor'); return; }
    if (g.t - t0 > maxS) { res('zeit'); return; }
    const vb = Math.hypot(g.ball.v.x, g.ball.v.z);
    if (window.__getippt && g.t - window.__getippt > 0.5 && vb < 4) window.__getippt = 0; // Tipp ging in die Ballannahme → nochmal
    if (d < 0.9 && !window.__getippt) { window.__getippt = g.t; const gx = hx - p.x, gz = zZiel - p.z, gl = Math.hypot(gx, gz);
      G.press([[0, 0.07, 'shot']], [gx / gl, gz / gl], 0.4); }
    else if (!window.__getippt) G.press([[50, 50.01, 'pass']], [dx / (d || 1), dz / (d || 1)], 5);
    requestAnimationFrame(k); };
  window.__getippt = 0; requestAnimationFrame(k); })"""


def tor(s, hx, k):
    name, (sx, sz), (bx, bz), (vx, vz) = TOR_SZENEN[k % len(TOR_SZENEN)]
    s.ev("__game.replayHold(null); __game.game.rules.phase = 'play'; __game.bots(false); __game.human(1)")
    s.ev(f"__game.placePlayer({hx + sx}, {sz}, 0, 1); __game.placeBall({hx + bx}, 0.11, {bz}); __game.placePlayer({hx - 0.6}, {-2.6 if sz > 0 else 2.6}, Math.PI, 3);"
         f" __game.placePlayer(-4, 4, 0, 4); __game.placePlayer(-4, -4, 0, 5); __game.placePlayer(-8, 0, 0, 0); __game.placePlayer({hx - 15}, {-3 if sz > 0 else 3}, 0, 2)")
    s.wait_sim(2.4)  # Aufstellen liegt vor dem Aufbau-Abschnitt der Wiederholung (kein Sprung im Bild)
    s.ev(f"__game.kick({{from:[{hx + bx}, 0.11, {bz}], v:[{vx}, 0, {vz}], w:[0,0,0]}}); __game.game.lastTouch = 0")
    r = s.ev(ANLAUF_JS, [hx, 6, 0.9 if sz > 0 else -0.9])  # weg vom Tormann
    if r != 'tor': raise RuntimeError(f'{name}: kein Tor ({r})')
    s.pg.wait_for_function("__game.replay().active", timeout=15000)
    info = s.ev("__game.replay()"); info['szene'] = name
    s.pg.wait_for_function("!__game.replay().active", timeout=30000)
    s.wait_sim(2.5, timeout=30000)  # Jubel danach + Anstoß
    return info


def lauf(a):
    from util import Server, Session, sync_playwright, ARGS
    import deko_scenes as S
    if '--mute-audio' not in ARGS: ARGS.append('--mute-audio')
    q = '?nosw&seed=3&q=2&nohelp&play&startprobe=0' + a.query
    with Server() as srv, sync_playwright() as pw:
        s = Session(pw, srv.base, a.form)
        S.open_ready(s, q)
        if a.drossel > 1:
            cdp = s.ctx.new_cdp_session(s.pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': a.drossel})
        hx = s.ev("__game.game.cage.hx")
        s.ev("__game.freeze(false); __game.replayHold(null); __game.newGame(); __game.game.rules.phase = 'play'; __game.bots(true); __game.human(-1)")
        s.frames(10)
        s.ev("__game.ruckStart(20000)")
        s.wait_sim(a.live, timeout=int(a.live * 1000 * 6 + 30000))
        tore = []
        for k in range(a.tore + 3):  # bis zu 3 Fehlversuche (Pfosten, Tormann) – die Szenen wechseln sich ab
            if len(tore) >= a.tore: break
            try: tore.append(tor(s, hx, k))
            except Exception as e: print('Versuch', k + 1, 'ohne Tor:', str(e)[:120])
        d = s.ev("__game.ruckDaten()")
        errs = s.errors + ['JSERR ' + e for e in s.ev('window.__errors')]
        gl = s.gl
        s.close()
    d['meta'] = {'name': a.name, 'form': a.form, 'query': q, 'drossel': a.drossel, 'tore': tore, 'gl': gl, 'fehler': errs[:5]}
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('name', nargs='?')
    ap.add_argument('--query', default='')
    ap.add_argument('--form', default='quer')
    ap.add_argument('--drossel', type=float, default=1)
    ap.add_argument('--tore', type=int, default=3)
    ap.add_argument('--live', type=float, default=20)
    ap.add_argument('--roh', help='vorhandene Roh-Datei nur auswerten')
    ap.add_argument('--vergleich', nargs=2)
    a = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if a.vergleich:
        A, B = [json.load(open(p, encoding='utf-8')) for p in a.vergleich]
        for g in A['gruppen']:
            if g not in B['gruppen']: continue
            ea, eb = A['gruppen'][g], B['gruppen'][g]
            print(g, ' '.join(f"{k}: {ea[k]}→{eb[k]}" for k in ('pose_spruenge', 'grosse_spruenge', 'fussgleiten_cm_s', 'dreh_spruenge', 'gewicht_unter_1', 'cam_lage_ausreisser', 'cam_blick_ausreisser', 'cam_ruck_summe', 'pose_ruck_p99')))
        return
    if a.roh:
        d = json.load(open(a.roh, encoding='utf-8'))
    else:
        t0 = time.time()
        d = lauf(a)
        os.makedirs(os.path.join(root, 'tests', 'out'), exist_ok=True)
        json.dump(d, open(os.path.join(root, 'tests', 'out', f'ruckel_{a.name}_{a.form}.json'), 'w', encoding='utf-8'))
        print(f'Lauf {time.time() - t0:.0f} s, {d["n"]} Bilder, Fehler: {d["meta"]["fehler"]}')
        print('Tore:', [(x or {}).get('segs') for x in d['meta']['tore']])
    erg = auswerten(d)
    erg['meta'] = d.get('meta', {})
    name = a.name or os.path.basename(a.roh)
    os.makedirs(os.path.join(root, 'tests', 'perf'), exist_ok=True)
    json.dump(erg, open(os.path.join(root, 'tests', 'perf', f'ruckel_{name}_{a.form}.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print(tabelle(f'{name} ({a.form}, Drossel {a.drossel})', erg))
    for g, e in erg['gruppen'].items(): print(g, 'Ursachen:', e.get('ursachen'))
    print('schlimmste Figuren-Stellen:', erg['schlimm_figur'][:8])
    print('schlimmste Kamera-Stellen:', erg['schlimm_kamera'][:6])


if __name__ == '__main__':
    main()
