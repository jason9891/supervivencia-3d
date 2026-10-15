import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js';
import { RigEditor, defaultRigCfg, normalizeRigCfg } from './rig-edit.js';

const ENEMY_URL = './assets/characters/tripo_rigging_a71e42e9-2739-425b-a16c-3aa7dba627a6_meshopt.glb';
const TARGET_HEIGHT = 1.9;

const BONE_ORDER = [
  'hips', 'spine', 'spine1', 'spine2', 'neck', 'head', 'jaw',
  'leftShoulder', 'leftArm', 'leftForeArm', 'leftHand',
  'rightShoulder', 'rightArm', 'rightForeArm', 'rightHand',
  'leftUpLeg', 'leftLeg', 'leftFoot',
  'rightUpLeg', 'rightLeg', 'rightFoot',
];
const BONE_ALIASES = {
  hips: ['mixamorig:Hips', 'mixamorig_Hips', 'Hips'],
  spine: ['mixamorig:Spine', 'mixamorig_Spine', 'Spine'],
  spine1: ['mixamorig:Spine1', 'mixamorig_Spine1', 'Spine1'],
  spine2: ['mixamorig:Spine2', 'mixamorig_Spine2', 'Spine2'],
  neck: ['mixamorig:Neck', 'mixamorig_Neck', 'Neck'],
  head: ['mixamorig:Head', 'mixamorig_Head', 'Head'],
  jaw: ['mixamorig:Jaw', 'mixamorigJaw', 'Jaw'],
  leftShoulder: ['mixamorig:LeftShoulder', 'mixamorig_LeftShoulder', 'LeftShoulder'],
  leftArm: ['mixamorig:LeftArm', 'mixamorig_LeftArm', 'LeftArm'],
  leftForeArm: ['mixamorig:LeftForeArm', 'mixamorig_LeftForeArm', 'LeftForeArm'],
  leftHand: ['mixamorig:LeftHand', 'mixamorig_LeftHand', 'LeftHand'],
  rightShoulder: ['mixamorig:RightShoulder', 'mixamorig_RightShoulder', 'RightShoulder'],
  rightArm: ['mixamorig:RightArm', 'mixamorig_RightArm', 'RightArm'],
  rightForeArm: ['mixamorig:RightForeArm', 'mixamorig_RightForeArm', 'RightForeArm'],
  rightHand: ['mixamorig:RightHand', 'mixamorig_RightHand', 'RightHand'],
  leftUpLeg: ['mixamorig:LeftUpLeg', 'mixamorig_LeftUpLeg', 'LeftUpLeg'],
  leftLeg: ['mixamorig:LeftLeg', 'mixamorig_LeftLeg', 'LeftLeg'],
  leftFoot: ['mixamorig:LeftFoot', 'mixamorig_LeftFoot', 'LeftFoot'],
  rightUpLeg: ['mixamorig:RightUpLeg', 'mixamorig_RightUpLeg', 'RightUpLeg'],
  rightLeg: ['mixamorig:RightLeg', 'mixamorig_RightLeg', 'RightLeg'],
  rightFoot: ['mixamorig:RightFoot', 'mixamorig_RightFoot', 'RightFoot'],
};

const statusEl = document.getElementById('status');
const errEl = document.getElementById('err');
function showErr(msg) {
  errEl.style.display = 'block';
  errEl.textContent = msg;
}
addEventListener('error', e => showErr(String(e.message || e)));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171a20);
scene.add(new THREE.HemisphereLight(0xc3d6ee, 0x34251d, 1.6));
const key = new THREE.DirectionalLight(0xffe2bd, 2.6);
key.position.set(-4, 8, 6);
scene.add(key);
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const grid = new THREE.GridHelper(8, 16, 0x444444, 0x2a2a2a);
scene.add(grid);

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 200);
camera.position.set(0, 1.85, 8.2);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
let modelRoot = null;
let boneHelper = null;
let skeletonGroup = null;
let skeletonOn = true;
let skinned = [];
let bones = {};
let rest = new Map();
let restPos = new Map();      // posición local de reposo (para la traslación px/py/pz de un hueso)
let parentInv = new Map();    // gira un desplazamiento del espacio del modelo al espacio local del padre
let rigEd = null;             // RigEditor: pivotes + mandíbula
let rigCfg = defaultRigCfg();
const vTmp = new THREE.Vector3();
let currentPose = {};
let clips = {
  idle: { name: 'idle', duration: 1.0, keys: [] },
  walk: { name: 'walk', duration: 1.0, keys: [] },
  run: { name: 'run', duration: 0.8, keys: [] },
  attack: { name: 'attack', duration: 1.2, keys: [] },
  death: { name: 'death', duration: 1.4, keys: [] },
};
let clipName = 'idle';
let playT = 0;
let playing = false;
let orbitY = 0;
let dragging = false;
let lastX = 0;

