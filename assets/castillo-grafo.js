// castillo-grafo.js — topología del castillo en serpiente. Sin geometría: solo áreas, puertas con candados y objetos.
// Sirve para (1) validar el recorrido y (2) más adelante, que el juego sepa qué puerta abre cada objeto.
// Se puede importar en el navegador (validar-castillo.html) y en Node.

/* Áreas. nivel: planta | alto | sub. opc: opcional. m: metros que se recorren dentro del área (estimación). */
export const NODOS = {
  puente:       { nombre: 'Puente levadizo',  nivel: 'planta', m: 10 },
  barbacana:    { nombre: 'Barbacana',        nivel: 'planta', m: 25 },
  patio_ext:    { nombre: 'Patio exterior',   nivel: 'planta', m: 70 },
  establos:     { nombre: 'Establos',         nivel: 'planta', m: 70 },
  pasaje_sur:   { nombre: 'Pasadizo sur',     nivel: 'planta', m: 150 },
  herreria:     { nombre: 'Herrería',         nivel: 'planta', m: 70 },
  porton_int:   { nombre: 'Portón interior',  nivel: 'planta', m: 15 },
  patio_armas:  { nombre: 'Patio de armas',   nivel: 'planta', m: 80 },
  armeria:      { nombre: 'Armería',          nivel: 'planta', m: 220 },
  calabozos:    { nombre: 'Calabozos',        nivel: 'sub',    m: 280 },
  tunel_oeste:  { nombre: 'Túnel bajo patios',nivel: 'sub',    m: 250 },
  cisternas:    { nombre: 'Cisternas',        nivel: 'sub',    m: 220 },
  cocinas:      { nombre: 'Cocinas',          nivel: 'planta', m: 160 },
  galeria_e:    { nombre: 'Galería este',     nivel: 'planta', m: 165 },
  capilla:      { nombre: 'Capilla',          nivel: 'planta', m: 150 },
  cripta:       { nombre: 'Cripta',           nivel: 'sub',    m: 230 },
  minas:        { nombre: 'Minas hondas',     nivel: 'sub',    m: 300, opc: true },
  tunel_keep:   { nombre: 'Túnel bajo el keep', nivel: 'sub',  m: 260 },
  biblioteca:   { nombre: 'Biblioteca',       nivel: 'alto',   m: 260 },
  galeria_o:    { nombre: 'Galería oeste',    nivel: 'alto',   m: 165 },
  mago:         { nombre: 'Torre del mago',   nivel: 'alto',   m: 140, opc: true },
  adarve:       { nombre: 'Adarve',           nivel: 'alto',   m: 330 },
  reloj:        { nombre: 'Torre del reloj',  nivel: 'alto',   m: 180 },
  vestibulo:    { nombre: 'Vestíbulo de los sellos', nivel: 'planta', m: 20 },
  gran_salon:   { nombre: 'Gran salón',       nivel: 'planta', m: 60 },
  claustro:     { nombre: 'Claustro',         nivel: 'planta', m: 60 },
  trono:        { nombre: 'Sala del trono',   nivel: 'planta', m: 120 },
};
export const INICIO = 'puente', FIN = 'trono';

/* Objetos que se recogen o se activan al llegar al área donde están. */
export const OBJETOS = {
  palanca_herreria: 'herreria',   // abre el portón interior
  runa1: 'armeria', runa5: 'calabozos', runa2: 'cisternas',
  palanca_cocinas: 'cocinas',     // abre la galería este
  runa4: 'cripta', runa3: 'biblioteca', runa6: 'reloj',
  botin_minas: 'minas', botin_mago: 'mago',   // recompensas opcionales: no abren nada
};
const SEIS = ['runa1', 'runa2', 'runa3', 'runa4', 'runa5', 'runa6'];

/* Puertas. req: objetos necesarios para cruzar. uno: solo se cruza de a hacia b (atajos y descensos). atajo: marca los atajos de regreso. */
export const PUERTAS = [
  { a: 'puente', b: 'barbacana' },
  { a: 'barbacana', b: 'patio_ext' },
  { a: 'patio_ext', b: 'establos' },
  { a: 'establos', b: 'pasaje_sur' },
  { a: 'pasaje_sur', b: 'herreria' },
  { a: 'patio_ext', b: 'porton_int', req: ['palanca_herreria'] },
  { a: 'porton_int', b: 'patio_armas' },
  { a: 'patio_armas', b: 'armeria' },
  { a: 'armeria', b: 'calabozos', req: ['runa1'] },
  { a: 'calabozos', b: 'tunel_oeste', req: ['runa5'] },
  { a: 'tunel_oeste', b: 'cisternas' },
  { a: 'cisternas', b: 'cocinas', req: ['runa2'] },
  { a: 'cocinas', b: 'galeria_e', req: ['palanca_cocinas'] },
  { a: 'galeria_e', b: 'capilla' },
  { a: 'capilla', b: 'cripta' },
  { a: 'cripta', b: 'minas' },
  { a: 'cripta', b: 'tunel_keep', req: ['runa4'] },
  { a: 'tunel_keep', b: 'biblioteca' },
  { a: 'biblioteca', b: 'galeria_o', req: ['runa3'] },
  { a: 'galeria_o', b: 'mago' },
  { a: 'mago', b: 'adarve' },
  { a: 'galeria_o', b: 'adarve' },
  { a: 'adarve', b: 'reloj' },
  { a: 'reloj', b: 'patio_armas', req: ['runa6'], uno: true },                    // descenso de un solo sentido
  { a: 'herreria', b: 'patio_ext', uno: true, atajo: true },                      // atajo: tras la palanca, vuelta directa al patio
  { a: 'galeria_e', b: 'patio_armas', uno: true, atajo: true },                   // atajos: se abren desde el lado lejano
  { a: 'galeria_o', b: 'patio_armas', uno: true, atajo: true },
  { a: 'patio_armas', b: 'vestibulo', req: SEIS },
  { a: 'vestibulo', b: 'gran_salon' },
  { a: 'gran_salon', b: 'claustro' },
  { a: 'claustro', b: 'trono' },
];

