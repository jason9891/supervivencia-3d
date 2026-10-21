// hero-paint.js — pinta la textura del héroe (personaje_1) sin necesitar la imagen original.
// Recorre los triángulos de la malla en el atlas UV y, para cada píxel, decide el color según su posición 3D en el cuerpo
// (piel, pelo, barba, ojos, cinturón, pantalón corto, botas, muñequeras). Así los bordes quedan nítidos aunque la malla sea de pocos vértices.
// Medidas (m, pies en y = 0, cara hacia +z, cuerpo de 1.82 m): nariz y 1.695 · barbilla 1.575 · ojos 1.735 · cabeza hasta 1.82.

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const sst = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm = (x, y, z) => vnoise(x, y, z) * 0.55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.15;

const SKIN = [196, 142, 106], SKIN_DARK = [170, 118, 86], BLUSH = [214, 146, 118];
const HAIR = [44, 30, 22], HAIR_LIGHT = [74, 50, 32];
const CLOTH = [92, 34, 30], CLOTH_DARK = [58, 22, 20];
const LEATHER = [78, 52, 34], LEATHER_DARK = [44, 28, 18], METAL = [176, 146, 74];

// La malla en pose de enlace mira hacia +X y los brazos se abren a lo largo de Z: se remapea a (lateral, alto, profundidad).
export function bodyColor(px, py, pz, pnx, pny, pnz) { return bodyColorLocal(pz, py, px, pnz, pny, pnx); }

// color de un punto del cuerpo en ejes locales: x = lateral, y = alto, z = hacia adelante (cara)
function bodyColorLocal(x, y, z, nx, ny, nz) {
  const ax = Math.abs(x);
  const big = fbm(x * 9, y * 9, z * 9), fine = vnoise(x * 70, y * 70, z * 70);
  let c = mix(SKIN, SKIN_DARK, clamp01((big - 0.4) * 1.6) * 0.55);
  const g = 0.96 + fine * 0.08; c = [c[0] * g, c[1] * g, c[2] * g];

  // —— sonrojo en cara, orejas, manos, rodillas y codos
  const head = y > 1.49 && y < 1.83 && ax < 0.17 && Math.abs(z) < 0.2;
  if (head) c = mix(c, BLUSH, sst(0.03, 0.09, ax) * sst(1.60, 1.66, y) * (1 - sst(1.70, 1.74, y)) * 0.45 * clamp01(nz + 0.4));
  if (ax > 0.66) c = mix(c, BLUSH, 0.25 * fbm(x * 30, y * 30, z * 30));            // manos
  if (y > 0.46 && y < 0.54) c = mix(c, BLUSH, 0.22 * (1 - Math.abs(y - 0.5) / 0.04) * clamp01(nz + 0.5));   // rodillas

  if (head) {
    const nzz = z + (big - 0.5) * 0.012, nyy = y + (fine - 0.5) * 0.004;
    // pelo: coronilla, parte de atrás y patillas; línea de nacimiento algo irregular; bordes suaves
    const hairLine = 1.762 + (big - 0.5) * 0.012;
    const top = sst(hairLine - 0.006, hairLine + 0.006, nyy);
    const back = sst(0.005, -0.03, nzz) * sst(1.655, 1.695, nyy);
    const temple = sst(0.07, 0.09, ax) * sst(1.715, 1.735, nyy) * (1 - sst(0.04, 0.06, nzz));
    const hair = Math.max(top, back, temple);
    // barba: mentón, mejillas hasta las patillas y bigote; la boca queda libre
    const front = sst(-0.03, -0.005, nzz);
    const jaw = sst(1.505, 1.525, nyy) * (1 - sst(1.650, 1.665, nyy)) * front;
    const cheek = sst(0.045, 0.06, ax) * (1 - sst(0.115, 0.13, ax)) * sst(1.595, 1.625, nyy) * (1 - sst(1.685, 1.705, nyy)) * sst(-0.04, -0.01, nzz);
    const mus = sst(0.0, 0.012, ax) * (1 - sst(0.06, 0.075, ax)) * sst(1.645, 1.655, nyy) * (1 - sst(1.685, 1.695, nyy)) * sst(0.04, 0.055, nzz);
    const mouth = (1 - sst(0.022, 0.032, ax)) * sst(1.630, 1.636, nyy) * (1 - sst(1.650, 1.656, nyy)) * sst(0.06, 0.075, nzz);
    const nose = (1 - sst(0.026, 0.036, ax)) * sst(1.672, 1.680, nyy) * sst(0.07, 0.082, nzz);
    const beard = Math.max(jaw, cheek, mus) * (1 - nose);
    const hairAmt = Math.max(hair, beard * (0.8 + 0.2 * fine));
    c = mix(c, mix(HAIR, HAIR_LIGHT, fbm(x * 40, y * 40, z * 40) * 0.8), hairAmt);
    c = mix(c, [120, 56, 50], 0.6 * mouth * (1 - hair));
    // cejas
    if (ax > 0.016 && ax < 0.07 && nyy > 1.746 && nyy < 1.764 && z > 0.05) c = mix(c, HAIR, 0.95);
    // ojos: esclerótica y pupila
    const ex = ax - 0.040, ey = nyy - 1.734;
    if (z > 0.055 && Math.abs(ex) < 0.022 && Math.abs(ey) < 0.0085) {
      const d = Math.hypot(ex * 0.8, ey * 1.4);
      c = d < 0.0075 ? [26, 40, 52] : mix([214, 200, 184], [160, 120, 100], sst(0.012, 0.02, d));
    }
  }

  // —— ropa
  // botas: del pie hasta la pantorrilla, con puño
  if (y < 0.42) {
    const boot = 1 - sst(0.40, 0.43, y);
    let b = mix(LEATHER, LEATHER_DARK, clamp01(fbm(x * 25, y * 25, z * 25) * 1.4));
    if (y < 0.035) b = LEATHER_DARK;                                    // suela
    if (y > 0.36 && y < 0.40) b = mix(b, LEATHER_DARK, 0.7);            // puño
    c = mix(c, b, boot);
  }
  // pantalón corto de tela: del cinturón a medio muslo, con borde deshilachado
  const hem = 0.66 + (fbm(x * 18, y * 18, z * 18) - 0.5) * 0.05;
  if (y < 0.985 && y > hem && Math.abs(x) < 0.30) {
    const w = clamp01(fbm(x * 55, y * 3, z * 55) * 1.6);                // trama
    let cl = mix(CLOTH, CLOTH_DARK, w * 0.7);
    const stripe = Math.sin(y * 150) * 0.5 + 0.5; cl = mix(cl, CLOTH_DARK, stripe * 0.12);
    c = mix(c, cl, sst(hem, hem + 0.012, y) * (1 - sst(0.975, 0.985, y)));
  }
  // cinturón con hebilla
  if (y > 0.972 && y < 1.012 && Math.abs(x) < 0.26) {
    let bel = mix(LEATHER, LEATHER_DARK, clamp01(fbm(x * 30, y * 30, z * 30)));
    if (ax < 0.028 && z > 0.05 && y > 0.978 && y < 1.006) bel = mix(METAL, [220, 190, 100], clamp01(fine));
    c = mix(c, bel, sst(0.972, 0.976, y) * (1 - sst(1.008, 1.012, y)));
  }
  // muñequeras de cuero en los antebrazos
  if (ax > 0.50 && ax < 0.64 && y > 1.30 && y < 1.50) {
    c = mix(c, mix(LEATHER, LEATHER_DARK, clamp01(fbm(x * 28, y * 28, z * 28))), sst(0.50, 0.515, ax) * (1 - sst(0.625, 0.64, ax)));
  }
  return c;
}

