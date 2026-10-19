// hero-lab.js — visor de animaciones FBX (Mixamo) sobre el personaje nuevo.
// Carga assets/characters/hero/manifest.json (lo genera tools/gen-hero-manifest.mjs): personaje + animaciones.
// Las animaciones comparten los 65 huesos «mixamorig…» del personaje, así que se aplican por nombre.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const DIR = './assets/characters/hero/';
const $ = (id) => document.getElementById(id);
const errBox = $('err');
const showErr = (m) => { errBox.style.display = 'block'; errBox.textContent += m + '\n'; };
addEventListener('error', (e) => showErr(String(e.message || e)));
addEventListener('unhandledrejection', (e) => showErr(String(e.reason && e.reason.message || e.reason)));

// ---------- escena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c20);
scene.fog = new THREE.Fog(0x1a1c20, 12, 30);
const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x4a4036, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 1.0); sun.position.set(3, 6, 4); scene.add(sun);
const rim = new THREE.DirectionalLight(0x88aaff, 0.45); rim.position.set(-4, 3, -4); scene.add(rim);
const grid = new THREE.GridHelper(20, 40, 0x6a5a40, 0x2c2a26); scene.add(grid);
const cam = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
let yaw = 0.5, pitch = 0.18, dist = 4.2; const tgt = new THREE.Vector3(0, 0.95, 0);
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h;
  const ph = Math.min(h * 0.5, $('panel').offsetHeight || 0);          // el personaje se centra en el espacio que deja el panel
  cam.setViewOffset(w, h, 0, ph / 2, w, h); cam.updateProjectionMatrix();
}
addEventListener('resize', resize); new ResizeObserver(resize).observe($('panel')); resize();

const ptr = new Map(); let pinch = 0;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); });
cv.addEventListener('pointerup', (e) => { ptr.delete(e.pointerId); pinch = 0; });
cv.addEventListener('pointercancel', (e) => { ptr.delete(e.pointerId); pinch = 0; });
cv.addEventListener('pointermove', (e) => {
  if (!ptr.has(e.pointerId)) return; const p = ptr.get(e.pointerId);
  if (ptr.size === 1) { yaw -= (e.clientX - p[0]) * 0.007; pitch = Math.max(-0.2, Math.min(1.3, pitch + (e.clientY - p[1]) * 0.005)); }
  ptr.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) dist = Math.min(14 * K, Math.max(1.2 * K, dist * pinch / d)); pinch = d; }
});
cv.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(14 * K, Math.max(1.2 * K, dist * (1 + e.deltaY * 0.001))); }, { passive: false });

// ---------- personaje ----------
const loader = new FBXLoader();
const holder = new THREE.Group(); scene.add(holder);
let K = 1, noTex = false, hero = null, mixer = null, hips = null, hipsRestY = 0, skel = null;

function prepareHero(obj, texFile) {
  const tex = texFile ? new THREE.TextureLoader().load(DIR + encodeURIComponent(texFile)) : null;
  if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  obj.traverse((n) => {
    if (n.isMesh || n.isSkinnedMesh) {
      n.frustumCulled = false; n.castShadow = n.receiveShadow = false;
      n.geometry.computeVertexNormals();           // las normales del FBX de Tripo salen mal (parches blancos)
      // material propio: el del FBX apunta a una textura externa y sale blanco/negro si falta
      const std = new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : 0xb9a58d, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
      n.material = Array.isArray(n.material) ? n.material.map(() => std) : std;
    }
    if (n.isBone && n.name.endsWith('Hips') && !hips) hips = n;
  });
  holder.add(obj);
  obj.updateMatrixWorld(true);
  // el modelo de Tripo viene en unidades enormes: se escala a 1.8 m y se apoya en el suelo
  const box = new THREE.Box3().setFromObject(obj);
  const s = 1.8 / Math.max(0.001, box.getSize(new THREE.Vector3()).y);
  // el modelo se deja en sus unidades (≈1000 de alto): con la malla reducida a 1.8 m el sombreado de la piel se quemaba.
  // En su lugar se agranda el «mundo» (cámara, rejilla, niebla) por K = 1/s.
  K = 1 / s; holder.position.y = -box.min.y;
  grid.scale.setScalar(K); scene.fog.near *= K; scene.fog.far *= K; cam.near *= K; cam.far *= K; cam.updateProjectionMatrix();
  dist *= K; tgt.multiplyScalar(K); sun.position.multiplyScalar(K); rim.position.multiplyScalar(K);
  hipsRestY = hips ? hips.position.y : 0;
  skel = new THREE.SkeletonHelper(obj); skel.visible = false; scene.add(skel);
  skel.matrixAutoUpdate = false; skel.matrix = holder.matrix; skel.matrixWorldNeedsUpdate = true;
  mixer = new THREE.AnimationMixer(obj);
}

