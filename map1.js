// map1.js — El Regreso (prototipo croquis)
// Orientación: nivel 0 abajo-izquierda · Torre 2 arriba-derecha.
// Rectángulo cerrado por montañas; rocas sólidas en la rampa.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';

export const MAP1_NAME = 'El Regreso';
export const LEVEL0_Y = 0;
export const LEVEL1_Y = 8;

// Rectángulo del mapa (todo el contenido dentro)
export const MAP = {
  minX: -95, maxX: 95,
  minZ: -105, maxZ: 75,
};

export const SPAWN = { x: -72, y: LEVEL0_Y, z: -90 };

export const ZONES = {
  ramp: { minX: -90, maxX: -5, minZ: -100, maxZ: -15 },
  corridor: { minX: -15, maxX: 55, minZ: -30, maxZ: -10 },
  plaza: { minX: -55, maxX: 25, minZ: -15, maxZ: 50 },
  stable: { minX: 15, maxX: 48, minZ: 0, maxZ: 40 },
  module: { minX: -55, maxX: -15, minZ: 20, maxZ: 55 },
  towers: { minX: 50, maxX: 90, minZ: -15, maxZ: 65 },
};

export function getCurrentZone(x, z) {
  for (const [name, b] of Object.entries(ZONES)) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name;
  }
  return null;
}

export const STORY_PAGE = {
  title: 'Oficina del consejero',
  text: `...los sellos se debilitan.\nLo que creíamos leyenda ha vuelto a caminar.\nBusca las seis runas.`,
};

let PAGE_POS = new THREE.Vector3(0, LEVEL1_Y + 1, 0);
let KEY_POS = new THREE.Vector3(0, LEVEL1_Y + 1, 0);
let LEVER_POS = new THREE.Vector3(0, LEVEL1_Y + 1, 0);
let FOOD_POS = new THREE.Vector3(0, LEVEL1_Y + 0.5, 0);

const PLAYER_R = 0.4;
export const WALLS = [];
export const PLATFORMS = [];

function addWall(minX, maxX, minZ, maxZ) { WALLS.push({ minX, maxX, minZ, maxZ }); }
function addPlatform(minX, maxX, minZ, maxZ, y) { PLATFORMS.push({ minX, maxX, minZ, maxZ, y }); }

export function getGroundHeight(x, z, fromY = Infinity) {
  let best = -Infinity;
  const ry = sampleRampY(x, z);
  if (ry !== null && ry <= fromY + 0.55 && ry > best) best = ry;
  for (const p of PLATFORMS) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
      if (p.y <= fromY + 0.55 && p.y > best) best = p.y;
    }
  }
  return best === -Infinity ? LEVEL0_Y : best;
}

export function resolveGround(player) {
  const gy = getGroundHeight(player.x, player.z, player.y);
  if (player.y <= gy + 0.5) {
    if (player.vy <= 0.7) {
      player.y = gy; player.vy = 0;
      player.grounded = true; player.jumping = false;
      player.avx = 0; player.avz = 0;
    }
  } else if (player.grounded && player.y - gy > 0.6) {
    player.grounded = false;
  }
}

