/* pasto/pasto.js — «semilla de pasto»: césped 3D con hojas finas y curvadas, viento realista y todas sus opciones.
 *
 *  crearPasto(cfg, rect, altura)   siembra pasto en el rectángulo {x0,x1,z0,z1}; altura(x,z) = y del suelo → { root, anim, dispose, cuchillas }
 *  PASTO_PARAMS / PASTO_DEF         lista de opciones (nombre, rango, valor por defecto)
 *  normalizarPasto(c)               completa una configuración (acepta las claves antiguas d, h, s, tono)
 *  formularioPasto(cfg, onChange)   panel con deslizadores para editar las opciones (DOM)
 *  registrarPasto()                 añade el objeto «semilla_pasto» (parche de pasto con todas las opciones) al catálogo
 *
 * El viento mueve cada hoja en proporción a SU altura (el pasto corto casi no se mueve; el alto ondula) y en una dirección
 * común, con ráfagas que viajan por el terreno. La misma semilla (`sem`) da siempre el mismo pasto.
 */
import * as THREE from 'three';
import { rng, CATALOGO, HUELLA, ETIQUETAS } from '../objetos.js';

export const PASTO_PARAMS = [
  { g: 'Tamaño',   k: 'tam',     n: 'Alto de la hoja (m)',            min: .04, max: 2,    step: .01, def: .4 },
  { g: 'Tamaño',   k: 'var',     n: 'Variación de alto (%)',          min: 0,   max: 90,   step: 1,   def: 35 },
  { g: 'Tamaño',   k: 'hoja',    n: 'Grosor de la hoja (cm)',         min: .8,  max: 10,   step: .1,  def: 3 },
  { g: 'Tamaño',   k: 'arqueo',  n: 'Arqueo (hojas dobladas)',        min: 0,   max: 1,    step: .05, def: .55 },
  { g: 'Tamaño',   k: 'lean',    n: 'Inclinación al azar (°)',        min: 0,   max: 45,   step: 1,   def: 12 },
  { g: 'Densidad', k: 'dens',    n: 'Densidad (hojas por m²)',        min: 10,  max: 1500, step: 10,  def: 350 },
  { g: 'Densidad', k: 'suave',   n: 'Borde suave (m)',                min: 0,   max: 3,    step: .05, def: .3 },
  { g: 'Viento',   k: 'viento',  n: 'Fuerza del viento',              min: 0,   max: 2,    step: .05, def: .6 },
  { g: 'Viento',   k: 'vel',     n: 'Velocidad del viento',           min: 0,   max: 4,    step: .05, def: 1.1 },
  { g: 'Viento',   k: 'dir',     n: 'Dirección del viento (°)',       min: 0,   max: 360,  step: 5,   def: 40 },
  { g: 'Viento',   k: 'turb',    n: 'Turbulencia (ráfagas)',          min: 0,   max: 1,    step: .05, def: .5 },
  { g: 'Color',    k: 'matiz',   n: 'Color (matiz °: 40 seco · 95 verde)', min: 20, max: 160, step: 1, def: 92 },
  { g: 'Color',    k: 'clar',    n: 'Claridad',                       min: .12, max: .7,   step: .01, def: .3 },
  { g: 'Color',    k: 'seco',    n: 'Hojas secas (0–1)',              min: 0,   max: 1,    step: .02, def: .08 },
  { g: 'Color',    k: 'brillo',  n: 'Brillo',                         min: .5,  max: 2.5,  step: .05, def: 1.1 },
  { g: 'Sendero',  k: 'camino',  n: 'Ancho del sendero (m, 0 = sin)', min: 0,   max: 8,    step: .1,  def: 0 },
  { g: 'Sendero',  k: 'crece',   n: 'Crece hacia los lados (0–1)',    min: 0,   max: 1,    step: .05, def: .8 },
  { g: 'Semilla',  k: 'sem',     n: 'Semilla (otra distribución)',    min: 1,   max: 999,  step: 1,   def: 1 },
];
export const PASTO_DEF = Object.fromEntries(PASTO_PARAMS.map(p => [p.k, p.def]));

export function normalizarPasto(c = {}) {
  const o = Object.assign({}, PASTO_DEF);
  const viejo = { d: 'dens', h: 'tam', s: 'sem' };
  for (const k in c) { const kk = viejo[k] || k; if (kk in PASTO_DEF && isFinite(+c[k])) o[kk] = +c[k]; }
  if (c.tono === 'seco' && !('matiz' in c)) { o.matiz = 42; o.clar = .4; o.seco = .5; }
  // límites
  PASTO_PARAMS.forEach(p => { o[p.k] = Math.min(p.max, Math.max(p.min, o[p.k])); });
  return o;
}

