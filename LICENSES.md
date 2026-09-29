# Lizenzen und Quellen

Alle fremden Dateien im Repo, mit Quelle, Autor und Lizenz. Code, Käfig-Geometrie, Ball-Textur, Kapsel-Figur,
Linien, Netz-Texturen, Faser-Normalmap, Icons, Physik, Trainingsleibchen (aus dem Avatar-Mesh erzeugt),
Tormann-Handschuhe, prozedurale Posen und **alle Geräusche** (selbst synthetisiert, siehe `src/audio/sound.js`)
sind eigene Arbeit (MIT, siehe unten). Nicht im Repo: Rocketbox-Rohdateien (FBX/TGA) liegen nur lokal in
`assets_src/` (gitignored), geladen mit `tools/fetch_rocketbox.py`.

| Datei(en) | Quelle | Autor | Lizenz | URL |
|---|---|---|---|---|
| `assets/hdri/env_1k.hdr`, `assets/hdri/sky.jpg` (daraus berechnet) | Poly Haven, HDRI „Suburban Football Field“ | Grzegorz Wronkowski | CC0 1.0 | https://polyhaven.com/a/suburban_football_field |
| `assets/tex/turf_color.jpg` (umgefärbt), `assets/tex/turf_normal.jpg` (30 % der Halm-Normalen, Rest eigene Fasern) | ambientCG, „Grass 005“ | ambientCG (Lennart Demes) | CC0 1.0 | https://ambientcg.com/view?id=Grass005 |
| `assets/tex/grass_color.jpg`, `assets/tex/grass_normal.jpg` | ambientCG, „Grass 004“ | ambientCG (Lennart Demes) | CC0 1.0 | https://ambientcg.com/view?id=Grass004 |
| `lib/three/` (three.module.min.js, three.core.min.js, Addons HDRLoader, BufferGeometryUtils, GLTFLoader, SkeletonUtils) | three.js r186 | three.js authors | MIT | https://github.com/mrdoob/three.js (Lizenztext: `lib/three/THREE_LICENSE.txt`) |
| `lib/three/addons/libs/meshopt_decoder.module.js` | meshoptimizer (über three.js r186) | Arseny Kapoulkine | MIT | https://github.com/zeux/meshoptimizer |
| `assets/avatars/*.glb` – Sports_Male_02, Sports_Male_03, Sports_Male_04, Sports_Female_02, Male_Adult_10, Female_Adult_12 (umgerechnet: FBX → GLB, Texturen verkleinert als WebP, Geometrie quantisiert) | Microsoft Rocketbox Avatar Library | Microsoft | MIT (© 2020 Microsoft, Lizenztext: `assets/avatars/ROCKETBOX_LICENSE.txt`) | https://github.com/microsoft/Microsoft-Rocketbox |
| `assets/anims/m.glb`, `assets/anims/f.glb` – 16 Bewegungen je Geschlecht (idle_breathe_01, walk_neutral_01, run_slow_01, run_neutral_01, run_fast_01, run_start, run_stop, turn_left_90/180, turn_right_90, cheer_01, cheer_03, claphands_01, idle_waiting_01, crouch_idle, wave_01; auf das Skelett der Referenz-Avatare umgerechnet, Wurzelbewegung entfernt, teils gekürzt) | Microsoft Rocketbox Avatar Library | Microsoft | MIT (wie oben) | https://github.com/microsoft/Microsoft-Rocketbox |

Reserve-HDRI (nicht verwendet): „Suburban Soccer Park“ (Dimitrios Savva, Jarod Guest), Poly Haven, CC0.

## Messwerte aus der Literatur (keine Dateien übernommen)
- Hong S., Asai T. (2014): Effect of panel shape of soccer ball on its flight characteristics. Sci. Rep. 4:5068
  (CC BY-NC-SA 3.0 – nur Zahlenwerte zitiert).
- Asai T., Seo K., Kobayashi O., Sakashita R. (2007): Fundamental aerodynamics of the soccer ball. Sports Eng. 10:101–110.
- Goff J. E., Carré M. J. (2009): Trajectory analysis of a soccer ball. Am. J. Phys. 77:1020–1027;
  (2010): Soccer ball lift coefficients via trajectory analysis. Eur. J. Phys. 31:775–784.
- Cross R. (2002): Grip-slip behavior of a bouncing ball. Am. J. Phys. 70:1093–1102.
- FIFA Quality Programme for Football Turf – Handbook of Test Methods (2015), Test Manual 2024 Part II (Anforderungen).
- DFB-Minispielfeld: Herstellerangaben (20 × 13 m, Tore 3 × 2 m, Bande 1 m, Ballfangnetz 2 m).

Keine Vereins- oder Markenlogos, keine echten Spielernamen.

## Eigener Code
MIT-Lizenz, © 2026 Peter Kalmar.
