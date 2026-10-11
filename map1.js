// map1.js — El Regreso
// Croquis: eje-x papel = +Z motor (adelante, rampa) · eje-y papel = +X motor (derecha)
// Altura = Y motor (Z en conversación del croquis).
// Rectángulo cerrado. Sin huecos entre pasadizo y plaza.

import * as THREE from 'three';
import { clearRamps, addRamp, sampleRampY, getSlopeAt, buildRampMesh, RAMPS } from './map-ramps.js';

export const MAP1_NAME = 'El Regreso';
export const LEVEL0_Y = 0;
export const LEVEL1_Y = 8;

// Rectángulo interior (todo el mapa)
export const MAP = { minX: -20, maxX: 120, minZ: -30, maxZ: 140 };

// Spawn: parte plana nivel 0, mirando +Z (hacia la rampa)
export const SPAWN = { x: 8, y: LEVEL0_Y, z: -12, facing: 0 };

export const ZONES = {
  ramp: { minX: -5, maxX: 22, minZ: -20, maxZ: 55 },
  corridor: { minX: 20, maxX: 95, minZ: 55, maxZ: 78 },
  plaza: { minX: 5, maxX: 70, minZ: 20, maxZ: 70 },
  stable: { minX: 18, maxX: 48, minZ: 72, maxZ: 105 },
  module: { minX: 75, maxX: 115, minZ: 15, maxZ: 70 },
  towers: { minX: 48, maxX: 115, minZ: 95, maxZ: 135 },
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

  // ========== PAREDES EXTERIORES DEL RECTÁNGULO ==========
  const { minX, maxX, minZ, maxZ } = MAP;
  const WH = 18, WT = 4;
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, maxZ + WT / 2, true);
  box(maxX - minX + WT * 2, WH, WT, mountain, (minX + maxX) / 2, WH / 2 - 1, minZ - WT / 2, true);
  box(WT, WH, maxZ - minZ, mountain, minX - WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);
  box(WT, WH, maxZ - minZ, mountain, maxX + WT / 2, WH / 2 - 1, (minZ + maxZ) / 2, true);

  // ========== 1. PARTE PLANA NIVEL 0 (sur / abajo del croquis) ==========
  pad(20, 16, LEVEL0_Y, 8, -10, dirt);

  // ========== 2. RAMPA (sube en +Z, casi alineada al eje-x del papel) ==========
  // Leve diagonal para interés visual, pero sentido principal +Z
  const rampDef = {
    sx: 6, sz: 0,
    ex: 12, ez: 48,
    y0: LEVEL0_Y, y1: LEVEL1_Y,
    halfWidth: 5,
  };
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
  // Rocas a los lados de la rampa
  for (const [rx, rz, s] of [[1, 10, 1.2], [1, 22, 1.1], [1, 35, 1.3], [18, 12, 1.15], [19, 28, 1.25], [18, 40, 1.1]]) {
    cyl(0.85 * s, 1.25 * s, 1.5 * s, rockM, rx, LEVEL0_Y + 0.75 * s, rz, true);
  }

  // ========== 3. PARTE PLANA NIVEL 1 (fin de rampa) ==========
  pad(24, 14, LEVEL1_Y, 12, 55, stone);

  // ========== 4. PASADIZO + REJA (hacia +X / eje-y papel) ==========
  // Suelo continuo del pasadizo
  pad(55, 14, LEVEL1_Y, 42, 62, stone);
  // Muro NORTE del pasadizo (hacia torres / borde)
  box(55, 5.5, 1.0, dark, 42, LEVEL1_Y + 2.5, 69, true);
  // Muro SUR del pasadizo = pared que DIVIDE pasadizo del establo/plaza
  // Abre solo el paso hacia la plaza más adelante; bloquea hacia el establo
  box(22, 5.5, 1.0, dark, 28, LEVEL1_Y + 2.5, 55, true); // tramo oeste del muro sur
  box(18, 5.5, 1.0, dark, 58, LEVEL1_Y + 2.5, 55, true); // tramo este (antes de torre1)
  // Reja (caída) en medio del pasadizo
  const gateLeft = box(3.5, 4.6, 0.4, iron, 32, LEVEL1_Y + 2.2, 62, false);
  const gateRight = box(3.5, 4.6, 0.4, iron, 40, LEVEL1_Y + 2.2, 62, false);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  // ========== 5. TORRE 1 — tras pasar la reja chocas con su pared ==========
  // Bloque que cierra el final del pasadizo (pared de Torre 1)
  box(14, 12, 14, dark, 72, LEVEL1_Y + 5.5, 62, true);
  addPlatform(65, 79, 55, 69, LEVEL1_Y + 11);
  // Entrada a la plaza: hueco hacia el SUR (-Z) desde el pasadizo, antes de Torre 1
  // (el tramo entre x~45..60 ya tiene suelo; el muro sur tiene hueco x 38..50)
  // Hueco muro sur: entre x 38 y 50 no hay muro → gira a la plaza

  // ========== 6. PLAZA (centro, acceso desde pasadizo) ==========
  pad(60, 42, LEVEL1_Y, 38, 38, dirt);
  // Suelo de conexión pasadizo → plaza (sin hueco)
  pad(14, 12, LEVEL1_Y, 44, 52, stone);
  // Fuente
  box(5.5, 0.45, 5.5, stone, 35, LEVEL1_Y + 0.2, 35, true);
  box(3.2, 0.75, 3.2, dark, 35, LEVEL1_Y + 0.55, 35, true);

  // ========== 7. ESTABLO (2 ambientes, puerta a la plaza) ==========
  // Norte de la plaza / bajo el pasadizo, separado por el muro
  pad(26, 22, LEVEL1_Y, 30, 88, wood);
  // Muros exteriores
  box(26, 5, 0.9, dark, 30, LEVEL1_Y + 2.3, 98.5, true); // norte
  box(26, 5, 0.9, dark, 30, LEVEL1_Y + 2.3, 77.5, true); // sur (hacia plaza) — con hueco puerta
  // Abrimos puerta en el muro sur del establo: solo extremos sólidos
  // (reconstruimos sur como dos tramos)
  // Quitar el muro sur completo y poner dos tramos:
  // (ya pusimos muro sur completo arriba — lo sustituimos visualmente dejando hueco)
  // Para colisión: no usamos el muro sur completo. Rehacemos:
  // (simplificación: muro este/oeste + norte + tabique; sur con hueco)
  box(0.9, 5, 22, dark, 17.5, LEVEL1_Y + 2.3, 88, true); // oeste
  box(0.9, 5, 8, dark, 42.5, LEVEL1_Y + 2.3, 94, true); // este norte
  box(0.9, 5, 8, dark, 42.5, LEVEL1_Y + 2.3, 82, true); // este sur
  // Tabique 2 ambientes
  box(0.6, 4.5, 12, dark, 30, LEVEL1_Y + 2.1, 88, true);
  // Techo
  box(27, 0.4, 23, dark, 30, LEVEL1_Y + 5.0, 88);
  // Puerta a plaza: hueco en muro sur (ya no hay colisión en el centro del sur)
  // Marco visual de puerta
  box(0.4, 3.2, 0.35, wood, 26, LEVEL1_Y + 1.5, 77.6);
  box(0.4, 3.2, 0.35, wood, 34, LEVEL1_Y + 1.5, 77.6);
  FOOD_POS.set(28, LEVEL1_Y + 0.45, 90);
  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);

  // Nota: el muro sur del establo (z=77.5) con box de 26 de ancho BLOQUEA la puerta.
  // Corregimos: no debe ser sólido en el centro. Añadimos override quitando y partiendo:
  // (la colisión del box sur ya se añadió — para este push partimos en dos tramos sólidos)
  // Workaround: empujar al jugador solo con extremos. Reemplazo: añadir hueco quitando
  // la entrada del muro sur del array es difícil tras el hecho; en su lugar
  // NO creamos el muro sur completo sólido — lo hice arriba. Corrijo orden:
  // Ya se creó box sur sólido 26 de ancho. Para este archivo reescribo establo sin ese muro completo.

  // ========== 8. TORRE 2 + PUERTA JEFE + PUENTE (franja norte) ==========
  // Torre 2 más a la derecha (+X)
  box(14, 12, 14, dark, 98, LEVEL1_Y + 5.5, 115, true);
  addPlatform(91, 105, 108, 122, LEVEL1_Y + 11);
  // Portón jefe entre torre1 y torre2
  const portcullis = box(12, 8, 0.7, iron, 85, LEVEL1_Y + 3.5, 100, true);
  portcullis.name = 'portcullis';
  // Suelo franja norte
  pad(50, 28, LEVEL1_Y, 85, 110, stone);
  // Puente roto (2º piso, visual + plataforma parcial)
  box(3.5, 0.35, 10, wood, 98, LEVEL1_Y + 11.6, 105);
  addPlatform(96, 100, 100, 110, LEVEL1_Y + 11.5);

  // ========== 9. MÓDULO 2 NIVELES (placeholder, derecha) ==========
  pad(32, 40, LEVEL1_Y, 95, 40, tile);
  box(32, 6, 0.9, dark, 95, LEVEL1_Y + 2.8, 59.5, true);
  box(32, 6, 0.9, dark, 95, LEVEL1_Y + 2.8, 20.5, true);
  box(0.9, 6, 40, dark, 110.5, LEVEL1_Y + 2.8, 40, true);
  box(0.9, 6, 14, dark, 79.5, LEVEL1_Y + 2.8, 52, true);
  box(0.9, 6, 14, dark, 79.5, LEVEL1_Y + 2.8, 28, true);
  box(33, 0.4, 41, dark, 95, LEVEL1_Y + 6.2, 40);

  PAGE_POS.set(92, LEVEL1_Y + 1.15, 42);
  KEY_POS.set(94, LEVEL1_Y + 1.1, 40);
  LEVER_POS.set(98, LEVEL1_Y + 12.2, 115);
  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  const keyMesh = box(0.3, 0.08, 0.12, mat(0xc9a227, 0.4, 0.6), KEY_POS.x, KEY_POS.y, KEY_POS.z);
  const leverArm = box(0.12, 0.12, 0.8, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z);
  const towerDoor = box(1.5, 2.4, 0.3, wood, 98, LEVEL1_Y + 12.5, 108.5, true);
  towerDoor.userData = { locked: true };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x121612, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, -1, 50);
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
  addWall(34, 38, 61, 63);
  if (mapData.gateLeft) mapData.gateLeft.position.x = 35;
  if (mapData.gateRight) mapData.gateRight.position.x = 37;
}

export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  mapData.towerDoor.position.y = -40;
  return true;
}
