// retarget.js — lleva animaciones de otros esqueletos a un personaje con huesos «mixamorig…» (en metros).
//  · UalRetargeter: esqueleto UAL/Quaternius (UAL1, UAL2, Jordan) → mixamorig, por giros en el mundo respecto al reposo.
//  · mixamoClip: animaciones FBX de Mixamo (mismos huesos): escala de caderas, movimiento en sitio, sin escala ni posiciones de otros huesos.
import * as THREE from 'three';

const SIDE = { l: 'Left', r: 'Right' };
export function ualMap(src) {            // hueso UAL → nombre mixamorig
  const m = { pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', Head: 'Head', head: 'Head' };
  for (const [k, S] of Object.entries(SIDE)) {
    Object.assign(m, { ['clavicle_' + k]: S + 'Shoulder', ['upperarm_' + k]: S + 'Arm', ['lowerarm_' + k]: S + 'ForeArm', ['hand_' + k]: S + 'Hand', ['thigh_' + k]: S + 'UpLeg', ['calf_' + k]: S + 'Leg', ['foot_' + k]: S + 'Foot', ['ball_' + k]: S + 'ToeBase', ['ball_leaf_' + k]: S + 'Toe_End' });
    for (const [f, F] of Object.entries({ thumb: 'Thumb', index: 'Index', middle: 'Middle', ring: 'Ring', pinky: 'Pinky' })) {
      for (let i = 1; i <= 3; i++) m[`${f}_0${i}_${k}`] = `${S}Hand${F}${i}`;
      m[`${f}_04_leaf_${k}`] = `${S}Hand${F}4`;
    }
  }
  const out = new Map(); for (const [a, b] of Object.entries(m)) { const sb = src.getObjectByName(a); if (sb) out.set(sb, 'mixamorig' + b); } return out;
}

export const isLoco = (n) => /walk|jog|sprint|run|zombie/i.test(n);

export class UalRetargeter {
  /** srcRoot: escena del GLB UAL (en reposo). tgtRoot: personaje mixamorig en reposo. */
  constructor(srcRoot, tgtRoot) {
    srcRoot.updateMatrixWorld(true); tgtRoot.updateMatrixWorld(true);
    this.src = srcRoot; this.smap = ualMap(srcRoot);
    this.tBones = []; tgtRoot.traverse((o) => { if (o.isBone) this.tBones.push(o); });
    this.sRest = new Map(); this.tRestW = new Map(); this.tRestL = new Map();
    for (const sb of this.smap.keys()) this.sRest.set(sb, sb.getWorldQuaternion(new THREE.Quaternion()));
    for (const tb of this.tBones) { this.tRestW.set(tb, tb.getWorldQuaternion(new THREE.Quaternion())); this.tRestL.set(tb, tb.quaternion.clone()); }
    this.byT = new Map(); for (const [sb, name] of this.smap) { const tb = tgtRoot.getObjectByName(name); if (tb) this.byT.set(tb, sb); }
    this.pel = srcRoot.getObjectByName('pelvis'); this.p0 = this.pel.getWorldPosition(new THREE.Vector3());
    this.hips = tgtRoot.getObjectByName('mixamorigHips'); this.hipsRest = this.hips.position.clone();
    this.kPos = this.hipsRest.y / this.p0.y;
    this.mixer = new THREE.AnimationMixer(srcRoot);
  }
  /** stride: 1 = tal cual; >1 alarga el paso (muslos y rodillas) en clips de caminar/correr. */
  retarget(clip, name = clip.name, stride = 1) {
    const { tBones, byT, sRest, tRestW, tRestL, pel, p0, hipsRest, kPos, mixer } = this;
    const a = mixer.clipAction(clip); a.play();
    const FPS = 30, n = Math.max(2, Math.ceil(clip.duration * FPS) + 1), times = new Float32Array(n);
    const qs = new Map(tBones.map((b) => [b, new Float32Array(n * 4)])), pos = new Float32Array(n * 3);
    const loco = stride !== 1 && isLoco(clip.name);
    for (let i = 0; i < n; i++) {
      const t = Math.min(clip.duration, i / FPS); times[i] = t;
      a.time = t; mixer.update(0); this.src.updateMatrixWorld(true);
      const wAnim = new Map();
      for (const tb of tBones) {
        const parentW = wAnim.get(tb.parent) || new THREE.Quaternion();
        const sb = byT.get(tb); let local;
        if (sb) {
          let d = sb.getWorldQuaternion(new THREE.Quaternion()).multiply(sRest.get(sb).clone().invert());
          if (loco) { const k = /UpLeg$/.test(tb.name) ? stride : /Leg$/.test(tb.name) ? 1 + (stride - 1) * 0.6 : 1; if (k !== 1) d = new THREE.Quaternion().slerp(d, k); }
          local = parentW.clone().invert().multiply(d.multiply(tRestW.get(tb)));
        } else local = tRestL.get(tb).clone();
        wAnim.set(tb, parentW.clone().multiply(local));
        local.toArray(qs.get(tb), i * 4);
      }
      const pw = pel.getWorldPosition(new THREE.Vector3());
      pos[i * 3] = hipsRest.x + (pw.x - p0.x) * kPos; pos[i * 3 + 1] = hipsRest.y + (pw.y - p0.y) * kPos; pos[i * 3 + 2] = hipsRest.z + (pw.z - p0.z) * kPos;
    }
    a.stop(); mixer.uncacheAction(clip);
    const tracks = tBones.filter((b) => byT.has(b)).map((b) => new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', times, qs.get(b)));
    tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', times, pos));
    const ac = new THREE.AnimationClip(name, clip.duration, tracks); ac.optimize(); return ac;
  }
}

/** Clip FBX de Mixamo (cm) → clip del personaje (m). inPlace: caderas sin desplazamiento horizontal; en saltos tampoco sube. */
export function mixamoClip(clip, hipsRestY, { inPlace = true, name = clip.name } = {}) {
  const c = clip.clone(); c.name = name;
  c.tracks = c.tracks.filter((t) => !/\.scale$/.test(t.name) && (!/\.position$/.test(t.name) || /Hips\.position$/.test(t.name)));
  const hp = c.tracks.find((t) => /Hips\.position$/.test(t.name));
  if (hp) {
    const k = hp.values[1] > 1e-3 ? hipsRestY / hp.values[1] : 0.01;
    for (let i = 0; i < hp.values.length; i++) hp.values[i] *= k;
    if (inPlace) for (let i = 0; i < hp.values.length; i += 3) { hp.values[i] = hp.values[0]; hp.values[i + 2] = hp.values[2]; }
    if (/jump/i.test(name)) for (let i = 1; i < hp.values.length; i += 3) hp.values[i] = Math.min(hp.values[i], hp.values[1]);
  }
  return c;
}
