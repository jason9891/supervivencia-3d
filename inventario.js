// inventario.js — inventario del jugador: armas, armaduras, pociones, llaves y objetos.
// No depende de three.js, del mapa ni del personaje: se puede probar con Node sin navegador.
// El mapa solo le "avisa" con banderas (llave, nota, comida) y el inventario las convierte en objetos.
import * as C from './combat.js';

export const SAVE_KEY = 'supervivencia3d.inventario.v1';
export const START_POTIONS = { vida: 3, energia: 3, furia: 2 }; // para el modo pruebas

// Objetos que no son armas, armaduras ni pociones.
//   kind 'llave' / 'nota' : se conservan y se muestran; 'consumible' : se puede usar.
export const ITEMS = {
  llave_consejero: { name: 'Llave del consejero', kind: 'llave', desc: 'Abre la puerta de la torre.' },
  nota_consejero:  { name: 'Notas del consejero', kind: 'nota',  desc: 'Páginas halladas en el camino de entrada.' },
  comida:          { name: 'Comida del establo',  kind: 'consumible', heal: 25, desc: 'Recupera algo de vida.' },
};

// Banderas que avisa el mapa → objeto que se otorga la primera vez que se activan.
export const FLAG_ITEMS = { llave: 'llave_consejero', nota: 'nota_consejero', comida: 'comida' };

function allUnlocked() {
  const u = { weapon: Object.keys(C.WEAPONS) };
  for (const slot of C.SLOTS) u[slot] = Object.keys(C.ARMOR[slot]);
  return u;
}
const clone = o => JSON.parse(JSON.stringify(o));

// testMode: todo desbloqueado para probar armas y armaduras (aún no hay cofres en el castillo).
export function createInventory({ testMode = true } = {}) {
  const inv = {
    equip: C.defaultEquipment(),
    unlocked: testMode ? allUnlocked() : C.defaultUnlocked(),
    potions: testMode ? { ...START_POTIONS } : C.defaultPotions(),
    items: {},        // objetos conseguidos con give(): se guardan
    mapItems: {},     // objetos que otorgó el mapa (llave, notas, comida): solo esta partida, porque el mapa se reinicia al recargar
    granted: {},      // banderas del mapa ya convertidas en objetos
    testMode,
    real: testMode ? { unlocked: C.defaultUnlocked() } : null, // lo que de verdad tienes mientras pruebas
  };
  return inv;
}

// Si la pieza equipada ya no está disponible, pasa a la primera que sí lo está.
function fixEquip(inv) {
  for (const slot of ['weapon', ...C.SLOTS]) {
    if (!inv.unlocked[slot].includes(inv.equip[slot])) inv.equip[slot] = inv.unlocked[slot][0];
  }
}

// Activa o desactiva el modo pruebas sin perder lo que ya habías conseguido.
export function setTestMode(inv, on) {
  if (on === inv.testMode) return inv.testMode;
  if (on) {
    inv.real = { unlocked: clone(inv.unlocked) };
    inv.unlocked = allUnlocked();
  } else {
    inv.unlocked = inv.real ? inv.real.unlocked : C.defaultUnlocked();
    inv.real = null;
    fixEquip(inv);
  }
  inv.testMode = on;
  return on;
}

// Entrega botín con la misma forma que los cofres de combat.js:
//   { weapon:['hacha'], armor:{ casco:['malla'] }, potions:{ vida:2 }, items:{ comida:1 } }
// Mientras el modo pruebas está activo, lo conseguido se guarda aparte y se conserva al salir.
export function give(inv, loot) {
  const target = inv.testMode && inv.real ? inv.real.unlocked : inv.unlocked;
  const got = C.openChest(target, inv.potions, { weapon: loot.weapon, armor: loot.armor, potions: loot.potions });
  for (const [id, n] of Object.entries(loot.items || {})) {
    if (!ITEMS[id]) continue;
    inv.items[id] = (inv.items[id] || 0) + n;
    got.push(n > 1 ? n + ' × ' + ITEMS[id].name : ITEMS[id].name);
  }
  return got;
}

