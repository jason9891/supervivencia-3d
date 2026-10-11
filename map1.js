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

/**
 * Construye toda la geometría del mapa 1.
 * @param {THREE.Scene} scene
 * @returns {{ gate: THREE.Mesh, herbs: THREE.Group[], pageMesh: THREE.Mesh }}
 */
export function buildMap1(scene) {
  const mat = (color, roughness = 0.85, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const stoneMat  = mat(0x3a3f3c, 0.92);
  const darkStone = mat(0x2a2e2c, 0.9);
  const grassMat  = mat(0x2a3a26, 1);
  const woodMat   = mat(0x3e2b1f, 0.85);
  const ironMat   = mat(0x1a1a1c, 0.45, 0.55);
  const mossMat   = mat(0x2f4a32, 0.95);

  function addBox(w, h, d, material, x, y, z, rotY = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  function addCyl(rTop, rBot, h, material, x, y, z, segs = 8) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // ========== 1. ENTRADA EXTERIOR + REJA ==========
  // Suelo de acceso
  addBox(22, 0.5, 18, stoneMat, 0, -0.25, 26);
  // Muros laterales de la entrada
  addBox(1.4, 5.5, 18, darkStone, -10.5, 2.5, 26);
  addBox(1.4, 5.5, 18, darkStone,  10.5, 2.5, 26);
  // Arco / dintel superior
  addBox(22, 1.2, 1.5, darkStone, 0, 5.5, 18.5);

  // Reja principal (se podrá animar para que se cierre y atasque)
  const gate = addBox(18, 4.8, 0.35, ironMat, 0, 2.3, 17.6);
  gate.name = 'mainGate';
  // Barras verticales de la reja (detalle)
  for (let i = -7; i <= 7; i += 1.4) {
    addBox(0.12, 4.4, 0.12, ironMat, i, 2.2, 17.55);
  }

  // ========== 2. PATIO CON HIERBA ==========
  addBox(28, 0.35, 18, grassMat, 0, -0.17, 9);
  // Muros bajos del patio
  addBox(28, 1.6, 0.7, stoneMat, 0, 0.7, 0.5);
  addBox(0.7, 1.6, 18, stoneMat, -13.8, 0.7, 9);
  addBox(0.7, 1.6, 18, stoneMat,  13.8, 0.7, 9);
  // Algunos pilares decorativos
  addCyl(0.28, 0.32, 2.4, stoneMat, -8, 1.1, 14);
  addCyl(0.28, 0.32, 2.4, stoneMat,  8, 1.1, 14);
  addCyl(0.28, 0.32, 1.8, mossMat, -5, 0.8, 5);
  addCyl(0.28, 0.32, 1.6, mossMat,  6, 0.7, 6);

  // Hierbas recogibles (curan poco)
  const herbs = [];
  function createHerb(x, z) {
    const group = new THREE.Group();
    const leafMat = mat(0x3a6b32, 0.9);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.14 + Math.random() * 0.06, 0.28 + Math.random() * 0.1, 5),
        leafMat
      );
      leaf.position.set((Math.random() - 0.5) * 0.2, 0.14, (Math.random() - 0.5) * 0.2);
      leaf.rotation.z = (Math.random() - 0.5) * 0.4;
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
  addBox(30, 0.45, 24, stoneMat, 0, -0.22, -10);
  // Muros largos
  addBox(1.0, 4.2, 24, darkStone, -14.5, 1.9, -10);
  addBox(1.0, 4.2, 24, darkStone,  14.5, 1.9, -10);
  // Separadores de cuartos / pasillos
  addBox(12, 3.6, 0.7, stoneMat, -6, 1.7, -3);
  addBox(12, 3.6, 0.7, stoneMat,  6, 1.7, -15);
  addBox(0.7, 3.6, 8, stoneMat, 0, 1.7, -8);
  // Techo parcial (sensación de interior)
  addBox(28, 0.3, 10, darkStone, 0, 4.0, -6);

  // ========== 4. BIBLIOTECA ==========
  addBox(22, 0.45, 14, stoneMat, 0, -0.22, -28);
  addBox(1.0, 5.0, 14, darkStone, -10.8, 2.3, -28);
  addBox(1.0, 5.0, 14, darkStone,  10.8, 2.3, -28);
  // Estanterías caídas
  const shelf1 = addBox(5.5, 0.35, 1.3, woodMat, -4.5, 0.4, -25.5);
  shelf1.rotation.z = 0.55;
  const shelf2 = addBox(4.8, 0.35, 1.2, woodMat, 3.8, 0.35, -30);
  shelf2.rotation.z = -0.7;
  addBox(3.2, 0.3, 0.9, woodMat, -1, 0.25, -27).rotation.z = 0.25;
  // Libros tirados (cajas pequeñas)
  addBox(0.4, 0.15, 0.3, mat(0x4a3020), -3, 0.2, -24);
  addBox(0.35, 0.12, 0.28, mat(0x2a3a4a), 2.5, 0.18, -29);
  addBox(0.3, 0.1, 0.25, mat(0x3a2a1a), 0.5, 0.15, -26.5);

  // Página única (interactuable)
  const pageMesh = addBox(0.35, 0.02, 0.45, mat(0xe8dcc8, 0.7), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  pageMesh.rotation.x = -Math.PI / 2 + 0.15;
  pageMesh.userData = { type: 'storyPage', read: false };

  // ========== 5. ZONA DEL JEFE ==========
  addBox(34, 0.5, 20, stoneMat, 0, -0.25, -42);
  addBox(1.3, 6.5, 20, darkStone, -16.5, 3.0, -42);
  addBox(1.3, 6.5, 20, darkStone,  16.5, 3.0, -42);
  // Columnas
  addCyl(0.4, 0.45, 5.5, stoneMat, -8, 2.5, -40);
  addCyl(0.4, 0.45, 5.5, stoneMat,  8, 2.5, -40);
  addCyl(0.35, 0.4, 4.8, mossMat, -4, 2.2, -46);
  addCyl(0.35, 0.4, 4.8, mossMat,  4, 2.2, -46);
  // Puerta / arco que conecta con el resto del castillo (se abrirá después)
  addBox(10, 6.0, 0.8, darkStone, 0, 2.8, -51.5);
  addBox(2.5, 1.2, 1.0, ironMat, 0, 5.5, -51.3); // dintel metálico

  // Suelo de respaldo grande por si el jugador se sale un poco
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    mat(0x0c0e0c, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.4, -10);
  ground.receiveShadow = true;
  scene.add(ground);

  return { gate, herbs, pageMesh, pagePos: PAGE_POS.clone() };
}

/** Distancia al punto de la página (para trigger de lectura) */
export function distanceToPage(x, y, z) {
  return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z);
}
