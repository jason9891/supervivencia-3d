/* objetos_lote3.js — entorno y mecanismos. Va junto a objetos.js y objetos_pro.js.
 *
 *   import { registrarPro } from './objetos_pro.js';
 *   import { registrarLote3 } from './objetos_lote3.js';
 *   registrarPro(); registrarLote3();
 *
 * ENTORNO (con semilla: la misma semilla da siempre el mismo resultado)
 *   roca, rocal (conjunto de rocas), parche_tierra (terreno con sendero y piedritas), parche_pasto (pasto con viento)
 * MECANISMOS (tienen estado y animación; ver la API más abajo)
 *   reja (rastrillo de castillo que sube y baja, o cae), puente_levadizo, palanca
 *
 * API de un mecanismo (lo que devuelve crearObjeto):
 *   obj.abrir()  obj.cerrar()  -> movimiento lento, como con torno
 *   obj.soltar()               -> reja: cae rápido con rebote; puente: se desploma abierto
 *   obj.alternar()  obj.estado() (0..1)  obj.esAbierto()
 *   palanca: obj.conectar(fn)  fn(activa:boolean)  — así una palanca acciona varios mecanismos
 * En el bucle: obj.anim(tiempoEnSegundos). Cada malla lleva mesh.userData.mecanismo = obj para poder
 * tocarla con un rayo (raycaster) y llamar obj.alternar().
 *
 * Suelo: parche_tierra y parche_pasto usan la misma función alturaSuelo(x, z, semilla, rug). Para que el pasto
 * quede sobre la tierra, dale la misma semilla/rug y el desfase (ox, oz) = posición del pasto − posición de la tierra.
 */
import * as THREE from 'three';
import { rng, canvasTex, stoneTex, ironTex, CATALOGO, HUELLA, ETIQUETAS } from './objetos.js';
import { pNuevo, RB, MATERIALES_EXTRA } from './objetos_pro.js';

const P3 = Math.PI, TC3 = {};

