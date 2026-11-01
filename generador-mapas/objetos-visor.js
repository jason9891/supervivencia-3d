/* Colocar, mover, girar y dimensionar objetos de lib-objetos desde el visor.
   O = nuevo objeto (se pone donde apuntas) · E = seleccionar el objeto apuntado
   Con uno seleccionado: R / Mayús+R girar 15° · + / − tamaño · M mover (sigue la mira, clic = soltar) · P panel exacto · Supr borrar · E soltar */
import * as THREE from 'three';
import { CATALOGO, ETIQUETAS, paramsPorDefecto, registrarTodo } from '../lib-objetos/biblioteca.js';

const DIMS = ['w', 'd', 'h', 'r', 'l', 'largo', 'esc', 'R', 'diam', 'alt', 'altura', 'alto'];

export function crearObjetosVisor(ctx) {
  const { camera, controls, overlay } = ctx;
  registrarTodo();
  const rc = new THREE.Raycaster();
  let sel = null, moviendo = false, apuntado = null, tAp = 0, abierto = false, helper = null;
  const objs = () => (ctx.json() && (ctx.json().objetos || (ctx.json().objetos = []))) || [];
  const porId = (id) => objs().find(o => o.id === id);
  const nid = () => 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const nombre = (t) => (CATALOGO[t] && CATALOGO[t].nombre) || t;

  /* ---------- etiqueta ---------- */
  const etq = document.createElement('div');
  etq.style.cssText = 'position:fixed;left:50%;top:calc(50% + 48px);transform:translateX(-50%);color:#fbcfe8;font:12px monospace;background:rgba(0,0,0,.6);padding:3px 8px;border-radius:5px;pointer-events:none;z-index:50;display:none;text-align:center;white-space:pre';
  document.body.appendChild(etq);

  /* ---------- puntería ---------- */
  function objetoApuntado() {
    const d = ctx.deco(); if (!d) return null;
    rc.setFromCamera(new THREE.Vector2(0, 0), camera); rc.near = 0; rc.far = 25;
    const hs = rc.intersectObject(d.root, true);
    for (const h of hs) for (let p = h.object; p; p = p.parent) if (p.userData && p.userData.objId) return p.userData.objId;
    return null;
  }
  function puntoEnMapa(excluirDeco = true) {
    const m = ctx.mapa(); if (!m) return null;
    rc.setFromCamera(new THREE.Vector2(0, 0), camera); rc.near = 0; rc.far = 40;
    const hs = rc.intersectObject(m, true).filter(h => !(h.object.userData && h.object.userData.ref));
    return hs.length ? hs[0].point : null;
  }

  /* ---------- selección / resaltado ---------- */
  function marcar() {
    if (helper) { ctx.scene.remove(helper); helper = null; }
    const d = ctx.deco(), o = sel && d && d.porId[sel];
    if (!o) return;
    helper = new THREE.Box3Helper(new THREE.Box3().setFromObject(o.root), 0xf472b6); ctx.scene.add(helper);
  }
  function seleccionar(id) { sel = id; moviendo = false; marcar(); }
  ctx.alRehacer = () => { marcar(); };

  /* ---------- cambios ---------- */
  function cambio(rehacer) { ctx.guardar(); if (rehacer) { ctx.remontar(); marcar(); } else marcar(); }
  function nuevo(tipo) {
    const p = puntoEnMapa() || (() => { camera.getWorldDirection(new THREE.Vector3()); const d = new THREE.Vector3(); camera.getWorldDirection(d); return new THREE.Vector3(camera.position.x + d.x * 3, 0, camera.position.z + d.z * 3); })();
    const d = new THREE.Vector3(); camera.getWorldDirection(d);
    const giro = Math.round((Math.atan2(-d.x, -d.z) * 180 / Math.PI + 360) % 360 / 15) * 15; // el frente (+z) mira al jugador
    const o = { id: nid(), tipo, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +(Math.max(0, p.y - 0.15)).toFixed(2), giro, params: {} };
    objs().push(o); cambio(true); seleccionar(o.id);
  }
  function girar(grados) { const o = porId(sel); if (!o) return; o.giro = (((o.giro || 0) + grados) % 360 + 360) % 360; const d = ctx.deco(), ob = d && d.porId[sel]; if (ob) ob.root.rotation.y = o.giro * Math.PI / 180; cambio(false); }
  function dimensionar(f) {
    const o = porId(sel); if (!o) return; const cat = CATALOGO[o.tipo]; if (!cat) return;
    const claves = Object.keys(cat.params).filter(k => DIMS.includes(k));
    if (claves.length) {
      const cur = paramsPorDefecto(o.tipo, o.params); o.params = o.params || {};
      claves.forEach(k => { const [mn, mx] = cat.params[k]; o.params[k] = +Math.min(mx, Math.max(mn, cur[k] * f)).toFixed(3); });
    } else o.escala = +Math.min(4, Math.max(0.3, (o.escala || 1) * f)).toFixed(3);
    cambio(true);
  }
  function borrar() { const i = objs().findIndex(o => o.id === sel); if (i < 0) return; objs().splice(i, 1); (ctx.json().enlaces || []).forEach(e => { e.acciona = (e.acciona || []).filter(a => a.id !== sel); }); ctx.json().enlaces = (ctx.json().enlaces || []).filter(e => e.palanca !== sel && e.acciona.length); seleccionar(null); cambio(true); }
  function duplicar() { const o = porId(sel); if (!o) return; const c = JSON.parse(JSON.stringify(o)); c.id = nid(); c.x += 0.6; c.z += 0.6; objs().push(c); cambio(true); seleccionar(c.id); }

  /* ---------- selector de tipo ---------- */
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;z-index:200;font-family:system-ui,sans-serif';
  document.body.appendChild(modal);
  const cerrar = () => { modal.style.display = 'none'; abierto = false; try { controls.lock(); } catch (_) { overlay.style.display = 'flex'; } };
  const soltar = () => { modal.style.display = 'none'; abierto = false; overlay.style.display = 'flex'; };
  function abrirModal(html) { abierto = true; if (controls.isLocked) controls.unlock(); overlay.style.display = 'none'; modal.innerHTML = `<div style="background:#171a21;color:#e5e7eb;border:1px solid #2a2f3a;border-radius:12px;padding:14px;width:min(820px,95vw);max-height:90vh;overflow:auto">${html}</div>`; modal.style.display = 'flex'; modal.onmousedown = (e) => { if (e.target === modal) cerrar(); }; }

  function abrirTipos() {
    const tipos = Object.keys(CATALOGO).sort((a, b) => nombre(a).localeCompare(nombre(b)));
    abrirModal(`<div style="display:flex;justify-content:space-between;gap:8px"><h3 style="margin:0">🪑 Colocar objeto</h3><input id="ov-f" placeholder="Buscar…" style="flex:1;max-width:220px"><button id="ov-x">✕</button></div>
      <p style="color:#94a3b8;margin:6px 0">Se pone donde apuntas, mirando hacia ti. Luego: R girar · + / − tamaño · M mover · P panel.</p>
      <div id="ov-g">${['rocas', 'general'].map(g => `<h4 style="margin:10px 0 4px;color:#e8c37a" data-h="${g}">${g === 'rocas' ? '🪨 Rocas' : 'Objetos'}</h4><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px">${tipos.filter(t => (CATALOGO[t].grupo || 'general') === g).map(t => `<button data-t="${t}" style="padding:8px;text-align:left">${nombre(t)}</button>`).join('')}</div>`).join('')}</div>`);
    modal.querySelector('#ov-x').onclick = cerrar;
    modal.querySelector('#ov-f').oninput = (e) => { const q = e.target.value.toLowerCase(); modal.querySelectorAll('[data-t]').forEach(b => b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none'); };
    modal.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = b.dataset.t; modal.style.display = 'none'; abierto = false; try { controls.lock(); } catch (_) {} nuevo(t); });
  }

  /* ---------- panel exacto ---------- */
  function abrirPanel() {
    const o = porId(sel); if (!o) return; const cat = CATALOGO[o.tipo]; const cur = paramsPorDefecto(o.tipo, o.params);
    const f = (lab, key, v, st, mn, mx) => `<label style="display:flex;flex-direction:column;font-size:12px">${lab}<input type="number" ${mn !== undefined ? `min="${mn}" max="${mx}"` : ''} step="${st}" value="${v}" data-k="${key}" style="width:100px"></label>`;
    abrirModal(`<div style="display:flex;justify-content:space-between"><h3 style="margin:0">${nombre(o.tipo)}</h3><button id="ov-x">✕</button></div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0">${f('X (m)', 'x', o.x, 0.05)}${f('Z (m)', 'z', o.z, 0.05)}${f('Nivel Y (m)', 'y', o.y || 0, 0.05)}${f('Giro (°)', 'giro', o.giro || 0, 15)}${f('Altura extra (m)', 'alto', o.alto || 0, 0.1)}${f('Escala general (×)', 'escala', o.escala || 1, 0.05, 0.3, 4)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">${Object.keys(cat.params).map(k => { const [mn, mx, , st] = cat.params[k]; return f(ETIQUETAS[k] || k, 'p:' + k, +(+cur[k]).toFixed(3), st || 0.01, mn, mx); }).join('')}</div>
      <div style="margin-top:12px;display:flex;gap:8px"><button id="ov-d">⧉ Duplicar</button><button id="ov-b" style="color:#f87171">🗑️ Eliminar</button><button id="ov-ok" style="margin-left:auto">Listo</button></div>`);
    modal.querySelector('#ov-x').onclick = modal.querySelector('#ov-ok').onclick = cerrar;
    modal.querySelector('#ov-d').onclick = () => { duplicar(); cerrar(); };
    modal.querySelector('#ov-b').onclick = () => { borrar(); cerrar(); };
    modal.querySelectorAll('[data-k]').forEach(i => i.onchange = () => {
      const n = parseFloat(i.value), k = i.dataset.k; if (!isFinite(n)) return;
      if (k.startsWith('p:')) { o.params = o.params || {}; o.params[k.slice(2)] = n; } else if (k === 'giro') o.giro = ((n % 360) + 360) % 360; else o[k] = n;
      cambio(true);
    });
  }

  /* ---------- teclas ---------- */
  window.addEventListener('keydown', (e) => {
    if (abierto) { if (e.code === 'Escape') soltar(); return; }
    if (!controls.isLocked) return;
    if (e.code === 'KeyO') { abrirTipos(); return; }
    if (e.code === 'KeyE') { if (sel && !apuntado) seleccionar(null); else if (apuntado && apuntado !== sel) seleccionar(apuntado); else seleccionar(null); return; }
    if (!sel) return;
    if (e.code === 'KeyR') girar(e.shiftKey ? -15 : 15);
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') dimensionar(1.1);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') dimensionar(1 / 1.1);
    else if (e.code === 'KeyM') { moviendo = !moviendo; if (!moviendo) cambio(false); }
    else if (e.code === 'KeyP') abrirPanel();
    else if (e.code === 'Delete' || e.code === 'Backspace') borrar();
  });
  window.addEventListener('mousedown', () => { if (moviendo && controls.isLocked) { moviendo = false; cambio(false); } }, true);

  function update(ahora) {
    const d = ctx.deco();
    if (moviendo && sel && d) {
      const o = porId(sel), ob = d.porId[sel], p = puntoEnMapa();
      if (o && ob && p) { o.x = +p.x.toFixed(2); o.z = +p.z.toFixed(2); o.y = +(Math.max(0, p.y - 0.15)).toFixed(2); ob.root.position.set(o.x, o.y + 0.15 + (o.alto || 0), o.z); marcar(); }
    }
    if (controls.isLocked && ahora - tAp > 0.12) { tAp = ahora; apuntado = objetoApuntado(); }
    if (!controls.isLocked) apuntado = null;
    const id = moviendo ? sel : (apuntado || sel);
    const o = id && porId(id);
    if (controls.isLocked && o) {
      const esSel = id === sel;
      etq.textContent = '🪑 ' + nombre(o.tipo) + (esSel ? (moviendo ? ' · moviendo (clic = soltar)' : '\nR girar · +/− tamaño · M mover · P panel · Supr borrar · E soltar') : ' · E = editar');
      etq.style.display = 'block';
    } else etq.style.display = 'none';
  }
  return { update, apuntaObjeto: () => !!apuntado, abierto: () => abierto, seleccionar, marcar, _dbg: { nuevo, girar, dimensionar, borrar, objetoApuntado, puntoEnMapa, sel: () => sel, objs } };
}
