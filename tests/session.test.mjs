import { buildCourse, createPlayer } from '../course.js';
import * as C from '../combat.js';
import { createSession, stepSession, equipSlot, RESPAWN_TIME } from '../session.js';

const dt = 1 / 60;
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK   ' : 'FALLA ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };
const fresh = () => { const course = buildCourse(); const p = createPlayer(course); const s = createSession(course, p); return { course, p, s }; };
const segC = (course, i) => (course.segments[i].a + course.segments[i].b) / 2;
const teleport = (p, x, z) => { p.x = x; p.z = z; p.y = 0; p.vy = 0; p.grounded = true; };
const idle = { f: 0, side: 0, speed: 1.8 };
const run = (s, n, input = idle, evs = []) => { for (let i = 0; i < n; i++) evs.push(...stepSession(s, input, dt)); return evs; };

// 1) Estado inicial
{
  const { s } = fresh();
  check('6 enemigos, 4 cofres y objetivo inicial', s.enemies.length === 6 && s.chests.length === 4 && s.objective.stage === 0, `(${s.objective.text})`);
  check('equipo inicial: espada, jubón y grebas de cuero, 1 poción de vida y 1 de energía', s.eq.weapon === 'espada' && s.eq.pechera === 'cuero' && s.inv.vida === 1 && s.inv.energia === 1);
}
// 2) Combate: un jugador atacando mata a un soldado
{
  const { course, p, s } = fresh();
  const e = s.enemies[0]; teleport(p, e.x, e.z + 1.6); p.facing = Math.PI;
  const evs = []; let killed = false, t = 0;
  while (t < 20 && !killed) {
    const input = { f: 0, side: 0, speed: 1.8, attack: (!p.attack || p.attack.t >= p.attack.hit) && !p.hitstun };
    stepSession(s, input, dt).forEach(x => { evs.push(x); if (x.kind === 'kill') killed = true; });
    t += dt;
    if (p.dead) break;
  }
  check('atacando se derrota a un soldado', killed && e.dead, `(${t.toFixed(1)} s, vida jugador ${Math.round(p.hp)})`);
  check('los golpes gastan energía y emiten eventos de impacto', evs.some(x => x.kind === 'strike' && x.hits.length) && evs.some(x => x.kind === 'attackStart'));
}
// 3) Combos por arma (secuencia lado, lado, adelante = "Cruz y estocada")
{
  const { p, s } = fresh(); const names = [];
  teleport(p, 0, -1); // lejos de enemigos
  const seq = [{ side: 1, f: 0 }, { side: 1, f: 0 }, { side: 0, f: 1 }]; let k = 0;
  for (let t = 0; t < 900 && k < seq.length; t++) {
    p.stamina = 100;
    const ready = !p.attack || p.attack.t >= p.attack.hit;
    const dir = seq[k];
    const hadBuf = p.buffered, hadAtk = p.attack;
    const evs = stepSession(s, { f: dir.f, side: dir.side, speed: 1.8, attack: ready && !p.buffered }, dt);
    if (!hadBuf && p.buffered) k++;                                   // golpe en cola
    else if (!hadAtk && evs.some(x => x.kind === 'attackStart')) k++; // golpe iniciado
    for (const x of evs) if (x.kind === 'attackStart' && x.attack.combo) names.push(x.attack.combo.name);
  }
  // Dejar terminar la cadena y capturar el combo cuando arranca el último golpe.
  for (let t = 0; t < 300; t++) {
    p.stamina = 100;
    for (const x of stepSession(s, idle, dt)) if (x.kind === 'attackStart' && x.attack.combo) names.push(x.attack.combo.name);
    if (p.attack && p.attack.combo) names.push(p.attack.combo.name);
  }
  check('lado→lado→adelante activa "Cruz y estocada"', names.includes('Cruz y estocada'), `(combos: ${[...new Set(names)].join(',') || '-'})`);
}
// 4) Bloqueo y armadura reducen el daño recibido
{
  const hitWith = (setup) => {
    const { p, s } = fresh(); setup(s, p);
    const e = s.enemies[0]; teleport(p, e.x, e.z + 1.2); p.facing = Math.PI; // el soldado mira al jugador
    let dmg = null, t = 0;
    while (t < 8 && dmg === null) {
      const evs = stepSession(s, { f: 0, side: 0, speed: 1.8, block: s.__block }, dt);
      for (const x of evs) if (x.kind === 'enemyStrike' && x.result) dmg = x.result.damage;
      t += dt;
    }
    return dmg;
  };
  const base = hitWith((s) => { s.eq.pechera = 'ninguna'; s.eq.grebas = 'ninguna'; });
  const armored = hitWith((s) => { s.eq.pechera = 'placas'; s.eq.casco = 'placas'; s.eq.grebas = 'placas'; });
  const blocked = hitWith((s) => { s.eq.pechera = 'ninguna'; s.eq.grebas = 'ninguna'; s.__block = true; });
  check('la armadura de placas reduce el daño', armored < base, `(${base} → ${armored})`);
  check('bloquear reduce el daño', blocked < base, `(${base} → ${blocked})`);
}
// 5) Pesos: más equipo = más lento y menos recuperación de energía
{
  const light = C.computeStats({ weapon: 'espada', casco: 'ninguno', pechera: 'ninguna', grebas: 'ninguna', escudo: 'ninguno' });
  const heavy = C.computeStats({ weapon: 'maza', casco: 'placas', pechera: 'placas', grebas: 'placas', escudo: 'torre' });
  check('equipo pesado: más defensa, menos velocidad y menos recuperación', heavy.defense > light.defense && heavy.speedMul < light.speedMul && heavy.regenMul < light.regenMul, `(vel ${light.speedMul.toFixed(2)}→${heavy.speedMul.toFixed(2)})`);
}
// 6) Pociones
{
  const { p, s } = fresh(); p.hp = 40; p.stamina = 10;
  const evs = run(s, 1, { ...idle, potion: 'vida' });
  check('poción de vida cura 45', Math.round(p.hp) === 85 && s.inv.vida === 0 && evs.some(x => x.kind === 'potion'));
  run(s, 60);
  run(s, 1, { ...idle, potion: 'energia' });
  check('poción de energía restaura energía', p.stamina > 70 && s.inv.energia === 0, `(${Math.round(p.stamina)})`);
  s.inv.furia = 1; run(s, 60); run(s, 1, { ...idle, potion: 'furia' });
  check('poción de furia activa el bonus', p.fury > 0);
}
// 7) Cofres: custodiados mientras queden enemigos; al abrirlos se desbloquea equipo
{
  const { course, p, s } = fresh();
  const c1 = s.chests[0]; teleport(p, c1.x, c1.z);
  const evs = run(s, 2);
  check('cofre de la plataforma 1 se abre (sin custodia)', c1.opened && evs.some(x => x.kind === 'chest') && s.unlocked.weapon.includes('hacha') && s.unlocked.casco.includes('cuero'), `(${evs.find(x => x.kind === 'chest')?.items.join(', ')})`);
  check('puedes equipar el hacha desbloqueada', equipSlot(s, 'weapon', 1) === 'Hacha' && p.weapon.id === 'hacha');
  const c2 = s.chests[1]; teleport(p, c2.x, c2.z);
  const ev2 = run(s, 2);
  check('cofre con enemigo vivo en su plataforma está custodiado', !c2.opened && ev2.some(x => x.kind === 'msg' && /custodiado/.test(x.text)));
  s.enemies.filter(e => e.seg === c2.seg).forEach(e => { e.dead = true; e.hp = 0; });
  run(s, 2);
  check('al derrotar a los guardianes el cofre se abre', c2.opened && s.unlocked.pechera.includes('malla'));
}
// 8) Muerte y reaparición
{
  const { course, p, s } = fresh(); const e = s.enemies[0]; teleport(p, e.x, e.z + 1.2); p.facing = Math.PI;
  p.hp = 1;
  let died = false, t = 0;
  while (t < 8 && !died) { for (const x of stepSession(s, idle, dt)) if (x.kind === 'death') died = true; t += dt; }
  check('un golpe con 1 de vida mata al jugador', died && p.dead && s.deaths === 1);
  const evs = run(s, Math.ceil((RESPAWN_TIME + 0.2) / dt));
  const expectZ = course.segments[1].a - 1.5; // la plataforma 2 tiene un soldado vivo: se vuelve a la 1
  check('reaparece al inicio de la plataforma anterior sin enemigos, con la vida completa', evs.some(x => x.kind === 'respawn') && !p.dead && p.hp === p.maxHp && Math.abs(p.z - expectZ) < 0.5, `(z=${p.z.toFixed(1)}, esperado ${expectZ.toFixed(1)})`);
}
// 9) Portal sellado y victoria
{
  const { course, p, s } = fresh(); const last = course.segments.length - 1;
  p.best = last; teleport(p, 0, course.segments[last].b + 1.0);
  const ev1 = run(s, 2);
  check('con enemigos vivos el portal está sellado', !s.victory && p.z >= s.gateZ - 1e-6 && ev1.some(x => x.kind === 'msg' && /sellado/.test(x.text)));
  s.enemies.forEach(e => { e.dead = true; e.hp = 0; });
  teleport(p, 0, s.gateZ - 1.3);
  const ev2 = run(s, 2);
  check('sin enemigos se cruza el portal y se gana', s.victory && ev2.some(x => x.kind === 'victory') && s.objective.stage === 3, `(${s.objective.text})`);
}
// 10) Objetivo por etapas
{
  const { course, p, s } = fresh();
  check('etapa 0: cruzar barrancos', s.objective.stage === 0);
  p.best = course.gaps; run(s, 1);
  check('etapa 1: derrotar enemigos', s.objective.stage === 1, `(${s.objective.text})`);
  s.enemies.forEach(e => { e.dead = true; }); run(s, 1);
  check('etapa 2: cruzar el portal', s.objective.stage === 2, `(${s.objective.text})`);
}
console.log(fails ? `\n${fails} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS PASARON');
process.exit(fails ? 1 : 0);