/* ================= materiales ================= */
function tierraTex() {
  if (TC3.tierra) return TC3.tierra;
  return TC3.tierra = canvasTex(256, (g, S) => {
    const r = rng(71); g.fillStyle = '#7a5c3c'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '30,18,8' : '190,150,100') + ',' + r() * .2 + ')'; const s = 1 + r() * 3; g.fillRect(r() * S, r() * S, s, s); }
    for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S, R = 6 + r() * 14, gr = g.createRadialGradient(x, y, 1, x, y, R); gr.addColorStop(0, 'rgba(40,26,12,.25)'); gr.addColorStop(1, 'rgba(40,26,12,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); }
  });
}
function pastoTex() {
  if (TC3.pasto) return TC3.pasto;
  return TC3.pasto = canvasTex(128, g => {
    g.clearRect(0, 0, 128, 128); const gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, '#1a2b10'); gr.addColorStop(.6, '#2e4a1c'); gr.addColorStop(1, '#6b7a28');
    g.fillStyle = gr; g.beginPath(); g.moveTo(64, 128); g.quadraticCurveTo(90, 64, 64, 0); g.quadraticCurveTo(38, 64, 64, 128); g.fill();
  });
}
MATERIALES_EXTRA.piedra = () => new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: .95, vertexColors: true });
MATERIALES_EXTRA.roca = () => new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 1, vertexColors: true, flatShading: true });
const matTierra = () => TC3.mTierra || (TC3.mTierra = new THREE.MeshStandardMaterial({ map: tierraTex(), roughness: 1, vertexColors: true }));
const matHierro = () => TC3.mHierro || (TC3.mHierro = new THREE.MeshStandardMaterial({ map: ironTex(), roughness: .55, metalness: .4 }));
const UT3 = { value: 0 };
function matPasto() {
  if (TC3.mPasto) return TC3.mPasto;
  const m = new THREE.MeshStandardMaterial({ map: pastoTex(), alphaTest: .5, side: THREE.DoubleSide, roughness: .9 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = UT3;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n float bf = position.y * position.y;\n float wd = sin(uTime * 2.5 + ip.x * .8 + ip.z * .6) * .2;\n transformed.x += wd * bf;\n transformed.z += wd * .5 * bf;');
  };
  return TC3.mPasto = m;
}

/* ================= mecanismo: valor 0..1 con movimiento lento o caída con rebote ================= */
function crearMec(vLento, g) {
  const m = { valor: 0, v: 0, objetivo: 0, modo: 'lento', t0: null, mov: false };
  m.ir = (o, modo) => { m.objetivo = o; m.modo = modo || 'lento'; m.v = 0; m.mov = true; };
  m.paso = t => {
    const dt = m.t0 === null ? 0 : Math.min(.05, Math.max(0, t - m.t0)); m.t0 = t;
    if (!dt || !m.mov) return m.valor;
    if (m.modo === 'lento') {
      const d = m.objetivo - m.valor, s = vLento * dt;
      if (Math.abs(d) <= s) { m.valor = m.objetivo; m.mov = false; } else m.valor += Math.sign(d) * s;
    } else {
      const gd = m.objetivo >= .5 ? 1 : -1; m.v += gd * g * dt; m.valor += m.v * dt;
      const pasa = gd > 0 ? m.valor > 1 : m.valor < 0;
      if (pasa) { m.valor = m.objetivo; if (Math.abs(m.v) > .45) m.v = -m.v * .22; else { m.v = 0; m.mov = false; } }
      else if (gd > 0 ? m.valor < 0 : m.valor > 1) { m.valor = gd > 0 ? 0 : 1; m.v = 0; }
    }
    return m.valor;
  };
  return m;
}
const marcar = (obj) => { obj.root.traverse(o => { o.userData = o.userData || {}; o.userData.mecanismo = obj; }); return obj; };

/* ================= suelo ================= */
export function alturaSuelo(x, z, sem, rug) {
  const s = sem * 1.7;
  return rug * (.22 * Math.sin(x * .35 + s) * Math.sin(z * .3 + s * 1.3) + .12 * Math.sin(x * .9 + s * 2) * Math.sin(z * 1.1 + s) + .05 * Math.sin(x * 2.3 + z * 1.9 + s * 3));
}
const trazo = (z, sem, w) => ({ cx: Math.sin(z * .15 + sem) * w * .06, mitad: .16 * w });
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function tierraPro(p) {
  const { w, d, rug, semilla, sendero, piedritas } = p, R = rng(Math.round(semilla * 131 + w * 7 + d)), root = new THREE.Group();
  const sx = Math.min(80, Math.max(4, Math.round(w * 2))), sz = Math.min(80, Math.max(4, Math.round(d * 2)));
  const geo = new THREE.PlaneGeometry(w, d, sx, sz); geo.rotateX(-P3 / 2);
  const pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const altura = (x, z) => {
    let y = alturaSuelo(x, z, semilla, rug);
    if (sendero >= .5) { const t = trazo(z, semilla, w), dist = Math.abs(x - t.cx), ip = 1 - sstep(t.mitad * .6, t.mitad, dist); y = y * (1 - .7 * ip) - .03 * ip - .04 * Math.exp(-Math.pow((dist - .55) / .14, 2)) * ip; }
    return y;
  };
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = altura(x, z);
    pos.setY(i, y);
    uv[i * 2] = (x + w / 2) / 2.5; uv[i * 2 + 1] = (z + d / 2) / 2.5;
    const nn = .5 + .5 * Math.sin(x * 1.3 + z * .9 + semilla) * Math.sin(x * .7 - z * 1.7), j = .9 + R() * .2;
    let c = [.36 + .14 * nn, .26 + .12 * nn, .17 + .07 * nn];
    if (sendero >= .5) { const t = trazo(z, semilla, w), ip = 1 - sstep(t.mitad * .6, t.mitad, Math.abs(x - t.cx)); c = c.map((v, k) => v + ip * ([.2, .19, .15][k])); }
    col[i * 3] = c[0] * j; col[i * 3 + 1] = c[1] * j; col[i * 3 + 2] = c[2] * j;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, matTierra()); mesh.receiveShadow = true; root.add(mesh);
  const np = Math.min(300, Math.round(w * d * .5 * piedritas));
  if (np > 0) {
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), np), dm = new THREE.Object3D();
    for (let i = 0; i < np; i++) {
      const x = (R() - .5) * (w - .2), z = (R() - .5) * (d - .2), s = .03 + .07 * R() * R();
      dm.position.set(x, altura(x, z) + s * .3, z); dm.rotation.set(R() * 3, R() * 3, R() * 3); dm.scale.set(s, s * .6, s * (.8 + R() * .4)); dm.updateMatrix();
      im.setMatrixAt(i, dm.matrix); const g = .35 + R() * .3; im.setColorAt(i, new THREE.Color(g, g * .96, g * .9));
    }
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; root.add(im);
  }
  return { root, anim: () => { }, anchor: null };
}

