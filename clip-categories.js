// clip-categories.js — las animaciones del héroe se dividen en 3 grupos:
//   basica = siempre activas (idle, caminar, correr, saltar…) · ataque = golpes que se encadenan en combo · mapa = las que dispara el mapa (muerte, palanca, caída…)
// clips-lab.html asigna el grupo a cada clip y lo escribe en el nombre del clip dentro del GLB como sufijo « [ataque]» / « [mapa]» (las básicas llevan el nombre limpio);
// hero-fbx.js lo lee de vuelta y deja los nombres normales, para que locomotion.js / index-app.js sigan buscando 'walk loop', 'sword attack'…
export const CATS = ['basica', 'ataque', 'mapa'];
export const CAT_LABEL = { basica: 'BÁSICA', ataque: 'ATAQUE', mapa: 'MAPA' };
export const CAT_TITLE = { basica: 'Básicas (siempre activas)', ataque: 'Ataques (combos)', mapa: 'Disparadores del mapa' };

/** Grupo sugerido por el nombre; en el laboratorio se puede cambiar clip por clip. */
export function guessCategory(name) {
  const n = String(name).toLowerCase();
  if (/(^|\b)(idle|walk|run|sprint|jog|jump|strafe|crouch fwd|crouch idle|fall)\b/.test(n) && !/(attack|combo)/.test(n)) return 'basica';
  if (/(attack|combo|slash|sword regular|sword heavy|punch|kick|spin|swing)/.test(n) && !/ rec\b/.test(n)) return 'ataque';
  return 'mapa';
}
export const encodeName = (name, cat) => (cat === 'ataque' || cat === 'mapa') ? `${name} [${cat}]` : name;
export function decodeName(raw) {
  const m = /^(.*) \[(ataque|mapa|basica)\]$/.exec(raw);
  return m ? { name: m[1], cat: m[2], explicit: true } : { name: raw, cat: guessCategory(raw), explicit: false };
}
