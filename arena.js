// arena.js — enemigos con IA para probar el combate (lógica pura; no depende de three.js ni del mapa).
// Usa los enemigos de combat.js (createEnemy / stepEnemy / resolveEnemyStrike). Los enemigos viven también en `bench.dummies`,
// así los golpes del jugador los alcanzan con las mismas reglas que a los muñecos (banco.update los salta en regeneración y reaparición).
import * as C from './combat.js';
import * as SW from './swing-style.js';

export const RESPAWN = 6;            // s tras morir hasta que reaparece en su puesto
export const WALK_REF = 1.8;         // m/s a los que Walk_Loop no desliza (ver locomotion.js)

// Aspecto y animación de cada enemigo (los ids de arma, casco, etc. vienen de combat.js / equipment.js).
export const LOOKS = {
  soldado:  { weapon: 'espada_larga', equip: { casco: 'cuero', pechera: 'cuero', grebas: 'ninguna', escudo: 'ninguno' }, clip: 'sword regular b' },
  guardian: { weapon: 'martillo', equip: { casco: 'placas', pechera: 'placas', grebas: 'placas', escudo: 'ninguno' }, clip: 'sword regular c' },
};
export const DEFAULT_SPAWNS = [['soldado', -7, 7], ['guardian', 7, 8]];

export function createArena() { return { enemies: [] }; }

export function spawn(arena, kind, x, z) {
  const e = C.createEnemy(kind, x, z);
  Object.assign(e, { ai: true, name: e.def.name, y: 0, sinceHit: 99, hurtT: 0, downed: false });
  arena.enemies.push(e);
  return e;
}
export function spawnDefaults(arena) { for (const [k, x, z] of DEFAULT_SPAWNS) spawn(arena, k, x, z); return arena.enemies; }
export function clear(arena, bench) {
  arena.enemies.length = 0;
  if (bench) bench.dummies = bench.dummies.filter(d => !d.ai);
}
export const living = arena => arena.enemies.filter(e => !e.dead);

export function reviveEnemy(e) {
  Object.assign(e, { hp: e.maxHp, dead: false, hitstun: 0, deadT: 0, state: 'idle', t: 0, downed: false, x: e.spawn.x, z: e.spawn.z, sinceHit: 99, hurtT: 0, attack: null });
}

// Mantiene a los enemigos dentro de bench.dummies (sin duplicarlos y sin tocar los muñecos).
function sync(arena, bench) {
  for (const e of arena.enemies) if (!bench.dummies.includes(e)) bench.dummies.push(e);
  bench.dummies = bench.dummies.filter(d => !d.ai || arena.enemies.includes(d));
}

// Avanza a todos los enemigos. Devuelve eventos:
//   { type:'state', enemy, from, to }   cambio de estado (idle/chase/windup/recover/hurt/dead)
//   { type:'playerHit', enemy, result } el golpe alcanzó al jugador (result: damage/blocked/guardBroken/killed)
//   { type:'enemyMiss', enemy }         el golpe no alcanzó (saltaste o te moviste)
//   { type:'enemyDown', enemy } / { type:'enemyBack', enemy }
export function update(arena, bench, dt, onPlat = () => true) {
  sync(arena, bench);
  const out = [], pst = C.computeStats(bench.equip);
  for (const e of arena.enemies) {
    if (e.dead) {
      if (!e.downed) { e.downed = true; out.push({ type: 'enemyDown', enemy: e }); }
      e.deadT += dt; e.state = 'dead';
      if (e.deadT >= RESPAWN) { reviveEnemy(e); out.push({ type: 'enemyBack', enemy: e }); }
      continue;
    }
    if (e.hurtT > 0) e.hurtT = Math.max(0, e.hurtT - dt);
    if (e.state === 'dead') e.state = 'idle';
    const prev = e.state;
    for (const ev of C.stepEnemy(e, bench.fighter, onPlat, dt)) {
      if (ev.type !== 'enemyStrike') continue;
      const res = C.resolveEnemyStrike(e, bench.fighter, pst);
      out.push(res ? { type: 'playerHit', enemy: e, result: res } : { type: 'enemyMiss', enemy: e });
    }
    if (e.state !== prev) out.push({ type: 'state', enemy: e, from: prev, to: e.state });
  }
  C.separate(living(arena), onPlat);
  return out;
}

// 0..1 mientras el enemigo prepara el golpe (para el aviso visual).
export const windupProgress = e => (e.state === 'windup' ? Math.min(1, e.t / e.def.windup) : 0);

// Animación que le toca al enemigo ahora (misma forma que locomotion.stepLoco → createLoco.apply).
export function pick(e, has = () => true) {
  const L = LOOKS[e.kind] || LOOKS.soldado;
  const first = (...n) => n.find(has);
  const idle = first('idle loop', 'idle') ?? first('walk loop');
  switch (e.state) {
    case 'dead': return { key: 'dead', name: first('death01') ?? idle, rate: 1, once: true };
    case 'hurt': return { key: 'hurt', name: first('hit chest', 'hit knockback') ?? idle, rate: 1.2, once: true };
    case 'windup':
    case 'recover': {
      const name = has(L.clip) ? L.clip : first('sword attack') ?? idle;
      // El clip se frena para que el golpe caiga justo al terminar la preparación: se ve venir.
      const strike = SW.STRIKE_AT[name] ?? 0.4;
      const rate = Math.min(1.6, Math.max(0.5, strike / e.def.windup));
      return { key: 'attack', name, rate, once: true };
    }
    case 'chase': return { key: 'walk', name: first('walk loop', 'walk') ?? idle, rate: Math.max(0.5, e.def.speed / WALK_REF) };
    default: return { key: 'idle', name: idle, rate: 1 };
  }
}
