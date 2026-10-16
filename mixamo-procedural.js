// mixamo-procedural.js — idle/walk/run/attack/death por código (Mixamo)
// Uso: const anim = createMixamoProcedural(THREE, model, { height: 1.9 });
//      anim.setMode('walk'|'run'|'idle'); anim.attack(); anim.die(); anim.update(dt);

const BONE_ALIASES = {
  hips: ['mixamorig:Hips', 'mixamorig_Hips', 'Hips'],
  spine: ['mixamorig:Spine', 'mixamorig_Spine', 'Spine'],
  spine1: ['mixamorig:Spine1', 'mixamorig_Spine1', 'Spine1'],
  spine2: ['mixamorig:Spine2', 'mixamorig_Spine2', 'Spine2'],
  neck: ['mixamorig:Neck', 'mixamorig_Neck', 'Neck'],
  head: ['mixamorig:Head', 'mixamorig_Head', 'Head'],
  leftUpLeg: ['mixamorig:LeftUpLeg', 'mixamorig_LeftUpLeg', 'LeftUpLeg'],
  leftLeg: ['mixamorig:LeftLeg', 'mixamorig_LeftLeg', 'LeftLeg'],
  leftFoot: ['mixamorig:LeftFoot', 'mixamorig_LeftFoot', 'LeftFoot'],
  rightUpLeg: ['mixamorig:RightUpLeg', 'mixamorig_RightUpLeg', 'RightUpLeg'],
  rightLeg: ['mixamorig:RightLeg', 'mixamorig_RightLeg', 'RightLeg'],
  rightFoot: ['mixamorig:RightFoot', 'mixamorig_RightFoot', 'RightFoot'],
  leftShoulder: ['mixamorig:LeftShoulder', 'mixamorig_LeftShoulder', 'LeftShoulder'],
  leftArm: ['mixamorig:LeftArm', 'mixamorig_LeftArm', 'LeftArm'],
  leftForeArm: ['mixamorig:LeftForeArm', 'mixamorig_LeftForeArm', 'LeftForeArm'],
  leftHand: ['mixamorig:LeftHand', 'mixamorig_LeftHand', 'LeftHand'],
  rightShoulder: ['mixamorig:RightShoulder', 'mixamorig_RightShoulder', 'RightShoulder'],
  rightArm: ['mixamorig:RightArm', 'mixamorig_RightArm', 'RightArm'],
  rightForeArm: ['mixamorig:RightForeArm', 'mixamorig_RightForeArm', 'RightForeArm'],
  rightHand: ['mixamorig:RightHand', 'mixamorig_RightHand', 'RightHand'],
};

function norm(n) {
  return (n || '').toLowerCase().replace(/^mixamorig[:._\-\s]*/, '').replace(/[^a-z0-9]/g, '');
}

function indexAllNamed(root) {
  const byName = new Map();
  const byNorm = new Map();
  let skeletonBoneCount = 0;
  const samples = [];
  root.traverse((o) => {
    if (o.name) {
      byName.set(o.name, o);
      const k = norm(o.name);
      if (k && !byNorm.has(k)) byNorm.set(k, o);
      if (samples.length < 12 && (o.isBone || o.type === 'Bone' || /mixamo|hip|spine|arm|leg/i.test(o.name))) {
        samples.push(o.name);
      }
    }
    if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones) {
      skeletonBoneCount += o.skeleton.bones.length;
      for (const b of o.skeleton.bones) {
        if (!b || !b.name) continue;
        byName.set(b.name, b);
        const k = norm(b.name);
        if (k) byNorm.set(k, b);
        if (samples.length < 12) samples.push(b.name);
      }
    }
  });
  return { byName, byNorm, skeletonBoneCount, samples };
}

