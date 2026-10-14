// equipment.js — dibuja armas, escudos y armaduras sobre los huesos del personaje (usa three.js).
// Las piezas son originales (formas simples). Los ids vienen de combat.js.
// Ejes de los huesos del esqueleto UAL: +Y va a lo largo del hueso hacia el hijo; en las manos, el arma sale por +Z.

const TIER = {
  cuero: { color: 0x6b4a2f, metal: 0.0, rough: 0.9 },
  malla: { color: 0x9aa0a6, metal: 0.6, rough: 0.45 },
  placas: { color: 0x6e747c, metal: 0.75, rough: 0.35 },
};

// `profile`: medidas del cuerpo (ver PROFILES en hero.js). Sin él se usa el humano.
import { PROFILES } from './hero.js';

// Modelos de armas y escudos (Quaternius "Medieval Weapons", CC0) convertidos a GLB en metros: el agarre está en el origen,
// la hoja sale por +Z y la cara del escudo mira a -X (ver assets/weapons/CREDITS.md). Si no cargan se usan las formas simples.
export const MODEL_DIR = './assets/weapons/';
export const WEAPON_MODEL = {
  espada: 'Sword', hacha: 'Axe', maza: 'Hammer_Small',
  daga: 'Dagger', daga_curva: 'Dagger_2', espada_larga: 'Sword_2', mandoble: 'Sword_Big', claymore: 'Claymore',
  hacha_mano: 'Axe_Small', hacha_guerra: 'Axe_Double', martillo: 'Hammer_Double', lanza: 'Spear',
  espada_veterano: 'Espada_del_veterano',   // hecha en Tripo (ver MODEL_FIX)
};
export const SHIELD_MODEL = { rodela: 'Shield_Round', escudo: 'Shield_Heater', torre: 'Shield_Heater_2' };

// Modelos que NO vienen con el agarre en el origen y la hoja en +Z (p. ej. los de Tripo: centrados y apuntando a +Y, con
// compresión meshopt y material mate). `rot` (rad, XYZ) y `pos` (m) se aplican al modelo antes de ponerlo en la mano;
// `metal`/`rough` sustituyen al material. Se afinan a ojo en equipment-lab.html (panel AJUSTAR ARMA → COPIAR VALORES).
export const MODEL_FIX = {
  Espada_del_veterano: { rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.35], scale: 0.9, metal: 0.7, rough: 0.4 },
};
const MESHOPT_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js';
const SHIELD_BACK_X = { Shield_Round: 0.07, Shield_Heater: 0.06, Shield_Heater_2: 0.04 }; // lado del asa (x máximo) de cada escudo

