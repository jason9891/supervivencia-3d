// Pruebas del editor stop-motion (anim-lab.html) sin navegador: toma del HTML las funciones de fotogramas y auto-key y las ejecuta con un DOM falso.
// Uso: node tests/anim-lab.test.mjs (desde la raíz del repositorio)
import fs from 'fs';
const src = fs.readFileSync((process.argv[2] || 'anim-lab-app.js'), 'utf8');
const grab = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('marcador no encontrado: ' + from); return src.slice(a, b); };
const sample = grab('function sampleClip', 'function getClip');
const frames = grab('const FRAME', 'function refreshKeysBar');
const els = {};
const document = { getElementById: (id) => els[id] ??= { value: '0', max: '1000', step: '1', textContent: '' } };
const body = `
let currentPose = {}; let clipName = 'walk'; const clips = { walk: { name: 'walk', duration: 1.0, keys: [{ t: 0, pose: {} }] } };
function getClip() { return clips[clipName]; }
${sample}
${frames}
return { FRAME, clips, getClip, sampleClip, bakeClip, autoKey, currentTime, setTimelineFromT, frameCount, timelineEl, setPose: (p) => { currentPose = p; } };`;
const A = new Function('document', body)(document);
let fails = 0;
const check = (n, ok, extra = '') => { console.log((ok ? 'OK   ' : 'FALLA') + ' ' + n + (extra ? ' ' + extra : '')); if (!ok) fails++; };

// 1) La caminata realista del monstruo ya está en la rejilla de 0.05 s y cierra el ciclo
const ex = JSON.parse(fs.readFileSync('assets/anims/monster-walk.json', 'utf8')).clips.walk;
const baked = A.bakeClip(ex);
check('duración 1.2 s y 25 keys (fotogramas 0..24)', baked.duration === 1.2 && baked.keys.length === 25, `(${baked.duration}, ${baked.keys.length})`);
check('las keys caen en la rejilla de 0.05', baked.keys.every((k, i) => Math.abs(k.t - i * 0.05) < 1e-9));
check('el ciclo cierra: último fotograma = primero', JSON.stringify(baked.keys[0].pose) === JSON.stringify(baked.keys[24].pose));
check('la key 5 (t=0.25) coincide con el muestreo del clip', Math.abs(baked.keys[5].pose.leftUpLeg.z - A.sampleClip(ex, 0.25).leftUpLeg.z) < 1e-9);
check('la cadera trae traslación px/py/pz y se interpola', baked.keys[3].pose.hips.py !== undefined && Math.abs(A.sampleClip(ex, 0.025).hips.py - (ex.keys[0].pose.hips.py + ex.keys[1].pose.hips.py) / 2) < 1e-9);
check('el clip trae la mandíbula (jaw)', baked.keys.every((k) => k.pose.jaw && Math.abs(k.pose.jaw.z) < 0.3));
check('el bake no comparte objetos con el clip original', baked.keys[3].pose !== ex.keys[0].pose && baked.keys[3].pose.hips !== A.sampleClip(ex, 0.15).hips);

// 2) Auto-key: navegar crea la key; mover un hueso la sobrescribe
A.clips.walk = baked; A.setTimelineFromT(0);
A.setPose(A.sampleClip(A.getClip(), 0));
check('en el fotograma 0 ya hay key, no se crea otra', A.autoKey(false) === false && A.getClip().keys.length === 25);
const c2 = { name: 'x', duration: 1.0, keys: [{ t: 0, pose: {} }] }; A.clips.walk = c2;
A.timelineEl.value = '7'; check('currentTime = fotograma × 0.05', Math.abs(A.currentTime() - 0.35) < 1e-9, `(${A.currentTime()})`);
A.setPose(A.sampleClip(c2, 0.35));
check('visitar el fotograma 7 sin key la crea', A.autoKey(false) === true && c2.keys.length === 2 && Math.abs(c2.keys[1].t - 0.35) < 1e-9);
check('volver a visitarlo no duplica', A.autoKey(false) === false && c2.keys.length === 2);
A.setPose({ leftArm: { x: 1, y: 0, z: 0 } }); A.autoKey(true);
check('editar un hueso guarda el fotograma actual (commit)', c2.keys[1].pose.leftArm.x === 1);
A.timelineEl.value = '3'; A.setPose(A.sampleClip(c2, 0.15)); A.autoKey(false);
check('keys ordenadas por tiempo', c2.keys.map(k => k.t).join() === '0,0.15,0.35');
const half = A.sampleClip(c2, 0.25);
check('entre dos keys el muestreo interpola linealmente', Math.abs(half.leftArm.x - (c2.keys[1].pose.leftArm.x + c2.keys[2].pose.leftArm.x) / 2) < 1e-9, `(${JSON.stringify(half.leftArm)})`);

// 3) Línea de tiempo: el rango sigue a la duración
c2.duration = 1.4; A.setTimelineFromT(1.4);
check('duración 1.4 → 28 fotogramas y el slider llega a 28', A.timelineEl.max === '28' && A.timelineEl.value === '28', `(max ${A.timelineEl.max}, valor ${A.timelineEl.value})`);
console.log(fails ? fails + ' FALLARON' : 'TODAS LAS PRUEBAS PASARON');
process.exit(fails ? 1 : 0);