/* ---------------- validador: juega el nivel ---------------- */
export function validar({ velocidad = [1.0, 1.3] } = {}) {
  const ids = Object.keys(NODOS), idx = Object.fromEntries(ids.map((n, i) => [n, i]));
  const objs = Object.keys(OBJETOS), bit = Object.fromEntries(objs.map((o, i) => [o, 1 << i]));
  const enNodo = ids.map(() => 0);
  for (const [o, n] of Object.entries(OBJETOS)) enNodo[idx[n]] |= bit[o];
  const ady = ids.map(() => []);
  const errores = [];
  for (const p of PUERTAS) {
    if (!(p.a in idx) || !(p.b in idx)) { errores.push('Puerta con área desconocida: ' + p.a + ' → ' + p.b); continue; }
    const req = (p.req || []).reduce((m, o) => (o in bit ? m | bit[o] : (errores.push('Objeto desconocido: ' + o), m)), 0);
    ady[idx[p.a]].push({ to: idx[p.b], req });
    if (!p.uno) ady[idx[p.b]].push({ to: idx[p.a], req });
  }
  const K = 1 << objs.length;
  const clave = (n, m) => n * K + m;

  function jugar(bloqueado = -1) {
    const ini = idx[INICIO], fin = idx[FIN];
    if (ini === bloqueado) return { gana: false };
    const m0 = enNodo[ini], padre = new Map(), cola = [[ini, m0]], vistos = new Set([clave(ini, m0)]);
    padre.set(clave(ini, m0), -1);
    const visitadas = new Set([ini]);
    let cabeza = 0, meta = -1;
    while (cabeza < cola.length) {
      const [n, m] = cola[cabeza++];
      if (n === fin) { meta = clave(n, m); break; }
      for (const e of ady[n]) {
        if (e.to === bloqueado || (e.req & m) !== e.req) continue;
        const m2 = m | enNodo[e.to], k = clave(e.to, m2);
        if (vistos.has(k)) continue;
        vistos.add(k); padre.set(k, clave(n, m)); cola.push([e.to, m2]); visitadas.add(e.to);
      }
    }
    if (meta < 0) return { gana: false, visitadas };
    const camino = [];
    for (let k = meta; k !== -1; k = padre.get(k)) camino.push(ids[Math.floor(k / K)]);
    return { gana: true, camino: camino.reverse(), visitadas };
  }

  const base = jugar();
  const saltables = [], inalcanzables = [];
  if (base.gana) for (const n of ids) { if (n === INICIO || n === FIN) continue; if (jugar(idx[n]).gana) saltables.push(n); }
  const alcanzables = new Set((base.visitadas || new Set()).size ? [...base.visitadas].map(i => ids[i]) : []);
  // el BFS se detiene al ganar: se completa la alcanzabilidad con un recorrido sin meta
  const todas = new Set(); { const pend = [[idx[INICIO], enNodo[idx[INICIO]]]], v = new Set([clave(...pend[0])]);
    while (pend.length) { const [n, m] = pend.pop(); todas.add(ids[n]); for (const e of ady[n]) { if ((e.req & m) !== e.req) continue; const m2 = m | enNodo[e.to], k = clave(e.to, m2); if (!v.has(k)) { v.add(k); pend.push([e.to, m2]); } } } }
  for (const n of ids) if (!todas.has(n)) inalcanzables.push(n);

  const opcionales = ids.filter(n => NODOS[n].opc);
  const ofensores = saltables.filter(n => !NODOS[n].opc);
  const totalM = ids.reduce((s, n) => s + NODOS[n].m, 0);
  const obligM = ids.filter(n => !saltables.includes(n)).reduce((s, n) => s + NODOS[n].m, 0);
  const caminoM = (base.camino || []).reduce((s, n) => s + NODOS[n].m, 0);
  const reglas = [
    { ok: errores.length === 0, texto: 'Datos coherentes' + (errores.length ? ': ' + errores.join('; ') : '') },
    { ok: !!base.gana, texto: 'El nivel se puede terminar' },
    { ok: inalcanzables.length === 0, texto: 'Todas las áreas son alcanzables' + (inalcanzables.length ? ' (no: ' + inalcanzables.join(', ') + ')' : '') },
    { ok: ofensores.length === 0, texto: 'Ninguna área obligatoria se puede saltar' + (ofensores.length ? ' (se salta: ' + ofensores.join(', ') + ')' : '') },
    { ok: opcionales.every(n => saltables.includes(n)), texto: 'Las áreas opcionales sí se pueden omitir' },
    { ok: obligM / totalM >= 0.85, texto: 'Al menos 85 % del mapa es obligatorio (' + Math.round((100 * obligM) / totalM) + ' %)' },
  ];
  return {
    ok: reglas.every(r => r.ok), reglas, camino: base.camino || [], saltables, opcionales,
    metrosCamino: caminoM, metrosTotal: totalM,
    minutos: [Math.round(caminoM / velocidad[1] / 60), Math.round(caminoM / velocidad[0] / 60)],
    minutosConOpcionales: [Math.round((caminoM + opcionales.reduce((s, n) => s + NODOS[n].m * 2, 0)) / velocidad[1] / 60), Math.round((caminoM + opcionales.reduce((s, n) => s + NODOS[n].m * 2, 0)) / velocidad[0] / 60)],
  };
}
