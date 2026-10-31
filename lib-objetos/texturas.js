/* texturas.js — manifiesto tema -> imagen, con respaldo si falta la imagen.
 *
 * Funciona con Three r128 (encoding) y con versiones nuevas (colorSpace).
 * Es un módulo ES, pero también deja `window.Texturas` para las páginas de prueba:
 *
 *   Juego:   import { crearTexturas } from './texturas.js';
 *            const tx = crearTexturas(THREE, { base: './tex/' });
 *
 *   Prueba:  <script src="three.r128.min.js"></script>
 *            <script type="module" src="texturas.js"></script>
 *            <script type="module">
 *              const tx = Texturas.crearTexturas(THREE, { base: 'tex/' });
 *            </script>
 *
 * Si la imagen no carga, el material queda con la textura de código que ya tenía.
 */

/* tile = metros que cubre una repetición de la imagen.
   w/h  = tamaño en metros (solo calcomanías y estandartes). */
export const MANIFIESTO = {
  muro_armeria:   { src: 'muro_armeria.png',   tile: 4,  tipo: 'repetida' },
  piso_armeria:   { src: 'piso_armeria.png',   tile: 4,  tipo: 'repetida' },
  muro_capilla:   { src: 'muro_capilla.png',   tile: 4,  tipo: 'repetida' },
  piso_capilla:   { src: 'piso_capilla.png',   tile: 4,  tipo: 'repetida' },
  estandarte_rojo:{ src: 'estandarte_rojo.png',           tipo: 'calcomania', w: 1.5, h: 3.0 },
  decal_grieta:   { src: 'decal_grieta.png',              tipo: 'calcomania', w: 2.0, h: 2.0 },
  decal_runa:     { src: 'decal_runa.png',                tipo: 'calcomania', w: 1.5, h: 1.5 },
  decal_moho:     { src: 'decal_moho.png',                tipo: 'calcomania', w: 2.5, h: 2.5 },
};

/* tema -> qué imágenes usa */
export const TEMAS = {
  armeria: { muro: 'muro_armeria', piso: 'piso_armeria' },
  capilla: { muro: 'muro_capilla', piso: 'piso_capilla' },
};

export function crearTexturas(THREE, opciones = {}) {
  const base = opciones.base ?? './tex/';
  const manifiesto = { ...MANIFIESTO, ...(opciones.manifiesto || {}) };
  const anisotropia = opciones.anisotropia ?? 4;
  const cargador = new THREE.TextureLoader();
  const cache = new Map();      // id -> Promise<Texture|null>
  const avisados = new Set();

  const aviso = (id, msg) => {
    if (avisados.has(id)) return;
    avisados.add(id);
    console.warn('[texturas] ' + id + ': ' + msg + ' (se usa la textura de código)');
  };

  function marcarColor(tex) {
    if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
    else if ('sRGBEncoding' in THREE) tex.encoding = THREE.sRGBEncoding;
  }

  /* Carga una vez (con caché). Devuelve Promise<Texture|null>; nunca rechaza. */
  function cargar(id) {
    if (cache.has(id)) return cache.get(id);
    const def = manifiesto[id];
    if (!def) { aviso(id, 'no está en el manifiesto'); const p = Promise.resolve(null); cache.set(id, p); return p; }
    const p = new Promise((resolver) => {
      cargador.load(
        base + def.src,
        (tex) => {
          marcarColor(tex);
          tex.anisotropy = anisotropia;
          if (def.tipo === 'repetida') tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          else tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
          resolver(tex);
        },
        undefined,
        () => { aviso(id, 'no se pudo cargar ' + base + def.src); resolver(null); }
      );
    });
    cache.set(id, p);
    return p;
  }

  /* Aplica la imagen a un material cuando cargue.
     ancho/alto = metros que cubre la cara (para calcular cuántas veces se repite).
     Devuelve Promise<boolean> (true si se aplicó). */
  async function aplicar(material, id, { ancho = 1, alto = 1 } = {}) {
    const def = manifiesto[id];
    const base_tex = await cargar(id);
    if (!base_tex || !def) return false;
    const tex = base_tex.clone();     // clon: cada malla puede tener su propia repetición
    tex.needsUpdate = true;           // un clon necesita subirse a la GPU
    if (def.tipo === 'repetida') tex.repeat.set(ancho / def.tile, alto / def.tile);
    material.map = tex;
    if (material.color) material.color.set(0xffffff); // que el color base no tiña la imagen
    material.needsUpdate = true;
    return true;
  }

  /* Calcomanía (grieta, runa, moho, estandarte): plano con transparencia,
     listo para pegar sobre un muro. Se ve de inmediato como plano invisible
     y aparece al cargar la imagen. */
  function crearCalcomania(id, { ancho, alto, opacidad = 1 } = {}) {
    const def = manifiesto[id] || {};
    const w = ancho ?? def.w ?? 1, h = alto ?? def.h ?? 1;
    const mat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    if ('alphaTest' in mat) mat.alphaTest = 0.02;
    const malla = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    malla.name = 'calcomania_' + id;
    malla.renderOrder = 2;
    cargar(id).then((tex) => {
      if (!tex) return;                       // si falta: queda invisible
      mat.map = tex; mat.opacity = opacidad; mat.needsUpdate = true;
    });
    return malla;
  }

  /* Pega una calcomanía sobre un muro: pos = punto en el muro,
     normal = hacia dónde mira el muro (sale de la pared 2 cm para evitar parpadeo). */
  function pegar(malla, pos, normal, giro = 0) {
    const n = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    malla.position.set(pos.x + n.x * 0.02, pos.y + n.y * 0.02, pos.z + n.z * 0.02);
    malla.lookAt(malla.position.x + n.x, malla.position.y + n.y, malla.position.z + n.z);
    malla.rotateZ(giro);
    return malla;
  }

  /* Aplica muro y piso de un tema a un par de materiales. */
  function aplicarTema(tema, { muro, piso }, medidas = {}) {
    const t = TEMAS[tema];
    if (!t) return Promise.resolve([false, false]);
    return Promise.all([
      muro ? aplicar(muro, t.muro, medidas.muro) : false,
      piso ? aplicar(piso, t.piso, medidas.piso) : false,
    ]);
  }

  function precargar(ids = Object.keys(manifiesto)) {
    return Promise.all(ids.map(cargar)).then((r) => r.filter(Boolean).length);
  }

  return { cargar, aplicar, aplicarTema, crearCalcomania, pegar, precargar, manifiesto, temas: TEMAS };
}

if (typeof globalThis !== 'undefined') {
  globalThis.Texturas = { crearTexturas, MANIFIESTO, TEMAS };
}
