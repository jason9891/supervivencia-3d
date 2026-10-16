// map1.js — El Regreso
// Paredes naranja tldraw 1:1 + Módulo 2 (oficina 2 ambientes).
// +X este · +Z norte · Y altura.
// v3: rampa natural (natural-ramp.js), materiales y props medievales (props-medieval.js),
//     muros con altura (ya no bloquean en el piso 2), pisos sin solape, reja del corredor y techo del establo.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';
import { buildModule2, LEVEL2_Y as MOD2_L2, MOD2 } from './modulo2.js';
import { createMedievalMaterials, worldUV, buildChest, buildTable, buildChair, buildTorch, placeProp, updateTorches } from './props-medieval.js';
import { buildNaturalRamp } from './natural-ramp.js';

export const MAP1_NAME = 'El Regreso';
export const LEVEL0_Y = 0;
export const LEVEL1_Y = 6;

// true = paredes de piedra con musgo; false = conserva el naranja del diseño original
const USE_STONE_WALLS = false;
// 1 = escritorio, 0.5 = móvil (menos hierba y rocas en la rampa)
const RAMP_DETAIL = 1;

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
const PLAYER_H = 1.8;
const WALL_H = 5.0;

// reja del corredor: cruza todo el ancho (z 64.4-70.8) y cae cuando el jugador ya la pasó
const GATE_X = 34;
const GATE_H = 4.3;
const GATE_TRIGGER_X = 36.5;
let _mapData = null, _sawWest = false, _gatePassed = false, _gateAnim = null;

export const WALLS = [];
export const PLATFORMS = [];

// minY/maxY: altura del muro. Sin ellos (4 argumentos) bloquea a cualquier altura, como antes.
function addWall(minX, maxX, minZ, maxZ, minY = -Infinity, maxY = Infinity) {
  WALLS.push({ minX, maxX, minZ, maxZ, minY, maxY });
}
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
      player.coyote = 0.12; player.airTime = 0;
    }
  }
}

