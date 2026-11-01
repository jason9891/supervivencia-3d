/* texturas.js — cargador de texturas por catálogo y por tema (47 imágenes en tex/).
 *
 *   import { crearTexturas, TEMAS, MANIFIESTO } from './texturas.js';
 *   const tx = crearTexturas(THREE, { base: './tex/' });
 *
 *   // 1) por tema, directo sobre un plano del editor (el tema de cada sala sale de decorado.json):
 *   const root = construirMapa(scene, mapa, tx.opcionesDeMapa(mapa, decorado));
 *   // 2) un material suelto:
 *   tx.aplicar(material, 'muro_sillar', { ancho: 1, alto: 1 });   // repite cada `tile` metros (UV en metros, como mapa.js)
 *   // 3) calcomanías (grietas, sangre, estandartes...):
 *   const g = tx.crearCalcomania('decal_sangre'); tx.pegar(g, {x, y, z}, {x: 0, y: 0, z: 1}); scene.add(g);
 *
 * En decorado.json:  "temaDefecto": "castillo",  "salas": { "Patio Libre": { "tema": "mercado" } },
 *                    "muros": { "idDeUnMuroLibre": "ruinas" }
 * Funciona con Three r128 (encoding) y con las nuevas (colorSpace). Si una imagen no carga, el material
 * conserva el color base y se avisa una sola vez en la consola.
 */

/* tile = metros que cubre una repetición. w/h = tamaño en metros de una calcomanía. */
export const MANIFIESTO = {
  muro_sillar: { src: 'muro_sillar.jpg', tipo: 'repetida', tile: 3 },
  muro_castillo: { src: 'muro_castillo.jpg', tipo: 'repetida', tile: 4 },
  muro_mamposteria: { src: 'muro_mamposteria.jpg', tipo: 'repetida', tile: 3 },
  muro_ladrillo: { src: 'muro_ladrillo.jpg', tipo: 'repetida', tile: 2 },
  muro_adobe: { src: 'muro_adobe.jpg', tipo: 'repetida', tile: 3 },
  muro_madera: { src: 'muro_madera.jpg', tipo: 'repetida', tile: 2 },
  roca_cueva: { src: 'roca_cueva.jpg', tipo: 'repetida', tile: 5 },
  muro_musgo: { src: 'muro_musgo.jpg', tipo: 'repetida', tile: 3 },
  muro_ruina: { src: 'muro_ruina.jpg', tipo: 'repetida', tile: 3 },
  piso_adoquin: { src: 'piso_adoquin.jpg', tipo: 'repetida', tile: 2 },
  piso_losa: { src: 'piso_losa.jpg', tipo: 'repetida', tile: 3 },
  piso_tierra: { src: 'piso_tierra.jpg', tipo: 'repetida', tile: 3 },
  piso_tablas: { src: 'piso_tablas.jpg', tipo: 'repetida', tile: 2 },
  piso_paja: { src: 'piso_paja.jpg', tipo: 'repetida', tile: 2 },
  piso_pasto: { src: 'piso_pasto.jpg', tipo: 'repetida', tile: 2 },
  piso_barro: { src: 'piso_barro.jpg', tipo: 'repetida', tile: 3 },
  piso_damero: { src: 'piso_damero.jpg', tipo: 'repetida', tile: 4 },
  cubierta_teja: { src: 'cubierta_teja.jpg', tipo: 'repetida', tile: 1.5 },
  cubierta_pizarra: { src: 'cubierta_pizarra.jpg', tipo: 'repetida', tile: 1.5 },
  cubierta_paja: { src: 'cubierta_paja.jpg', tipo: 'repetida', tile: 2 },
  cubierta_tablillas: { src: 'cubierta_tablillas.jpg', tipo: 'repetida', tile: 1.5 },
  hierro: { src: 'hierro.jpg', tipo: 'repetida', tile: 1 },
  hierro_oxidado: { src: 'hierro_oxidado.jpg', tipo: 'repetida', tile: 1 },
  madera_oscura: { src: 'madera_oscura.jpg', tipo: 'repetida', tile: 1 },
  madera_clara: { src: 'madera_clara.jpg', tipo: 'repetida', tile: 1 },
  cuero: { src: 'cuero.jpg', tipo: 'repetida', tile: 0.5 },
  arpillera: { src: 'arpillera.jpg', tipo: 'repetida', tile: 0.5 },
  mimbre: { src: 'mimbre.jpg', tipo: 'repetida', tile: 0.5 },
  decal_sangre: { src: 'decal_sangre.png', tipo: 'calcomania', w: 1.5, h: 1.5 },
  decal_hollin: { src: 'decal_hollin.png', tipo: 'calcomania', w: 1.2, h: 2.4 },
  decal_telarana: { src: 'decal_telarana.png', tipo: 'calcomania', w: 1.0, h: 1.0 },
  decal_gotera: { src: 'decal_gotera.png', tipo: 'calcomania', w: 1.2, h: 2.4 },
  decal_hojas: { src: 'decal_hojas.png', tipo: 'calcomania', w: 1.5, h: 1.5 },
  decal_grieta_grande: { src: 'decal_grieta_grande.png', tipo: 'calcomania', w: 3.0, h: 3.0 },
  estandarte_azul: { src: 'estandarte_azul.png', tipo: 'calcomania', w: 1.2, h: 2.4 },
  estandarte_verde: { src: 'estandarte_verde.png', tipo: 'calcomania', w: 1.2, h: 2.4 },
  estandarte_negro: { src: 'estandarte_negro.png', tipo: 'calcomania', w: 1.2, h: 2.4 },
  estandarte_blanco: { src: 'estandarte_blanco.png', tipo: 'calcomania', w: 1.2, h: 2.4 },
  estandarte_torre: { src: 'estandarte_torre.png', tipo: 'calcomania', w: 1.2, h: 2.4 },
  muro_armeria: { src: 'muro_armeria.png', tipo: 'repetida', tile: 4 },
  piso_armeria: { src: 'piso_armeria.png', tipo: 'repetida', tile: 4 },
  muro_capilla: { src: 'muro_capilla.png', tipo: 'repetida', tile: 4 },
  piso_capilla: { src: 'piso_capilla.png', tipo: 'repetida', tile: 4 },
  estandarte_rojo: { src: 'estandarte_rojo.png', tipo: 'calcomania', w: 1.5, h: 3.0 },
  decal_grieta: { src: 'decal_grieta.png', tipo: 'calcomania', w: 2.0, h: 2.0 },
  decal_runa: { src: 'decal_runa.png', tipo: 'calcomania', w: 1.5, h: 1.5 },
  decal_moho: { src: 'decal_moho.png', tipo: 'calcomania', w: 2.5, h: 2.5 }
};

