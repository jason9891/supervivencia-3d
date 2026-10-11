// map1.js — Mapa 1: El Regreso
// Inicio largo tipo mapa del enano (Blade). Patio central.
// Biblioteca en ala oeste (no en el camino al jefe).
// Gradas sólidas, pegadas a la pared, con material de piedra.

import * as THREE from 'three';

export const MAP1_NAME = 'El Regreso';

export const ZONES = {
  approach:  { minX: -7,  maxX: 7,  minZ: 28,  maxZ: 78 },
  gate:      { minX: -8,  maxX: 8,  minZ: 18,  maxZ: 30 },
  courtyard: { minX: -18, maxX: 18, minZ: -16, maxZ: 18 },
  easthall:  { minX: 16,  maxX: 34, minZ: -12, maxZ: 12 },
  library:   { minX: -38, maxX: -16, minZ: -16, maxZ: 16 },
  southhall: { minX: -12, maxX: 12, minZ: -40, maxZ: -16 },
  boss:      { minX: -16, maxX: 16, minZ: -64, maxZ: -38 },
};

export function getCurrentZone(x, z) {
  for (const [name, b] of Object.entries(ZONES)) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name;
  }
  return null;
}

export const STORY_PAGE = {
  title: 'Página encontrada',
  text: `...los sellos se debilitan.\nLo que creíamos leyenda ha vuelto a caminar.\nSi lees esto, ya es demasiado tarde para huir.\nBusca las seis runas. Solo ellas pueden volver a dormir al que no debe despertar.`,
};

const PAGE_POS = new THREE.Vector3(-28, 0.95, -4);

const PLAYER_R = 0.4;
export const WALLS = [];

function addWall(minX, maxX, minZ, maxZ) {
  WALLS.push({ minX, maxX, minZ, maxZ });
}

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
      const left = x - w.minX, right = w.maxX - x;
      const near = z - w.minZ, far = w.maxZ - z;
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

