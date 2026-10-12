// map1.js — El Regreso
// Una sola estructura continua (patio + edificios), no islas sueltas.
// Croquis: rampa IZQUIERDA (+Z) · giro DERECHA al pasadizo norte · plaza centro.
// eje-x papel = +Z · eje-y papel = +X · altura = Y.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';

export const MAP1_NAME = 'El Regreso';
export const LEVEL0_Y = 0;
export const LEVEL1_Y = 6;

// Rectángulo del complejo (todo conectado dentro)
export const MAP = { minX: 0, maxX: 100, minZ: -15, maxZ: 95 };
export const SPAWN = { x: 10, y: LEVEL0_Y, z: -6, facing: 0 };
export const MAP_CENTER = { x: 48, z: 45, y: LEVEL1_Y };

export const ZONES = {
  ramp: { minX: 2, maxX: 20, minZ: -12, maxZ: 78 },
  corridor: { minX: 18, maxX: 85, minZ: 72, maxZ: 90 },
  plaza: { minX: 22, maxX: 72, minZ: 18, maxZ: 70 },
  stable: { minX: 20, maxX: 48, minZ: 55, maxZ: 78 },
  module: { minX: 72, maxX: 96, minZ: 18, maxZ: 58 },
  towers: { minX: 70, maxX: 96, minZ: 70, maxZ: 92 },
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

let PAGE_POS = new THREE.Vector3(80, LEVEL1_Y + 1, 40);
let KEY_POS = new THREE.Vector3(82, LEVEL1_Y + 1, 38);
let LEVER_POS = new THREE.Vector3(88, LEVEL1_Y + 11, 82);
let FOOD_POS = new THREE.Vector3(32, LEVEL1_Y + 0.45, 66);

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
  const m = 1.8;
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

  // ═══════════════════════════════════════════
  // 1. PERÍMETRO del rectángulo (una sola caja)
  // ═══════════════════════════════════════════
  const { minX, maxX, minZ, maxZ } = MAP;
  const WH = 16, WT = 3.5;
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, maxZ + WT / 2, true);
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, minZ - WT / 2, true);
  box(WT, WH, maxZ - minZ, mountain, minX - WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);
  box(WT, WH, maxZ - minZ, mountain, maxX + WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);

  // ═══════════════════════════════════════════
  // 2. SUELO CONTINUO nivel 1 — todo el patio
  //    (un solo pad grande: plaza + pasadizos + bases)
  // ═══════════════════════════════════════════
  // Cubierta principal del complejo a nivel 1
  pad(88, 78, LEVEL1_Y, 52, 50, dirt);

  // ═══════════════════════════════════════════
  // 3. RAMPA izquierda (conecta nivel 0 → suelo continuo)
  // ═══════════════════════════════════════════
  pad(14, 10, LEVEL0_Y, 10, -4, grass);
  const rampDef = {
    sx: 10, sz: 2,
    ex: 12, ez: 72,
    y0: LEVEL0_Y, y1: LEVEL1_Y,
    halfWidth: 5,
  };
  addRamp(rampDef);
  buildRampMesh(THREE, scene, rampDef, stone);
  // barandillas
  for (const side of [-1, 1]) {
    const r = RAMPS[0];
    const ox = r.px * (r.halfWidth + 0.35) * side;
    const oz = r.pz * (r.halfWidth + 0.35) * side;
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, r.len), dark);
    g.position.set((r.sx + r.ex) / 2 + ox, (r.y0 + r.y1) / 2 + 0.2, (r.sz + r.ez) / 2 + oz);
    g.rotation.y = Math.atan2(r.dx, r.dz);
    g.castShadow = true; scene.add(g);
  }
  // rellano que fusiona rampa con el suelo continuo
  pad(16, 10, LEVEL1_Y, 12, 76, stone);

  // ═══════════════════════════════════════════
  // 4. PASADIZO NORTE (franja superior del mismo suelo)
  //    Paredes paralelas: borde norte  |  pasadizo  |  muro establo
  // ═══════════════════════════════════════════
  // Suelo del pasadizo ya cubierto por el pad grande; refuerzo piedra
  pad(70, 12, LEVEL1_Y, 50, 82, stone);

  // Muro norte del pasadizo (interior, paralelo al perímetro)
  box(70, 4.8, 0.8, dark, 50, LEVEL1_Y + 2.2, 88, true);

  // Muro sur del pasadizo = pared norte del establo
  // Tramo oeste (junto a rampa/establo) + hueco entrada plaza + tramo este
  box(28, 4.8, 0.8, dark, 30, LEVEL1_Y + 2.2, 76, true); // oeste
  box(22, 4.8, 0.8, dark, 72, LEVEL1_Y + 2.2, 76, true); // este (antes torre)
  // Hueco ≈ x 46..58 → baja a la plaza

  // Reja en el pasadizo
  const gateLeft = box(3.2, 4.2, 0.35, iron, 36, LEVEL1_Y + 2.0, 82, false);
  const gateRight = box(3.2, 4.2, 0.35, iron, 43, LEVEL1_Y + 2.0, 82, false);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  // ═══════════════════════════════════════════
  // 5. ESTABLO (adosado al pasadizo, 2 ambientes)
  // ═══════════════════════════════════════════
  // Suelo ya es el pad continuo; muros de habitación
  box(0.75, 4.5, 20, dark, 22, LEVEL1_Y + 2.1, 66, true); // oeste
  box(0.75, 4.5, 8, dark, 46, LEVEL1_Y + 2.1, 70, true);  // este norte
  box(0.75, 4.5, 8, dark, 46, LEVEL1_Y + 2.1, 58, true);  // este sur
  // Sur establo con puerta a plaza
  box(8, 4.5, 0.75, dark, 28, LEVEL1_Y + 2.1, 56.5, true);
  box(8, 4.5, 0.75, dark, 40, LEVEL1_Y + 2.1, 56.5, true);
  // Tabique 2 ambientes
  box(0.5, 4.0, 10, dark, 34, LEVEL1_Y + 1.9, 66, true);
  // Techo establo
  box(26, 0.35, 21, dark, 34, LEVEL1_Y + 4.6, 66);
  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);

  // ═══════════════════════════════════════════
  // 6. PLAZA (centro del mismo suelo — fuente)
  // ═══════════════════════════════════════════
  box(5.5, 0.4, 5.5, stone, 48, LEVEL1_Y + 0.18, 42, true);
  box(3.2, 0.7, 3.2, dark, 48, LEVEL1_Y + 0.5, 42, true);

  // ═══════════════════════════════════════════
  // 7. TORRES + portón (extremo este del pasadizo)
  // ═══════════════════════════════════════════
  // Torre 1 — cierra el pasadizo
  box(12, 11, 12, dark, 82, LEVEL1_Y + 5.2, 82, true);
  addPlatform(76, 88, 76, 88, LEVEL1_Y + 10.5);
  // Torre 2 — arriba derecha
  box(12, 11, 12, dark, 90, LEVEL1_Y + 5.2, 82, true);
  addPlatform(84, 96, 76, 88, LEVEL1_Y + 10.5);
  // Portón jefe entre torres (visual, sólido de momento)
  const portcullis = box(6, 7, 0.55, iron, 86, LEVEL1_Y + 3.2, 76, true);
  portcullis.name = 'portcullis';
  // Puente roto 2º piso
  box(2.8, 0.3, 6, wood, 90, LEVEL1_Y + 10.6, 78);
  addPlatform(88.5, 91.5, 75, 81, LEVEL1_Y + 10.5);

  // ═══════════════════════════════════════════
  // 8. MÓDULO 2 NIVELES (este, adosado al patio)
  // ═══════════════════════════════════════════
  // Muros del módulo abiertos al patio por el oeste (hueco puerta)
  box(0.8, 5.2, 10, dark, 74, LEVEL1_Y + 2.4, 50, true);
  box(0.8, 5.2, 10, dark, 74, LEVEL1_Y + 2.4, 30, true);
  box(24, 5.2, 0.8, dark, 86, LEVEL1_Y + 2.4, 56, true); // norte módulo
  box(24, 5.2, 0.8, dark, 86, LEVEL1_Y + 2.4, 24, true); // sur módulo
  box(0.8, 5.2, 32, dark, 97.5, LEVEL1_Y + 2.4, 40, true); // este
  box(25, 0.35, 33, dark, 86, LEVEL1_Y + 5.2, 40); // techo
  // Interior básico
  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  const keyMesh = box(0.3, 0.08, 0.12, mat(0xc9a227, 0.4, 0.6), KEY_POS.x, KEY_POS.y, KEY_POS.z);
  const leverArm = box(0.12, 0.12, 0.8, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z);
  const towerDoor = box(1.4, 2.3, 0.3, wood, 90, LEVEL1_Y + 11.5, 76.2, true);
  towerDoor.userData = { locked: true };

  // Suelo de relleno oscuro exterior
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), mat(0x101410, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(50, -0.8, 40);
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
  addWall(38, 41, 81, 83);
  if (mapData.gateLeft) mapData.gateLeft.position.x = 38.5;
  if (mapData.gateRight) mapData.gateRight.position.x = 40.5;
}

export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  mapData.towerDoor.position.y = -40;
  return true;
}
