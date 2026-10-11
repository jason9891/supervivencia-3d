import * as S from '../swing-style.js';
import * as C from '../combat.js';
let fails = 0; const check = (n, ok) => { console.log((ok ? 'OK   ' : 'FALLA ') + n); if (!ok) fails++; };

// Golpes reales del juego: tres golpes seguidos de espada.
const f = C.createFighter(); f.weapon = C.WEAPONS.espada;
const seq = [];
for (const type of ['side', 'side', 'forward']) {
  C.tryAttack(f, type); seq.push({ a: f.attack, n: f.chain.length });
  for (let i = 0; i < 200 && f.attack; i++) C.updateFighter(f, 0.01);   // termina el golpe
}
const styles = seq.map(x => S.swingStyle(x.a, x.n));
check('los tres golpes tienen estilos distintos', new Set(styles.map(s => JSON.stringify([s.yaw, s.pitch, s.lunge, s.roll]))).size === 3);
check('los dos tajos giran hacia lados opuestos', Math.sign(styles[0].yaw) === -Math.sign(styles[1].yaw));
check('la estocada es el golpe que más avanza', styles[2].lunge > styles[0].lunge && styles[2].lunge > styles[1].lunge);
check('el remate del combo avanza más y crece un poco', styles[2].pop > 1 && seq[2].a.combo && styles[2].lunge > 1.1);
const tor = (() => { const g = C.createFighter(); g.weapon = C.WEAPONS.espada; const out = []; for (const t of ['neutral', 'side', 'side']) { C.tryAttack(g, t); out.push(g.attack); for (let i = 0; i < 200 && g.attack; i++) C.updateFighter(g, 0.01); } return S.swingStyle(out[2], 3); })();
check('Torbellino gira una vuelta completa', Math.abs(tor.spin - Math.PI * 2) < 1e-9 && Math.abs(S.swingPose(tor, tor.dur).yaw - Math.PI * 2) < 0.05);

// Sincronía con el reloj del juego
const a0 = seq[0].a, st0 = styles[0];
const rate = S.playbackRate(S.STRIKE_AT['sword attack'], a0, st0);
check('el impacto del clip cae en el momento del golpe del juego', Math.abs(0.4 / rate - a0.hit / st0.speed) < 1e-9);
check('el clip de 1.5 s se acelera (el golpe dura ~0.55 s)', rate > 1.3);

// Poses
const p0 = S.swingPose(st0, 0), pHit = S.swingPose(st0, a0.hit), pEnd = S.swingPose(st0, a0.dur);
check('empieza y termina en postura neutra', Math.abs(p0.yaw) < 1e-9 && Math.abs(pEnd.yaw) < 1e-9 && Math.abs(pEnd.pitch) < 1e-9);
check('en el impacto llega al máximo giro y avance', Math.abs(pHit.yaw - st0.yaw) < 1e-6 && Math.abs(pHit.advance - st0.lunge) < 1e-6);
check('antes del impacto carga hacia el lado contrario', S.swingPose(st0, a0.hit * 0.25).yaw * st0.yaw < 0);

// Selección de clip
const has = n => ['sword attack'].includes(n);
check('con solo UAL1 todos los golpes usan Sword_Attack', ['forward', 'side', 'neutral'].every(t => S.pickClip(t, 1, false, has) === 'sword attack') && S.pickClip('side', 3, true, has) === 'sword attack');
const has2 = n => ['sword attack', 'sword dash', 'sword regular a', 'sword regular a combo', 'melee hook', 'ninjump slash'].includes(n);
check('con UAL2 cada golpe usa un clip distinto', new Set([S.pickClip('side', 1, false, has2), S.pickClip('side', 2, false, has2), S.pickClip('side', 3, false, has2), S.pickClip('forward', 1, false, has2), S.pickClip('side', 3, true, has2)]).size === 5);
check('si falta un clip de UAL2 usa Sword_Attack', S.pickClip('neutral', 1, false, has2) === 'sword attack');
console.log(fails ? 'HAY FALLAS' : 'TODAS LAS PRUEBAS PASARON'); process.exit(fails ? 1 : 0);