const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const qDelta = new THREE.Quaternion();
const eTmp = new THREE.Euler();

function norm(n) {
  return (n || '').toLowerCase().replace(/^mixamorig[:._\-\s]*/, '').replace(/[^a-z0-9]/g, '');
}

function collectBones(root) {
  const byName = new Map();
  const byNorm = new Map();
  root.traverse((o) => {
    if (o.name) {
      byName.set(o.name, o);
      const k = norm(o.name);
      if (k && !byNorm.has(k)) byNorm.set(k, o);
    }
    if (o.isSkinnedMesh && o.skeleton) {
      skinned.push(o);
      o.frustumCulled = false;
      for (const b of o.skeleton.bones) {
        if (!b?.name) continue;
        byName.set(b.name, b);
        const k = norm(b.name);
        if (k) byNorm.set(k, b);
      }
    }
  });
  const out = {};
  for (const [key, names] of Object.entries(BONE_ALIASES)) {
    let found = null;
    for (const n of names) if (byName.has(n)) { found = byName.get(n); break; }
    if (!found) {
      const k = norm(names[0]);
      if (byNorm.has(k)) found = byNorm.get(k);
    }
    if (found) out[key] = found;
  }
  return out;
}

const BONE_PARENT = {
  spine: 'hips', spine1: 'spine', spine2: 'spine1', neck: 'spine2', head: 'neck', jaw: 'head',
  leftShoulder: 'spine2', leftArm: 'leftShoulder', leftForeArm: 'leftArm', leftHand: 'leftForeArm',
  rightShoulder: 'spine2', rightArm: 'rightShoulder', rightForeArm: 'rightArm', rightHand: 'rightForeArm',
  leftUpLeg: 'hips', leftLeg: 'leftUpLeg', leftFoot: 'leftLeg',
  rightUpLeg: 'hips', rightLeg: 'rightUpLeg', rightFoot: 'rightLeg',
};

function captureRest() {
  rest.clear(); restPos.clear(); parentInv.clear();
  const model = modelRoot && modelRoot.children[0];
  if (model) model.updateMatrixWorld(true);
  const mq = model ? model.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  for (const b of Object.values(bones)) {
    rest.set(b, b.quaternion.clone());
    restPos.set(b, b.position.clone());
    if (b.parent) parentInv.set(b, b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(mq));
  }
}

function ensureBoneHelper() {
  if (!boneHelper) {
    boneHelper = new THREE.Group();
    const axes = new THREE.AxesHelper(0.32);
    boneHelper.add(axes);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffcc44, depth: 0.95, transparent: true, depthTest: false })
    );
    ball.renderOrder = 10;
    boneHelper.add(ball);
    scene.add(boneHelper);
  }
  if (!skeletonGroup) {
    skeletonGroup = new THREE.Group();
    skeletonGroup.name = 'skeletonSticks';
    scene.add(skeletonGroup);
  }
}

function updateSkeletonSticks() {
  if (!skeletonGroup || !skeletonOn) {
    if (skeletonGroup) skeletonGroup.visible = false;
    return;
  }
  skeletonGroup.visible = true;
  while (skeletonGroup.children.length) {
    const c = skeletonGroup.children[0];
    skeletonGroup.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
  const sel = document.getElementById('boneSel')?.value;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (const [childKey, parentKey] of Object.entries(BONE_PARENT)) {
    const child = bones[childKey];
    const parent = bones[parentKey];
    if (!child || !parent) continue;
    parent.getWorldPosition(a);
    child.getWorldPosition(b);
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 1e-4) continue;
    const isSel = childKey === sel || parentKey === sel;
    const geo = new THREE.CylinderGeometry(isSel ? 0.018 : 0.01, isSel ? 0.018 : 0.01, len, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: isSel ? 0xffcc44 : 0x66aaff,
      transparent: true,
      opacity: isSel ? 0.95 : 0.55,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 9;
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    skeletonGroup.add(mesh);
    const j = new THREE.Mesh(
      new THREE.SphereGeometry(isSel ? 0.04 : 0.025, 8, 8),
      new THREE.MeshBasicMaterial({ color: isSel ? 0xffee88 : 0xaaddff, opacity: 0.85, transparent: true, depthTest: false })
    );
    j.renderOrder = 10;
    j.position.copy(child.getWorldPosition(new THREE.Vector3()));
    skeletonGroup.add(j);
  }
  if (bones.hips) {
    const j = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: sel === 'hips' ? 0xffee88 : 0xaaddff, opacity: 0.85, transparent: true, depthTest: false })
    );
    j.renderOrder = 10;
    j.position.copy(bones.hips.getWorldPosition(new THREE.Vector3()));
    skeletonGroup.add(j);
  }
}

