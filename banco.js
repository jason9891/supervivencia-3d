// banco.js — banco de pruebas de armas, armaduras, pociones y combos.
// No depende de three.js ni del mapa: se puede probar con Node sin navegador.
// Usa las reglas de combat.js. No modifica al personaje ni al mapa: solo lee
// la posición del jugador (x, y, z, facing) y simula sus golpes sobre muñecos.
import * as C from './combat.js';
import * as I from './inventario.js';

export const DUMMIES = {
  paja:    { id: 'paja',    name: 'Muñeco de paja',    hp: 150, defense: 0 },
  blindado:{ id: 'blindado', name: 'Muñeco blindado',   hp: 150, defense: 12 },
};
export const DUMMY_RESPAWN = 2.0;   // s hasta que reaparece un muñeco derrotado
export const DUMMY_REGEN_DELAY = 3; // s sin recibir golpes antes de recuperar la vida
export const TEST_HIT = 20;         // daño del "golpe de prueba" sobre el jugador
export const START_POTIONS = I.START_POTIONS;

// El banco comparte el inventario del jugador: mismo equipo, mismas piezas y mismas pociones.
// Sin argumentos crea uno nuevo con todo desbloqueado (modo pruebas).
export function createBanco(inv = I.createInventory({ testMode: true })) {
  const b = {
    inv,
    fighter: C.createFighter(),
    dummies: [],
    stats: { hits: 0, damage: 0, kills: 0, combos: 0, last: null },
  };
  Object.defineProperties(b, {
    equip: { get: () => inv.equip },
    unlocked: { get: () => inv.unlocked },
    potions: { get: () => inv.potions },
  });
  b.fighter.weapon = C.WEAPONS[inv.equip.weapon];
  return b;
}

export function currentStats(b) { return C.computeStats(b.equip); }

// Cambia una pieza del equipo (arma, casco, pechera, grebas o escudo).
export function cycle(b, slot, dir = 1) {
  C.cycleEquip(b.unlocked, b.equip, slot, dir);
  b.fighter.weapon = C.WEAPONS[b.equip.weapon];
  // Cambiar de arma corta cualquier golpe o cadena en curso.
  if (slot === 'weapon') { b.fighter.attack = null; b.fighter.buffered = null; b.fighter.chain = []; b.fighter.chainTimer = 0; }
  return b.equip[slot];
}

// Lista legible de los golpes y combos del arma equipada.
export function describeWeapon(b) {
  const w = C.WEAPONS[b.equip.weapon];
  const attacks = Object.entries(w.attacks).map(([type, a]) => ({
    type, icon: C.ATTACK_ICON[type], label: C.ATTACK_LABEL[type], name: a.name,
    dmg: a.dmg, reach: a.reach, stamina: a.stamina, stagger: !!a.stagger,
  }));
  const combos = w.combos.map(c => ({
    name: c.name, mult: c.mult, stagger: !!c.stagger,
    seq: c.seq.map(t => C.ATTACK_ICON[t]).join(' → '),
    labels: c.seq.map(t => C.ATTACK_LABEL[t]).join(' · '),
  }));
  return { id: w.id, name: w.name, weight: w.weight, attacks, combos };
}

// --- Muñecos ------------------------------------------------------------------
export function placeDummy(b, kind, x, z, y = 0) {
  const d = DUMMIES[kind] || DUMMIES.paja;
  const f = C.createFighter({ hp: d.hp });
  Object.assign(f, {
    kind: d.id, name: d.name, x, y, z, radius: 0.45, spawn: { x, z, y },
    stats: { defense: d.defense, blockFrac: 0 },
    sinceHit: 99, deadT: 0, hurtT: 0,
  });
  b.dummies = [f];
  return f;
}
export function clearDummies(b) { b.dummies = []; }

// --- Jugador ------------------------------------------------------------------
export function syncPlayer(b, p) {
  const f = b.fighter;
  f.x = p.x; f.y = p.y || 0; f.z = p.z; f.facing = p.facing;
}

