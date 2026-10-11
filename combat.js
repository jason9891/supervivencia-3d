// combat.js — reglas de combate, equipo, pociones, cofres y enemigos.
// No depende de three.js: se puede probar con Node sin navegador.
// Convención: el ángulo `facing` apunta en la dirección (sin(facing), cos(facing)) sobre el plano X/Z.

export const MAX_HP = 100;
export const MAX_STAMINA = 100;
export const STAMINA_REGEN = 24;   // por segundo
export const STAMINA_DELAY = 0.7;  // pausa antes de empezar a recuperar
export const COMBO_WINDOW = 0.55;  // tiempo para encadenar el siguiente golpe
export const POTION_COOLDOWN = 0.8;
export const FURY_TIME = 12;
export const FURY_MULT = 1.35;
export const BLOCK_ARC = 1.22;     // ~70°: el bloqueo solo cubre lo que viene de frente

export const ATTACK_ICON = { side: '↔', forward: '▲', neutral: '●' };
export const ATTACK_LABEL = { side: 'lado', forward: 'adelante', neutral: 'quieto' };

// --- Armas ----------------------------------------------------------------
const atk = (name, dmg, reach, arc, stamina, dur, lunge, extra = {}) =>
  ({ name, dmg, reach, arc, stamina, dur, hit: dur * 0.5, lunge, ...extra });

// Tipo de ataque según la dirección en la que te mueves al pulsar ATACAR:
//   adelante (▲) = estocada larga · hacia un lado (↔) = tajo amplio · quieto (●) = golpe alto
export const WEAPONS = {
  espada: {
    id: 'espada', name: 'Espada', weight: 3,
    attacks: {
      side: atk('Tajo', 12, 2.0, 2.0, 8, 0.55, 0.35),
      forward: atk('Estocada', 16, 2.7, 0.7, 11, 0.65, 1.1),
      neutral: atk('Golpe alto', 15, 2.1, 1.2, 10, 0.62, 0.45),
    },
    combos: [
      { seq: ['side', 'side', 'forward'], name: 'Cruz y estocada', mult: 2.0, stagger: true },
      { seq: ['neutral', 'side', 'side'], name: 'Torbellino', mult: 1.7, arc: 3.4 },
      { seq: ['forward', 'forward'], name: 'Doble estocada', mult: 1.5 },
    ],
  },
  hacha: {
    id: 'hacha', name: 'Hacha', weight: 5,
    attacks: {
      side: atk('Hachazo', 18, 2.1, 1.9, 12, 0.8, 0.4),
      forward: atk('Embestida', 20, 2.4, 0.8, 14, 0.9, 1.0),
      neutral: atk('Corte descendente', 24, 2.1, 1.0, 15, 0.95, 0.4),
    },
    combos: [
      { seq: ['side', 'neutral'], name: 'Hachazo y tajo', mult: 1.9, stagger: true },
      { seq: ['forward', 'side', 'neutral'], name: 'Furia del leñador', mult: 2.2, stagger: true },
    ],
  },
  maza: {
    id: 'maza', name: 'Maza', weight: 7,
    attacks: {
      side: atk('Batido', 22, 2.0, 1.8, 15, 0.95, 0.3),
      forward: atk('Golpe seco', 24, 2.2, 0.8, 16, 1.0, 0.8),
      neutral: atk('Martillazo', 32, 2.0, 1.0, 20, 1.15, 0.35, { stagger: true }),
    },
    combos: [
      { seq: ['neutral', 'side'], name: 'Aplastar', mult: 1.8, stagger: true },
      { seq: ['side', 'side', 'neutral'], name: 'Terremoto', mult: 2.3, stagger: true },
    ],
  },
};

