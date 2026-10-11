// map-ramps.js — rampas reales (solo mapa). No depende del personaje ni del combate.
// Una rampa diagonal: segmento en XZ de (sx,sz) a (ex,ez), altura y0→y1, ancho halfWidth.

export const RAMPS = [];

/** @param {{sx:number,sz:number,ex:number,ez:number,y0:number,y1:number,halfWidth:number}} r */
export function addRamp(r) {
  const dx = r.ex - r.sx, dz = r.ez - r.sz;
  const len = Math.hypot(dx, dz) || 1;
  RAMPS.push({
    ...r,
    dx, dz, len,
    ux: dx / len,
    uz: dz / len,
    // perpendicular en planta
    px: -dz / len,
    pz: dx / len,
  });
}

export function clearRamps() { RAMPS.length = 0; }

/** Altura en rampa si (x,z) está sobre el tramo; si no, null. */
export function sampleRampY(x, z) {
  let best = null;
  for (const r of RAMPS) {
    const vx = x - r.sx, vz = z - r.sz;
    const t = (vx * r.ux + vz * r.uz) / r.len;
    if (t < -0.02 || t > 1.02) continue;
    const along = Math.max(0, Math.min(1, t));
    const cx = r.sx + r.ux * along * r.len;
    const cz = r.sz + r.uz * along * r.len;
    const lat = Math.abs((x - cx) * r.px + (z - cz) * r.pz);
    if (lat > r.halfWidth) continue;
    const y = r.y0 + (r.y1 - r.y0) * along;
    if (best === null || y > best) best = y;
  }
  return best;
}

/** Pendiente 0..1 aprox. (para energía más adelante). */
export function getSlopeAt(x, z) {
  for (const r of RAMPS) {
    const vx = x - r.sx, vz = z - r.sz;
    const t = (vx * r.ux + vz * r.uz) / r.len;
    if (t < 0 || t > 1) continue;
    const cx = r.sx + r.ux * t * r.len;
    const cz = r.sz + r.uz * t * r.len;
    const lat = Math.abs((x - cx) * r.px + (z - cz) * r.pz);
    if (lat > r.halfWidth) continue;
    return Math.abs(r.y1 - r.y0) / r.len;
  }
  return 0;
}

/** Malla visual inclinada (caja delgada rotada). */
export function buildRampMesh(THREE, scene, r, material) {
  const dx = r.ex - r.sx, dz = r.ez - r.sz;
  const len = Math.hypot(dx, dz) || 1;
  const dy = r.y1 - r.y0;
  const hyp = Math.hypot(len, dy);
  const geo = new THREE.BoxGeometry(r.halfWidth * 2, 0.35, hyp);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((r.sx + r.ex) / 2, (r.y0 + r.y1) / 2, (r.sz + r.ez) / 2);
  // orientar: largo a lo largo de la hipotenusa en el plano del avance
  const yaw = Math.atan2(dx, dz);
  const pitch = -Math.atan2(dy, len);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = yaw;
  mesh.rotation.x = pitch;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
