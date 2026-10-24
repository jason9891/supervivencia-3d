// clips-lab.js — ve todas las animaciones del repo sobre sera_limpio, elige las que se usarán y crea un GLB con esos clips fijos.
// Fuentes: UAL 1 / UAL 2 / Jordan (GLB, esqueleto UAL → se retargetea) y las FBX de Mixamo de assets/characters/hero (mismos huesos).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { UalRetargeter, mixamoClip } from './retarget.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CATS, CAT_LABEL, CAT_TITLE, guessCategory, encodeName } from './clip-categories.js';
import { loadArmor, ARMOR_SETS, ARMOR_LABEL, PART_LABEL, VARIANTS, VARIANT_LABEL } from './armor-wear.js';

const HERO_URL = './assets/characters/hero/sera_limpio.glb';
const HERO_DIR = './assets/characters/hero/';
const CATALOG = './assets/characters/clips-catalog.json';
const LS = 'clipslab-sel-v1';
const $ = (id) => document.getElementById(id);
const errBox = $('err');
const showErr = (m) => { errBox.style.display = 'block'; errBox.textContent += m + '\n'; };
addEventListener('error', (e) => showErr(String(e.message || e)));
addEventListener('unhandledrejection', (e) => showErr(String(e.reason && e.reason.message || e.reason)));
const status = (h) => { $('status').innerHTML = h; };

// ---------- escena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c20); scene.fog = new THREE.Fog(0x1a1c20, 10, 26);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4036, 1.2));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.6); sun.position.set(3, 6, 4); scene.add(sun);
const rim = new THREE.DirectionalLight(0x88aaff, 0.6); rim.position.set(-4, 3, -4); scene.add(rim);
scene.add(new THREE.GridHelper(20, 40, 0x6a5a40, 0x2c2a26));
const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
let yaw = 0.5, pitch = 0.15, dist = 6.8; const tgt = new THREE.Vector3(0, 0.95, 0);
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h;
  const ph = $('panel').offsetHeight || 0; cam.setViewOffset(w, h, 0, ph / 2, w, h); cam.updateProjectionMatrix();
}
addEventListener('resize', resize); new ResizeObserver(resize).observe($('panel')); resize();
const ptr = new Map(); let pinch = 0; const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); });
for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, (e) => { ptr.delete(e.pointerId); pinch = 0; });
cv.addEventListener('pointermove', (e) => {
  if (!ptr.has(e.pointerId)) return; const p = ptr.get(e.pointerId);
  if (ptr.size === 1) { yaw -= (e.clientX - p[0]) * 0.007; pitch = Math.max(-0.2, Math.min(1.3, pitch + (e.clientY - p[1]) * 0.005)); }
  ptr.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) dist = Math.min(14, Math.max(0.8, dist * pinch / d)); pinch = d; }
});
cv.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(14, Math.max(0.8, dist * (1 + e.deltaY * 0.001))); }, { passive: false });

// ---------- personaje ----------
let hero = null, mixer = null, skel = null, hipsRestY = 1, restPose = [];
function restorePose() { for (const r of restPose) { r.b.position.copy(r.p); r.b.quaternion.copy(r.q); r.b.scale.copy(r.s); } hero.updateMatrixWorld(true); }

// ---------- biblioteca ----------
const items = new Map();         // key → { key, src, label, clipName, name, sel, dur, cache }
const sources = new Map();       // id → { id, label, type, url, mb, clips, state, raw: Map(name → clip), rt }
let tab = 'all', cur = null, action = null, playing = true, loop = true, inPlace = true, auto = false, speed = 1, stride = 1;