/* tema -> qué imagen usa en muro / piso / techo (si no hay techo se usa el piso) */
export const TEMAS = {
  armeria: { muro: 'muro_armeria', piso: 'piso_armeria' },
  capilla: { muro: 'muro_capilla', piso: 'piso_capilla' },
  castillo: { muro: 'muro_castillo', piso: 'piso_losa' },
  sillar: { muro: 'muro_sillar', piso: 'piso_adoquin' },
  mamposteria: { muro: 'muro_mamposteria', piso: 'piso_tierra' },
  ladrillo: { muro: 'muro_ladrillo', piso: 'piso_losa', techo: 'cubierta_teja' },
  taberna: { muro: 'muro_adobe', piso: 'piso_tablas', techo: 'piso_tablas' },
  establo: { muro: 'muro_madera', piso: 'piso_paja', techo: 'piso_tablas' },
  mercado: { muro: 'muro_adobe', piso: 'piso_adoquin' },
  cueva: { muro: 'roca_cueva', piso: 'piso_tierra' },
  ruinas: { muro: 'muro_ruina', piso: 'piso_losa' },
  musgoso: { muro: 'muro_musgo', piso: 'piso_adoquin' },
  salon: { muro: 'muro_castillo', piso: 'piso_damero' },
  jardin: { muro: 'muro_mamposteria', piso: 'piso_pasto' },
  patio: { muro: 'muro_sillar', piso: 'piso_barro' }
};

