// layout-patio.js — combate en el patio del castillo (primer espacio del mapa "El Regreso").
// No toca el mapa: solo dice dónde hay enemigos y cofres dentro del patio.
// No depende de three.js: se puede probar con Node sin navegador.
import * as C from './combat.js';

// Plano del patio (map1.js): cuadrado de 36 m centrado en el origen; fuente en el centro.
export const PATIO = { minX: -16.5, maxX: 16.5, minZ: -16.5, maxZ: 16.5 };
const OBSTACLES = [
  { x: 0, z: 0, r: 3.0 },     // fuente
  { x: 5, z: 8, r: 0.7 },     // columna cubierta de musgo
  { x: -6, z: -7, r: 0.7 },   // columna cubierta de musgo
];
export const SPAWN = { x: 0, z: 8 };

// Suelo continuo y muy ancho: el mapa pone sus propios muros (resolveWallCollisions).
export function castleCourse() {
  return { segments: [{ a: 40, b: -80 }], gaps: 0, halfWidth: 40 };
}

export function patioWalkable(x, z) {
  if (x < PATIO.minX || x > PATIO.maxX || z < PATIO.minZ || z > PATIO.maxZ) return false;
  for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r) return false;
  return true;
}

export function patioLayout() {
  const enemies = [
    { kind: 'soldado', x: -9, z: -1 },   // 0: oeste de la fuente
    { kind: 'soldado', x: 9, z: -3 },    // 1: este de la fuente
    { kind: 'guardian', x: 0, z: -12 },  // 2: al sur, junto a la salida a la biblioteca
  ];
  // Cada cofre queda custodiado por los enemigos de `guards` (índices de la lista de arriba).
  const chests = [
    { x: -14, z: 10, guards: [0], def: { weapon: ['hacha'], armor: { casco: ['cuero'] }, potions: { vida: 2 } } },
    { x: 14, z: 10, guards: [1], def: { armor: { pechera: ['malla'], escudo: ['rodela'] }, potions: { energia: 1 } } },
    { x: 14, z: -12, guards: [2], def: { weapon: ['maza'], armor: { grebas: ['malla'], casco: ['malla'] }, potions: { furia: 1 } } },
    { x: -14, z: -12, guards: [2], def: { armor: { pechera: ['placas'], escudo: ['escudo'], grebas: ['placas'], casco: ['placas'] }, potions: { vida: 2 } } },
  ];
  return {
    enemies, chests, portal: false, gateZ: undefined,
    area: () => patioWalkable,
    walkable: patioWalkable,
    guardsDead: (s, c) => c.guards.every(e => e.dead),
    respawn: () => ({ x: SPAWN.x, z: SPAWN.z }),
    objective: (s) => {
      const dead = s.enemies.filter(e => e.dead).length, total = s.enemies.length;
      const open = s.chests.filter(c => c.opened).length, ct = s.chests.length;
      if (dead < total) return { stage: 0, text: 'PATIO: derrota a los enemigos ' + dead + '/' + total };
      if (open < ct) return { stage: 1, text: 'PATIO DESPEJADO: abre los cofres ' + open + '/' + ct };
      return { stage: 2, text: 'PATIO COMPLETADO · equipo desbloqueado' };
    },
  };
}
