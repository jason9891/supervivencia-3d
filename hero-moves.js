// hero-moves.js — qué animación usa el héroe en cada situación (la «tabla de movimiento»), en un solo sitio y por roles.
//   · BÁSICAS (siempre activas): rol → clips candidatos, con un juego «desarmado» y otro «armado» (botón ARMA). Si falta un clip armado se cae al desarmado.
//   · ATAQUES: los del grupo «ataque» del GLB (en su orden) cuando está armado; sin armas, puñetazos.
//   · MAPA: no entran aquí; los dispara el mapa con window.playTrigger(nombre).
// Cambiar una animación = cambiar un nombre de esta tabla (los nombres son los del GLB que crea clips-lab).
export const MOVES = {
  desarmado: { idle: ['idle loop'], walk: ['walk loop'], run: ['sprint loop', 'jog fwd loop'], jumpStart: ['jump start'], jumpLoop: ['jump loop'], jumpLand: ['jump land'] },
  armado:    { idle: ['sas idle', 'sword idle'], walk: ['sas walk'], run: ['sas run'] },        // el salto es el mismo
};
// Roles que solo existen en el juego Mixamo «sword and shield» (los usa también el desarmado): retroceso, retroceso corriendo y pasos laterales.
// Sentido verificado en los FBX: 'sas strafe' y '(4)' van hacia la DERECHA del personaje, '(2)' y '(3)' hacia la IZQUIERDA; walk (2) / run (2) son hacia atrás.
export const MOVES_SAS = { back: ['sas walk (2)'], backRun: ['sas run (2)'], strafeR: ['sas strafe'], strafeL: ['sas strafe (2)'], strafeRunR: ['sas strafe (4)'], strafeRunL: ['sas strafe (3)'] };
// Velocidad a la que recorre cada clip a rate 1 (m/s, medida del desplazamiento de la cadera): rate = velocidad del juego / esta velocidad → los pies no patinan.
export const CLIP_SPEED = { walk: 1.57, run: 4.6, back: 1.2, backRun: 4.8, strafeR: 1.54, strafeL: 1.54, strafeRunR: 3.6, strafeRunL: 3.6 };
export const ATTACKS = {
  desarmado: ['punch jab', 'punch cross'],
  armado:    ['sas attack', 'sas slash', 'sas attack (2)', 'sas slash (2)'],                   // si el GLB trae grupo «ataque» se usa ese en su lugar
};

// mismos nombres normalizados que usa el juego para sus clips ('sas walk (2)' → 'sas walk 2')
export const normName = (n) => (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Nombres de clip para el estado actual (armado o no). has(nombre) dice si el clip existe. */
export function movesFor(armed, has, speeds = null) {
  const out = { rates: {} };
  for (const role of Object.keys(MOVES.desarmado)) {
    const cands = [...(armed ? MOVES.armado[role] || [] : []), ...MOVES.desarmado[role]];
    out[role] = cands.find(has);
  }
  for (const role of Object.keys(MOVES_SAS)) out[role] = (!armed && (role === 'back' || role === 'backRun')) ? undefined : MOVES_SAS[role].find(has);   // desarmado retrocede con su caminar al revés; los pasos laterales solo existen en la guardia
  for (const k of Object.keys(out)) if (typeof out[k] === 'string') out[k] = normName(out[k]);   // el mixer/loco busca por nombre normalizado
  if (speeds) {                                                    // ritmo de cada clip según la velocidad real del juego (solo los de Mixamo; los UAL ya van a 1)
    for (const role of Object.keys(CLIP_SPEED)) {
      const sas = (role === 'walk' || role === 'run') ? armed : true;
      if (sas && speeds[role] && out[role]) out.rates[role] = speeds[role] / CLIP_SPEED[role];
    }
  }
  return out;
}

/** Combo de golpes [{ key, dur, hit }] a partir de nombres de clip; `clip(nombre)` devuelve el AnimationClip o undefined. */
export function comboFrom(names, clip) {
  return names.map((n) => ({ n, c: clip(n) })).filter((x) => x.c).map((x) => ({ key: x.n, dur: x.c.duration, hit: x.c.duration * 0.4 }));
}