export function crearTexturas(THREE, opciones = {}) {
  const base = opciones.base ?? './tex/';
  const manifiesto = { ...MANIFIESTO, ...(opciones.manifiesto || {}) };
  const temas = { ...TEMAS, ...(opciones.temas || {}) };
  const anisotropia = opciones.anisotropia ?? 4;
  const cargador = new THREE.TextureLoader();
  const cache = new Map();
  const avisados = new Set();
  const aviso = (id, msg) => { if (avisados.has(id)) return; avisados.add(id); console.warn('[texturas] ' + id + ': ' + msg + ' (se usa el color base)'); };

  function marcarColor(tex) {
    if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
    else if ('sRGBEncoding' in THREE) tex.encoding = THREE.sRGBEncoding;
  }
  function cargar(id) {
    if (cache.has(id)) return cache.get(id);
    const def = manifiesto[id];
    if (!def) { aviso(id, 'no está en el manifiesto'); const p0 = Promise.resolve(null); cache.set(id, p0); return p0; }
    const p = new Promise(resolver => {
      cargador.load(base + def.src, tex => {
        marcarColor(tex); tex.anisotropy = anisotropia;
        tex.wrapS = tex.wrapT = def.tipo === 'repetida' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        resolver(tex);
      }, undefined, () => { aviso(id, 'no se pudo cargar ' + base + def.src); resolver(null); });
    });
    cache.set(id, p); return p;
  }
  /* ancho/alto = metros que cubre la cara; con UV en metros (mapa.js) se deja en 1 y 1. */
  async function aplicar(material, id, { ancho = 1, alto = 1 } = {}) {
    const def = manifiesto[id], t0 = await cargar(id);
    if (!t0 || !def) return false;
    const tex = t0.clone(); tex.needsUpdate = true;
    if (def.tipo === 'repetida') tex.repeat.set(ancho / def.tile, alto / def.tile);
    material.map = tex; if (material.color) material.color.set(0xffffff); material.needsUpdate = true;
    return true;
  }
  function aplicarTema(tema, { muro, piso, techo }, medidas = {}) {
    const t = temas[tema]; if (!t) return Promise.resolve([false, false, false]);
    return Promise.all([muro ? aplicar(muro, t.muro, medidas.muro) : false, piso ? aplicar(piso, t.piso, medidas.piso) : false, techo ? aplicar(techo, t.techo || t.piso, medidas.techo) : false]);
  }
  /* Materiales por tema para construirMapa(scene, mapa, opciones): cada sala toma el tema de decorado.json. */
  function opcionesDeMapa(mapa, decorado = {}) {
    const salas = decorado.salas || {}, temaDe = {}, mats = new Map();
    (mapa.rooms || []).forEach(r => {
      const cfg = [r.id, r.nombre, r.name].filter(k => k !== undefined && k !== null && k !== '').map(k => salas[k]).find(Boolean);
      const t = (cfg && cfg.tema) || decorado.temaDefecto; if (t && temas[t]) temaDe[r.id] = t;
    });
    Object.entries(decorado.muros || {}).forEach(([id, t]) => { if (temas[t]) temaDe[id] = t; });
    return { material: (dueno, sup, baseMat) => {
      const t = temaDe[dueno]; if (!t) return null;
      const T = temas[t], id = sup === 'muro' ? T.muro : sup === 'techo' ? (T.techo || T.piso) : (sup === 'piso' || sup === 'escalera' || sup === 'rampa') ? T.piso : null;
      if (!id) return null;
      if (!mats.has(id)) { const m = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: .95 }); mats.set(id, m); aplicar(m, id); }
      return mats.get(id);
    } };
  }
  function crearCalcomania(id, { ancho, alto, opacidad = 1 } = {}) {
    const def = manifiesto[id] || {}, w = ancho ?? def.w ?? 1, h = alto ?? def.h ?? 1;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    if ('alphaTest' in mat) mat.alphaTest = 0.02;
    const malla = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); malla.name = 'calcomania_' + id; malla.renderOrder = 2;
    cargar(id).then(tex => { if (!tex) return; mat.map = tex; mat.opacity = opacidad; mat.needsUpdate = true; });
    return malla;
  }
  /* pos = punto en el muro, normal = hacia dónde mira el muro (sale 2 cm para evitar parpadeo) */
  function pegar(malla, pos, normal, giro = 0) {
    const n = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    malla.position.set(pos.x + n.x * 0.02, pos.y + n.y * 0.02, pos.z + n.z * 0.02);
    malla.lookAt(malla.position.x + n.x, malla.position.y + n.y, malla.position.z + n.z); malla.rotateZ(giro);
    return malla;
  }
  function precargar(ids = Object.keys(manifiesto)) { return Promise.all(ids.map(cargar)).then(r => r.filter(Boolean).length); }
  return { cargar, aplicar, aplicarTema, opcionesDeMapa, crearCalcomania, pegar, precargar, manifiesto, temas };
}

if (typeof globalThis !== 'undefined') globalThis.Texturas = { crearTexturas, MANIFIESTO, TEMAS };
