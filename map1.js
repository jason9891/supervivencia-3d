// map1.js — Mapa 1: El Regreso
// Mapa introductorio amplio. No depende del sistema de personaje.
// Zonas: entrada + reja, patio con hierba, pasillos, biblioteca, zona del jefe.

import * as THREE from 'three';

export const MAP1_NAME = 'El Regreso';

/** Zonas del mapa (AABB aproximados en XZ) */
export const ZONES = {
  entrance: { minX: -10, maxX: 10, minZ: 16, maxZ: 36 },
  patio:    { minX: -14, maxX: 14, minZ: 0,  maxZ: 18 },
  corridors:{ minX: -16, maxX: 16, minZ: -22, maxZ: 2 },
  library:  { minX: -12, maxX: 12, minZ: -36, maxZ: -20 },
  boss:     { minX: -18, maxX: 18, minZ: -52, maxZ: -34 },
};

export function getCurrentZone(x, z) {
  for (const [name, b] of Object.entries(ZONES)) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name;
  }
  return null;
}

/** Página de la biblioteca (opcional) */
export const STORY_PAGE = {
  title: 'Página encontrada',
  text: `...los sellos se debilitan.\nLo que creíamos leyenda ha vuelto a caminar.\nSi lees esto, ya es demasiado tarde para huir.\nBusca las seis runas. Solo ellas pueden volver a dormir al que no debe despertar.`,
};

const PAGE_POS = new THREE.Vector3(0.8, 0.9, -27.2);

/** Radio del jugador para colisiones */
const PLAYER_R = 0.38;

/**
 * Colisiones de paredes: lista de AABB en XZ (minX, maxX, minZ, maxZ).
 * Se construyen junto con la geometría.
 */
export const WALLS = [];

function addWall(minX, maxX, minZ, maxZ) {
  WALLS.push({ minX, maxX, minZ, maxZ });
}

/**
 * Resuelve colisión del jugador contra las paredes del mapa.
 * Modifica player.x / player.z in-place.
 */
export function resolveWallCollisions(player) {
  let x = player.x;
  let z = player.z;
  for (const w of WALLS) {
    const nearestX = Math.max(w.minX, Math.min(x, w.maxX));
    const nearestZ = Math.max(w.minZ, Math.min(z, w.maxZ));
    const dx = x - nearestX;
    const dz = z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < PLAYER_R * PLAYER_R && distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      const push = (PLAYER_R - dist) / dist;
      x += dx * push;
      z += dz * push;
    } else if (distSq <= 1e-8) {
      // Centro dentro del AABB: empujar hacia el lado más cercano
      const left = x - w.minX;
      const right = w.maxX - x;
      const near = z - w.minZ;
      const far = w.maxZ - z;
      const m = Math.min(left, right, near, far);
      if (m === left) x = w.minX - PLAYER_R;
      else if (m === right) x = w.maxX + PLAYER_R;
      else if (m === near) z = w.minZ - PLAYER_R;
      else z = w.maxZ + PLAYER_R;
    }
  }
  player.x = x;
  player.z = z;
}

/**
 * Construye toda la geometría del mapa 1.
 * @param {THREE.Scene} scene
 * @returns {{ gate: THREE.Mesh, herbs: THREE.Group[], pageMesh: THREE.Mesh }}
 */