// --- Armaduras y escudos (el primer elemento de cada casilla es "sin nada") ---
export const ARMOR = {
  casco: {
    ninguno: { name: 'Sin casco', defense: 0, weight: 0 },
    cuero: { name: 'Casco de cuero', defense: 2, weight: 1, tier: 1 },
    malla: { name: 'Casco de malla', defense: 4, weight: 2, tier: 2 },
    placas: { name: 'Yelmo de placas', defense: 7, weight: 4, tier: 3 },
  },
  pechera: {
    ninguna: { name: 'Sin pechera', defense: 0, weight: 0 },
    cuero: { name: 'Jubón de cuero', defense: 4, weight: 2, tier: 1 },
    malla: { name: 'Cota de malla', defense: 8, weight: 4, tier: 2 },
    placas: { name: 'Coraza de placas', defense: 14, weight: 8, tier: 3 },
  },
  grebas: {
    ninguna: { name: 'Sin grebas', defense: 0, weight: 0 },
    cuero: { name: 'Grebas de cuero', defense: 2, weight: 1, tier: 1 },
    malla: { name: 'Grebas de malla', defense: 4, weight: 2, tier: 2 },
    placas: { name: 'Grebas de placas', defense: 7, weight: 4, tier: 3 },
  },
  escudo: {
    ninguno: { name: 'Sin escudo', defense: 0, weight: 0, block: 0.3 }, // se bloquea con el arma
    rodela: { name: 'Rodela', defense: 1, weight: 2, block: 0.5, tier: 1 },
    escudo: { name: 'Escudo de acero', defense: 2, weight: 4, block: 0.7, tier: 2 },
    torre: { name: 'Escudo torre', defense: 3, weight: 7, block: 0.85, tier: 3 },
  },
};
export const SLOTS = ['casco', 'pechera', 'grebas', 'escudo'];
export const SLOT_LABEL = { weapon: 'ARMA', casco: 'CASCO', pechera: 'PECHERA', grebas: 'GREBAS', escudo: 'ESCUDO' };

export function defaultEquipment() {
  return { weapon: 'espada', casco: 'ninguno', pechera: 'cuero', grebas: 'cuero', escudo: 'ninguno' };
}
export function defaultUnlocked() {
  return {
    weapon: ['espada'],
    casco: ['ninguno'],
    pechera: ['ninguna', 'cuero'],
    grebas: ['ninguna', 'cuero'],
    escudo: ['ninguno'],
  };
}
export function defaultPotions() { return { vida: 1, energia: 1, furia: 0 }; }

export function computeStats(eq) {
  const weapon = WEAPONS[eq.weapon];
  let defense = 0, weight = weapon.weight;
  for (const slot of SLOTS) {
    const it = ARMOR[slot][eq[slot]];
    defense += it.defense; weight += it.weight;
  }
  const shield = ARMOR.escudo[eq.escudo];
  return {
    defense, weight,
    speedMul: Math.max(0.78, 1 - weight * 0.011),
    regenMul: Math.max(0.55, 1 - weight * 0.018),
    blockFrac: shield.block,
    hasShield: eq.escudo !== 'ninguno',
  };
}

// Cambia la pieza de una casilla (arma o armadura) entre las que ya tienes.
export function cycleEquip(unlocked, equip, slot, dir = 1) {
  const table = slot === 'weapon' ? WEAPONS : ARMOR[slot];
  const order = Object.keys(table).filter(id => unlocked[slot].includes(id));
  const i = Math.max(0, order.indexOf(equip[slot]));
  equip[slot] = order[(i + dir + order.length) % order.length];
  return equip[slot];
}

export function itemName(slot, id) {
  return slot === 'weapon' ? WEAPONS[id].name : ARMOR[slot][id].name;
}

// --- Pociones ---------------------------------------------------------------
export const POTIONS = {
  vida: { name: 'Poción de vida', short: 'VIDA' },
  energia: { name: 'Poción de energía', short: 'ENERGÍA' },
  furia: { name: 'Poción de furia', short: 'FURIA' },
};

export function usePotion(f, inv, kind) {
  if (f.dead) return { ok: false, msg: '' };
  if (!(inv[kind] > 0)) return { ok: false, msg: 'No te quedan ' + POTIONS[kind].name.toLowerCase() + 's' };
  if (f.potionCd > 0) return { ok: false, msg: '' };
  if (kind === 'vida') {
    if (f.hp >= f.maxHp) return { ok: false, msg: 'Salud completa' };
    f.hp = Math.min(f.maxHp, f.hp + 45);
  } else if (kind === 'energia') {
    if (f.stamina >= MAX_STAMINA - 5) return { ok: false, msg: 'Energía completa' };
    f.stamina = Math.min(MAX_STAMINA, f.stamina + 70);
  } else if (kind === 'furia') {
    if (f.fury > 0) return { ok: false, msg: 'La furia ya está activa' };
    f.fury = FURY_TIME;
  }
  inv[kind]--;
  f.potionCd = POTION_COOLDOWN;
  return { ok: true, msg: POTIONS[kind].name };
}

