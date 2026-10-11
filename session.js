// session.js — estado de la partida: une course.js (movimiento y salto) con combat.js (combate).
// No depende de three.js: se puede probar con Node sin navegador.
import * as C from './combat.js';
import { segmentIndex, onPlatform, stepPlayer, HALF_WIDTH } from './course.js';

export const RESPAWN_TIME = 2.4;
export const CHEST_RADIUS = 1.5;

// --- Diseños de partida ("layouts") -------------------------------------------------
// Un layout dice dónde hay enemigos y cofres y cómo se comportan el objetivo, la reaparición y el final.
// El del camino de barrancos es el original; layout-patio.js define el del patio del castillo.
//   enemies: [{ kind, x, z, seg? }]      chests: [{ def, x, z, seg?, guards? }]
//   area(e)       -> (x,z)=>bool   zona donde puede moverse ese enemigo
//   walkable      -> (x,z)=>bool   suelo válido (empujones y separación)
//   guardsDead(s,c) -> bool        ¿el cofre ya no está custodiado?
//   respawn(s)    -> {x,z}         dónde reaparece el jugador
//   objective(s,reachedPortal) -> {stage,text}
//   portal: bool, gateZ             portal final sellado (solo en el camino de barrancos)

// Enemigos por plataforma del camino: [tipo, x, z relativo al centro de la plataforma].
const SPAWNS = [
  { seg: 2, list: [['soldado', 0, 0]] },
  { seg: 3, list: [['soldado', 0, 0]] },
  { seg: 4, list: [['soldado', -1.0, 0], ['soldado', 1.0, -0.6]] },
  { seg: 5, list: [['soldado', 1.3, 3.0], ['guardian', 0, -1.0]] },
];

export function barrancoLayout(course) {
  const segCenter = (i) => (course.segments[i].a + course.segments[i].b) / 2;
  const enemies = [], chests = [];
  for (const sp of SPAWNS) {
    if (sp.seg >= course.segments.length) continue;
    for (const [kind, x, dz] of sp.list) enemies.push({ kind, x, z: segCenter(sp.seg) + dz, seg: sp.seg });
  }
  C.CHESTS.forEach((def, i) => {
    if (def.seg >= course.segments.length) return;
    chests.push({ def, seg: def.seg, x: i % 2 ? -1.5 : 1.5, z: segCenter(def.seg) + 1.2 });
  });
  const hw = course.halfWidth ?? HALF_WIDTH;
  return {
    enemies, chests, portal: true,
    gateZ: course.segments[course.segments.length - 1].b + 2.6,
    area: (e) => (x, z) => segmentIndex(course, x, z) === e.seg && Math.abs(x) <= hw - 0.3,
    walkable: (x, z) => onPlatform(course, x, z),
    guardsDead: (s, c) => !s.enemies.some(e => e.seg === c.seg && !e.dead),
    respawn: (s) => {
      let i = Math.max(0, segmentIndex(course, s.player.x, s.player.z));
      while (i > 0 && s.enemies.some(e => e.seg === i && !e.dead)) i--;
      return { x: 0, z: course.segments[i].a - 1.5 };
    },
    objective: (s, reachedPortal) => C.objectiveState({
      best: s.player.best, totalGaps: course.gaps,
      enemiesDead: s.enemies.filter(e => e.dead).length, enemiesTotal: s.enemies.length,
      reachedPortal,
    }),
  };
}

// Aspecto (armas y armadura) de cada tipo de enemigo; lo usa la parte gráfica.
export const ENEMY_LOOK = {
  soldado: { weapon: 'espada', casco: 'cuero', pechera: 'cuero', grebas: 'ninguna', escudo: 'ninguno' },
  guardian: { weapon: 'maza', casco: 'placas', pechera: 'placas', grebas: 'placas', escudo: 'torre' },
};