function updateBoneHelper() {
  ensureBoneHelper();
  updateSkeletonSticks();
  if (!boneHelper) return;
  const key = document.getElementById('boneSel')?.value;
  const b = key && bones[key];
  if (!b) {
    boneHelper.visible = false;
    return;
  }
  boneHelper.visible = true;
  b.updateWorldMatrix(true, false);
  b.getWorldPosition(boneHelper.position);
  b.getWorldQuaternion(boneHelper.quaternion);
}

function applyPose(pose) {
  for (const [b, q] of rest) { b.quaternion.copy(q); b.position.copy(restPos.get(b)); }
  for (const [key, eul] of Object.entries(pose || {})) {
    const b = bones[key];
    if (!b || !rest.has(b)) continue;
    eTmp.set(eul.x || 0, eul.y || 0, eul.z || 0, 'XYZ');
    qDelta.setFromEuler(eTmp);
    b.quaternion.copy(rest.get(b)).multiply(qDelta);
    if (eul.px || eul.py || eul.pz) {   // traslación (unidades del GLB, ejes del modelo: x adelante, y arriba, z lateral)
      vTmp.set(eul.px || 0, eul.py || 0, eul.pz || 0);
      const inv = parentInv.get(b);
      if (inv) vTmp.applyQuaternion(inv);
      b.position.add(vTmp);
    }
  }
  modelRoot?.updateMatrixWorld(true);
  for (const m of skinned) if (m.skeleton) m.skeleton.update();
  updateBoneHelper();
}

function sampleClip(clip, t) {
  if (!clip.keys.length) return {};
  const keys = clip.keys.slice().sort((a, b) => a.t - b.t);
  if (t <= keys[0].t) return { ...keys[0].pose };
  if (t >= keys[keys.length - 1].t) return { ...keys[keys.length - 1].pose };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t < t) i++;
  const a = keys[i], b = keys[i + 1];
  const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
  const out = {};
  const boneSet = new Set([...Object.keys(a.pose), ...Object.keys(b.pose)]);
  for (const k of boneSet) {
    const ea = a.pose[k] || { x: 0, y: 0, z: 0 };
    const eb = b.pose[k] || { x: 0, y: 0, z: 0 };
    out[k] = {
      x: ea.x + (eb.x - ea.x) * u,
      y: ea.y + (eb.y - ea.y) * u,
      z: ea.z + (eb.z - ea.z) * u,
    };
    if (ea.px !== undefined || eb.px !== undefined || ea.py !== undefined || eb.py !== undefined || ea.pz !== undefined || eb.pz !== undefined) {
      for (const c of ['px', 'py', 'pz']) out[k][c] = (ea[c] || 0) + ((eb[c] || 0) - (ea[c] || 0)) * u;
    }
  }
  return out;
}

function getClip() { return clips[clipName]; }

const FRAME = 0.05;
const timelineEl = document.getElementById('timeline');
const frameCount = (clip) => Math.max(1, Math.round(clip.duration / FRAME));

function currentTime() {
  return +(Number(timelineEl.value) * FRAME).toFixed(2);
}

function setTimelineFromT(t) {
  const n = frameCount(getClip());
  const f = Math.max(0, Math.min(n, Math.round(t / FRAME)));
  timelineEl.max = String(n);
  timelineEl.step = '1';
  timelineEl.value = String(f);
  document.getElementById('tVal').textContent = (f * FRAME).toFixed(2) + 's';
}

const keyAt = (clip, t) => clip.keys.find((k) => Math.abs(k.t - t) < FRAME / 2);
function autoKey(commit) {
  const clip = getClip();
  const t = currentTime();
  let k = keyAt(clip, t);
  const created = !k;
  if (created) {
    k = { t, pose: {} };
    clip.keys.push(k);
  }
  if (created || commit) k.pose = JSON.parse(JSON.stringify(currentPose));
  k.t = t;
  clip.keys.sort((a, b) => a.t - b.t);
  return created;
}

function bakeClip(src) {
  const keys = src.keys || [];
  const duration = Math.max(FRAME * 4, Math.round((src.duration || 1) / FRAME) * FRAME);
  const clip = { name: src.name || '', duration: +duration.toFixed(2), keys: [] };
  if (keys.length <= 1) {
    clip.keys = keys.length ? JSON.parse(JSON.stringify(keys)) : [{ t: 0, pose: {} }];
    return clip;
  }
  const n = Math.round(duration / FRAME);
  for (let f = 0; f <= n; f++) {
    clip.keys.push({ t: +(f * FRAME).toFixed(2), pose: JSON.parse(JSON.stringify(sampleClip(src, f * FRAME))) });
  }
  return clip;
}