function pastoPro(p) {
  const { w, d, altura, densidad, semilla, borde, rug, semillaSuelo, ox, oz, sendero, wSuelo } = p, R = rng(Math.round(semilla * 211 + w * 3 + d));
  const bg = new THREE.BufferGeometry(), bw = .3, bh = 1;
  bg.setAttribute('position', new THREE.Float32BufferAttribute([-bw / 2, 0, 0, bw / 2, 0, 0, bw / 2, bh, 0, -bw / 2, bh, 0, 0, 0, -bw / 2, 0, 0, bw / 2, 0, bh, bw / 2, 0, bh, -bw / 2], 3));
  bg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2)); bg.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]); bg.computeVertexNormals();
  const cand = Math.min(24000, Math.round(w * d * 30 * densidad)), dm = new THREE.Object3D(), col = new THREE.Color(), lista = [];
  for (let i = 0; i < cand; i++) {
    const x = (R() - .5) * w, z = (R() - .5) * d, ed = Math.min(w / 2 - Math.abs(x), d / 2 - Math.abs(z)), manchas = .55 + .45 * Math.sin(x * .9 + semilla) * Math.sin(z * .8 + semilla * 1.3);
    if (R() > Math.min(1, ed / (borde * 1.5 + .01)) * (1 - borde * .5 + borde * .5 * manchas)) continue;
    if (sendero >= .5) { const t = trazo(z + oz, semillaSuelo, wSuelo); if (Math.abs(x + ox - t.cx) < t.mitad * .95) continue; }
    const y = alturaSuelo(x + ox, z + oz, semillaSuelo, rug), sy = altura * (.6 + R() * .6) * (.7 + .3 * Math.min(1, ed / 1.5)), sxz = .8 + R() * .5;
    dm.position.set(x, y, z); dm.rotation.y = R() * 6.28; dm.scale.set(sxz, sy, sxz); dm.updateMatrix(); col.setHSL(.22 + R() * .09, .5, .26 + R() * .2);
    lista.push([dm.matrix.clone(), col.clone()]);
  }
  const im = new THREE.InstancedMesh(bg, matPasto(), Math.max(1, lista.length));
  lista.forEach((e, i) => { im.setMatrixAt(i, e[0]); im.setColorAt(i, e[1]); });
  im.count = Math.max(1, lista.length); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.receiveShadow = true;
  const root = new THREE.Group(); root.add(im);
  return { root, anim: () => { UT3.value = performance.now() / 1000; }, anchor: null, cuchillas: lista.length };
}

/* ================= rocas ================= */
function ruido3(x, y, z, ph) {
  return Math.sin(x * 2.1 + ph[0]) * Math.sin(y * 2.3 + ph[1]) * Math.sin(z * 2.0 + ph[2]) + .5 * Math.sin(x * 4.7 + ph[3]) * Math.sin(y * 4.1 + ph[4]) * Math.sin(z * 5.3 + ph[5]) + .25 * Math.sin(x * 9.3 + ph[6]) * Math.sin(y * 8.7 + ph[7]) * Math.sin(z * 10.1 + ph[8]);
}
function geoRoca(r, alto, forma, sem) {
  const g = new THREE.IcosahedronGeometry(1, 2), a = g.attributes.position.array, R = rng(Math.round(sem * 977) + 3), ph = Array.from({ length: 9 }, () => R() * 60), amp = .16 + .2 * forma, bajo = -.62;
  for (let i = 0; i < a.length; i += 3) {
    const l = Math.hypot(a[i], a[i + 1], a[i + 2]) || 1, dx = a[i] / l, dy = a[i + 1] / l, dz = a[i + 2] / l, n = ruido3(dx, dy, dz, ph), q = Math.round(n * 2) / 2, k = 1 + amp * (n * (1 - forma * .6) + q * forma * .6);
    const y = Math.max(dy * k * r * alto, bajo * r * alto);
    a[i] = dx * k * r; a[i + 1] = y - bajo * r * alto - .05 * r * alto; a[i + 2] = dz * k * r;
  }
  g.computeVertexNormals();
  return g;
}
function pintarMusgo(g, musgo, sem) {
  const N = g.attributes.normal, C = g.attributes.color, P = g.attributes.position;
  for (let i = 0; i < N.count; i++) {
    const ny = N.getY(i), m = musgo * sstep(.4, .85, ny) * (.6 + .4 * Math.sin(P.getX(i) * 6 + P.getZ(i) * 4 + sem)), sombra = ny < -.3 ? .7 : 1;
    C.setXYZ(i, (C.getX(i) * (1 - m) + .38 * m) * sombra, (C.getY(i) * (1 - m) + .52 * m) * sombra, (C.getZ(i) * (1 - m) + .22 * m) * sombra);
  }
}
function rocaPro(p) {
  const { r, alto, forma, musgo, semilla } = p, s = pNuevo(), g = geoRoca(r, alto, forma, semilla);
  s.add('roca', g, { tile: 1.4, tint: .85 + .3 * rng(Math.round(semilla * 31))() });
  pintarMusgo(g, musgo, semilla);
  return s.fin();
}
function rocalPro(p) {
  const { n, r, forma, musgo, semilla } = p, s = pNuevo(), R = rng(Math.round(semilla * 53 + n));
  for (let i = 0; i < Math.round(n); i++) {
    const rr = i === 0 ? r : r * (.3 + .35 * R()), an = R() * 6.28, dist = i === 0 ? 0 : r * (.55 + .8 * R()), g = geoRoca(rr, .7 + .5 * R(), forma, semilla + i * 3.1);
    s.add('roca', g, { pos: [Math.cos(an) * dist, 0, Math.sin(an) * dist], rot: [0, R() * 6.28, 0], tile: 1.4, tint: .8 + R() * .35 });
    pintarMusgo(g, musgo, semilla + i);
  }
  return s.fin();
}