// Rasteriza la malla en el atlas UV. geometry: BufferGeometry indexada con position, normal y uv. Devuelve un canvas size×size.
export function paintTexture(geometry, size = 2048, colorFn = bodyColor) {
  const pos = geometry.attributes.position, nor = geometry.attributes.normal, uv = geometry.attributes.uv, idx = geometry.index;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  const filled = new Uint8Array(size * size);
  const tri = idx ? idx.count / 3 : pos.count / 3;
  const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  const eps = -0.04;
  for (let t = 0; t < tri; t++) {
    const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
    const ux = [uv.getX(a) * size, uv.getX(b) * size, uv.getX(c) * size], uy = [(1 - uv.getY(a)) * size, (1 - uv.getY(b)) * size, (1 - uv.getY(c)) * size];
    const minX = Math.max(0, Math.floor(Math.min(...ux)) - 1), maxX = Math.min(size - 1, Math.ceil(Math.max(...ux)) + 1);
    const minY = Math.max(0, Math.floor(Math.min(...uy)) - 1), maxY = Math.min(size - 1, Math.ceil(Math.max(...uy)) + 1);
    const den = (uy[1] - uy[2]) * (ux[0] - ux[2]) + (ux[2] - ux[1]) * (uy[0] - uy[2]);
    if (Math.abs(den) < 1e-9) continue;
    for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
      const X = px + 0.5, Y = py + 0.5;
      const l0 = ((uy[1] - uy[2]) * (X - ux[2]) + (ux[2] - ux[1]) * (Y - uy[2])) / den;
      const l1 = ((uy[2] - uy[0]) * (X - ux[2]) + (ux[0] - ux[2]) * (Y - uy[2])) / den;
      const l2 = 1 - l0 - l1;
      if (l0 < eps || l1 < eps || l2 < eps) continue;
      const P = (f) => l0 * f(a) + l1 * f(b) + l2 * f(c);
      const col = colorFn(P((i) => pos.getX(i)), P((i) => pos.getY(i)), P((i) => pos.getZ(i)), P((i) => nor.getX(i)), P((i) => nor.getY(i)), P((i) => nor.getZ(i)));
      const o = (py * size + px) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; filled[py * size + px] = 1;
    }
  }
  // dilatación: rellena el borde de las islas para que no se vean costuras al filtrar la textura
  for (let it = 0; it < 6; it++) {
    const add = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (filled[y * size + x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        if (filled[ny * size + nx]) { const o = (ny * size + nx) * 4; add.push([y * size + x, d[o], d[o + 1], d[o + 2]]); break; }
      }
    }
    for (const [i, r, g, b] of add) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; filled[i] = 1; }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