function refreshKeysBar() {
  const bar = document.getElementById('keysBar');
  bar.innerHTML = '';
  const clip = getClip();
  const cur = currentTime();
  const keys = clip.keys.slice().sort((a, b) => a.t - b.t);
  keys.forEach((k) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'keyDot' + (Math.abs(k.t - cur) < FRAME / 2 ? ' on' : '');
    d.textContent = String(Math.round(k.t / FRAME));
    d.title = k.t.toFixed(2) + 's \u00b7 ' + Object.keys(k.pose).length + ' huesos';
    d.addEventListener('click', () => {
      if (playing) return;
      setTimelineFromT(k.t);
      currentPose = JSON.parse(JSON.stringify(k.pose));
      applyPose(currentPose);
      syncSlidersFromPose();
      refreshKeysBar();
      statusEl.textContent = 'Fotograma ' + Math.round(k.t / FRAME) + ' \u00b7 ' + k.t.toFixed(2) + 's \u00b7 ' + Object.keys(k.pose).length + ' huesos';
    });
    bar.appendChild(d);
  });
}

function syncSlidersFromPose() {
  const key = document.getElementById('boneSel').value;
  const e = currentPose[key] || { x: 0, y: 0, z: 0 };
  document.getElementById('rx').value = Math.round(deg(e.x));
  document.getElementById('ry').value = Math.round(deg(e.y));
  document.getElementById('rz').value = Math.round(deg(e.z));
  document.getElementById('rxv').textContent = Math.round(deg(e.x)) + '\u00b0';
  document.getElementById('ryv').textContent = Math.round(deg(e.y)) + '\u00b0';
  document.getElementById('rzv').textContent = Math.round(deg(e.z)) + '\u00b0';
  const isHips = key === 'hips';
  document.getElementById('posRows').hidden = !isHips;
  if (isHips) for (const c of ['px', 'py', 'pz']) { document.getElementById(c).value = Math.round((e[c] || 0) * 1000); showVal(c); }
}
// Texto junto al slider: grados para giros, cm (del modelo ya escalado) para traslación y pivote.
const modelScale = () => (modelRoot && modelRoot.children[0] ? modelRoot.children[0].scale.x : 1);
function showVal(id) {
  const v = Number(document.getElementById(id).value);
  document.getElementById(id + 'v').textContent = id[0] === 'r' ? v + '\u00b0' : (v * modelScale() / 10).toFixed(1) + ' cm';
}

function readSlidersToPose() {
  const key = document.getElementById('boneSel').value;
  currentPose[key] = {
    x: rad(Number(document.getElementById('rx').value)),
    y: rad(Number(document.getElementById('ry').value)),
    z: rad(Number(document.getElementById('rz').value)),
  };
  if (key === 'hips') for (const c of ['px', 'py', 'pz']) currentPose[key][c] = Number(document.getElementById(c).value) / 1000;
  applyPose(currentPose);
  autoKey(true);
  refreshKeysBar();
}

function fitModel(model) {
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.frustumCulled = false;
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  let bounds = new THREE.Box3().setFromObject(model);
  let size = bounds.getSize(new THREE.Vector3());
  if (size.y > 1e-4) {
    const s = TARGET_HEIGHT / size.y;
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(model);
    const c = bounds.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.y -= bounds.min.y;
    model.position.z -= c.z;
  }
}

function genClipIdle() {
  const dur = 1.0;
  const keys = [];
  const n = Math.round(dur / FRAME);
  for (let f = 0; f <= n; f++) {
    const t = +(f * FRAME).toFixed(2);
    const w = Math.sin((f / Math.max(1, n)) * Math.PI * 2);
    keys.push({
      t,
      pose: {
        spine: { x: 0.03 * w, y: 0, z: 0 },
        head: { x: 0.02 * Math.sin(w * 1.5), y: 0, z: 0 },
        leftArm: { x: 0, y: 0, z: -0.15 + 0.04 * w },
        rightArm: { x: 0, y: 0, z: 0.15 - 0.04 * w },
      },
    });
  }
  return { name: 'idle', duration: dur, keys };
}

function genClipWalk() {
  const dur = 1.0;
  const keys = [];
  const n = Math.round(dur / FRAME);
  for (let f = 0; f <= n; f++) {
    const t = +(f * FRAME).toFixed(2);
    const phase = (f / Math.max(1, n)) * Math.PI * 2;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    keys.push({
      t,
      pose: {
        hips: { x: 0, y: 0.06 * s, z: 0 },
        spine: { x: 0.04 * c, y: 0, z: 0.05 * s },
        leftUpLeg: { x: 0.55 * s, y: 0, z: 0 },
        leftLeg: { x: 0.35 * Math.max(0, -s), y: 0, z: 0 },
        rightUpLeg: { x: -0.55 * s, y: 0, z: 0 },
        rightLeg: { x: 0.35 * Math.max(0, s), y: 0, z: 0 },
        leftArm: { x: -0.4 * s, y: 0, z: -0.2 },
        leftForeArm: { x: -0.25 * Math.max(0, s), y: 0, z: 0 },
        rightArm: { x: 0.4 * s, y: 0, z: 0.2 },
        rightForeArm: { x: -0.25 * Math.max(0, -s), y: 0, z: 0 },
      },
    });
  }
  return { name: 'walk', duration: dur, keys };
}