/* ================= mecanismos ================= */
function marcoPiedra(s, w, hAbertura, prof, hJamba) {
  [-1, 1].forEach(x => s.add('piedra', RB(.5, hJamba, prof, .02), { pos: [x * (w / 2 + .25), hJamba / 2, 0], eje: 1, tile: 1.2 }));
  s.add('piedra', RB(w + 1, .6, prof, .02), { pos: [0, hAbertura + .2, 0], eje: 0, tile: 1.2 });
}

function rejaPro(p) {
  const { w, h, sep, marco } = p, mec = crearMec(.22, 3.0), travel = h * .92, root = new THREE.Group();
  if (marco >= .5) { const f = pNuevo(); marcoPiedra(f, w, h, .7, h + .5); [-1, 1].forEach(x => f.add('fe', RB(.03, h + .3, .05, .004, 1), { pos: [x * (w / 2 - .005), (h + .3) / 2, .0] })); root.add(f.fin().root); }
  const g = pNuevo(), a = g.add, n = Math.floor(w / sep) + 1, paso = (w - .06) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + .03 + i * paso;
    a('fe', RB(.032, h, .032, .006, 1), { pos: [x, h / 2, 0] });
    a('fe', new THREE.ConeGeometry(.026, .16, 4), { pos: [x, -.06, 0], rot: [P3, 0, 0] });
  }
  [.3, h * .5, h - .25].forEach(y => a('fe', RB(w - .02, .05, .05, .006, 1), { pos: [0, y, 0] }));
  [-1, 1].forEach(x => a('fe', new THREE.TorusGeometry(.05, .012, 6, 10), { pos: [x * (w / 2 - .12), h - .05, 0] }));
  const gate = g.fin().root; gate.position.z = .05; root.add(gate);
  const obj = { root, anchor: null, hueco: { w, h }, mec,
    anim: t => { const v = mec.paso(t); gate.position.y = v * travel; gate.position.x = (mec.mov && v > 0 && v < 1) ? Math.sin(t * 38) * .003 : 0; },
    abrir: () => mec.ir(1, 'lento'), cerrar: () => mec.ir(0, 'lento'), soltar: () => mec.ir(0, 'caida'),
    alternar: () => { if (mec.objetivo >= .5) obj.soltar(); else obj.abrir(); }, estado: () => mec.valor, esAbierto: () => mec.objetivo >= .5 };
  return marcar(obj);
}