// --- Cofres -------------------------------------------------------------------
// seg = índice de plataforma del camino donde está el cofre.
export const CHESTS = [
  { seg: 1, weapon: ['hacha'], armor: { casco: ['cuero'] }, potions: { vida: 2 } },
  { seg: 2, armor: { pechera: ['malla'], escudo: ['rodela'] }, potions: { energia: 1 } },
  { seg: 3, weapon: ['maza'], armor: { grebas: ['malla'], casco: ['malla'] }, potions: { furia: 1 } },
  { seg: 4, armor: { pechera: ['placas'], escudo: ['escudo'], grebas: ['placas'], casco: ['placas'] }, potions: { vida: 2 } },
];

export function openChest(unlocked, inv, chest) {
  const got = [];
  for (const id of chest.weapon || []) {
    if (!unlocked.weapon.includes(id)) { unlocked.weapon.push(id); got.push(WEAPONS[id].name); }
  }
  for (const [slot, ids] of Object.entries(chest.armor || {})) {
    for (const id of ids) {
      if (!unlocked[slot].includes(id)) { unlocked[slot].push(id); got.push(ARMOR[slot][id].name); }
    }
  }
  for (const [kind, n] of Object.entries(chest.potions || {})) {
    inv[kind] += n; got.push(n + ' × ' + POTIONS[kind].name);
  }
  return got;
}

// --- Combatientes -------------------------------------------------------------
export function createFighter(opts = {}) {
  const hp = opts.hp ?? MAX_HP;
  return {
    hp, maxHp: hp, stamina: MAX_STAMINA,
    x: 0, y: 0, z: 0, facing: 0, radius: 0.4,
    hitstun: 0, attack: null, buffered: null,
    chain: [], chainTimer: 0,
    blocking: false, staminaDelay: 0,
    fury: 0, potionCd: 0, dead: false,
    weapon: WEAPONS.espada,
  };
}

const wrapAngle = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const endsWith = (arr, seq) => arr.length >= seq.length && seq.every((v, i) => arr[arr.length - seq.length + i] === v);

// Tipo de ataque según la dirección pulsada.
export function attackTypeFor(f, side) {
  if (side) return 'side';
  if (f > 0) return 'forward';
  return 'neutral';
}

function startAttack(fi, type) {
  const data = fi.weapon.attacks[type];
  if (fi.chainTimer > 0) fi.chain.push(type); else fi.chain = [type];
  fi.chain = fi.chain.slice(-4);
  const combo = fi.weapon.combos.find(c => endsWith(fi.chain, c.seq)) || null;
  const n = fi.chain.length;
  fi.attack = {
    type, data, t: 0, hitDone: false, combo,
    mult: (1 + Math.min(0.2, (n - 1) * 0.1)) * (combo ? combo.mult : 1),
    stagger: !!(data.stagger || (combo && combo.stagger)),
    arc: (combo && combo.arc) || data.arc,
    reach: data.reach + (combo ? 0.2 : 0),
    dur: data.dur, hit: data.hit,
  };
  fi.stamina -= data.stamina;
  fi.staminaDelay = STAMINA_DELAY;
  fi.chainTimer = 0;
  fi.blocking = false;
}

// Intenta atacar. Si ya estás atacando y pasó el punto de impacto, deja el golpe en cola.
export function tryAttack(fi, type) {
  if (fi.dead || fi.hitstun > 0) return false;
  const data = fi.weapon.attacks[type];
  if (!data) return false;
  if (fi.attack) {
    if (fi.attack.t >= fi.attack.hit && !fi.buffered) { fi.buffered = type; return true; }
    return false;
  }
  if (fi.stamina < data.stamina) return false;
  startAttack(fi, type);
  return true;
}

export function setBlocking(fi, on) {
  if (on) fi.blocking = !fi.dead && !fi.attack && fi.hitstun <= 0 && fi.stamina > 0;
  else fi.blocking = false;
}