function genClipAttack() {
  const dur = 1.2;
  const keys = [];
  const poses = [
    { t: 0.0, pose: {} },
    { t: 0.15, pose: {
      spine: { x: -0.15, y: 0, z: 0 },
      rightArm: { x: -0.6, y: 0, z: -1.0 },
      rightForeArm: { x: -0.8, y: 0, z: 0 },
      leftArm: { x: -0.3, y: 0, z: -0.5 },
    }},
    { t: 0.35, pose: {
      spine: { x: -0.25, y: 0, z: 0.1 },
      rightArm: { x: -0.9, y: 0.2, z: -1.4 },
      rightForeArm: { x: -1.1, y: 0, z: 0 },
      leftArm: { x: -0.5, y: 0, z: -0.8 },
      leftForeArm: { x: -0.4, y: 0, z: 0 },
    }},
    { t: 0.5, pose: {
      spine: { x: 0.35, y: 0, z: 0 },
      rightArm: { x: -0.4, y: 0, z: -1.6 },
      rightForeArm: { x: -1.3, y: 0, z: 0 },
      leftArm: { x: -0.4, y: 0, z: -1.5 },
      leftForeArm: { x: -1.2, y: 0, z: 0 },
    }},
    { t: 0.75, pose: {
      spine: { x: 0.15, y: 0, z: 0 },
      rightArm: { x: -0.2, y: 0, z: -0.8 },
      rightForeArm: { x: -0.5, y: 0, z: 0 },
      leftArm: { x: -0.2, y: 0, z: -0.7 },
    }},
    { t: 1.2, pose: {} },
  ];
  const tmp = { keys: poses };
  const n = Math.round(dur / FRAME);
  for (let f = 0; f <= n; f++) {
    const t = +(f * FRAME).toFixed(2);
    keys.push({ t, pose: sampleClip(tmp, t) });
  }
  return { name: 'attack', duration: dur, keys };
}

function applyGenerated(clipNameTarget, genFn) {
  const clip = genFn();
  clips[clipNameTarget] = clip;
  document.getElementById('clipSel').value = clipNameTarget;
  clipName = clipNameTarget;
  document.getElementById('dur').value = String(Math.round(clip.duration * 100));
  document.getElementById('durVal').textContent = clip.duration.toFixed(2) + 's';
  setTimelineFromT(0);
  currentPose = sampleClip(clip, 0);
  applyPose(currentPose);
  syncSlidersFromPose();
  refreshKeysBar();
  statusEl.textContent = 'Generado ' + clipNameTarget + ' \u00b7 ' + clip.keys.length + ' fotogramas \u00b7 edita con sliders';
}

async function load() {
  if (MeshoptDecoder.ready) await MeshoptDecoder.ready;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  statusEl.textContent = 'Cargando GLB\u2026';
  const gltf = await new Promise((res, rej) => loader.load(ENEMY_URL, res, undefined, rej));
  const model = gltf.scene;
  fitModel(model);
  modelRoot = new THREE.Group();
  modelRoot.add(model);
  modelRoot.position.set(MV_HOME.x, MV_HOME.y, MV_HOME.z);
  scene.add(modelRoot);
  showMv();
  bones = collectBones(modelRoot);
  captureRest();
  ensureBoneHelper();
  if (skinned[0]) rigEd = new RigEditor(model, skinned[0], bones);
  rebuildRig();   // añade el hueso de mandíbula y aplica la estructura guardada
  fillBoneSel();
  for (const c of Object.values(clips)) {
    if (!c.keys.length) c.keys.push({ t: 0, pose: {} });
  }
  setTimelineFromT(0);
  refreshKeysBar();
  applyPose({});
  statusEl.textContent =
    'Stop-motion listo \u00b7 ' + Object.keys(bones).length + ' huesos \u00b7 elige hueso, mueve sliders; cada fotograma (0.05 s) se guarda solo';
}

function fillBoneSel() {
  const sel = document.getElementById('boneSel');
  const prev = sel.value;
  sel.innerHTML = '';
  for (const k of BONE_ORDER) {
    if (!bones[k]) continue;
    const o = document.createElement('option');
    o.value = k;
    o.textContent = k;
    sel.appendChild(o);
  }
  sel.value = bones[prev] ? prev : 'head';
}

