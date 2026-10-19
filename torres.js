// torres.js — Torres, pasarela rota, puerta con llave, palanca, puente levadizo y entrada al castillo.
// Portado de prueba_modulo.html (el diseño validado). +X este · +Z norte · Y arriba.
//   Torre 1 (x 67.5-75)   maciza.            Torre 2 (x 80.5-90) hueca: planta baja, escalera y sala alta.
//   Pasarela rota: sale del piso 2 del módulo (muro norte, x 82.5-87.5) hasta la puerta de la torre 2 (cara sur, x 84-86, y 11.5).
//   Palanca dentro de la sala alta → cae la hoja del puente levadizo (bisagra z = 72, x 75.15-80.35) hacia el castillo.
// No toca map1.js más que por buildTowers(); toda la colisión entra por addWall/addPlatform del mapa.

import * as THREE from 'three';

const Y0 = 6, Y2 = 11.5, YT = 16.5;

export function buildTowers(scene, { M, worldUV, addWall, addPlatform, WALLS, PLATFORMS }) {
  const mat = (c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, side: THREE.DoubleSide });
  const W = M.wood, IRON = M.iron, STONE = M.wall;
  const roofM = mat(0x4e3424, 0.9), gold = mat(0xa98a3a, 0.55, 0.7), dark = mat(0x15100c, 1), padA = mat(0x6a665e, 1), padB = mat(0x403a32, 1);
  const root = new THREE.Group(); root.name = 'torres'; scene.add(root);
  const sh = (o) => { o.castShadow = o.receiveShadow = true; return o; };

  function box(g, w, h, d, x, y, z, m, tilt = 0) {
    const geo = new THREE.BoxGeometry(w, h, d); worldUV(geo, w, h, d, m);
    const o = sh(new THREE.Mesh(geo, m)); o.position.set(x, y, z);
    if (tilt) o.rotation.set(tilt, tilt, tilt);
    g.add(o); return o;
  }
  function cyl(g, r, len, axis, x, y, z, m, seg = 14) {
    const o = sh(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m));
    if (axis === 'x') o.rotation.z = Math.PI / 2; else if (axis === 'z') o.rotation.x = Math.PI / 2;
    o.position.set(x, y, z); g.add(o); return o;
  }
  const solid = (x0, x1, z0, z1, y0, y1) => { const w = { minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y0, maxY: y1 }; WALLS.push(w); return w; };
  const pad = (w, d, y, x, z, m) => { box(root, w, 0.35, d, x, y - 0.175, z, m); addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y); };

  // muro con huecos: holes = [u0, u1, y0, y1, ventana?]; las ventanas llevan marco y se cierran para pasar
  function wallH(ax, fixed, thick, u0, u1, y0, y1, holes = []) {
    const hs = holes.slice().sort((p, q) => p[0] - q[0]); let u = u0;
    const add = (a, b, c, d) => {
      if (b - a < 0.01 || d - c < 0.01) return; const m = (a + b) / 2, k = (c + d) / 2;
      if (ax === 'z') { box(root, thick, d - c, b - a, fixed, k, m, STONE); solid(fixed - thick / 2, fixed + thick / 2, a, b, c, d); }
      else { box(root, b - a, d - c, thick, m, k, fixed, STONE); solid(a, b, fixed - thick / 2, fixed + thick / 2, c, d); }
    };
    for (const h of hs) {
      add(u, h[0], y0, y1); add(h[0], h[1], y0, h[2]); add(h[0], h[1], h[3], y1); u = h[1];
      if (h[4]) {                                               // ventana: marco de madera y barrera invisible
        const [a, b, c, d] = h, m = (a + b) / 2, t = thick + 0.2, e = d - c;
        if (ax === 'z') { box(root, t, 0.1, b - a + 0.2, fixed, c - 0.04, m, W); box(root, t, 0.1, b - a + 0.2, fixed, d + 0.04, m, W); box(root, t, e, 0.08, fixed, (c + d) / 2, a - 0.04, W); box(root, t, e, 0.08, fixed, (c + d) / 2, b + 0.04, W); solid(fixed - thick / 2, fixed + thick / 2, a, b, c, d); }
        else { box(root, b - a + 0.2, 0.1, t, m, c - 0.04, fixed, W); box(root, b - a + 0.2, 0.1, t, m, d + 0.04, fixed, W); box(root, 0.08, e, t, a - 0.04, (c + d) / 2, fixed, W); box(root, 0.08, e, t, b + 0.04, (c + d) / 2, fixed, W); solid(a, b, fixed - thick / 2, fixed + thick / 2, c, d); }
      }
    }
    add(u, u1, y0, y1);
  }
  function rail(x0, z0, x1, z1, y) {
    const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = ax ? Math.abs(x1 - x0) : Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (ax) { box(root, len, 0.08, 0.1, cx, y + 1.05, cz, W); box(root, len, 0.06, 0.06, cx, y + 0.5, cz, W); }
    else { box(root, 0.1, 0.08, len, cx, y + 1.05, cz, W); box(root, 0.06, 0.06, len, cx, y + 0.5, cz, W); }
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) { const f = i / n; box(root, 0.1, 1.1, 0.1, ax ? Math.min(x0, x1) + len * f : cx, y + 0.55, ax ? cz : Math.min(z0, z1) + len * f, W); }
    if (ax) solid(Math.min(x0, x1), Math.max(x0, x1), cz - 0.08, cz + 0.08, y, y + 1.1); else solid(cx - 0.08, cx + 0.08, Math.min(z0, z1), Math.max(z0, z1), y, y + 1.1);
  }

  // ---------------- paso entre las torres (x 75-80.5) ----------------
  pad(5.5, 9, Y0, 77.75, 67.5, padA);

  // ---------------- torre 1: maciza (la caja la pone map1; aquí solo el techo) ----------------
  box(root, 7.9, 0.4, 9.4, 71.25, 16.9, 67.5, roofM);

  // ---------------- torre 2: hueca ----------------
  wallH('x', 63.3, 0.6, 80.5, 90, Y0, Y2); wallH('x', 71.7, 0.6, 80.5, 90, Y0, Y2);
  wallH('z', 80.8, 0.6, 63.6, 71.4, Y0, Y2, [[66, 68, Y0, 8.4]]);                     // salida al paso entre las torres
  wallH('z', 89.7, 0.6, 63.6, 71.4, Y0, Y2);
  wallH('x', 63.3, 0.6, 80.5, 90, Y2, 16.7, [[84, 86, Y2, 13.9]]);                     // hueco de la puerta con llave
  wallH('x', 71.7, 0.6, 80.5, 90, Y2, 16.7, [[82, 84, 13.4, 15.4, 1]]);
  wallH('z', 80.8, 0.6, 63.6, 71.4, Y2, 16.7, [[65, 66.4, 13.4, 15.4, 1]]);
  wallH('z', 89.7, 0.6, 63.6, 71.4, Y2, 16.7, [[65, 66.4, 13.4, 15.4, 1]]);
  pad(8.3, 7.8, Y0, 85.25, 67.5, padB);                                                  // suelo de la planta baja
  box(root, 6.3, 0.5, 7.8, 84.25, Y2 - 0.25, 67.5, W); addPlatform(81.1, 87.4, 63.6, 71.4, Y2);   // sala alta
  box(root, 2, 0.5, 1.4, 88.4, Y2 - 0.25, 70.7, W); addPlatform(87.4, 89.4, 70, 71.4, Y2);        // descanso de la escalera
  { const n = 12, rise = (Y2 - Y0) / n, dep = 6 / n;                                     // escalera junto al muro este, sube hacia +Z
    for (let i = 0; i < n; i++) { const top = Y0 + (i + 1) * rise, z = 64 + (i + 0.5) * dep; box(root, 2, top - Y0, dep * 0.98, 88.4, Y0 + (top - Y0) / 2, z, STONE); addPlatform(87.4, 89.4, z - dep / 2, z + dep / 2, top); }
    rail(87.4, 64, 87.4, 70.3, Y2); solid(87.3, 87.5, 64.6, 70, Y0, Y2 + 1.1); }
  addPlatform(80.5, 81.1, 66, 68, Y0);                                                    // umbral de la salida al paso
  box(root, 9.9, 0.4, 9.4, 85.25, 16.9, 67.5, roofM);

  // ---------------- puente levadizo: hoja vertical contra el paso, bisagra en z = 72 ----------------
  box(root, 5.8, 1.2, 1.4, 77.75, 15.9, 71.3, STONE); box(root, 5.5, 3.4, 0.6, 77.75, 13.7, 71.7, STONE);
  const db = new THREE.Group(); db.position.set(77.75, Y0, 72); root.add(db);
  box(db, 5.2, 0.25, 6, 0, 0, 3, W); for (const z of [0.6, 3, 5.4]) box(db, 5.26, 0.07, 0.2, 0, 0.14, z, IRON);
  for (const x of [-2.6, 2.6]) box(db, 0.16, 0.3, 6, x, 0.2, 3, IRON); cyl(db, 0.12, 5.4, 'x', 0, 0, 0, IRON);
  const chains = [0, 1].map(() => { const m = sh(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1), IRON)); root.add(m); return m; });
  function bridgeSet(gk) {
    const th = -Math.PI / 2 * (1 - gk), s = Math.sin(th), c = Math.cos(th); db.rotation.x = th;
    chains.forEach((m, i) => { const sx = i ? 2.4 : -2.4, A = new THREE.Vector3(77.75 + sx, 15.5, 71.6), B = new THREE.Vector3(77.75 + sx, Y0 + 0.2 * c - 6 * s, 72 + 0.2 * s + 6 * c); m.position.copy(A).lerp(B, 0.5); m.scale.z = A.distanceTo(B); m.lookAt(B); });
  }
  bridgeSet(0);
  const bridgeWall = solid(75, 80.5, 71.8, 72.2, Y0, Y0 + 12);                            // la hoja levantada cierra el paso

  // ---------------- entrada al castillo: foso seco, descanso y fachada con portón ----------------
  box(root, 11, 0.3, 6, 77.75, 1, 75, STONE); for (const x of [72.2, 83.3]) box(root, 0.4, 5, 6, x, 3.5, 75, STONE);
  pad(11, 6, Y0, 77.75, 81, padA);
  box(root, 15, 9, 2, 77.75, 10.5, 84.5, STONE); box(root, 5, 6, 0.3, 77.75, 9, 83.45, dark);
  solid(70.25, 85.25, 83.4, 85.6, Y0, 15);                                                // fachada
  solid(75.0, 75.15, 72, 78, Y0, Y0 + 1.2); solid(80.35, 80.5, 72, 78, Y0, Y0 + 1.2);     // el foso queda a los lados del puente
  solid(72.2, 75, 72, 78, Y0, Y0 + 1.2); solid(80.5, 83.3, 72, 78, Y0, Y0 + 1.2);

  // ---------------- pasarela rota: módulo (muro norte) → puerta de la torre 2 ----------------
  { const bx = 85;
    for (let i = 0; i < 8; i++) box(root, 5, 0.12, 0.44, bx, Y2 - 0.06, 53 + i * 0.48, W, 0.01);
    for (let i = 0; i < 7; i++) box(root, 5, 0.12, 0.44, bx, Y2 - 0.06, 59.85 + i * 0.48, W, 0.01);
    addPlatform(82.5, 87.5, 51.9, 56.6, Y2); addPlatform(82.5, 87.5, 59.6, 63.0, Y2);
    for (const x of [-2.3, 2.3]) { box(root, 0.22, 0.28, 3.9, bx + x, Y2 - 0.26, 54.75, W); box(root, 0.22, 0.28, 3.5, bx + x, Y2 - 0.26, 61.25, W); }
    rail(82.55, 52.8, 82.55, 56.6, Y2); rail(87.45, 52.8, 87.45, 56.6, Y2); rail(87.45, 59.6, 87.45, 63, Y2);
    // tablones colgando en el borde del hueco
    for (const [z, dir, x, tilt] of [[56.6, 1, 83.8, 1.15], [56.6, 1, 86.2, 1.4], [59.6, -1, 85, 1.05]]) {
      const h = new THREE.Group(); h.position.set(x, Y2, z); h.rotation.x = dir * tilt; root.add(h); box(h, 1.1, 0.12, 0.44, 0, 0, dir * 0.22, W, 0.02); }
  }
  addPlatform(84, 86, 63, 63.6, Y2);                                                      // umbral de la puerta

  // ---------------- puerta con llave y palanca ----------------
  const hinge = new THREE.Group(); hinge.position.set(84, Y2, 63.3); root.add(hinge);
  box(hinge, 2, 2.4, 0.16, 1, 1.2, 0, W, 0.004); for (const y of [0.4, 1.2, 2]) box(hinge, 2, 0.14, 0.2, 1, y, 0, IRON);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xcc2a1a })); led.position.set(1.7, 1.9, 0.15); hinge.add(led);
  const doorWall = solid(84, 86, 63, 63.6, Y2, Y2 + 2.4);
  hinge.userData = { locked: true };

  const lever = new THREE.Group(); lever.position.set(85, Y2, 71.35); lever.rotation.y = Math.PI; root.add(lever);
  box(lever, 1.5, 1.7, 0.6, 0, 0.85, 0, STONE); box(lever, 1.1, 1, 0.12, 0, 1.05, 0.34, W);
  const gear = new THREE.Group(); gear.position.set(0, 1.05, 0.46); lever.add(gear); cyl(gear, 0.34, 0.1, 'z', 0, 0, 0, IRON, 16);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, t = box(gear, 0.12, 0.14, 0.1, Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0, IRON); t.rotation.z = a; }
  const arm = new THREE.Group(); arm.position.set(0, 1.05, 0.56); lever.add(arm); box(arm, 0.1, 0.95, 0.08, 0, 0.475, 0, IRON);
  const knob = sh(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), gold)); knob.position.y = 0.98; arm.add(knob);
  arm.rotation.z = 0.75;
  solid(84.25, 85.75, 70.7, 72, Y2, Y2 + 1.7);

  // ---------------- animación ----------------
  const st = { door: 0, doorT: 0, lev: 0, levT: 0, br: 0, opened: false };
  function update(dt) {
    st.door += Math.sign(st.doorT - st.door) * Math.min(Math.abs(st.doorT - st.door), dt * 0.9);
    st.lev += Math.sign(st.levT - st.lev) * Math.min(Math.abs(st.levT - st.lev), dt * 0.9);
    const de = st.door * st.door * (3 - 2 * st.door), le = st.lev * st.lev * (3 - 2 * st.lev);
    hinge.rotation.y = -de * 1.7; led.material.color.setHex(de > 0.05 ? 0x4cc24a : 0xcc2a1a);
    arm.rotation.z = 0.75 - 1.5 * le; gear.rotation.z = le * Math.PI * 1.4;
    const gt = st.lev > 0.85 ? 1 : 0;
    st.br += Math.sign(gt - st.br) * Math.min(Math.abs(gt - st.br), dt * 0.6);
    bridgeSet(st.br * st.br);
    if (st.br > 0.5 && !st.opened) {                                                       // la hoja ya está casi horizontal: se puede cruzar
      st.opened = true; bridgeWall.maxY = bridgeWall.minY - 1;
      addPlatform(75.15, 80.35, 72, 78, Y0);
    }
  }
  function unlock() {
    if (!hinge.userData.locked) return false;
    hinge.userData.locked = false; st.doorT = 1; doorWall.maxY = doorWall.minY - 1; return true;
  }
  function pull() { if (st.levT) return false; st.levT = 1; return true; }

  return { root, door: hinge, leverArm: arm, update, unlock, pull, state: st };
}