const norm = (s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const friendly = (f) => norm(f.replace(/\.fbx$/i, '').replace(/^sword and shield\s*/i, 'sas ')).replace(/^sheath sword/, 'sheath sword');
function addItem(src, clipName, name) {
  const key = src.id + ':' + clipName; let n = name, i = 2; const used = new Set([...items.values()].map((x) => x.name));
  while (used.has(n)) n = name + ' ' + i++;
  items.set(key, { key, src, clipName, name: n, sel: false, dur: null, cache: null, cat: guessCategory(n) });
}

async function loadSource(src) {
  if (src.state === 'ok') return;
  if (src.loading) return src.loading;
  src.loading = (async () => {
    status(`Cargando ${src.label}${src.mb ? ' (' + src.mb + ' MB)' : ''}…`);
    if (src.type === 'glb') {
      const g = await new GLTFLoader().loadAsync(src.url);
      src.raw = new Map(g.animations.map((c) => [c.name, c]));
      restorePose();
      src.rt = new UalRetargeter(g.scene, hero);
      src.scene = g.scene;
    }
    src.state = 'ok';
  })();
  try { await src.loading; } finally { src.loading = null; }
}

async function rawClip(item) {
  const src = item.src;
  if (src.type === 'fbx') {
    if (!src.raw.has(item.clipName)) {
      const obj = await new FBXLoader().loadAsync(src.url + encodeURIComponent(item.clipName));
      if (!obj.animations[0]) throw new Error('sin animación');
      src.raw.set(item.clipName, obj.animations[0]);
    }
    return src.raw.get(item.clipName);
  }
  await loadSource(src); return src.raw.get(item.clipName);
}

function freezeHips(c) {
  const hp = c.tracks.find((t) => /Hips\.position$/.test(t.name)); if (!hp) return;
  for (let i = 0; i < hp.values.length; i += 3) { hp.values[i] = hp.values[0]; hp.values[i + 2] = hp.values[2]; }
}
async function buildClip(item) {
  const sig = `${inPlace}|${stride}|${item.name}`;
  if (item.cache && item.cache.sig === sig) return item.cache.clip;
  const raw = await rawClip(item); let clip;
  if (item.src.type === 'fbx') clip = mixamoClip(raw, hipsRestY, { inPlace, name: item.name });
  else { restorePose(); clip = item.src.rt.retarget(raw, item.name, stride); if (inPlace) freezeHips(clip); }
  item.dur = clip.duration; item.cache = { sig, clip }; return clip;
}

// ---------- reproducción ----------
async function play(item) {
  status('Cargando ' + item.name + '…');
  let clip; try { clip = await buildClip(item); } catch (e) { showErr(item.name + ': ' + (e.message || e)); return; }
  restorePose(); mixer.stopAllAction(); mixer.uncacheRoot(hero);
  const next = mixer.clipAction(clip);
  next.reset(); next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); next.clampWhenFinished = true; next.timeScale = speed; next.play();
  action = next; cur = item; if (!playing) { next.paused = false; mixer.update(0); next.paused = true; }
  status(`<b>${item.name}</b> · ${clip.duration.toFixed(2)} s · ${clip.tracks.length} pistas · ${item.src.label}`);
  renderList();
}