// El mapa dice qué banderas están activas, p. ej. { llave: true, nota: false, comida: true }.
// Cada bandera otorga su objeto una sola vez, aunque después lo gastes. Devuelve los nombres nuevos.
export function syncFlags(inv, flags) {
  const got = [];
  for (const [flag, itemId] of Object.entries(FLAG_ITEMS)) {
    if (flags && flags[flag] && !inv.granted[flag]) {
      inv.granted[flag] = true;
      inv.mapItems[itemId] = (inv.mapItems[itemId] || 0) + 1;
      got.push(ITEMS[itemId].name);
    }
  }
  return got;
}

const countOf = (inv, id) => (inv.items[id] || 0) + (inv.mapItems[id] || 0);
export function hasItem(inv, id) { return countOf(inv, id) > 0; }

// Objetos que tienes, con su descripción, listos para mostrar.
export function listItems(inv) {
  return Object.keys(ITEMS).filter(id => countOf(inv, id) > 0)
    .map(id => ({ id, count: countOf(inv, id), ...ITEMS[id] }));
}

// Gasta un consumible. `fighter` es el combatiente del jugador (vida y energía).
export function useItem(inv, fighter, id) {
  const it = ITEMS[id];
  if (!it || it.kind !== 'consumible') return { ok: false, msg: '' };
  if (!hasItem(inv, id)) return { ok: false, msg: 'No tienes ' + (it ? it.name.toLowerCase() : id) };
  if (fighter.dead) return { ok: false, msg: '' };
  if (it.heal) {
    if (fighter.hp >= fighter.maxHp) return { ok: false, msg: 'Salud completa' };
    fighter.hp = Math.min(fighter.maxHp, fighter.hp + it.heal);
  }
  if (inv.mapItems[id] > 0) inv.mapItems[id]--; else inv.items[id]--;
  return { ok: true, msg: it.name };
}

export function refillPotions(inv) { Object.assign(inv.potions, START_POTIONS); }

// --- Guardado (por navegador) ----------------------------------------------------
// `storage` es cualquier objeto con getItem/setItem (p. ej. localStorage). Todo va en try/catch:
// en modo privado o con datos bloqueados el inventario sigue funcionando sin guardar.
export function serialize(inv) {
  return JSON.stringify({
    v: 1, equip: inv.equip, unlocked: inv.unlocked, potions: inv.potions,
    items: inv.items, testMode: inv.testMode, real: inv.real,
  });
}

export function save(inv, storage) {
  if (!storage) return false;
  try { storage.setItem(SAVE_KEY, serialize(inv)); return true; } catch { return false; }
}

// Carga lo guardado sobre un inventario nuevo. Valida todo: datos raros se ignoran.
export function load(storage, fallback = {}) {
  const inv = createInventory(fallback);
  let data = null;
  try { data = storage ? JSON.parse(storage.getItem(SAVE_KEY) || 'null') : null; } catch { data = null; }
  if (!data || data.v !== 1) return inv;
  const okSlot = (slot, id) => slot === 'weapon' ? id in C.WEAPONS : id in C.ARMOR[slot];
  const cleanUnlocked = u => {
    const out = {};
    for (const slot of ['weapon', ...C.SLOTS]) {
      const list = Array.isArray(u && u[slot]) ? u[slot].filter(id => okSlot(slot, id)) : [];
      out[slot] = list.length ? list : [C.defaultUnlocked()[slot][0]];
    }
    return out;
  };
  inv.unlocked = cleanUnlocked(data.unlocked);
  inv.real = data.real ? { unlocked: cleanUnlocked(data.real.unlocked) } : null;
  inv.testMode = !!data.testMode;
  for (const slot of ['weapon', ...C.SLOTS]) {
    const id = data.equip && data.equip[slot];
    if (typeof id === 'string' && okSlot(slot, id)) inv.equip[slot] = id;
  }
  fixEquip(inv);
  for (const k of Object.keys(inv.potions)) {
    const n = data.potions && data.potions[k];
    if (Number.isInteger(n) && n >= 0 && n < 100) inv.potions[k] = n;
  }
  inv.items = {};
  for (const id of Object.keys(ITEMS)) {
    const n = data.items && data.items[id];
    if (Number.isInteger(n) && n > 0 && n < 100) inv.items[id] = n;
  }
  // mapItems y granted no se guardan: el mapa vuelve a empezar al recargar la página.
  return inv;
}