export function resolveWallCollisions(player, radius = PLAYER_R) {
  checkGateTrigger(player);
  const py = player.y;
  for (const w of WALLS) {
    if (py !== undefined) {
      if (py >= w.maxY - 0.3) continue;          // el jugador va por encima del muro (piso 2, azotea)
      if (py + PLAYER_H <= w.minY) continue;     // el jugador va por debajo
    }
    const nx = Math.max(w.minX, Math.min(player.x, w.maxX));
    const nz = Math.max(w.minZ, Math.min(player.z, w.maxZ));
    const dx = player.x - nx, dz = player.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      const push = (radius - d) / d;
      player.x += dx * push; player.z += dz * push;
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

export function distanceToPage(x, y, z) { return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z); }
export function distanceToKey(x, y, z) { return Math.hypot(x - KEY_POS.x, y - KEY_POS.y, z - KEY_POS.z); }
export function distanceToLever(x, y, z) { return Math.hypot(x - LEVER_POS.x, y - LEVER_POS.y, z - LEVER_POS.z); }
export function distanceToFood(x, y, z) { return Math.hypot(x - FOOD_POS.x, y - FOOD_POS.y, z - FOOD_POS.z); }

// Bucle propio (una sola vez): parpadeo de antorchas y caída de la reja.
let _loop = false;
function startMapLoop() {
  if (_loop) return;
  _loop = true;
  let last = 0;
  const tick = (ms) => {
    const t = ms * 0.001, dt = Math.min(0.05, t - last);
    last = t;
    updateTorches(t);
    updateGate(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function checkGateTrigger(player) {
  if (!_mapData || _gatePassed) return;
  if (player.z < 63.6 || player.z > 71.6 || (player.y !== undefined && player.y > LEVEL1_Y + 2)) return;
  if (player.x < GATE_X - 1.5) _sawWest = true;                       // viene de la rampa
  else if (_sawWest && player.x > GATE_TRIGGER_X) { _gatePassed = true; dropGate(); }
}

function dropGate() {
  const g = _mapData && _mapData.gate;
  if (!g || g.userData.closed) return;
  g.userData.closed = true;
  _gateAnim = { t: 0 };
}

function updateGate(dt) {
  if (!_gateAnim || !_mapData) return;
  _gateAnim.t = Math.min(1, _gateAnim.t + dt / 0.6);
  const e = _gateAnim.t * _gateAnim.t;
  _mapData.gate.position.y = LEVEL1_Y + GATE_H * (1 - e);
  if (_gateAnim.t >= 1) {
    addWall(GATE_X - 0.4, GATE_X + 0.4, 64.4, 70.8, LEVEL1_Y, LEVEL1_Y + GATE_H);
    _gateAnim = null;
  }
}

export function buildMap1(scene) {
  WALLS.length = 0;
  PLATFORMS.length = 0;
  clearRamps();
  _sawWest = false; _gatePassed = false; _gateAnim = null;

  const mat = (c, r = 0.85, metal = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: metal });
  const M = createMedievalMaterials();
  const dirt = mat(0x5c5346);
  const stone = M.stone;
  const grass = mat(0x3f6b3a);
  const wood = M.wood;
  const dark = mat(0x2c2822);
  const iron = M.iron;
  const orangeW = USE_STONE_WALLS ? M.wall : mat(0xb86a2b);

  function box(w, h, d, material, x, y, z, solid = false) {
    const geo = new THREE.BoxGeometry(w, h, d);
    worldUV(geo, w, h, d, material);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y - h / 2, y + h / 2);
    return mesh;
  }

  function pad(w, d, y, x, z, material) {
    const geo = new THREE.BoxGeometry(w, 0.35, d);
    worldUV(geo, w, 0.35, d, material);
    const mesh = new THREE.Mesh(geo, material);
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

  // Pisos del nivel 1: cada zona tiene su propia losa y ninguna se solapa (antes parpadeaban)
  pad(13.5, 6, LEVEL1_Y, 6.75, 69, stone);        // descanso al final de la rampa  (x 0-13.5,  z 66-72)
  pad(54, 9, LEVEL1_Y, 40.5, 67.5, stone);        // corredor                       (x 13.5-67.5, z 63-72)
  pad(54, 63, LEVEL1_Y, 40.5, 31.5, dirt);        // plaza                          (x 13.5-67.5, z 0-63)
  pad(22.5, 9.6, LEVEL1_Y, 78.75, 58.2, dirt);    // patio                          (x 67.5-90,  z 53.4-63)
  pad(5.5, 9, LEVEL1_Y, 77.5, 67.5, stone);       // paso entre las torres          (x 74.75-80.25, z 63-72)
  // Muralla: el nivel 1 es una meseta, este muro la apoya desde el terreno hasta la plaza
  box(0.8, 6.8, 63.1, M.wall, 13.5, LEVEL1_Y - 3.4, 31.55, true);

  pad(13.5, 9, LEVEL0_Y, 6.75, 4.5, grass);
  const rampDef = {
    sx: 6.75, sz: 9,
    ex: 6.75, ez: 66,
    y0: LEVEL0_Y, y1: LEVEL1_Y,
    halfWidth: 5.5,
  };
  addRamp(rampDef);                                              // la física no cambia
  buildNaturalRamp(scene, rampDef, { detail: RAMP_DETAIL });     // ladera de pasto, sendero, rocas

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
  wallBox(0, 67.3, 71.6, 72.4);                      // borde norte: descanso y corredor

  // Reja del corredor: marco de piedra con ranura arriba; la reja cuelga oculta en la ranura y cae al cruzar la línea de disparo
  box(0.8, 8.6, 0.8, M.wall, GATE_X, LEVEL1_Y + 4.3, 64.0, true);
  box(0.8, 8.6, 0.8, M.wall, GATE_X, LEVEL1_Y + 4.3, 71.2, true);
  box(0.6, GATE_H, 6.4, M.wall, GATE_X, LEVEL1_Y + GATE_H + GATE_H / 2, 67.6, false);
  const gate = new THREE.Group();
  const gbox = (w, h, d, y, z) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    worldUV(geo, w, h, d, iron);
    const m = new THREE.Mesh(geo, iron);
    m.position.set(0, y, z); m.castShadow = true; gate.add(m);
  };
  for (let i = 0; i < 9; i++) gbox(0.12, GATE_H, 0.12, GATE_H / 2, 64.7 + i * 0.725);
  gbox(0.14, 0.15, 6.4, 0.4, 67.6);
  gbox(0.14, 0.15, 6.4, 3.2, 67.6);
  gate.position.set(GATE_X, LEVEL1_Y + GATE_H, 0);     // arriba, oculta en la ranura
  gate.name = 'mainGate';
  gate.userData = { closed: false };
  scene.add(gate);
  const gateLeft = gate, gateRight = gate;

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

  /* ---- props medievales de prueba en el establo (x 14-35, z 46-62) ---- */
  const addSolid = (a, b, c, d) => addWall(a, b, c, d, LEVEL1_Y, LEVEL1_Y + 2);
  const chest1 = placeProp(scene, buildChest(M), 20, LEVEL1_Y, 59, 0.3, addSolid);
  placeProp(scene, buildTable(M), 26, LEVEL1_Y, 58, 0, addSolid);
  placeProp(scene, buildChair(M), 26, LEVEL1_Y, 56.8, Math.PI, addSolid);
  placeProp(scene, buildTorch(M), 13.95, LEVEL1_Y + 2.4, 55, Math.PI / 2);   // sobre la cara este del muro oeste

  /* ---- techo del establo: dos aguas con cumbrera a lo largo de X ---- */
  {
    const x0 = 13.1, x1 = 54.5, z0 = 44.5, z1 = 64.0, y0 = LEVEL1_Y + WALL_H, rise = 2.6;
    const zc = (z0 + z1) / 2, half = (z1 - z0) / 2;
    const slope = Math.atan2(rise, half), slen = Math.hypot(half, rise) + 0.3;
    for (const s of [-1, 1]) {
      const geo = new THREE.BoxGeometry(x1 - x0, 0.25, slen);
      worldUV(geo, x1 - x0, 0.25, slen, wood);
      const m = new THREE.Mesh(geo, wood);
      m.position.set((x0 + x1) / 2, y0 + rise / 2 + 0.12, zc + (s * half) / 2);
      m.rotation.x = s * slope;
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    }
    box(x1 - x0, 0.3, 0.35, wood, (x0 + x1) / 2, y0 + rise + 0.15, zc, false);
    const tri = new THREE.Shape();
    tri.moveTo(-half, 0); tri.lineTo(half, 0); tri.lineTo(0, rise); tri.closePath();
    for (const gx of [x0, x1 - 0.6]) {
      const g = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.6, bevelEnabled: false }), dark);
      g.rotation.y = Math.PI / 2;
      g.position.set(gx, y0, zc);
      g.castShadow = g.receiveShadow = true;
      scene.add(g);
    }
  }
  startMapLoop();

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(0x3d5c38, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(45, -0.8, 36);
  ground.receiveShadow = true;
  scene.add(ground);

  const result = {
    gate, gateLeft, gateRight, portcullis,
    pageMesh: mod.pageMesh, keyMesh: mod.keyMesh, foodMesh, leverArm, towerDoor,
    hallDoor: null, herbs: [], creature: null,
    chests: [chest1],
    pagePos: PAGE_POS.clone(), keyPos: KEY_POS.clone(), leverPos: LEVER_POS.clone(),
    spawn: { ...SPAWN },
    mod2: mod,
  };
  _mapData = result;
  return result;
}

// La reja ya se cierra sola al cruzar la línea de disparo (checkGateTrigger). Si tu juego sigue llamando a esta
// función al tocar la reja, se ignora hasta que el jugador la haya pasado.
export function closePassageGate(mapData) {
  if (!_gatePassed) return;
  dropGate();
}

export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  mapData.towerDoor.position.y = -40;
  return true;
}