// ---------- lista ----------
let catFilter = 'todas';                                           // filtro por grupo en la pestaña ★
const visible = () => [...items.values()].filter((it) => tab === 'all' || (tab === 'sel' ? it.sel && (catFilter === 'todas' || it.cat === catFilter) : it.src.id === tab));
function renderTabs() {
  const box = $('tabs'); box.innerHTML = '';
  const nSel = [...items.values()].filter((i) => i.sel).length;
  const defs = [['all', 'TODAS'], ...[...sources.values()].map((s) => [s.id, s.label.replace(' ', '') + ' ' + [...items.values()].filter((i) => i.src === s).length]), ['sel', '★ ' + nSel]];
  for (const [id, label] of defs) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.classList.toggle('on', tab === id); b.onclick = () => { tab = id; renderTabs(); renderList(); }; box.append(b); }
  if (tab === 'sel') {                                             // filtro por grupo: TODOS · BÁSICAS · ATAQUE · MAPA (con el número de clips)
    const cnt = (c) => [...items.values()].filter((i) => i.sel && (c === 'todas' || i.cat === c)).length;
    for (const c of ['todas', ...CATS]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = (c === 'todas' ? 'TODOS' : CAT_LABEL[c]) + ' ' + cnt(c); b.title = CAT_TITLE[c] || ''; b.classList.toggle('on', catFilter === c); b.style.cssText = 'margin-left:8px;border-color:#8fbf6a'; b.onclick = () => { catFilter = c; renderTabs(); renderList(); }; box.append(b); }
  }
  $('bExp').textContent = '⬇ CREAR GLB (' + nSel + ')'; $('bExp').disabled = !nSel;
}
function renderList() {
  const box = $('list'), top = box.scrollTop; box.innerHTML = ''; let lastSrc = null;
  for (const it of visible()) {
    if (tab === 'all' && it.src !== lastSrc) { const h = document.createElement('div'); h.className = 'grp'; h.textContent = it.src.label + (it.src.mb ? ` · ${it.src.mb} MB` : ''); box.append(h); lastSrc = it.src; }
    const row = document.createElement('div'); row.className = 'item' + (cur === it ? ' cur' : '');
    const ck = document.createElement('input'); ck.type = 'checkbox'; ck.checked = it.sel; ck.title = 'Usar en el GLB';
    ck.onchange = () => { it.sel = ck.checked; saveSel(); renderTabs(); if (tab === 'sel') renderList(); };
    row.append(ck);
    if (tab === 'sel') {
      const t = document.createElement('input'); t.type = 'text'; t.value = it.name; t.onchange = () => { it.name = t.value.trim() || it.name; it.cache = null; saveSel(); };
      row.append(t);
      const cb = document.createElement('button'); cb.type = 'button'; cb.textContent = CAT_LABEL[it.cat]; cb.title = 'Grupo: toca para cambiar (básica → ataque → mapa)'; cb.className = 'cat ' + it.cat;
      cb.onclick = () => { it.cat = CATS[(CATS.indexOf(it.cat) + 1) % CATS.length]; saveSel(); renderTabs(); renderList(); }; row.append(cb);
    }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'nm'; b.textContent = tab === 'sel' ? '▶' : it.name; b.style.flex = tab === 'sel' ? 'none' : '1'; b.onclick = () => play(it); row.append(b);
    const s = document.createElement('span'); s.className = 'src'; s.textContent = it.src.id; row.append(s);
    const d = document.createElement('span'); d.className = 'du'; d.textContent = it.dur ? it.dur.toFixed(2) + 's' : '–'; row.append(d);
    box.append(row);
  }
  box.scrollTop = top;
}

// ---------- selección ----------
const selData = () => [...items.values()].filter((i) => i.sel).map((i) => ({ key: i.key, source: i.src.id, clip: i.clipName, name: i.name, cat: i.cat }));
function saveSel() { try { localStorage.setItem(LS, JSON.stringify(selData())); } catch (e) { /* sin almacenamiento */ } }
function applySel(list) {
  for (const it of items.values()) it.sel = false;
  for (const s of list || []) { const it = items.get(s.key); if (it) { it.sel = true; if (s.name) it.name = s.name; it.cat = s.cat || guessCategory(it.name); it.cache = null; } }
  renderTabs(); renderList();
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 2000); }

$('bSel').onclick = () => { saveSel(); download('sera_seleccion.json', new Blob([JSON.stringify({ character: 'sera_limpio.glb', inPlace, stride, clips: selData() }, null, 1)], { type: 'application/json' })); status('Selección guardada (' + selData().length + ' clips).'); };
$('bLoad').onclick = () => $('fileIn').click();
$('fileIn').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); applySel(j.clips || j); status('Selección cargada.'); saveSel(); } catch (er) { showErr('Selección inválida: ' + er.message); } e.target.value = ''; };
$('bClear').onclick = () => { applySel([]); saveSel(); };

$('bExp').onclick = async () => {
  const chosen = [...items.values()].filter((i) => i.sel); if (!chosen.length) return;
  $('bExp').disabled = true;
  try {
    const clips = []; let n = 0;
    for (const it of chosen) { status(`Preparando ${++n}/${chosen.length}: ${it.name}`); const c = await buildClip(it); const cc = c.clone(); cc.name = encodeName(it.name, it.cat); clips.push(cc); }
    if (new Set(clips.map((c) => c.name)).size !== clips.length) throw new Error('Hay nombres repetidos: renómbralos en la pestaña ★.');
    if (action) { action.stop(); } mixer.stopAllAction(); mixer.uncacheRoot(hero); restorePose();
    status('Creando GLB…');
    const glb = await new Promise((res, rej) => new GLTFExporter().parse(hero, res, rej, { binary: true, animations: clips, onlyVisible: false }));
    download('sera_limpio-anim.glb', new Blob([glb], { type: 'model/gltf-binary' }));
    status(`GLB creado: ${(glb.byteLength / 1e6).toFixed(1)} MB · ${clips.length} animaciones (${CATS.map((c) => chosen.filter((i) => i.cat === c).length + ' ' + CAT_LABEL[c].toLowerCase()).join(' · ')}). Súbelo a assets/characters/hero/.`);
  } catch (e) { showErr('No se pudo crear el GLB: ' + (e.message || e)); } finally { $('bExp').disabled = false; if (cur) play(cur); }
};