// Pulsar ATACAR. f: 1 si mantienes ▲, side: ±1 si mantienes ◀/▶. Devuelve { started, type }.
export function pressAttack(b, f, side) {
  const type = C.attackTypeFor(f, side);
  const started = C.tryAttack(b.fighter, type);
  return { started, type };
}

export function usePotion(b, kind) { return C.usePotion(b.fighter, b.potions, kind); }
export function refillPotions(b) { I.refillPotions(b.inv); }
export function useItem(b, id) { return I.useItem(b.inv, b.fighter, id); }

// Golpe de prueba contra el jugador para ver cuánto reduce la armadura (no hay enemigos).
export function testHit(b, damage = TEST_HIT) {
  const f = b.fighter;
  if (f.dead) return null;
  const attacker = { x: f.x + Math.sin(f.facing) * 1.5, z: f.z + Math.cos(f.facing) * 1.5, fury: 0 };
  const res = C.resolveHit(attacker, f, { data: { dmg: damage }, mult: 1, stagger: false }, C.computeStats(b.equip));
  return { raw: damage, taken: res.damage, killed: res.killed };
}

// Revive al jugador de pruebas y restablece vida, energía y muñecos.
export function restore(b) {
  const f = b.fighter;
  Object.assign(f, { hp: f.maxHp, stamina: C.MAX_STAMINA, dead: false, hitstun: 0, attack: null, buffered: null, chain: [], chainTimer: 0, fury: 0, potionCd: 0 });
  for (const d of b.dummies) revive(d);
}

function revive(d) {
  Object.assign(d, { hp: d.maxHp, dead: false, hitstun: 0, deadT: 0, sinceHit: 99, hurtT: 0, x: d.spawn.x, z: d.spawn.z });
}

// Avanza el banco `dt` segundos. Devuelve eventos:
//   { type: 'hit', dummy, attack, result }   un golpe del jugador alcanzó a un muñeco
//   { type: 'miss', attack }                 el golpe no alcanzó a nadie
//   { type: 'combo', name, mult }            se completó un combo
//   { type: 'dummyDown', dummy } / { type: 'dummyBack', dummy }
export function update(b, dt) {
  const out = [];
  const f = b.fighter;
  const st = C.computeStats(b.equip);
  for (const e of C.updateFighter(f, dt, st.regenMul)) {
    if (e.type !== 'strike') continue;
    const att = e.attack;
    // Los muñecos son postes fijos: sin empujón (onPlat siempre falso).
    const hits = C.resolvePlayerStrike(f, b.dummies, att, () => false);
    if (!hits.length) { out.push({ type: 'miss', attack: att }); continue; }
    for (const r of hits) {
      b.stats.hits++; b.stats.damage += r.damage;
      r.target.sinceHit = 0; r.target.hurtT = 0.3;
      const rec = { attackName: att.data.name, damage: r.damage, combo: att.combo ? att.combo.name : null, mult: att.mult };
      b.stats.last = rec;
      out.push({ type: 'hit', dummy: r.target, attack: att, result: r });
      if (r.killed) { b.stats.kills++; out.push({ type: 'dummyDown', dummy: r.target }); }
    }
    if (att.combo) { b.stats.combos++; out.push({ type: 'combo', name: att.combo.name, mult: att.combo.mult }); }
  }
  for (const d of b.dummies) {
    if (d.hurtT > 0) d.hurtT = Math.max(0, d.hurtT - dt);
    if (d.hitstun > 0) d.hitstun = Math.max(0, d.hitstun - dt);
    if (d.dead) {
      d.deadT += dt;
      if (d.deadT >= DUMMY_RESPAWN) { revive(d); out.push({ type: 'dummyBack', dummy: d }); }
    } else {
      d.sinceHit += dt;
      if (d.sinceHit > DUMMY_REGEN_DELAY && d.hp < d.maxHp) d.hp = Math.min(d.maxHp, d.hp + d.maxHp * 0.5 * dt);
    }
  }
  return out;
}
