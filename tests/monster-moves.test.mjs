// Datos de los clips realistas del monstruo (carrera y 3 golpes): estructura, tiempos coherentes y poses finitas.
import fs from 'node:fs';
let n = 0; const ok = (c, m) => { if (!c) { console.error('FALLA: ' + m); process.exit(1); } n++; };
const load = (f) => JSON.parse(fs.readFileSync(new URL('../assets/anims/' + f, import.meta.url)));
const deaths = load('monster-death.json').clips, death = deaths.death, walk = load('monster-walk.json').clips.walk, run = load('monster-run.json').clips.run, atk = load('monster-attack.json').clips;
const BONES = ['hips','spine','spine1','spine2','neck','head','leftShoulder','leftArm','leftForeArm','leftHand','rightShoulder','rightArm','rightForeArm','rightHand','leftUpLeg','leftLeg','leftFoot','rightUpLeg','rightLeg','rightFoot','jaw'];
for (const [name, c] of Object.entries({ walk, run, ...deaths, ...atk })) {
  ok(c.keys.length > 8 && c.keys[0].t === 0 && Math.abs(c.keys.at(-1).t - c.duration) < 1e-6, name + ': claves de 0 a duration');
  for (const k of c.keys) for (const b of BONES) {
    const e = k.pose[b]; ok(e && [e.x, e.y, e.z].every(Number.isFinite), name + ' t=' + k.t + ' ' + b + ': ángulos finitos');
    ok(Math.abs(e.x) < 12 && Math.abs(e.y) < 12 && Math.abs(e.z) < 12, name + ' ' + b + ': ángulos sin desenrollar de más');
  }
  ok(c.keys.every((k, i) => i === 0 || k.t > c.keys[i - 1].t), name + ': tiempos crecientes');
}
// bucles: carrera y caminata cierran el ciclo
for (const c of [walk, run]) for (const b of BONES) { const a = c.keys[0].pose[b], z = c.keys.at(-1).pose[b]; ok(Math.abs(a.x - z.x) + Math.abs(a.y - z.y) + Math.abs(a.z - z.z) < 0.02, c.name + ' cierra el ciclo en ' + b); }
ok(run.speed > 1 && run.duration < walk.duration, 'la carrera es más rápida que la caminata');
// golpes: impacto dentro del clip, cadena que no pasa de la duración, el 3.º es el más largo
for (const k of ['attack1', 'attack2', 'attack3']) { const c = atk[k]; ok(c.hit > 0.2 && c.hit < c.duration, k + ': impacto dentro del clip'); ok(c.chain >= c.hit && c.chain <= c.duration, k + ': punto de encadenado válido'); }
ok(atk.attack3.duration > atk.attack1.duration && atk.attack3.hit > atk.attack1.hit, 'el golpe final es el más largo');
// la mandíbula se abre más al golpear que en reposo (−z abre)
const jawMin = (c) => Math.min(...c.keys.map((k) => k.pose.jaw.z));
ok(jawMin(atk.attack3) < -0.4 && jawMin(atk.attack1) < -0.25 && jawMin(run) < -0.15, 'mandíbula abierta al rugir, golpear y correr');
ok(jawMin(atk.attack3) > -0.7 && jawMin(atk.attack1) > -0.5 && jawMin(run) > -0.35 && jawMin(death) > -0.6, 'sin exagerar: la mandíbula no se abre de más');
// muertes con suelo y gravedad (tools/gen-monster-death.py): la caída va dentro del clip y el suelo se comprueba en el generador
for (const k of ['death', 'deathFront', 'deathSideR', 'deathSideL', 'deathKneel']) {
  const c = deaths[k]; ok(c, k + ' existe'); ok(c.baked === true && c.tilt.angle === 0, k + ': caída horneada (la raíz no vuelca)');
  ok(c.duration >= 1.8, k + ': dura lo suficiente para caer y reposar');
  const hy = c.keys.at(-1).pose.hips.py; ok(hy > -0.3 && hy < 0.2, k + ': cadera final razonable (' + hy + ')');
  // quietud al final: los últimos fotogramas no cambian (cuerpo en reposo sobre el suelo)
  const a = c.keys.at(-1).pose, z = c.keys.at(-6).pose;
  ok(Math.abs(a.hips.py - z.hips.py) < 0.01 && Math.abs(a.spine.x - z.spine.x) < 0.05, k + ': termina quieto');
}
ok(deaths.deathFront.keys.at(-1).pose.jaw.z > -0.1, 'de bruces el hocico toca el suelo y la mandíbula se CIERRA');
ok(deaths.death.keys.at(-1).pose.jaw.z < -0.3, 'de espaldas la mandíbula cae abierta');
const arm0 = (c) => { const p = c.keys[0].pose, q = c.keys.at(-1).pose; return Math.abs(q.leftArm.x - p.leftArm.x) + Math.abs(q.leftArm.y - p.leftArm.y) + Math.abs(q.leftArm.z - p.leftArm.z); };
ok(Object.values(deaths).every((c) => arm0(c) > 0.3), 'los brazos acaban en otra posición: cuelgan, no se quedan como al caminar');
console.log('monster-moves: ' + n + ' comprobaciones\nTODAS LAS PRUEBAS PASARON');
