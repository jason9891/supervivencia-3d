// map1.js — El Regreso (estructura del croquis)
// Rampa natural -> piedra/paredes -> reja -> giro derecha -> plaza
// Establos (comida + 1ra criatura) | pileta | edificio 2 pisos
// 2F: oficina consejero (página + llave torre1)
// Torres sin entrada PB; 2F conectado; puente roto; palanca torre2 -> reja grande + cinemática

import * as THREE from 'three';

export const MAP1_NAME = 'El Regreso';
export const GROUND_Y = 0;
export const PLAZA_Y = 2.4;
export const FLOOR2_Y = 5.6;

export const ZONES = {
  path:     { minX: -8,  maxX: 8,  minZ: 48, maxZ: 100 },
  corridor: { minX: -5,  maxX: 5,  minZ: 32, maxZ: 50 },
  plaza:    { minX: -22, maxX: 22, minZ: -6, maxZ: 34 },
  stable_a: { minX: -20, maxX: -10, minZ: 22, maxZ: 32 },
  stable_b: { minX: -20, maxX: -10, minZ: 10, maxZ: 20 },
  hall:     { minX: 6,   maxX: 20, minZ: 4,  maxZ: 28 },
  office:   { minX: 6,   maxX: 20, minZ: 4,  maxZ: 28 }, // 2F mismo XZ
  tower1:   { minX: 14,  maxX: 22, minZ: -8, maxZ: 2 },
  tower2:   { minX: 14,  maxX: 22, minZ: -20, maxZ: -10 },
};

export function getCurrentZone(x, z) {
  for (const [name, b] of Object.entries(ZONES)) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name;
  }
  return null;
}

export const STORY_PAGE = {
  title: 'Oficina del consejero',
  text: `...los sellos se debilitan.\nLo que creíamos leyenda ha vuelto a caminar.\nSi lees esto, ya es demasiado tarde para huir.\nBusca las seis runas. Solo ellas pueden volver a dormir al que no debe despertar.\n\n(Hay una llave oxidada junto a los papeles.)`,
};

