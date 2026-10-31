/* decorado.js — pone objetos, mecanismos, luces y muros de piedra sobre el plano del editor.
 *
 * El plano (mapa.json) NO se modifica. Todo lo que añades va en un archivo aparte, decorado.json:
 *
 *   {
 *     "variante": 0,                                   // madera: 0 roble oscuro, 1 pino claro, 2 gris
 *     "salas": {                                       // clave = id o nombre de la sala del editor
 *       "Patio Libre": { "semilla": 3, "pedidos": [ { "tipo": "puesto", "n": 3, "modo": "pared" } ] }
 *     },
 *     "objetos": [                                     // piezas sueltas con posición exacta
 *       { "id": "reja1", "tipo": "reja", "x": 40, "y": 7, "z": 12, "giro": 0, "params": { "w": 3 } }
 *     ],
 *     "enlaces": [                                     // palancas que accionan mecanismos
 *       { "palanca": "pal1", "acciona": [ { "id": "reja1", "on": "abrir", "off": "soltar" } ] }
 *     ],
 *     "piedras": { "tam": 0.9, "salas": ["Patio Libre"] }   // muros de piedra (sin "salas" = todos)
 *   En una sala: "techo": { "aguas": 0, "cubierta": 0, "alt": 2.2 }  pone un techo a la medida de la sala sobre sus muros
 *   (oculta la losa plana del editor); "sinTecho": true solo quita la losa.
 *   }
 *
 * Pedido: { tipo, n, modo: "pared" | "centro" | "esquina", params: { clave: número | [min,max] }, sillas }.
 * Los tipos disponibles están en CATALOGO (galeria_objetos.html los muestra todos).
 * "y" de un objeto suelto = altura del suelo de su sala (el editor la muestra como Y); se le suma el grosor de la losa.
 * Las puertas, las escaleras y los huecos del plano se respetan solos: nada se coloca encima.
 *
 * Uso:
 *   const root = construirMapa(scene, mapa);
 *   const dec = montarDecorado(scene, root, mapa, decorado);
 *   en el bucle:  dec.anim(tiempo, camera.position);
 *   al tocar:     dec.clic(raycaster)   // acciona palancas, rejas y puentes
 *   dec.info      // tabla: sala, tamaño, cuántos objetos entraron de los pedidos
 */
import * as THREE from 'three';
import { crearObjeto, poblar, setVariante } from './objetos.js';
import { registrarPro } from './objetos_pro.js';
import { registrarLote2 } from './objetos_lote2.js';
import { registrarLote3 } from './objetos_lote3.js';
import { registrarLote4 } from './objetos_lote4.js';
import { registrarLote5 } from './objetos_lote5.js';
import { cubrirMuros } from './piedras.js';

let listo = false;
export function registrarTodo() { if (listo) return; registrarPro(); registrarLote2(); registrarLote3(); registrarLote4(); registrarLote5(); listo = true; }

const rectDe = r => ({ x0: Math.min(r.x0, r.x1), x1: Math.max(r.x0, r.x1), z0: Math.min(r.z0, r.z1), z1: Math.max(r.z0, r.z1) });
const cruza = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const nombresDe = r => [r.id, r.nombre, r.name].filter(v => v !== undefined && v !== null && v !== '').map(String);

/* lista las salas del plano (para saber qué clave usar en decorado.json) */
export function listarSalas(json) {
  return (json.rooms || []).map(r => { const q = rectDe(r); return { id: r.id, nombre: r.nombre || r.name, tipo: r.type || 'sala', y: r.y, ancho: +(q.x1 - q.x0).toFixed(1), fondo: +(q.z1 - q.z0).toFixed(1) }; });
}

