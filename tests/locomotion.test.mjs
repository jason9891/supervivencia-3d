import * as L from '../locomotion.js';
let fails = 0; const check = (n, ok, extra = '') => { console.log((ok ? 'OK   ' : 'FALLA ') + n + (ok ? '' : '  ' + extra)); if (!ok) fails++; };
const has = () => true;
const run = (s, o, dt = 1 / 60, n = 1) => { let p; for (let i = 0; i < n; i++) p = L.stepLoco(s, o, dt, has); return p; };
const g = { grounded: true, moving: false, running: false, back: false };

// Retroceso
check('atrás con teclas mirando a +Z → retroceso', L.backpedal({ fwd: -1, strafe: 0, facing: 0 }));
check('atrás con teclas pero mirando de lado → el personaje gira (no retrocede)', !L.backpedal({ fwd: -1, strafe: 0, facing: Math.PI / 2 }));
check('atrás + lado → no es retroceso puro', !L.backpedal({ fwd: -1, strafe: 1, facing: 0 }));
check('adelante nunca es retroceso', !L.backpedal({ fwd: 1, strafe: 0, facing: 0 }));
check('joystick tanque: atrás siempre retrocede', L.backpedal({ fwd: -0.8, strafe: 0, facing: Math.PI, tank: true }));
check('joystick casi al centro no cuenta', !L.backpedal({ fwd: -0.1, strafe: 0, facing: 0, tank: true }));

// Elección de clip en el suelo
const s1 = L.createLocoState();
check('quieto → idle', run(s1, g).name === 'idle loop');
check('caminar → walk loop', run(s1, { ...g, moving: true }).name === 'walk loop');
check('correr → jog fwd loop', run(s1, { ...g, moving: true, running: true }).name === 'jog fwd loop');
const back = run(s1, { ...g, moving: true, back: true });
check('retroceder → walk loop al revés (rate negativo, otra clave)', back.name === 'walk loop' && back.rate === L.BACK_RATE && back.rate < 0 && back.key.endsWith('-rev'));
check('retroceder corriendo no corre: sigue siendo el paso lento al revés', run(s1, { ...g, moving: true, running: true, back: true }).rate < 0);

// Salto: despegue → pose extendida → aterrizaje
const s2 = L.createLocoState(); run(s2, g);
const air = { ...g, grounded: false, moving: true, running: true };
const t0 = run(s2, air);
check('al despegar suena Jump_Start acelerado y entrando ya en el impulso', t0.name === 'jump start' && t0.rate > 1 && t0.start > 0 && t0.once);
check('en el aire se mantiene Jump_Start al inicio', run(s2, air, 1 / 60, 5).name === 'jump start');
check('pasado el despegue pasa a Jump_Loop', run(s2, air, 1 / 60, 20).name === 'jump loop');
check('aterrizar corriendo: continúa corriendo (sin recepción que frene)', run(s2, { ...g, moving: true, running: true }).name === 'jog fwd loop');
const s3 = L.createLocoState(); run(s3, g); run(s3, air, 1 / 60, 40);
const land = run(s3, g);
check('aterrizar quieto tras un salto largo → Jump_Land acelerado', land.name === 'jump land' && land.rate > 1 && land.once);
check('la recepción dura poco y vuelve a idle', run(s3, g, 1 / 60, 60).name === 'idle loop');
const s4 = L.createLocoState(); run(s4, g); run(s4, air, 1 / 60, 3); run(s4, g);
check('un saltito sin aire suficiente no hace recepción', run(s4, g).name === 'idle loop');

// Sin algunos clips cae a los que hay
const only = n => ['walk loop', 'idle loop'].includes(n);
const s5 = L.createLocoState();
check('sin clip de correr usa caminar', L.stepLoco(s5, { ...g, moving: true, running: true }, 1 / 60, only).name === 'walk loop');
check('sin clips de salto en el aire usa idle', L.stepLoco(s5, { ...g, grounded: false }, 1 / 60, only).name === 'idle loop');

// Giro suave
let y = 0; for (let i = 0; i < 30; i++) y = L.smoothYaw(y, Math.PI * 0.9, 1 / 60);
check('smoothYaw se acerca sin pasarse', y > 1.5 && y < Math.PI * 0.9);
check('smoothYaw toma el camino corto (de 3.0 a -3.0 pasa por π)', L.smoothYaw(3.0, -3.0, 1 / 60) > 3.0);

// createLoco con un mixer de mentira
const THREE = { LoopOnce: 2200, LoopRepeat: 2201 };
const mk = clip => ({ clip, time: 0, ts: 1, faded: false, played: 0, reset() { this.time = 0; return this; }, setLoop(m) { this.loop = m; }, setEffectiveTimeScale(v) { this.ts = v; }, fadeIn() { return this; }, fadeOut() { this.faded = true; }, play() { this.played++; return this; }, getClip() { return this.clip; } });
const mixer = { clipAction: c => (mixer._a ??= new Map()).get(c) ?? (mixer._a.set(c, mk(c)), mixer._a.get(c)) };
const clips = new Map([['walk loop', { duration: 1.33 }], ['jump start', { duration: 1.33 }]]);
const host = { active: null }; const loco = L.createLoco(THREE, mixer, clips, host);
loco.apply({ key: 'walk loop-rev', name: 'walk loop', rate: -0.7 });
check('al revés empieza por el final del ciclo y con rate negativo', host.active.ts === -0.7 && Math.abs(host.active.time - 1.33) < 1e-9 && host.active.loop === THREE.LoopRepeat);
loco.apply({ key: 'walk loop-rev', name: 'walk loop', rate: -0.7 });
check('repetir la misma petición no reinicia la animación', host.active.played === 1);
loco.apply({ key: 'jump start', name: 'jump start', rate: 1.6, start: 0.06, once: true });
check('Jump_Start: una vez, desde 0.06 s, con clamp, y corta la anterior', host.active.loop === THREE.LoopOnce && Math.abs(host.active.time - 0.06) < 1e-9 && host.active.clampWhenFinished && mixer._a.get(clips.get('walk loop')).faded);
check('clip inexistente no rompe', loco.apply({ key: 'x', name: 'no existe', rate: 1 }) === false);
console.log(fails ? 'HAY FALLAS' : 'TODAS LAS PRUEBAS PASARON'); process.exit(fails ? 1 : 0);