/* ---------- hoja: tira afilada con 3 tramos, curvada, más oscura en la base ---------- */
function geoHoja(arqueo) {
  const filas = [[0, .5], [1 / 3, .44], [2 / 3, .3], [1, 0]], pos = [], col = [], nor = [];
  filas.forEach(([t, hw]) => {
    const z = arqueo * .45 * t * t, sombra = .38 + .62 * Math.pow(t, .8), n = new THREE.Vector3(0, 1, .35 + arqueo * .4).normalize();
    (hw > 0 ? [-hw, hw] : [0]).forEach(x => { pos.push(x, t, z); col.push(sombra, sombra, sombra); nor.push(n.x, n.y, n.z); });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6]);
  return g;
}

const MAX_HOJAS = 150000;

export function crearPasto(cfgIn, rect, altura = () => 0, opc = {}) {
  const c = normalizarPasto(cfgIn), R = rng(Math.round(c.sem * 211) + 5), { x0, x1, z0, z1 } = rect, margen = opc.margen || 0;
  const w = Math.max(.01, x1 - x0 - 2 * margen), d = Math.max(.01, z1 - z0 - 2 * margen);
  const n = Math.min(MAX_HOJAS, Math.max(1, Math.round(w * d * c.dens)));
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, eje = opc.ejeCamino || (w >= d ? 'x' : 'z'), semi = (eje === 'x' ? d : w) / 2;

  const uni = { uTime: { value: 0 }, uViento: { value: c.viento }, uVel: { value: c.vel }, uTurb: { value: c.turb }, uDir: { value: new THREE.Vector2(Math.cos(c.dir * Math.PI / 180), Math.sin(c.dir * Math.PI / 180)) } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .95, metalness: 0 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uViento;\nuniform float uVel;\nuniform float uTurb;\nuniform vec2 uDir;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 ip = vec3( instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2] );
          float hh = length( instanceMatrix[1].xyz );          // alto real de esta hoja
          float tt = position.y;                               // 0 base … 1 punta
          float bend = tt * tt;
          float ph = dot( ip.xz, uDir ) * 0.4;                 // la ráfaga viaja en la dirección del viento
          float w1 = sin( uTime * uVel + ph );
          float w2 = sin( uTime * uVel * 2.1 + ip.x * 1.9 + ip.z * 1.4 ) * uTurb * 0.5;
          float w3 = sin( uTime * uVel * 0.37 + ph * 0.25 ) * 0.6;
          float g = ( w1 * 0.6 + w2 + w3 + 0.6 ) * uViento;
          float disp = g * hh * bend * 0.3;                    // proporcional al alto: la hoja corta casi no se mueve
          mvPosition.xz += uDir * disp + vec2( -uDir.y, uDir.x ) * disp * 0.25 * sin( uTime * uVel * 1.3 + ip.z );
          mvPosition.y -= abs( disp ) * bend * 0.4;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  const geo = geoHoja(c.arqueo), im = new THREE.InstancedMesh(geo, mat, n), dm = new THREE.Object3D(), col = new THREE.Color();
  dm.rotation.order = 'YXZ';
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let k = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + margen + R() * w, z = z0 + margen + R() * d;
    const borde = Math.min(x - x0, x1 - x, z - z0, z1 - z);
    if (c.suave > 0 && R() > smooth(0, c.suave, borde) * .97 + .03) continue;
    let f = 1;
    if (c.camino > 0) {
      const dist = Math.abs(eje === 'x' ? z - cz : x - cx) - c.camino / 2;
      if (dist < 0) { if (R() > .04) continue; f = .3; }
      else f = 1 - c.crece * .75 * (1 - smooth(0, Math.max(1, semi * .5), dist));
    }
    const h = c.tam * f * (1 + (c.var / 100) * (R() * 2 - 1));
    const ancho = c.hoja / 100 * (.75 + .5 * R()) * Math.pow(Math.max(.3, h / c.tam), .3);
    dm.position.set(x, altura(x, z) - .01, z);
    dm.rotation.set(R() * c.lean * Math.PI / 180, R() * 6.2832, (R() - .5) * c.lean * Math.PI / 90);
    dm.scale.set(ancho, h, h); dm.updateMatrix(); im.setMatrixAt(k, dm.matrix);
    const seca = R() < c.seco, t = R();
    seca ? col.setHSL((38 + t * 14) / 360, .45, .42 + t * .12, THREE.SRGBColorSpace) : col.setHSL((c.matiz + (t - .5) * 22) / 360, .5 + .15 * t, c.clar * (.8 + .5 * t), THREE.SRGBColorSpace);
    col.multiplyScalar(c.brillo); im.setColorAt(k, col); k++;
  }
  im.count = Math.max(1, k);
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.receiveShadow = true;
  const root = new THREE.Group(); root.name = 'pasto'; root.add(im);
  return { root, cuchillas: k, anim: (t) => { uni.uTime.value = t === undefined ? performance.now() / 1000 : t; }, dispose: () => { geo.dispose(); mat.dispose(); im.dispose(); } };
}

