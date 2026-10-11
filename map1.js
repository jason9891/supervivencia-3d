// map1.js — El Regreso
// Estructura narrativa:
// 1) Sendero del veterano (paisaje, entrada que solo él conoce)
// 2) Plaza del pueblo — feria interrumpida (sin heridos)
// 3) Puesto del sabio (página de historia)
// 4) Puente hacia el ala noble
// 5) Ala de la nobleza — confrontación con el villano

import * as THREE from 'three';

export const MAP1_NAME = 'El Regreso';
export const CASTLE_Y = 2.6;

/**
 * Ambientes asociados a la historia.
 * Usa getCurrentZone() para triggers, música, diálogos, etc.
 */
export const ZONES = {
  river:        { minX: -14, maxX: 14, minZ: 95,  maxZ: 118 },
  veteran_path: { minX: -12, maxX: 12, minZ: 58,  maxZ: 96 },
  side_gate:    { minX: -10, maxX: 10, minZ: 46,  maxZ: 60 },
  plaza:        { minX: -20, maxX: 20, minZ: -8,  maxZ: 48 },
  sage:         { minX: -22, maxX: -8, minZ: 8,   maxZ: 28 },
  market:       { minX: 8,   maxX: 28, minZ: 4,   maxZ: 32 },
  bridge:       { minX: -6,  maxX: 6,  minZ: -28, maxZ: -6 },
  nobility:     { minX: -18, maxX: 18, minZ: -58, maxZ: -26 },
};

export function getCurrentZone(x, z) {
  for (const [name, b] of Object.entries(ZONES)) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name;
  }
  return null;
}

export const STORY_PAGE = {
  title: 'Notas del sabio',
  text: `...los sellos se debilitan.\nLo que creíamos leyenda ha vuelto a caminar.\nSi lees esto, ya es demasiado tarde para huir.\nBusca las seis runas. Solo ellas pueden volver a dormir al que no debe despertar.`,
};

// Página en el puesto del sabio (borde oeste de la plaza)
const PAGE_POS = new THREE.Vector3(-14.5, CASTLE_Y + 1.05, 18);

const PLAYER_R = 0.4;
export const WALLS = [];
export const PLATFORMS = [];

function addWall(minX, maxX, minZ, maxZ) {
  WALLS.push({ minX, maxX, minZ, maxZ });
}
function addPlatform(minX, maxX, minZ, maxZ, y) {
  PLATFORMS.push({ minX, maxX, minZ, maxZ, y });
}

export function getGroundHeight(x, z) {
  let best = -Infinity;
  for (const p of PLATFORMS) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
      if (p.y > best) best = p.y;
    }
  }
  return best === -Infinity ? 0 : best;
}

