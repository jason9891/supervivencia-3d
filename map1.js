// map1.js — El Regreso
// Rampa IZQUIERDA a lo largo de +Z hasta el borde norte.
// Giro DERECHA (+X) → pasadizo entre borde norte y pared del establo.
// Fin del pasadizo → entrada a la plaza (hueco en muro sur).
// eje-x papel = +Z · eje-y papel = +X · altura = Y.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';

export const MAP1_NAME = 'El Regreso';
export const LEVEL0_Y = 0;
export const LEVEL1_Y = 8;

export const MAP = { minX: 0, maxX: 130, minZ: -20, maxZ: 130 };
export const SPAWN = { x: 12, y: LEVEL0_Y, z: -8, facing: 0 };

export const MAP_CENTER = {
  x: (MAP.minX + MAP.maxX) / 2,
  z: (MAP.minZ + MAP.maxZ) / 2,
  y: LEVEL1_Y,
};

export const ZONES = {
  ramp: { minX: 4, maxX: 22, minZ: -15, maxZ: 112 },
  corridor: { minX: 22, maxX: 100, minZ: 108, maxZ: 126 },
  plaza: { minX: 28, maxX: 95, minZ: 25, maxZ: 90 },
  stable: { minX: 28, maxX: 70, minZ: 88, maxZ: 110 },
  module: { minX: 95, maxX: 125, minZ: 20, maxZ: 80 },
  towers: { minX: 85, maxX: 125, minZ: 105, maxZ: 128 },
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

const PLAYER_R = 0.45;
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
  } else if (player.grounded && player.y - gy > 0.6) player.grounded = false;
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
  const m = 2.2;
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
  WALLS.length = 0; PLATFORMS.length = 0; clearRamps();

  const mat = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const stone = mat(0x6a7068, 0.9);
  const dark = mat(0x4a5048, 0.88);
  const dirt = mat(0x5a5348, 0.95);
  const rockM = mat(0x5a5850, 0.95);
  const wood = mat(0x6b4a32, 0.85);
  const iron = mat(0x3a3a40, 0.4, 0.55);
  const tile = mat(0x555a52, 0.9);
  const mountain = mat(0x3a3e38, 0.98);
  const markL = mat(0x2a6a3a, 0.9);
  const markR = mat(0x6a4a2a, 0.9);

  function box(w, h, d, material, x, y, z, solid = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return mesh;
  }
  function cyl(rT, rB, h, material, x, y, z, solid = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, 8), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) { const r = Math.max(rT, rB) + 0.1; addWall(x - r, x + r, z - r, z + r); }
    return mesh;
  }
  function pad(w, d, y, x, z, material) {
    const th = Math.max(0.4, 0.28 + y * 0.04);
    box(w, th, d, material, x, y - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y);
  }

  // —— Borde rectángulo ——
  const { minX, maxX, minZ, maxZ } = MAP;
  const WH = 22, WT = 5;
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, maxZ + WT / 2, true);
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, minZ - WT / 2, true);
  box(WT, WH, maxZ - minZ, mountain, minX - WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);
  box(WT, WH, maxZ - minZ, mountain, maxX + WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);

  // —— 1. Nivel 0 inferior izquierda ——
  pad(16, 12, LEVEL0_Y, 12, -6, dirt);
  box(0.6, 0.15, 3, mat(0xc4a040), 12, LEVEL0_Y + 0.1, -2); // flecha +Z

  // —— 2. Rampa IZQUIERDA (verde) a lo largo de +Z hasta cerca del borde norte ——
  const rampDef = { sx: 12, sz: 2, ex: 12, ez: 105, y0: LEVEL0_Y, y1: LEVEL1_Y, halfWidth: 5.5 };
  addRamp(rampDef);
  buildRampMesh(THREE, scene, rampDef, markL);
  for (const side of [-1, 1]) {
    const r = RAMPS[0];
    const ox = r.px * (r.halfWidth + 0.4) * side;
    const oz = r.pz * (r.halfWidth + 0.4) * side;
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, r.len), dark);
    g.position.set((r.sx + r.ex) / 2 + ox, (r.y0 + r.y1) / 2 + 0.22, (r.sz + r.ez) / 2 + oz);
    g.rotation.y = Math.atan2(r.dx, r.dz);
    g.castShadow = true; scene.add(g);
  }
  for (const z of [15, 30, 45, 60, 75, 90]) {
    cyl(1.1, 1.5, 1.8, rockM, 4.5, LEVEL0_Y + 0.9, z, true);
  }

  // —— 3. Rellano fin de rampa ——
  pad(18, 12, LEVEL1_Y, 14, 112, stone);

  // —— 4. PASADIZO (+X): borde norte || pasadizo || pared establo ——
  pad(80, 12, LEVEL1_Y, 58, 118, stone);
  // Muro norte (paralelo al borde)
  box(80, 5.5, 0.9, dark, 58, LEVEL1_Y + 2.5, 124, true);
  // Muro sur PARTIDO: tramo oeste (junto establo) + hueco a plaza + tramo este (antes torre)
  box(40, 5.5, 0.9, dark, 38, LEVEL1_Y + 2.5, 112, true); // oeste: pared establo
  box(18, 5.5, 0.9, dark, 88, LEVEL1_Y + 2.5, 112, true); // este: antes de torre1
  // Hueco plaza ≈ x 60..78 en z=112

  const gateLeft = box(3.5, 4.5, 0.4, iron, 40, LEVEL1_Y + 2.15, 118, false);
  const gateRight = box(3.5, 4.5, 0.4, iron, 48, LEVEL1_Y + 2.15, 118, false);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  // —— 5. Establo (sur del pasadizo) ——
  pad(36, 22, LEVEL1_Y, 48, 98, wood);
  box(0.9, 5.2, 22, dark, 30.5, LEVEL1_Y + 2.4, 98, true);
  box(0.9, 5.2, 8, dark, 65.5, LEVEL1_Y + 2.4, 105, true);
  box(0.9, 5.2, 8, dark, 65.5, LEVEL1_Y + 2.4, 91, true);
  box(12, 5.2, 0.9, dark, 38, LEVEL1_Y + 2.4, 87.5, true);
  box(12, 5.2, 0.9, dark, 58, LEVEL1_Y + 2.4, 87.5, true);
  box(0.6, 4.5, 12, dark, 48, LEVEL1_Y + 2.2, 98, true);
  box(37, 0.4, 23, dark, 48, LEVEL1_Y + 5.2, 98);
  FOOD_POS.set(46, LEVEL1_Y + 0.45, 100);
  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);

  // —— 6. Conexión pasadizo → plaza (por el hueco del muro sur) ——
  pad(20, 16, LEVEL1_Y, 70, 104, markR);

  // —— 7. Plaza ——
  pad(70, 60, LEVEL1_Y, 65, 55, dirt);
  box(6, 0.5, 6, stone, 60, LEVEL1_Y + 0.22, 50, true);
  box(3.5, 0.8, 3.5, dark, 60, LEVEL1_Y + 0.6, 50, true);

  // —— 8. Torre 1 (cierra pasadizo) ——
  box(14, 13, 14, dark, 98, LEVEL1_Y + 6, 118, true);
  addPlatform(91, 105, 111, 125, LEVEL1_Y + 12);

  // —— 9. Torre 2 arriba-derecha ——
  box(14, 13, 14, dark, 115, LEVEL1_Y + 6, 118, true);
  addPlatform(108, 122, 111, 125, LEVEL1_Y + 12);
  pad(28, 16, LEVEL1_Y, 110, 118, stone);
  const portcullis = box(10, 8, 0.65, iron, 106, LEVEL1_Y + 3.5, 118, true);
  portcullis.name = 'portcullis';
  box(3.2, 0.35, 8, wood, 115, LEVEL1_Y + 12.1, 115);
  addPlatform(113, 117, 111, 119, LEVEL1_Y + 12);

  // —— 10. Módulo 2N ——
  pad(28, 40, LEVEL1_Y, 110, 45, tile);
  box(28, 6, 0.9, dark, 110, LEVEL1_Y + 2.8, 64.5, true);
  box(28, 6, 0.9, dark, 110, LEVEL1_Y + 2.8, 25.5, true);
  box(0.9, 6, 40, dark, 123.5, LEVEL1_Y + 2.8, 45, true);
  box(0.9, 6, 14, dark, 96.5, LEVEL1_Y + 2.8, 56, true);
  box(0.9, 6, 14, dark, 96.5, LEVEL1_Y + 2.8, 34, true);
  box(29, 0.4, 41, dark, 110, LEVEL1_Y + 6.2, 45);

  PAGE_POS.set(108, LEVEL1_Y + 1.15, 48);
  KEY_POS.set(110, LEVEL1_Y + 1.1, 46);
  LEVER_POS.set(115, LEVEL1_Y + 12.5, 118);
  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  const keyMesh = box(0.3, 0.08, 0.12, mat(0xc9a227, 0.4, 0.6), KEY_POS.x, KEY_POS.y, KEY_POS.z);
  const leverArm = box(0.12, 0.12, 0.8, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z);
  const towerDoor = box(1.5, 2.4, 0.3, wood, 115, LEVEL1_Y + 12.8, 111.5, true);
  towerDoor.userData = { locked: true };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x121612, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(60, -1, 55);
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
  addWall(42, 46, 117, 119);
  if (mapData.gateLeft) mapData.gateLeft.position.x = 43;
  if (mapData.gateRight) mapData.gateRight.position.x = 45;
}

export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  mapData.towerDoor.position.y = -40;
  return true;
}