// --- Estructura: pivotes reubicados + mandíbula (RigEditor reconstruye el esqueleto desde el GLB original en cada cambio) ---
function rebuildRig() {
  if (!rigEd) return;
  const jaw = rigEd.build(rigCfg);
  if (jaw) bones.jaw = jaw; else delete bones.jaw;
  captureRest();
  fillBoneSel();
  applyPose(currentPose);
  syncRigUI();
}
function syncRigUI() {
  const key = document.getElementById('boneSel').value;
  document.getElementById('rigBone').textContent = key.toUpperCase();
  const o = rigCfg.offsets[key] || [0, 0, 0];
  ['ox', 'oy', 'oz'].forEach((id, i) => { document.getElementById(id).value = String(Math.round(o[i] * 1000)); showVal(id); });
  const j = rigCfg.jaw;
  document.getElementById('jawOn').textContent = 'MANDÍBULA: ' + (j.enabled ? 'ON' : 'OFF');
  document.getElementById('jawOn').classList.toggle('on', j.enabled);
  document.getElementById('jPlane').value = String(Math.round(j.planeY * 1000));
  document.getElementById('jStart').value = String(Math.round(j.startX * 1000));
  document.getElementById('jHalf').value = String(Math.round(j.halfWidth * 1000));
  document.getElementById('jPlaneV').textContent = j.planeY.toFixed(3);
  document.getElementById('jStartV').textContent = j.startX.toFixed(3);
  document.getElementById('jHalfV').textContent = j.halfWidth.toFixed(3);
}
function setOffset(i, v) {
  const key = document.getElementById('boneSel').value;
  const o = (rigCfg.offsets[key] || [0, 0, 0]).slice();
  o[i] = v / 1000;
  if (o.every((a) => Math.abs(a) < 1e-9)) delete rigCfg.offsets[key]; else rigCfg.offsets[key] = o;
  rebuildRig();
}
['ox', 'oy', 'oz'].forEach((id, i) => document.getElementById(id).addEventListener('input', () => setOffset(i, Number(document.getElementById(id).value))));
document.querySelectorAll('button.step[data-off]').forEach((btn) => holdRepeat(btn, () => {
  const i = Number(btn.dataset.off), el = document.getElementById(['ox', 'oy', 'oz'][i]);
  setOffset(i, Math.max(Number(el.min), Math.min(Number(el.max), Number(el.value) + Number(btn.dataset.d))));
}));
document.getElementById('rigResetBone').addEventListener('click', () => {
  delete rigCfg.offsets[document.getElementById('boneSel').value];
  rebuildRig();
  statusEl.textContent = 'Pivote de ' + document.getElementById('boneSel').value + ' vuelto al original';
});
document.getElementById('rigResetAll').addEventListener('click', () => {
  rigCfg = defaultRigCfg();
  rebuildRig();
  statusEl.textContent = 'Estructura vuelta al original (con mandíbula)';
});
document.getElementById('jawOn').addEventListener('click', () => {
  rigCfg.jaw.enabled = !rigCfg.jaw.enabled;
  rebuildRig();
  statusEl.textContent = rigCfg.jaw.enabled ? 'Mandíbula activa: elige el hueso «jaw»' : 'Mandíbula desactivada';
});
let zoneOn = false;
document.getElementById('jawZone').addEventListener('click', () => {
  zoneOn = !zoneOn;
  rigEd?.setZoneView(zoneOn);
  document.getElementById('jawZone').classList.toggle('on', zoneOn);
});
for (const [id, field] of [['jPlane', 'planeY'], ['jStart', 'startX'], ['jHalf', 'halfWidth']]) {
  document.getElementById(id).addEventListener('input', () => {
    rigCfg.jaw[field] = Number(document.getElementById(id).value) / 1000;
    rebuildRig();
  });
}
document.getElementById('btnRig').addEventListener('click', () => {
  const p = document.getElementById('rigPanel');
  p.hidden = !p.hidden;
  document.getElementById('btnRig').classList.toggle('on', !p.hidden);
  if (!p.hidden) { syncRigUI(); if (!bones.jaw) statusEl.textContent = 'Activa la mandíbula para animarla'; }
});

