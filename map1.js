// map1.js — Mapa 1: El Regreso
// Layout inspirado en fortaleza con patio central.
// La reja queda DETRÁS del spawn (ya cerrada); el jugador explora el patio y los salones conectados.

import * as THREE from 'three';

export const MAP1_NAME = 'El Regreso';

/** Zonas (AABB en XZ). Origen = centro del patio. */
export const ZONES = {
  courtyard: { minX: -18, maxX: 18, minZ: -18, maxZ: 18 },
  gate:      { minX: -8,  maxX: 8,  minZ: 16,  maxZ: 28 },
  northhall: { minX: -16, maxX: 16, minZ: 16,  maxZ: 36 },
  westhall:  { minX: -36, maxX: -16, minZ: -14, maxZ: 14 },
  easthall:  { minX: 16,  maxX: 36, minZ: -14, maxZ: 14 },
  library:   { minX: -14, maxX: 14, minZ: -40, maxZ: -16 },
  southwing: { minX: -12, maxX: 12, minZ: -52, maxZ: -38 },
  boss:      { minX: -16, maxX: 16, minZ: -72, maxZ: -50 },
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

// Página en la biblioteca (sur del patio)
const PAGE_POS = new THREE.Vector3(-2.5, 0.95, -28);

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

  // =====================================================================
  // PATIO CENTRAL (abierto, espacio muerto amplio)
  // =====================================================================
  box(36, 0.35, 36, dirt, 0, -0.17, 0);

  // Fuente octogonal al centro (decorativa + colisión ligera)
  cyl(2.4, 2.5, 0.5, stone, 0, 0.15, 0, true);
  cyl(1.6, 1.7, 0.7, dark, 0, 0.55, 0, true);
  cyl(0.35, 0.4, 1.2, stone, 0, 1.2, 0, true);

  // =====================================================================
  // REJA AL NORTE (DETRÁS del spawn — ya cerrada, no bloquea el avance)
  // El jugador aparece mirando al sur, con la reja a su espalda.
  // =====================================================================
  // Suelo del pórtico norte
  box(14, 0.4, 10, floor, 0, -0.2, 22);
  // Muros del pórtico
  box(1.4, 5.5, 10, dark, -6.5, 2.5, 22, true);
  box(1.4, 5.5, 10, dark,  6.5, 2.5, 22, true);
  // Dintel
  box(14, 1.2, 1.4, dark, 0, 5.5, 26.5);
  // Reja CERRADA detrás (z alto) — no impide explorar el patio
  const gate = box(12, 5.0, 0.4, iron, 0, 2.4, 26.8, true);
  gate.name = 'mainGate';
  for (let i = -4.5; i <= 4.5; i += 1.15) {
    box(0.12, 4.6, 0.12, iron, i, 2.3, 26.75);
  }

  // =====================================================================
  // MUROS DEL PATIO (perímetro con huecos hacia los salones)
  // Norte del patio (hacia reja): hueco central ya abierto
  box(10, 2.2, 0.9, stone, -12, 1.0, 17.5, true);
  box(10, 2.2, 0.9, stone,  12, 1.0, 17.5, true);
  // Sur del patio (hacia biblioteca): hueco central
  box(10, 2.2, 0.9, stone, -12, 1.0, -17.5, true);
  box(10, 2.2, 0.9, stone,  12, 1.0, -17.5, true);
  // Oeste del patio (hacia westhall): hueco
  box(0.9, 2.2, 10, stone, -17.5, 1.0, -10, true);
  box(0.9, 2.2, 10, stone, -17.5, 1.0,  10, true);
  // Este del patio (hacia easthall): hueco
  box(0.9, 2.2, 10, stone,  17.5, 1.0, -10, true);
  box(0.9, 2.2, 10, stone,  17.5, 1.0,  10, true);

  // Torres de esquina del patio (como en el mapa de referencia)
  cyl(2.2, 2.4, 4.5, stone, -16, 2.0, 16, true);
  cyl(2.2, 2.4, 4.5, stone,  16, 2.0, 16, true);
  cyl(2.2, 2.4, 4.5, stone, -16, 2.0, -16, true);
  cyl(2.2, 2.4, 4.5, stone,  16, 2.0, -16, true);

  // Escombros / espacio muerto en el patio
  box(1.6, 0.5, 1.1, dark, -8, 0.2, 6);
  box(1.3, 0.4, 1.0, stone, 7, 0.15, -5);
  box(2.0, 0.35, 0.9, wood, -4, 0.15, -9);
  cyl(0.28, 0.32, 1.3, moss, 5, 0.55, 8, true);
  cyl(0.25, 0.3, 1.1, moss, -6, 0.45, -7, true);

  // Hierbas en el patio
  const herbs = [];
  function createHerb(x, z) {
    const group = new THREE.Group();
    const leafMat = mat(0x5a9a48, 0.85);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.15 + Math.random() * 0.05, 0.28 + Math.random() * 0.08, 5),
        leafMat
      );
      leaf.position.set((Math.random() - 0.5) * 0.2, 0.14, (Math.random() - 0.5) * 0.2);
      leaf.rotation.z = (Math.random() - 0.5) * 0.4;
      leaf.castShadow = true;
      group.add(leaf);
    }
    group.position.set(x, 0, z);
    group.userData = { type: 'herb', heal: 8, collected: false };
    scene.add(group);
    herbs.push(group);
  }
  [[-10, 8], [9, 5], [-5, -10], [6, -8], [-12, -3], [11, 10], [-3, 12], [4, -12]].forEach(([x, z]) => createHerb(x, z));

  // =====================================================================
  // SALÓN NORTE (atrás de la reja, vacío / abandonado) — con techo
  // =====================================================================
  box(28, 0.4, 14, tile, 0, -0.2, 28);
  box(1.2, 5.0, 14, dark, -14, 2.3, 28, true);
  box(1.2, 5.0, 14, dark,  14, 2.3, 28, true);
  box(28, 5.0, 1.2, dark, 0, 2.3, 34.5, true); // fondo norte
  box(28, 0.35, 14, dark, 0, 5.0, 28); // techo
  // Props vacíos
  box(3.0, 0.7, 1.2, wood, -5, 0.35, 30);
  box(2.2, 0.5, 1.0, wood, 6, 0.25, 27);

  // =====================================================================
  // ALA OESTE (salón vacío) — con techo
  // =====================================================================
  box(16, 0.4, 26, floor, -26, -0.2, 0);
  box(1.2, 4.8, 26, dark, -33.5, 2.2, 0, true);
  box(16, 4.8, 1.2, dark, -26, 2.2, 12.5, true);
  box(16, 4.8, 1.2, dark, -26, 2.2, -12.5, true);
  // Este abierto al patio (sin muro en el hueco)
  box(16, 0.35, 26, dark, -26, 4.7, 0); // techo
  cyl(0.35, 0.4, 4.0, stone, -22, 1.9, 6, true);
  cyl(0.35, 0.4, 4.0, stone, -22, 1.9, -6, true);
  box(2.5, 0.6, 1.3, wood, -28, 0.3, 2);
  box(1.8, 1.2, 0.7, iron, -30, 0.6, -5);

  // =====================================================================
  // ALA ESTE (salón vacío) — con techo
  // =====================================================================
  box(16, 0.4, 26, floor, 26, -0.2, 0);
  box(1.2, 4.8, 26, dark, 33.5, 2.2, 0, true);
  box(16, 4.8, 1.2, dark, 26, 2.2, 12.5, true);
  box(16, 4.8, 1.2, dark, 26, 2.2, -12.5, true);
  box(16, 0.35, 26, dark, 26, 4.7, 0);
  cyl(0.35, 0.4, 4.0, stone, 22, 1.9, 6, true);
  cyl(0.35, 0.4, 4.0, stone, 22, 1.9, -6, true);
  box(2.8, 0.55, 1.1, wood, 28, 0.28, -3);
  box(1.4, 0.9, 0.8, stone, 30, 0.45, 5);

  // =====================================================================
  // BIBLIOTECA (sur del patio, dos niveles visuales) — con techo
  // =====================================================================
  box(24, 0.4, 22, tile, 0, -0.2, -28);
  box(1.2, 7.0, 22, dark, -12, 3.3, -28, true);
  box(1.2, 7.0, 22, dark,  12, 3.3, -28, true);
  // Sur de la biblioteca (hacia southwing): hueco
  box(7, 7.0, 1.2, dark, -8.5, 3.3, -38.5, true);
  box(7, 7.0, 1.2, dark,  8.5, 3.3, -38.5, true);
  // Norte ya conectado al patio por el hueco del muro del patio
  box(24, 0.35, 22, dark, 0, 7.0, -28); // techo alto

  // Mezzanine
  box(4.5, 0.3, 16, wood, -7.5, 3.5, -28);
  box(4.5, 0.3, 16, wood,  7.5, 3.5, -28);
  box(0.12, 0.85, 16, iron, -5.3, 4.0, -28);
  box(0.12, 0.85, 16, iron,  5.3, 4.0, -28);
  // Escalera simple
  box(2.0, 0.85, 1.3, stone, -7.5, 0.4, -20);
  box(2.0, 1.7, 1.3, stone, -7.5, 0.8, -21.5);
  box(2.0, 2.55, 1.3, stone, -7.5, 1.2, -23);
  box(2.0, 3.4, 1.3, stone, -7.5, 1.6, -24.5);

  // Estanterías y libros
  const s1 = box(5.0, 0.3, 1.1, wood, -3.5, 0.35, -26);
  s1.rotation.z = 0.45;
  const s2 = box(4.2, 0.28, 1.0, wood, 3.2, 0.3, -32);
  s2.rotation.z = -0.55;
  box(0.55, 3.2, 7, wood, -10.5, 1.5, -30);
  box(0.55, 3.2, 5, wood,  10.5, 1.5, -34);
  box(0.35, 0.12, 0.28, mat(0x6a4030), -2, 0.2, -24);
  box(0.3, 0.1, 0.25, mat(0x3a4a5a), 1.5, 0.18, -30);

  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  pageMesh.rotation.x = -Math.PI / 2 + 0.12;
  pageMesh.userData = { type: 'storyPage', read: false };

  // =====================================================================
  // ALA SUR / PASILLO HACIA EL JEFE (espacio muerto)
  // =====================================================================
  box(18, 0.4, 14, floor, 0, -0.2, -45);
  box(1.2, 4.5, 14, dark, -9, 2.0, -45, true);
  box(1.2, 4.5, 14, dark,  9, 2.0, -45, true);
  // Techo parcial
  box(18, 0.3, 6, dark, 0, 4.4, -42);
  box(18, 0.3, 5, dark, 0, 4.4, -48);
  cyl(0.3, 0.35, 1.8, stone, -3, 0.8, -44, true);
  box(1.8, 0.5, 1.2, dark, 2, 0.2, -47);

  // =====================================================================
  // SALA DEL JEFE
  // =====================================================================
  box(28, 0.45, 20, tile, 0, -0.22, -60);
  box(1.3, 6.5, 20, dark, -14, 3.0, -60, true);
  box(1.3, 6.5, 20, dark,  14, 3.0, -60, true);
  // Entrada norte (desde southwing): hueco
  box(5, 6.5, 1.2, dark, -9, 3.0, -50.5, true);
  box(5, 6.5, 1.2, dark,  9, 3.0, -50.5, true);
  // Muro sur sellado
  box(28, 6.5, 1.3, dark, 0, 3.0, -69.5, true);
  box(3.5, 1.3, 1.0, iron, 0, 5.8, -69.2);
  box(28, 0.35, 20, dark, 0, 6.5, -60); // techo
  cyl(0.45, 0.5, 6.0, stone, -7, 2.8, -58, true);
  cyl(0.45, 0.5, 6.0, stone,  7, 2.8, -58, true);
  cyl(0.4, 0.45, 5.5, stone, -7, 2.5, -64, true);
  cyl(0.4, 0.45, 5.5, stone,  7, 2.5, -64, true);

  // Suelo de respaldo
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 160),
    mat(0x141814, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.5, -15);
  ground.receiveShadow = true;
  scene.add(ground);

  return { gate, herbs, pageMesh, pagePos: PAGE_POS.clone() };
}

export function distanceToPage(x, y, z) {
  return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z);
}
