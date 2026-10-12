// map1.js — El Regreso
// Paredes naranja tldraw 1:1 + Módulo 2 (oficina 2 ambientes).
// +X este · +Z norte · Y altura.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';
import { buildModule2, LEVEL2_Y as MOD2_L2, MOD2 } from './modulo2.js';

export const MAP1_NAME = 'El Regreso';
export const LEVEL0_Y = 0;
export const LEVEL1_Y = 6;

export const MAP = { minX: 0, maxX: 90, minZ: 0, maxZ: 72 };
export const SPAWN = { x: 6.5, y: LEVEL0_Y, z: 3, facing: 0 };
export const MAP_CENTER = { x: 45, z: 36, y: LEVEL1_Y };

export const ZONES = {
  ramp: { minX: 0, maxX: 13.5, minZ: 0, maxZ: 72 },
  corridor: { minX: 13.5, maxX: 67.5, minZ: 63, maxZ: 72 },
  plaza: { minX: 13.5, maxX: 67.5, minZ: 0, maxZ: 63 },
  stable: { minX: 13.5, maxX: 54, minZ: 43, maxZ: 63 },
  module: { minX: 67.5, maxX: 90, minZ: 0, maxZ: 53 },
  towers: { minX: 67.5, maxX: 90, minZ: 63, maxZ: 72 },
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

let PAGE_POS = new THREE.Vector3(76, LEVEL1_Y + 1.05, 10);
let KEY_POS = new THREE.Vector3(78, LEVEL1_Y + 1.02, 14);
let LEVER_POS = new THREE.Vector3(84, LEVEL1_Y + 11, 67);
let FOOD_POS = new THREE.Vector3(28, LEVEL1_Y + 0.45, 52);

const PLAYER_R = 0.45;
const WALL_H = 5.0;

export const WALLS = [];
export const PLATFORMS = [];

function addWall(minX, maxX, minZ, maxZ) { WALLS.push({ minX, maxX, minZ, maxZ }); }
function addPlatform(minX, maxX, minZ, maxZ, y) { PLATFORMS.push({ minX, maxX, minZ, maxZ, y }); }

export function getGroundHeight(x, z, fromY = Infinity) {
  let best = -Infinity;
  const ry = sampleRampY(x, z);
  if (ry !== null && ry <= fromY + 0.85 && ry > best) best = ry;
  for (const p of PLATFORMS) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
      if (p.y <= fromY + 0.85 && p.y > best) best = p.y;
    }
  }
  return best === -Infinity ? LEVEL0_Y : best;
}

