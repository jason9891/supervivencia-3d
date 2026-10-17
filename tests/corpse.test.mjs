import * as K from '../corpse.js';
let fails = 0; const check = (n, ok, x = '') => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (x ? ' ' + x : '')); if (!ok) fails++; };
// cuerpo tendido a lo largo de x: de 0 a 2 m
const pts = []; for (let x = 0; x <= 2; x += 0.1) pts.push(x, 0);
const P = Float32Array.from(pts), r = 0.1, pr = 0.4;
for (const [x, z] of [[1, 0], [0.2, 0.1], [1.7, -0.2], [0, 0]]) {
  const p = { x, z }; K.pushOut(p, P, r, pr);
  let d = 9; for (let i = 0; i < P.length; i += 2) d = Math.min(d, Math.hypot(p.x - P[i], p.z - P[i + 1]));
  check(`desde (${x},${z}) el jugador sale de la huella`, d >= r + pr - 1e-3, `(distancia ${d.toFixed(3)})`);
}
const far = { x: 1, z: 3 }; check('lejos del cuerpo no se mueve', K.pushOut(far, P, r, pr) === 0 && far.x === 1 && far.z === 3);
const side = { x: 1, z: 0.45 }; K.pushOut(side, P, r, pr); check('en el borde sólo se aparta lo justo', side.z >= 0.5 - 1e-3 && side.z < 0.56, `(z ${side.z.toFixed(3)})`);
check('inside detecta el interior y no el exterior', K.inside(1, 0.05, P, r) && !K.inside(1, 0.5, P, r));
check('thin reduce la nube y conserva los extremos', K.thin(pts, 10).length === 20 && K.thin(pts, 100).length === pts.length);
console.log(fails ? fails + ' FALLARON' : 'TODAS LAS PRUEBAS PASARON'); process.exit(fails ? 1 : 0);