const PAGE_POS = new THREE.Vector3(12, FLOOR2_Y + 0.95, 16);
const KEY_POS = new THREE.Vector3(13.2, FLOOR2_Y + 0.9, 15.2);
const LEVER_POS = new THREE.Vector3(18, FLOOR2_Y + 1.2, -15);
const FOOD_POS = new THREE.Vector3(-15, PLAZA_Y + 0.5, 26);

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
  if (player.y <= gy + 0.45) {
    if (player.vy <= 0.65) {
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

export function distanceToPage(x, y, z) {
  return Math.hypot(x - PAGE_POS.x, y - PAGE_POS.y, z - PAGE_POS.z);
}
export function distanceToKey(x, y, z) {
  return Math.hypot(x - KEY_POS.x, y - KEY_POS.y, z - KEY_POS.z);
}
export function distanceToLever(x, y, z) {
  return Math.hypot(x - LEVER_POS.x, y - LEVER_POS.y, z - LEVER_POS.z);
}
export function distanceToFood(x, y, z) {
  return Math.hypot(x - FOOD_POS.x, y - FOOD_POS.y, z - FOOD_POS.z);
}

export function buildMap1(scene) {
  WALLS.length = 0;
  PLATFORMS.length = 0;

  const mat = (color, roughness = 0.84, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const stone = mat(0x6a7068, 0.9);
  const dark  = mat(0x4a5048, 0.88);
  const dirt  = mat(0x5a5348, 0.95);
  const grass = mat(0x3d5c38, 1);
  const wood  = mat(0x6b4a32, 0.85);
  const iron  = mat(0x3a3a40, 0.4, 0.55);
  const moss  = mat(0x4a6b42, 0.92);
  const tile  = mat(0x555a52, 0.9);
  const cloth = mat(0x7a4a3a, 0.9);

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
  function pad(w, d, y, x, z, material) {
    const th = Math.max(0.35, 0.25 + y * 0.25);
    box(w, th, d, material, x, y - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y);
  }

  // ========== 1. RAMPA NATURAL (pasto, zigzag) ==========
  // Tramos irregulares que suben y se desplazan (no gradas formales)
  const ramp = [
    [92, 0.15, 9, 1.2],
    [88, 0.4, 8.5, -0.8],
    [84, 0.7, 8, 1.0],
    [80, 1.0, 8, -0.6],
    [76, 1.3, 7.5, 0.9],
    [72, 1.6, 7.5, -0.4],
    [68, 1.9, 8, 0.5],
    [64, 2.15, 8.5, -0.2],
    [60, PLAZA_Y, 9, 0],
    [55, PLAZA_Y, 9, 0],
  ];
  for (const [z, y, w, ox] of ramp) {
    pad(w, 4.6, y, ox, z, y < 1.8 ? grass : dirt);
  }
  // Naturaleza a los lados
  for (const [x, z, s] of [[-5.5, 90, 1.1], [5.2, 86, 1.2], [-5.8, 78, 1.3], [5.5, 74, 1.15], [-5.2, 66, 1.2], [5.8, 62, 1.1]]) {
    cyl(0.7 * s, 0.9 * s, 1.2 * s, mat(0x5a5850), x, (z > 75 ? 0.3 : 1.0) + 0.5 * s, z, true);
    cyl(0.35 * s, 0.4 * s, 0.7 * s, moss, x - 0.3, (z > 75 ? 0.2 : 0.9) + 0.3 * s, z + 0.2, true);
  }

  // ========== 2. PIEDRA + PAREDES + PASADIZO + REJA ==========
  pad(8, 14, PLAZA_Y, 0, 42, stone);
  box(1.1, 4.2, 14, dark, -3.8, PLAZA_Y + 2.0, 42, true);
  box(1.1, 4.2, 14, dark,  3.8, PLAZA_Y + 2.0, 42, true);
  box(8, 0.9, 1.0, dark, 0, PLAZA_Y + 4.3, 48);

  // Reja que cae (inicialmente abierta al centro; se puede cerrar después)
  const gateLeft = box(2.4, 4.0, 0.35, iron, -2.2, PLAZA_Y + 1.9, 48.5, true);
  const gateRight = box(2.4, 4.0, 0.35, iron, 2.2, PLAZA_Y + 1.9, 48.5, true);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  // Salida del pasadizo hacia la plaza (giro derecha = hacia -X / establos)
  pad(10, 6, PLAZA_Y, -4, 34, stone);

  // ========== 3. PLAZA ==========
  pad(40, 40, PLAZA_Y, 0, 14, dirt);

  // Pileta centro
  cyl(2.3, 2.4, 0.4, stone, 0, PLAZA_Y + 0.1, 14, true);
  cyl(1.5, 1.55, 0.55, dark, 0, PLAZA_Y + 0.45, 14, true);
  cyl(0.3, 0.35, 1.0, stone, 0, PLAZA_Y + 1.05, 14, true);

  // Puestos feria (rombos del croquis)
  function stall(x, z) {
    box(2.8, 0.85, 1.6, wood, x, PLAZA_Y + 0.42, z, true);
    box(0.1, 2.0, 0.1, wood, x - 1.2, PLAZA_Y + 1.4, z - 0.6);
    box(0.1, 2.0, 0.1, wood, x + 1.2, PLAZA_Y + 1.4, z - 0.6);
    box(0.1, 2.0, 0.1, wood, x - 1.2, PLAZA_Y + 1.4, z + 0.6);
    box(0.1, 2.0, 0.1, wood, x + 1.2, PLAZA_Y + 1.4, z + 0.6);
    box(3.0, 0.08, 1.9, cloth, x, PLAZA_Y + 2.2, z);
  }
  stall(-6, 22);
  stall(5, 20);
  stall(-4, 6);
  stall(6, 8);
  box(0.7, 0.45, 0.6, wood, -5, PLAZA_Y + 0.22, 20);
  box(0.9, 0.2, 0.5, cloth, 4, PLAZA_Y + 0.1, 18);

  // ========== 4. ESTABLOS (entrar, comida, 1ra criatura) ==========
  function stable(cx, cz) {
    pad(8, 8, PLAZA_Y, cx, cz, wood);
    box(0.7, 3.2, 8, dark, cx - 3.6, PLAZA_Y + 1.5, cz, true);
    box(0.7, 3.2, 8, dark, cx + 3.6, PLAZA_Y + 1.5, cz, true);
    box(8, 3.2, 0.7, dark, cx, PLAZA_Y + 1.5, cz + 3.6, true);
    // frente abierto a la plaza
    box(8, 0.3, 8, dark, cx, PLAZA_Y + 3.3, cz);
    // pesebre
    box(2.5, 0.6, 1.0, wood, cx, PLAZA_Y + 0.3, cz + 1.5, true);
  }
  stable(-15, 27);
  stable(-15, 15);

  // Comida en establo A
  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);
  foodMesh.userData = { type: 'food', heal: 15, collected: false };

  // Primera criatura (placeholder débil) en establo A
  const creature = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat(0x4a3028, 0.7));
  body.scale.set(1, 0.75, 1.2);
  body.position.y = 0.4;
  body.castShadow = true;
  creature.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(0x5a3830));
  head.position.set(0, 0.65, 0.35);
  creature.add(head);
  creature.position.set(-14.5, PLAZA_Y, 25);
  creature.userData = { type: 'creature', hp: 20, maxHp: 20, weak: true, alive: true };
  scene.add(creature);

  // ========== 5. EDIFICIO 2 PISOS (este de la plaza) ==========
  pad(12, 22, PLAZA_Y, 12, 16, tile);
  // Muros PB
  box(1.0, 3.0, 22, dark, 6.5, PLAZA_Y + 1.4, 16, true);
  box(1.0, 3.0, 22, dark, 17.5, PLAZA_Y + 1.4, 16, true);
  box(12, 3.0, 1.0, dark, 12, PLAZA_Y + 1.4, 26.5, true);
  box(12, 3.0, 1.0, dark, 12, PLAZA_Y + 1.4, 5.5, true);
  // Hueco entrada oeste (desde plaza)
  // (sin muro en x=6.5 z~16 centro — dejamos apertura ~3m)
  // Forzar hueco: no solid en tramo central ya omitido; abrir quitando parte
  // Apertura: no hay muro extra

  // Piso intermedio / techo PB = suelo 2F
  box(12, 0.35, 22, wood, 12, FLOOR2_Y - 0.15, 16);
  addPlatform(6, 18, 5, 27, FLOOR2_Y);

  // Escaleras interiores (peldaños sólidos + plataformas)
  for (let i = 0; i < 8; i++) {
    const h = PLAZA_Y + (i + 1) * ((FLOOR2_Y - PLAZA_Y) / 8);
    const z = 8 + i * 0.85;
    box(2.2, 0.4, 0.85, stone, 8.5, h - 0.15, z, true);
    addPlatform(7.4, 9.6, z - 0.42, z + 0.42, h);
  }

  // Muros 2F
  box(1.0, 3.0, 22, dark, 6.5, FLOOR2_Y + 1.4, 16, true);
  box(1.0, 3.0, 22, dark, 17.5, FLOOR2_Y + 1.4, 16, true);
  box(12, 3.0, 1.0, dark, 12, FLOOR2_Y + 1.4, 26.5, true);
  box(12, 3.0, 1.0, dark, 12, FLOOR2_Y + 1.4, 5.5, true);
  box(12, 0.3, 22, dark, 12, FLOOR2_Y + 3.0, 16);

  // Oficina del consejero (mesas rotas)
  const desk1 = box(2.8, 0.7, 1.2, wood, 12, FLOOR2_Y + 0.35, 18);
  desk1.rotation.z = 0.35;
  box(1.5, 0.4, 0.9, wood, 14, FLOOR2_Y + 0.2, 12);
  box(0.4, 0.15, 0.3, mat(0x6a4030), 11.5, FLOOR2_Y + 0.55, 17.5);

  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  pageMesh.rotation.x = -Math.PI / 2 + 0.1;
  pageMesh.userData = { type: 'storyPage', read: false };

  // Llave para puerta torre 1
  const keyMesh = box(0.35, 0.08, 0.12, mat(0xc9a227, 0.4, 0.6), KEY_POS.x, KEY_POS.y, KEY_POS.z);
  keyMesh.userData = { type: 'key', collected: false };

  // ========== 6. TORRES (sin entrada PB; interior solo 2F) ==========
  function tower(cx, cz, name) {
    // Exterior sólido PB (sin puerta)
    pad(7, 7, PLAZA_Y, cx, cz, stone);
    box(7, 5.5, 0.9, dark, cx, PLAZA_Y + 2.5, cz + 3.2, true);
    box(7, 5.5, 0.9, dark, cx, PLAZA_Y + 2.5, cz - 3.2, true);
    box(0.9, 5.5, 7, dark, cx + 3.2, PLAZA_Y + 2.5, cz, true);
    box(0.9, 5.5, 7, dark, cx - 3.2, PLAZA_Y + 2.5, cz, true);
    // Suelo 2F
    box(7, 0.3, 7, stone, cx, FLOOR2_Y - 0.1, cz);
    addPlatform(cx - 3.2, cx + 3.2, cz - 3.2, cz + 3.2, FLOOR2_Y);
    // Techo
    box(7.5, 0.35, 7.5, dark, cx, FLOOR2_Y + 3.2, cz);
    return { cx, cz, name };
  }
  tower(18, -3, 'tower1');
  tower(18, -15, 'tower2');

  // Pasarela 2F del edificio a torre1 (puerta con llave)
  box(4, 0.3, 2.2, wood, 16, FLOOR2_Y - 0.1, 4);
  addPlatform(14, 18, 3, 5.5, FLOOR2_Y);
  // Puerta torre1 (sólida hasta tener llave)
  const towerDoor = box(1.6, 2.4, 0.35, wood, 18, FLOOR2_Y + 1.1, 0.6, true);
  towerDoor.name = 'tower1Door';
  towerDoor.userData = { locked: true };

  // Puente pequeño roto entre torres (2F)
  box(1.8, 0.25, 2.5, wood, 18, FLOOR2_Y - 0.05, -8);
  addPlatform(17, 19, -9.2, -6.5, FLOOR2_Y);
  // Tramo roto (hueco visual, sin plataforma)
  box(1.2, 0.2, 1.0, wood, 17.5, FLOOR2_Y - 0.8, -9.5); // tabla caída

  // Pasarela rota -> torre2 (salto corto o borde)
  box(1.8, 0.25, 2.0, wood, 18, FLOOR2_Y - 0.05, -11.5);
  addPlatform(17, 19, -12.5, -10.5, FLOOR2_Y);

  // Palanca en torre2
  const leverBase = box(0.3, 1.0, 0.3, iron, LEVER_POS.x, FLOOR2_Y + 0.5, LEVER_POS.z, true);
  const leverArm = box(0.12, 0.12, 0.9, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z - 0.2);
  leverArm.name = 'leverArm';
  leverArm.userData = { type: 'lever', pulled: false };

  // ========== 7. REJA GRANDE DE CASTILLO (visual; cinemática aparte) ==========
  // Al sur de la plaza, solo escenografía — nada jugable detrás
  const bigGateY = PLAZA_Y;
  box(14, 6.5, 1.2, dark, 0, bigGateY + 3.0, -8, true);
  const portcullis = box(10, 5.5, 0.4, iron, 0, bigGateY + 2.6, -7.5, true);
  portcullis.name = 'portcullis';
  for (let i = -4; i <= 4; i += 1.1) {
    box(0.12, 5.2, 0.12, iron, i, bigGateY + 2.5, -7.45);
  }
  box(3, 1.2, 0.8, iron, 0, bigGateY + 5.8, -7.3);

  // Hierbas plaza
  const herbs = [];
  function createHerb(x, z) {
    const g = new THREE.Group();
    const leafMat = mat(0x5a9a48, 0.85);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.14 + Math.random() * 0.04, 0.25 + Math.random() * 0.08, 5),
        leafMat
      );
      leaf.position.set((Math.random() - 0.5) * 0.18, 0.12, (Math.random() - 0.5) * 0.18);
      g.add(leaf);
    }
    g.position.set(x, PLAZA_Y, z);
    g.userData = { type: 'herb', heal: 8, collected: false };
    scene.add(g);
    herbs.push(g);
  }
  [[-8, 12], [8, 16], [-2, 24], [3, 4], [-10, 8], [10, 22]].forEach(([x, z]) => createHerb(x, z));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 200), mat(0x141814, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.5, 30);
  ground.receiveShadow = true;
  scene.add(ground);

  return {
    gate,
    gateLeft,
    gateRight,
    portcullis,
    herbs,
    pageMesh,
    keyMesh,
    foodMesh,
    creature,
    towerDoor,
    leverArm,
    pagePos: PAGE_POS.clone(),
    keyPos: KEY_POS.clone(),
    leverPos: LEVER_POS.clone(),
  };
}

/** Cierra la reja del pasadizo (tras pasar). */
export function closePassageGate(mapData) {
  if (!mapData?.gate || mapData.gate.userData.closed) return;
  mapData.gate.userData.closed = true;
  // Rellenar centro con colisión
  addWall(-1.2, 1.2, 48.2, 48.8);
  if (mapData.gateLeft) mapData.gateLeft.position.x = -1.0;
  if (mapData.gateRight) mapData.gateRight.position.x = 1.0;
}

/** Abre puerta torre1 si hay llave. */
export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  // Quitar colisión aproximada de la puerta
  const d = mapData.towerDoor;
  // No rehacemos WALLS; empujamos la puerta fuera
  d.position.y = -10;
  return true;
}
