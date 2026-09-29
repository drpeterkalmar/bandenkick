// Trainings-Geräte (Nacht 2b): Ballmaschine (sichtbares Gerät, dreht sich zum Ziel, Räder drehen beim Schuss),
// Torwand-Zielscheiben, Hütchen, Freistoß-Puppen, Zielkreise. Dazu Anzeigehilfen beim Aufladen: Empfänger-Ring,
// Treffpunkt im Laufweg, Zielpunkt im Tor mit 1-σ-Streuung (fachlich aus denselben Planern wie der Kick).
import * as THREE from 'three';

const MACHINE_H = 0.75;
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o });

function buildMachine() {
  const g = new THREE.Group(); g.name = 'ballmaschine';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.5), mat(0x2f4a66, { metalness: 0.3 }));
  body.position.set(-0.12, MACHINE_H - 0.05, 0); g.add(body);
  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, MACHINE_H - 0.2, 8);
  for (const [x, z] of [[-0.35, -0.2], [-0.35, 0.2], [0.12, -0.2], [0.12, 0.2]]) { const l = new THREE.Mesh(legGeo, mat(0x333a40)); l.position.set(x, (MACHINE_H - 0.2) / 2, z); g.add(l); }
  // Kopf mit zwei Wurfrädern und Mündung (neigt sich mit dem Abflugwinkel)
  const head = new THREE.Group(); head.position.set(0.14, MACHINE_H, 0); g.add(head);
  const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.07, 20);
  const wheels = [];
  for (const y of [0.13, -0.13]) {
    const w = new THREE.Mesh(wheelGeo, mat(0xff7a1a, { roughness: 0.7 })); w.position.set(0.08, y, 0); head.add(w); wheels.push(w);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.3), mat(0x111111)); hub.position.set(0.08, y, 0); w.add(hub);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 16, 1, true), mat(0x9aa3ab, { side: THREE.DoubleSide, metalness: 0.5 }));
  tube.rotation.z = Math.PI / 2; tube.position.set(0.22, 0, 0); head.add(tube);
  // Trichter mit Bällen oben
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.14, 0.3, 16, 1, true), mat(0x1f2a33, { side: THREE.DoubleSide }));
  hopper.position.set(-0.18, MACHINE_H + 0.32, 0); g.add(hopper);
  const ballMat = mat(0xf4f4f0, { roughness: 0.45 });
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), ballMat); const a = i * 1.26; b.position.set(-0.18 + Math.cos(a) * 0.12, MACHINE_H + 0.42 + (i % 2) * 0.06, Math.sin(a) * 0.12); g.add(b); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, head, wheels };
}

