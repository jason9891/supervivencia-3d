// map1.js — Mapa 1: El Regreso (rediseño amplio)
// Pasillo de entrada largo sin techo → patio → salón principal →
// cuartos laterales → biblioteca de dos niveles → pasillo muerto → zona del jefe.
// Solo los cuartos/salones tienen techo. Espacio muerto entre zonas (estilo Blade).

import * as THREE from 'three';

export const MAP1_NAME = 'El Regreso';

/** Zonas del mapa (AABB en XZ) */
export const ZONES = {
  approach:  { minX: -8,  maxX: 8,  minZ: 28,  maxZ: 58 },
  gate:      { minX: -10, maxX: 10, minZ: 18,  maxZ: 30 },
  courtyard: { minX: -16, maxX: 16, minZ: 0,   maxZ: 20 },
  greathall: { minX: -14, maxX: 14, minZ: -28, maxZ: 2 },
  westroom:  { minX: -28, maxX: -12, minZ: -22, maxZ: -4 },
  eastroom:  { minX: 12,  maxX: 28, minZ: -22, maxZ: -4 },
  library:   { minX: -12, maxX: 12, minZ: -58, maxZ: -28 },
  deadhall:  { minX: -10, maxX: 10, minZ: -78, maxZ: -56 },
  boss:      { minX: -18, maxX: 18, minZ: -100, maxZ: -76 },
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

// Página en la planta baja de la biblioteca
const PAGE_POS = new THREE.Vector3(-3.2, 0.95, -42);

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

  const stone   = mat(0x6a7068, 0.9);
  const dark    = mat(0x4a5048, 0.88);
  const floor   = mat(0x5c625a, 0.94);
  const grass   = mat(0x3d5c38, 1);
  const wood    = mat(0x6b4a32, 0.85);
  const iron    = mat(0x3a3a40, 0.4, 0.55);
  const moss    = mat(0x4a6b42, 0.92);
  const tile    = mat(0x555a52, 0.9);

  function box(w, h, d, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (solid) {
      addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    }
    return m;
  }

  function cyl(rTop, rBot, h, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 8), material);
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

  // =====================================================================
  // 1. PASILLO DE APROXIMACIÓN (largo, SIN TECHO) — estilo ingreso a castillo
  //    z: 58 → 28
  // =====================================================================
  box(12, 0.45, 32, floor, 0, -0.22, 43); // suelo del pasillo
  // Muros laterales altos abiertos al cielo
  box(1.4, 6.5, 32, dark, -6.5, 3.0, 43, true);
  box(1.4, 6.5, 32, dark,  6.5, 3.0, 43, true);
  // Pilares a lo largo del pasillo (ritmo visual + espacio muerto)
  for (let z = 54; z >= 30; z -= 6) {
    cyl(0.32, 0.36, 5.5, stone, -4.2, 2.5, z, true);
    cyl(0.32, 0.36, 5.5, stone,  4.2, 2.5, z, true);
  }
  // Antorchas visuales (solo mesh; la luz se pone en index)
  for (let z = 51; z >= 33; z -= 9) {
    box(0.15, 0.5, 0.15, iron, -5.6, 3.2, z);
    box(0.15, 0.5, 0.15, iron,  5.6, 3.2, z);
  }

  // =====================================================================
  // 2. ZONA DE LA REJA (transición)
  //    z: 30 → 20
  // =====================================================================
  box(16, 0.45, 12, floor, 0, -0.22, 24);
  box(1.5, 6.5, 12, dark, -7.5, 3.0, 24, true);
  box(1.5, 6.5, 12, dark,  7.5, 3.0, 24, true);
  // Dintel
  box(16, 1.3, 1.6, dark, 0, 6.0, 20.5);
  // Reja (sólida por ahora; más adelante se anima el cierre)
  const gate = box(14, 5.2, 0.4, iron, 0, 2.5, 20.2, true);
  gate.name = 'mainGate';
  for (let i = -5.5; i <= 5.5; i += 1.2) {
    box(0.12, 4.8, 0.12, iron, i, 2.4, 20.15);
  }

  // =====================================================================
  // 3. PATIO / COURTYARD (abierto, hierba, espacio muerto)
  //    z: 20 → 0
  // =====================================================================
  box(30, 0.35, 22, grass, 0, -0.17, 10);
  // Muros bajos del patio (no cierran del todo hacia el gran salón)
  box(0.9, 2.0, 20, stone, -14.5, 0.9, 10, true);
  box(0.9, 2.0, 20, stone,  14.5, 0.9, 10, true);
  // Muro norte del patio (con hueco de la reja ya pasado)
  box(8, 2.0, 0.8, stone, -10, 0.9, 19.5, true);
  box(8, 2.0, 0.8, stone,  10, 0.9, 19.5, true);
  // Pilares y restos
  cyl(0.35, 0.4, 2.8, stone, -9, 1.2, 14, true);
  cyl(0.35, 0.4, 2.8, stone,  9, 1.2, 14, true);
  cyl(0.3, 0.34, 1.6, moss, -5, 0.7, 6, true);
  cyl(0.3, 0.34, 1.4, moss,  6, 0.6, 8, true);
  // Escombros decorativos (sin colisión fuerte)
  box(1.8, 0.5, 1.2, dark, -7, 0.2, 4);
  box(1.4, 0.4, 1.0, stone, 5, 0.15, 3);

  // Hierbas
  const herbs = [];
  function createHerb(x, z) {
    const group = new THREE.Group();
    const leafMat = mat(0x5a9a48, 0.85);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.15 + Math.random() * 0.06, 0.3 + Math.random() * 0.1, 5),
        leafMat
      );
      leaf.position.set((Math.random() - 0.5) * 0.2, 0.15, (Math.random() - 0.5) * 0.2);
      leaf.rotation.z = (Math.random() - 0.5) * 0.4;
      leaf.castShadow = true;
      group.add(leaf);
    }
    group.position.set(x, 0, z);
    group.userData = { type: 'herb', heal: 8, collected: false };
    scene.add(group);
    herbs.push(group);
  }
  createHerb(-4, 12);
  createHerb(3.5, 9);
  createHerb(-2, 5);
  createHerb(7, 13);
  createHerb(-8, 7);
  createHerb(1, 3);
  createHerb(-6, 15);
  createHerb(5, 16);

  // =====================================================================
  // 4. GRAN SALÓN (con techo) — sala principal
  //    z: 2 → -28
  // =====================================================================
  box(26, 0.45, 32, tile, 0, -0.22, -13);
  // Muros laterales del gran salón (con huecos hacia cuartos laterales)
  // Oeste: hueco hacia westroom en z ≈ -12
  box(1.3, 5.5, 10, dark, -13, 2.5, -2, true);   // tramo norte
  box(1.3, 5.5, 10, dark, -13, 2.5, -22, true);  // tramo sur
  // Este: hueco hacia eastroom
  box(1.3, 5.5, 10, dark,  13, 2.5, -2, true);
  box(1.3, 5.5, 10, dark,  13, 2.5, -22, true);
  // Muro sur del gran salón (con hueco central hacia biblioteca)
  box(8, 5.5, 1.2, dark, -9, 2.5, -28.5, true);
  box(8, 5.5, 1.2, dark,  9, 2.5, -28.5, true);
  // Muro norte (entrada desde patio) — hueco central
  box(7, 5.5, 1.0, dark, -9.5, 2.5, 1.5, true);
  box(7, 5.5, 1.0, dark,  9.5, 2.5, 1.5, true);
  // Techo del gran salón
  box(26, 0.4, 32, dark, 0, 5.6, -13);
  // Filas de pilares
  for (const z of [-4, -12, -20]) {
    cyl(0.4, 0.45, 5.2, stone, -6, 2.4, z, true);
    cyl(0.4, 0.45, 5.2, stone,  6, 2.4, z, true);
  }
  // Mesas / restos (espacio muerto legible)
  box(3.5, 0.7, 1.2, wood, -3, 0.35, -8);
  box(2.8, 0.6, 1.0, wood, 4, 0.3, -16);
  box(1.5, 0.4, 0.8, dark, 0, 0.2, -22);

  // =====================================================================
  // 5. CUARTO OESTE (armería / ruinas) — con techo
  // =====================================================================
  box(14, 0.4, 16, floor, -20, -0.2, -13);
  box(1.1, 4.5, 16, dark, -27, 2.0, -13, true); // muro oeste
  box(14, 4.5, 1.1, dark, -20, 2.0, -5, true);  // norte
  box(14, 4.5, 1.1, dark, -20, 2.0, -21, true); // sur
  // Este abierto hacia gran salón (sin muro sólido en el hueco)
  box(14, 0.35, 16, dark, -20, 4.4, -13); // techo
  // Props
  box(2.5, 1.8, 0.6, iron, -23, 0.9, -10);
  box(1.2, 0.5, 1.2, wood, -18, 0.25, -16);
  cyl(0.25, 0.3, 2.0, stone, -22, 0.9, -18, true);

  // =====================================================================
  // 6. CUARTO ESTE (capilla / almacén) — con techo
  // =====================================================================
  box(14, 0.4, 16, floor, 20, -0.2, -13);
  box(1.1, 4.5, 16, dark, 27, 2.0, -13, true);
  box(14, 4.5, 1.1, dark, 20, 2.0, -5, true);
  box(14, 4.5, 1.1, dark, 20, 2.0, -21, true);
  box(14, 0.35, 16, dark, 20, 4.4, -13);
  // Pequeño altar / estantería
  box(2.0, 1.2, 0.8, wood, 22, 0.6, -12);
  box(0.8, 1.5, 0.5, stone, 18, 0.75, -17);
  box(1.5, 0.3, 1.0, wood, 24, 0.15, -8);

  // =====================================================================
  // 7. BIBLIOTECA (dos niveles visuales) — con techo alto
  //    z: -28 → -58
  // =====================================================================
  box(22, 0.45, 30, tile, 0, -0.22, -43);
  // Muros
  box(1.2, 7.5, 30, dark, -11, 3.5, -43, true);
  box(1.2, 7.5, 30, dark,  11, 3.5, -43, true);
  // Sur (hacia deadhall) — hueco central
  box(6, 7.5, 1.2, dark, -7.5, 3.5, -57.5, true);
  box(6, 7.5, 1.2, dark,  7.5, 3.5, -57.5, true);
  // Norte — ya conectado al gran salón por el hueco
  box(6, 7.5, 1.0, dark, -7.5, 3.5, -28.8, true);
  box(6, 7.5, 1.0, dark,  7.5, 3.5, -28.8, true);
  // Techo alto
  box(22, 0.4, 30, dark, 0, 7.5, -43);

  // Mezzanine / segundo piso (solo laterales, se ve el vacío central)
  box(4.5, 0.35, 22, wood, -7.5, 3.6, -42); // balcón oeste
  box(4.5, 0.35, 22, wood,  7.5, 3.6, -42); // balcón este
  // Barandillas simples
  box(0.15, 0.9, 22, iron, -5.3, 4.1, -42);
  box(0.15, 0.9, 22, iron,  5.3, 4.1, -42);
  // Escaleras simbólicas (bloques)
  box(2.2, 0.9, 1.5, stone, -7.5, 0.4, -32);
  box(2.2, 1.8, 1.5, stone, -7.5, 0.85, -33.5);
  box(2.2, 2.7, 1.5, stone, -7.5, 1.3, -35);
  box(2.2, 3.5, 1.5, stone, -7.5, 1.7, -36.5);

  // Estanterías caídas y libros
  const s1 = box(5.5, 0.35, 1.2, wood, -4, 0.4, -38);
  s1.rotation.z = 0.5;
  const s2 = box(4.5, 0.3, 1.1, wood, 3.5, 0.3, -48);
  s2.rotation.z = -0.65;
  box(3.0, 0.25, 0.9, wood, 0, 0.2, -40);
  box(0.4, 0.15, 0.3, mat(0x6a4030), -2.5, 0.2, -36);
  box(0.35, 0.12, 0.28, mat(0x3a4a5a), 2, 0.18, -45);
  box(0.3, 0.1, 0.25, mat(0x5a3a2a), -1, 0.15, -50);
  // Estanterías en pie (paredes)
  box(0.6, 3.5, 8, wood, -9.5, 1.7, -40);
  box(0.6, 3.5, 6, wood,  9.5, 1.7, -50);

  // Página de historia
  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  pageMesh.rotation.x = -Math.PI / 2 + 0.12;
  pageMesh.userData = { type: 'storyPage', read: false };

  // =====================================================================
  // 8. PASILLO MUERTO / RUINAS (espacio vacío, atmósfera)
  //    z: -58 → -78
  // =====================================================================
  box(14, 0.4, 22, floor, 0, -0.2, -67);
  box(1.2, 5.0, 22, dark, -7, 2.3, -67, true);
  box(1.2, 5.0, 22, dark,  7, 2.3, -67, true);
  // Techo parcial roto (solo tramos)
  box(14, 0.3, 6, dark, 0, 4.8, -62);
  box(14, 0.3, 5, dark, 0, 4.8, -72);
  // Escombros y columnas rotas
  cyl(0.35, 0.4, 2.2, stone, -3, 1.0, -64, true);
  cyl(0.3, 0.35, 1.4, moss, 3, 0.6, -70, true);
  box(2.0, 0.6, 1.5, dark, 1, 0.25, -66);
  box(1.5, 0.4, 1.2, stone, -2, 0.15, -74);

  // =====================================================================
  // 9. ZONA DEL JEFE (sala amplia, techo alto)
  //    z: -78 → -100
  // =====================================================================
  box(32, 0.5, 24, tile, 0, -0.25, -88);
  box(1.4, 7.0, 24, dark, -16, 3.2, -88, true);
  box(1.4, 7.0, 24, dark,  16, 3.2, -88, true);
  // Entrada norte (desde deadhall) — hueco
  box(5, 7.0, 1.2, dark, -9, 3.2, -77, true);
  box(5, 7.0, 1.2, dark,  9, 3.2, -77, true);
  // Muro sur (puerta sellada al resto del castillo)
  box(32, 7.0, 1.3, dark, 0, 3.2, -99.5, true);
  box(4, 1.5, 1.0, iron, 0, 6.2, -99.2);
  // Techo
  box(32, 0.4, 24, dark, 0, 7.0, -88);
  // Columnas monumentales
  cyl(0.5, 0.55, 6.5, stone, -8, 3.0, -85, true);
  cyl(0.5, 0.55, 6.5, stone,  8, 3.0, -85, true);
  cyl(0.45, 0.5, 6.0, stone, -8, 2.8, -93, true);
  cyl(0.45, 0.5, 6.0, stone,  8, 2.8, -93, true);

  // Suelo de respaldo lejano
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 200),
    mat(0x141814, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.5, -20);
  ground.receiveShadow = true;
  scene.add(ground);

  return { gate, herbs, pageMesh, pagePos: PAGE_POS.clone() };
}

export function distanceToPage(x, y, z) {
  return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z);
}