export function createEquipment(THREE, profile = PROFILES.hero) {
  const P = profile;
  const cache = {};
  const models = {};
  // Carga los GLB (en paralelo). Devuelve cuántos cargaron; los que fallen se sustituyen por la forma simple.
  async function loadModels(GLTFLoader, dir = MODEL_DIR) {
    const loader = new GLTFLoader(); let n = 0;
    // Los modelos de Tripo vienen comprimidos con meshopt: sin el decodificador no cargan (y se ve la forma simple).
    try {
      const { MeshoptDecoder } = await import(MESHOPT_URL);
      if (MeshoptDecoder.ready) await MeshoptDecoder.ready;
      loader.setMeshoptDecoder?.(MeshoptDecoder);
    } catch (e) { /* sin decodificador (p. ej. en Node): solo cargan los GLB sin comprimir */ }
    const names = [...new Set([...Object.values(WEAPON_MODEL), ...Object.values(SHIELD_MODEL)])];
    await Promise.all(names.map(async nm => {
      try {
        const scene = (await loader.loadAsync(dir + nm + '.glb')).scene;
        const fx = MODEL_FIX[nm];
        if (fx) scene.traverse?.(o => { if (o.isMesh && o.material && fx.metal != null) { o.material.metalness = fx.metal; o.material.roughness = fx.rough; } });
        models[nm] = scene; n++;
      } catch (e) { /* queda la forma simple */ }
    }));
    return n;
  }
  const modelPiece = nm => {
    const m = nm && models[nm]; if (!m) return null;
    const inner = m.clone(true), fx = MODEL_FIX[nm];
    if (fx) { inner.rotation?.set(...fx.rot); inner.position?.set(...fx.pos); inner.scale?.setScalar(fx.scale); }
    return group(inner);
  };
  const mat = (key, color, metal = 0, rough = 0.7) =>
    cache[key] ?? (cache[key] = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough }));
  const steel = () => mat('steel', 0xb4bcc4, 0.8, 0.35);
  const wood = () => mat('wood', 0x5a3d25, 0, 0.85);
  const leather = () => mat('leather', 0x3b2a1d, 0, 0.9);
  const gold = () => mat('gold', 0xc9a14a, 0.7, 0.4);
  const dark = () => mat('dark', 0x23262b, 0.3, 0.6);
  const tier = (t) => mat('tier-' + t, TIER[t].color, TIER[t].metal, TIER[t].rough);

  const place = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
  const cyl = (r, h, m, x, y, z, rx = 0, rz = 0) => {
    const o = place(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m), x, y, z);
    o.rotation.set(rx, 0, rz);
    return o;
  };
  const ball = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const o = place(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m), x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  };
  const group = (...kids) => { const g = new THREE.Group(); kids.forEach(k => g.add(k)); return g; };

  const WEAPON_SIMPLE = {
    espada: () => group(
      box(0.035, 0.035, 0.2, leather()), box(0.26, 0.03, 0.04, steel(), 0, 0, 0.11),
      box(0.07, 0.014, 0.8, steel(), 0, 0, 0.51), ball(0.035, gold(), 0, 0, -0.11)),
    hacha: () => group(
      cyl(0.022, 0.95, wood(), 0, 0, 0.32, Math.PI / 2),
      box(0.2, 0.035, 0.18, steel(), 0.1, 0, 0.74), box(0.02, 0.02, 0.1, steel(), 0, 0, 0.88)),
    maza: () => group(
      cyl(0.026, 0.9, wood(), 0, 0, 0.3, Math.PI / 2),
      box(0.14, 0.14, 0.2, steel(), 0, 0, 0.78), box(0.26, 0.04, 0.05, steel(), 0, 0, 0.78),
      box(0.04, 0.26, 0.05, steel(), 0, 0, 0.78)),
  };

  const SHIELD_SIMPLE = {
    rodela: () => group(cyl(0.2, 0.04, wood(), -0.1, 0.14, 0, 0, Math.PI / 2), ball(0.05, gold(), -0.125, 0.14, 0)),
    escudo: () => group(cyl(0.28, 0.045, steel(), -0.1, 0.14, 0, 0, Math.PI / 2), ball(0.06, gold(), -0.13, 0.14, 0)),
    torre: () => group(box(0.05, 0.64, 0.42, steel(), -0.1, 0.16, 0), box(0.06, 0.5, 0.05, gold(), -0.13, 0.16, 0)),
  };

  // Casco: una cúpula que envuelve la cabeza con un margen pequeño. Los cascos abiertos dejan la cara libre.
  const H = P.head, hcy = (H.y0 + H.y1) / 2 + 0.012, hcz = (H.z0 + H.z1) / 2;
  const hrx = H.hx + 0.022, hry = (H.y1 - H.y0) / 2 + 0.028, hrz = (H.z1 - H.z0) / 2 + 0.026;
  const dome = (m, cap, grow = 0) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * cap), m);
    d.scale.set(hrx + grow, hry + grow, hrz + grow); d.position.set(0, hcy, hcz); return d;
  };
  const HELM = {
    cuero: () => group(dome(tier('cuero'), 0.47)),
    malla: () => group(dome(tier('malla'), 0.53),
      box(0.02, 0.1, 0.02, tier('malla'), 0, hcy + hry * 0.2, hcz + hrz * 0.97)),   // nasal
    placas: () => group(dome(tier('placas'), 0.68, 0.004),
      box(hrx * 1.5, 0.045, 0.03, dark(), 0, hcy - 0.01, hcz + hrz * 0.9),          // visera
      box(0.02, 0.06, hrz * 1.7, tier('placas'), 0, hcy + hry * 0.95, hcz)),         // cresta
  };

  // Peto: placa que cubre el torso con un margen (spine_02; el torso llega hasta los hombros).
  const T = P.torso, tw = (T.hx + 0.025) * 2, tcy = (T.y0 + T.y1) / 2, tdp = T.z1 - T.z0 + 0.04, tcz = (T.z0 + T.z1) / 2, th = T.y1 - T.y0 - 0.02;
  const CHEST = {
    cuero: () => group(box(tw - 0.02, th, tdp - 0.02, tier('cuero'), 0, tcy, tcz)),
    malla: () => group(box(tw, th, tdp, tier('malla'), 0, tcy, tcz), box(tw + 0.01, 0.04, tdp + 0.01, leather(), 0, T.y0 + 0.03, tcz)),
    placas: () => group(box(tw + 0.01, th, tdp + 0.01, tier('placas'), 0, tcy, tcz),
      box(tw + 0.02, 0.03, tdp + 0.02, dark(), 0, T.y0 + 0.04, tcz),
      box(0.03, th * 0.8, 0.012, gold(), 0, tcy, T.z1 + 0.03)),
  };
  // Hombreras (solo placas): van en el hueso del brazo para seguir sus movimientos.
  const PAULDRON = { placas: () => group(ball(0.092, tier('placas'), 0, 0.03, 0, 1, 0.8, 1)) };

  // Grebas: cilindros centrados en el muslo y la pantorrilla del cuerpo (el hueso va hacia la rodilla/tobillo en +Y local).
  const TH = P.thigh, CA = P.calf;
  const THIGH = {
    malla: () => group(cyl(TH.r + 0.008, 0.31, tier('malla'), TH.cx, 0.2, TH.cz)),
    placas: () => group(cyl(TH.r + 0.014, 0.3, tier('placas'), TH.cx, 0.2, TH.cz), ball(TH.r * 0.8, tier('placas'), TH.cx, 0.4, TH.cz + 0.04)),
  };
  const CALF = {
    cuero: () => group(cyl(CA.r + 0.006, 0.34, tier('cuero'), CA.cx, 0.23, CA.cz)),
    malla: () => group(cyl(CA.r + 0.012, 0.34, tier('malla'), CA.cx, 0.23, CA.cz)),
    placas: () => group(cyl(CA.r + 0.02, 0.34, tier('placas'), CA.cx, 0.23, CA.cz)),
  };

  // La mano sujeta el arma por el centro de la palma; el eje de la hoja sigue la línea de los nudillos (ligeramente inclinada).
  const inHand = obj => { const w = new THREE.Group(); obj.position.set(0, 0, 0); w.add(obj); w.position.set(...P.hand.palm); w.rotation.x = P.hand.gripTilt; return w; };
  const onForearm = obj => { obj.position.x += P.forearm.outside + 0.052; return obj; }; // el escudo queda por fuera del antebrazo

  // `unit` = 1 / escala del modelo: mantiene las piezas en metros reales aunque el modelo esté escalado.
  function apply(model, eq, store, unit = 1) {
    for (const n of store.nodes || []) n.parent.remove(n.obj);
    store.nodes = [];
    const put = (boneName, obj) => {
      const b = model.getObjectByName(boneName);
      if (!b || !obj) return;
      obj.traverse?.(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      if (unit !== 1) obj.scale.multiplyScalar(unit);
      b.add(obj);
      store.nodes.push({ parent: b, obj });
    };
    const weapon = modelPiece(WEAPON_MODEL[eq.weapon]) || WEAPON_SIMPLE[eq.weapon]?.();
    put('hand_r', weapon && inHand(weapon));
    const sm = modelPiece(SHIELD_MODEL[eq.escudo]);
    if (sm) sm.position.set(P.forearm.outside - 0.012 - SHIELD_BACK_X[SHIELD_MODEL[eq.escudo]], 0.14, 0); // asa pegada al antebrazo, cara hacia fuera
    const shield = sm || SHIELD_SIMPLE[eq.escudo]?.();
    put('lowerarm_l', shield && (sm ? shield : onForearm(shield)));
    put(model.getObjectByName('Head') ? 'Head' : 'head', HELM[eq.casco]?.());
    put('spine_02', CHEST[eq.pechera]?.());
    if (eq.pechera === 'placas') for (const side of ['l', 'r']) put('upperarm_' + side, PAULDRON.placas());
    for (const side of ['l', 'r']) {
      put('thigh_' + side, THIGH[eq.grebas]?.());
      put('calf_' + side, CALF[eq.grebas]?.());
    }
  }

  return { apply, loadModels };
}

export function tintModel(model, color) {
  model.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const cloned = list.map((m, i) => {
      const c = m.clone ? m.clone() : m;
      const isMain = m.name ? m.name === 'M_Main' : i === 0;
      if (isMain && c.color && c.color.set) c.color.set(color);
      return c;
    });
    o.material = Array.isArray(o.material) ? cloned : cloned[0];
  });
}
