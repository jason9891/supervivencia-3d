import { buildCourse, createPlayer, stepPlayer, RUN_SPEED, WALK_SPEED, GAPS } from '../course.js';
const dt = 1/60;
let fails = 0;
const check = (name, cond, extra='') => { console.log((cond?'OK   ':'FALLA ')+name+(extra?'  '+extra:'')); if(!cond) fails++; };

const course = buildCourse();
console.log('segmentos:', course.segments.map(s=>`[${s.a.toFixed(1)}→${s.b.toFixed(1)}]`).join(' '));

// Intenta cruzar el hueco i desde el segmento i; salta cuando falta `lead` m para el borde.
function tryCross(i, speed, lead) {
  const p = createPlayer(course);
  const seg = course.segments[i];
  p.x = 0; p.z = seg.b + 1.5; p.y = 0; p.grounded = true;
  let jumped = false;
  for (let t = 0; t < 600; t++) {
    const toEdge = p.z - seg.b;
    const jump = !jumped && toEdge <= lead;
    const ev = stepPlayer(p, course, { f: 1, side: 0, speed, jump }, dt);
    if (ev.jumped) jumped = true;
    if (ev.fell) return { ok:false, p };
    if (p.best >= i+1 && p.grounded) return { ok:true, p };
  }
  return { ok:false, p };
}

// 1) Carrera con salto: todos los huecos, con distintas anticipaciones del toque.
for (let i = 0; i < GAPS.length; i++) {
  for (const lead of [0.0, 0.1, 0.2]) {
    const r = tryCross(i, RUN_SPEED, lead);
    check(`correr+saltar hueco ${i+1} (${GAPS[i]} m), toque a ${lead} m del borde`, r.ok);
  }
}
// 2) Caminando solo deben poder los huecos chicos.
for (let i = 0; i < GAPS.length; i++) {
  const r = tryCross(i, WALK_SPEED, 0.0);
  const expected = GAPS[i] <= 1.4;
  check(`caminar+saltar hueco ${i+1} (${GAPS[i]} m): ${expected?'debe cruzar':'debe caer'}`, r.ok === expected);
}
// 3) Caer, reaparecer en el último punto seguro y poder reintentar.
{
  const p = createPlayer(course); const seg = course.segments[2];
  p.z = seg.b + 0.5; p.grounded = true;
  stepPlayer(p, course, {f:0,side:0}, dt); // registra checkpoint del segmento 2
  let ev, steps=0;
  do { ev = stepPlayer(p, course, {f:1,side:0,speed:WALK_SPEED,jump:false}, dt); steps++; } while(!ev.fell && steps<2000);
  check('caminar sin saltar al barranco termina en caída', ev.fell && p.falls===1, `(${steps} pasos)`);
  check('reaparece sobre una plataforma, en el inicio del segmento', Math.abs(p.z-(seg.a-1.5))<1e-9 && p.y===0 && p.grounded);
}
// 4) Salto en el sitio: sube ~1 m y vuelve al suelo.
{
  const p = createPlayer(course); let maxY=0, landed=false;
  stepPlayer(p, course, {f:0,side:0,jump:true}, dt);
  for (let t=0;t<120;t++){ const ev=stepPlayer(p,course,{f:0,side:0},dt); maxY=Math.max(maxY,p.y); if(ev.landed) landed=true; }
  check('salto en el sitio: altura entre 0.9 y 1.2 m', maxY>0.9 && maxY<1.2, `(max ${maxY.toFixed(2)} m)`);
  check('salto en el sitio: aterriza y queda en el suelo', landed && p.grounded && p.y===0);
}
// 5) Recorrido completo con un "jugador" automático hasta la meta.
{
  const p = createPlayer(course); let goal=false, jumpedCount=0;
  for (let t=0;t<6000 && !goal;t++){
    const seg = course.segments[Math.min(p.best, course.segments.length-1)];
    const nearEdge = p.grounded && (p.z - seg.b) <= 0.1 && p.best < course.segments.length-1;
    const ev = stepPlayer(p, course, {f:1,side:0,speed:RUN_SPEED,jump:nearEdge}, dt);
    if (ev.jumped) jumpedCount++;
    if (ev.reachedGoal && p.best===course.segments.length-1) goal=true;
  }
  check('recorrido completo hasta la meta', goal && p.falls===0, `(saltos: ${jumpedCount}, caídas: ${p.falls})`);
}
// 6) Movimiento: W va hacia -Z, D hacia +X, y diagonal no es más rápida.
{
  const p = createPlayer(course); const z0=p.z;
  for(let i=0;i<60;i++) stepPlayer(p,course,{f:1,side:0,speed:1.8},dt);
  check('W avanza hacia -Z a la velocidad pedida', Math.abs((z0-p.z)-1.8)<0.02);
  const q = createPlayer(course); const x0=q.x, qz=q.z;
  for(let i=0;i<60;i++) stepPlayer(q,course,{f:0,side:1,speed:1.8},dt);
  check('D mueve a +X sin desviarse en Z', Math.abs((q.x-x0)-1.8)<0.02 && Math.abs(q.z-qz)<1e-9);
  const r = createPlayer(course); const rx=r.x, rz=r.z;
  for(let i=0;i<60;i++) stepPlayer(r,course,{f:1,side:1,speed:1.8},dt);
  check('diagonal con la misma velocidad', Math.abs(Math.hypot(r.x-rx,r.z-rz)-1.8)<0.02);
}
console.log(fails? `\n${fails} PRUEBA(S) FALLARON` : '\nTODAS LAS PRUEBAS PASARON');
process.exit(fails?1:0);
