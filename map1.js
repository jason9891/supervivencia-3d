// map1.js — El Regreso
// Paredes naranja tldraw 1:1 + Módulo 2 (oficina 2 ambientes).
// +X este · +Z norte · Y altura.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';
import { buildModule2, LEVEL2_Y as MOD2_L2, MOD2 } from './modulo2.js';

export const LEVEL0_Y = 0;
export const LEVEL1_Y = 6;
export const WALL_H = 5.0;

export const SPAWN = { x: 6.5, y: LEVEL0_Y, z: 3, facing: 0 };
export const MAP_CENTER = { x: 45, z: 36, y: LEVEL1_Y };

export const ZONES = {
  exterior: { minX: 0, maxX: 14, minZ: 0, maxZ: 18 },
  ramp: { minX: 0, maxX: 14, minZ: 8, maxZ: 68 },
  corridor: { minX: 12, maxX: 36, minZ: 62, maxZ: 72 },
  plaza: { minX: 13.5, maxX: 67, minZ: 1, maxZ: 63 },
  stable: { minX: 13.5, maxX: 54, minZ: 43, maxZ: 63 },
  mod2: { minX: 67, maxX: 90, minZ: 1, maxZ: 54 },
  towers: { minX: 67, maxX: 90, minZ: 62, maxZ: 72 },
};

export const WALLS = [];
export const PLATFORMS = [];

let PAGE_POS = new THREE.Vector3(76, LEVEL1_Y + 1.05, 10);
let KEY_POS = new THREE.Vector3(78, LEVEL1_Y + 1.02, 14);
let LEVER_POS = new THREE.Vector3(84, LEVEL1_Y + 11, 67);
let FOOD_POS = new THREE.Vector3(28, LEVEL1_Y + 0.45, 52);

export const STORY_PAGE = {
  title: 'Página arrancada',
  text:
    'Han pasado muchos años. Los escudos y las espadas han mejorado, pero la magia y los monstruos se volvieron leyenda.\n\n'
    + 'Hoy el silencio del pueblo dice otra cosa. Las puertas abiertas, la feria a medias, el establo sin dueño.\n\n'
    + 'Si lees esto: el mal no es cuento. Busca la llave del consejero y el puente de las torres.',
};

function addWall(minX, maxX, minZ, maxZ) { WALLS.push({ minX, maxX, minZ, maxZ }); }
function addPlatform(minX, maxX, minZ, maxZ, y) { PLATFORMS.push({ minX, maxX, minZ, maxZ, y }); }

export function getGroundHeight(x, z, fromY = Infinity) {
  let best = -Infinity;
  for (const p of PLATFORMS) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && p.y <= fromY + 0.35) {
      if (p.y > best) best = p.y;
    }
  }
  const ry = sampleRampY(x, z);
  if (ry != null && ry <= fromY + 0.35 && ry > best) best = ry;
  return best === -Infinity ? LEVEL0_Y : best;
}

export function resolveGround(player) {
  const gy = getGroundHeight(player.x, player.z, player.y);
  if (player.y <= gy + 0.08) {
    player.y = gy;
    if (player.vy < 0) player.vy = 0;
    player.grounded = true;
  }
}

export function resolveWallCollisions(player, radius = 0.38) {
  for (const w of WALLS) {
    const nx = Math.max(w.minX, Math.min(player.x, w.maxX));
    const nz = Math.max(w.minZ, Math.min(player.z, w.maxZ));
    const dx = player.x - nx;
    const dz = player.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      const push = (radius - d) / d;
      player.x += dx * push;
      player.z += dz * push;
    } else if (d2 <= 1e-8 && player.x >= w.minX && player.x <= w.maxX && player.z >= w.minZ && player.z <= w.maxZ) {
      const left = player.x - w.minX, right = w.maxX - player.x;
      const down = player.z - w.minZ, up = w.maxZ - player.z;
      const m = Math.min(left, right, down, up);
      if (m === left) player.x = w.minX - radius;
      else if (m === right) player.x = w.maxX + radius;
      else if (m === down) player.z = w.minZ - radius;
      else player.z = w.maxZ + radius;
    }
  }
}

export function getCurrentZone(x, z) {
  for (const [name, b] of Object.entries(ZONES)) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name;
  }
  return 'exterior';
}

export function distanceToPage(x, y, z) { return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z); }
export function distanceToKey(x, y, z) { return Math.hypot(x - KEY_POS.x, y - KEY_POS.y, z - KEY_POS.z); }
export function distanceToLever(x, y, z) { return Math.hypot(x - LEVER_POS.x, y - LEVER_POS.y, z - LEVER_POS.z); }
export function distanceToFood(x, y, z) { return Math.hypot(x - FOOD_POS.x, y - FOOD_POS.y, z - FOOD_POS.z); }

export function buildMap1(scene) {
  WALLS.length = 0;
  PLATFORMS.length = 0;
  clearRamps();

  const mat = (c, r = 0.85, metal = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: metal });
  const dirt = mat(0x5c5346);
  const stone = mat(0x6e6a62);
  const grass = mat(0x3f6b3a);
  const wood = mat(0x6b4a2b);
  const dark = mat(0x2c2822);
  const iron = mat(0x4a4e52, 0.45, 0.55);
  const orangeW = mat(0xb86a2b);

  function box(w, h, d, material, x, y, z, solid = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return mesh;
  }

  function pad(w, d, y, x, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), material);
    mesh.position.set(x, y - 0.15, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y);
  }

  function wallBox(minX, maxX, minZ, maxZ) {
    const w = Math.max(0.15, maxX - minX);
    const d = Math.max(0.15, maxZ - minZ);
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    box(w, WALL_H, d, orangeW, cx, LEVEL1_Y + WALL_H / 2, cz, true);
  }

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
  box(1.6, 0.28, 3.2, wood, 75.9, LEVEL1_Y + 10.55, 66.5);
  addPlatform(75.1, 76.7, 64.8, 68.2, LEVEL1_Y + 10.5);
  box(1.6, 0.28, 3.2, wood, 79.1, LEVEL1_Y + 10.55, 66.5);
  addPlatform(78.3, 79.9, 64.8, 68.2, LEVEL1_Y + 10.5);
  box(1.2, 0.15, 0.35, wood, 77.5, LEVEL1_Y + 10.2, 65.2);
  box(0.9, 0.15, 0.3, wood, 77.2, LEVEL1_Y + 9.6, 67.8);

  const mod = buildModule2(scene, { addWall, addPlatform, box });
  if (mod.pagePos) PAGE_POS.copy(mod.pagePos);
  if (mod.keyPos) KEY_POS.copy(mod.keyPos);

  const leverArm = box(0.12, 0.12, 0.8, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z);
  const towerDoor = box(1.4, 2.3, 0.3, wood, 84, LEVEL1_Y + 11.5, 63.2, true);
  towerDoor.userData = { locked: true };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(0x3d5c38, 1)); // hierba exterior de día
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
  return true;
}
