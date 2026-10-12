// hero.js — personaje humano (Quaternius "Superhero Male", CC0) con las animaciones de UAL.
// El humano y el maniquí amarillo comparten el MISMO esqueleto de 65 huesos (mismos nombres y misma pose de reposo),
// así que las animaciones de UAL se aplican por nombre de hueso, sin retargeting.
// Solo las traslaciones de `root` y `pelvis` se conservan (escaladas a su altura); el resto de huesos mantiene las
// proporciones del humano en vez de heredar las del maniquí.

export const HERO_URL = './assets/characters/hero/night-striker.glb';
export const CLIP_URLS = ['./assets/characters/ual/UAL1_Standard.glb', './assets/characters/ual/UAL2_Standard.glb'];
export const HERO_HEIGHT = 1.82;

// Medidas del cuerpo en el espacio local de cada hueso (m), tomadas de la malla en pose de reposo.
// Las usa equipment.js para que cascos, petos y grebas se ajusten al cuerpo en vez de flotar o quedar dentro.
//   head: x = semiancho, y0..y1 = base y coronilla, z0..z1 = nuca y cara (la cara mira a +Z)
//   torso: medidas respecto a spine_02 (hombros incluidos) · thigh/calf: centro y radio · grip: inclinación del arma en la mano
export const PROFILES = {
  hero: {
    head: { hx: 0.079, y0: -0.009, y1: 0.204, z0: -0.081, z1: 0.127 },
    torso: { hx: 0.199, y0: -0.001, y1: 0.352, z0: -0.17, z1: 0.114 },
    thigh: { cx: 0.012, cz: -0.008, r: 0.092 },
    calf: { cx: -0.013, cz: 0.021, r: 0.085 },
    hand: { palm: [-0.007, 0.05, 0.007], gripTilt: -0.24 },
    forearm: { outside: -0.052 },
  },
  maniqui: {
    head: { hx: 0.086, y0: -0.014, y1: 0.259, z0: -0.115, z1: 0.106 },
    torso: { hx: 0.165, y0: 0.01, y1: 0.34, z0: -0.155, z1: 0.126 },
    thigh: { cx: -0.003, cz: -0.005, r: 0.08 },
    calf: { cx: -0.004, cz: 0.019, r: 0.07 },
    hand: { palm: [-0.011, 0.055, -0.003], gripTilt: -0.17 },
    forearm: { outside: -0.051 },
  },
};

// Ajusta un modelo a 1.82 m, de pie sobre y = 0 y centrado. Devuelve la escala aplicada.
export function fitModel(THREE, model, height = HERO_HEIGHT) {
  model.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(model);
  const size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const f = size.y > 0 ? height / size.y : 1;
  model.scale.setScalar(f);
  if (size.y > 0) model.position.set(-c.x * f, -b.min.y * f, -c.z * f);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; // el pelo y los ojos son planos: se ven por ambos lados
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) m.side = THREE.DoubleSide;
  });
  return f;
}

// Adapta clips de UAL al humano: conserva las rotaciones y las traslaciones de root/pelvis (escaladas por la
// diferencia de altura de cadera); descarta las traslaciones del resto de huesos (las del maniquí no le sirven).
// `heroRoot` y `donorRoot` son las escenas cargadas (posición de reposo de cada hueso).
export function adaptClips(clips, heroRoot, donorRoot) {
  const rest = (root, name) => root.getObjectByName(name)?.position;
  const out = [];
  for (const clip of clips) {
    const tracks = [];
    for (const tr of clip.tracks) {
      const dot = tr.name.lastIndexOf('.');
      const bone = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1);
      if (prop !== 'position') { tracks.push(tr); continue; }
      if (bone !== 'pelvis' && bone !== 'root') continue;
      const h = rest(heroRoot, bone), d = rest(donorRoot, bone);
      const t = tr.clone();
      if (h && d) for (let i = 0; i < t.values.length; i += 3) {
        t.values[i] *= Math.abs(d.x) > 1e-4 ? h.x / d.x : 1;
        t.values[i + 1] *= Math.abs(d.y) > 1e-4 ? h.y / d.y : 1;
        t.values[i + 2] *= Math.abs(d.z) > 1e-4 ? h.z / d.z : 1;
      }
      tracks.push(t);
    }
    const c = clip.clone ? clip.clone() : clip;
    c.tracks = tracks;
    out.push(c);
  }
  return out;
}

// Carga el humano y los clips. Devuelve { model, clips, source:'hero'|'maniqui', profile }.
// Si el humano no carga, usa el maniquí amarillo (el juego sigue funcionando).
export async function loadHero(THREE, GLTFLoader, urls = {}) {
  const loader = new GLTFLoader();
  const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));
  const donors = [];
  for (const u of urls.clips || CLIP_URLS) { try { donors.push(await load(u)); } catch { /* UAL2 es opcional */ } }
  if (!donors.length) throw new Error('No se pudo cargar ninguna biblioteca de animaciones');
  const donorRoot = donors[0].scene;
  const rawClips = donors.flatMap(g => g.animations || []);
  let hero = null;
  try { hero = await load(urls.hero || HERO_URL); } catch { /* respaldo: maniquí */ }
  if (!hero) {
    return { model: donorRoot, clips: rawClips, source: 'maniqui', profile: PROFILES.maniqui };
  }
  return { model: hero.scene, clips: adaptClips(rawClips, hero.scene, donorRoot), source: 'hero', profile: PROFILES.hero };
}