export function buildMap1(scene) {
  WALLS.length = 0;

  const mat = (color, roughness = 0.84, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const stone = mat(0x6a7068, 0.9);
  const dark  = mat(0x4a5048, 0.88);
  const floor = mat(0x5c625a, 0.94);
  const dirt  = mat(0x5a5348, 0.95);
  const wood  = mat(0x6b4a32, 0.85);
  const iron  = mat(0x3a3a40, 0.4, 0.55);
  const moss  = mat(0x4a6b42, 0.92);
  const tile  = mat(0x555a52, 0.9);
  const stepMat = mat(0x5a6058, 0.88);

  function box(w, h, d, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return m;
  }

  function cyl(rTop, rBot, h, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 10), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (solid) {
      const r = Math.max(rTop, rBot) + 0.06;
      addWall(x - r, x + r, z - r, z + r);
    }
    return m;
  }

  /** Escalera pegada a la pared: peldaños sólidos de piedra (no se atraviesan). */
  function buildStairs(baseX, baseZ, dir = 1) {
    const stepW = 2.4;
    const stepD = 0.85;
    const stepH = 0.38;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const h = stepH * (i + 1);
      const z = baseZ + dir * (i * stepD + stepD / 2);
      box(stepW, h, stepD, stepMat, baseX, h / 2, z, true);
    }
    const railX = baseX + stepW / 2 + 0.08;
    box(0.12, 1.1, steps * stepD, iron, railX, 1.0, baseZ + dir * (steps * stepD) / 2);
  }

  // =====================================================================
  // 1. PASILLO LARGO (estilo inicio del enano)
  // =====================================================================
  box(11, 0.4, 52, floor, 0, -0.2, 53);
  box(1.3, 6.0, 52, dark, -5.8, 2.8, 53, true);
  box(1.3, 6.0, 52, dark,  5.8, 2.8, 53, true);
  for (let z = 72; z >= 32; z -= 5) {
    cyl(0.28, 0.32, 5.2, stone, -3.6, 2.4, z, true);
    cyl(0.28, 0.32, 5.2, stone,  3.6, 2.4, z, true);
  }
  box(1.2, 0.4, 0.9, dark, -1.5, 0.15, 60);
  box(0.9, 0.35, 1.1, stone, 1.8, 0.12, 48);
  box(1.4, 0.3, 0.8, wood, -0.5, 0.1, 40);
  cyl(0.22, 0.26, 1.0, moss, 2.0, 0.4, 55, true);

  // Reja CERRADA solo DETRÁS del spawn (no bloquea el avance)
  box(11, 5.5, 0.5, iron, 0, 2.5, 78.5, true);
  for (let i = -4; i <= 4; i += 1.1) {
    box(0.12, 5.0, 0.12, iron, i, 2.4, 78.4);
  }

  // =====================================================================
  // 2. PÓRTICO / paso abierto al patio (la reja del pórtico NO bloquea)
  // =====================================================================
  box(14, 0.4, 8, floor, 0, -0.2, 24);
  box(1.4, 5.5, 8, dark, -6.5, 2.5, 24, true);
  box(1.4, 5.5, 8, dark,  6.5, 2.5, 24, true);
  box(14, 1.2, 1.3, dark, 0, 5.4, 27.2);
  // Reja visual semi-abierta / ya pasada (sin colisión en el centro)
  const gate = box(3, 5.0, 0.35, iron, -4.5, 2.4, 27.3, true); // hoja izquierda
  gate.name = 'mainGate';
  box(3, 5.0, 0.35, iron, 4.5, 2.4, 27.3, true); // hoja derecha
  // Centro libre para pasar

  // =====================================================================
  // 3. PATIO CENTRAL
  // =====================================================================
  box(34, 0.35, 32, dirt, 0, -0.17, 0);
  cyl(2.3, 2.4, 0.45, stone, 0, 0.12, 0, true);
  cyl(1.5, 1.6, 0.65, dark, 0, 0.5, 0, true);
  cyl(0.32, 0.38, 1.1, stone, 0, 1.15, 0, true);

  box(9, 2.0, 0.85, stone, -11, 0.9, 15.5, true);
  box(9, 2.0, 0.85, stone,  11, 0.9, 15.5, true);
  box(9, 2.0, 0.85, stone, -11, 0.9, -15.5, true);
  box(9, 2.0, 0.85, stone,  11, 0.9, -15.5, true);
  box(0.85, 2.0, 9, stone, -16.5, 0.9, -9, true);
  box(0.85, 2.0, 9, stone, -16.5, 0.9,  9, true);
  box(0.85, 2.0, 9, stone,  16.5, 0.9, -9, true);
  box(0.85, 2.0, 9, stone,  16.5, 0.9,  9, true);

  cyl(2.0, 2.2, 4.2, stone, -15, 1.9, 14, true);
  cyl(2.0, 2.2, 4.2, stone,  15, 1.9, 14, true);
  cyl(2.0, 2.2, 4.2, stone, -15, 1.9, -14, true);
  cyl(2.0, 2.2, 4.2, stone,  15, 1.9, -14, true);

  box(1.5, 0.45, 1.0, dark, -7, 0.18, 5);
  box(1.2, 0.35, 0.9, stone, 6, 0.12, -4);
  box(1.8, 0.3, 0.8, wood, -3, 0.1, -8);
  cyl(0.25, 0.3, 1.2, moss, 4, 0.5, 7, true);

  const herbs = [];
  function createHerb(x, z) {
    const group = new THREE.Group();
    const leafMat = mat(0x5a9a48, 0.85);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.14 + Math.random() * 0.05, 0.26 + Math.random() * 0.08, 5),
        leafMat
      );
      leaf.position.set((Math.random() - 0.5) * 0.18, 0.13, (Math.random() - 0.5) * 0.18);
      leaf.rotation.z = (Math.random() - 0.5) * 0.4;
      leaf.castShadow = true;
      group.add(leaf);
    }
    group.position.set(x, 0, z);
    group.userData = { type: 'herb', heal: 8, collected: false };
    scene.add(group);
    herbs.push(group);
  }
  [[-9, 6], [8, 4], [-4, -9], [5, -7], [-11, -2], [10, 9], [-2, 10], [3, -11]].forEach(([x, z]) => createHerb(x, z));

  // =====================================================================
  // 4. ALA ESTE
  // =====================================================================
  box(14, 0.4, 22, floor, 24, -0.2, 0);
  box(1.1, 4.6, 22, dark, 30.5, 2.1, 0, true);
  box(14, 4.6, 1.1, dark, 24, 2.1, 10.5, true);
  box(14, 4.6, 1.1, dark, 24, 2.1, -10.5, true);
  box(14, 0.35, 22, dark, 24, 4.5, 0);
  cyl(0.32, 0.36, 3.8, stone, 20, 1.8, 4, true);
  cyl(0.32, 0.36, 3.8, stone, 20, 1.8, -4, true);
  box(2.4, 0.5, 1.0, wood, 26, 0.25, -2);

  // =====================================================================
  // 5. BIBLIOTECA — OESTE (exploración, no camino al jefe)
  // =====================================================================
  box(18, 0.4, 28, tile, -26, -0.2, 0);
  box(1.2, 6.5, 28, dark, -34.5, 3.0, 0, true);
  box(18, 6.5, 1.2, dark, -26, 3.0, 13.5, true);
  box(18, 6.5, 1.2, dark, -26, 3.0, -13.5, true);
  box(18, 0.35, 28, dark, -26, 6.5, 0);

  // Mezzanine contra el muro oeste
  box(5.5, 0.32, 18, wood, -30.5, 3.4, 0);
  box(0.12, 0.9, 18, iron, -27.7, 3.95, 0);

  // Gradas: junto al muro norte, subiendo hacia el mezzanine
  buildStairs(-30.5, 8.5, -1);

  box(0.55, 3.0, 10, wood, -33.5, 1.4, 4);
  box(0.55, 3.0, 8, wood, -33.5, 1.4, -6);
  box(8, 3.0, 0.55, wood, -28, 1.4, -12.5);
  box(8, 3.0, 0.55, wood, -28, 1.4, 12.5);
  const s1 = box(4.5, 0.3, 1.0, wood, -22, 0.35, 3);
  s1.rotation.z = 0.4;
  const s2 = box(3.8, 0.28, 0.9, wood, -24, 0.3, -7);
  s2.rotation.z = -0.5;
  box(0.35, 0.12, 0.28, mat(0x6a4030), -23, 0.2, 1);
  box(0.3, 0.1, 0.25, mat(0x3a4a5a), -25, 0.18, -5);

  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  pageMesh.rotation.x = -Math.PI / 2 + 0.12;
  pageMesh.userData = { type: 'storyPage', read: false };

  // =====================================================================
  // 6. SALÓN SUR → jefe (camino principal, sin biblioteca)
  // =====================================================================
  box(20, 0.4, 22, floor, 0, -0.2, -28);
  box(1.2, 4.8, 22, dark, -10, 2.2, -28, true);
  box(1.2, 4.8, 22, dark,  10, 2.2, -28, true);
  box(20, 0.3, 8, dark, 0, 4.6, -24);
  box(20, 0.3, 6, dark, 0, 4.6, -32);
  cyl(0.3, 0.35, 2.0, stone, -4, 0.9, -26, true);
  box(1.6, 0.45, 1.1, dark, 3, 0.18, -30);

  // =====================================================================
  // 7. SALA DEL JEFE
  // =====================================================================
  box(28, 0.45, 22, tile, 0, -0.22, -50);
  box(1.3, 6.5, 22, dark, -14, 3.0, -50, true);
  box(1.3, 6.5, 22, dark,  14, 3.0, -50, true);
  box(5, 6.5, 1.2, dark, -9, 3.0, -39.5, true);
  box(5, 6.5, 1.2, dark,  9, 3.0, -39.5, true);
  box(28, 6.5, 1.3, dark, 0, 3.0, -60.5, true);
  box(3.5, 1.3, 1.0, iron, 0, 5.8, -60.2);
  box(28, 0.35, 22, dark, 0, 6.5, -50);
  cyl(0.45, 0.5, 6.0, stone, -7, 2.8, -48, true);
  cyl(0.45, 0.5, 6.0, stone,  7, 2.8, -48, true);
  cyl(0.4, 0.45, 5.5, stone, -7, 2.5, -55, true);
  cyl(0.4, 0.45, 5.5, stone,  7, 2.5, -55, true);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 180),
    mat(0x141814, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.5, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  return { gate, herbs, pageMesh, pagePos: PAGE_POS.clone() };
}

export function distanceToPage(x, y, z) {
  return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z);
}