export function createSession(course, player, layout = barrancoLayout(course)) {
  // El jugador de course.js ya tiene x, y, z, facing; se le añaden los campos de combate.
  const base = C.createFighter();
  for (const k of Object.keys(base)) if (!(k in player)) player[k] = base[k];
  player.radius = base.radius;

  const eq = C.defaultEquipment();
  const s = {
    course, player, eq, layout,
    unlocked: C.defaultUnlocked(),
    inv: C.defaultPotions(),
    stats: C.computeStats(eq),
    enemies: [], chests: [],
    deaths: 0, respawnT: 0, victory: false,
    paused: false,
    msgCd: {},
    objective: { stage: 0, text: '' },
  };
  player.weapon = C.WEAPONS[eq.weapon];

  for (const en of layout.enemies) {
    const e = C.createEnemy(en.kind, en.x, en.z);
    if (en.seg !== undefined) e.seg = en.seg;
    s.enemies.push(e);
  }
  for (const c of layout.chests) {
    s.chests.push({ ...c, opened: false, guards: (c.guards || []).map(i => s.enemies[i]) });
  }
  s.gateZ = layout.gateZ;
  refreshObjective(s, false);
  return s;
}

function refreshObjective(s, reachedPortal) {
  s.objective = s.layout.objective(s, reachedPortal);
}

function say(s, ev, text, key, cooldown = 3) {
  if (key) { if ((s.msgCd[key] || 0) > 0) return; s.msgCd[key] = cooldown; }
  ev.push({ kind: 'msg', text });
}

export function equipSlot(s, slot, dir = 1) {
  C.cycleEquip(s.unlocked, s.eq, slot, dir);
  s.stats = C.computeStats(s.eq);
  s.player.weapon = C.WEAPONS[s.eq.weapon];
  return C.itemName(slot, s.eq[slot]);
}

export function equipmentRows(s) {
  return ['weapon', 'casco', 'pechera', 'grebas', 'escudo'].map(slot => ({
    slot, label: C.SLOT_LABEL[slot], name: C.itemName(slot, s.eq[slot]),
    count: slot === 'weapon' ? s.unlocked.weapon.length : s.unlocked[slot].length,
  }));
}