// Avanza el estado del combatiente. Devuelve eventos: { type: 'strike' | 'attackEnd' }.
export function updateFighter(fi, dt, regenMul = 1) {
  const ev = [];
  if (fi.potionCd > 0) fi.potionCd = Math.max(0, fi.potionCd - dt);
  if (fi.fury > 0) fi.fury = Math.max(0, fi.fury - dt);
  if (fi.hitstun > 0) fi.hitstun = Math.max(0, fi.hitstun - dt);
  if (fi.chainTimer > 0) fi.chainTimer = Math.max(0, fi.chainTimer - dt);
  if (fi.attack) {
    const a = fi.attack;
    a.t += dt;
    if (!a.hitDone && a.t >= a.hit) { a.hitDone = true; ev.push({ type: 'strike', attack: a }); }
    if (a.t >= a.dur) {
      ev.push({ type: 'attackEnd' });
      fi.attack = null;
      if (a.combo) { fi.chain = []; fi.chainTimer = 0; } else fi.chainTimer = COMBO_WINDOW;
      if (fi.buffered) {
        const b = fi.buffered; fi.buffered = null;
        if (!fi.dead && fi.hitstun <= 0 && fi.stamina >= fi.weapon.attacks[b].stamina) startAttack(fi, b);
      }
    }
  }
  if (fi.staminaDelay > 0) fi.staminaDelay -= dt;
  else if (!fi.attack && !fi.blocking) fi.stamina = Math.min(MAX_STAMINA, fi.stamina + STAMINA_REGEN * regenMul * dt);
  return ev;
}

// ¿Está `tgt` dentro del cono de alcance de `att`?
export function inCone(att, tgt, reach, arc) {
  const dx = tgt.x - att.x, dz = tgt.z - att.z;
  const dist = Math.hypot(dx, dz);
  if (dist > reach + tgt.radius) return false;
  if (dist < 0.001) return true;
  return Math.abs(wrapAngle(Math.atan2(dx, dz) - att.facing)) <= arc / 2;
}

function frontal(target, attacker) {
  const dx = attacker.x - target.x, dz = attacker.z - target.z;
  if (Math.hypot(dx, dz) < 0.001) return true;
  return Math.abs(wrapAngle(Math.atan2(dx, dz) - target.facing)) <= BLOCK_ARC;
}

// Aplica el daño de un golpe a `target`. `tstats` = { defense, blockFrac }.
export function resolveHit(attacker, target, attack, tstats) {
  const raw = attack.data.dmg * attack.mult * (attacker.fury > 0 ? FURY_MULT : 1);
  const armored = raw / (1 + tstats.defense / 40);
  let dmg = armored, blocked = false, guardBroken = false;
  if (target.blocking && frontal(target, attacker)) {
    const frac = tstats.blockFrac || 0.3;
    const cost = raw * 0.55 * (1 - frac * 0.4);
    if (target.stamina >= cost) {
      target.stamina -= cost; target.staminaDelay = STAMINA_DELAY;
      dmg = armored * (1 - frac); blocked = true;
    } else {
      target.stamina = 0; target.blocking = false; target.hitstun = 0.7;
      dmg = armored * 0.6; guardBroken = true;
    }
  }
  dmg = blocked ? Math.round(dmg) : Math.max(1, Math.round(dmg));
  target.hp = Math.max(0, target.hp - dmg);
  if (target.hp <= 0) {
    target.dead = true; target.attack = null; target.buffered = null; target.blocking = false;
  } else if (!blocked && !guardBroken) {
    target.hitstun = attack.stagger ? 0.65 : 0.3;
    target.attack = null; target.buffered = null;
  } else if (guardBroken) {
    target.attack = null; target.buffered = null;
  }
  return { damage: dmg, blocked, guardBroken, killed: target.dead, target };
}

// Golpe del jugador contra todos los enemigos que alcance. Devuelve la lista de impactos.
export function resolvePlayerStrike(player, enemies, attack, onPlat) {
  const hits = [];
  for (const e of enemies) {
    if (e.dead) continue;
    if (!inCone(player, e, attack.reach, attack.arc)) continue;
    const r = resolveHit(player, e, attack, e.stats);
    // Pequeño empujón hacia atrás (sin sacarlo del camino).
    const dx = e.x - player.x, dz = e.z - player.z, d = Math.hypot(dx, dz) || 1;
    const kb = attack.stagger ? 0.7 : 0.35;
    if (!r.killed && onPlat(e.x + dx / d * kb, e.z + dz / d * kb)) { e.x += dx / d * kb; e.z += dz / d * kb; }
    hits.push(r);
  }
  return hits;
}

