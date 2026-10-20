// hero-fbx.js — el héroe nuevo (personaje_1, Tripo) con las animaciones Mixamo «sword and shield».
// personaje_1.glb y personaje_1.meta.json los genera tools/bake-hero.py a partir de los FBX de assets/characters/hero/.
// Devuelve lo mismo que loadHero() de hero.js ({ model, clips, source }) más `kit` con lo que el juego necesita para usarlas.
// Los clips conservan su nombre («idle», «attack (4)»…) y además se crean alias con los nombres que ya entiende locomotion.js.

export const HERO_FBX_URL = './assets/characters/hero/personaje_1.glb';
export const HERO_META_URL = './assets/characters/hero/personaje_1.meta.json';

// alias → clip real
const ALIAS = {
  'idle loop': 'idle',
  'idle guard': 'block idle',     // con el arma en alto
  'walk loop': 'walk',
  'walk back': 'walk (2)',        // caminar hacia atrás (el UAL no lo trae)
  'jog fwd loop': 'run',
  'run back': 'run (2)',
  'jump start': 'jump (2)',
  'sword attack': 'attack (4)',
  'strafe left': 'strafe (2)', 'strafe right': 'strafe',
  'strafe left run': 'strafe (3)', 'strafe right run': 'strafe (4)',
};
// golpes en orden de combo (primero los rápidos); el tiempo del impacto sale de meta.clips[nombre].hit
export const COMBO = ['attack (4)', 'slash (5)', 'kick', 'slash', 'attack (2)', 'slash (3)'];

const norm = (n) => (n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export async function loadHeroFbx(THREE, GLTFLoader, urls = {}) {
  const loader = new GLTFLoader();
  const [gltf, meta] = await Promise.all([
    new Promise((res, rej) => loader.load(urls.model || HERO_FBX_URL, res, undefined, rej)),
    fetch(urls.meta || HERO_META_URL).then((r) => { if (!r.ok) throw new Error('sin meta'); return r.json(); }),
  ]);
  const byName = new Map(gltf.animations.map((c) => [norm(c.name), c]));
  const clips = gltf.animations.slice();
  for (const [alias, real] of Object.entries(ALIAS)) {
    const c = byName.get(norm(real)); if (!c) continue;
    const a = c.clone(); a.name = alias; clips.push(a);
  }
  gltf.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = o.receiveShadow = true; for (const m of [].concat(o.material)) m.side = THREE.DoubleSide; } });
  const info = (n) => meta.clips[n] || {};
  const combo = COMBO.filter((n) => byName.has(norm(n))).map((n) => ({ key: norm(n), name: n, dur: info(n).duration || 1, hit: info(n).hit || 0.4 }));
  const speed = { walk: info('walk').speed || 1.5, run: info('run').speed || 4.4, back: info('walk (2)').speed || 1.1 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const kit = {
    meta, combo, speed,
    // Ajusta la cadencia de los pasos a la velocidad real del juego (sin patinar) y elige la guardia si hay arma.
    adjust(pk, { armed, walk, run, back }) {
      if (pk.name === 'walk loop' && pk.rate > 0) pk.rate *= clamp(walk / speed.walk, 0.6, 1.8);
      else if (pk.name === 'jog fwd loop' && pk.rate > 0) pk.rate *= clamp(run / speed.run, 0.6, 1.8);
      else if (pk.name === 'walk back') pk.rate = clamp(back / speed.back, 0.6, 1.8);
      else if (armed && pk.name === 'idle loop' && byName.has('block idle')) { pk.name = 'idle guard'; pk.key = 'idle guard'; }
      return pk;
    },
  };
  return { model: gltf.scene, clips, source: 'fbx', profile: null, kit };
}
