// map1.js — El Regreso
// Rio bajo -> camino de piedras -> reja -> patio elevado (alturas reales).

import * as THREE from 'three';

export const MAP1_NAME = 'El Regreso';
export const CASTLE_Y = 2.6;

export const ZONES = {
  river:     { minX: -14, maxX: 14, minZ: 88,  maxZ: 115 },
  approach:  { minX: -10, maxX: 10, minZ: 55,  maxZ: 90 },
  gate:      { minX: -9,  maxX: 9,  minZ: 42,  maxZ: 58 },
  courtyard: { minX: -18, maxX: 18, minZ: -16, maxZ: 42 },
  easthall:  { minX: 16,  maxX: 34, minZ: -12, maxZ: 12 },
  library:   { minX: -38, maxX: -16, minZ: -16, maxZ: 16 },
  southhall: { minX: -12, maxX: 12, minZ: -40, maxZ: -16 },
  boss:      { minX: -16, maxX: 16, minZ: -64, maxZ: -38 },
};

export function getCurrentZone(x, z) {
  for (const [name, b] of Object.entries(ZONES)) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name;
  }
  return null;
}

export const STORY_PAGE = {
  title: 'Página encontrada',
  text: `...los sellos se debilitan.\nLo que creíamos leyenda ha vuelto a caminar.\nSi lees esto, ya es demasiado tarde para huir.\nBusca las seis runas. Solo ellas pueden volver a dormir al que no debe despertar.`,
};

const PAGE_POS = new THREE.Vector3(-28, CASTLE_Y + 0.95, -4);
const PLAYER_R = 0.4;
export const WALLS = [];
export const PLATFORMS = [];

function addWall(minX, maxX, minZ, maxZ) {
  WALLS.push({ minX, maxX, minZ, maxZ });
}
function addPlatform(minX, maxX, minZ, maxZ, y) {
  PLATFORMS.push({ minX, maxX, minZ, maxZ, y });
}

export function getGroundHeight(x, z) {
  let best = -Infinity;
  for (const p of PLATFORMS) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
      if (p.y > best) best = p.y;
    }
  }
  return best === -Infinity ? 0 : best;
}

export function resolveGround(player) {
  const gy = getGroundHeight(player.x, player.z);
  if (player.y <= gy + 0.4) {
    if (player.vy <= 0.6) {
      player.y = gy;
      player.vy = 0;
      player.grounded = true;
      player.jumping = false;
      player.avx = 0;
      player.avz = 0;
    }
  } else if (player.grounded && player.y - gy > 0.55) {
    player.grounded = false;
  }
}

export function resolveWallCollisions(player) {
  let x = player.x;
  let z = player.z;
  for (const w of WALLS) {
    const nearestX = Math.max(w.minX, Math.min(x, w.maxX));
    const nearestZ = Math.max(w.minZ, Math.min(z, w.maxZ));
    const dx = x - nearestX;
    const dz = z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < PLAYER_R * PLAYER_R && distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      const push = (PLAYER_R - dist) / dist;
      x += dx * push;
      z += dz * push;
    } else if (distSq <= 1e-8) {
      const left = x - w.minX, right = w.maxX - x;
      const near = z - w.minZ, far = w.maxZ - z;
      const m = Math.min(left, right, near, far);
      if (m === left) x = w.minX - PLAYER_R;
      else if (m === right) x = w.maxX + PLAYER_R;
      else if (m === near) z = w.minZ - PLAYER_R;
      else z = w.maxZ + PLAYER_R;
    }
  }
  player.x = x;
  player.z = z;
}