// --- Enemigos -----------------------------------------------------------------
export const ENEMIES = {
  soldado: { name: 'Soldado caído', hp: 50, dmg: 9, speed: 1.5, reach: 1.7, windup: 0.6, recover: 1.0, aggro: 9, defense: 4, radius: 0.45, scale: 1, tint: 0x7a2f27 },
  guardian: { name: 'Guardián', hp: 120, dmg: 18, speed: 1.1, reach: 2.0, windup: 0.85, recover: 1.4, aggro: 11, defense: 12, radius: 0.55, scale: 1.15, tint: 0x2f4263 },
};

export function createEnemy(kind, x, z) {
  const d = ENEMIES[kind];
  const e = createFighter({ hp: d.hp });
  Object.assign(e, {
    kind, def: d, x, z, spawn: { x, z }, radius: d.radius, facing: Math.PI,
    state: 'idle', t: 0, deadT: 0,
    stats: { defense: d.defense, blockFrac: 0 },
  });
  return e;
}

// Avanza la IA de un enemigo. Devuelve eventos { type: 'enemyStrike', enemy }.
export function stepEnemy(e, player, onPlat, dt) {
  const ev = [];
  if (e.dead) { e.deadT += dt; e.state = 'dead'; return ev; }
  if (e.hitstun > 0) {
    e.hitstun = Math.max(0, e.hitstun - dt);
    e.state = 'hurt'; e.t = 0;
    return ev;
  }
  if (e.state === 'hurt') e.state = 'chase';
  if (player.dead) { e.state = 'idle'; return ev; }
  const dx = player.x - e.x, dz = player.z - e.z, dist = Math.hypot(dx, dz);
  if (e.state === 'idle') {
    if (dist <= e.def.aggro) e.state = 'chase'; else return ev;
  }
  const face = Math.atan2(dx, dz);
  if (e.state === 'chase') {
    e.facing = face;
    if (dist <= e.def.reach * 0.85) { e.state = 'windup'; e.t = 0; }
    else {
      const step = e.def.speed * dt;
      const nx = e.x + dx / dist * step, nz = e.z + dz / dist * step;
      if (onPlat(nx, nz)) { e.x = nx; e.z = nz; }
    }
  } else if (e.state === 'windup') {
    e.t += dt;
    if (e.t < e.def.windup * 0.75) e.facing = face; // deja de apuntar al final: se puede esquivar
    if (e.t >= e.def.windup) {
      ev.push({ type: 'enemyStrike', enemy: e });
      e.state = 'recover'; e.t = 0;
    }
  } else if (e.state === 'recover') {
    e.t += dt;
    if (e.t >= e.def.recover) { e.state = 'chase'; e.t = 0; }
  }
  return ev;
}

// Golpe de un enemigo contra el jugador. Saltar lo esquiva. Devuelve el resultado o null.
export function resolveEnemyStrike(e, player, pstats) {
  if (player.dead || (player.y || 0) > 0.5) return null;
  if (!inCone(e, player, e.def.reach * 1.15, 1.7)) return null;
  return resolveHit(e, player, { data: { dmg: e.def.dmg }, mult: 1, stagger: false }, pstats);
}

// Evita que los enemigos se amontonen en el mismo punto.
export function separate(enemies, onPlat, minDist = 1.0) {
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j];
    if (a.dead || b.dead) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d >= minDist || d < 0.0001) continue;
    const push = (minDist - d) / 2;
    const ux = dx / d, uz = dz / d;
    if (onPlat(b.x + ux * push, b.z + uz * push)) { b.x += ux * push; b.z += uz * push; }
    if (onPlat(a.x - ux * push, a.z - uz * push)) { a.x -= ux * push; a.z -= uz * push; }
  }
}

// --- Objetivo -------------------------------------------------------------------
export function objectiveState({ best, totalGaps, enemiesDead, enemiesTotal, reachedPortal }) {
  if (reachedPortal) return { stage: 3, text: '¡VICTORIA! Cruzaste el portal' };
  if (best < totalGaps) return { stage: 0, text: 'OBJETIVO: cruza los barrancos ' + best + '/' + totalGaps };
  if (enemiesDead < enemiesTotal) return { stage: 1, text: 'OBJETIVO: derrota a los guardianes ' + enemiesDead + '/' + enemiesTotal };
  return { stage: 2, text: 'OBJETIVO: ¡cruza el portal dorado!' };
}