function buildDummy() {
  const g = new THREE.Group(); g.name = 'puppe';
  const m = mat(0x1b3a8c, { roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.05, 6, 14), m); body.position.y = 0.2 + 0.52 + 0.2; body.scale.set(1, 1, 0.55); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), m); head.position.y = 1.62; g.add(head);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8), mat(0x444444)); foot.position.y = 0.11; g.add(foot);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class TrainingProps {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.name = 'training';
    scene.add(this.group);
    this.machine = null; this.targets = []; this.cones = null; this.dummies = []; this.zones = []; this.gateMark = null;
    this.key = '';
  }
  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) for (const m of [].concat(o.material)) m.dispose(); });
  }
  // Aufbau passend zur Challenge (neu, wenn sich Puppen/Kreise je Station ändern)
  sync(C) {
    const key = `${C.id}|${C.dummies.map((d) => d.x.toFixed(2) + d.z.toFixed(2)).join()}|${C.zones.map((z) => z.x.toFixed(2) + z.z.toFixed(2) + z.r).join()}`;
    if (key === this.key) return;
    this.key = key;
    for (const d of this.dummies) this.group.remove(d);
    for (const z of this.zones) this.group.remove(z.g);
    this.dummies = []; this.zones = [];
    if (C.machine && !this.machine) { this.machine = buildMachine(); this.group.add(this.machine.g); }
    if (C.targets.length && !this.targets.length) {
      for (const t of C.targets) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(t.r, 0.04, 10, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, roughness: 0.4, transparent: true, opacity: 0.55 }));
        ring.rotation.y = Math.PI / 2; ring.position.set(t.x - 0.03, t.y, t.z);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(t.r - 0.03, 40), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        disc.rotation.y = Math.PI / 2; disc.position.set(t.x - 0.02, t.y, t.z);
        this.group.add(ring, disc);
        this.targets.push({ ring, disc, t, hit: t.hit, flash: 0 });
      }
    }
    if (C.cones.length && !this.cones) {
      const geo = new THREE.ConeGeometry(0.13, 0.34, 14); geo.translate(0, 0.17, 0);
      this.cones = new THREE.InstancedMesh(geo, mat(0xff6a13, { roughness: 0.6 }), C.cones.length);
      const m4 = new THREE.Matrix4();
      C.cones.forEach((c, i) => { m4.makeTranslation(c.x, 0, c.z); this.cones.setMatrixAt(i, m4); });
      this.cones.castShadow = true;
      this.group.add(this.cones);
      this.gateMark = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.6, depthWrite: false }));
      this.gateMark.position.y = 0.012; this.group.add(this.gateMark);
    }
    for (const d of C.dummies) { const m = buildDummy(); m.position.set(d.x, 0, d.z); m.rotation.y = Math.PI / 2; this.group.add(m); this.dummies.push(m); }
    for (const z of C.zones) {
      const g = new THREE.Group(); g.position.set(z.x, 0.013, z.z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(z.r - 0.09, z.r, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.85, depthWrite: false }));
      const fill = new THREE.Mesh(new THREE.CircleGeometry(z.r - 0.09, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.14, depthWrite: false }));
      g.add(ring, fill); g.renderOrder = 2;
      this.group.add(g); this.zones.push({ g, ring, fill });
    }
  }
  update(C, dt, t) {
    this.sync(C);
    if (this.machine && C.machine) {
      const m = C.machine, M = this.machine;
      M.g.position.set(m.x, 0, m.z);
      M.g.rotation.y = -(m.yaw || 0);
      M.head.rotation.z = Math.max(-0.2, Math.min(0.9, m.pitch || 0));
      const spin = C.fired && t - (m.firedT || -9) < 0.6 ? 40 : 6;
      for (const w of M.wheels) w.rotation.y += spin * dt;
    }
    for (const T of this.targets) {
      if (T.t.hit > T.hit) { T.hit = T.t.hit; T.flash = 1.2; }
      T.flash = Math.max(0, T.flash - dt);
      const lit = T.t.lit, pulse = 0.5 + 0.5 * Math.sin(t * 6);
      T.ring.material.emissive.setHex(T.flash > 0 ? 0x2bff5a : lit ? 0xffc400 : 0x000000);
      T.ring.material.emissiveIntensity = T.flash > 0 ? 1.4 : lit ? 0.6 + 0.6 * pulse : 0;
      T.ring.material.opacity = lit || T.flash > 0 ? 1 : 0.45;
      T.disc.material.color.setHex(T.flash > 0 ? 0x2bff5a : 0xffe14a);
      T.disc.material.opacity = T.flash > 0 ? 0.45 : lit ? 0.12 + 0.1 * pulse : 0;
    }
    if (this.gateMark) {
      const gt = C.gates[C.next];
      this.gateMark.visible = !!gt;
      if (gt) { this.gateMark.position.set(gt.x, 0.012, gt.z); this.gateMark.scale.set(1, gt.w, 1); }
    }
    for (const z of this.zones) z.ring.material.opacity = 0.6 + 0.35 * Math.sin(t * 5);
  }
}

// Anzeigehilfen beim Aufladen: Empfänger-Ring, Treffpunkt im Laufweg (+ Bandenpunkt), Zielpunkt im Tor
export class AimMarkers {
  constructor(scene) {
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    this.recv = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.56, 40).rotateX(-Math.PI / 2), lineMat);
    this.recv.position.y = 0.015; this.recv.renderOrder = 3;
    this.meet = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24).rotateX(-Math.PI / 2), lineMat.clone());
    this.meet.position.y = 0.016; this.meet.renderOrder = 3;
    this.bank = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), lineMat.clone());
    this.goal = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    this.goal.rotation.y = Math.PI / 2; this.goal.renderOrder = 4;
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: 0xffd84a, depthWrite: false, side: THREE.DoubleSide }));
    this.dot.rotation.y = Math.PI / 2; this.dot.renderOrder = 4;
    this.all = [this.recv, this.meet, this.bank, this.goal, this.dot];
    for (const m of this.all) { m.visible = false; scene.add(m); }
  }
  hide() { for (const m of this.all) m.visible = false; }
  // pass: {recv: [x,z]|null, meet: [x,z], bank: [x,z]|null, color}; shot: {aim: [x,y,z], sigma (m), color}
  show({ pass = null, shot = null } = {}) {
    this.hide();
    if (pass) {
      const c = new THREE.Color(pass.color || 0xffffff);
      if (pass.recv) { this.recv.visible = true; this.recv.position.set(pass.recv[0], 0.015, pass.recv[1]); this.recv.material.color.copy(c); }
      if (pass.meet) { this.meet.visible = true; this.meet.position.set(pass.meet[0], 0.016, pass.meet[1]); this.meet.material.color.copy(c); }
      if (pass.bank) { this.bank.visible = true; this.bank.position.set(pass.bank[0], 0.5, pass.bank[1]); this.bank.material.color.copy(c); }
    }
    if (shot) {
      const s = Math.max(0.12, Math.min(0.9, shot.sigma));
      const x = shot.aim[0] - Math.sign(shot.aim[0]) * 0.03;
      this.goal.visible = true; this.goal.position.set(x, shot.aim[1], shot.aim[2]); this.goal.scale.setScalar(s); this.goal.material.color.set(shot.color || 0xffd84a);
      this.dot.visible = true; this.dot.position.set(x, shot.aim[1], shot.aim[2]); this.dot.material.color.set(shot.color || 0xffd84a);
    }
  }
}