// ---------- animaciones ----------
const lib = new Map();        // nombre → { name, group, url, clipRoot, clipIn, status }
let current = null, action = null, rootMotion = false, playing = true, loop = true, auto = false, speed = 1;

const friendly = (f) => f.replace(/\.fbx$/i, '').replace(/^sword and shield\s*/i, '').replace(/^sheath sword/i, 'sheath sword').trim() || 'base';
function category(n) {
  const b = n.toLowerCase();
  for (const k of ['idle', 'walk', 'run', 'strafe', 'turn', 'jump', 'crouch', 'block', 'attack', 'slash', 'kick', 'casting', 'power up', 'impact', 'death', 'sheath']) if (b.includes(k)) return k;
  return 'otros';
}

function retarget(clip) {
  // las posiciones de Mixamo van en cm; el modelo tiene otra escala → se ajusta con la altura de caderas
  const clipRoot = clip.clone(), clipIn = clip.clone();
  const hp = clip.tracks.find((t) => /Hips\.position$/.test(t.name));
  const k = hp && hp.values[1] > 1e-3 && hipsRestY ? hipsRestY / hp.values[1] : 1;
  for (const c of [clipRoot, clipIn]) for (const t of c.tracks) if (t.name.endsWith('.position')) for (let i = 0; i < t.values.length; i++) t.values[i] *= k;
  const ip = clipIn.tracks.find((t) => /Hips\.position$/.test(t.name));
  if (ip) for (let i = 0; i < ip.values.length; i += 3) { ip.values[i] = ip.values[0]; ip.values[i + 2] = ip.values[2]; }
  return { clipRoot, clipIn };
}

async function ensureLoaded(item) {
  if (item.clipRoot) return true;
  try {
    const obj = await loader.loadAsync(item.url);
    const clip = obj.animations[0];
    if (!clip) throw new Error('sin animación');
    clip.name = item.name;
    Object.assign(item, retarget(clip), { status: 'ok' });
    return true;
  } catch (e) { item.status = 'error'; item.btn && item.btn.classList.add('err'); showErr(item.name + ': ' + (e.message || e)); return false; }
}

async function play(name) {
  const item = lib.get(name); if (!item) return;
  $('status').textContent = 'Cargando ' + name + '…';
  if (!(await ensureLoaded(item))) return;
  const clip = rootMotion ? item.clipRoot : item.clipIn;
  const next = mixer.clipAction(clip);
  next.reset(); next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); next.clampWhenFinished = true;
  next.timeScale = speed; next.enabled = true;
  if (action && action !== next) { action.crossFadeTo(next, 0.15, false); }
  next.play(); action = next; current = item; item.btn && item.btn.classList.add('on');
  for (const o of lib.values()) if (o !== item && o.btn) o.btn.classList.remove('on');
  $('status').innerHTML = `<b>${name}</b> · ${clip.duration.toFixed(2)} s · ${clip.tracks.length} pistas`;
  if (!playing) { next.paused = false; mixer.update(0); next.paused = true; }
}

function buildUI(list) {
  const groups = new Map();
  for (const it of list) { if (!groups.has(it.group)) groups.set(it.group, []); groups.get(it.group).push(it); }
  const box = $('clips'); box.innerHTML = '';
  for (const [g, items] of groups) {
    const h = document.createElement('div'); h.className = 'grp'; h.textContent = g.toUpperCase() + ' (' + items.length + ')'; box.append(h);
    const gr = document.createElement('div'); gr.className = 'grid'; box.append(gr);
    for (const it of items) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = it.name; it.btn = b;
      if (it.status === 'error') b.classList.add('err');
      b.onclick = () => play(it.name); gr.append(b);
    }
  }
}
const addItem = (name, url) => { let n = name, i = 2; while (lib.has(n)) n = name + ' ' + i++; lib.set(n, { name: n, group: category(n), url, clipRoot: null, clipIn: null, status: 'pend' }); return n; };