export function buildMap1(scene) {
  WALLS.length = 0; // reset por si se llama dos veces

  // Materiales más claros y contrastados para que se lean bien en móvil
  const mat = (color, roughness = 0.82, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const stoneMat  = mat(0x6a7068, 0.9);   // piedra más clara
  const darkStone = mat(0x4a5048, 0.88);
  const grassMat  = mat(0x3d5c38, 1);
  const woodMat   = mat(0x6b4a32, 0.85);
  const ironMat   = mat(0x3a3a40, 0.4, 0.6);
  const mossMat   = mat(0x4a6b42, 0.92);
  const floorMat  = mat(0x5a6058, 0.95);

  function addBox(w, h, d, material, x, y, z, rotY = 0, solid = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (solid) {
      // AABB en XZ (ignoramos rotY por ahora; todos los muros están alineados)
      const hx = w / 2;
      const hz = d / 2;
      addWall(x - hx, x + hx, z - hz, z + hz);
    }
    return m;
  }

  function addCyl(rTop, rBot, h, material, x, y, z, segs = 8, solid = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (solid) {
      const r = Math.max(rTop, rBot) + 0.05;
      addWall(x - r, x + r, z - r, z + r);
    }
    return m;
  }

  // ========== 1. ENTRADA EXTERIOR + REJA ==========
  addBox(22, 0.5, 18, floorMat, 0, -0.25, 26); // suelo
  addBox(1.6, 5.5, 18, darkStone, -10.5, 2.5, 26, 0, true);
  addBox(1.6, 5.5, 18, darkStone,  10.5, 2.5, 26, 0, true);
  addBox(22, 1.2, 1.5, darkStone, 0, 5.5, 18.5);

  // Reja (colisionable cuando esté cerrada; por ahora sólida)
  const gate = addBox(18, 4.8, 0.4, ironMat, 0, 2.3, 17.6, 0, true);
  gate.name = 'mainGate';
  for (let i = -7; i <= 7; i += 1.4) {
    addBox(0.14, 4.4, 0.14, ironMat, i, 2.2, 17.55);
  }

  // ========== 2. PATIO CON HIERBA ==========
  addBox(28, 0.35, 18, grassMat, 0, -0.17, 9);
  // Muros del patio (sólidos)
  addBox(28, 1.8, 0.8, stoneMat, 0, 0.8, 0.4, 0, true);
  addBox(0.8, 1.8, 18, stoneMat, -13.8, 0.8, 9, 0, true);
  addBox(0.8, 1.8, 18, stoneMat,  13.8, 0.8, 9, 0, true);
  // Pilares
  addCyl(0.3, 0.34, 2.4, stoneMat, -8, 1.1, 14, 8, true);
  addCyl(0.3, 0.34, 2.4, stoneMat,  8, 1.1, 14, 8, true);
  addCyl(0.3, 0.34, 1.8, mossMat, -5, 0.8, 5, 8, true);
  addCyl(0.3, 0.34, 1.6, mossMat,  6, 0.7, 6, 8, true);

  // Hierbas recogibles
  const herbs = [];
  function createHerb(x, z) {
    const group = new THREE.Group();
    const leafMat = mat(0x5a9a48, 0.85);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.16 + Math.random() * 0.06, 0.32 + Math.random() * 0.1, 5),
        leafMat
      );
      leaf.position.set((Math.random() - 0.5) * 0.22, 0.16, (Math.random() - 0.5) * 0.22);
      leaf.rotation.z = (Math.random() - 0.5) * 0.4;
      leaf.castShadow = true;
      group.add(leaf);
    }
    group.position.set(x, 0, z);
    group.userData = { type: 'herb', heal: 8, collected: false };
    scene.add(group);
    herbs.push(group);
    return group;
  }
  createHerb(-4.2, 12.5);
  createHerb(3.1, 10.2);
  createHerb(-1.8, 7.4);
  createHerb(6.5, 13.8);
  createHerb(-7.0, 8.0);
  createHerb(1.2, 4.5);

  // ========== 3. PASILLOS Y CUARTOS ==========
  addBox(30, 0.45, 24, floorMat, 0, -0.22, -10);
  addBox(1.2, 4.2, 24, darkStone, -14.5, 1.9, -10, 0, true);
  addBox(1.2, 4.2, 24, darkStone,  14.5, 1.9, -10, 0, true);
  // Separadores
  addBox(12, 3.6, 0.8, stoneMat, -6, 1.7, -3, 0, true);
  addBox(12, 3.6, 0.8, stoneMat,  6, 1.7, -15, 0, true);
  addBox(0.8, 3.6, 8, stoneMat, 0, 1.7, -8, 0, true);
  addBox(28, 0.3, 10, darkStone, 0, 4.0, -6);

  // ========== 4. BIBLIOTECA ==========
  addBox(22, 0.45, 14, floorMat, 0, -0.22, -28);
  addBox(1.2, 5.0, 14, darkStone, -10.8, 2.3, -28, 0, true);
  addBox(1.2, 5.0, 14, darkStone,  10.8, 2.3, -28, 0, true);
  // Estanterías caídas (sin colisión fuerte para no bloquear)
  const shelf1 = addBox(5.5, 0.35, 1.3, woodMat, -4.5, 0.4, -25.5);
  shelf1.rotation.z = 0.55;
  const shelf2 = addBox(4.8, 0.35, 1.2, woodMat, 3.8, 0.35, -30);
  shelf2.rotation.z = -0.7;
  addBox(3.2, 0.3, 0.9, woodMat, -1, 0.25, -27).rotation.z = 0.25;
  addBox(0.4, 0.15, 0.3, mat(0x6a4030), -3, 0.2, -24);
  addBox(0.35, 0.12, 0.28, mat(0x3a4a5a), 2.5, 0.18, -29);
  addBox(0.3, 0.1, 0.25, mat(0x5a3a2a), 0.5, 0.15, -26.5);

  const pageMesh = addBox(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  pageMesh.rotation.x = -Math.PI / 2 + 0.15;
  pageMesh.userData = { type: 'storyPage', read: false };

  // ========== 5. ZONA DEL JEFE ==========
  addBox(34, 0.5, 20, floorMat, 0, -0.25, -42);
  addBox(1.4, 6.5, 20, darkStone, -16.5, 3.0, -42, 0, true);
  addBox(1.4, 6.5, 20, darkStone,  16.5, 3.0, -42, 0, true);
  addCyl(0.42, 0.48, 5.5, stoneMat, -8, 2.5, -40, 8, true);
  addCyl(0.42, 0.48, 5.5, stoneMat,  8, 2.5, -40, 8, true);
  addCyl(0.38, 0.42, 4.8, mossMat, -4, 2.2, -46, 8, true);
  addCyl(0.38, 0.42, 4.8, mossMat,  4, 2.2, -46, 8, true);
  // Puerta final (sólida por ahora)
  addBox(10, 6.0, 0.9, darkStone, 0, 2.8, -51.5, 0, true);
  addBox(2.5, 1.2, 1.0, ironMat, 0, 5.5, -51.3);

  // Suelo de respaldo (más visible)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    mat(0x1a1e1a, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.45, -10);
  ground.receiveShadow = true;
  scene.add(ground);

  return { gate, herbs, pageMesh, pagePos: PAGE_POS.clone() };
}

/** Distancia al punto de la página (para trigger de lectura) */
export function distanceToPage(x, y, z) {
  return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z);
}
