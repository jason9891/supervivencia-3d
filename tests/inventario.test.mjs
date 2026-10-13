import * as I from '../inventario.js';
import * as B from '../banco.js';
import * as C from '../combat.js';
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'OK   ' : 'FALLA ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };
const fakeStorage = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, raw: m }; };

// 1) Modo pruebas (por defecto) y modo real
{
  const t = I.createInventory();
  check('modo pruebas: todas las armas y armaduras disponibles', t.testMode && t.unlocked.weapon.length === Object.keys(C.WEAPONS).length && t.unlocked.pechera.includes('placas') && t.unlocked.escudo.includes('torre'));
  check('modo pruebas: pociones de prueba', t.potions.vida === 3 && t.potions.energia === 3 && t.potions.furia === 2);
  const r = I.createInventory({ testMode: false });
  check('modo real: solo espada y armadura ligera', r.unlocked.weapon.join() === 'espada' && r.unlocked.pechera.join() === 'ninguna,cuero' && r.unlocked.casco.join() === 'ninguno');
  check('modo real: 1 poción de vida y 1 de energía', r.potions.vida === 1 && r.potions.energia === 1 && r.potions.furia === 0);
}
// 2) Conseguir objetos
{
  const inv = I.createInventory({ testMode: false });
  const b = B.createBanco(inv);
  check('sin hacha, cambiar de arma no cambia nada', B.cycle(b, 'weapon') === 'espada');
  const got = I.give(inv, { weapon: ['hacha'], armor: { casco: ['cuero'] }, potions: { vida: 2 }, items: { comida: 1 } });
  check('conseguir botín informa los nombres', got.includes('Hacha') && got.includes('Casco de cuero') && got.some(g => g.includes('Poción de vida')) && got.includes('Comida del establo'), `(${got.join(', ')})`);
  check('ahora se puede equipar el hacha', B.cycle(b, 'weapon') === 'hacha');
  check('el casco de cuero queda disponible', B.cycle(b, 'casco') === 'cuero');
  check('las pociones se suman', inv.potions.vida === 3);
  check('conseguir lo mismo otra vez no duplica piezas', I.give(inv, { weapon: ['hacha'] }).length === 0 && inv.unlocked.weapon.filter(w => w === 'hacha').length === 1);
}
// 3) Modo pruebas sin perder lo conseguido
{
  const inv = I.createInventory({ testMode: false });
  I.give(inv, { weapon: ['hacha'] });
  I.setTestMode(inv, true);
  check('al activar pruebas aparece todo', inv.unlocked.weapon.length === Object.keys(C.WEAPONS).length);
  inv.equip.weapon = 'maza';
  I.give(inv, { armor: { pechera: ['malla'] } });           // se consigue estando en modo pruebas
  I.setTestMode(inv, false);
  check('al salir se conserva lo conseguido de verdad', inv.unlocked.weapon.includes('hacha') && inv.unlocked.pechera.includes('malla'));
  check('al salir se pierde lo que era solo de prueba', !inv.unlocked.weapon.includes('maza') && !inv.unlocked.pechera.includes('placas'));
  check('el arma equipada vuelve a una que sí tienes', inv.unlocked.weapon.includes(inv.equip.weapon), `(${inv.equip.weapon})`);
}
// 4) Objetos del mapa: llave, notas, comida
{
  const inv = I.createInventory({ testMode: false });
  check('al inicio no hay objetos', I.listItems(inv).length === 0);
  let got = I.syncFlags(inv, { llave: true, nota: false, comida: false });
  check('la llave del mapa aparece en el inventario', got.join() === 'Llave del consejero' && I.hasItem(inv, 'llave_consejero'));
  check('la misma bandera no la otorga dos veces', I.syncFlags(inv, { llave: true }).length === 0 && I.listItems(inv).find(i => i.id === 'llave_consejero').count === 1);
  got = I.syncFlags(inv, { llave: true, nota: true, comida: true });
  check('notas y comida se agregan al activarse', got.length === 2 && I.listItems(inv).map(i => i.id).sort().join() === 'comida,llave_consejero,nota_consejero');
  const f = C.createFighter(); f.hp = 50;
  const r = I.useItem(inv, f, 'comida');
  check('la comida cura y se gasta', r.ok && f.hp === 75 && !I.hasItem(inv, 'comida'), `(vida ${f.hp})`);
  check('gastada la comida, la bandera no la devuelve', I.syncFlags(inv, { comida: true }).length === 0 && !I.hasItem(inv, 'comida'));
  check('la llave no se puede "usar"', !I.useItem(inv, f, 'llave_consejero').ok && I.hasItem(inv, 'llave_consejero'));
  const g = I.createInventory({ testMode: false }); I.syncFlags(g, { comida: true });
  const full = C.createFighter();
  check('con la vida completa no se gasta la comida', !I.useItem(g, full, 'comida').ok && I.hasItem(g, 'comida'));
}
// 5) Guardado y carga
{
  const st = fakeStorage();
  const a = I.createInventory({ testMode: false });
  I.give(a, { weapon: ['maza'], armor: { escudo: ['rodela'] }, potions: { furia: 1 } });
  I.syncFlags(a, { llave: true, comida: true });
  I.give(a, { items: { comida: 1 } });
  a.equip.weapon = 'maza'; a.equip.escudo = 'rodela';
  check('guardar funciona', I.save(a, st) === true);
  const b = I.load(st);
  check('al cargar vuelve el equipo', b.equip.weapon === 'maza' && b.equip.escudo === 'rodela' && !b.testMode);
  check('al cargar vuelven piezas, pociones y objetos conseguidos', b.unlocked.weapon.includes('maza') && b.potions.furia === 1 && b.items.comida === 1);
  check('los objetos del mapa NO se guardan (el mapa se reinicia al recargar)', !I.hasItem(b, 'llave_consejero') && I.listItems(b).length === 1);
  check('al recargar, el mapa vuelve a entregar su llave una sola vez', I.syncFlags(b, { llave: true }).length === 1 && I.syncFlags(b, { llave: true }).length === 0);
  const t = I.createInventory(); I.give(t, { weapon: ['hacha'] }); I.save(t, st);
  const t2 = I.load(st);
  I.setTestMode(t2, false);
  check('el modo pruebas y lo conseguido de verdad sobreviven al guardado', t2.unlocked.weapon.includes('hacha') && !t2.unlocked.weapon.includes('maza'));
}
// 6) Guardado dañado o imposible
{
  const bad = fakeStorage(); bad.setItem(I.SAVE_KEY, '{no es json');
  const x = I.load(bad);
  check('guardado dañado: se usa el inventario inicial', x.testMode && x.unlocked.weapon.length === Object.keys(C.WEAPONS).length);
  const evil = fakeStorage(); evil.setItem(I.SAVE_KEY, JSON.stringify({ v: 1, equip: { weapon: 'lanzallamas', casco: 'oro' }, unlocked: { weapon: ['lanzallamas'] }, potions: { vida: -5, energia: 9999, furia: 'x' }, items: { espada_magica: 3, comida: 2 }, granted: { llave: 'sí' } }));
  const y = I.load(evil);
  check('datos raros se ignoran', y.equip.weapon === 'espada' && y.equip.casco === 'ninguno' && y.potions.vida === 3 && y.potions.energia === 3 && !('espada_magica' in y.items) && y.items.comida === 2 && !y.granted.llave);
  const boom = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  check('sin almacenamiento no falla', I.save(I.createInventory(), boom) === false && I.load(boom).testMode === true);
  check('sin almacenamiento (null) tampoco', I.save(I.createInventory(), null) === false && I.load(null).unlocked.weapon.length === Object.keys(C.WEAPONS).length);
}
// 7) El banco de pruebas usa el mismo inventario
{
  const inv = I.createInventory({ testMode: false });
  const b = B.createBanco(inv);
  B.testHit(b); B.testHit(b);
  const r = B.usePotion(b, 'vida');
  check('beber desde el banco gasta del inventario', r.ok && inv.potions.vida === 0);
  inv.potions.vida = 0;
  check('sin pociones no se puede beber', !B.usePotion(b, 'vida').ok);
  I.syncFlags(inv, { comida: true });
  B.testHit(b);                                  // la vida volvió a bajar
  for (let i = 0; i < 60; i++) B.update(b, 1 / 60);
  const hp = b.fighter.hp, u = B.useItem(b, 'comida');
  check('comer desde el banco cura al jugador', u.ok && b.fighter.hp > hp);
  B.refillPotions(b);
  check('recargar pociones afecta al inventario', inv.potions.vida === 3 && inv.potions.furia === 2);
}
console.log(fails ? `\n${fails} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS PASARON');
process.exit(fails ? 1 : 0);