// ---------- controles ----------
const setPlaying = (v) => { playing = v; if (action) action.paused = !v; $('bPlay').textContent = v ? '⏸ PAUSA' : '▶ PLAY'; $('bPlay').classList.toggle('on', v); };
$('bPlay').onclick = () => setPlaying(!playing);
$('bLoop').onclick = (e) => { loop = !loop; e.target.classList.toggle('on', loop); if (current) play(current.name); };
$('bRoot').onclick = (e) => { rootMotion = !rootMotion; e.target.textContent = 'MOVIMIENTO RAÍZ: ' + (rootMotion ? 'ON' : 'OFF'); e.target.classList.toggle('on', rootMotion); if (current) { const t = action ? action.time : 0; play(current.name).then(() => { if (action) { action.time = t; } }); } };
$('bSkel').onclick = (e) => { if (skel) { skel.visible = !skel.visible; e.target.classList.toggle('on', skel.visible); } };
$('bAuto').onclick = (e) => { auto = !auto; e.target.classList.toggle('on', auto); if (auto) { loop = false; $('bLoop').classList.remove('on'); if (current) play(current.name); } };
$('sp').oninput = (e) => { speed = e.target.value / 100; $('spv').textContent = speed.toFixed(2) + '×'; if (action) action.timeScale = speed; };
$('tl').oninput = (e) => {
  if (!action || !current) return; setPlaying(false);
  const d = action.getClip().duration; action.time = (e.target.value / 1000) * d; action.paused = false; mixer.update(0); action.paused = true; $('tv').textContent = action.time.toFixed(2) + 's';
};
$('bAll').onclick = async (e) => {
  e.target.disabled = true; let n = 0, bad = 0;
  for (const it of lib.values()) { $('status').textContent = `Cargando ${++n}/${lib.size}: ${it.name}`; if (!(await ensureLoaded(it))) bad++; }
  $('status').textContent = `Listas: ${lib.size - bad} de ${lib.size}` + (bad ? ` (${bad} con error)` : ''); e.target.disabled = false;
};
$('bHide').onclick = (e) => { const c = $('clips'); c.hidden = !c.hidden; e.target.textContent = c.hidden ? '▲ MOSTRAR LISTA' : '▼ OCULTAR LISTA'; };
$('bFile').onclick = () => $('fileIn').click();
$('fileIn').onchange = async (e) => {
  const files = [...e.target.files]; if (!files.length) return; let last = null;
  for (const f of files) last = addItem(friendly(f.name), URL.createObjectURL(f));
  buildUI([...lib.values()]); e.target.value = ''; if (last) play(last);
};

// ---------- arranque ----------
(async () => {
  const man = await (await fetch(DIR + 'manifest.json', { cache: 'no-cache' })).json();
  if (!man.character) throw new Error('manifest.json sin personaje');
  const obj = await loader.loadAsync(DIR + encodeURIComponent(man.character));
  prepareHero(obj, man.texture);
  noTex = !man.texture;
  for (const f of man.anims) addItem(friendly(f), DIR + encodeURIComponent(f));
  buildUI([...lib.values()]);
  $('status').textContent = `${man.character} listo · ${lib.size} animaciones. Toca una para verla.` + (noTex ? ' (sin textura: falta la imagen del personaje en assets/characters/hero/)' : '');
  const first = lib.has('idle') ? 'idle' : [...lib.keys()][0];
  if (first) await play(first);
  window.__lab = { scene, hemi, sun, rim, lib, play, get action() { return action; }, hero, holder, mixer };
  window.__ready = true;
})().catch((e) => showErr('No se pudo iniciar: ' + (e.message || e)));

let last = performance.now();
function loop_(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mixer && playing) mixer.update(dt);
  if (action && current) {
    const d = action.getClip().duration;
    if (playing) { $('tl').value = Math.min(1000, (action.time % (d + 1e-6)) / d * 1000); $('tv').textContent = action.time.toFixed(2) + 's'; }
    if (auto && !loop && !action.isRunning() && playing) { const names = [...lib.keys()], i = names.indexOf(current.name); play(names[(i + 1) % names.length]); }
  }
  cam.position.set(tgt.x + dist * Math.cos(pitch) * Math.sin(yaw), tgt.y + dist * Math.sin(pitch), tgt.z + dist * Math.cos(pitch) * Math.cos(yaw));
  cam.lookAt(tgt);
  renderer.render(scene, cam);
  requestAnimationFrame(loop_);
}
requestAnimationFrame(loop_);
