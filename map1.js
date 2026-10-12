// map1.js — El Regreso
// Croquis: rampa a la IZQUIERDA · desarrollo a la DERECHA (+X) hacia Torre 2.
// eje-x papel = +Z · eje-y papel = +X · altura = Y.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';

export const MAP1_NAME = 'El Regreso';
export const LEVEL0_Y = 0;
export const LEVEL1_Y = 8;

// Rectángulo: inicio abajo-izquierda · Torre 2 arriba-derecha
export const MAP = { minX: -8, maxX: 140, minZ: -25, maxZ: 145 };
export const SPAWN = { x: 10, y: LEVEL0_Y, z: -10, facing: 0 };

export const ZONES = {
  ramp: { minX: 0, maxX: 24, minZ: -20, maxZ: 58 },
  corridor: { minX: 24, maxX: 100, minZ: 95, maxZ: 125 },
  plaza: { minX: 28, maxX: 95, minZ: 20, maxZ: 85 },
  stable: { minX: 28, maxX: 62, minZ: 85, maxZ: 115 },
  module: { minX: 95, maxX: 135, minZ: 15, maxZ: 75 },
  towers: { minX: 70, maxX: 135, minZ: 100, maxZ: 140 },
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
  const m = 2;
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

  // —— Paredes del rectángulo ——
  const { minX, maxX, minZ, maxZ } = MAP;
  const WH = 20, WT = 5;
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, maxZ + WT / 2, true);
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, minZ - WT / 2, true);
  box(WT, WH, maxZ - minZ, mountain, minX - WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);
  box(WT, WH, maxZ - minZ, mountain, maxX + WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);

  // —— 1. Nivel 0 (abajo-izquierda) ——
  pad(18, 14, LEVEL0_Y, 10, -8, dirt);

  // —— 2. Rampa IZQUIERDA (+Z), contenido a la DERECHA ——
  const rampDef = { sx: 10, sz: 2, ex: 12, ez: 52, y0: LEVEL0_Y, y1: LEVEL1_Y, halfWidth: 5.5 };
  addRamp(rampDef);
  buildRampMesh(THREE, scene, rampDef, stone);
  for (const side of [-1, 1]) {
    const r = RAMPS[0];
    const ox = r.px * (r.halfWidth + 0.35) * side;
    const oz = r.pz * (r.halfWidth + 0.35) * side;
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, r.len), dark);
    g.position.set((r.sx + r.ex) / 2 + ox, (r.y0 + r.y1) / 2 + 0.2, (r.sz + r.ez) / 2 + oz);
    g.rotation.y = Math.atan2(r.dx, r.dz);
    g.castShadow = true; scene.add(g);
  }
  // Rocas solo al OESTE de la rampa (izquierda); la derecha queda abierta al mapa
  for (const [rx, rz, s] of [[2, 12, 1.2], [2, 25, 1.15], [2, 38, 1.3], [3, 48, 1.1]]) {
    cyl(0.9 * s, 1.3 * s, 1.6 * s, rockM, rx, LEVEL0_Y + 0.8 * s, rz, true);
  }

  // —— 3. Parte plana nivel 1 (fin rampa) ——
  pad(22, 16, LEVEL1_Y, 14, 58, stone);

  // —— 4. PLAZA grande a la DERECHA de la rampa (visible al mirar +X) ——
  pad(80, 70, LEVEL1_Y, 60, 50, dirt);
  // Suelo de transición rampa → plaza (derecha)
  pad(30, 40, LEVEL1_Y, 32, 40, stone);
  // Fuente
  box(6, 0.5, 6, stone, 55, LEVEL1_Y + 0.22, 45, true);
  box(3.5, 0.8, 3.5, dark, 55, LEVEL1_Y + 0.6, 45, true);

  // —— 5. ESTABLO (norte de plaza, 2 ambientes, puerta al sur) ——
  pad(28, 24, LEVEL1_Y, 42, 98, wood);
  box(28, 5.2, 0.9, dark, 42, LEVEL1_Y + 2.4, 109.5, true); // norte
  box(9, 5.2, 0.9, dark, 32, LEVEL1_Y + 2.4, 86.5, true); // sur izq
  box(9, 5.2, 0.9, dark, 52, LEVEL1_Y + 2.4, 86.5, true); // sur der (hueco puerta centro)
  box(0.9, 5.2, 24, dark, 28.5, LEVEL1_Y + 2.4, 98, true); // oeste
  box(0.9, 5.2, 9, dark, 55.5, LEVEL1_Y + 2.4, 105, true);
  box(0.9, 5.2, 9, dark, 55.5, LEVEL1_Y + 2.4, 91, true);
  box(0.6, 4.6, 14, dark, 42, LEVEL1_Y + 2.2, 98, true); // tabique
  box(29, 0.4, 25, dark, 42, LEVEL1_Y + 5.2, 98);
  box(0.35, 3.2, 0.35, wood, 38, LEVEL1_Y + 1.5, 86.6);
  box(0.35, 3.2, 0.35, wood, 46, LEVEL1_Y + 1.5, 86.6);
  FOOD_POS.set(40, LEVEL1_Y + 0.45, 100);
  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);

  // —— 6. PASADIZO + REJA (franja norte, de izquierda a derecha) ——
  pad(70, 16, LEVEL1_Y, 55, 118, stone);
  // Muro norte del pasadizo
  box(70, 5.5, 1.0, dark, 55, LEVEL1_Y + 2.5, 125.5, true);
  // Muro sur: separa pasadizo del establo — hueco hacia plaza en el tramo central
  box(22, 5.5, 1.0, dark, 32, LEVEL1_Y + 2.5, 110.5, true);
  box(22, 5.5, 1.0, dark, 78, LEVEL1_Y + 2.5, 110.5, true);
  // Conexión suelo plaza ↔ pasadizo
  pad(20, 14, LEVEL1_Y, 55, 108, stone);

  const gateLeft = box(3.6, 4.6, 0.4, iron, 42, LEVEL1_Y + 2.2, 118, false);
  const gateRight = box(3.6, 4.6, 0.4, iron, 50, LEVEL1_Y + 2.2, 118, false);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  // —— 7. TORRE 1 (cierra el pasadizo; al pasar la reja chocas aquí) ——
  box(14, 13, 14, dark, 88, LEVEL1_Y + 6, 118, true);
  addPlatform(81, 95, 111, 125, LEVEL1_Y + 12);

  // —— 8. TORRE 2 (arriba-derecha del rectángulo) ——
  box(14, 13, 14, dark, 118, LEVEL1_Y + 6, 128, true);
  addPlatform(111, 125, 121, 135, LEVEL1_Y + 12);
  pad(40, 22, LEVEL1_Y, 110, 125, stone);
  const portcullis = box(12, 8, 0.7, iron, 103, LEVEL1_Y + 3.6, 122, true);
  portcullis.name = 'portcullis';
  box(3.5, 0.35, 10, wood, 118, LEVEL1_Y + 12.2, 120);
  addPlatform(116, 120, 115, 125, LEVEL1_Y + 12);

  // —— 9. MÓDULO 2N (derecha, diseño aparte) ——
  pad(34, 42, LEVEL1_Y, 115, 42, tile);
  box(34, 6, 0.9, dark, 115, LEVEL1_Y + 2.8, 62.5, true);
  box(34, 6, 0.9, dark, 115, LEVEL1_Y + 2.8, 21.5, true);
  box(0.9, 6, 42, dark, 131.5, LEVEL1_Y + 2.8, 42, true);
  box(0.9, 6, 16, dark, 98.5, LEVEL1_Y + 2.8, 54, true);
  box(0.9, 6, 16, dark, 98.5, LEVEL1_Y + 2.8, 30, true);
  box(35, 0.4, 43, dark, 115, LEVEL1_Y + 6.2, 42);

  PAGE_POS.set(112, LEVEL1_Y + 1.15, 44);
  KEY_POS.set(114, LEVEL1_Y + 1.1, 42);
  LEVER_POS.set(118, LEVEL1_Y + 12.5, 128);
  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  const keyMesh = box(0.3, 0.08, 0.12, mat(0xc9a227, 0.4, 0.6), KEY_POS.x, KEY_POS.y, KEY_POS.z);
  const leverArm = box(0.12, 0.12, 0.8, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z);
  const towerDoor = box(1.5, 2.4, 0.3, wood, 118, LEVEL1_Y + 12.8, 121.5, true);
  towerDoor.userData = { locked: true };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mat(0x121612, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(60, -1, 60);
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
  addWall(44, 48, 117, 119);
  if (mapData.gateLeft) mapData.gateLeft.position.x = 45;
  if (mapData.gateRight) mapData.gateRight.position.x = 47;
}

export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  mapData.towerDoor.position.y = -40;
  return true;
}