function puentePro(p) {
  const { w, l, marco } = p, mec = crearMec(.28, 2.2), t = .14, root = new THREE.Group(), R = rng(Math.round(w * 10 + l));
  if (marco >= .5) { const f = pNuevo(); marcoPiedra(f, w, l, .9, l + .8); root.add(f.fin().root); }
  const d = pNuevo(), a = d.add, n = Math.max(4, Math.round(w / .22)), bw = w / n;
  for (let i = 0; i < n; i++) a('mad', RB(bw - .008, l, t, .006, 1), { pos: [-w / 2 + bw * (i + .5), l / 2, 0], eje: 1, tint: .85 + R() * .25 });
  [.18, .5, .82].forEach(f => [-1, 1].forEach(sg => {
    a('fe', RB(w + .02, .11, .025, .004, 1), { pos: [0, f * l, sg * (t / 2 + .0125)] });
    [-1, 1].forEach(x => a('fe', new THREE.SphereGeometry(.014, 6, 4), { pos: [x * (w / 2 - .05), f * l, sg * (t / 2 + .027)] }));
  }));
  [-1, 1].forEach(x => a('fe', new THREE.TorusGeometry(.05, .012, 6, 10), { pos: [x * (w / 2 - .12), l - .02, t / 2 + .03] }));
  const pivot = new THREE.Group(); pivot.position.set(0, -t / 2, .35); pivot.add(d.fin().root); root.add(pivot);
  const cad = [-1, 1].map(x => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1, 6), matHierro()); m.rotation.order = 'ZXY'; m.castShadow = true; root.add(m); return { m, x: x * (w / 2 - .12) }; });
  const actualizar = th => {
    pivot.rotation.x = th;
    cad.forEach(c => {
      const ty = -t / 2 + l * Math.cos(th), tz = .35 + l * Math.sin(th), ay = l + .45, az = .47, dx = 0, dy = ay - ty, dz = az - tz, len = Math.hypot(dy, dz) || 1;
      c.m.position.set(c.x, (ty + ay) / 2, (tz + az) / 2); c.m.scale.set(1, len, 1); c.m.rotation.set(Math.asin(dz / len), 0, Math.atan2(-dx, dy));
    });
  };
  actualizar(0);
  const obj = { root, anchor: null, mec, anim: tt => { actualizar(mec.paso(tt) * P3 / 2); },
    abrir: () => mec.ir(1, 'lento'), cerrar: () => mec.ir(0, 'lento'), soltar: () => mec.ir(1, 'caida'),
    alternar: () => { if (mec.objetivo >= .5) obj.cerrar(); else obj.abrir(); }, estado: () => mec.valor, esAbierto: () => mec.objetivo >= .5 };
  return marcar(obj);
}

function palancaPro(p) {
  const { modo, largo } = p, mec = crearMec(3.2, 0), root = new THREE.Group(), suelo = modo >= .5, escucha = [];
  const b = pNuevo(), ba = b.add, m = pNuevo(), ma = m.add, L = suelo ? largo * 1.6 : largo;
  if (!suelo) {
    ba('mad', RB(.34, .46, .03, .006), { pos: [0, 0, -.015], eje: 1 });
    ba('fe', RB(.26, .36, .02, .004, 1), { pos: [0, 0, .01] });
    [[-.1, .15], [.1, .15], [-.1, -.15], [.1, -.15]].forEach(q => ba('fe', new THREE.SphereGeometry(.014, 6, 4), { pos: [q[0], q[1], .024] }));
    ba('fe', new THREE.CylinderGeometry(.04, .04, .03, 10), { pos: [0, 0, .035], rot: [P3 / 2, 0, 0] });
    [-1, 1].forEach(sg => ba('fe', RB(.03, .05, .03, .004, 1), { pos: [sg * Math.sin(.95) * L, Math.cos(.95) * L, .03] }));
  } else {
    ba('fe', RB(.34, .16, .26, .01), { pos: [0, .08, 0] });
    ba('piedra', RB(.4, .04, .32, .008), { pos: [0, .02, 0], eje: 0, tile: 1 });
    [-1, 1].forEach(sg => ba('fe', RB(.03, .05, .03, .004, 1), { pos: [0, .17, sg * Math.sin(.8) * L * .5] }));
  }
  ma('fe', new THREE.CylinderGeometry(.012, .012, L, 6), { pos: [0, L / 2, 0] });
  ma('fe', new THREE.CylinderGeometry(.012, .012, .1, 6), { pos: [0, -.05, 0] });
  ma('mad', new THREE.SphereGeometry(.035, 8, 6), { pos: [0, L + .02, 0], tint: .9 });
  const maneta = new THREE.Group(); maneta.add(m.fin().root); maneta.position.set(0, suelo ? .17 : 0, suelo ? 0 : .05);
  root.add(b.fin().root); root.add(maneta);
  const obj = { root, anchor: null, mec, en: false,
    anim: t => { const v = mec.paso(t), ang = .8 - 1.6 * v; if (suelo) maneta.rotation.x = ang * .9; else maneta.rotation.z = ang; },
    fijar: on => { obj.en = !!on; mec.ir(obj.en ? 1 : 0, 'lento'); escucha.forEach(f => f(obj.en)); },
    alternar: () => obj.fijar(!obj.en), conectar: fn => { escucha.push(fn); return obj; },
    abrir: () => obj.fijar(true), cerrar: () => obj.fijar(false), soltar: () => obj.fijar(false), estado: () => mec.valor, esAbierto: () => obj.en };
  maneta.rotation.z = .8;
  return marcar(obj);
}

