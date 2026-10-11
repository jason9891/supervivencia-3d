// map1.js — Mapa 1: El Regreso
// Inicio con desnivel: río bajo → camino de piedras enormes → reja → patio elevado.
// Sistema de plataformas (alturas) para no ser un mundo plano.

import * as THREE from 'three';

export const MAP1_NAME = 'El Regreso';

/** Nivel del patio / interior del castillo */
export const CASTLE_Y = 2.6;

export const ZONES = {
  river:     { minX: -14, maxX: 14, minZ: 88,  maxZ: 115 },
  approach:  { minX: -10, maxX: 10, minZ: 55,  maxZ: 90 },
  gate:      { minX: -9,  maxX: 9,  minZ: 42,  maxZ: 58 },
  courtyard: { minX: -18, maxX: 18, minZ: -16, maxZ: 42 },
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

const PAGE_POS = new THREE.Vector3(-28, CASTLE_Y + 0.95, -4);

const PLAYER_R = 0.4;
export const WALLS = [];
/** Plataformas caminables: { minX, maxX, minZ, maxZ, y } */
export const PLATFORMS = [];

function addWall(minX, maxX, minZ, maxZ) {
  WALLS.push({ minX, maxX, minZ, maxZ });
}

function addPlatform(minX, maxX, minZ, maxZ, y) {
  PLATFORMS.push({ minX, maxX, minZ, maxZ, y });
}

/** Altura del suelo bajo (x,z). 0 si no hay plataforma. */
export function getGroundHeight(x, z) {
  let best = -Infinity;
  for (const p of PLATFORMS) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
      if (p.y > best) best = p.y;
    }
  }
  return best === -Infinity ? 0 : best;
}

/**
 * Ajusta player.y al suelo más alto bajo los pies.
 * Respeta saltos (solo aterriza si está cayendo cerca del suelo).
 */
export function resolveGround(player) {
  const gy = getGroundHeight(player.x, player.z);
  const feet = player.y;
  // Si está por encima del suelo y cayendo (o casi en el suelo), aterriza
  if (feet <= gy + 0.35) {
    if (player.vy <= 0.5) {
      player.y = gy;
      player.vy = 0;
      player.grounded = true;
      player.jumping = false;
      player.avx = 0;
      player.avz = 0;
    }
  } else if (player.grounded && Math.abs(feet - gy) > 0.5) {
    // Se fue del borde de una plataforma
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
  const iron  = mat(0x3a3a40, 0.4, 0.55);
  const moss  = mat(0x4a6b42, 0.92);
  const tile  = mat(0x555a52, 0.9);
  const stepMat = mat(0x5a6058, 0.88);
  const rockMat = mat(0x5a5850, 0.95);
  const water = mat(0x2a4a5a, 0.3, 0.15);
  water.transparent = true;
  water.opacity = 0.75;

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

  /** Roca grande irregular (varias cajas/cilindros apilados) */
  function bigRock(x, y, z, scale = 1) {
    const s = scale;
    cyl(0.9 * s, 1.1 * s, 1.4 * s, rockMat, x, y + 0.7 * s, z, true);
    box(1.6 * s, 1.0 * s, 1.3 * s, dark, x + 0.3 * s, y + 0.5 * s, z - 0.2 * s, true);
    cyl(0.5 * s, 0.6 * s, 0.9 * s, moss, x - 0.4 * s, y + 0.45 * s, z + 0.3 * s, true);
  }

  /** Peldaño caminable (visual + plataforma + colisión de borde) */
  function stepPad(w, d, surfaceY, x, z, thickness = 0.45) {
    box(w, thickness, d, stepMat, x, surfaceY - thickness / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, surfaceY);
    // Bordillos laterales para no caer tan fácil
    addWall(x - w / 2 - 0.15, x - w / 2, z - d / 2, z + d / 2);
    addWall(x + w / 2, x + w / 2 + 0.15, z - d / 2, z + d / 2);
  }

  function floorPad(w, d, surfaceY, x, z, material = floor) {
    const th = 0.4;
    box(w, th, d, material, x, surfaceY - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, surfaceY);
  }

  // =====================================================================
  // 0. RÍO / LAGO BAJO (inicio)
  // =====================================================================
  // Agua (no caminable)
  const riverMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 28), water);
  riverMesh.rotation.x = -Math.PI / 2;
  riverMesh.position.set(0, -0.15, 102);
  scene.add(riverMesh);
  // Orilla caminable baja
  floorPad(16, 12, 0.0, 0, 108, dirt);
  floorPad(14, 8, 0.0, 0, 98, dirt);
  // Piedras enormes a los lados del río
  bigRock(-7, 0, 106, 1.4);
  bigRock(7.5, 0, 104, 1.3);
  bigRock(-8, 0, 96, 1.1);
  bigRock(8, 0, 97, 1.2);
  bigRock(-6, 0, 112, 1.0);
  bigRock(6.5, 0, 110, 0.95);
  // Vegetación / musgo en orilla
  cyl(0.2, 0.25, 0.8, moss, -3, 0.3, 105);
  cyl(0.18, 0.22, 0.7, moss, 4, 0.25, 100);

  // =====================================================================
  // 1. CAMINO ASCENDENTE con piedras enormes (desnivel)
  //    Sube de y=0 → CASTLE_Y por tramos
  // =====================================================================
  const climbSteps = [
    // [z center, surfaceY, width]
    [92, 0.35, 10],
    [88, 0.7, 9.5],
    [84, 1.05, 9],
    [80, 1.4, 9],
    [76, 1.75, 8.5],
    [72, 2.1, 8.5],
    [68, 2.35, 9],
    [64, 2.5, 10],
    [60, CASTLE_Y, 11],
  ];
  for (const [z, y, w] of climbSteps) {
    stepPad(w, 4.2, y, 0, z, 0.5);
  }
  // Piedras enormes flanqueando el camino
  bigRock(-6.5, 0.3, 90, 1.3);
  bigRock(6.8, 0.2, 86, 1.4);
  bigRock(-7, 0.5, 78, 1.5);
  bigRock(7.2, 0.6, 74, 1.35);
  bigRock(-6.8, 0.8, 68, 1.4);
  bigRock(7, 1.0, 65, 1.3);
  bigRock(-7.5, 1.2, 58, 1.2);
  bigRock(7.5, 1.3, 56, 1.25);

  // =====================================================================
  // 2. REJA (nivel del castillo) — se cierra detrás
  // =====================================================================
  floorPad(14, 10, CASTLE_Y, 0, 50, floor);
  // Muros del pórtico
  box(1.5, 5.5, 10, dark, -6.5, CASTLE_Y + 2.5, 50, true);
  box(1.5, 5.5, 10, dark,  6.5, CASTLE_Y + 2.5, 50, true);
  box(14, 1.2, 1.4, dark, 0, CASTLE_Y + 5.2, 54);
  // Hojas de reja: centro ABIERTO al pasar; tras pasar, muro sólido detrás del spawn del patio
  // Para 