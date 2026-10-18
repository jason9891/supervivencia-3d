// props-mundo.js — objetos del mundo para el mapa "El Regreso": mercado de la plaza, interior del establo,
// despacho y sala del módulo de dos pisos, piso 2 y almenas de las torres.
// No toca map1.js: se llama DESPUÉS de buildMap1 y registra sus colisiones en los mismos WALLS que exporta el mapa.
//   const { solids } = buildWorldProps(scene, { WALLS });
// Medidas en metros; +X este · +Z norte; el piso de la plaza está en y = 6 y el segundo piso del módulo en y = 11.5.
import * as THREE from 'three';
import { createMedievalMaterials, worldUV, buildTorch, buildChest, buildTable, buildChair } from './props-medieval.js';

const L1 = 6, L2 = 11.5;

export function buildWorldProps(scene, { WALLS = [], lights = true } = {}) {
  const M = createMedievalMaterials();
  const cm = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, side: THREE.DoubleSide });
  const C = {
    red: cm(0x9c2f2a), blue: cm(0x2f5d8a), green: cm(0x3f7a45), cream: cm(0xd9c9a0), ochre: cm(0xc79a3b), purple: cm(0x6b3f86),
    hay: cm(0xd2b04c, 0.95), apple: cm(0xb8281f, 0.5), apple2: cm(0x7fa83a, 0.5), bread: cm(0xb98a4e, 0.9), steel: cm(0xb9c0c7, 0.35, 0.8),
    dark: cm(0x2c2822, 0.9), rug: cm(0x6e1f1f, 0.95), paper: cm(0xe9dfc4, 0.7), flame: new THREE.MeshBasicMaterial({ color: 0xffb04a }),
  };
  const solids = [];                                        // [minX, maxX, minZ, maxZ, minY, maxY] de todo lo que bloquea (para pruebas)
  const root = new THREE.Group(); root.name = 'props-mundo'; scene.add(root);

  // ---- piezas básicas: se arman en coordenadas locales (frente = +Z) y se colocan con place() ----
  const mk = (g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const bx = (g, w, h, d, mat, x, y, z, solid = false, ry = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d); worldUV(geo, w, h, d, mat);
    const o = mk(g, geo, mat, x, y, z, 0, ry, 0);
    if (solid) (g.userData.solid = g.userData.solid || []).push([x, z, w, d, y - h / 2, y + h / 2]);
    return o;
  };
  const cyl = (g, r, h, mat, x, y, z, rx = 0, rz = 0, seg = 14) => mk(g, new THREE.CylinderGeometry(r, r, h, seg), mat, x, y, z, rx, 0, rz);
  const sph = (g, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = mk(g, new THREE.SphereGeometry(r, 10, 8), mat, x, y, z); o.scale.set(sx, sy, sz); return o; };

  function place(g, x, y, z, rotY = 0) {
    g.position.set(x, y, z); g.rotation.y = rotY; root.add(g);
    const c = Math.cos(rotY), s = Math.sin(rotY);
    let sol = g.userData.solid || [];
    if (sol.length && typeof sol[0] === 'number') sol = [[0, 0, sol[0], sol[1], 0, 1.0]];   // formato de props-medieval.js: [ancho, fondo]
    for (const [lx, lz, w, d, y0, y1] of sol) {
      const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;       // giro alrededor de Y
      const swap = Math.abs(s) > 0.7;
      const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
      const box = [wx - hw, wx + hw, wz - hd, wz + hd, y + y0, y + y1];
      solids.push(box); WALLS.push({ minX: box[0], maxX: box[1], minZ: box[2], maxZ: box[3], minY: box[4], maxY: box[5] });
    }
    return g;
  }

  const chair = () => buildChair(M);
  const barrel = () => { const g = new THREE.Group(); cyl(g, 0.34, 0.9, M.wood, 0, 0.45, 0, 0, 0, 16); for (const y of [0.18, 0.72]) cyl(g, 0.355, 0.05, M.iron, 0, y, 0, 0, 0, 16); cyl(g, 0.3, 0.02, C.dark, 0, 0.91, 0, 0, 0, 16); g.userData.solid = [[0, 0, 0.7, 0.7, 0, 0.9]]; return g; };
  const crate = (s = 0.7) => { const g = new THREE.Group(); bx(g, s, s, s, M.wood, 0, s / 2, 0, true); for (const x of [-s / 2 + 0.04, s / 2 - 0.04]) bx(g, 0.06, s + 0.02, s + 0.02, M.wood, x, s / 2, 0); return g; };
  const sack = () => { const g = new THREE.Group(); sph(g, 0.3, C.cream, 0, 0.28, 0, 1, 1.05, 0.85); sph(g, 0.1, C.cream, 0, 0.58, 0, 1, 0.8, 1); g.userData.solid = [[0, 0, 0.55, 0.45, 0, 0.6]]; return g; };
  const hay = (r = 0.7) => { const g = new THREE.Group(); sph(g, r, C.hay, 0, r * 0.55, 0, 1.2, 0.7, 1); sph(g, r * 0.6, C.hay, r * 0.5, r * 0.5, r * 0.3, 1, 0.7, 1); g.userData.solid = [[0, 0, r * 2, r * 1.5, 0, r * 0.9]]; return g; };
  const bale = () => { const g = new THREE.Group(); bx(g, 0.9, 0.45, 0.5, C.hay, 0, 0.225, 0, true); for (const x of [-0.25, 0.25]) bx(g, 0.04, 0.47, 0.52, C.dark, x, 0.225, 0); return g; };
  const bench = (len = 1.8) => { const g = new THREE.Group(); bx(g, len, 0.07, 0.38, M.wood, 0, 0.46, 0); for (const x of [-len / 2 + 0.2, len / 2 - 0.2]) bx(g, 0.08, 0.46, 0.34, M.wood, x, 0.23, 0); g.userData.solid = [[0, 0, len, 0.4, 0, 0.5]]; return g; };
  const lampPost = () => { const g = new THREE.Group(); cyl(g, 0.06, 2.6, M.wood, 0, 1.3, 0, 0, 0, 8); bx(g, 0.5, 0.06, 0.06, M.iron, 0.2, 2.4, 0); const lamp = bx(g, 0.2, 0.28, 0.2, M.iron, 0.42, 2.25, 0); sph(g, 0.1, C.flame, 0.42, 2.25, 0); g.userData.solid = [[0, 0, 0.16, 0.16, 0, 2.6]]; return g; };
  const cart = () => { const g = new THREE.Group(); bx(g, 1.8, 0.12, 1.0, M.wood, 0, 0.62, 0, true); for (const z of [-0.5, 0.5]) bx(g, 1.8, 0.4, 0.06, M.wood, 0, 0.85, z); bx(g, 0.06, 0.4, 1.0, M.wood, -0.9, 0.85, 0);
    for (const z of [-0.56, 0.56]) cyl(g, 0.45, 0.07, M.wood, 0.1, 0.45, z, Math.PI / 2, 0, 18); bx(g, 0.07, 0.07, 1.3, M.iron, 0.1, 0.45, 0); bx(g, 1.4, 0.07, 0.07, M.wood, 1.4, 0.55, -0.3, false, 0.1); bx(g, 1.4, 0.07, 0.07, M.wood, 1.4, 0.55, 0.3, false, -0.1);
    for (let i = 0; i < 3; i++) sph(g, 0.17, i % 2 ? C.apple2 : C.apple, -0.4 + i * 0.35, 0.8, (i - 1) * 0.15); return g; };
  const shelf = (w = 2, h = 2.1, books = true) => { const g = new THREE.Group(); for (const x of [-w / 2, w / 2]) bx(g, 0.07, h, 0.4, M.wood, x, h / 2, 0); bx(g, w, h, 0.04, M.wood, 0, h / 2, -0.18);
    for (const y of [0.05, 0.55, 1.05, 1.55, h - 0.04]) bx(g, w, 0.05, 0.4, M.wood, 0, y, 0);
    if (books) { const cols = [C.red, C.blue, C.green, C.ochre, C.purple, C.cream]; let i = 0; for (const y of [0.08, 0.58, 1.08, 1.58]) for (let x = -w / 2 + 0.12; x < w / 2 - 0.15; x += 0.1 + (i % 3) * 0.02) { const bh = 0.28 + ((i * 7) % 5) * 0.03; bx(g, 0.07, bh, 0.24, cols[i++ % 6], x, y + bh / 2 + 0.02, 0.02); } }
    g.userData.solid = [[0, 0, w, 0.42, 0, h]]; return g; };
  const banner = (mat, len = 1.8) => { const g = new THREE.Group(); cyl(g, 0.03, 0.8, M.wood, 0, 0, 0, 0, Math.PI / 2, 6).position.set(0, len / 2 + 0.05, 0.05); const cloth = bx(g, 0.7, len, 0.02, mat, 0, 0, 0.05); cloth.position.y = 0; bx(g, 0.2, 0.2, 0.025, C.ochre, 0, 0.2, 0.065, false, Math.PI / 4); return g; };
  const rug = (w, d, mat = C.rug) => { const g = new THREE.Group(); bx(g, w, 0.025, d, mat, 0, 0.0125, 0); bx(g, w - 0.4, 0.03, d - 0.4, C.ochre, 0, 0.014, 0); bx(g, w - 0.7, 0.035, d - 0.7, mat, 0, 0.016, 0); return g; };
  const candle = () => { const g = new THREE.Group(); cyl(g, 0.03, 0.14, C.cream, 0, 0.07, 0, 0, 0, 8); sph(g, 0.025, C.flame, 0, 0.17, 0, 1, 1.6, 1); return g; };
  const pitchfork = () => { const g = new THREE.Group(); cyl(g, 0.02, 1.7, M.wood, 0, 0.85, 0, 0, 0, 6); for (const x of [-0.07, 0, 0.07]) bx(g, 0.015, 0.25, 0.015, M.iron, x, 1.75, 0); bx(g, 0.16, 0.015, 0.015, M.iron, 0, 1.64, 0); g.rotation.z = 0.12; const w = new THREE.Group(); w.add(g); return w; };
  const trough = (len = 2) => { const g = new THREE.Group(); bx(g, len, 0.4, 0.5, M.wood, 0, 0.3, 0, true); bx(g, len - 0.1, 0.05, 0.4, C.dark, 0, 0.5, 0); for (const x of [-len / 2 + 0.2, len / 2 - 0.2]) bx(g, 0.1, 0.2, 0.4, M.wood, x, 0.1, 0); return g; };
  const anvil = () => { const g = new THREE.Group(); cyl(g, 0.22, 0.5, M.wood, 0, 0.25, 0, 0, 0, 10); bx(g, 0.7, 0.14, 0.26, M.iron, 0, 0.56, 0); bx(g, 0.3, 0.14, 0.2, M.iron, 0, 0.66, 0); bx(g, 0.2, 0.08, 0.1, M.iron, 0.4, 0.58, 0); g.userData.solid = [[0, 0, 0.8, 0.5, 0, 0.75]]; return g; };

  // ---- puestos del mercado: se construyen mirando a +Z ----
  function awning(g, w, d, mats) {
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) { bx(g, 0.1, 2.5, 0.1, M.wood, x, 1.25, -d / 2 + 0.06); bx(g, 0.1, 2.0, 0.1, M.wood, x, 1.0, d / 2 - 0.06); }
    const n = 6, sw = w / n, slope = Math.atan2(0.5, d);
    for (let i = 0; i < n; i++) { const o = bx(g, sw, 0.04, Math.hypot(d, 0.5) + 0.2, mats[i % mats.length], -w / 2 + sw * (i + 0.5), 2.27, 0); o.rotation.x = slope; }
  }
  function stall(kind) {
    const g = new THREE.Group(), w = 3.2, d = 1.6;
    awning(g, w, d, kind === 'comida' ? [C.red, C.cream] : kind === 'telas' ? [C.blue, C.cream] : [C.green, C.cream]);
    bx(g, w, 0.9, 0.6, M.wood, 0, 0.45, d / 2 - 0.4, true); bx(g, w + 0.1, 0.06, 0.7, M.wood, 0, 0.93, d / 2 - 0.4);
    bx(g, w - 0.2, 0.05, 0.5, M.wood, 0, 0.85, -d / 2 + 0.3);
    if (kind === 'comida') {
      for (let i = 0; i < 9; i++) sph(g, 0.09, i % 3 ? C.apple : C.apple2, -1.1 + (i % 5) * 0.16, 1.02 + (i > 4 ? 0.12 : 0), d / 2 - 0.4 + (i % 2) * 0.1);
      for (let i = 0; i < 3; i++) sph(g, 0.15, C.bread, 0.35 + i * 0.3, 1.0, d / 2 - 0.4, 1.3, 0.6, 0.7);
      cyl(g, 0.22, 0.2, M.wood, 1.2, 1.06, d / 2 - 0.45, 0, 0, 12);
      for (const x of [-1.2, 0.2]) { const b = barrel(); b.position.set(x, 0, -d / 2 + 0.3); b.userData = {}; g.add(b); }
    } else if (kind === 'telas') {
      const cols = [C.red, C.blue, C.green, C.ochre, C.purple, C.cream];
      for (let i = 0; i < 6; i++) cyl(g, 0.13, 0.7, cols[i], -1.15 + i * 0.46, 1.1, d / 2 - 0.4, 0, Math.PI / 2 - 0.0, 10).rotation.set(Math.PI / 2, 0, 0);
      for (let i = 0; i < 4; i++) bx(g, 0.5, 0.05 + i * 0.025, 0.4, cols[(i + 2) % 6], -0.6 + i * 0.5, 1.0, -d / 2 + 0.3);
      bx(g, w - 0.4, 0.04, 0.04, M.wood, 0, 2.05, -d / 2 + 0.25); for (let i = 0; i < 5; i++) bx(g, 0.5, 0.9, 0.02, cols[i], -1.0 + i * 0.5, 1.55, -d / 2 + 0.25);
    } else {   // armas
      for (let i = 0; i < 4; i++) { const x = -1.2 + i * 0.4; bx(g, 0.06, 0.8, 0.02, C.steel, x, 1.45, -d / 2 + 0.2); bx(g, 0.2, 0.04, 0.04, M.iron, x, 1.05, -d / 2 + 0.2); bx(g, 0.04, 0.18, 0.04, M.wood, x, 0.93, -d / 2 + 0.2); }
      bx(g, w - 0.4, 0.05, 0.06, M.wood, 0, 0.8, -d / 2 + 0.17);
      for (let i = 0; i < 3; i++) { const sh = cyl(g, 0.3, 0.05, i % 2 ? C.red : C.blue, 0.5 + i * 0.35, 1.28, -d / 2 + 0.3, Math.PI / 2 - 0.25, 0, 18); cyl(g, 0.07, 0.07, C.steel, 0.5 + i * 0.35, 1.3, -d / 2 + 0.36, Math.PI / 2 - 0.25, 0, 10); }
      for (let i = 0; i < 2; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.steel); h.position.set(-0.7 + i * 0.5, 1.0, d / 2 - 0.4); h.castShadow = true; g.add(h); }
    }
    return g;
  }

  // ============================ PLAZA (piso y = 6) ============================
  place(stall('comida'), 33, L1, 28, Math.PI / 2);          // comida: al oeste del pozo, de cara a él
  place(stall('telas'), 40, L1, 36, Math.PI);               // telas: al norte
  place(stall('armas'), 47, L1, 28, -Math.PI / 2);          // armas: al este
  { const g = new THREE.Group(); const a = anvil(); a.position.set(0, 0, 0); g.add(a); g.userData.solid = a.userData.solid; place(g, 40, L1, 20, 0); }
  for (const [x, z, r] of [[16, 4, 0], [16.9, 5, 0], [16, 5.9, 0], [64, 4.2, 0], [64.9, 5, 0], [64, 5.9, 0], [16, 58, 0]]) place(barrel(), x, L1, z, r);
  place(crate(0.8), 17.2, L1, 3.8); place(crate(0.6), 16.6, L1, 3.4); place(crate(0.7), 65.4, L1, 3.8); place(crate(0.6), 63.4, L1, 3.6);
  for (const [x, z] of [[27, 15], [53, 15], [27, 40], [53, 40], [40, 8], [22, 28], [58, 28]]) place(lampPost(), x, L1, z);
  place(bench(), 36.2, L1, 23.2, 0); place(bench(), 43.8, L1, 23.2, 0); place(bench(), 36.2, L1, 33.0, 0);
  place(cart(), 60, L1, 12, 0.3); place(cart(), 20.5, L1, 36, Math.PI / 2 + 0.2);
  for (const [x, z, r] of [[41, 42.2, 0.2], [42.1, 42.4, -0.1], [41.6, 42.3, 0]]) place(bale(), x, L1, z, r);
  place(sack(), 62.5, L1, 52); place(sack(), 63.2, L1, 52.6); place(crate(0.7), 64.5, L1, 53.5);
  place(banner(C.red, 2.2), 14.2, L1 + 3.2, 20, Math.PI / 2); place(banner(C.blue, 2.2), 14.2, L1 + 3.2, 40, Math.PI / 2);

  // ============================ ESTABLO (x 13.9-53.8, z 45-63) ============================
  for (const x of [30.4, 33.2]) { const g = new THREE.Group(); bx(g, 0.14, 1.5, 2.6, M.wood, 0, 0.75, 0, true); bx(g, 0.2, 1.6, 0.2, M.wood, 0, 0.8, 1.2); place(g, x, L1, 61.5, 0); }
  place(trough(2.2), 31.8, L1, 62.5, 0); place(hay(0.8), 31.8, L1, 60.2, 0.4); place(hay(0.7), 34.2, L1, 61.4, 1.1);
  place(pitchfork(), 14.45, L1, 52, Math.PI / 2); place(pitchfork(), 14.45, L1, 52.4, Math.PI / 2 + 0.1);
  place(shelf(2.2, 2.0, false), 14.5, L1, 57, Math.PI / 2);
  for (const [x, z] of [[17, 62], [18, 62.2], [17.4, 61], [16.2, 47.2], [17.1, 47.0]]) place(barrel(), x, L1, z);
  for (const [x, z, r] of [[37.5, 62, 0], [38.6, 62.2, 0.1], [37.9, 61, 0.3], [52.6, 62, 0], [52.6, 60.9, 0.1]]) place(bale(), x, L1, z, r);
  place(cart(), 46, L1, 58, 0.15); place(sack(), 50.8, L1, 61.5); place(sack(), 51.5, L1, 61.9); place(crate(0.7), 52.5, L1, 56);
  place(trough(2.4), 44, L1, 62.5, 0); place(hay(0.8), 44, L1, 60.5, 0); place(hay(0.6), 41, L1, 61.5, 0.8);
  place(banner(C.green, 1.7), 36.6, L1 + 3.0, 58, Math.PI / 2); place(banner(C.ochre, 1.7), 53.3, L1 + 3.0, 52, -Math.PI / 2);
  place(rug(3, 2), 26, L1, 56.5, 0);
  if (lights) { const t = buildTorch(M); place(t, 36.5, L1 + 2.4, 55, Math.PI / 2); }

  // ============================ MÓDULO · planta baja (x 68.2-89.2, z 2-52.5) ============================
  // despacho (sur): escritorio en (76, 11)
  place(chair(), 76, L1, 9.3, 0);
  place(rug(4, 3), 76, L1, 10.2, 0);
  { const c = candle(); c.position.set(75.3, L1 + 0.76, 11.1); root.add(c); const c2 = candle(); c2.position.set(76.8, L1 + 0.76, 11); root.add(c2); }
  for (const x of [71, 74]) place(shelf(2.2, 2.1), x, L1, 2.9, 0);
  place(shelf(2.4, 2.1), 69.2, L1, 9, Math.PI / 2); place(shelf(2.4, 2.1), 69.2, L1, 13, Math.PI / 2);
  place(shelf(2.2, 2.1), 79.5, L1, 2.9, 0);
  place(buildChest(M), 87.5, L1, 3.4, 0); place(crate(0.6), 70, L1, 25.8); place(crate(0.5), 70.7, L1, 26.3); place(barrel(), 88.4, L1, 26);
  place(banner(C.red, 2.0), 68.7, L1 + 3.0, 6, Math.PI / 2); place(banner(C.blue, 2.0), 68.7, L1 + 3.0, 24, Math.PI / 2);
  // sala (norte): mesa larga con bancos y sillas en los extremos
  { const g = new THREE.Group(); for (const dx of [-1.0, 1.0]) { const t = buildTable(M); t.position.set(dx, 0, 0); t.scale.set(1.15, 1, 1.25); g.add(t); } g.userData.solid = [[0, 0, 3.7, 1.05, 0, 0.85]]; place(g, 78.7, L1, 41, 0); }
  place(bench(3.4), 78.7, L1, 42.1, 0); place(bench(3.4), 78.7, L1, 39.9, 0);
  place(chair(), 76.0, L1, 41, -Math.PI / 2); place(chair(), 81.4, L1, 41, Math.PI / 2);
  place(rug(5, 3.2), 78.7, L1, 41, 0);
  for (const x of [71, 75, 82, 86]) place(banner(x % 2 ? C.red : C.blue, 2.1), x, L1 + 3.1, 51.9, Math.PI);
  place(shelf(2.4, 2.1), 69.2, L1, 36, Math.PI / 2); place(shelf(2.4, 2.1), 69.2, L1, 46, Math.PI / 2);
  place(buildChest(M), 87.6, L1, 36, -Math.PI / 2); place(buildChest(M), 87.6, L1, 47, -Math.PI / 2);
  place(barrel(), 88.4, L1, 33); place(barrel(), 88.4, L1, 33.8);
  if (lights) { place(buildTorch(M), 68.65, L1 + 2.5, 41, Math.PI / 2); place(buildTorch(M), 88.6, L1 + 2.5, 41, -Math.PI / 2); }
  else { place(buildTorch(M, { light: false }), 68.65, L1 + 2.5, 41, Math.PI / 2); }

  // ============================ MÓDULO · piso 2 (y 11.5) ============================
  for (const z of [26, 31, 37, 43]) place(shelf(2.4, 2.1), 69.2, L2, z, Math.PI / 2);
  { const g = new THREE.Group(); const t = buildTable(M); t.scale.set(1.3, 1, 1.2); g.add(t); g.userData.solid = [[0, 0, 2.1, 1.0, 0, 0.85]]; place(g, 78, L2, 34, 0); }
  place(chair(), 78, L2, 35.1, Math.PI); place(chair(), 78, L2, 32.9, 0); place(rug(4, 3), 78, L2, 34, 0);
  place(buildChest(M), 87.5, L2, 30, -Math.PI / 2); place(buildChest(M), 87.5, L2, 40, -Math.PI / 2); place(barrel(), 88.4, L2, 46); place(crate(0.6), 70.2, L2, 49);
  place(banner(C.purple, 2.0), 73, L2 + 3.1, 51.9, Math.PI); place(banner(C.purple, 2.0), 85, L2 + 3.1, 51.9, Math.PI);

  // ============================ TORRES: almenas, estandartes y antorchas ============================
  { const towers = [[67.5, 75, 63, 72], [80.5, 90, 63, 72]], top = L1 + 10.7;
    for (const [x0, x1, z0, z1] of towers) {
      const g = new THREE.Group(), merlon = (x, z) => bx(g, 0.7, 0.8, 0.7, M.wall, x, top + 0.4, z);
      for (let x = x0 + 0.5; x <= x1 - 0.4; x += 1.3) { merlon(x, z0 + 0.35); merlon(x, z1 - 0.35); }
      for (let z = z0 + 1.8; z <= z1 - 1.7; z += 1.3) { merlon(x0 + 0.35, z); merlon(x1 - 0.35, z); }
      root.add(g);
    }
    place(banner(C.red, 3), 71.25, L1 + 7.5, 62.8, 0); place(banner(C.red, 3), 85.25, L1 + 7.5, 62.8, 0);
    if (lights) { place(buildTorch(M), 75.1, L1 + 3.2, 66, Math.PI / 2); place(buildTorch(M), 80.4, L1 + 3.2, 66, -Math.PI / 2); }
  }
  return { root, solids };
}
