// map1.js — El Regreso (prototipo croquis)
// Rampa DIAGONAL real nivel 0→1 (esquina inferior izq.) → pasadizo en X + reja.
// Solo mapa. Módulo 2 niveles = placeholder. Torres/establo = volúmenes básicos.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';

export const MAP1_NAME = 'El Regreso';
export const LEVEL0_Y = 0;
export const LEVEL1_Y = 8;

// Escala jugable del croquis (proporción 300×210, compactada para prueba)
// Origen: esquina inferior izquierda del rectángulo ≈ inicio rampa
export const SPAWN = { x: -70, y: LEVEL0_Y, z: -85 };

export const ZONES = {
  ramp: { minX: -85, maxX: -5, minZ: -95, maxZ: -15 },
  corridor: { minX: -15, maxX: 55, minZ: -30, maxZ: -10 },
  plaza: { minX: -50, maxX: 20, minZ: -15, maxZ: 55 },
  stable: { minX: 15, maxX: 45, minZ: 5, maxZ: 40 },
  module: { minX: -55, maxX: -15, minZ: 20, maxZ: 55 },
  towers: { minX: 45, maxX: 85, minZ: -20, maxZ: 50 },
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

// Placeholders de interacción (se recolocan al construir)
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
      player.y = gy;
      player.vy = 0;
      player.grounded = true;
      player.jumping = false;
      player.avx = 0;
      player.avz = 0;
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
  const grass = mat(0x3d5c38, 1);
  const wood = mat(0x6b4a32, 0.85);
  const iron = mat(0x3a3a40, 0.4, 0.55);
  const tile = mat(0x555a52, 0.9);

  function box(w, h, d, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return m;
  }
  function pad(w, d, y, x, z, material) {
    const th = Math.max(0.4, 0.3 + y * 0.05);
    box(w, th, d, material, x, y - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y);
  }

  // ——— 1. Plataforma inicio nivel 0 (esquina inferior izquierda) ———
  pad(18, 16, LEVEL0_Y, -70, -88, dirt);

  // ——— 2. RAMPA DIAGONAL real 0 → 1 ———
  // De (-62, -78) nivel 0  →  (-18, -28) nivel 1  (diagonal en planta)
  const rampDef = {
    sx: -62, sz: -78,
    ex: -18, ez: -28,
    y0: LEVEL0_Y, y1: LEVEL1_Y,
    halfWidth: 5.5,
  };
  addRamp(rampDef);
  buildRampMesh(THREE, scene, rampDef, stone);
  // bordes visuales de la rampa
  for (const side of [-1, 1]) {
    const r = RAMPS[0];
    const ox = r.px * (r.halfWidth + 0.35) * side;
    const oz = r.pz * (r.halfWidth + 0.35) * side;
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.7, r.len),
      dark
    );
    g.position.set(
      (r.sx + r.ex) / 2 + ox,
      (r.y0 + r.y1) / 2 + 0.2,
      (r.sz + r.ez) / 2 + oz
    );
    g.rotation.y = Math.atan2(r.dx, r.dz);
    g.castShadow = true;
    scene.add(g);
  }

  // ——— 3. Rellano / parte plana nivel 1 (fin de rampa) ———
  pad(28, 22, LEVEL1_Y, -12, -22, stone);

  // ——— 4. Pasadizo en eje X + reja que cae ———
  pad(50, 12, LEVEL1_Y, 20, -20, stone);
  box(1.0, 5.5, 12, dark, -2, LEVEL1_Y + 2.5, -20, true);
  box(1.0, 5.5, 12, dark, 42, LEVEL1_Y + 2.5, -20, true);
  box(50, 1.0, 1.0, dark, 20, LEVEL1_Y + 5.5, -14);
  box(50, 1.0, 1.0, dark, 20, LEVEL1_Y + 5.5, -26);
  const gateLeft = box(3.2, 4.5, 0.45, iron, 14, LEVEL1_Y + 2.1, -20, false);
  const gateRight = box(3.2, 4.5, 0.45, iron, 26, LEVEL1_Y + 2.1, -20, false);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  // ——— 5. Plaza nivel 1 ———
  pad(70, 60, LEVEL1_Y, -10, 25, dirt);
  // fuente
  box(6, 0.5, 6, stone, -15, LEVEL1_Y + 0.2, 20, true);
  box(3.5, 0.8, 3.5, dark, -15, LEVEL1_Y + 0.6, 20, true);

  // ——— 6. Establo (2 ambientes, placeholder) ———
  pad(22, 28, LEVEL1_Y, 30, 22, wood);
  box(0.8, 5, 28, dark, 19.5, LEVEL1_Y + 2.3, 22, true);
  box(0.8, 5, 10, dark, 40.5, LEVEL1_Y + 2.3, 32, true);
  box(0.8, 5, 10, dark, 40.5, LEVEL1_Y + 2.3, 12, true);
  // hueco puerta hacia plaza (oeste del establo ya abierto en parte)
  box(22, 5, 0.8, dark, 30, LEVEL1_Y + 2.3, 35.5, true);
  box(22, 5, 0.8, dark, 30, LEVEL1_Y + 2.3, 8.5, true);
  box(0.5, 4.5, 8, dark, 30, LEVEL1_Y + 2.1, 22, true); // tabique 2 amb.
  box(23, 0.4, 29, dark, 30, LEVEL1_Y + 5.2, 22);
  FOOD_POS.set(28, LEVEL1_Y + 0.5, 28);
  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);

  // ——— 7. Módulo 2 niveles (solo caja exterior — diseño aparte) ———
  pad(30, 28, LEVEL1_Y, -35, 38, tile);
  box(30, 6, 0.9, dark, -35, LEVEL1_Y + 2.8, 51.5, true);
  box(30, 6, 0.9, dark, -35, LEVEL1_Y + 2.8, 24.5, true);
  box(0.9, 6, 28, dark, -49.5, LEVEL1_Y + 2.8, 38, true);
  box(0.9, 6, 10, dark, -20.5, LEVEL1_Y + 2.8, 48, true);
  box(0.9, 6, 10, dark, -20.5, LEVEL1_Y + 2.8, 28, true);
  // hueco puerta
  box(31, 0.4, 29, dark, -35, LEVEL1_Y + 6.2, 38);

  // ——— 8. Franja este: torres + puerta jefe + puente (volúmenes básicos) ———
  pad(30, 55, LEVEL1_Y, 62, 15, stone);
  // Torre 1
  box(12, 14, 12, dark, 58, LEVEL1_Y + 6.5, -5, true);
  addPlatform(52, 64, -11, 1, LEVEL1_Y + 12);
  // Torre 2
  box(12, 14, 12, dark, 58, LEVEL1_Y + 6.5, 35, true);
  addPlatform(52, 64, 29, 41, LEVEL1_Y + 12);
  // Portón jefe (entre torres)
  const portcullis = box(10, 8, 0.6, iron, 58, LEVEL1_Y + 3.5, 15, true);
  portcullis.name = 'portcullis';
  // Puente roto (visual + plataforma parcial)
  box(4, 0.35, 8, wood, 58, LEVEL1_Y + 11.8, 12);
  addPlatform(56, 60, 10, 14, LEVEL1_Y + 12);
  box(3, 0.3, 4, wood, 59, LEVEL1_Y + 10.5, 18);

  PAGE_POS.set(-32, LEVEL1_Y + 1.2, 40);
  KEY_POS.set(-30, LEVEL1_Y + 1.1, 38);
  LEVER_POS.set(58, LEVEL1_Y + 12.5, 35);
  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  const keyMesh = box(0.3, 0.08, 0.12, mat(0xc9a227, 0.4, 0.6), KEY_POS.x, KEY_POS.y, KEY_POS.z);
  const leverArm = box(0.12, 0.12, 0.8, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z);
  const towerDoor = box(1.5, 2.4, 0.3, wood, 58, LEVEL1_Y + 13, 29, true);
  towerDoor.userData = { locked: true };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    mat(0x121612, 1)
  );
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
  addWall(18, 22, -21, -19);
  if (mapData.gateLeft) mapData.gateLeft.position.x = 19;
  if (mapData.gateRight) mapData.gateRight.position.x = 21;
}

export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  mapData.towerDoor.position.y = -40;
  return true;
}
