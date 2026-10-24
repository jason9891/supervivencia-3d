// hero-moves.js — qué animación usa el héroe en cada situación (la «tabla de movimiento»), en un solo sitio y por roles.
//   · BÁSICAS (siempre activas): rol → clips candidatos, con un juego «desarmado» y otro «armado» (botón ARMA). Si falta un clip armado se cae al desarmado.
//   · ATAQUES: los del grupo «ataque» del GLB (en su orden) cuando está armado; sin armas, puñetazos.
//   · MAPA: no entran aquí; los dispara el mapa con window.playTrigger(nombre).
// Cambiar una animación = cambiar un nombre de esta tabla (los nombres son los del GLB que crea clips-lab).
export const MOVES = {
  desarmado: { idle: ['idle loop'], walk: ['walk loop'], run: ['sprint loop', 'jog fwd loop'], jumpStart: ['jump start'], jumpLoop: ['jump loop'], jumpLand: ['jump land'] },
  armado:    { idle: ['sas idle', 'sword idle'], walk: ['sas walk'], run: ['sas run'] },        // el salto es el mismo
};
export const ATTACKS = {
  desarmado: ['punch jab', 'punch cross'],
  armado:    ['sas attack', 'sas slash', 'sas attack (2)', 'sas slash (2)'],                   // si el GLB trae grupo «ataque» se usa ese en su lugar
};

/** Nombres de clip para el estado actual (armado o no). has(nombre) dice si el clip existe. */
export function movesFor(armed, has) {
  const out = {};
  for (const role of Object.keys(MOVES.desarmado)) {
    const cands = [...(armed ? MOVES.armado[role] || [] : []), ...MOVES.desarmado[role]];
    out[role] = cands.find(has);
  }
  return out;
}

/** Combo de golpes [{ key, dur, hit }] a partir de nombres de clip; `clip(nombre)` devuelve el AnimationClip o undefined. */
export function comboFrom(names, clip) {
  return names.map((n) => ({ n, c: clip(n) })).filter((x) => x.c).map((x) => ({ key: x.n, dur: x.c.duration, hit: x.c.duration * 0.4 }));
}
