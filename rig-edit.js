// Edita la estructura de un SkinnedMesh: mueve pivotes de huesos sin deformar la malla en reposo y añade un hueso de mandíbula.
// Se reconstruye siempre desde el estado original (el del GLB), así que cualquier cambio es reversible.
import * as THREE from 'three';
import { JAW_DEFAULTS, JAW_FROM, bareName, jawWeights, mergeJaw, normalizeRigCfg } from './rig-edit-core.js';
export * from './rig-edit-core.js';

export class RigEditor {
  /** model = raíz del GLB (con su escala), mesh = SkinnedMesh, boneByKey = {hips, head, …} del editor. */
  constructor(model, mesh, boneByKey) {
    this.model = model; this.mesh = mesh; this.keys = boneByKey;
    const sk = mesh.skeleton;
    this.orig = sk.bones.slice();
    this.ibm0 = sk.boneInverses.map((m) => m.clone());
    this.local0 = this.orig.map((b) => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
    const g = mesh.geometry, n = g.attributes.position.count;
    this.n = n;
    this.si0 = new Uint16Array(n * 4); this.sw0 = new Float32Array(n * 4); this.nat = new Float32Array(n * 3);
    const v = new THREE.Vector3(), A = g.attributes.skinIndex, W = g.attributes.skinWeight, P = g.attributes.position;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) { this.si0[i * 4 + k] = A.getComponent(i, k); this.sw0[i * 4 + k] = W.getComponent(i, k); }
      v.fromBufferAttribute(P, i).applyMatrix4(mesh.bindMatrix);   // posición nativa (la del mundo de enlace)
      this.nat.set([v.x, v.y, v.z], i * 3);
    }
    // vértices que la mandíbula puede quitarle a otros huesos: los de hueso dominante cercano a la cabeza
    const okBone = this.orig.map((b) => JAW_FROM.includes(bareName(b.name)));
    this.allowed = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      let best = 0; for (let k = 1; k < 4; k++) if (this.sw0[i * 4 + k] > this.sw0[i * 4 + best]) best = k;
      this.allowed[i] = okBone[this.si0[i * 4 + best]] ? 1 : 0;
    }
    this.jaw = null; this.jawW = new Float32Array(n); this.cfg = normalizeRigCfg();
  }

  /** Reconstruye esqueleto y pesos con `cfg` ({jaw:{…}, offsets:{clave:[dx,dy,dz]}}). Devuelve el hueso de mandíbula (o null). */
  build(cfgIn) {
    const cfg = this.cfg = normalizeRigCfg(cfgIn);
    const { orig, model, mesh } = this;
    orig.forEach((b, i) => { const l = this.local0[i]; b.position.copy(l.p); b.quaternion.copy(l.q); b.scale.copy(l.s); });
    if (this.jaw && this.jaw.parent) this.jaw.parent.remove(this.jaw);
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const N0 = orig.map((b) => inv.clone().multiply(b.matrixWorld));        // pose de reposo en el espacio del modelo
    const pIdx = orig.map((b) => orig.indexOf(b.parent));
    const P0 = orig.map((b, i) => (pIdx[i] >= 0 ? null : inv.clone().multiply(b.parent.matrixWorld)));
    const N1 = N0.map((m) => m.clone());
    const moved = new Array(orig.length).fill(false);
    let jawOff = [0, 0, 0];
    for (const [key, o] of Object.entries(cfg.offsets)) {
      if (key === 'jaw') { jawOff = o; continue; }
      const i = orig.indexOf(this.keys[key]);
      if (i < 0) continue;
      N1[i].elements[12] += o[0]; N1[i].elements[13] += o[1]; N1[i].elements[14] += o[2]; moved[i] = true;
    }
    // locales nuevos: los huesos movidos y sus hijos recalculan; el resto queda exacto como en el GLB
    const L = new THREE.Matrix4();
    orig.forEach((b, i) => {
      if (!moved[i] && !(pIdx[i] >= 0 && moved[pIdx[i]])) return;
      L.copy(pIdx[i] >= 0 ? N1[pIdx[i]] : P0[i]).invert().multiply(N1[i]).decompose(b.position, b.quaternion, b.scale);
    });
    const ibms = orig.map((_, i) => (moved[i] ? new THREE.Matrix4().copy(N1[i]).invert().multiply(N0[i]).multiply(this.ibm0[i]) : this.ibm0[i].clone()));
    let bones = orig, jawBone = null;
    const g = mesh.geometry;
    if (cfg.jaw.enabled && this.keys.head) {
      const h = orig.indexOf(this.keys.head);
      const piv = cfg.jaw.pivot.map((v, k) => v + jawOff[k]);
      const Nj = new THREE.Matrix4().makeTranslation(piv[0], piv[1], piv[2]);   // orientación del mundo: eje Z = bisagra
      jawBone = this.jaw || (this.jaw = new THREE.Bone());
      jawBone.name = 'mixamorig:Jaw';
      orig[h].add(jawBone);
      L.copy(N1[h]).invert().multiply(Nj).decompose(jawBone.position, jawBone.quaternion, jawBone.scale);
      ibms.push(new THREE.Matrix4().copy(Nj).invert().multiply(N0[h]).multiply(this.ibm0[h]));
      bones = [...orig, jawBone];
      this.jawW = jawWeights(this.nat, this.allowed, cfg.jaw);
      const m = mergeJaw(this.si0, this.sw0, this.jawW, orig.length);
      g.setAttribute('skinIndex', new THREE.BufferAttribute(m.index, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(m.weight, 4));
    } else {
      this.jawW = new Float32Array(this.n);
      g.setAttribute('skinIndex', new THREE.BufferAttribute(this.si0.slice(), 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(this.sw0.slice(), 4));
    }
    model.updateMatrixWorld(true);
    const old = mesh.skeleton;
    mesh.bind(new THREE.Skeleton(bones, ibms), mesh.bindMatrix.clone());
    old?.dispose?.();
    if (this.zoneOn) this.setZoneView(true);
    return jawBone;
  }

  /** Pinta de magenta los vértices que sigue la mandíbula (sirve para ajustar la zona). */
  setZoneView(on) {
    this.zoneOn = on;
    const g = this.mesh.geometry, c = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n; i++) { const w = on ? this.jawW[i] : 0; c[i * 3] = 1; c[i * 3 + 1] = 1 - 0.85 * w; c[i * 3 + 2] = 1; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    for (const m of [].concat(this.mesh.material)) { m.vertexColors = on; m.needsUpdate = true; }
  }
}
