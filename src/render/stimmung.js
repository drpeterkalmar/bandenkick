// Verschönerung „Stimmung“ (Deko, Peter 05.10.: „mehr Details und Eye Candy“): Himmel mit richtiger Farbausgabe und
// leichter Farbstimmung, Kunstrasen mit Mähstreifen (hell/dunkel je Blickrichtung) und Glanz bei flachem Blick,
// Außenboden mit einfachem Licht (günstiger als PBR) und eingebackenen Details, weiche gerichtete Schatten.
// Alles ohne zusätzliche Draw-Calls; ?deko=0 nutzt die alten Materialien aus scene.js/field.js.
import * as THREE from 'three';

// Himmel: dieselbe Kugel wie bisher, aber mit Farbraum-Umwandlung (vorher landeten lineare Werte direkt im sRGB-Bild →
// Himmel viel zu dunkel und „gewittrig“) und sanfter Stimmung: Zenit etwas kühler, Lichthof in Richtung Sonne.
// Abend (Etappe 4) färbt über uNight (0…1) um: Dämmerungsverlauf, dunkle Wolken, warmer Horizont.
export function makeSkyDeko(tex, info, sunDir) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  const ground = new THREE.Color().setRGB(...info.ground, THREE.SRGBColorSpace);
  const u = {
    sky: { value: tex }, cutV: { value: info.cutV }, ground: { value: ground }, sunDir: { value: sunDir.clone() },
    uTop: { value: new THREE.Color(0.80, 0.90, 1.08) }, uSun: { value: new THREE.Color(1.0, 0.86, 0.62) }, uExpo: { value: 0.92 },
    uNight: { value: 0 }, uNightTop: { value: new THREE.Color(0.012, 0.022, 0.06) }, uNightHor: { value: new THREE.Color(0.36, 0.16, 0.07) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform sampler2D sky; uniform float cutV; uniform vec3 ground, sunDir, uTop, uSun, uNightTop, uNightHor; uniform float uExpo, uNight;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float u = atan(d.z, d.x) / 6.2831853 + 0.5;
        float v = acos(clamp(d.y, -1.0, 1.0)) / 3.14159265;
        vec3 c = v < cutV - 0.002 ? texture2D(sky, vec2(u, 1.0 - v / cutV)).rgb : ground;
        float h = clamp(d.y, 0.0, 1.0), sn = max(dot(d, sunDir), 0.0);
        vec3 day = c * mix(vec3(1.0), uTop, smoothstep(0.06, 0.65, h));
        day *= 1.0 + uSun * (pow(sn, 6.0) * 0.45 + pow(sn, 48.0) * 0.6);
        // Abend: Wolken als dunkle Silhouetten vor einem Dämmerungsverlauf (Horizont warm, Zenit tiefblau)
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 dusk = mix(uNightHor, uNightTop, pow(smoothstep(0.0, 0.55, h), 0.7));
        vec3 night = dusk * (0.45 + 0.75 * l) + uNightHor * 0.5 * pow(max(dot(d.xz, sunDir.xz), 0.0), 3.0) * (1.0 - smoothstep(0.0, 0.3, h));
        night = v < cutV - 0.002 ? night : c * 0.08;
        gl_FragColor = vec4(mix(day, night, uNight) * uExpo, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  m.name = 'sky';
  m.userData.u = u;
  return m;
}

// Kunstrasen: Mähstreifen quer zur Spielrichtung (2,4 m, Halme abwechselnd ±z geneigt: zur Kamera geneigt = dunkler, weg
// = heller) und Glanz der Kunststofffasern bei flachem Blick (ferne Feldhälfte). Ersetzt die festen Streifen der
// Linien-Textur. uPool (Etappe 4): Lichtkegel der Flutlichter als Helligkeitsfaktor.
export function patchTurf(mat) {
  const u = {
    uStripe: { value: new THREE.Vector2(0.04, 0.075) }, uSheen: { value: new THREE.Color(0.09, 0.10, 0.085) },
    uPool: { value: null }, uPoolOn: { value: 0 }, uPoolBox: { value: new THREE.Vector4(-20, -15, 40, 30) },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWPos; uniform vec2 uStripe; uniform vec3 uSheen; uniform sampler2D uPool; uniform float uPoolOn; uniform vec4 uPoolBox;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 mac = texture2D(map, vMapUv * 0.163 + vec2(0.37, 0.11)).rgb;
        float l = dot(mac, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb *= mix(0.84, 1.12, smoothstep(0.12, 0.34, l));
        float su = vWPos.x / 2.4, fw = fwidth(su) * 0.75 + 0.03;
        float tri = abs(fract(su * 0.5) * 2.0 - 1.0);
        float s = smoothstep(0.5 - fw, 0.5 + fw, tri) * 2.0 - 1.0;
        vec3 vd = normalize(cameraPosition - vWPos);
        diffuseColor.rgb *= 1.0 - uStripe.x * s - uStripe.y * s * vd.z;
        if (uPoolOn > 0.5) diffuseColor.rgb *= texture2D(uPool, (vWPos.xz - uPoolBox.xy) / uPoolBox.zw).rgb * 2.0; }`)
      .replace('#include <opaque_fragment>', `{ float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += uSheen * pow(1.0 - ndv, 4.0); }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'turfDeko';
  mat.needsUpdate = true;
  return u;
}

// Außenboden: Lambert (diffus, kein PBR, keine Normalmap) – das Umgebungslicht kommt als Albedo × uAmb dazu, so bleibt
// die Helligkeit wie beim alten PBR-Gras, kostet aber weniger. uDetail (Etappe 2): eingebackene Wege, Pflaster am Käfig,
// Abnutzung und Schatten (R = Pflaster, G = Erde/abgetreten, B = Schatten).
export function outerGroundMaterial(gc, amb) {
  const u = {
    // auf das alte PBR-Gras abgeglichen (Mittelwert im Bild ≤ 3 Stufen Abweichung, Menü und Spielansicht)
    uAmb: { value: amb.clone() }, uAdd: { value: new THREE.Color(0.016, 0.020, 0.034) }, uAlb: { value: new THREE.Color(0.86, 0.85, 0.86) },
    uDetail: { value: null }, uDetailOn: { value: 0 }, uDetailBox: { value: new THREE.Vector4(-40, -30, 80, 60) },
    uPave: { value: new THREE.Color(0.20, 0.19, 0.175) }, uDirt: { value: new THREE.Color(0.16, 0.12, 0.075) },
  };
  const mat = new THREE.MeshLambertMaterial({ map: gc, color: 0xd8dccf });
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vGXZ; uniform vec3 uAmb, uAdd, uAlb; uniform sampler2D uDetail; uniform float uDetailOn; uniform vec4 uDetailBox; uniform vec3 uPave, uDirt;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb *= uAlb;
      if (uDetailOn > 0.5) {
        vec2 dq = (vGXZ - uDetailBox.xy) / uDetailBox.zw;
        vec4 gDet = (dq.x > 0.0 && dq.x < 1.0 && dq.y > 0.0 && dq.y < 1.0) ? texture2D(uDetail, dq) : vec4(0.0);
        float n = clamp(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15)) / 0.09, 0.4, 1.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, uDirt * (0.7 + 0.3 * n), gDet.g);
        diffuseColor.rgb = mix(diffuseColor.rgb, uPave * (0.78 + 0.22 * n), gDet.r);
        diffuseColor.rgb *= 1.0 - 0.6 * gDet.b;
      }`)
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = diffuseColor.rgb * uAmb + uAdd;');
  };
  mat.customProgramCacheKey = () => 'groundDeko';
  return mat;
}

// Abnutzung auf dem Kunstrasen, einmal in die Linien-Textur gemalt (kostet zur Laufzeit nichts): Torräume (Tormann steht
// und hechtet → Fasern flach und heller, mehr Granulat sichtbar), Anstoßpunkt, Granulat an der Bande und in den Ecken,
// ein paar Rutschspuren. Fester Zufall → immer gleich.
export function paintTurfWear(g, X, Z, ppm, P) {
  const rnd = mulberry32(20261005);
  const gauss = () => { let a = 0; while (a === 0) a = rnd(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * rnd()); };
  const hx = P.fieldL / 2, hz = P.fieldW / 2;
  const dot = (x, z, r, col) => { g.fillStyle = col; g.fillRect(X(x) - r / 2, Z(z) - r / 2, r, r); };
  const blot = (x, z, rx, rz, col, a) => { // weicher, elliptischer Fleck
    g.save(); g.translate(X(x), Z(z)); g.scale(1, rz / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx * ppm);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.55, `rgba(${col},${a * 0.55})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx * ppm, 0, Math.PI * 2); g.fill(); g.restore();
  };
  const LIGHT = '168,180,140', DARK = '14,15,13';
  for (const s of [1, -1]) {
    // Torraum: heller Grundton, dichter an der Torlinie (Laufweg des Tormanns), dazu Granulat und ein paar helle Fasern
    blot(s * (hx - 1.0), 0, 1.8, 2.6, LIGHT, 0.2);
    blot(s * (hx - 0.35), 0, 0.75, 1.9, LIGHT, 0.17);
    blot(s * (hx - 0.7), 0, 1.1, 1.7, DARK, 0.09);
    for (let i = 0; i < 2200; i++) {
      const x = s * (hx - Math.abs(gauss()) * 1.1 - 0.05), z = gauss() * 1.35;
      if (Math.abs(x) > hx - 0.02) continue;
      const light = rnd() < 0.3;
      dot(x, z, 1 + rnd() * 1.6, light ? `rgba(${LIGHT},${0.06 + rnd() * 0.1})` : `rgba(${DARK},${0.16 + rnd() * 0.24})`);
    }
  }
  // Anstoßpunkt
  blot(0, 0, 0.75, 0.75, LIGHT, 0.15);
  for (let i = 0; i < 220; i++) dot(gauss() * 0.35, gauss() * 0.35, 1 + rnd() * 1.5, rnd() < 0.3 ? `rgba(${LIGHT},0.12)` : `rgba(${DARK},0.24)`);
  // Granulat wandert an die Bande und in die Ecken
  const sides = [[-hx, -hz, hx, -hz, 0, 1], [-hx, hz, hx, hz, 0, -1], [-hx, -hz, -hx, hz, 1, 0], [hx, -hz, hx, hz, -1, 0]];
  for (let i = 0; i < 7000; i++) {
    const S = sides[rnd() < 0.62 ? (rnd() < 0.5 ? 0 : 1) : (rnd() < 0.5 ? 2 : 3)];
    const t = rnd(), d = Math.abs(gauss()) * 0.16 + 0.01;
    const x = S[0] + (S[2] - S[0]) * t + S[4] * d, z = S[1] + (S[3] - S[1]) * t + S[5] * d;
    if (S[4] && Math.abs(z) < P.goalW / 2 + 0.1) continue; // nicht im Tor
    dot(x, z, 1 + rnd() * 1.8, `rgba(${DARK},${0.25 + rnd() * 0.35})`);
  }
  for (const [cx, cz] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) {
    blot(cx, cz, 0.9, 0.9, DARK, 0.16);
    for (let i = 0; i < 700; i++) {
      const r = -Math.log(1 - rnd() * 0.98) * 0.22, a = rnd() * Math.PI / 2;
      dot(cx - Math.sign(cx) * Math.cos(a) * r, cz - Math.sign(cz) * Math.sin(a) * r, 1 + rnd() * 2, `rgba(${DARK},${0.3 + rnd() * 0.35})`);
    }
  }
  // alte Rutschspuren (Grätschen): wenige breite, sehr weiche dunkle Bahnen (Fasern platt gedrückt)
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x0 = (rnd() * 2 - 1) * (hx - 3), z0 = (rnd() * 2 - 1) * (hz - 2), a = rnd() * Math.PI * 2, len = 0.9 + rnd() * 0.9, bend = (rnd() - 0.5) * 0.5;
    for (const [w, al] of [[0.34, 0.025], [0.2, 0.035]]) {
      g.strokeStyle = `rgba(${DARK},${al})`; g.lineWidth = w * ppm; g.beginPath();
      g.moveTo(X(x0), Z(z0));
      g.quadraticCurveTo(X(x0 + Math.cos(a + bend) * len * 0.5), Z(z0 + Math.sin(a + bend) * len * 0.5), X(x0 + Math.cos(a) * len), Z(z0 + Math.sin(a) * len));
      g.stroke();
    }
  }
}
// Linien leicht abgenutzt (eigene Leinwand nur mit den Linien): Farbe fleckig (Wertrauschen ≈ 0,4 m) und körnig
export function wearLines(g, c) {
  const rnd = mulberry32(77), W = c.width, H = c.height, cell = 26;
  const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2, grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H; y++) {
    const fy = y / cell, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4 + 3;
      if (!d[o]) continue;
      const fx = x / cell, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
      const a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1], e = grid[(iy + 1) * gw + ix], f = grid[(iy + 1) * gw + ix + 1];
      const n = (a + (b - a) * sx) * (1 - sy) + (e + (f - e) * sx) * sy;
      d[o] = Math.round(d[o] * Math.min(1, (0.5 + 0.62 * n) * (0.82 + 0.18 * rnd())));
    }
  }
  g.putImageData(img, 0, 0);
}
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Weicher, gerichteter Schatten einer stehenden Figur (Sonne bzw. Flutlicht): dunkler Kern an den Füßen, langer weicher
// Schweif vom Licht weg. Textur entlang +x (Füße bei u = 0,12).
let _shadowTex = null;
export function figureShadowTexture() {
  if (_shadowTex) return _shadowTex;
  const W = 128, H = 48, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W, v = ((y + 0.5) / H) * 2 - 1;
    const w = 0.52 * (1 - 0.45 * u);
    const body = Math.exp(-((v / w) ** 2) * 2.2) * smooth(0.02, 0.16, u) * (1 - smooth(0.62, 1.0, u)) * 0.28;
    const core = Math.exp(-(((u - 0.12) ** 2) / 0.004 + (v ** 2) / 0.3)) * 0.42;
    const a = Math.min(0.72, body + core);
    const o = (y * W + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 0; img.data[o + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  _shadowTex = new THREE.CanvasTexture(c);
  return _shadowTex;
}
// Ebene für den Figuren-Schatten: Füße im Ursprung, Schatten entlang +x (Länge len)
export function figureShadowGeometry(len = 2.0, width = 0.86) {
  const g = new THREE.PlaneGeometry(len, width).rotateX(-Math.PI / 2);
  g.translate(len * (0.5 - 0.12), 0, 0);
  return g;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
