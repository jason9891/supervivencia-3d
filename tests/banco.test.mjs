import * as B from '../banco.js';
import * as C from '../combat.js';
const dt = 1 / 60;
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK   ' : 'FALLA ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };

const fresh = (kind = 'paja', dist = 1.5) => {
  const b = B.createBanco();
  B.syncPlayer(b, { x: 0, y: 0, z: 0, facing: 0 }); // mirando hacia +Z
  B.placeDummy(b, kind, 0, dist, 0);
  return b;
};
// Pulsa ATACAR y avanza hasta que termina el golpe. Devuelve todos los eventos.
const swing = (b, f, side) => {
  const ev = [];
  const r = B.pressAttack(b, f, side);
  const dur = b.fighter.attack ? b.fighter.attack.dur : 0;
  for (let t = 0; t < Math.ceil((dur + 0.02) / dt); t++) ev.push(...B.update(b, dt));
  return { started: r.started, ev };
};
const hitOf = ev => ev.find(e => e.type === 'hit');

// 1) Equipo
{
  const b = B.createBanco();
  const ids = Object.keys(C.WEAPONS), seq = [b.equip.weapon]; for (let i = 0; i < ids.length; i++) seq.push(B.cycle(b, 'weapon'));
  check('cambiar arma recorre todas las armas y vuelve a la espada', seq.join(',') === [...ids, 'espada'].join(',') && ids.length >= 12, `(${seq.join(' → ')})`);
  check('pick equipa un arma concreta, la cambia en el combatiente y rechaza ids falsos', B.pick(b, 'weapon', 'lanza') && b.fighter.weapon.id === 'lanza' && !B.pick(b, 'weapon', 'lanzallamas') && b.equip.weapon === 'lanza');
  check('espada_veterano (Tripo) se equipa y comparte golpes, combos y peso con la espada', B.pick(b, 'weapon', 'espada_veterano') && b.fighter.weapon.id === 'espada_veterano' && b.fighter.weapon.attacks === C.WEAPONS.espada.attacks && b.fighter.weapon.combos === C.WEAPONS.espada.combos && b.fighter.weapon.weight === C.WEAPONS.espada.weight && b.fighter.weapon.name === 'Espada del veterano');
  B.pick(b, 'weapon', 'espada');
  check('el combatiente usa el arma equipada', b.fighter.weapon.id === 'espada');
  const d = B.describeWeapon(b);
  check('describe golpes y combos del arma', d.attacks.length === 3 && d.combos.length >= 1 && d.combos[0].name === 'Cruz y estocada', `(${d.name}: ${d.combos.map(c => c.name).join(', ')})`);
  check('todas las armaduras disponibles para probar', b.unlocked.pechera.includes('placas') && b.unlocked.escudo.includes('torre'));
}
// 2) Golpe simple contra muñeco de paja
{
  const b = fresh();
  const r = swing(b, 0, 0);
  const h = hitOf(r.ev);
  check('golpe alto (quieto) impacta al muñeco', r.started && h && h.result.damage === 15, `(daño ${h?.result.damage})`);
  check('el muñeco pierde vida', b.dummies[0].hp === 150 - 15);
}
// 3) Muñeco fuera de alcance / a la espalda
{
  const b = fresh('paja', 5);
  const r = swing(b, 0, 0);
  check('fuera de alcance: falla', !hitOf(r.ev) && r.ev.some(e => e.type === 'miss'));
  const c = B.createBanco(); B.syncPlayer(c, { x: 0, y: 0, z: 0, facing: 0 }); B.placeDummy(c, 'paja', 0, -1.5, 0);
  check('a la espalda: falla', !hitOf(swing(c, 0, 0).ev));
}
// 4) Combo de la espada: lado → lado → adelante
{
  const b = fresh(); const names = [];
  const s1 = swing(b, 0, 1), s2 = swing(b, 0, 1), s3 = swing(b, 1, 0);
  const combo = s3.ev.find(e => e.type === 'combo');
  check('3 golpes encadenados activan "Cruz y estocada"', combo && combo.name === 'Cruz y estocada' && combo.mult === 2.0);
  check('el primer y segundo golpe no son combo', !s1.ev.some(e => e.type === 'combo') && !s2.ev.some(e => e.type === 'combo'));
  const h = hitOf(s3.ev);
  check('el combo hace mucho más daño que el golpe suelto', h.result.damage === Math.round(16 * 2.0 * 1.2), `(estocada con combo: ${h.result.damage} vs 16 suelta)`);
  check('el combo cuenta en las estadísticas', b.stats.combos === 1 && b.stats.last.combo === 'Cruz y estocada');
}
// 5) Si pasa demasiado tiempo la cadena se pierde
{
  const b = fresh();
  swing(b, 0, 1); swing(b, 0, 1);
  for (let i = 0; i < 60; i++) B.update(b, dt);       // 1 s de espera > ventana de combo
  const s3 = swing(b, 1, 0);
  check('esperar rompe el combo', !s3.ev.some(e => e.type === 'combo'));
}
// 6) Armas distintas
{
  const dmg = {};
  for (const w of ['espada', 'hacha', 'maza']) {
    const b = fresh(); while (b.equip.weapon !== w) B.cycle(b, 'weapon');
    dmg[w] = hitOf(swing(b, 0, 0).ev).result.damage;
  }
  check('maza > hacha > espada en golpe alto', dmg.maza > dmg.hacha && dmg.hacha > dmg.espada, JSON.stringify(dmg));
  const m = fresh(); while (m.equip.weapon !== 'maza') B.cycle(m, 'weapon');
  swing(m, 0, 0);
  check('el martillazo de la maza aturde', m.dummies[0].hitstun > 0 || m.dummies[0].hp < 150);
}
// 7) Muñeco blindado reduce el daño
{
  const a = fresh('paja'), z = fresh('blindado');
  const da = hitOf(swing(a, 0, 0).ev).result.damage, dz = hitOf(swing(z, 0, 0).ev).result.damage;
  check('el muñeco blindado recibe menos daño', dz < da, `(paja ${da}, blindado ${dz})`);
}
// 8) Armadura del jugador
{
  const b = B.createBanco();
  const sinNada = B.currentStats(b);
  for (const [slot, id] of [['casco', 'placas'], ['pechera', 'placas'], ['grebas', 'placas'], ['escudo', 'torre']]) while (b.equip[slot] !== id) B.cycle(b, slot);
  const full = B.currentStats(b);
  check('más armadura = más defensa y más peso', full.defense > sinNada.defense && full.weight > sinNada.weight, `(defensa ${sinNada.defense}→${full.defense}, peso ${sinNada.weight}→${full.weight})`);
  check('más peso = menos velocidad', full.speedMul < sinNada.speedMul, `(×${sinNada.speedMul.toFixed(2)} → ×${full.speedMul.toFixed(2)})`);
  const light = B.createBanco(); const heavy = B.createBanco();
  for (const [slot, id] of [['casco', 'placas'], ['pechera', 'placas'], ['grebas', 'placas'], ['escudo', 'torre']]) while (heavy.equip[slot] !== id) B.cycle(heavy, slot);
  const tl = B.testHit(light), th = B.testHit(heavy);
  check('el golpe de prueba duele menos con armadura pesada', th.taken < tl.taken, `(20 → ${tl.taken} ligera, ${th.taken} pesada)`);
  check('el golpe de prueba descuenta vida', light.fighter.hp === 100 - tl.taken);
}
// 9) Pociones
{
  const b = fresh(); B.testHit(b); B.testHit(b);
  const hpBefore = b.fighter.hp;
  const r = B.usePotion(b, 'vida');
  check('poción de vida cura y se gasta', r.ok && b.fighter.hp > hpBefore && b.potions.vida === 2, `(${hpBefore} → ${b.fighter.hp})`);
  const r2 = B.usePotion(b, 'vida');
  check('no se pueden beber dos pociones seguidas (enfriamiento)', !r2.ok && b.potions.vida === 2);
  for (let i = 0; i < 60; i++) B.update(b, dt);
  b.fighter.stamina = 10;
  const r3 = B.usePotion(b, 'energia');
  check('poción de energía recupera energía', r3.ok && b.fighter.stamina >= 80);
  for (let i = 0; i < 60; i++) B.update(b, dt);
  const before = hitOf(swing(fresh(), 0, 0).ev).result.damage;
  const f = fresh(); const rf = B.usePotion(f, 'furia');
  const after = hitOf(swing(f, 0, 0).ev).result.damage;
  check('poción de furia sube el daño', rf.ok && after > before, `(${before} → ${after})`);
  const full = B.createBanco();
  check('con la vida completa no se gasta la poción de vida', !B.usePotion(full, 'vida').ok && full.potions.vida === 3);
  B.refillPotions(b);
  check('recargar pociones', b.potions.vida === 3 && b.potions.furia === 2);
}
// 10) Energía
{
  const b = fresh(); b.fighter.stamina = 5;
  const r = B.pressAttack(b, 0, 0);
  check('sin energía no se puede atacar', !r.started);
  const c = fresh(); swing(c, 0, 0);
  const low = c.fighter.stamina;
  for (let i = 0; i < 90; i++) B.update(c, dt);
  check('la energía se recupera tras atacar', c.fighter.stamina > low, `(${low.toFixed(0)} → ${c.fighter.stamina.toFixed(0)})`);
}
// 11) Derrotar y reaparecer muñeco
{
  const b = fresh(); while (b.equip.weapon !== 'maza') B.cycle(b, 'weapon');
  let down = false, guard = 0;
  while (!down && guard++ < 40) {
    b.fighter.stamina = 100;
    for (const e of swing(b, 0, 0).ev) if (e.type === 'dummyDown') down = true;
    for (let i = 0; i < 40; i++) for (const e of B.update(b, dt)) if (e.type === 'dummyDown') down = true;
  }
  check('el muñeco se puede derrotar', down && b.dummies[0].dead && b.stats.kills === 1);
  let back = false;
  for (let i = 0; i < 200; i++) for (const e of B.update(b, dt)) if (e.type === 'dummyBack') back = true;
  check('el muñeco reaparece con la vida completa', back && !b.dummies[0].dead && b.dummies[0].hp === b.dummies[0].maxHp);
}
// 12) El muñeco se cura si lo dejas en paz
{
  const b = fresh(); swing(b, 0, 0);
  const hp = b.dummies[0].hp;
  for (let i = 0; i < 60 * 8; i++) B.update(b, dt);
  check('el muñeco recupera vida con el tiempo', b.dummies[0].hp > hp);
}
// 13) Restablecer
{
  const b = fresh(); B.testHit(b); B.testHit(b); swing(b, 0, 0);
  B.restore(b);
  check('restablecer deja vida y energía completas', b.fighter.hp === b.fighter.maxHp && b.fighter.stamina === C.MAX_STAMINA && b.dummies[0].hp === b.dummies[0].maxHp);
  const d = B.createBanco(); d.fighter.hp = 5; B.testHit(d, 99); check('el jugador de pruebas puede caer a 0', d.fighter.dead); B.restore(d); check('restablecer lo revive', !d.fighter.dead && d.fighter.hp === 100);
}
console.log(fails ? `\n${fails} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS PASARON');
process.exit(fails ? 1 : 0);