// input: { f, side, speed, running, jump, attack, block, potion }
// attack / potion / jump son "pulsaciones" (true solo el cuadro en que se pulsan).
export function stepSession(s, input, dt) {
  const ev = [];
  if (s.paused || s.victory) return ev;
  const { course, player: p } = s;
  const onPlat = s.layout.walkable;
  for (const k of Object.keys(s.msgCd)) s.msgCd[k] = Math.max(0, s.msgCd[k] - dt);
  s.stats = C.computeStats(s.eq);
  p.weapon = C.WEAPONS[s.eq.weapon];

  // --- Jugador muerto: esperar y reaparecer.
  if (p.dead) {
    s.respawnT -= dt;
    if (s.respawnT <= 0) {
      p.dead = false; p.hp = p.maxHp; p.stamina = C.MAX_STAMINA;
      p.hitstun = 0; p.attack = null; p.buffered = null; p.chain = []; p.chainTimer = 0; p.blocking = false;
      p.fury = 0; p.potionCd = 0;
      const rp = s.layout.respawn(s);
      p.checkpoint = rp;
      p.x = rp.x; p.z = rp.z; p.y = 0; p.vy = 0; p.avx = 0; p.avz = 0;
      p.grounded = true; p.jumping = false; p.facing = Math.PI;
      ev.push({ kind: 'respawn' });
      say(s, ev, 'Vuelves a levantarte');
    }
    stepEnemies(s, ev, dt, onPlat);
    refreshObjective(s, false);
    return ev;
  }

  // --- Pociones y guardia.
  if (input.potion) {
    const r = C.usePotion(p, s.inv, input.potion);
    if (r.ok) { ev.push({ kind: 'potion', potion: input.potion }); say(s, ev, r.msg); }
    else if (r.msg) say(s, ev, r.msg, 'potion-' + input.potion, 1.5);
  }
  C.setBlocking(p, !!input.block);

  // --- Ataque (la dirección pulsada decide el tipo de golpe).
  if (input.attack) {
    const type = C.attackTypeFor(input.f || 0, input.side ? 1 : 0);
    const had = p.attack;
    if (C.tryAttack(p, type) && !had) {
      aimAtNearest(s);
      ev.push({ kind: 'attackStart', attack: p.attack });
      if (p.attack.combo) say(s, ev, '¡' + p.attack.combo.name + '!');
    } else if (!p.attack && p.stamina < p.weapon.attacks[type].stamina) {
      say(s, ev, 'Sin aliento', 'tired', 1);
    }
  }

  // --- Movimiento: bloqueado mientras atacas o estás aturdido; lento al guardar.
  const acting = !!p.attack || p.hitstun > 0;
  let speed = (input.speed || 1.8) * s.stats.speedMul * (p.blocking ? 0.45 : 1);
  if (p.attack && !p.attack.hitDone && p.attack.data.lunge > 0) {
    const d = p.attack.data.lunge / p.attack.hit * dt;
    const nx = p.x + Math.sin(p.facing) * d, nz = p.z + Math.cos(p.facing) * d;
    if (onPlat(nx, nz) && p.grounded) { p.x = nx; p.z = nz; }
  }
  stepPlayer(p, course, {
    f: input.f || 0, side: input.side || 0, speed, running: !!input.running,
    jumpSpeed: input.speed || 1.8, // la armadura frena al caminar, pero no acorta el salto
    jump: !!input.jump && !acting, canMove: !acting,
  }, dt);

  // --- Estado del combatiente (energía, cadena de golpes, impacto).
  for (const e of C.updateFighter(p, dt, s.stats.regenMul)) {
    if (e.type === 'strike') {
      const hits = C.resolvePlayerStrike(p, s.enemies, e.attack, onPlat);
      ev.push({ kind: 'strike', attack: e.attack, hits });
      for (const h of hits) if (h.killed) ev.push({ kind: 'kill', enemy: h.target });
    } else if (e.type === 'attackEnd') ev.push({ kind: 'attackEnd' });
  }

  stepEnemies(s, ev, dt, onPlat);

  // --- Cofres.
  for (const c of s.chests) {
    if (c.opened || !p.grounded) continue;
    if (Math.hypot(p.x - c.x, p.z - c.z) > CHEST_RADIUS) continue;
    if (!s.layout.guardsDead(s, c)) { say(s, ev, 'El cofre está custodiado', 'guard', 3); continue; }
    c.opened = true;
    const got = C.openChest(s.unlocked, s.inv, c.def);
    ev.push({ kind: 'chest', chest: c, items: got });
    say(s, ev, 'Cofre: ' + (got.join(', ') || 'vacío'));
  }

  // --- Portal final (solo en el camino de barrancos).
  let reached = false;
  if (s.layout.portal) {
    const alive = s.enemies.filter(e => !e.dead).length;
    if (alive > 0 && p.z < s.gateZ) {
      p.z = s.gateZ;
      say(s, ev, 'El portal está sellado: derrota a los enemigos', 'sealed', 3);
    }
    reached = alive === 0 && p.best >= course.gaps && p.z <= s.gateZ - 1.1;
    if (reached) { s.victory = true; ev.push({ kind: 'victory' }); }
  }
  refreshObjective(s, reached);
  return ev;
}

function aimAtNearest(s) {
  const p = s.player;
  let best = null, bd = 3.6;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) p.facing = Math.atan2(best.x - p.x, best.z - p.z);
}

function stepEnemies(s, ev, dt, onPlat) {
  const p = s.player;
  const wasDead = p.dead;
  for (const e of s.enemies) {
    const plat = s.layout.area(e);
    for (const x of C.stepEnemy(e, p, plat, dt)) {
      if (x.type !== 'enemyStrike') continue;
      const before = p.hitstun;
      const r = C.resolveEnemyStrike(e, p, { defense: s.stats.defense, blockFrac: s.stats.blockFrac });
      ev.push({ kind: 'enemyStrike', enemy: e, result: r });
      if (r && !r.blocked && p.hitstun > before) ev.push({ kind: 'hurt' });
    }
  }
  C.separate(s.enemies, onPlat);
  if (!wasDead && p.dead) {
    s.deaths++; s.respawnT = RESPAWN_TIME;
    ev.push({ kind: 'death' });
  }
}