export function resolveGround(player) {
  const gy = getGroundHeight(player.x, player.z);
  if (player.y <= gy + 0.4) {
    if (player.vy <= 0.6) {
      player.y = gy;
      player.vy = 0;
      player.grounded = true;
      player.jumping = false;
      player.avx = 0;
      player.avz = 0;
    }
  } else if (player.grounded && player.y - gy > 0.55) {
    player.grounded = false;
  }
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
  PLATFORMS.length = 0;

  const mat = (color, roughness = 0.84, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const stone = mat(0x6a7068, 0.9);
  const dark  = mat(0x4a5048, 0.88);
  const floor = mat(0x5c625a, 0.94);
  const dirt  = mat(0x5a5348, 0.95);
  const wood  = mat(0x6b4a32, 0.85);
  const cloth = mat(0x7a4a3a, 0.9);
  const cloth2 = mat(0x4a5a6a, 0.9);
  const iron  = mat(0x3a3a40, 0.4, 0.55);
  const moss  = mat(0x4a6b42, 0.92);
  const tile  = mat(0x555a52, 0.9);
  const rockMat = mat(0x5a5850, 0.95);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2a4a5a, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.72,
  });

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

  function bigRock(x, y, z, s = 1) {
    cyl(0.9 * s, 1.1 * s, 1.4 * s, rockMat, x, y + 0.7 * s, z, true);
    box(1.6 * s, 1.0 * s, 1.3 * s, dark, x + 0.3 * s, y + 0.5 * s, z - 0.2 * s, true);
    cyl(0.5 * s, 0.6 * s, 0.9 * s, moss, x - 0.4 * s, y + 0.45 * s, z + 0.3 * s, true);
  }

  /** Plataforma de terreno natural (no grada formal) */
  function groundPad(w, d, surfaceY, x, z, material = dirt) {
    const th = Math.max(0.35, surfaceY * 0.35 + 0.3);
    box(w, th, d, material, x, surfaceY - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, surfaceY);
  }

  // =====================================================================
  // 1. RÍO — llegada del veterano
  // =====================================================================
  const river = new THREE.Mesh(new THREE.PlaneGeometry(44, 28), waterMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(1, -0.12, 106);
  scene.add(river);
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 40), waterMat);
  stream.rotation.x = -Math.PI / 2;
  stream.position.set(10, -0.08, 82);
  scene.add(stream);

  groundPad(16, 12, 0.0, 0, 110, dirt);
  groundPad(14, 8, 0.0, 0, 100, dirt);
  bigRock(-7, 0, 108, 1.4);
  bigRock(7.5, 0, 105, 1.3);
  bigRock(-8, 0, 98, 1.1);
  bigRock(8, 0, 99, 1.2);
  cyl(0.2, 0.25, 0.8, moss, -3, 0.3, 107);
  cyl(0.18, 0.22, 0.7, moss, 4, 0.25, 102);

  // =====================================================================
  // 2. SENDERO DEL VETERANO — paisaje, no gradas de castillo
  //    Ledge naturales de roca y tierra que suben hacia el pueblo
  // =====================================================================
  const path = [
    // z, y, w  — tramos irregulares, un poco desplazados
    [94, 0.25, 11, -0.4],
    [90, 0.55, 10, 0.3],
    [86, 0.9, 10, -0.2],
    [82, 1.25, 9.5, 0.5],
    [78, 1.55, 9, -0.3],
    [74, 1.85, 9, 0.2],
    [70, 2.15, 9.5, -0.15],
    [66, 2.4, 10, 0.25],
    [62, CASTLE_Y, 11, 0],
    [57, CASTLE_Y, 12, 0],
  ];
  for (const [z, y, w, ox] of path) {
    groundPad(w, 4.5, y, ox, z, y < 1.5 ? dirt : stone);
  }
  // Rocas enormes flanqueando (entrada secreta / conocida)
  bigRock(-6.8, 0.2, 92, 1.35);
  bigRock(7.0, 0.15, 88, 1.4);
  bigRock(-7.2, 0.4, 80, 1.5);
  bigRock(7.4, 0.55, 76, 1.3);
  bigRock(-7.0, 0.85, 70, 1.4);
  bigRock(7.2, 1.0, 66, 1.25);
  bigRock(-7.5, 1.2, 60, 1.2);
  bigRock(7.6, 1.3, 58, 1.15);

  // =====================================================================
  // 3. ENTRADA LATERAL (reja discreta del veterano)
  // =====================================================================
  groundPad(12, 8, CASTLE_Y, 0, 50, stone);
  box(1.2, 4.5, 7, dark, -5.5, CASTLE_Y + 2.1, 50, true);
  box(1.2, 4.5, 7, dark,  5.5, CASTLE_Y + 2.1, 50, true);
  box(12, 1.0, 1.2, dark, 0, CASTLE_Y + 4.6, 53);
  // Reja semiabierta (paso central libre)
  const gate = box(2.8, 4.2, 0.35, iron, -3.8, CASTLE_Y + 2.0, 53.2, true);
  gate.name = 'mainGate';
  box(2.8, 4.2, 0.35, iron, 3.8, CASTLE_Y + 2.0, 53.2, true);

  // =====================================================================
  // 4. PLAZA — feria del día interrumpida (sin heridos)
  // =====================================================================
  groundPad(38, 50, CASTLE_Y, 0, 18, dirt);

  // Fuente / pozo central
  cyl(2.2, 2.3, 0.4, stone, 0, CASTLE_Y + 0.1, 18, true);
  cyl(1.4, 1.5, 0.6, dark, 0, CASTLE_Y + 0.45, 18, true);
  cyl(0.28, 0.32, 1.0, stone, 0, CASTLE_Y + 1.05, 18, true);

  // --- Puestos de feria (abandonados, objetos caídos, sin cuerpos) ---
  function stall(x, z, w, d, clothMat) {
    // mostrador
    box(w, 0.9, d, wood, x, CASTLE_Y + 0.45, z, true);
    // postes
    box(0.12, 2.2, 0.12, wood, x - w / 2 + 0.15, CASTLE_Y + 1.5, z - d / 2 + 0.15);
    box(0.12, 2.2, 0.12, wood, x + w / 2 - 0.15, CASTLE_Y + 1.5, z - d / 2 + 0.15);
    box(0.12, 2.2, 0.12, wood, x - w / 2 + 0.15, CASTLE_Y + 1.5, z + d / 2 - 0.15);
    box(0.12, 2.2, 0.12, wood, x + w / 2 - 0.15, CASTLE_Y + 1.5, z + d / 2 - 0.15);
    // toldo
    box(w + 0.3, 0.08, d + 0.3, clothMat, x, CASTLE_Y + 2.35, z);
  }
  stall(-8, 30, 3.2, 2.0, cloth);
  stall(9, 28, 3.0, 2.2, cloth2);
  stall(-10, 8, 2.8, 1.8, cloth2);
  stall(10, 10, 3.4, 2.0, cloth);
  stall(0, 34, 3.5, 2.0, cloth);

  // Cajas, cestas volcadas, mercancía abandonada
  box(0.7, 0.55, 0.7, wood, -6, CASTLE_Y + 0.28, 28);
  box(0.6, 0.45, 0.6, wood, -5.2, CASTLE_Y + 0.22, 27.5);
  box(1.1, 0.25, 0.5, cloth, 7.5, CASTLE_Y + 0.12, 26);
  box(0.5, 0.4, 0.5, wood, 8.2, CASTLE_Y + 0.2, 9);
  box(0.8, 0.2, 0.6, cloth2, -9, CASTLE_Y + 0.1, 7);
  box(0.9, 0.35, 0.5, wood, 1, CASTLE_Y + 0.18, 32);
  // Banderines caídos (listones)
  box(0.08, 1.8, 0.08, wood, -4, CASTLE_Y + 0.9, 22);
  box(0.9, 0.06, 0.35, cloth, -4, CASTLE_Y + 1.7, 22);
  box(0.08, 1.5, 0.08, wood, 5, CASTLE_Y + 0.75, 20);
  box(0.7, 0.06, 0.3, cloth2, 5, CASTLE_Y + 1.4, 20);

  // Hierbas / detalles
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
    group.position.set(x, CASTLE_Y, z);
    group.userData = { type: 'herb', heal: 8, collected: false };
    scene.add(group);
    herbs.push(group);
  }
  [[-12, 22], [12, 24], [-3, 12], [4, 6], [-14, 14], [14, 16], [2, 40], [-6, 4]].forEach(([x, z]) => createHerb(x, z));

  // =====================================================================
  // 5. PUESTO / CASA DEL SABIO (oeste de la plaza) — página de historia
  // =====================================================================
  groundPad(12, 16, CASTLE_Y, -15, 18, wood);
  // Estructura sencilla abierta a la plaza
  box(0.9, 3.8, 14, dark, -20.5, CASTLE_Y + 1.8, 18, true); // fondo
  box(10, 3.8, 0.9, dark, -15, CASTLE_Y + 1.8, 25.5, true);
  box(10, 3.8, 0.9, dark, -15, CASTLE_Y + 1.8, 10.5, true);
  box(12, 0.3, 16, dark, -15, CASTLE_Y + 3.9, 18); // techo
  // Mesa del sabio + libros / rollo
  box(2.8, 0.7, 1.2, wood, -14, CASTLE_Y + 0.35, 18, true);
  box(0.35, 0.15, 0.28, mat(0x6a4030), -13.5, CASTLE_Y + 0.8, 17.6);
  box(0.3, 0.12, 0.25, mat(0x3a4a5a), -14.3, CASTLE_Y + 0.78, 18.3);
  // Estante
  box(0.4, 2.2, 3.5, wood, -19.5, CASTLE_Y + 1.2, 20);

  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  pageMesh.rotation.x = -Math.PI / 2 + 0.1;
  pageMesh.userData = { type: 'storyPage', read: false };

  // =====================================================================
  // 6. MERCADO ESTE (puestos / casas del pueblo)
  // =====================================================================
  groundPad(14, 22, CASTLE_Y, 18, 18, floor);
  box(1.0, 3.5, 18, dark, 24.5, CASTLE_Y + 1.6, 18, true);
  box(12, 3.5, 1.0, dark, 18, CASTLE_Y + 1.6, 28, true);
  box(12, 3.5, 1.0, dark, 18, CASTLE_Y + 1.6, 8, true);
  box(14, 0.3, 22, dark, 18, CASTLE_Y + 3.6, 18);
  stall(16, 20, 2.6, 1.6, cloth);
  box(1.2, 0.5, 0.8, wood, 20, CASTLE_Y + 0.25, 14);

  // =====================================================================
  // 7. PUENTE hacia el ala noble (cierre narrativo / cinemática)
  // =====================================================================
  // Foso visual (agua baja)
  const moat = new THREE.Mesh(new THREE.PlaneGeometry(28, 14), waterMat);
  moat.rotation.x = -Math.PI / 2;
  moat.position.set(0, CASTLE_Y - 1.8, -16);
  scene.add(moat);

  // Tablero del puente
  groundPad(5.5, 18, CASTLE_Y, 0, -16, wood);
  // Barandillas
  box(0.2, 1.1, 18, iron, -2.9, CASTLE_Y + 0.55, -16);
  box(0.2, 1.1, 18, iron,  2.9, CASTLE_Y + 0.55, -16);
  // Pilares del puente
  cyl(0.35, 0.4, 2.2, stone, -2.2, CASTLE_Y - 0.9, -10, true);
  cyl(0.35, 0.4, 2.2, stone,  2.2, CASTLE_Y - 0.9, -10, true);
  cyl(0.35, 0.4, 2.2, stone, -2.2, CASTLE_Y - 0.9, -22, true);
  cyl(0.35, 0.4, 2.2, stone,  2.2, CASTLE_Y - 0.9, -22, true);

  // =====================================================================
  // 8. ALA DE LA NOBLEZA — confrontación con el villano
  // =====================================================================
  groundPad(30, 26, CASTLE_Y, 0, -40, tile);
  box(1.3, 6.5, 26, dark, -14.5, CASTLE_Y + 3.0, -40, true);
  box(1.3, 6.5, 26, dark,  14.5, CASTLE_Y + 3.0, -40, true);
  // Entrada desde el puente (hueco norte)
  box(5, 6.5, 1.2, dark, -9, CASTLE_Y + 3.0, -27.5, true);
  box(5, 6.5, 1.2, dark,  9, CASTLE_Y + 3.0, -27.5, true);
  // Fondo sur sellado / trono saqueado
  box(30, 6.5, 1.3, dark, 0, CASTLE_Y + 3.0, -52.5, true);
  box(4, 1.4, 1.0, iron, 0, CASTLE_Y + 5.8, -52.2);
  box(30, 0.35, 26, dark, 0, CASTLE_Y + 6.5, -40); // techo
  // Columnas nobles
  cyl(0.48, 0.52, 6.0, stone, -7, CASTLE_Y + 2.8, -36, true);
  cyl(0.48, 0.52, 6.0, stone,  7, CASTLE_Y + 2.8, -36, true);
  cyl(0.42, 0.48, 5.5, stone, -7, CASTLE_Y + 2.5, -46, true);
  cyl(0.42, 0.48, 5.5, stone,  7, CASTLE_Y + 2.5, -46, true);
  // Restos de mobiliario noble volcado (saqueo)
  box(2.5, 0.8, 1.2, wood, -3, CASTLE_Y + 0.4, -42);
  box(1.8, 0.5, 0.9, wood, 4, CASTLE_Y + 0.25, -38);
  box(1.2, 0.35, 0.7, iron, 0, CASTLE_Y + 0.18, -48);

  // Suelo lejano
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 240),
    mat(0x141814, 1)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.6, 25);
  ground.receiveShadow = true;
  scene.add(ground);

  return { gate, herbs, pageMesh, pagePos: PAGE_POS.clone() };
}

export function distanceToPage(x, y, z) {
  return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z);
}
