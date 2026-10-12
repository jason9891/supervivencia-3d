import * as S from '../swing-style.js';
import * as C from '../combat.js';
let fails = 0; const check = (n, ok) => { console.log((ok ? 'OK   ' : 'FALLA ') + n); if (!ok) fails++; };

// --- Pasos de la cadena: 1 → 2 → 3, pausa, 1 → 2 → 3 ---
const st = { step: 0, endedAt: -1e9 };
let t = 0; const seq = [];
for (let i = 0; i < 6; i++) { seq.push(S.advanceStep(st, t)); st.endedAt = t + 0.5; t += 0.5 + 0.2; } // golpes seguidos, sin pausa larga
check('seis golpes seguidos hacen 1-2-3-1-2-3', seq.join('') === '123123');
t += 1.5; check('tras una pausa vuelve al paso 1', S.advanceStep(st, t) === 1);
st.endedAt = t + 0.5; t += 0.5 + 0.2; check('y continúa con el 2', S.advanceStep(st, t) === 2);
st.endedAt = t + 0.5; t += 0.5 + 1.0; check('una pausa a mitad de cadena la reinicia', S.advanceStep(st, t) === 1);

// --- Cada paso se ve distinto, sin importar la dirección ---
const f = C.createFighter(); f.weapon = C.WEAPONS.espada;
const atk = type => { f.chain = []; f.chainTimer = 0; f.hitstun = 0; f.stamina = 100; C.tryAttack(f, type); const a = f.attack; for (let i = 0; i < 300 && f.attack; i++) C.updateFighter(f, 0.01); return a; };
const same = ['neutral', 'neutral', 'neutral'].map((ty, i) => S.swingStyle(atk(ty), i + 1));
check('tres golpes iguales (sin dirección) tienen tres estilos distintos', new Set(same.map(s => JSON.stringify([s.yaw, s.pitch, s.lunge, s.roll]))).size === 3);
check('el paso 1 y el 2 giran hacia lados opuestos', Math.sign(same[0].yaw) === -Math.sign(same[1].yaw) && same[0].yaw !== 0);
check('el paso 3 es el que más avanza y se inclina', same[2].lunge > same[0].lunge && same[2].lunge > same[1].lunge && same[2].pitch > same[0].pitch);
check('la dirección solo matiza: estocada avanza más que golpe alto en el mismo paso', S.swingStyle(atk('forward'), 1).lunge > S.swingStyle(atk('neutral'), 1).lunge);
const tor = (() => { const g = C.createFighter(); g.weapon = C.WEAPONS.espada; const out = []; for (const ty of ['neutral', 'side', 'side']) { C.tryAttack(g, ty); out.push(g.attack); for (let i = 0; i < 300 && g.attack; i++) C.updateFighter(g, 0.01); } return S.swingStyle(out[2], 3); })();
check('Torbellino gira una vuelta completa', Math.abs(tor.spin - Math.PI * 2) < 1e-9 && Math.abs(S.swingPose(tor, tor.dur).yaw - Math.PI * 2) < 0.05);

// --- Sincronía con el reloj del juego ---
const a0 = atk('side'), s0 = S.swingStyle(a0, 1);
const rate = S.playbackRate(S.STRIKE_AT['sword attack'], a0, s0);
check('el impacto del clip cae en el momento del golpe del juego', Math.abs(0.4 / rate - a0.hit / s0.speed) < 1e-9);
const w = S.clipWindow(S.STRIKE_AT['sword heavy combo'], a0, s0);
check('un clip largo de 4 s no se acelera al máximo: empieza antes del impacto', w.start > 2 && w.rate < 3 && Math.abs((S.STRIKE_AT['sword heavy combo'] - w.start) / w.rate - a0.hit / s0.speed) < 1e-9);
check('un clip corto empieza desde el principio', S.clipWindow(0.25, a0, s0).start === 0);

// --- Poses ---
const p0 = S.swingPose(s0, 0), pHit = S.swingPose(s0, a0.hit), pEnd = S.swingPose(s0, a0.dur);
check('empieza y termina en postura neutra', Math.abs(p0.yaw) < 1e-9 && Math.abs(pEnd.yaw) < 1e-9 && Math.abs(pEnd.pitch) < 1e-9);
check('en el impacto llega al máximo giro y avance', Math.abs(pHit.yaw - s0.yaw) < 1e-6 && Math.abs(pHit.advance - s0.lunge) < 1e-6);
check('antes del impacto carga hacia el lado contrario', S.swingPose(s0, a0.hit * 0.25).yaw * s0.yaw < 0);

// --- Clips por paso ---
const has1 = n => n === 'sword attack';
check('con solo UAL1 todos los pasos usan Sword_Attack', [1, 2, 3].every(n => S.pickClip(n, has1) === 'sword attack'));
const has2 = n => ['sword attack', 'sword regular a', 'sword regular b', 'sword regular c'].includes(n);
check('con UAL2 cada paso usa un clip distinto', new Set([1, 2, 3].map(n => S.pickClip(n, has2))).size === 3);
console.log(fails ? 'HAY FALLAS' : 'TODAS LAS PRUEBAS PASARON'); process.exit(fails ? 1 : 0);
