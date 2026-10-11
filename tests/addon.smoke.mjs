// Prueba de humo del addon con DOM y three simulados (sin navegador).
import { createCombatAddon } from '../combat-addon.js';
import * as I from '../inventario.js';
let fails = 0; const check = (n, ok) => { console.log((ok ? 'OK   ' : 'FALLA ') + n); if (!ok) fails++; };

const mkEl = tag => ({ tag, id: '', className: '', style: {}, dataset: {}, children: [], _l: {}, textContent: '', _html: '',
  set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
  appendChild(c) { this.children.push(c); return c; }, remove() {}, closest() { return null; },
  addEventListener(t, f) { (this._l[t] ||= []).push(f); } });
const body = mkEl('body');
globalThis.document = { createElement: mkEl, body, head: mkEl('head') };
const winL = {}; globalThis.addEventListener = (t, f) => (winL[t] ||= []).push(f);
globalThis.innerWidth = 800; globalThis.innerHeight = 600;
const Obj = class { constructor() { this.position = { set() {}, x: 0, y: 0, z: 0 }; this.rotation = {}; this.children = []; }
  add(c) { this.children.push(c); } set() { return this; } project() { return this; } };
const THREE = { Group: Obj, Mesh: Obj, Vector3: Obj, MeshStandardMaterial: Obj, CylinderGeometry: Obj, BoxGeometry: Obj, SphereGeometry: Obj };
const scene = { add() {}, remove() {} };
const store = {}; const storage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
const flags = { llave: false, nota: false, comida: false };
const player = { x: 0, y: 0, z: 0, facing: Math.PI };
let swings = 0;

const a = createCombatAddon({ THREE, scene, camera: { }, player, onSwing: () => swings++, getFlags: () => flags, storage });
a.update(0.016);
check('sin banderas no hay objetos', I.listItems(a.inventory).length === 0);
flags.llave = true; flags.comida = true; a.update(0.016);
check('llave y comida del mapa llegan al inventario', I.hasItem(a.inventory, 'llave_consejero') && I.hasItem(a.inventory, 'comida'));
check('el mapa guarda sus objetos solo en sesión', !JSON.parse(store[I.SAVE_KEY] || '{"items":{}}').items.llave_consejero);
a.setPanel(true);
check('el panel muestra OBJETOS con la llave', body.children.some(c => /Llave del consejero/.test(c._html)));
check('el panel muestra el botón de modo pruebas', body.children.some(c => /data-act="testmode"/.test(c._html)));
check('con el panel abierto no se ataca', a.pressAttack(1, 0) === false);
a.setPanel(false);
check('atacar inicia golpe y avisa a la animación', a.pressAttack(1, 0) === true && swings === 1);
a.bench.fighter.hp = 40; 
const r = I.useItem(a.inventory, a.bench.fighter, 'comida');
check('comer cura y gasta el objeto', r.ok && a.bench.fighter.hp === 65 && !I.hasItem(a.inventory, 'comida'));
a.give({ weapon: ['hacha'], items: { comida: 1 } });
check('give guarda lo conseguido', JSON.parse(store[I.SAVE_KEY]).items.comida === 1);
// Recarga de página: el inventario se conserva (menos lo del mapa) y el mapa vuelve a dar la llave una vez.
const b = createCombatAddon({ THREE, scene, camera: {}, player, getFlags: () => flags, storage });
check('al recargar se conserva lo conseguido', b.inventory.items.comida === 1);
b.update(0.016);
check('al recargar el mapa vuelve a entregar la llave', I.hasItem(b.inventory, 'llave_consejero'));
// Sin storage (modo privado)
const c = createCombatAddon({ THREE, scene, camera: {}, player, storage: null });
c.update(0.016); check('funciona sin localStorage', true);
// Sin getFlags
check('funciona sin getFlags', (() => { try { c.update(0.016); return true; } catch { return false; } })());
console.log(fails ? 'HAY FALLAS' : 'TODAS LAS PRUEBAS PASARON'); process.exit(fails ? 1 : 0);