export function resolveGround(player) {
  const gy = getGroundHeight(player.x, player.z, player.y);
  if (player.y <= gy + 0.7) {
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
  const m = 1.5;
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

  const mat = (c, r = 0.86, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const stone = mat(0x6a7068, 0.9);
  const dark = mat(0x4a5048, 0.88);
  const dirt = mat(0x5a5348, 0.95);
  const wood = mat(0x6b4a32, 0.85);
  const iron = mat(0x3a3a40, 0.4, 0.55);
  const mountain = mat(0x3a3e38, 0.98);
  const grass = mat(0x3d5c38, 1);
  const orangeW = mat(0xc47a28, 0.75);

  function box(w, h, d, material, x, y, z, solid = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return mesh;
  }
  function pad(w, d, y, x, z, material) {
    const th = Math.max(0.35, 0.25 + y * 0.04);
    box(w, th, d, material, x, y - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y);
  }
  function wallBox(minX, maxX, minZ, maxZ) {
    const w = maxX - minX;
    const d = maxZ - minZ;
    if (w < 0.15 || d < 0.15) return;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    box(w, WALL_H, d, orangeW, cx, LEVEL1_Y + WALL_H / 2, cz, true);
  }

  const { minX, maxX, minZ, maxZ } = MAP;
  const WH = 14, WT = 2.5;
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, maxZ + WT / 2, true);
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, minZ - WT / 2, true);
  box(WT, WH, maxZ - minZ, mountain, minX - WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);
  box(WT, WH, maxZ - minZ, mountain, maxX + WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);

  pad(90, 72, LEVEL1_Y, 45, 36, dirt);
  pad(90, 10, LEVEL1_Y, 45, 67, stone);

  pad(13.5, 9, LEVEL0_Y, 6.75, 4.5, grass);
  const rampDef = {
    sx: 6.75, sz: 9,
    ex: 6.75, ez: 66,
    y0: LEVEL0_Y, y1: LEVEL1_Y,
    halfWidth: 5.5,
  };
  addRamp(rampDef);
  buildRampMesh(THREE, scene, rampDef, stone);
  for (const side of [-1, 1]) {
    const r = RAMPS[0];
    const ox = r.px * (r.halfWidth + 0.35) * side;
    const oz = r.pz * (r.halfWidth + 0.35) * side;
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, r.len), dark);
    g.position.set((r.sx + r.ex) / 2 + ox, (r.y0 + r.y1) / 2 + 0.2, (r.sz + r.ez) / 2 + oz);
    g.rotation.y = Math.atan2(r.dx, r.dz);
    g.castShadow = true; scene.add(g);
  }
  pad(22, 8, LEVEL1_Y, 12, 67, stone);

  wallBox(13.1, 13.9, 0.0, 63.1);
  wallBox(13.5, 36.0, 62.9, 63.6);
  wallBox(36.0, 54.8, 62.9, 63.6);
  wallBox(67.3, 75.1, 62.9, 63.5);
  wallBox(35.4, 36.3, 50.5, 63.0);
  wallBox(53.8, 54.5, 44.9, 62.9);
  wallBox(13.4, 45.6, 44.9, 45.6);
  wallBox(66.9, 68.0, 11.1, MOD2.doorPlaza.z0);
  wallBox(66.9, 68.0, MOD2.doorPlaza.z1, 53.9);
  wallBox(67.4, 89.6, 53.4, 54.5);
  wallBox(67.3, 68.0, 62.9, 72.0);
  wallBox(74.8, 75.5, 62.6, 71.6);
  wallBox(80.4, 81.1, 62.9, 72.0);
  wallBox(80.5, 89.8, 62.9, 63.5);
  wallBox(13.3, 89.9, 0.25, 1.25);

  const gateLeft = box(2.5, 4.2, 0.4, iron, 32, LEVEL1_Y + 2.0, 67.5, false);
  const gateRight = box(2.5, 4.2, 0.4, iron, 37, LEVEL1_Y + 2.0, 67.5, false);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);

  box(5, 0.4, 5, stone, 40, LEVEL1_Y + 0.18, 28, true);
  box(3, 0.7, 3, dark, 40, LEVEL1_Y + 0.5, 28, true);

  box(7.5, 11, 9, dark, 71.25, LEVEL1_Y + 5.2, 67.5, true);
  addPlatform(67.5, 75, 63, 72, LEVEL1_Y + 10.5);
  box(9.5, 11, 9, dark, 85.25, LEVEL1_Y + 5.2, 67.5, true);
  addPlatform(80.5, 90, 63, 72, LEVEL1_Y + 10.5);
  const portcullis = box(5.5, 8, 0.7, iron, 77.5, LEVEL1_Y + 3.6, 63.5, true);
  portcullis.name = 'portcullis';
  // Puente ROTO entre torres (hueco para probar salto). Restos a cada lado.
  box(1.6, 0.28, 3.2, wood, 75.9, LEVEL1_Y + 10.55, 66.5);
  addPlatform(75.1, 76.7, 64.8, 68.2, LEVEL1_Y + 10.5);
  box(1.6, 0.28, 3.2, wood, 79.1, LEVEL1_Y + 10.55, 66.5);
  addPlatform(78.3, 79.9, 64.8, 68.2, LEVEL1_Y + 10.5);
  // Tablones caídos (solo visual, sin plataforma)
  box(1.2, 0.15, 0.35, wood, 77.5, LEVEL1_Y + 10.2, 65.2);
  box(0.9, 0.15, 0.3, wood, 77.2, LEVEL1_Y + 9.6, 67.8);

  const mod = buildModule2(scene, { addWall, addPlatform, box });
  if (mod.pagePos) PAGE_POS.copy(mod.pagePos);
  if (mod.keyPos) KEY_POS.copy(mod.keyPos);

  const leverArm = box(0.12, 0.12, 0.8, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z);
  const towerDoor = box(1.4, 2.3, 0.3, wood, 84, LEVEL1_Y + 11.5, 63.2, true);
  towerDoor.userData = { locked: true };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(0x101410, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(45, -0.8, 36);
  ground.receiveShadow = true;
  scene.add(ground);

  return {
    gate, gateLeft, gateRight, portcullis,
    pageMesh: mod.pageMesh, keyMesh: mod.keyMesh, foodMesh, leverArm, towerDoor,
    hallDoor: null, herbs: [], creature: null,
    pagePos: PAGE_POS.clone(), keyPos: KEY_POS.clone(), leverPos: LEVER_POS.clone(),
    spawn: { ...SPAWN },
    mod2: mod,
  };
}

export function closePassageGate(mapData) {
  if (!mapData?.gate || mapData.gate.userData.closed) return;
  mapData.gate.userData.closed = true;
  addWall(33.5, 35.5, 66.5, 68.5);
  if (mapData.gateLeft) mapData.gateLeft.position.x = 34;
  if (mapData.gateRight) mapData.gateRight.position.x = 35.5;
}

export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  mapData.towerDoor.position.y = -40;
  return true;
}