export function montarDecorado(scene, mapaRoot, json, dec = {}, opciones = {}) {
  registrarTodo();
  if (dec.variante !== undefined) setVariante(dec.variante);
  const root = new THREE.Group(); root.name = 'decorado'; scene.add(root);
  const salas = json.rooms || [], puertas = json.doors || [], huecos = json.holes || [];
  const animables = [], porId = {}, info = [], anclas = [], semillaBase = opciones.semilla || 0;

  /* ---------- salas pobladas por pedidos ---------- */
  for (const r of salas) {
    if ((r.type || 'sala') !== 'sala') continue;
    const cfg = dec.salas && nombresDe(r).map(k => dec.salas[k]).find(Boolean);
    if (!cfg || cfg.activo === false) continue;
    const q = rectDe(r);
    /* techo propio: se oculta la losa plana del editor y se pone un techo a su medida sobre los muros */
    if ((cfg.sinTecho || cfg.techo) && mapaRoot && mapaRoot.traverse) mapaRoot.traverse(m => { if (m.isMesh && m.userData && m.userData.superficie === 'techo' && m.userData.dueno === r.id) m.visible = false; });
    if (cfg.techo) {
      const t = crearObjeto('techo', Object.assign({ w: q.x1 - q.x0 + .4, d: q.z1 - q.z0 + .4 }, cfg.techo));
      t.root.position.set((q.x0 + q.x1) / 2, r.y2 != null ? r.y2 : (r.y || 0) + 3, (q.z0 + q.z1) / 2); root.add(t.root);
    }
    const sala = { x0: q.x0, x1: q.x1, z0: q.z0, z1: q.z1, y: r.y || 0 };
    const pu = puertas.filter(d => d.x >= q.x0 - .7 && d.x <= q.x1 + .7 && d.z >= q.z0 - .7 && d.z <= q.z1 + .7 && Math.abs((d.y || 0) - sala.y) < .8).map(d => ({ x: d.x, z: d.z, w: d.w || 1.5 }));
    const libres = (cfg.libres || []).slice();
    salas.forEach(o => { if (o === r || (o.type || 'sala') === 'sala') return; const b = rectDe(o); if (cruza(q, b) && Math.abs((o.y || 0) - sala.y) < 4) libres.push(b); });
    huecos.forEach(h => { if (h.x0 === undefined) return; const b = rectDe(h); if (cruza(q, b)) libres.push(b); });
    const pedidos = cfg.pedidos || [];
    const pob = poblar(sala, pedidos, { puertas: pu, libres, semilla: (cfg.semilla || 1) + semillaBase });
    root.add(pob.root); animables.push(pob.anim); pob.anclas.forEach(o => anclas.push(o.anchor));
    const pedido = pedidos.reduce((s, p) => s + (p.n || 1) + (p.sillas || 0) * (p.n || 1), 0);
    info.push({ sala: r.nombre || r.name || r.id, id: r.id, ancho: +(q.x1 - q.x0).toFixed(1), fondo: +(q.z1 - q.z0).toFixed(1), pedidos: pedido, colocados: pob.colocados.length, sinSitio: Math.max(0, pedido - pob.colocados.length) });
  }

  /* ---------- objetos sueltos ---------- */
  for (const d of (dec.objetos || [])) {
    if (d.activo === false) continue;
    const o = crearObjeto(d.tipo, d.params);
    o.root.position.set(d.x || 0, (d.y || 0) + .15 + (d.alto || 0), d.z || 0); o.root.rotation.y = (d.giro || 0) * Math.PI / 180;
    root.add(o.root); animables.push(o.anim); if (o.anchor) anclas.push(o.anchor); if (d.id) porId[d.id] = o;
  }
  for (const e of (dec.enlaces || [])) {
    const pal = porId[e.palanca]; if (!pal || !pal.conectar) continue;
    pal.conectar(on => (e.acciona || []).forEach(a => { const m = porId[a.id], f = m && m[on ? a.on : a.off]; if (f) f.call(m); }));
  }

  /* ---------- muros de piedra ---------- */
  let piedras = null;
  if (dec.piedras && mapaRoot) {
    const ids = (dec.piedras.salas && dec.piedras.salas.length) ? new Set(salas.filter(r => nombresDe(r).some(k => dec.piedras.salas.map(String).includes(k))).map(r => r.id)) : null;
    piedras = cubrirMuros(mapaRoot, Object.assign({}, dec.piedras, { filtro: ids ? (m => ids.has(m.userData.dueno)) : undefined }));
  }

  /* ---------- luces reales: solo las llamas más cercanas a la cámara ---------- */
  const nLuces = opciones.luces === undefined ? 4 : opciones.luces, luces = [], vp = new THREE.Vector3(), cp = new THREE.Vector3();
  for (let i = 0; i < nLuces; i++) { const l = new THREE.PointLight(0xff9a40, 6, 14, 2); l.visible = false; root.add(l); luces.push(l); }
  const dist = new Map();

  return {
    root, info, porId, piedras, anclas,
    anim(t, camPos) {
      animables.forEach(f => f(t));
      if (!nLuces || !anclas.length) return;
      const fl = 1 + .18 * Math.sin(t * 15) + .1 * Math.sin(t * 27);
      if (camPos) cp.copy(camPos); else cp.set(0, 0, 0);
      anclas.forEach(a => { a.getWorldPosition(vp); dist.set(a, vp.distanceToSquared(cp)); });
      const cerca = anclas.slice().sort((a, b) => dist.get(a) - dist.get(b)).slice(0, nLuces);
      luces.forEach((l, i) => { const a = cerca[i]; if (!a || dist.get(a) > 900) { l.visible = false; return; } l.visible = true; a.getWorldPosition(vp); l.position.copy(vp); l.intensity = 6 * fl; });
    },
    clic(raycaster) {
      const h = raycaster.intersectObject(root, true)[0]; if (!h) return null;
      let o = h.object; while (o && !(o.userData && o.userData.mecanismo)) o = o.parent;
      if (o) { o.userData.mecanismo.alternar(); return o.userData.mecanismo; }
      return null;
    },
    quitar() { scene.remove(root); if (piedras) piedras.quitar(); },
  };
}