// ---------- controles ----------
const setPlaying = (v) => { playing = v; if (action) action.paused = !v; $('bPlay').textContent = v ? '⏸' : '▶'; $('bPlay').classList.toggle('on', v); };
$('bPlay').onclick = () => setPlaying(!playing);
$('bLoop').onclick = (e) => { loop = !loop; e.target.classList.toggle('on', loop); if (cur) play(cur); };
$('bPlace').onclick = (e) => { inPlace = !inPlace; e.target.classList.toggle('on', inPlace); e.target.textContent = inPlace ? 'EN SITIO' : 'CON DESPLAZ.'; for (const i of items.values()) i.cache = null; if (cur) play(cur); };
$('bSet').onclick = (e) => { const a = $('adj'); a.hidden = !a.hidden; e.target.classList.toggle('on', !a.hidden); };
$('bSkel').onclick = (e) => { if (!skel) { skel = new THREE.SkeletonHelper(hero); scene.add(skel); skel.visible = false; } skel.visible = !skel.visible; e.target.classList.toggle('on', skel.visible); };
$('bAuto').onclick = (e) => { auto = !auto; e.target.classList.toggle('on', auto); if (auto) { loop = false; $('bLoop').classList.remove('on'); if (cur) play(cur); else { const v = visible(); if (v[0]) play(v[0]); } } };
$('sp').oninput = (e) => { speed = e.target.value / 100; $('spv').textContent = speed.toFixed(2) + '×'; if (action) action.timeScale = speed; };
$('st').onchange = (e) => { stride = e.target.value / 100; $('stv').textContent = stride.toFixed(2) + '×'; for (const i of items.values()) i.cache = null; if (cur) play(cur); };
$('st').oninput = (e) => { $('stv').textContent = (e.target.value / 100).toFixed(2) + '×'; };
$('tl').oninput = (e) => { if (!action) return; setPlaying(false); const d = action.getClip().duration; action.time = (e.target.value / 1000) * d; action.paused = false; mixer.update(0); action.paused = true; $('tv').textContent = action.time.toFixed(2) + 's'; };