/* ---------- panel de opciones (DOM) ---------- */
export function formularioPasto(cfgIn, onChange, opc = {}) {
  let cfg = normalizarPasto(cfgIn);
  const raiz = document.createElement('div'); raiz.style.cssText = 'display:flex;flex-direction:column;gap:8px;font:12px system-ui,sans-serif;color:inherit';
  const grupos = [...new Set(PASTO_PARAMS.map(p => p.g))];
  const emit = () => onChange(Object.assign({}, cfg));
  const filas = {};
  grupos.forEach(g => {
    const box = document.createElement('div'); box.innerHTML = `<div style="font-weight:600;color:#e8c37a;margin:4px 0">${g}</div>`;
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:minmax(150px,1.2fr) 2fr 62px;gap:4px 8px;align-items:center';
    PASTO_PARAMS.filter(p => p.g === g).forEach(p => {
      const l = document.createElement('label'); l.textContent = p.n;
      const r = document.createElement('input'); r.type = 'range'; r.min = p.min; r.max = p.max; r.step = p.step; r.value = cfg[p.k]; r.style.width = '100%';
      const nIn = document.createElement('input'); nIn.type = 'number'; nIn.min = p.min; nIn.max = p.max; nIn.step = p.step; nIn.value = +(+cfg[p.k]).toFixed(3); nIn.style.width = '62px';
      const set = (v) => { v = Math.min(p.max, Math.max(p.min, parseFloat(v))); if (!isFinite(v)) return; cfg[p.k] = v; r.value = v; nIn.value = +v.toFixed(3); emit(); };
      r.oninput = () => set(r.value); nIn.onchange = () => set(nIn.value);
      filas[p.k] = { r, nIn }; grid.append(l, r, nIn);
    });
    box.appendChild(grid); raiz.appendChild(box);
  });
  const barra = document.createElement('div'); barra.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const dado = document.createElement('button'); dado.textContent = '🎲 Otra semilla';
  dado.onclick = () => { const v = 1 + Math.floor(Math.random() * 998); cfg.sem = v; filas.sem.r.value = v; filas.sem.nIn.value = v; emit(); };
  const rest = document.createElement('button'); rest.textContent = '↺ Valores de fábrica';
  rest.onclick = () => { cfg = normalizarPasto({}); PASTO_PARAMS.forEach(p => { filas[p.k].r.value = cfg[p.k]; filas[p.k].nIn.value = cfg[p.k]; }); emit(); };
  barra.append(dado, rest); raiz.appendChild(barra);
  return raiz;
}

/* ---------- objeto de catálogo: parche de pasto con todas las opciones ---------- */
function parche(p) {
  const w = p.w, d = p.d, cfg = {}; PASTO_PARAMS.forEach(q => { cfg[q.k] = p[q.k]; });
  const g = crearPasto(cfg, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, () => 0);
  return { root: g.root, anim: g.anim, anchor: null };
}
export function registrarPasto() {
  const params = { w: [.5, 60, 6, .5], d: [.5, 60, 6, .5] };
  PASTO_PARAMS.forEach(q => { params[q.k] = [q.min, q.max, q.def, q.step]; });
  CATALOGO.semilla_pasto = { nombre: 'Semilla de pasto (parche)', f: parche, params, grupo: 'pasto' };
  HUELLA.semilla_pasto = p => [p.w, p.d];
  PASTO_PARAMS.forEach(q => { ETIQUETAS[q.k] = q.n; });
}
