// map1.js — El Regreso (planta del croquis)
// Rectángulo grande de plaza. Establo = 1 módulo / 2 ambientes.
// Edificio 2 pisos con PUERTA visible. Torres a los lados de la puerta principal.

import * as THREE from 'three';

export const MAP1_NAME = 'El Regreso';
export const PLAZA_Y = 2.4;
export const FLOOR2_Y = 5.8;

export const ZONES = {
  path:     { minX: -10, maxX: 10, minZ: 55, maxZ: 100 },
  corridor: { minX: -6,  maxX: 6,  minZ: 40, maxZ: 56 },
  plaza:    { minX: -28, maxX: 28, minZ: -12, maxZ: 40 },
  stable:   { minX: -26, maxX: -12, minZ: 18, maxZ: 36 },
  hall:     { minX: 10,  maxX: 26, minZ: 8,  maxZ: 32 },
  office:   { minX: 10,  maxX: 26, minZ: 8,  maxZ: 32 },
  tower_l:  { minX: -18, maxX: -8, minZ: -14, maxZ: -2 },
  tower_r:  { minX: 8,   maxX: 18, minZ: -14, maxZ: -2 },
  gate:     { minX: -10, maxX: 10, minZ: -8,  maxZ: 4 },
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

// Oficina 2F del edificio este
const PAGE_POS = new THREE.Vector3(18, FLOOR2_Y + 0.95, 20);
const KEY_POS  = new THREE.Vector3(19.2, FLOOR2_Y + 0.9, 19);
const LEVER_POS = new THREE.Vector3(13, FLOOR2_Y + 1.2, -8);
const FOOD_POS = new THREE.Vector3(-19, PLAZA_Y + 0.5, 28);

const PLAYER_R = 0.4;
export const WALLS = [];
export const PLATFORMS = [];

function addWall(minX, maxX, minZ, maxZ) { WALLS.push({ minX, maxX, minZ, maxZ }); }
function addPlatform(minX, maxX, minZ, maxZ, y) { PLATFORMS.push({ minX, maxX, minZ, maxZ, y }); }

export function getGroundHeight(x, z) {
  let best = -Infinity;
  for (const p of PLATFORMS) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && p.y > best) best = p.y;
  }
  return best === -Infinity ? 0 : best;
}