// ---------- arranque ----------
(async () => {
  const gl = await new GLTFLoader().loadAsync(HERO_URL);
  hero = gl.scene; scene.add(hero);
  hero.traverse((o) => {
    if (o.isMesh) { o.frustumCulled = false; for (const m of [].concat(o.material)) m.side = THREE.DoubleSide; }
    if (o.isBone) restPose.push({ b: o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
  });
  hipsRestY = hero.getObjectByName('mixamorigHips').position.y;
  mixer = new THREE.AnimationMixer(hero);
  loadArmor(THREE, GLTFLoader, MeshoptDecoder, hero).then((armor) => {            // armadura por conjuntos para ver las animaciones con ella
    const row = $('armorRow'); const lbl = document.createElement('span'); lbl.textContent = 'ARMADURA'; lbl.style.cssText = 'font-size:10px;color:#c4a574'; row.append(lbl);
    const mk = (row, text, fn, on) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = () => { fn(); sync(); }; row.append(b); return b; };
    const bs = ARMOR_SETS.map((s) => mk(row, ARMOR_LABEL[s], () => armor.toggle(s)));
    const vb = VARIANTS.map((v) => mk(row, VARIANT_LABEL[v], () => armor.setVariant(v)));     // metal: oscuro · hierro · latón
    const bAll = mk(row, 'TODA', () => armor.all(!ARMOR_SETS.every((s) => armor.isWorn(s))));
    // piel que se oculta (antebrazos, muslos…) para que no asome ni atraviese la armadura
    const row2 = row.cloneNode(false); row2.id = 'bodyRow'; row.after(row2);
    const l2 = document.createElement('span'); l2.textContent = 'PIEL OCULTA'; l2.style.cssText = lbl.style.cssText; row2.append(l2);
    const ps = armor.parts.map((p) => mk(row2, PART_LABEL[p], () => armor.togglePart(p)));
    mk(row2, 'TODO EL CUERPO', () => armor.hideAllBody(!armor.parts.every((p) => armor.isHidden(p))));
    const row3 = row.cloneNode(false); row3.id = 'shrinkRow'; row2.after(row3);
    const l3 = document.createElement('span'); l3.style.cssText = lbl.style.cssText; row3.append(l3);
    const sl = document.createElement('input'); sl.type = 'range'; sl.min = 0; sl.max = 30; sl.step = 1; sl.value = Math.round(armor.under.uShrink.value * 1000); sl.style.width = '160px';
    sl.oninput = () => { armor.setShrink(+sl.value); l3.textContent = 'ENCOGER CUERPO ' + sl.value + ' mm'; }; sl.oninput(); row3.append(sl);
    const sync = () => { VARIANTS.forEach((v, i) => vb[i].classList.toggle('on', armor.variant === v)); ARMOR_SETS.forEach((s, i) => bs[i].classList.toggle('on', armor.isWorn(s))); bAll.classList.toggle('on', ARMOR_SETS.every((s) => armor.isWorn(s))); armor.parts.forEach((p, i) => { ps[i].classList.toggle('on', armor.isHidden(p)); ps[i].title = armor.isAutoHidden(p) ? 'oculta por la armadura puesta' : ''; ps[i].style.opacity = armor.isAutoHidden(p) ? 0.7 : 1; }); };
    sync(); window.__armor = armor;
  }).catch((e) => console.warn('armadura no disponible', e));

  const cat = await (await fetch(CATALOG, { cache: 'no-cache' })).json();
  for (const s of cat.sources) {
    const src = { id: s.id, label: s.label, type: 'glb', url: s.url, mb: s.mb, state: 'pend', raw: new Map() }; sources.set(s.id, src);
    for (const c of s.clips) addItem(src, c, norm(c));
  }
  const man = await (await fetch(HERO_DIR + 'manifest.json', { cache: 'no-cache' })).json();
  const mx = { id: 'mixamo', label: 'MIXAMO', type: 'fbx', url: HERO_DIR, state: 'ok', raw: new Map() }; sources.set('mixamo', mx);
  for (const f of man.anims) addItem(mx, f, friendly(f));
  try { applySel(JSON.parse(localStorage.getItem(LS) || '[]')); } catch (e) { /* nada guardado */ }
  renderTabs(); renderList();
  status(`sera_limpio listo · ${items.size} animaciones de ${sources.size} fuentes. Toca el nombre para verla, marca ☑ las que usarás y pulsa CREAR GLB.`);
  window.__lab = { items, sources, play, buildClip, restorePose, get hero() { return hero; }, get mixer() { return mixer; }, get action() { return action; }, scene };
  window.__ready = true;
})().catch((e) => showErr('No se pudo iniciar: ' + (e.message || e)));

let last = performance.now();
(function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mixer && playing && action) mixer.update(dt);
  if (action && cur) {
    const d = action.getClip().duration;
    if (playing) { $('tl').value = Math.min(1000, (action.time % (d + 1e-6)) / d * 1000); $('tv').textContent = action.time.toFixed(2) + 's'; }
    if (auto && !loop && !action.isRunning() && playing) { const v = visible(), i = v.indexOf(cur); if (v.length) play(v[(i + 1) % v.length]); }
  }
  cam.position.set(tgt.x + dist * Math.cos(pitch) * Math.sin(yaw), tgt.y + dist * Math.sin(pitch), tgt.z + dist * Math.cos(pitch) * Math.cos(yaw));
  cam.lookAt(tgt); renderer.render(scene, cam); requestAnimationFrame(frame);
})(performance.now());
