import * as A from '../arena.js';
import * as B from '../banco.js';
import * as C from '../combat.js';
let fails = 0; const check = (n, ok, extra = '') => { console.log((ok ? 'OK   ' : 'FALLA ') + n + (ok ? '' : '  ' + extra)); if (!ok) fails++; };
const mk = () => { const b = B.createBanco(); Object.assign(b.fighter, { x: 0, z: 0, y: 0, facing: 0 }); const a = A.createArena(); return { b, a }; };
const run = (a, b, secs, dt = 1 / 60, onPlat) => { const evs = []; for (let t = 0; t < secs; t += dt) { B.syncPlayer(b, b.fighter); evs.push(...A.update(a, b, dt, onPlat)); } return evs; };

// Aparecer y sincronizar con el banco
{
  const { b, a } = mk(); const s = A.spawn(a, 'soldado', 0, 6);
  A.update(a, b, 0.016);
  check('el enemigo entra en bench.dummies con y y nombre (el addon los usa)', b.dummies.includes(s) && s.y === 0 && s.name === 'Soldado caído' && s.ai);
  A.update(a, b, 0.016);
  check('no se duplica al actualizar', b.dummies.filter(d => d === s).length === 1);
  B.placeDummy(b, 'paja', 0, 3);
  check('colocar un muñeco no borra a los enemigos y el muñeco va primero', b.dummies.length === 2 && !b.dummies[0].ai && b.dummies[1] === s);
  B.clearDummies(b);
  check('quitar el muñeco deja a los enemigos', b.dummies.length === 1 && b.dummies[0] === s);
}