function collectBones(root) {
  const { byName, byNorm, skeletonBoneCount, samples } = indexAllNamed(root);
  const out = {};
  for (const [key, names] of Object.entries(BONE_ALIASES)) {
    let found = null;
    for (const n of names) {
      if (byName.has(n)) { found = byName.get(n); break; }
    }
    if (!found) {
      const k = norm(names[0]);
      if (byNorm.has(k)) found = byNorm.get(k);
    }
    out[key] = found;
  }
  return { bones: out, skeletonBoneCount, samples, namedCount: byName.size };
}

function captureRest(bones) {
  const rest = new Map();
  for (const b of Object.values(bones)) {
    if (!b) continue;
    rest.set(b, { pos: b.position.clone(), quat: b.quaternion.clone() });
  }
  return rest;
}

function restoreRest(rest) {
  for (const [b, r] of rest) {
    b.position.copy(r.pos);
    b.quaternion.copy(r.quat);
  }
}

export function createMixamoProcedural(THREE, root, opts = {}) {
  const height = opts.height || 1.9;
  const { bones, skeletonBoneCount, samples, namedCount } = collectBones(root);
  const rest = captureRest(bones);
  const boneCount = Object.values(bones).filter(Boolean).length;
  const foundKeys = Object.entries(bones).filter(([, b]) => b).map(([k]) => k);
  const skinned = [];
  root.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });

  let mode = 'idle';
  let time = 0;
  let attackPhase = 0;
  let single = false;   // attack(n): reproduce solo el golpe n
  let attackT = 0;
  let dead = false;
  let deathClip = 'death';   // variante elegida al morir
  let deathT = 0;

  // ---- clips horneados (assets/anims/monster-*.json): mismo formato que anim-lab (Euler XYZ sobre el reposo + traslación de cadera)
  const clips = {};
  const parentInv = new Map();
  let jawBone = null;
  let clipT = 0, clipRate = 1;
  let blendFrom = null, blendT = 0;
  const BLEND = 0.14;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), eC = new THREE.Euler(), vC = new THREE.Vector3();
  function parentInvOf(b) {
    let inv = parentInv.get(b);
    if (inv === undefined) {
      inv = null;
      if (b.parent) { root.updateMatrixWorld(true); inv = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(); }
      parentInv.set(b, inv);
    }
    return inv;
  }
  function compileClip(c) {
    const keys = c.keys.slice().sort((a, b) => a.t - b.t).map((k) => {
      const q = {}, p = {};
      for (const [name, e] of Object.entries(k.pose)) {
        q[name] = new THREE.Quaternion().setFromEuler(eC.set(e.x || 0, e.y || 0, e.z || 0, 'XYZ'));
        if (e.px || e.py || e.pz) p[name] = [e.px || 0, e.py || 0, e.pz || 0];
      }
      return { t: k.t, q, p };
    });
    return { name: c.name, duration: c.duration, hit: c.hit, chain: c.chain, speed: c.speed, tilt: c.tilt, baked: c.baked, keys };
  }
  // Cuando hay clips, cualquier cambio de animación se funde desde la pose en pantalla (sin saltos).
  function beginBlend() {
    if (!blendFrom) blendFrom = new Map();
    for (const [b] of rest) blendFrom.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
    blendT = BLEND;
  }
  function poseClip(c, t, loop) {
    const ks = c.keys; let i = 0;
    const T = loop ? ((t % c.duration) + c.duration) % c.duration : Math.min(t, ks[ks.length - 1].t);
    while (i < ks.length - 2 && ks[i + 1].t <= T) i++;
    const a = ks[i], b = ks[Math.min(i + 1, ks.length - 1)];
    const u = b.t > a.t ? Math.min(1, Math.max(0, (T - a.t) / (b.t - a.t))) : 0;
    for (const name of Object.keys(a.q)) {
      const bone = name === 'jaw' ? jawBone : bones[name];
      if (!bone || !rest.has(bone)) continue;
      qa.copy(a.q[name]); qb.copy(b.q[name] || a.q[name]); qa.slerp(qb, u);
      bone.quaternion.copy(rest.get(bone).quat).multiply(qa);
      const pa = a.p[name], pb = b.p[name] || pa;
      if (pa) {
        vC.set(pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u, pa[2] + (pb[2] - pa[2]) * u);
        const inv = parentInvOf(bone); if (inv) vC.applyQuaternion(inv);
        bone.position.copy(rest.get(bone).pos).add(vC);
      }
    }
  }
  function finishBlend(dt) {
    if (!blendFrom || blendT <= 0) return;
    blendT = Math.max(0, blendT - dt);
    const u = 1 - blendT / BLEND, e = u * u * (3 - 2 * u);
    for (const [b, f] of blendFrom) { b.quaternion.slerpQuaternions(f.q, b.quaternion, e); b.position.lerpVectors(f.p, b.position, e); }
  }

  const qDelta = new THREE.Quaternion();
  const eTmp = new THREE.Euler();

  function applyLocalRot(bone, ax, ay, az) {
    if (!bone || !rest.has(bone)) return;
    const r = rest.get(bone);
    eTmp.set(ax, ay, az, 'XYZ');
    qDelta.setFromEuler(eTmp);
    bone.quaternion.copy(r.quat).multiply(qDelta);
  }

  function setMode(next) {
    if (dead) return;
    if (next === 'attack') { attackPhase = 1; attackT = 0; single = false; if (clips.attack1) beginBlend(); return; }
    if (next === 'dead' || next === 'death') { die(); return; }
    const m = next || 'idle';
    if (clips.walk && (m !== mode || attackPhase > 0)) { beginBlend(); if (m !== mode) clipT = 0; }
    mode = m;
    attackPhase = 0;
  }

  function die(variant) {
    if (dead) return;
    deathClip = variant && clips[variant] ? variant : 'death';
    if (clips[deathClip]) beginBlend();
    dead = true;
    deathT = 0;
    attackPhase = 0;
    mode = 'dead';
  }

  function flushSkeleton() {
    root.updateMatrixWorld(true);
    for (const mesh of skinned) {
      if (mesh.skeleton) mesh.skeleton.update();
    }
  }

  function update(dt) {
    if (boneCount < 4) return;
    time += dt;
    if (clips.attack1 && attackPhase > 0 && !dead) {
      attackT += dt;
      const c = clips['attack' + attackPhase];
      const lim = attackPhase < 3 && !single ? c.chain : c.duration;
      if (attackT >= lim) {
        beginBlend(); attackT = 0;
        if (attackPhase < 3 && !single) attackPhase += 1; else { attackPhase = 0; clipT = 0; single = false; }
      }
    }
    restoreRest(rest);

    if (dead && clips[deathClip]) {
      deathT += dt;
      poseClip(clips[deathClip], deathT, false);   // se queda en la última pose
      finishBlend(dt);
      flushSkeleton();
      return;
    }
    if (dead) {
      deathT += dt;
      const total = 1.35;
      const u = Math.min(1, deathT / total);
      let stumble = 0, fall = 0, settle = 0;
      if (u < 0.28) {
        stumble = u / 0.28;
      } else if (u < 0.75) {
        stumble = 1;
        fall = (u - 0.28) / 0.47;
      } else {
        stumble = 1;
        fall = 1;
        settle = (u - 0.75) / 0.25;
      }
      const s = stumble * stumble * (3 - 2 * stumble);
      const f = fall * fall * (3 - 2 * fall);
      const e = settle * settle * (3 - 2 * settle);

      applyLocalRot(bones.spine, 0.25 * s + 1.15 * f, 0.55 * s + 0.35 * f, 0.08 * s);
      applyLocalRot(bones.spine1, 0.2 * s + 0.65 * f, 0.25 * f, 0);
      applyLocalRot(bones.head, 0.35 * s + 0.7 * f, 0.4 * s + 0.25 * f, 0.1 * s);

      applyLocalRot(bones.leftUpLeg, 0.15 * s + 0.55 * f, 0.1 * s, 0.35 * s + 0.55 * f);
      applyLocalRot(bones.rightUpLeg, 0.45 * s + 0.5 * f, -0.15 * s, -0.25 * s - 0.4 * f);
      applyLocalRot(bones.leftLeg, 0.5 * s + 1.1 * f, 0, 0);
      applyLocalRot(bones.rightLeg, 0.9 * s + 1.0 * f, 0, 0);
      applyLocalRot(bones.leftFoot, -0.2 * s - 0.3 * f, 0, 0);
      applyLocalRot(bones.rightFoot, -0.35 * s - 0.25 * f, 0, 0);

      applyLocalRot(bones.leftArm, -0.4 * s + 0.5 * f, 0.3 * s, 0.9 * s + 0.5 * f);
      applyLocalRot(bones.rightArm, 0.6 * s + 0.35 * f, -0.25 * s, -1.0 * s - 0.35 * f);
      applyLocalRot(bones.leftForeArm, 0.3 * s + 0.7 * f, 0, 0);
      applyLocalRot(bones.rightForeArm, 0.5 * s + 0.55 * f, 0, 0);
      applyLocalRot(bones.leftShoulder, 0.1 * s, 0, 0.2 * s);
      applyLocalRot(bones.rightShoulder, 0.15 * s, 0, -0.25 * s);

      if (bones.hips && rest.has(bones.hips)) {
        const rp = rest.get(bones.hips).pos;
        const drop = (0.12 * s + 0.42 * f + 0.08 * e) * height;
        bones.hips.position.y = rp.y - drop;
        bones.hips.position.x = rp.x + 0.08 * s * height;
      }

      flushSkeleton();
      return;
    }

    if (clips.attack1 && attackPhase > 0) {
      poseClip(clips['attack' + attackPhase], attackT, false);
      finishBlend(dt);
      flushSkeleton();
      return;
    }
    const bakedClip = mode === 'walk' ? clips.walk : mode === 'run' ? clips.run : null;
    if (bakedClip && attackPhase === 0) {
      clipT += dt * clipRate;
      poseClip(bakedClip, clipT, true);
      finishBlend(dt);
      flushSkeleton();
      return;
    }
    if (attackPhase > 0) {
      attackT += dt;
      const hitDur = attackPhase === 3 ? 0.72 : 0.48;
      const t = Math.min(1, attackT / hitDur);
      const wave = Math.sin(t * Math.PI);
      const blend = t > 0.75 ? (t - 0.75) / 0.25 : 0;

      if (attackPhase === 1) {
        applyLocalRot(bones.rightArm, -0.45 * wave, 0.28 * wave, -1.6 * wave);
        applyLocalRot(bones.rightForeArm, -1.2 * wave, 0, 0);
        applyLocalRot(bones.rightShoulder, 0, 0, -0.4 * wave);
        applyLocalRot(bones.spine1, 0.1 * wave, 0.3 * wave, 0);
        applyLocalRot(bones.spine, 0.06 * wave, 0.14 * wave, 0);
        applyLocalRot(bones.hips, 0, 0.12 * wave, 0);
        applyLocalRot(bones.leftArm, -0.18 * blend, -0.12 * blend, -0.45 * blend);
      } else if (attackPhase === 2) {
        applyLocalRot(bones.leftArm, -0.45 * wave, -0.28 * wave, -1.6 * wave);
        applyLocalRot(bones.leftForeArm, -1.2 * wave, 0, 0);
        applyLocalRot(bones.leftShoulder, 0, 0, 0.4 * wave);
        applyLocalRot(bones.spine1, 0.1 * wave, -0.3 * wave, 0);
        applyLocalRot(bones.spine, 0.06 * wave, -0.14 * wave, 0);
        applyLocalRot(bones.hips, 0, -0.12 * wave, 0);
        applyLocalRot(bones.rightArm, -0.18 * blend, 0.12 * blend, -0.45 * blend);
      } else {
        // Golpe fuerte: ambas garras al FRENTE (mismo eje Z que golpes 1-2)
        // Cuerpo casi quieto para no torcer el torso del bestia
        const charge = t < 0.28 ? (t / 0.28) : 1;
        const strike = t < 0.28 ? 0 : Math.sin(((t - 0.28) / 0.72) * Math.PI);
        const wind = charge * (1 - strike * 0.08);
        const armZ = -0.9 * wind - 1.55 * strike;
        const armX = -0.25 * wind - 0.45 * strike;
        applyLocalRot(bones.rightArm, armX, 0, armZ);
        applyLocalRot(bones.leftArm, armX, 0, armZ);
        applyLocalRot(bones.rightForeArm, -0.7 * wind - 1.2 * strike, 0, 0);
        applyLocalRot(bones.leftForeArm, -0.7 * wind - 1.2 * strike, 0, 0);
        applyLocalRot(bones.rightShoulder, 0, 0, -0.25 * wind - 0.35 * strike);
        applyLocalRot(bones.leftShoulder, 0, 0, 0.25 * wind + 0.35 * strike);
        applyLocalRot(bones.spine, 0.12 * wind + 0.2 * strike, 0, 0);
        applyLocalRot(bones.spine1, 0.14 * wind + 0.22 * strike, 0, 0);
        applyLocalRot(bones.head, 0.08 * wind + 0.12 * strike, 0, 0);
      }

      if (t >= 1) {
        attackT = 0;
        if (attackPhase < 3) attackPhase += 1;
        else attackPhase = 0;
      }
      flushSkeleton();
      return;
    }

    if (mode === 'idle' || mode === 'hurt') {
      if (jawBone) applyLocalRot(jawBone, 0, 0, -0.08 + Math.sin(time * 1.2) * 0.03);
      const b = Math.sin(time * 1.7) * 0.04;
      const hurt = mode === 'hurt' ? 0.15 : 0;
      applyLocalRot(bones.spine, 0.02 + b * 0.3 + hurt, 0, 0);
      applyLocalRot(bones.spine1, b, 0, 0);
      applyLocalRot(bones.head, -b * 0.4, Math.sin(time * 0.5) * 0.06, 0);
      applyLocalRot(bones.leftArm, 0.05, 0, 0.08 + b);
      applyLocalRot(bones.rightArm, 0.05, 0, -0.08 - b);
      applyLocalRot(bones.leftForeArm, 0.2, 0, 0);
      applyLocalRot(bones.rightForeArm, 0.2, 0, 0);
      flushSkeleton();
      return;
    }

    const run = mode === 'run';
    const freq = run ? 10.0 : 6.0;
    const legAmp = run ? 0.72 : 0.52;
    const phase = time * freq;
    const L = Math.sin(phase) * legAmp;
    const R = Math.sin(phase + Math.PI) * legAmp;
    const kneeL = Math.max(0, -Math.sin(phase)) * (run ? 1.15 : 0.8);
    const kneeR = Math.max(0, -Math.sin(phase + Math.PI)) * (run ? 1.15 : 0.8);

    if (bones.hips && rest.has(bones.hips)) {
      const rp = rest.get(bones.hips).pos;
      bones.hips.position.y =
        rp.y + Math.abs(Math.sin(phase * 2)) * (run ? 0.045 : 0.028) * height;
    }
    applyLocalRot(bones.hips, 0, Math.sin(phase) * 0.06, 0);
    applyLocalRot(bones.leftUpLeg, 0, 0, L);
    applyLocalRot(bones.rightUpLeg, 0, 0, -R);
    applyLocalRot(bones.leftLeg, 0, 0, kneeL);
    applyLocalRot(bones.rightLeg, 0, 0, -kneeR);
    applyLocalRot(bones.leftFoot, 0, 0, -L * 0.35 - kneeL * 0.15);
    applyLocalRot(bones.rightFoot, 0, 0, R * 0.35 + kneeR * 0.15);
    const armAmp = run ? 0.7 : 0.45;
    applyLocalRot(bones.leftArm, -R * armAmp, 0, 0.1);
    applyLocalRot(bones.rightArm, -L * armAmp, 0, -0.1);
    applyLocalRot(bones.leftForeArm, 0.25 + Math.max(0, -R) * 0.45, 0, 0);
    applyLocalRot(bones.rightForeArm, 0.25 + Math.max(0, -L) * 0.45, 0, 0);
    applyLocalRot(bones.spine, Math.sin(phase * 2) * 0.03, Math.sin(phase) * 0.05, 0);
    applyLocalRot(bones.spine1, run ? 0.12 : 0.04, 0, 0);
    applyLocalRot(bones.head, -0.04, Math.sin(phase) * 0.03, 0);
    flushSkeleton();
  }

  return {
    bones, boneCount, foundKeys,
    skinnedCount: skinned.length,
    skeletonBoneCount, namedCount, samples,
    get mode() {
      if (dead) return 'dead';
      if (attackPhase === 1) return 'attack-R';
      if (attackPhase === 2) return 'attack-L';
      if (attackPhase === 3) return 'attack-C';
      return mode;
    },
    get isDead() { return dead; },
    setMode,
    attack(n) {
      if (dead) return;
      if (clips.attack1 && n >= 1 && n <= 3) { attackPhase = n; attackT = 0; single = true; beginBlend(); return; }   // golpe suelto
      if (attackPhase === 0) { single = false; attackPhase = 1; attackT = 0; if (clips.attack1) beginBlend(); }
    },
    die,
    /** Se levanta tras morir (vuelve a idle con fundido). */
    revive() { if (!dead) return; dead = false; deathT = 0; attackPhase = 0; single = false; mode = 'idle'; if (clips.walk) beginBlend(); },
    update,
    /** Carga clips horneados: { walk, run, attack1, attack2, attack3 } (objetos de clip del JSON). Lo que falte sigue siendo procedural. */
    useClips(map) { for (const [k, c] of Object.entries(map || {})) if (c && c.keys && c.keys.length) clips[k] = compileClip(c); },
    /** Hueso de mandíbula creado por RigEditor (hijo de Head): se mueve con la clave 'jaw' de los clips. */
    attachJaw(bone) { jawBone = bone; if (bone) rest.set(bone, { pos: bone.position.clone(), quat: bone.quaternion.clone() }); },
    setRate(r) { clipRate = r > 0 ? r : 1; },
    get hasClips() { return !!(clips.walk || clips.run || clips.attack1); },
    get hasDeathClip() { return !!clips.death; },
    /** Variantes de muerte disponibles (nombres de clip) y el vuelco de la raíz que lleva la elegida: { axis:'z'|'x', angle } (rad). */
    get deathVariants() { return Object.keys(clips).filter((k) => k.startsWith('death')); },
    get deathTilt() { const c = clips[deathClip]; return c && c.tilt ? c.tilt : { axis: 'z', angle: 1.35 }; },
    get deathBaked() { const c = clips[deathClip]; return !!(c && c.baked); },   // la caída (vuelco, suelo) ya va dentro del clip
    get deathProgress() { return dead ? Math.min(1, deathT / 1.35) : 0; },
    /** m/s del suelo que recorre el ciclo a rate 1 con el tamaño real del modelo (el GLB nativo mide ≈0.707). */
    groundSpeed(name) { const c = clips[name]; return c && c.speed ? (c.speed / 2.69) * (height / 0.707) : 0; },
    /** Calendario del combo: segundos (desde que arranca) en que cae cada golpe y duración total. */
    attackTimeline() {
      if (!clips.attack1) return { hits: [0.26, 0.74, 1.42], end: 1.68 };
      let t0 = 0; const hits = [];
      for (const k of ['attack1', 'attack2', 'attack3']) { const c = clips[k]; hits.push(t0 + c.hit); t0 += k === 'attack3' ? c.duration : c.chain; }
      return { hits, end: t0 };
    },
    isReady() { return boneCount >= 4 && skinned.length > 0; },
  };
}

export const MIXAMO_MODES = ['idle', 'walk', 'run', 'attack', 'dead'];
