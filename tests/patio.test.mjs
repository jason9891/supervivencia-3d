// Combate en el patio del castillo: enemigos, cofres custodiados, equipo y objetivo.
import * as C from '../combat.js';
import { createPlayer } from '../course.js';
import { createSession, stepSession, equipSlot } from '../session.js';
import { castleCourse, patioLayout, patioWalkable, SPAWN } from '../layout-patio.js';

const dt = 1 / 60;
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK   ' : 'FALLA ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };

function fresh() {
  const course = castleCourse();
  const player = createPlayer(course);
  player.x = SPAWN.x; player.z = SPAWN.z; player.checkpoint = { x: SPAWN.x, z: SPAWN.z };
  return createSession(course, player, patioLayout());
}
const idle = { f: 0, side: 0, speed: 1.8 };

// 1) Estado inicial
{
  const s = fresh();
  check('3 enemigos y 4 cofres en el patio', s.enemies.length === 3 && s.chests.length === 4);
  check('todos los enemigos y cofres están sobre suelo transitable',
    s.enemies.every(e => patioWalkable(e.x, e.z)) && s.chests.every(c => patioWalkable(c.x, c.z)));
  check('objetivo inicial: derrotar a los enemigos', /derrota a los enemigos 0\/3/.test(s.objective.text), `(${s.objective.text})`);
  check('sin portal: no hay victoria por portal', !s.layout.portal && !s.victory);
  check('el jugador es soportado por el suelo (sin caer) lejos del eje X=0',
    (() => { s.player.x = 12; s.player.z = 0; for (let i = 0; i < 60; i++) stepSession(s, idle, dt); return s.player.grounded && s.player.y === 0 && s.player.falls === 0; })());
}

// 2) Cofres custodiados
{
  const s = fresh();
  const A = s.chests[0], D = s.chests[3];
  s.player.x = A.x; s.player.z = A.z;
  stepSession(s, idle, dt);
  check('el cofre A está custodiado mientras vive su soldado', !A.opened);
  s.enemies[0].dead = true;
  stepSession(s, idle, dt);
  check('al caer su soldado, el cofre A se abre (hacha, casco de cuero, vidas)', A.opened && s.unlocked.weapon.includes('hacha') && s.inv.vida === 3);
  s.player.x = D.x; s.player.z = D.z;
  stepSession(s, idle, dt);
  check('el cofre D (placas) sigue custodiado por el guardián', !D.opened);
  s.enemies[2].dead = true;
  stepSession(s, idle, dt);
  check('al caer el guardián, el cofre D se abre con la armadura de placas', D.opened && s.unlocked.pechera.includes('placas') && s.unlocked.escudo.includes('escudo'));
}

// 3) Muerte y reaparición en el spawn
{
  const s = fresh();
  s.player.x = -9; s.player.z = -1; s.player.hp = 0; s.player.dead = true; s.respawnT = 0.01;
  for (let i = 0; i < 5; i++) stepSession(s, idle, dt);
  check('reaparece en el punto de inicio del patio con la vida completa',
    !s.player.dead && Math.abs(s.player.x - SPAWN.x) < 1e-9 && Math.abs(s.player.z - SPAWN.z) < 1e-9 && s.player.hp === s.player.maxHp);
}

// 4) Jugador simulado: limpia el patio, abre cofres y se equipa
{
  const s = fresh();
  const seq = ['side', 'side', 'forward'];
  let t = 0, step = 0, cd = 0;
  const bestGear = () => {
    for (const slot of ['casco', 'pechera', 'grebas', 'escudo']) {
      const table = C.ARMOR[slot]; let g = 0;
      while (g++ < 6) {
        const ids = Object.keys(table).filter(id => s.unlocked[slot].includes(id));
        const top = ids.reduce((a, b) => (table[b].defense > table[a].defense ? b : a));
        if (s.eq[slot] === top) break;
        equipSlot(s, slot, 1);
      }
    }
  };
  let openedBefore = 0;
  while (t < 400 && s.objective.stage < 2) {
    t += dt; cd = Math.max(0, cd - dt);
    const p = s.player;
    const input = { f: 0, side: 0, speed: 1.8, running: false, attack: false, block: false, potion: null };
    if (!p.dead) {
      if (p.hp < 45 && s.inv.vida > 0) input.potion = 'vida';
      const foes = s.enemies.filter(e => !e.dead);
      const near = foes.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      const chest = s.chests.find(c => !c.opened && c.guards.every(e => e.dead));
      const goTo = (x, z) => { const dx = x - p.x, dz = z - p.z; input.f = dz < -0.25 ? 1 : dz > 0.25 ? -1 : 0; input.side = dx > 0.25 ? 1 : dx < -0.25 ? -1 : 0; };
      if (chest) goTo(chest.x, chest.z);
      else if (near) {
        const dist = Math.hypot(near.x - p.x, near.z - p.z);
        if (near.state === 'windup' && dist < near.def.reach + 1.2 && !p.attack) input.block = true;
        if (dist > 1.9) goTo(near.x, near.z);
        else if (!input.block && cd <= 0 && p.hitstun <= 0 && p.stamina >= 14 && !(near.state === 'windup' && near.t > near.def.windup * 0.45)) {
          const type = seq[step++ % seq.length];
          input.attack = true; input.f = type === 'forward' ? 1 : 0; input.side = type === 'side' ? 1 : 0;
          cd = step % seq.length === 0 ? 0.95 : 0.62;
        }
      }
    }
    stepSession(s, input, dt);
    const opened = s.chests.filter(c => c.opened).length;
    if (opened > openedBefore) { openedBefore = opened; bestGear(); }
  }
  check('el jugador simulado despeja el patio y abre los 4 cofres', s.objective.stage === 2 && s.chests.every(c => c.opened),
    `(${t.toFixed(0)} s, muertes ${s.deaths}, defensa ${s.stats.defense}, peso ${s.stats.weight})`);
  check('el objetivo final se muestra', /COMPLETADO/.test(s.objective.text), `(${s.objective.text})`);
}

console.log(fails ? `\n${fails} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS PASARON');
process.exit(fails ? 1 : 0);
