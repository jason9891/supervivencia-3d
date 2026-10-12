// map1.js — El Regreso
// Puzzle desde tldraw: todo el rectángulo cubierto, paredes compartidas (naranja ≈1u).
// +X = este (derecha croquis) · +Z = norte (arriba croquis) · Y = altura.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';

export const MAP1_NAME = 'El Regreso';
export const LEVEL0_Y = 0;
export const LEVEL1_Y = 6;

// Escala tldraw: frame 720×576 → 90×72 unidades (8px = 1u)
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

let PAGE_POS = new THREE.Vector3(78, LEVEL1_Y + 1, 30);
let KEY_POS = new THREE.Vector3(80, LEVEL1_Y + 1, 28);
let LEVER_POS = new THREE.Vector3(84, LEVEL1_Y + 11, 67);
let FOOD_POS = new THREE.Vector3(28, LEVEL1_Y + 0.45, 52);

const PLAYER_R = 0.45;
const WALL_T = 1.0; // grosor pared compartida
const WALL_H = 4.8;

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
  const tile = mat(0x555a52, 0.9);
  const mountain = mat(0x3a3e38, 0.98);
  const grass = mat(0x3d5c38, 1);
  const orangeW = mat(0x8a5a28, 0.85); // paredes compartidas visibles

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
  // Pared compartida horizontal (corre en X, delgada en Z)
  function wallH(x0, x1, z, material = orangeW) {
    const cx = (x0 + x1) / 2, w = Math.abs(x1 - x0);
    box(w, WALL_H, WALL_T, material, cx, LEVEL1_Y + WALL_H / 2, z, true);
  }
  // Pared compartida vertical (corre en Z, delgada en X)
  function wallV(z0, z1, x, material = orangeW) {
    const cz = (z0 + z1) / 2, d = Math.abs(z1 - z0);
    box(WALL_T, WALL_H, d, material, x, LEVEL1_Y + WALL_H / 2, cz, true);
  }

  // ─── Perímetro ───
  const { minX, maxX, minZ, maxZ } = MAP;
  const WH = 14, WT = 2.5;
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, maxZ + WT / 2, true);
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, minZ - WT / 2, true);
  box(WT, WH, maxZ - minZ, mountain, minX - WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);
  box(WT, WH, maxZ - minZ, mountain, maxX + WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);

  // ─── Suelo continuo nivel 1 (todo el rectángulo excepto franja rampa baja) ───
  // Plaza + pasadizo + establo + módulo + bases torres
  pad(76.5, 72, LEVEL1_Y, 51.75, 36, dirt); // x 13.5..90
  // Suelo piedra del pasadizo (norte)
  pad(54, 9, LEVEL1_Y, 40.5, 67.5, stone);

  // ─── Nivel 0 + rampa izquierda ───
  pad(13.5, 9, LEVEL0_Y, 6.75, 4.5, grass);
  const rampDef = {
    sx: 6.75, sz: 9,
    ex: 6.75, ez: 63,
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
  // Rellano norte rampa → pasadizo
  pad(13.5, 6, LEVEL1_Y, 6.75, 66, stone);

  // ─── Paredes compartidas (naranja tldraw) ───
  // Vertical: rampa | resto  @ x=13.5
  wallV(0, 72, 13.5);
  // Vertical: plaza/pasadizo | módulo/torres  @ x=67.5
  wallV(0, 72, 67.5);
  // Vertical: T1 | portón/T2  @ x≈75
  wallV(63, 72, 75);
  // Vertical: entre T2 zona  @ x≈80.5 (ya cubierto por torre)

  // Horizontal: pasadizo | establo  @ z=63  (con huecos)
  wallH(13.5, 36, 63);   // sobre establo oeste
  // hueco entrada plaza ~36-48
  wallH(48, 67.5, 63);   // sobre plaza este / hacia torres

  // Horizontal: establo | plaza  @ z=43  (puerta establo)
  wallH(13.5, 24, 43);
  // hueco puerta ~24-32
  wallH(32, 48, 43);

  // Tabique establo (2 ambientes) vertical @ x≈35.5
  wallV(43, 63, 35.5);

  // Sur del módulo (opcional visual)
  wallH(67.5, 90, 0.5);

  // ─── Reja del pasadizo (cae al pasar) ───
  const gateLeft = box(2.5, 4.2, 0.4, iron, 32, LEVEL1_Y + 2.0, 67.5, false);
  const gateRight = box(2.5, 4.2, 0.4, iron, 37, LEVEL1_Y + 2.0, 67.5, false);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  // ─── Establo (techo + comida) ───
  box(40, 0.35, 20, dark, 33.5, LEVEL1_Y + 5.0, 53);
  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);

  // ─── Plaza: fuente ───
  box(5, 0.4, 5, stone, 40, LEVEL1_Y + 0.18, 28, true);
  box(3, 0.7, 3, dark, 40, LEVEL1_Y + 0.5, 28, true);

  // ─── Torres T1 T2 + portón jefe (entre ellas, tipo puente/reja grande) ───
  // T1
  box(7.5, 11, 9, dark, 71.25, LEVEL1_Y + 5.2, 67.5, true);
  addPlatform(67.5, 75, 63, 72, LEVEL1_Y + 10.5);
  // T2
  box(9.5, 11, 9, dark, 85.25, LEVEL1_Y + 5.2, 67.5, true);
  addPlatform(80.5, 90, 63, 72, LEVEL1_Y + 10.5);
  // Portón/puente grande entre T1 y T2 (cae → jefe)
  const portcullis = box(5.5, 8, 0.7, iron, 77.5, LEVEL1_Y + 3.6, 63.5, true);
  portcullis.name = 'portcullis';
  // Plataforma puente visual 2º piso
  box(5, 0.3, 4, wood, 77.5, LEVEL1_Y + 10.6, 66);
  addPlatform(75, 80, 64, 68, LEVEL1_Y + 10.5);

  // ─── Módulo 2N (este, techo + interior) ───
  // Hueco puerta oeste ya por wallV partido implícito: abrimos tramo del muro x=67.5
  // (el wallV continuo bloquea — partimos con hueco de puerta)
  // Quitamos colisión en hueco puerta módulo: no se puede fácilmente; añadimos
  // segundo tramo de muro y no ponemos pared en z 25-40.
  // Para esta prueba el wallV completo en x=67.5 se mantiene; puerta visual:
  box(0.4, 3.2, 0.4, wood, 67.5, LEVEL1_Y + 1.5, 32);
  box(0.4, 3.2, 0.4, wood, 67.5, LEVEL1_Y + 1.5, 38);
  box(22.5, 0.35, 53, dark, 78.75, LEVEL1_Y + 5.2, 26.5);

  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  const keyMesh = box(0.3, 0.08, 0.12, mat(0xc9a227, 0.4, 0.6), KEY_POS.x, KEY_POS.y, KEY_POS.z);
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
    pageMesh, keyMesh, foodMesh, leverArm, towerDoor,
    hallDoor: null, herbs: [], creature: null,
    pagePos: PAGE_POS.clone(), keyPos: KEY_POS.clone(), leverPos: LEVER_POS.clone(),
    spawn: { ...SPAWN },
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