const MV_STEP = 0.1;
const MV_HOME = { x: 0, y: 0.55, z: 0 };
function showMv() {
  if (!modelRoot) return;
  document.getElementById('mvPos').textContent = ['x', 'y', 'z'].map((a) => modelRoot.position[a].toFixed(1)).join(' \u00b7 ');
}
function moveModel(axis, dir) {
  if (!modelRoot) return;
  modelRoot.position[axis] += dir * MV_STEP;
  showMv();
}
function holdRepeat(btn, fn) {
  let t1 = 0, t2 = 0;
  const stop = () => { clearTimeout(t1); clearInterval(t2); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fn();
    t1 = setTimeout(() => { t2 = setInterval(fn, 70); }, 350);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
}
document.querySelectorAll('[data-mv]').forEach((b) => holdRepeat(b, () => moveModel(b.dataset.mv, Number(b.dataset.d))));
document.getElementById('mvReset').addEventListener('click', () => {
  if (!modelRoot) return;
  modelRoot.position.set(MV_HOME.x, MV_HOME.y, MV_HOME.z);
  showMv();
});

['rx', 'ry', 'rz', 'px', 'py', 'pz'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    if (playing) return;
    showVal(id);
    readSlidersToPose();
  });
});

document.querySelectorAll('button.step').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (playing) return;
    if (btn.dataset.time !== undefined) {
      const dir = Number(btn.dataset.time);
      const el = document.getElementById('timeline');
      let v = Number(el.value) + dir;
      v = Math.max(0, Math.min(Number(el.max), v));
      el.value = String(v);
      el.dispatchEvent(new Event('input'));
      return;
    }
    if (btn.dataset.off !== undefined) return;   // los − / + del panel ESTRUCTURA van aparte
    const id = btn.dataset.axis;
    const d = Number(btn.dataset.d);
    const el = document.getElementById(id);
    let v = Number(el.value) + d;
    v = Math.max(Number(el.min), Math.min(Number(el.max), v));
    el.value = String(v);
    showVal(id);
    readSlidersToPose();
  });
});

document.getElementById('boneSel').addEventListener('change', () => {
  syncSlidersFromPose();
  syncRigUI();
  updateBoneHelper();
  statusEl.textContent = 'Hueso: ' + document.getElementById('boneSel').value;
});

document.getElementById('skelOn').addEventListener('click', () => {
  skeletonOn = !skeletonOn;
  document.getElementById('skelOn').classList.toggle('on', skeletonOn);
  updateBoneHelper();
  statusEl.textContent = skeletonOn ? 'Esqueleto visible' : 'Esqueleto oculto';
});
document.getElementById('genIdle').addEventListener('click', () => applyGenerated('idle', genClipIdle));
document.getElementById('genWalk').addEventListener('click', () => applyGenerated('walk', genClipWalk));
document.getElementById('genAttack').addEventListener('click', () => applyGenerated('attack', genClipAttack));

timelineEl.addEventListener('input', () => {
  if (playing) return;
  const t = currentTime();
  document.getElementById('tVal').textContent = t.toFixed(2) + 's';
  currentPose = sampleClip(getClip(), t);
  applyPose(currentPose);
  syncSlidersFromPose();
  const created = autoKey(false);
  refreshKeysBar();
  statusEl.textContent = 'Fotograma ' + Math.round(t / FRAME) + '/' + frameCount(getClip()) + ' \u00b7 ' + t.toFixed(2) + 's' + (created ? ' \u00b7 key nueva' : '');
});

document.getElementById('dur').addEventListener('input', () => {
  const d = Number(document.getElementById('dur').value) / 100;
  getClip().duration = d;
  document.getElementById('durVal').textContent = d.toFixed(2) + 's';
  setTimelineFromT(currentTime());
});

document.getElementById('clipSel').addEventListener('change', () => {
  playing = false;
  document.getElementById('btnPlay').textContent = '\u25b6 PLAY';
  clipName = document.getElementById('clipSel').value;
  const c = getClip();
  document.getElementById('dur').value = String(Math.round(c.duration * 100));
  document.getElementById('durVal').textContent = c.duration.toFixed(2) + 's';
  setTimelineFromT(0);
  currentPose = sampleClip(c, 0);
  applyPose(currentPose);
  syncSlidersFromPose();
  refreshKeysBar();
  statusEl.textContent = 'Clip: ' + clipName + ' \u00b7 ' + c.keys.length + ' keys';
});

document.getElementById('btnKey').addEventListener('click', () => {
  autoKey(true);
  refreshKeysBar();
  statusEl.textContent = 'Key @ ' + currentTime().toFixed(2) + 's';
});

document.getElementById('btnDel').addEventListener('click', () => {
  const t = currentTime();
  const clip = getClip();
  const before = clip.keys.length;
  clip.keys = clip.keys.filter((k) => Math.abs(k.t - t) > FRAME / 2);
  if (!clip.keys.length) clip.keys.push({ t: 0, pose: {} });
  currentPose = sampleClip(clip, t);
  applyPose(currentPose);
  syncSlidersFromPose();
  refreshKeysBar();
  statusEl.textContent =
    before === clip.keys.length ? 'No hab\u00eda key cerca' : 'Key borrada \u00b7 quedan ' + clip.keys.length;
});

