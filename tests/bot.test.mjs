// Jugador simulado: recorre todo el camino, abre cofres, se equipa, pelea y cruza el portal.
// Sirve para comprobar que el juego se puede ganar y para ver cuánto cuesta.
import * as C from '../combat.js';
import { buildCourse, createPlayer, WALK_SPEED, RUN_SPEED } from '../course.js';
import { createSession, stepSession, equipSlot } from '../session.js';

const dt = 1 / 60;

function bestGear(s) {
  for (const slot of ['casco', 'pechera', 'grebas', 'escudo']) {
    const table = C.ARMOR[slot];
    let guard = 0;
    while (guard++ < 6) {
      const ids = Object.keys(table).filter(id => s.unlocked[slot].includes(id));
      const top = ids.reduce((a, b) => (table[b].defense > table[a].defense ? b : a));
      if (s.eq[slot] === top) break;
      equipSlot(s, slot, 1);
    }
  }
}

export function playthrough({ gear = true, block = true, maxSeconds = 900 } = {}) {
  const course = buildCourse();
  const player = createPlayer(course);
  const s = createSession(course, player);
  let t = 0, comboStep = 0, attackCd = 0, kills = 0, chestsOpened = 0;
  const seq = ['side', 'side', 'forward'];
  while (t < maxSeconds && !s.victory) {
    t += dt; attackCd = Math.max(0, attackCd - dt);
    const p = s.player;
    const input = { f: 0, side: 0, speed: WALK_SPEED, running: false, jump: false, attack: false, block: false, potion: null };
    if (p.dead) { stepSession(s, input, dt); continue; }
    const seg = Math.max(0, Math.min(course.segments.length - 1, course.segments.findIndex(g => p.z <= g.a && p.z >= g.b)));
    const foes = s.enemies.filter(e => !e.dead && e.seg === seg);
    const foe = foes.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    // pociones
    if (p.hp < 45 && s.inv.vida > 0) input.potion = 'vida';
    else if (p.stamina < 12 && s.inv.energia > 0) input.potion = 'energia';
    else if (foe && foe.kind === 'guardian' && s.inv.furia > 0 && p.fury <= 0 && Math.hypot(foe.x - p.x, foe.z - p.z) < 4) input.potion = 'furia';

    if (foe && p.grounded) {
      const dx = foe.x - p.x, dz = foe.z - p.z, dist = Math.hypot(dx, dz);
      if (block && (foe.state === 'windup') && dist < foe.def.reach + 1.2 && !p.attack) input.block = true;
      if (dist > 1.9) {
        // acercarse
        input.f = dz < -0.3 ? 1 : dz > 0.3 ? -1 : 0;
        input.side = dx > 0.3 ? 1 : dx < -0.3 ? -1 : 0;
      } else if (!input.block && attackCd <= 0 && p.hitstun <= 0 && p.stamina >= 14 && !(foe.state === 'windup' && foe.t > foe.def.windup * 0.45)) {
        const type = seq[comboStep % seq.length];
        input.attack = true; input.f = type === 'forward' ? 1 : 0; input.side = type === 'side' ? 1 : 0;
        comboStep++; attackCd = 0.62;
        if (comboStep % seq.length === 0) attackCd = 0.95;
      }
    } else {
      // avanzar por el camino; abrir cofres cuando la plataforma está libre
      const chest = s.chests.find(c => c.seg === seg && !c.opened && !s.enemies.some(e => e.seg === seg && !e.dead));
      if (chest && p.grounded) {
        const dx = chest.x - p.x, dz = chest.z - p.z;
        input.f = dz < -0.2 ? 1 : dz > 0.2 ? -1 : 0; input.side = dx > 0.2 ? 1 : dx < -0.2 ? -1 : 0;
      } else {
        const segObj = course.segments[seg];
        input.f = 1; input.running = true; input.speed = RUN_SPEED;
        input.side = Math.abs(p.x) > 0.3 ? (p.x > 0 ? -1 : 1) : 0;
        if (p.grounded && p.z - segObj.b <= 0.1 && seg < course.segments.length - 1) input.jump = true;
        if (!p.grounded) { input.f = 1; input.running = true; input.speed = RUN_SPEED; }
      }
    }
    const before = s.chests.filter(c => c.opened).length;
    const evs = stepSession(s, input, dt);
    if (gear && s.chests.filter(c => c.opened).length > before) { chestsOpened++; bestGear(s); }
    for (const e of evs) if (e.kind === 'kill') kills++;
  }
  return { victory: s.victory, seconds: +t.toFixed(1), deaths: s.deaths, falls: s.player.falls, kills, chests: chestsOpened, defense: s.stats.defense, weight: s.stats.weight };
}

if (process.argv[1] && process.argv[1].endsWith('bot.test.mjs')) {
  let fails = 0;
  const check = (name, cond, extra = '') => { console.log((cond ? 'OK   ' : 'FALLA ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };
  const a = playthrough({ gear: true, block: true });
  check('el jugador simulado (equipado, con guardia) llega al portal', a.victory, JSON.stringify(a));
  const b = playthrough({ gear: false, block: false, maxSeconds: 600 });
  console.log('INFO sin cofres ni guardia:', JSON.stringify(b));
  check('con armadura pesada (peso alto) todavía se cruzan todos los barrancos', a.falls === 0, `(caídas: ${a.falls}, peso ${a.weight})`);
  console.log(fails ? `\n${fails} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS PASARON');
  process.exit(fails ? 1 : 0);
}