/* ================= registro ================= */
const DEFS_L3 = {
  roca: { nombre: 'Roca', f: rocaPro, params: { r: [.2, 3, .8, .05], alto: [.4, 1.5, .8, .05], forma: [0, 1, .4, .05], musgo: [0, 1, .5, .05], semilla: [1, 60, 1, 1] } },
  rocal: { nombre: 'Conjunto de rocas', f: rocalPro, params: { n: [1, 12, 5, 1], r: [.3, 2, .8, .05], forma: [0, 1, .4, .05], musgo: [0, 1, .5, .05], semilla: [1, 60, 1, 1] } },
  parche_tierra: { nombre: 'Parche de tierra', f: tierraPro, params: { w: [2, 40, 12, 1], d: [2, 40, 10, 1], rug: [0, 1, .5, .05], semilla: [1, 60, 1, 1], sendero: [0, 1, 0, 1], piedritas: [0, 1, .5, .05] } },
  parche_pasto: { nombre: 'Parche de pasto', f: pastoPro, params: { w: [1, 40, 10, 1], d: [1, 40, 8, 1], altura: [.2, 1.2, .6, .05], densidad: [.2, 3, 1, .1], semilla: [1, 60, 1, 1], borde: [0, 1, .6, .05], rug: [0, 1, .5, .05], semillaSuelo: [1, 60, 1, 1], ox: [-100, 100, 0, .5], oz: [-100, 100, 0, .5], sendero: [0, 1, 0, 1], wSuelo: [2, 40, 12, 1] } },
  reja: { nombre: 'Reja levadiza', f: rejaPro, params: { w: [1.2, 5, 2.4, .1], h: [2, 5, 3.2, .1], sep: [.1, .3, .16, .01], marco: [0, 1, 1, 1] } },
  puente_levadizo: { nombre: 'Puerta-puente levadizo', f: puentePro, params: { w: [2, 5, 3, .1], l: [2.5, 6, 4, .1], marco: [0, 1, 1, 1] } },
  palanca: { nombre: 'Palanca', f: palancaPro, params: { modo: [0, 1, 0, 1], largo: [.3, .8, .5, .02] }, ancla: 'borde', elev: 1.1 },
};
const HUELLAS_L3 = {
  roca: p => [p.r * 2.2, p.r * 2.2], rocal: p => [p.r * 4, p.r * 4], parche_tierra: p => [p.w, p.d], parche_pasto: p => [p.w, p.d],
  reja: p => [p.w + 1, .8], puente_levadizo: p => [p.w + 1.2, p.l + 1], palanca: () => [.4, .3],
};
export const TIPOS_LOTE3 = Object.keys(DEFS_L3);

export function registrarLote3() {
  for (const k in DEFS_L3) CATALOGO[k] = Object.assign({}, CATALOGO[k] || {}, DEFS_L3[k]);
  Object.assign(HUELLA, HUELLAS_L3);
  Object.assign(ETIQUETAS, { largo: 'Largo', rug: 'Rugosidad', semilla: 'Semilla', sendero: 'Sendero (0/1)', piedritas: 'Piedritas', altura: 'Altura', densidad: 'Densidad', borde: 'Borde irregular', ox: 'Desfase x', oz: 'Desfase z', semillaSuelo: 'Semilla del suelo', wSuelo: 'Ancho del suelo', sep: 'Separación barras', forma: 'Forma (0 redonda, 1 angular)', musgo: 'Musgo', alto: 'Alto (proporción)', modo: 'Modo (0 pared, 1 suelo)', marco: 'Marco de piedra (0/1)' });
}