document.getElementById('btnPlay').addEventListener('click', () => {
  playing = !playing;
  document.getElementById('btnPlay').textContent = playing ? '\u23f8 STOP' : '\u25b6 PLAY';
  document.getElementById('btnPlay').classList.toggle('on', playing);
  if (playing) playT = currentTime();
});

document.getElementById('btnResetPose').addEventListener('click', () => {
  currentPose = {};
  applyPose(currentPose);
  syncSlidersFromPose();
  statusEl.textContent = 'Pose en REST (bind)';
});

document.getElementById('btnExport').addEventListener('click', () => {
  const data = { version: 2, rig: 'mixamo', model: ENEMY_URL, rigEdit: rigCfg, clips };   // rigEdit = pivotes reubicados + mandíbula
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'enemy-clips.json';
  a.click();
  URL.revokeObjectURL(a.href);
  statusEl.textContent = 'Exportado enemy-clips.json';
});

document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('fileIn').click();
});

function importClips(data, pick) {
  if (data && data.rigEdit) { rigCfg = normalizeRigCfg(data.rigEdit); rebuildRig(); }   // estructura guardada con las animaciones
  if (!data || !data.clips) throw new Error('El JSON no trae "clips"');
  for (const [k, v] of Object.entries(data.clips)) clips[k] = bakeClip(v);
  const sel = document.getElementById('clipSel');
  for (const k of Object.keys(clips)) {
    if (![...sel.options].some((o) => o.value === k)) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = 'Clip: ' + k;
      sel.appendChild(o);
    }
  }
  if (pick && clips[pick]) sel.value = pick;
  sel.dispatchEvent(new Event('change'));
  statusEl.textContent = 'Importado \u00b7 clips: ' + Object.keys(clips).join(', ');
}
document.getElementById('fileIn').addEventListener('change', async (ev) => {
  const f = ev.target.files?.[0];
  if (!f) return;
  try {
    importClips(JSON.parse(await f.text()));
  } catch (e) {
    showErr('Import fall\u00f3: ' + (e.message || e));
  }
});

document.getElementById('btnExample').addEventListener('click', async () => {
  try {
    const res = await fetch('./assets/anims/monster-walk.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    importClips(await res.json(), 'walk');
    statusEl.textContent = 'Caminata realista cargada \u00b7 24 fotogramas, pies plantados \u00b7 \u25b6 PLAY; la cadera tambi\u00e9n traslada (PX/PY/PZ)';
  } catch (e) {
    showErr('No se pudo cargar el ejemplo: ' + (e.message || e));
  }
});

document.getElementById('back').addEventListener('click', () => { location.href = './index.html'; });
document.getElementById('toLab').addEventListener('click', () => { location.href = './enemy-lab.html'; });

renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  orbitY += (e.clientX - lastX) * 0.01;
  lastX = e.clientX;
  if (modelRoot) modelRoot.rotation.y = orbitY;
});
const stopDrag = () => { dragging = false; };
renderer.domElement.addEventListener('pointerup', stopDrag);
renderer.domElement.addEventListener('pointercancel', stopDrag);
renderer.domElement.addEventListener('wheel', (e) => {
  camera.position.z = Math.max(2.5, Math.min(18, camera.position.z + e.deltaY * 0.008));
});

// Encuadre: el monstruo es largo (mira hacia +X), así que en pantallas verticales se aleja la cámara; y se centra en el hueco libre entre
// la barra de arriba y el panel de abajo, para que el panel ESTRUCTURA no tape al modelo.
function fitDistance() {
  camera.position.z = Math.max(8.2, 3.8 / (0.63 * (innerWidth / innerHeight)));
}
function fitView() {
  const top = document.getElementById('hud').getBoundingClientRect().bottom;
  const bottom = document.getElementById('panel').getBoundingClientRect().top;
  camera.setViewOffset(innerWidth, innerHeight, 0, Math.round(innerHeight / 2 - (top + bottom) / 2), innerWidth, innerHeight);
}
fitDistance();
new ResizeObserver(fitView).observe(document.getElementById('panel'));
new ResizeObserver(fitView).observe(document.getElementById('hud'));
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fitDistance();
  fitView();
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (playing) {
    const clip = getClip();
    playT += dt;
    if (playT > clip.duration) playT = 0;
    setTimelineFromT(playT);
    currentPose = sampleClip(clip, playT);
    applyPose(currentPose);
    syncSlidersFromPose();
  }
  updateBoneHelper();
  camera.lookAt(0, TARGET_HEIGHT * 0.72 + 0.55, 0);
  renderer.render(scene, camera);
}
animate();
load().catch((e) => showErr('Load: ' + (e.message || e)));