// Persigue, prepara el golpe y golpea
{
  const { b, a } = mk(); const s = A.spawn(a, 'soldado', 0, 6);
  const evs = run(a, b, 6);
  const states = evs.filter(e => e.type === 'state').map(e => e.to);
  check('pasa por perseguir → preparar golpe → recuperar', states.includes('chase') && states.includes('windup') && states.includes('recover'), states.join('>'));
  const hit = evs.find(e => e.type === 'playerHit');
  check('el golpe daña al jugador según su armadura', !!hit && hit.result.damage > 0 && b.fighter.hp < b.fighter.maxHp && hit.result.damage <= 9, JSON.stringify(hit?.result?.damage));
  check('el enemigo no se queda encima del jugador (se detiene a su alcance)', Math.hypot(s.x, s.z) > 1.0 && Math.hypot(s.x, s.z) < 2.2, `(${Math.hypot(s.x, s.z).toFixed(2)})`);
}
// Fuera de aggro no hace nada
{
  const { b, a } = mk(); const s = A.spawn(a, 'guardian', 0, 30);
  run(a, b, 3);
  check('fuera de su radio de aviso el enemigo se queda quieto', s.state === 'idle' && s.z === 30);
}
// Bloquear reduce el daño; saltar lo esquiva
{
  const damageWith = (setup) => { const { b, a } = mk(); A.spawn(a, 'soldado', 0, 1.5); setup(b); const evs = run(a, b, 2.2); return { evs, hp: b.fighter.hp, b }; };
  const free = damageWith(() => { });
  const blocked = damageWith(b => { C.setBlocking(b.fighter, true); });
  check('sin guardia el golpe entra', free.evs.some(e => e.type === 'playerHit' && !e.result.blocked) && free.hp < 100);
  check('con guardia el golpe de frente se bloquea y hace menos daño', blocked.evs.some(e => e.type === 'playerHit' && e.result.blocked) && blocked.hp > free.hp, `(${blocked.hp} vs ${free.hp})`);
  const jump = damageWith(b => { b.fighter.y = 1.2; });
  check('estar en el aire esquiva el golpe', jump.evs.some(e => e.type === 'enemyMiss') && jump.hp === 100);
}
// El jugador golpea al enemigo (misma vía que los muñecos)
{
  const { b, a } = mk(); const s = A.spawn(a, 'soldado', 0, 1.6); s.state = 'idle';
  A.update(a, b, 0.016);
  b.fighter.facing = 0; C.tryAttack(b.fighter, 'forward');
  let hit = null; for (let t = 0; t < 1.2 && !hit; t += 1 / 60) { B.syncPlayer(b, b.fighter); const ev = B.update(b, 1 / 60); hit = ev.find(e => e.type === 'hit'); }
  check('un golpe del jugador alcanza al enemigo y lo daña', !!hit && hit.dummy === s && s.hp < s.maxHp);
  check('el golpe lo aturde (estado hurt) y la IA lo respeta', (A.update(a, b, 0.016), s.state === 'hurt'));
}
// Morir, quedarse en el suelo y reaparecer
{
  const { b, a } = mk(); b.fighter.x = -40; b.fighter.z = -40; const s = A.spawn(a, 'soldado', 5, 5);
  s.hp = 0; s.dead = true;
  const e1 = run(a, b, 0.2);
  check('al morir avisa una sola vez', e1.filter(e => e.type === 'enemyDown').length === 1 && s.state === 'dead');
  B.update(b, 3);
  check('banco.update no lo regenera ni lo revive (tiene su propio reloj)', s.dead && s.hp === 0);
  const e2 = run(a, b, A.RESPAWN + 0.5);
  check(`reaparece en su puesto tras ${A.RESPAWN} s con la vida llena`, e2.some(e => e.type === 'enemyBack') && !s.dead && s.hp === s.maxHp && s.x === 5 && s.state !== 'dead');
  s.hp = 0; s.dead = true; A.update(a, b, 0.1); B.restore(b);
  check('Restablecer también revive y reinicia a los enemigos', !s.dead && s.state === 'idle');
}
// Jugador muerto: los enemigos paran
{
  const { b, a } = mk(); const s = A.spawn(a, 'soldado', 0, 3); b.fighter.dead = true;
  run(a, b, 2); check('si el jugador cae, el enemigo vuelve a reposo', s.state === 'idle');
}
// Animaciones
{
  const has = () => true; const mkE = (kind, state) => ({ kind, state, def: C.ENEMIES[kind], t: 0 });
  check('reposo → idle', A.pick(mkE('soldado', 'idle'), has).name === 'idle loop');
  const w = A.pick(mkE('guardian', 'chase'), has);
  check('el guardián (1.1 m/s) camina más lento que el paso de referencia', w.name === 'walk loop' && w.rate < 1 && w.rate > 0.5);
  const atk = A.pick(mkE('guardian', 'windup'), has);
  check('preparar el golpe frena el clip para que el impacto coincida con el final de la preparación', atk.name === 'sword regular c' && atk.once && Math.abs(atk.rate - 0.65 / C.ENEMIES.guardian.windup) < 1e-9);
  check('windup y recover comparten clave (el clip no se reinicia)', A.pick(mkE('soldado', 'windup'), has).key === A.pick(mkE('soldado', 'recover'), has).key);
  check('golpeado → hit chest una vez; muerto → death01 una vez', A.pick(mkE('soldado', 'hurt'), has).name === 'hit chest' && A.pick(mkE('soldado', 'dead'), has).name === 'death01' && A.pick(mkE('soldado', 'dead'), has).once);
  const few = n => n === 'idle loop';
  check('sin clips cae a idle sin romper', ['chase', 'windup', 'hurt', 'dead'].every(s => A.pick(mkE('soldado', s), few).name === 'idle loop'));
  const e = mkE('soldado', 'windup'); e.t = e.def.windup * 0.5;
  check('windupProgress va de 0 a 1 solo durante la preparación', Math.abs(A.windupProgress(e) - 0.5) < 1e-9 && A.windupProgress(mkE('soldado', 'chase')) === 0);
}
// Todos los enemigos y armas del aspecto existen
for (const [k, L] of Object.entries(A.LOOKS)) {
  check(`aspecto de ${k}: enemigo, arma y armadura existen en combat.js`, !!C.ENEMIES[k] && !!C.WEAPONS[L.weapon] && Object.entries(L.equip).every(([slot, id]) => id in C.ARMOR[slot]));
}
console.log(fails ? 'HAY FALLAS' : 'TODAS LAS PRUEBAS PASARON'); process.exit(fails ? 1 : 0);
