// armor-wear.js — armadura del héroe por conjuntos: casco, pechera, brazos, piernas (las piernas incluyen las botas).
// assets/characters/hero/armadura2-sera.glb lo hornea tools/bake-armor.py: 16 piezas ajustadas al cuerpo de sera_limpio y con piel
// (pesos copiados del cuerpo), así que se doblan con cualquier animación. Aquí se enganchan al esqueleto del personaje cargado
// (los huesos se buscan por nombre) y se muestran u ocultan por conjunto.
export const ARMOR_URL = './assets/characters/hero/armadura2-sera.glb';
export const ARMOR_SETS = ['casco', 'pechera', 'brazos', 'piernas'];
export const ARMOR_LABEL = { casco: 'CASCO', pechera: 'PECHERA', brazos: 'BRAZOS', piernas: 'PIERNAS' };
const LS = 'armor-worn-v1';
export const UNDER = { shrink: 0.014, tint: [0.2, 0.17, 0.15] };   // el cuerpo bajo la armadura: se encoge (m) y se tiñe de tela acolchada
// huesos que cubre cada conjunto (el peso de piel de cada vértice decide cuánto le afecta; así el borde es suave)
const REGION = [/^(Head|HeadTop_End)$/, /^(Hips|Spine\d?|Neck|(Left|Right)Shoulder)$/, /^(Left|Right)(Arm|ForeArm)$/, /^(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe_End)$/];   // casco, pechera, brazos, piernas
// partes del cuerpo que se pueden ocultar (cada vértice pertenece a la de mayor peso de piel): evita que la piel asome o atraviese la armadura
export const BODY_PARTS = ['cabeza', 'torso', 'brazos', 'antebrazos', 'manos', 'muslos', 'piernas', 'pies'];
export const PART_LABEL = { cabeza: 'CABEZA', torso: 'TORSO', brazos: 'BRAZOS', antebrazos: 'ANTEBRAZOS', manos: 'MANOS', muslos: 'MUSLOS', piernas: 'PIERNAS', pies: 'PIES' };
const PART_RE = [/^(Head|HeadTop_End)$/, /^(Hips|Spine\d?|Neck|(Left|Right)Shoulder)$/, /^(Left|Right)Arm$/, /^(Left|Right)ForeArm$/, /^(Left|Right)Hand/, /^(Left|Right)UpLeg$/, /^(Left|Right)Leg$/, /^(Left|Right)(Foot|ToeBase|Toe_End)$/];
const LSH = 'armor-hide-v2';                                       // ocultar a mano (extra a lo automático)
export const GLARE = { knee: 0.04, slope: 0.18 };                  // las texturas traen brillos horneados muy claros: sobre la luz del juego se queman («despintado»); se comprimen por encima de «knee» (lineal)
const AUTO_HIDE = { pechera: ['torso'], brazos: ['brazos', 'antebrazos'], piernas: ['muslos', 'piernas', 'pies'] };   // piel que desaparece con cada conjunto (la cabeza y las manos siempre se ven)
const TINT_AMT = [0, 1, 1, 1];                                  // el casco solo encoge: por la visera se ve la cara

/** Prepara el cuerpo del héroe: atributo de región por vértice + shader que lo encoge y tiñe según los conjuntos puestos. */
function prepareBody(THREE, hero) {
  const uniforms = { uWorn: { value: new THREE.Vector4() }, uShrink: { value: UNDER.shrink }, uTint: { value: new THREE.Color(...UNDER.tint) }, uTintAmt: { value: new THREE.Vector4(...TINT_AMT) }, uHide: { value: new Array(8).fill(0) } };
  hero.traverse((o) => {
    if (!o.isSkinnedMesh || o.userData.armor) return;
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count, names = o.skeleton.bones.map((b) => b.name.replace(/^mixamorig/, ''));
    const reg = names.map((nm) => REGION.findIndex((r) => r.test(nm))), A = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const r = reg[si.getComponent(i, k)]; if (r >= 0) A[i * 4 + r] += sw.getComponent(i, k); }
    g.setAttribute('aRegW', new THREE.BufferAttribute(A, 4));
    const pr = names.map((nm) => PART_RE.findIndex((r) => r.test(nm))), P = new Float32Array(n), acc = new Float32Array(8);
    for (let i = 0; i < n; i++) { acc.fill(0); for (let k = 0; k < 4; k++) { const r = pr[si.getComponent(i, k)]; if (r >= 0) acc[r] += sw.getComponent(i, k); } let b = 1; for (let r = 0; r < 8; r++) if (acc[r] > acc[b]) b = r; P[i] = b; }
    g.setAttribute('aPart', new THREE.BufferAttribute(P, 1));
    const mat = o.material = o.material.clone();
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aRegW; attribute float aPart; uniform float uHide[8]; varying float vHide; uniform vec4 uWorn; uniform float uShrink; uniform vec4 uTintAmt; varying float vTint;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHide = uHide[int(aPart + 0.5)]; float kShr = clamp(dot(aRegW, uWorn), 0.0, 1.0); transformed -= normalize(objectNormal) * uShrink * kShr; vTint = clamp(dot(aRegW * uWorn, uTintAmt), 0.0, 1.0);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vTint; varying float vHide; uniform vec3 uTint;')
        .replace('void main() {', 'void main() {\n  if (vHide > 0.5) discard;')
        .replace('#include <map_fragment>', '#include <map_fragment>\nfloat lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = mix(diffuseColor.rgb, uTint * (0.75 + 0.9 * lum), vTint);');
    };
    mat.customProgramCacheKey = () => 'armor-under';
    mat.needsUpdate = true;
  });
  return uniforms;
}