export function resolveWallCollisions(player) {
  let x = player.x, z = player.z;
  for (const w of WALLS) {
    const nx = Math.max(w.minX, Math.min(x, w.maxX));
    const nz = Math.max(w.minZ, Math.min(z, w.maxZ));
    const dx = x - nx, dz = z - nz;
    const distSq = dx * dx + dz * dz;
    if (distSq < PLAYER_R * PLAYER_R && distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      const push = (PLAYER_R - dist) / dist;
      x += dx * push; z += dz * push;
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
  // clamp duro al rectángulo interior (por si acaso)
  const m = 2.5;
  x = Math.max(MAP.minX + m, Math.min(MAP.maxX - m, x));
  z = Math.max(MAP.minZ + m, Math.min(MAP.maxZ - m, z));
  player.x = x; player.z = z;
}

export function distanceToPage(x, y, z) { return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z); }
export function distanceToKey(x, y, z) { return Math.hypot(x - KEY_POS.x, y - KEY_POS.y, z - KEY_POS.z); }
export function distanceToLever(x, y, z) { return Math.hypot(x - LEVER_POS.x, y - LEVER_POS.y, z - LEVER_POS.z); }
export function distanceToFood(x, y, z) { return Math.hypot(x - FOOD_POS.x, y - FOOD_POS.y, z - FOOD_POS.z); }
export { getSlopeAt };

export function buildMap1(scene) {
  WALLS.length = 0;
  PLATFORMS.length = 0;
  clearRamps();

  const mat = (color, roughness = 0.84, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const stone = mat(0x6a7068, 0.9);
  const dark = mat(0x4a5048, 0.88);
  const dirt = mat(0x5a5348, 0.95);
  const rockM = mat(0x5a5850, 0.95);
  const wood = mat(0x6b4a32, 0.85);
  const iron = mat(0x3a3a40, 0.4, 0.55);
  const tile = mat(0x555a52, 0.9);
  const mountain = mat(0x3a3e38, 0.98);

  function box(w, h, d, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return m;
  }
  function cyl(rTop, rBot, h, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 8),
      material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (solid) {
      const r = Math.max(rTop, rBot) + 0.08;
      addWall(x - r, x + r, z - r, z + r);
    }
    return m;
  }
  function pad(w, d, y, x, z, material) {
    const th = Math.max(0.4, 0.3 + y * 0.05);
    box(w, th, d, material, x, y - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y);
  }

  // ——— MONTAÑAS / borde del rectángulo (no se puede salir) ———
  const { minX, maxX, minZ, maxZ } = MAP;
  const wallH = 22;
  const wallT = 6;
  // Norte
  box(maxX - minX + wallT * 2, wallH, wallT, mountain, (minX + maxX) / 2, wallH / 2 - 2, maxZ + wallT / 2, true);
  // Sur
  box(maxX - minX + wallT * 2, wallH, wallT, mountain, (minX + maxX) / 2, wallH / 2 - 2, minZ - wallT / 2, true);
  // Oeste
  box(wallT, wallH, maxZ - minZ, mountain, minX - wallT / 2, wallH / 2 - 2, (minZ + maxZ) / 2, true);
  // Este
  box(wallT, wallH, maxZ - minZ, mountain, maxX + wallT / 2, wallH / 2 - 2, (minZ + maxZ) / 2, true);
  // Picos visuales irregulares en el perímetro
  const peaks = [
    [-90, -100, 1.2], [-70, -102, 1.5], [-40, -100, 1.1], [0, -102, 1.4], [40, -100, 1.2], [80, -102, 1.3],
    [-92, -60, 1.3], [-92, -20, 1.1], [-92, 20, 1.4], [-92, 50, 1.2],
    [92, -60, 1.2], [92, -10, 1.5], [92, 30, 1.3], [92, 60, 1.4],
    [-60, 72, 1.3], [-20, 74, 1.1], [20, 72, 1.4], [60, 74, 1.2], [85, 70, 1.5],
  ];
  for (const [px, pz, s] of peaks) {
    cyl(1.2 * s, 2.2 * s, 4 + 5 * s, mountain, px, 1 + 2.5 * s, pz, true);
    cyl(0.7 * s, 1.1 * s, 2.5 * s, rockM, px + 1.5, 0.8 + 1.2 * s, pz + 1.2, true);
  }

  // ——— 1. Parte plana nivel 0 — esquina INFERIOR IZQUIERDA ———
  pad(22, 18, LEVEL0_Y, -72, -90, dirt);

  // ——— 2. RAMPA DIAGONAL 0 → 1 ———
  const rampDef = {
    sx: -64, sz: -80,
    ex: -16, ez: -26,
    y0: LEVEL0_Y, y1: LEVEL1_Y,
    halfWidth: 5.5,
  };
  addRamp(rampDef);
  buildRampMesh(THREE, scene, rampDef, stone);
  for (const side of [-1, 1]) {
    const r = RAMPS[0];
    const ox = r.px * (r.halfWidth + 0.4) * side;
    const oz = r.pz * (r.halfWidth + 0.4) * side;
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, r.len), dark);
    g.position.set((r.sx + r.ex) / 2 + ox, (r.y0 + r.y1) / 2 + 0.25, (r.sz + r.ez) / 2 + oz);
    g.rotation.y = Math.atan2(r.dx, r.dz);
    g.castShadow = true;
    scene.add(g);
  }

  // ——— Piedras NO TRASPASABLES junto a la rampa (prueba de colisión) ———
  const rampRocks = [
    [-70, -75, 1.3], [-68, -70, 1.1], [-55, -82, 1.4], [-48, -65, 1.2],
    [-40, -55, 1.5], [-32, -48, 1.1], [-25, -40, 1.3], [-20, -35, 1.0],
    [-58, -60, 1.2], [-45, -72, 1.0], [-35, -58, 1.35],
  ];
  for (const [rx, rz, s] of rampRocks) {
    cyl(0.9 * s, 1.35 * s, 1.6 * s, rockM, rx, LEVEL0_Y + 0.8 * s, rz, true);
  }

  // ——— 3. Rellano nivel 1 ———
  pad(30, 24, LEVEL1_Y, -10, -20, stone);

  // ——— 4. Pasadizo en X + reja ———
  pad(52, 12, LEVEL1_Y, 22, -18, stone);
  box(1.0, 5.5, 12, dark, 0, LEVEL1_Y + 2.5, -18, true);
  box(1.0, 5.5, 12, dark, 44, LEVEL1_Y + 2.5, -18, true);
  box(52, 1.0, 1.0, dark, 22, LEVEL1_Y + 5.5, -12);
  box(52, 1.0, 1.0, dark, 22, LEVEL1_Y + 5.5, -24);
  const gateLeft = box(3.2, 4.5, 0.45, iron, 16, LEVEL1_Y + 2.1, -18, false);
  const gateRight = box(3.2, 4.5, 0.45, iron, 28, LEVEL1_Y + 2.1, -18, false);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  // ——— 5. Plaza (interior del rectángulo) ———
  pad(75, 55, LEVEL1_Y, -8, 22, dirt);
  box(6, 0.5, 6, stone, -12, LEVEL1_Y + 0.2, 18, true);
  box(3.5, 0.8, 3.5, dark, -12, LEVEL1_Y + 0.6, 18, true);

  // ——— 6. Establo ———
  pad(22, 28, LEVEL1_Y, 32, 20, wood);
  box(0.8, 5, 28, dark, 21.5, LEVEL1_Y + 2.3, 20, true);
  box(0.8, 5, 10, dark, 42.5, LEVEL1_Y + 2.3, 30, true);
  box(0.8, 5, 10, dark, 42.5, LEVEL1_Y + 2.3, 10, true);
  box(22, 5, 0.8, dark, 32, LEVEL1_Y + 2.3, 33.5, true);
  box(22, 5, 0.8, dark, 32, LEVEL1_Y + 2.3, 6.5, true);
  box(0.5, 4.5, 8, dark, 32, LEVEL1_Y + 2.1, 20, true);
  box(23, 0.4, 29, dark, 32, LEVEL1_Y + 5.2, 20);
  FOOD_POS.set(30, LEVEL1_Y + 0.5, 26);
  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);

  // ——— 7. Módulo 2 niveles (placeholder, interior del rectángulo) ———
  pad(30, 28, LEVEL1_Y, -35, 36, tile);
  box(30, 6, 0.9, dark, -35, LEVEL1_Y + 2.8, 49.5, true);
  box(30, 6, 0.9, dark, -35, LEVEL1_Y + 2.8, 22.5, true);
  box(0.9, 6, 28, dark, -49.5, LEVEL1_Y + 2.8, 36, true);
  box(0.9, 6, 10, dark, -20.5, LEVEL1_Y + 2.8, 46, true);
  box(0.9, 6, 10, dark, -20.5, LEVEL1_Y + 2.8, 26, true);
  box(31, 0.4, 29, dark, -35, LEVEL1_Y + 6.2, 36);

  // ——— 8. Torres: Torre 2 = SUPERIOR DERECHA del rectángulo ———
  pad(28, 50, LEVEL1_Y, 68, 25, stone);
  // Torre 1 (más al sur / abajo en el papel)
  box(12, 14, 12, dark, 70, LEVEL1_Y + 6.5, 0, true);
  addPlatform(64, 76, -6, 6, LEVEL1_Y + 12);
  // Torre 2 (arriba-derecha)
  box(12, 14, 12, dark, 70, LEVEL1_Y + 6.5, 50, true);
  addPlatform(64, 76, 44, 56, LEVEL1_Y + 12);
  const portcullis = box(10, 8, 0.6, iron, 70, LEVEL1_Y + 3.5, 25, true);
  portcullis.name = 'portcullis';
  box(4, 0.35, 8, wood, 70, LEVEL1_Y + 11.8, 22);
  addPlatform(68, 72, 18, 26, LEVEL1_Y + 12);

  PAGE_POS.set(-32, LEVEL1_Y + 1.2, 38);
  KEY_POS.set(-30, LEVEL1_Y + 1.1, 36);
  LEVER_POS.set(70, LEVEL1_Y + 12.5, 50);
  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  const keyMesh = box(0.3, 0.08, 0.12, mat(0xc9a227, 0.4, 0.6), KEY_POS.x, KEY_POS.y, KEY_POS.z);
  const leverArm = box(0.12, 0.12, 0.8, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z);
  const towerDoor = box(1.5, 2.4, 0.3, wood, 70, LEVEL1_Y + 13, 44, true);
  towerDoor.userData = { locked: true };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mat(0x121612, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -1, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  return {
    gate, gateLeft, gateRight, portcullis,
    pageMesh, keyMesh, foodMesh, leverArm, towerDoor,
    hallDoor: null, herbs: [], creature: null,
    pagePos: PAGE_POS.clone(), keyPos: KEY_POS.clone(), leverPos: LEVER_POS.clone(),
    spawn: { ...SPAWN },
  };
}

export function closePassageGate(mapData) {
  if (!mapData?.gate || mapData.gate.userData.closed) return;
  mapData.gate.userData.closed = true;
  addWall(20, 24, -19, -17);
  if (mapData.gateLeft) mapData.gateLeft.position.x = 21;
  if (mapData.gateRight) mapData.gateRight.position.x = 23;
}

export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  mapData.towerDoor.position.y = -40;
  return true;
}
