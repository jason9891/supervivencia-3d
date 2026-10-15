// Reglas puras (sin three.js) para editar la estructura del monstruo: mandíbula propia y reubicación de pivotes.
// Todo en unidades nativas del GLB (el monstruo mide ≈0.707 de alto y mira hacia +X; el juego lo escala ≈2.69×).

export const JAW_DEFAULTS = Object.freeze({
  enabled: true,
  pivot: [0.275, 0.505, -0.0019],   // bisagra de la mandíbula (se puede mover con la reubicación de pivotes)
  startX: 0.275,                    // desde aquí hacia delante (x) los vértices pueden ser mandíbula
  planeY: 0.507,                    // plano de la boca: lo que queda por debajo es mandíbula
  tilt: 0,                          // inclinación del plano (y por unidad de x)
  blendX: 0.015, blendY: 0.02,      // suavizado del borde
  halfWidth: 0.14, blendZ: 0.02,    // ancho lateral de la mandíbula (deja fuera garras y brazos)
});

// Huesos de los que la mandíbula puede "robar" vértices (el modelo trae la mandíbula pesada a Spine2).
export const JAW_FROM = ['Head', 'Neck', 'Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder'];

export const bareName = (n) => (n || '').replace(/^mixamorig[:._\-\s]*/i, '');
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

/** Peso de mandíbula (0..1) de un punto: delante de startX, por debajo del plano de la boca y dentro del ancho. */
export function jawWeight(x, y, z, c) {
  const dx = x - c.startX;
  const below = (c.planeY + c.tilt * dx) - y;
  const side = 1 - smooth((Math.abs(z - c.pivot[2]) - c.halfWidth) / c.blendZ);
  return smooth(dx / c.blendX) * smooth(below / c.blendY) * side;
}

/** wj[i] para cada vértice (positions = x,y,z nativos); `allowed[i]` (0/1) limita a vértices cuyo hueso dominante puede cederlos. */
export function jawWeights(positions, allowed, c) {
  const n = positions.length / 3, out = new Float32Array(n);
  for (let i = 0; i < n; i++) if (allowed[i]) out[i] = jawWeight(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], c);
  return out;
}

/** Mezcla el hueso nuevo en los 4 influencias por vértice: los originales conservan (1−wj), el nuevo toma wj; se quedan los 4 mayores, normalizados. */
export function mergeJaw(index, weight, wj, jawIndex) {
  const n = wj.length, oi = new Uint16Array(n * 4), ow = new Float32Array(n * 4);
  const ci = [0, 0, 0, 0, 0], cw = [0, 0, 0, 0, 0];
  for (let v = 0; v < n; v++) {
    const w = wj[v];
    if (w <= 1e-4) { for (let k = 0; k < 4; k++) { oi[v * 4 + k] = index[v * 4 + k]; ow[v * 4 + k] = weight[v * 4 + k]; } continue; }
    for (let k = 0; k < 4; k++) { ci[k] = index[v * 4 + k]; cw[k] = weight[v * 4 + k] * (1 - w); }
    ci[4] = jawIndex; cw[4] = w;
    const order = [0, 1, 2, 3, 4].sort((a, b) => cw[b] - cw[a]).slice(0, 4);
    let s = 0; for (const o of order) s += cw[o];
    order.forEach((o, k) => { oi[v * 4 + k] = ci[o]; ow[v * 4 + k] = s > 0 ? cw[o] / s : 0; });
  }
  return { index: oi, weight: ow };
}

export const defaultRigCfg = () => ({ jaw: { ...JAW_DEFAULTS, pivot: [...JAW_DEFAULTS.pivot] }, offsets: {} });

/** Une una config guardada con los valores por defecto (por si el JSON es antiguo o parcial). */
export function normalizeRigCfg(cfg) {
  const d = defaultRigCfg();
  const j = { ...d.jaw, ...((cfg && cfg.jaw) || {}) };
  j.pivot = Array.isArray(j.pivot) && j.pivot.length === 3 ? j.pivot.map(Number) : [...d.jaw.pivot];
  const offsets = {};
  for (const [k, v] of Object.entries((cfg && cfg.offsets) || {})) if (Array.isArray(v) && v.length === 3 && v.some((a) => Math.abs(a) > 1e-9)) offsets[k] = v.map(Number);
  return { jaw: j, offsets };
}
