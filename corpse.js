// corpse.js — el cadáver es sólido: huella en el suelo del monstruo caído (lógica pura, sin three.js; se prueba con Node).
// La huella es una nube de discos (x, z) tomados de la malla REAL ya animada: incluye cola, patas y garras en la postura en que cayó.

/** Reduce una lista plana [x,z,x,z…] a como mucho `max` puntos, repartidos con paso fijo. */
export function thin(pts, max = 400) {
  const n = pts.length / 2;
  if (n <= max) return Float32Array.from(pts);
  const step = n / max, out = new Float32Array(max * 2);
  for (let i = 0; i < max; i++) { const j = Math.floor(i * step); out[i * 2] = pts[j * 2]; out[i * 2 + 1] = pts[j * 2 + 1]; }
  return out;
}

/**
 * Saca a `pos` ({x,z}) de la huella: ningún disco de radio `r` puede solapar al círculo de radio `pr` centrado en pos.
 * Devuelve cuánto se movió (m). Dos pasadas: al apartarla de un disco puede quedar dentro de otro.
 */
export function pushOut(pos, pts, r, pr) {
  const min = r + pr; let moved = 0;
  for (let pass = 0; pass < 3; pass++) {
    let any = false;
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pos.x - pts[i], dz = pos.z - pts[i + 1], d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-6) { pos.x += min; moved += min; any = true; continue; }
      const k = (min - d) / d;
      pos.x += dx * k; pos.z += dz * k; moved += min - d; any = true;
    }
    if (!any) break;
  }
  return moved;
}

/** ¿El punto (x,z) toca la huella? */
export function inside(x, z, pts, r) {
  for (let i = 0; i < pts.length; i += 2) if ((x - pts[i]) ** 2 + (z - pts[i + 1]) ** 2 < r * r) return true;
  return false;
}