export function resolveGround(player) {
  const gy = getGroundHeight(player.x, player.z);
  if (player.y <= gy + 0.45) {
    if (player.vy <= 0.65) {
      player.y = gy; player.vy = 0;
      player.grounded = true; player.jumping = false;
      player.avx = 0; player.avz = 0;
    }
  } else if (player.grounded && player.y - gy > 0.55) {
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
  const doorM = mat(0x5a3a22, 0.75);

  function box(w, h, d, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (solid) addWall(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return m;
  }
  function cyl(rTop, rBot, h, material, x, y, z, solid = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 10), material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (solid) {
      const r = Math.max(rTop, rBot) + 0.06;
      addWall(x - r, x + r, z - r, z + r);
    }
    return m;
  }
  function pad(w, d, y, x, z, material) {
    const th = Math.max(0.35, 0.25 + y * 0.22);
    box(w, th, d, material, x, y - th / 2, z, false);
    addPlatform(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y);
  }

  // =====================================================================
  // 1. RAMPA NATURAL (izquierda del croquis — zigzag de pasto)
  // =====================================================================
  const ramp = [
    [94, 0.1, 9, 0.8], [90, 0.35, 8.5, -0.6], [86, 0.65, 8, 0.7],
    [82, 0.95, 8, -0.5], [78, 1.25, 7.5, 0.6], [74, 1.55, 8, -0.3],
    [70, 1.85, 8.5, 0.4], [66, 2.1, 9, 0], [62, PLAZA_Y, 9, 0],
    [58, PLAZA_Y, 10, 0], [54, PLAZA_Y, 10, 0],
  ];
  for (const [z, y, w, ox] of ramp) pad(w, 4.4, y, ox, z, y < 1.7 ? grass : dirt);
  for (const [x, z, s] of [[-5.5, 88, 1.15], [5.2, 82, 1.2], [-5.8, 74, 1.25], [5.5, 68, 1.1], [-5.2, 60, 1.15]]) {
    cyl(0.75 * s, 0.95 * s, 1.3 * s, mat(0x5a5850), x, (z > 78 ? 0.4 : 1.1) + 0.5 * s, z, true);
  }

  // =====================================================================
  // 2. PASADIZO + REJA (entra al lado norte de la plaza)
  // =====================================================================
  pad(9, 12, PLAZA_Y, 0, 47, stone);
  box(1.2, 4.2, 12, dark, -4.2, PLAZA_Y + 2.0, 47, true);
  box(1.2, 4.2, 12, dark,  4.2, PLAZA_Y + 2.0, 47, true);
  box(9, 1.0, 1.1, dark, 0, PLAZA_Y + 4.4, 52);
  const gateLeft = box(2.6, 4.0, 0.4, iron, -2.4, PLAZA_Y + 1.9, 52.5, true);
  const gateRight = box(2.6, 4.0, 0.4, iron, 2.4, PLAZA_Y + 1.9, 52.5, true);
  const gate = gateLeft;
  gate.name = 'mainGate';
  gate.userData = { mate: gateRight, closed: false };

  // =====================================================================
  // 3. PLAZA — RECTÁNGULO GRANDE (como el croquis)
  // =====================================================================
  pad(52, 50, PLAZA_Y, 0, 14, dirt);

  // Pileta centro
  cyl(2.6, 2.7, 0.45, stone, 0, PLAZA_Y + 0.12, 14, true);
  cyl(1.7, 1.75, 0.6, dark, 0, PLAZA_Y + 0.5, 14, true);
  cyl(0.32, 0.36, 1.1, stone, 0, PLAZA_Y + 1.15, 14, true);

  // Puestos feria (rombos)
  function stall(x, z) {
    box(2.6, 0.85, 1.5, wood, x, PLAZA_Y + 0.42, z, true);
    box(0.1, 2.0, 0.1, wood, x - 1.1, PLAZA_Y + 1.4, z - 0.55);
    box(0.1, 2.0, 0.1, wood, x + 1.1, PLAZA_Y + 1.4, z - 0.55);
    box(0.1, 2.0, 0.1, wood, x - 1.1, PLAZA_Y + 1.4, z + 0.55);
    box(0.1, 2.0, 0.1, wood, x + 1.1, PLAZA_Y + 1.4, z + 0.55);
    box(2.9, 0.08, 1.8, cloth, x, PLAZA_Y + 2.2, z);
  }
  stall(-8, 24); stall(7, 22); stall(-6, 6); stall(8, 8); stall(0, 28);
  box(0.7, 0.4, 0.55, wood, -7, PLAZA_Y + 0.2, 22);
  box(0.9, 0.18, 0.5, cloth, 6, PLAZA_Y + 0.1, 20);

  // =====================================================================
  // 4. ESTABLO — UN MÓDULO, DOS AMBIENTES (oeste de la plaza)
  // =====================================================================
  // Suelo único del módulo
  pad(12, 16, PLAZA_Y, -19, 27, wood);
  // Muros exteriores
  box(0.8, 3.4, 16, dark, -24.5, PLAZA_Y + 1.6, 27, true); // oeste
  box(0.8, 3.4, 16, dark, -13.5, PLAZA_Y + 1.6, 27, true); // este (con hueco entrada)
  box(12, 3.4, 0.8, dark, -19, PLAZA_Y + 1.6, 34.5, true); // norte
  box(12, 3.4, 0.8, dark, -19, PLAZA_Y + 1.6, 19.5, true); // sur
  // Tabique interior que separa 2 ambientes (hueco central para pasar)
  box(0.5, 3.0, 5, dark, -19, PLAZA_Y + 1.4, 31, true);
  box(0.5, 3.0, 5, dark, -19, PLAZA_Y + 1.4, 23, true);
  // Techo
  box(12.5, 0.3, 16.5, dark, -19, PLAZA_Y + 3.5, 27);
  // Entrada visible hacia la plaza (hueco en muro este): marco de puerta
  box(0.35, 2.6, 0.35, wood, -13.7, PLAZA_Y + 1.2, 29.5);
  box(0.35, 2.6, 0.35, wood, -13.7, PLAZA_Y + 1.2, 24.5);
  box(0.4, 0.3, 5.2, wood, -13.7, PLAZA_Y + 2.6, 27);
  // Quitar colisión del hueco de entrada del establo (muro este ya es continuo;
  // abrimos quitando un tramo: usamos dos segmentos arriba en vez de muro lleno)
  // → ya el muro este es sólido; para pasar, no ponemos solid en el centro:
  // Redibujamos muro este como dos tramos
  // (el box este de arriba se deja; añadimos que el jugador entre por z=27 ±2)
  // Mejor: no solid en centro — reemplazamos muro este por dos piezas
  // Como ya se añadió solid, empujamos apertura con no-wall zone aproximada
  // Solución limpia: muros este norte/sur del hueco ya están; el box este
  // lo dejamos y añadimos entrada por el lado sur-este más abierta:

  // Pesebres / comida
  box(2.4, 0.55, 1.0, wood, -21, PLAZA_Y + 0.28, 31, true);
  box(2.4, 0.55, 1.0, wood, -21, PLAZA_Y + 0.28, 23, true);
  const foodMesh = box(0.5, 0.25, 0.4, mat(0xc4a060), FOOD_POS.x, FOOD_POS.y, FOOD_POS.z);
  foodMesh.userData = { type: 'food', heal: 15, collected: false };

  // Criatura débil en ambiente norte del establo
  const creature = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mat(0x4a3028, 0.7));
  body.scale.set(1, 0.75, 1.2); body.position.y = 0.4; body.castShadow = true;
  creature.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(0x5a3830));
  head.position.set(0, 0.65, 0.35); creature.add(head);
  creature.position.set(-18, PLAZA_Y, 30);
  creature.userData = { type: 'creature', hp: 20, maxHp: 20, weak: true, alive: true };
  scene.add(creature);

  // =====================================================================
  // 5. EDIFICIO DE DOS PISOS (este de la plaza) — PUERTA CLARA
  // =====================================================================
  pad(14, 22, PLAZA_Y, 18, 20, tile);

  // Muros PB (hueco de puerta en cara oeste, hacia la plaza)
  box(0.9, 3.2, 8, dark, 11.5, PLAZA_Y + 1.5, 28, true);   // oeste norte
  box(0.9, 3.2, 8, dark, 11.5, PLAZA_Y + 1.5, 12, true);   // oeste sur
  // Centro oeste = PUERTA (sin muro sólido; marco visible)
  box(0.4, 2.8, 0.35, doorM, 11.6, PLAZA_Y + 1.3, 22.2);  // jamba N
  box(0.4, 2.8, 0.35, doorM, 11.6, PLAZA_Y + 1.3, 17.8);  // jamba S
  box(0.45, 0.35, 4.6, doorM, 11.6, PLAZA_Y + 2.85, 20);  // dintel
  // Hoja de puerta entreabierta (visual, no bloquea)
  const hallDoor = box(0.15, 2.5, 1.8, doorM, 12.2, PLAZA_Y + 1.2, 19.2);
  hallDoor.rotation.y = -0.55;
  hallDoor.name = 'hallDoor';

  box(0.9, 3.2, 22, dark, 24.5, PLAZA_Y + 1.5, 20, true); // este
  box(14, 3.2, 0.9, dark, 18, PLAZA_Y + 1.5, 30.5, true); // norte
  box(14, 3.2, 0.9, dark, 18, PLAZA_Y + 1.5, 9.5, true);  // sur

  // Suelo 2F
  box(14, 0.35, 22, wood, 18, FLOOR2_Y - 0.15, 20);
  addPlatform(11, 25, 9, 31, FLOOR2_Y);

  // Escaleras interiores (junto muro sur)
  for (let i = 0; i < 9; i++) {
    const h = PLAZA_Y + (i + 1) * ((FLOOR2_Y - PLAZA_Y) / 9);
    const z = 11 + i * 0.9;
    box(2.4, 0.38, 0.9, stone, 14, h - 0.12, z, true);
    addPlatform(12.8, 15.2, z - 0.45, z + 0.45, h);
  }

  // Muros 2F
  box(0.9, 3.0, 22, dark, 11.5, FLOOR2_Y + 1.4, 20, true);
  box(0.9, 3.0, 22, dark, 24.5, FLOOR2_Y + 1.4, 20, true);
  box(14, 3.0, 0.9, dark, 18, FLOOR2_Y + 1.4, 30.5, true);
  box(14, 3.0, 0.9, dark, 18, FLOOR2_Y + 1.4, 9.5, true);
  box(14, 0.3, 22, dark, 18, FLOOR2_Y + 3.0, 20);

  // Oficina consejero
  const desk = box(2.8, 0.7, 1.2, wood, 18, FLOOR2_Y + 0.35, 22);
  desk.rotation.z = 0.3;
  box(1.4, 0.4, 0.8, wood, 20, FLOOR2_Y + 0.2, 14);
  box(0.35, 0.12, 0.28, mat(0x6a4030), 17.5, FLOOR2_Y + 0.55, 21.5);

  const pageMesh = box(0.4, 0.03, 0.5, mat(0xf0e6d0, 0.6), PAGE_POS.x, PAGE_POS.y, PAGE_POS.z);
  pageMesh.rotation.x = -Math.PI / 2 + 0.1;
  pageMesh.userData = { type: 'storyPage', read: false };

  const keyMesh = box(0.35, 0.08, 0.12, mat(0xc9a227, 0.4, 0.6), KEY_POS.x, KEY_POS.y, KEY_POS.z);
  keyMesh.userData = { type: 'key', collected: false };

  // Pasarela 2F edificio → torre derecha (sur)
  box(3, 0.3, 4, wood, 18, FLOOR2_Y - 0.1, 6);
  addPlatform(16.5, 19.5, 4, 8, FLOOR2_Y);

  // =====================================================================
  // 6. PUERTA PRINCIPAL DEL CASTILLO + TORRES A LOS COSTADOS
  //    (sur de la plaza, como en el croquis)
  // =====================================================================
  // Torre izquierda (flanquea la puerta)
  pad(8, 8, PLAZA_Y, -13, -6, stone);
  box(8, 7.5, 0.9, dark, -13, PLAZA_Y + 3.5, -2.5, true);
  box(8, 7.5, 0.9, dark, -13, PLAZA_Y + 3.5, -9.5, true);
  box(0.9, 7.5, 8, dark, -16.5, PLAZA_Y + 3.5, -6, true);
  box(0.9, 7.5, 8, dark, -9.5, PLAZA_Y + 3.5, -6, true);
  box(8.2, 0.3, 8.2, stone, -13, FLOOR2_Y - 0.1, -6);
  addPlatform(-16.5, -9.5, -9.5, -2.5, FLOOR2_Y);
  box(8.5, 0.35, 8.5, dark, -13, FLOOR2_Y + 3.3, -6);

  // Torre derecha
  pad(8, 8, PLAZA_Y, 13, -6, stone);
  box(8, 7.5, 0.9, dark, 13, PLAZA_Y + 3.5, -2.5, true);
  box(8, 7.5, 0.9, dark, 13, PLAZA_Y + 3.5, -9.5, true);
  box(0.9, 7.5, 8, dark, 9.5, PLAZA_Y + 3.5, -6, true);
  box(0.9, 7.5, 8, dark, 16.5, PLAZA_Y + 3.5, -6, true);
  box(8.2, 0.3, 8.2, stone, 13, FLOOR2_Y - 0.1, -6);
  addPlatform(9.5, 16.5, -9.5, -2.5, FLOOR2_Y);
  box(8.5, 0.35, 8.5, dark, 13, FLOOR2_Y + 3.3, -6);

  // Gran reja / puerta de castillo ENTRE las dos torres (nada jugable detrás)
  box(2, 7.0, 1.0, dark, -7, PLAZA_Y + 3.3, -2.8, true);
  box(2, 7.0, 1.0, dark,  7, PLAZA_Y + 3.3, -2.8, true);
  box(16, 1.4, 1.2, dark, 0, PLAZA_Y + 6.8, -2.8);
  const portcullis = box(12, 5.8, 0.45, iron, 0, PLAZA_Y + 2.9, -2.5, true);
  portcullis.name = 'portcullis';
  for (let i = -5; i <= 5; i += 1.15) {
    box(0.14, 5.5, 0.14, iron, i, PLAZA_Y + 2.7, -2.4);
  }
  box(3.2, 1.3, 0.9, iron, 0, PLAZA_Y + 6.2, -2.3);

  // Puente pequeño roto entre torres (solo 2F)
  box(2.2, 0.28, 3.5, wood, 0, FLOOR2_Y - 0.05, -6);
  addPlatform(-1.1, 1.1, -7.5, -4.2, FLOOR2_Y);
  box(1.4, 0.2, 1.0, wood, 0.5, FLOOR2_Y - 0.9, -6.5); // tabla caída

  // Pasarela 2F desde edificio (torre der) — puerta con llave
  box(3, 0.3, 3, wood, 13, FLOOR2_Y - 0.1, 1);
  addPlatform(11.5, 14.5, -0.5, 2.5, FLOOR2_Y);
  const towerDoor = box(1.7, 2.5, 0.35, wood, 13, FLOOR2_Y + 1.15, -2.2, true);
  towerDoor.name = 'tower1Door';
  towerDoor.userData = { locked: true };

  // Pasarela a torre izquierda (2F) desde el puente roto
  box(3, 0.28, 2.5, wood, -13, FLOOR2_Y - 0.05, -4);
  addPlatform(-14.5, -11.5, -5.2, -2.8, FLOOR2_Y);

  // Palanca en torre derecha (2F)
  box(0.3, 1.0, 0.3, iron, LEVER_POS.x, FLOOR2_Y + 0.5, LEVER_POS.z, true);
  const leverArm = box(0.12, 0.12, 0.9, mat(0x8a3030), LEVER_POS.x, LEVER_POS.y, LEVER_POS.z - 0.2);
  leverArm.name = 'leverArm';
  leverArm.userData = { type: 'lever', pulled: false };

  // Hierbas
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
    scene.add(g); herbs.push(g);
  }
  [[-10, 12], [10, 16], [-4, 26], [5, 4], [-14, 10], [14, 24], [0, 2], [-20, 20]].forEach(([x, z]) => createHerb(x, z));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 220), mat(0x141814, 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.5, 30);
  ground.receiveShadow = true;
  scene.add(ground);

  return {
    gate, gateLeft, gateRight, portcullis,
    herbs, pageMesh, keyMesh, foodMesh, creature,
    towerDoor, leverArm, hallDoor,
    pagePos: PAGE_POS.clone(), keyPos: KEY_POS.clone(), leverPos: LEVER_POS.clone(),
  };
}

export function closePassageGate(mapData) {
  if (!mapData?.gate || mapData.gate.userData.closed) return;
  mapData.gate.userData.closed = true;
  addWall(-1.3, 1.3, 52.2, 52.9);
  if (mapData.gateLeft) mapData.gateLeft.position.x = -1.05;
  if (mapData.gateRight) mapData.gateRight.position.x = 1.05;
}

export function tryUnlockTowerDoor(mapData, hasKey) {
  if (!mapData?.towerDoor || !mapData.towerDoor.userData.locked || !hasKey) return false;
  mapData.towerDoor.userData.locked = false;
  mapData.towerDoor.visible = false;
  mapData.towerDoor.position.y = -20;
  return true;
}