export function buildMap1(scene) {
  WALLS.length = 0;
  PLATFORMS.length = 0;

  const mat = (color, roughness = 0.84, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const stone = mat(0x6a7068, 0.9);
  const dark  = mat(0x4a5048, 0.88);
  const floor = mat(0x5c625a, 0.94);
  const dirt  = mat(0x5a5348, 0.95);
  const wood  = mat(0x6b4a32, 0.85);
  const iron  = mat(0x3a3a40, 0.4, 0.55);
  const moss  = mat(0x4a6b42, 0.92);
  const tile  = mat(0x555a52, 0.9);
  const stepMat = mat(0x5a6058, 0.88);
  const rockMat = mat(0x5a5850, 0.95);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2a4a5a, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.72,
  });

  function box(w, h, d, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return m;
  }

  function cyl(rTop, rBot, h, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 10), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (solid) {
      const r = Math.max(rTop, rBot) + 0.06;
      addWall(x - r, x + r, z - r, z + r);
    }
    return m;
  }

  function bigRock(x, y, z, s = 1) {
    cyl(0.9 * s, 1.1 * s, 1.4 * s, rockMat, x, y + 0.7 * s, z, true);
    box(1.6 * s, 1.0 * s, 1.3 * s, dark, x + 0.3 * s, y + 0.5 * s, z - 0.2 * s, true);
    cyl(0.5 * s, 0.6 * s, 0.9 * s, moss, x - 0.4 * s, y + 0.45 * s, z + 0.3 * s, true);
  }

  function stepPad(w, d, surfaceY, x, z, th = 0.45) {
    box(w, th, d, stepMat, x, surfaceY - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, surfaceY);
  }

  function floorPad(w, d, surfaceY, x, z, material = floor) {
    const th = 0.4;
    box(w, th, d, material, x, surfaceY - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, surfaceY);
  }

  // ---- RIO / ORILLA BAJA ----
  const river = new THREE.Mesh(new THREE.PlaneGeometry(42, 30), waterMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(2, -0.12, 103);
  scene.add(river);
  // brazo de rio al costado del camino
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(6, 36), waterMat);
  stream.rotation.x = -Math.PI / 2;
  stream.position.set(9, -0.08, 80);
  scene.add(stream);

  floorPad(16, 12, 0.0, 0, 108, dirt);
  floorPad(14, 8, 0.0, 0, 98, dirt);
  bigRock(-7, 0, 106, 1.4);
  bigRock(7.5, 0, 104, 1.3);
  bigRock(-8, 0, 96, 1.1);
  bigRock(8, 0, 97, 1.2);
  bigRock(-6, 0, 112, 1.0);
  bigRock(6.5, 0, 110, 0.95);
  cyl(0.2, 0.25, 0.8, moss, -3, 0.3, 105);
  cyl(0.18, 0.22, 0.7, moss, 4, 0.25, 100);

  // ---- CAMINO QUE SUBE ----
  const climb = [
    [92, 0.35, 10], [88, 0.7, 9.5], [84, 1.05, 9], [80, 1.4, 9],
    [76, 1.75, 8.5], [72, 2.1, 8.5], [68, 2.35, 9], [64, 2.5, 10],
    [60, CASTLE_Y, 11], [55, CASTLE_Y, 12],
  ];
  for (const [z, y, w] of climb) stepPad(w, 4.3, y, 0, z, 0.5);

  bigRock(-6.5, 0.3, 90, 1.3);
  bigRock(6.8, 0.2, 86, 1.4);
  bigRock(-7, 0.5, 78, 1.5);
  bigRock(7.2, 0.6, 74, 1.35);
  bigRock(-6.8, 0.8, 68, 1.4);
  bigRock(7, 1.0, 65, 1.3);
  bigRock(-7.5, 1.2, 58, 1.2);
  bigRock(7.5, 1.3, 56, 1.25);

  // ---- REJA (abierta al centro; se puede pasar) ----
  floorPad(14, 10, CASTLE_Y, 0, 48, floor);
  box(1.5, 5.5, 10, dark, -6.5, CASTLE_Y + 2.5, 48, true);
  box(1.5, 5.5, 10, dark,  6.5, CASTLE_Y + 2.5, 48, true);
  box(14, 1.2, 1.4, dark, 0, CASTLE_Y + 5.2, 52);
  // Hojas laterales (centro libre ~6m)
  const gate = box(3.2, 5.0, 0.4, iron, -4.6, CASTLE_Y + 2.3, 52.2, true);
  gate.name = 'mainGate';
  box(3.2, 5.0, 0.4, iron, 4.6, CASTLE_Y + 2.3, 52.2, true);
  for (let i = 0; i < 4; i++) {
    box(0.1, 4.6, 0.1, iron, -5.5 + i * 0.7, CASTLE_Y + 2.2, 52.15);
    box(0.1, 4.6, 0.1, iron, 3.5 + i * 0.7, CASTLE_Y + 2.2, 52.15);
  }

  // ---- PATIO ELEVADO ----
  floorPad(34, 34, CASTLE_Y, 0, 10, dirt);
  // Fuente
  cyl(2.3, 2.4, 0.45, stone, 0, CASTLE_Y + 0.12, 10, true);
  cyl(1.5, 1.6, 0.65, dark, 0, CASTLE_Y + 0.5, 10, true);
  cyl(0.32, 0.38, 1.1, stone, 0, CASTLE_Y + 1.15, 10, true);

  // Muros patio con huecos
  box(9, 2.0, 0.85, stone, -11, CASTLE_Y + 0.9, 26.5, true);
  box(9, 2.0, 0.85, stone,  11, CASTLE_Y + 0.9, 26.5, true);
  box(9, 2.0, 0.85, stone, -11, CASTLE_Y + 0.9, -6.5, true);
  box(9, 2.0, 0.85, stone,  11, CASTLE_Y + 0.9, -6.5, true);
  box(0.85, 2.0, 9, stone, -16.5, CASTLE_Y + 0.9, 1, true);
  box(0.85, 2.0, 9, stone, -16.5, CASTLE_Y + 0.9, 19, true);
  box(0.85, 2.0, 9, stone,  16.5, CASTLE_Y + 0.9, 1, true);
  box(0.85, 2.0, 9, stone,  16.5, CASTLE_Y + 0.9, 19, true);

  cyl(2.0, 2.2, 4.2, stone, -15, CASTLE_Y + 1.9, 24, true);
  cyl(2.0, 2.2, 4.2, stone,  15, CASTLE_Y + 1.9, 24, true);
  cyl(2.0, 2.2, 4.2, stone, -15, CASTLE_Y + 1.9, -4, true);
  cyl(2.0, 2.2, 4.2, stone,  15, CASTLE_Y + 1.9, -4, true);

  box(1.5, 0.45, 1.0, dark, -7, CASTLE_Y + 0.18, 15);
  box(1.2, 0.35, 0.9, stone, 6, CASTLE_Y + 0.12, 6);
  cyl(0.25, 0.3, 1.2, moss, 4, CASTLE_Y + 0.5, 17, true);

  const herbs = [];
  function createHerb(x, z) {
    const group = new THREE.Group();
    const leafMat = mat(0x5a9a48, 0.85);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.14 + Math.random() * 0.05, 0.26 + Math.random() * 0.08, 5),
        leafMat
      );
      leaf.position.set((Math.random() - 0.5) * 0.18, 0.13, (Math.random() - 0.5) * 0.18);
      leaf.rotation.z = (Math.random() - 0.5) * 0.4;
      leaf.castShadow = true;
      group.add(leaf);
    }
    group.position.set(x, CASTLE_Y, z);
    group.userData = { type: 'herb', heal: 8, collected: false };
    scene.add(group);
    herbs.push(group);
  }
  [[-9, 16], [8, 14], [-4, 1], [5, 3], [-11, 8], [10, 19], [-2, 20], [3, -1]].forEach(([x, z]) => createHerb(x, z));

  // ---- ALA ESTE ----
  floorPad(14, 22, CASTLE_Y, 24, 10, floor);
  box(1.1, 4.6, 22, dark, 30.5, CASTLE_Y + 2.1, 10, true);
  box(14, 4.6, 1.1, dark, 24, CASTLE_Y + 2.1, 20.5, true);
  box(14, 4.6, 1.1, dark, 24, CASTLE_Y + 2.1, -0.5, true);
  box(14, 0.35, 22, dark, 24, CASTLE_Y + 4.5, 10);
  cyl(0.32, 0.36, 3.8, stone, 20, CASTLE_Y + 1.8, 14, true);
  cyl(0.32, 0.36, 3.8, stone, 20, CASTLE_Y + 1.8, 6, true);

  // ---- BIBLIOTECA OESTE ----
  floorPad(18, 28, CASTLE_Y, -26, 10, tile);
  box(1.2, 6.5, 28, dark, -34.5, CASTLE_Y + 3.0, 10, true);
  box(18, 6.5, 1.2, dark, -26, CASTLE_Y + 3.0, 23.5, true);
  box(18, 6.5, 1.2, dark, -26, CASTLE_Y + 3.0, -3.5, true);
  box(18, 0.35, 28, dark, -26, CASTLE_Y + 6.5, 10);
  // Mezzanine
  box(5.5, 0.32, 18, wood, -30.5, CASTLE_Y + 3.4, 10);
  box(0.12, 0.9, 18, iron, -27.7, CASTLE_Y + 3.95, 10);
  // Gradas solidas (bloquean; altura de mezzanine visual)
  for (let i = 0; i < 8; i++) {
    const h = 0.38 * (i + 1);
    const z = 18.5 - i * 0.85;
    box(2.4, h, 0.85, stepMat, -30.5, CASTLE_Y + h / 2, z, true);
  }
  box(0.55, 3.0, 10, wood, -33.5, CASTLE_Y + 1.4, 14);
  box(0.55, 3.0, 8, wood, -33.5, CASTLE_Y + 1.4, 4);
  const s1 = box(4.5, 0.3, 1.0, wood, -22, CASTLE_Y + 0.35, 13);
  s1.rotation.z = 0.4;
  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  pageMesh.rotation.x = -Math.PI / 2 + 0.12;
  pageMesh.userData = { type: 'storyPage', read: false };

  // ---- SUR -> JEFE ----
  floorPad(20, 22, CASTLE_Y, 0, -18, floor);
  box(1.2, 4.8, 22, dark, -10, CASTLE_Y + 2.2, -18, true);
  box(1.2, 4.8, 22, dark,  10, CASTLE_Y + 2.2, -18, true);
  box(20, 0.3, 8, dark, 0, CASTLE_Y + 4.6, -14);
  box(20, 0.3, 6, dark, 0, CASTLE_Y + 4.6, -22);

  floorPad(28, 22, CASTLE_Y, 0, -40, tile);
  box(1.3, 6.5, 22, dark, -14, CASTLE_Y + 3.0, -40, true);
  box(1.3, 6.5, 22, dark,  14, CASTLE_Y + 3.0, -40, true);
  box(5, 6.5, 1.2, dark, -9, CASTLE_Y + 3.0, -29.5, true);
  box(5, 6.5, 1.2, dark,  9, CASTLE_Y + 3.0, -29.5, true);
  box(28, 6.5, 1.3, dark, 0, CASTLE_Y + 3.0, -50.5, true);
  box(3.5, 1.3, 1.0, iron, 0, CASTLE_Y + 5.8, -50.2);
  box(28, 0.35, 22, dark, 0, CASTLE_Y + 6.5, -40);
  cyl(0.45, 0.5, 6.0, stone, -7, CASTLE_Y + 2.8, -38, true);
  cyl(0.45, 0.5, 6.0, stone,  7, CASTLE_Y + 2.8, -38, true);
  cyl(0.4, 0.45, 5.5, stone, -7, CASTLE_Y + 2.5, -45, true);
  cyl(0.4, 0.45, 5.5, stone,  7, CASTLE_Y + 2.5, -45, true);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 220),
    mat(0x141814, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.6, 20);
  ground.receiveShadow = true;
  scene.add(ground);

  return { gate, herbs, pageMesh, pagePos: PAGE_POS.clone() };
}

export function distanceToPage(x, y, z) {
  return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z);
}