/** hero: el nodo raíz del personaje (el de sus huesos mixamorig…). Devuelve { sets, isWorn, wear, toggle, all, root }. */
export async function loadArmor(THREE, GLTFLoader, MeshoptDecoder, hero, { url = ARMOR_URL, worn } = {}) {
  if (MeshoptDecoder && MeshoptDecoder.ready) await MeshoptDecoder.ready;
  const loader = new GLTFLoader(); if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
  const uni = prepareBody(THREE, hero), glareU = [];
  const tameGlare = (mat) => {                                    // comprime los brillos horneados de la textura (por encima de GLARE.knee, en lineal)
    if (mat.userData.glare) return; mat.userData.glare = true;
    const u = { uGlare: { value: GLARE.slope }, uKnee: { value: GLARE.knee } }; glareU.push(u);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlare; uniform float uKnee;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n{ float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); float t = uKnee + max(l - uKnee, 0.0) * uGlare; diffuseColor.rgb *= min(1.0, t / max(l, 1e-4)); }');
    };
    mat.customProgramCacheKey = () => 'armor-glare'; mat.needsUpdate = true;
  };
  const heroBones = new Map(); hero.traverse((o) => { if (o.isBone) heroBones.set(o.name, o); });
  const root = new THREE.Group(); root.name = 'armadura'; hero.add(root);
  const sets = Object.fromEntries(ARMOR_SETS.map((s) => [s, []]));
  const meshes = []; gltf.scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  for (const m of meshes) {
    const bones = m.skeleton.bones.map((b) => heroBones.get(b.name));
    if (bones.some((b) => !b)) throw new Error('la armadura usa huesos que el personaje no tiene');
    m.removeFromParent();
    m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), new THREE.Matrix4());   // vértices en reposo del mundo, bindMatrix = I (modo «attached»)
    m.userData.armor = true; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    for (const mat of [].concat(m.material)) { mat.side = THREE.DoubleSide; tameGlare(mat); }
    const set = m.userData.set || m.name.split('_')[0];
    (sets[set] || (sets[set] = [])).push(m); root.add(m);
  }
  let state = {};
  try { state = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { /* sin almacenamiento */ }
  if (worn) state = { ...state, ...worn };
  let hidden = {};
  const autoSet = () => { const h = new Set(); for (const k of ARMOR_SETS) if (state[k]) (AUTO_HIDE[k] || []).forEach((q) => h.add(q)); return h; };
  const applyHide = () => { const a = autoSet(); BODY_PARTS.forEach((q, i) => { uni.uHide.value[i] = a.has(q) || hidden[q] ? 1 : 0; }); };
  try { hidden = JSON.parse(localStorage.getItem(LSH) || '{}'); } catch (e) { /* sin almacenamiento */ }
  const api = {
    root, sets, under: uni,                                    // under.uShrink.value (m) y under.uTint.value ajustables
    setShrink(mm) { uni.uShrink.value = mm / 1000; },
    isWorn: (s) => !!state[s],
    wear(s, v) { state[s] = !!v; for (const m of sets[s] || []) m.visible = !!v; const i = ARMOR_SETS.indexOf(s); if (i >= 0) uni.uWorn.value.setComponent(i, v ? 1 : 0); applyHide(); try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { /* nada */ } return !!v; },
    toggle(s) { return api.wear(s, !state[s]); },
    parts: BODY_PARTS,
    /** ¿se ve la piel de esta parte? (oculta si un conjunto puesto la tapa o si se ocultó a mano) */
    isHidden: (p) => autoSet().has(p) || !!hidden[p],
    isAutoHidden: (p) => autoSet().has(p),
    hidePart(p, v) { hidden[p] = !!v; applyHide(); try { localStorage.setItem(LSH, JSON.stringify(hidden)); } catch (e) { /* nada */ } return !!v; },
    togglePart: (p) => api.hidePart(p, !hidden[p] && !autoSet().has(p)),
    hideAllBody(v) { for (const p of BODY_PARTS) hidden[p] = !!v; applyHide(); try { localStorage.setItem(LSH, JSON.stringify(hidden)); } catch (e) { /* nada */ } },
    setGlare(slope) { for (const u of glareU) u.uGlare.value = slope; },
    all(v) { for (const s of ARMOR_SETS) api.wear(s, v); },
  };
  for (const s of ARMOR_SETS) api.wear(s, !!state[s]);
  applyHide();
  return api;
}
