/* Recorrido a pie con colisiones + elegir la textura de la pieza a la que apuntas.
   G = caminar / volar · WASD mover · Mayús correr · Espacio saltar · T = textura de la pieza apuntada · clic = palancas */
import * as THREE from 'three';
import { formularioPasto, normalizarPasto } from '../lib-objetos/pasto/pasto.js';

const R = 0.3, STEP = 0.4, GRAV = 22, SALTO = 6.5;

export function crearRecorrido(ctx) {
  const { camera, controls, overlay } = ctx;
  const rc = new THREE.Raycaster();
  let solidos = [], caminar = false, x = 0, z = 0, feetY = 0, vy = 0, suelo = false, eye = 1.6;
  let apuntado = null, tiempoApunte = 0, pickerAbierto = false;

  /* ---------- sólidos ---------- */
  function actualizarSolidos() {
    solidos = [];
    const sinRef = (o) => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.ref) return false; return true; };
    [ctx.mapa(), ctx.deco() && ctx.deco().root].filter(Boolean).forEach(g => g.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !o.visible || (o.material && (o.material.isMeshBasicMaterial || o.material.transparent))) return;
      if (sinRef(o)) solidos.push(o);
    }));
  }
  const V = new THREE.Vector3(), D = new THREE.Vector3();
  function rayo(ox, oy, oz, dx, dy, dz, far) {
    rc.set(V.set(ox, oy, oz), D.set(dx, dy, dz)); rc.near = 0; rc.far = far;
    const h = rc.intersectObjects(solidos, false); return h.length ? h[0] : null;
  }
  function bloqueado(dx, dz) {
    const d = Math.hypot(dx, dz); if (d < 1e-9) return false;
    const ux = dx / d, uz = dz / d;
    for (const h of [0.5, 1.0, 1.55]) for (const off of [-0.2, 0, 0.2]) {
      if (rayo(x - uz * off, feetY + h, z + ux * off, ux, 0, uz, R + d)) return true;
    }
    return false;
  }
  function altoSuelo(ox, oz, desde, far) { const h = rayo(ox, desde, oz, 0, -1, 0, far); return h ? h.point.y : null; }

  /* ---------- caminar ---------- */
  function entrar() {
    const ref = ctx.ref(); eye = 1.6 * (ref && ref.h > 0 ? ref.h / 1.75 : 1);
    if (ref && isFinite(ref.x) && isFinite(ref.z)) { x = +ref.x; z = +ref.z; feetY = (+ref.y || 0) + 0.15 + 0.3; }
    else { x = camera.position.x; z = camera.position.z; feetY = camera.position.y; }
    vy = 0; suelo = false; caminar = true; ocultarRef(true);
    const g = altoSuelo(x, z, feetY + 1, 60); if (g !== null && g <= feetY + STEP + 1) { feetY = g; suelo = true; }
    camera.position.set(x, feetY + eye, z);
  }
  function ocultarRef(v) { const m = ctx.mapa(); if (m) m.traverse(o => { if (o.userData && o.userData.ref) o.visible = !v; }); }
  function salir() { caminar = false; ocultarRef(false); }
  function alternar() { caminar ? salir() : entrar(); return caminar; }

  function pasos(dt, keys) {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    camera.getWorldDirection(D); let fx = D.x, fz = D.z; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    let mx = fx * f - fz * s, mz = fz * f + fx * s; const m = Math.hypot(mx, mz);
    if (m > 0) {
      const sp = (keys.ShiftLeft ? 7 : 4) * dt; mx = mx / m * sp; mz = mz / m * sp;
      if (!bloqueado(mx, mz)) { x += mx; z += mz; }
      else if (mx && !bloqueado(mx, 0)) x += mx;
      else if (mz && !bloqueado(0, mz)) z += mz;
    }
    if (keys.Space && suelo) { vy = SALTO; suelo = false; }
    vy -= GRAV * dt;
    const ny = feetY + vy * dt;
    const g = vy <= 0 ? altoSuelo(x, z, feetY + STEP, STEP + 0.35 + Math.max(0, -vy * dt)) : null;
    if (g !== null && (ny <= g + 1e-3 || (suelo && g >= feetY - 0.35))) { feetY = g; vy = 0; suelo = true; }
    else {
      suelo = false; feetY = ny;
      if (vy > 0 && rayo(x, feetY + eye - 0.1, z, 0, 1, 0, 0.25 + vy * dt)) vy = 0;
    }
    if (feetY < -60) entrar();
    camera.position.set(x, feetY + eye, z);
  }

  /* ---------- apuntar a una pieza ---------- */
  function mirar() {
    rc.setFromCamera(new THREE.Vector2(0, 0), camera); rc.near = 0; rc.far = 60;
    const m = ctx.mapa(); if (!m) return null;
    const hs = rc.intersectObject(m, true);
    for (const h of hs) if (h.object.userData && h.object.userData.tag) return h.object;
    return null;
  }
  const NOM = { muro: 'Muro', piso: 'Piso', techo: 'Techo', rampa: 'Rampa', escalera: 'Escalera' };
  const nombrePieza = (o) => { const t = o.userData.tag; return t.tipo === 'block' ? 'Bloque' : NOM[o.userData.slot] || (t.tipo === 'wall' ? 'Muro' : 'Piso'); };
  const mira = document.createElement('div');
  mira.style.cssText = 'position:fixed;left:50%;top:50%;width:8px;height:8px;margin:-4px;border:2px solid #fff;border-radius:50%;mix-blend-mode:difference;pointer-events:none;z-index:50';
  document.body.appendChild(mira);
  const etq = document.createElement('div');
  etq.style.cssText = 'position:fixed;left:50%;top:calc(50% + 22px);transform:translateX(-50%);color:#fff;font:12px monospace;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:5px;pointer-events:none;z-index:50;display:none';
  document.body.appendChild(etq);

  /* ---------- selector de textura ---------- */
  let cat = null;
  fetch('../lib-objetos/catalogo.json').then(r => r.json()).then(j => { cat = j.texturas.filter(t => t.tipo === 'repetida'); }).catch(() => {});
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;z-index:200;font-family:system-ui,sans-serif';
  document.body.appendChild(modal);
  const GN = { pasto: '🌿 Pasto (con volumen)', muro: 'Muros', piso: 'Pisos', cubierta: 'Cubiertas', material: 'Materiales' };
  const ORDEN = { muro: ['muro', 'piso', 'cubierta', 'material'], piso: ['pasto', 'piso', 'muro', 'cubierta', 'material'], techo: ['cubierta', 'piso', 'muro', 'material'], rampa: ['pasto', 'piso', 'muro', 'cubierta', 'material'], escalera: ['piso', 'muro', 'cubierta', 'material'] };

  function abrirSelector(o, alcanceInicial) {
    if (!cat) return;
    const pieza = o.userData && o.userData.tag ? { tag: o.userData.tag, slot: o.userData.slot || 'muro', nom: nombrePieza(o) } : o;   // o = malla, o ya una pieza
    const { tag, slot } = pieza;
    const tx = ctx.leer(ctx.LS_TEX) || {}, tp = ctx.leer(ctx.LS_TOBJ) || {};
    const actual = tp[tag.id] ? 'esta pieza' : (tx[slot] ? 'todas' : null);
    // el pasto que se ajusta es el de la pieza si tiene textura propia; si no, el de la ranura general
    const alc0 = alcanceInicial || (tp[tag.id] ? 'pieza' : (tx[slot] && tx[slot].pasto ? 'tipo' : 'pieza'));
    const pastoAct = () => { const a = ctx.leer(ctx.LS_TOBJ) || {}, b = ctx.leer(ctx.LS_TEX) || {}; return tp0(a, b, alcance()); };
    const tp0 = (a, b, sc) => (sc === 'tipo' ? (b[slot] && b[slot].pasto) : (a[tag.id] && a[tag.id].pasto)) || null;
    pickerAbierto = true; if (controls.isLocked) controls.unlock(); overlay.style.display = 'none';
    modal.innerHTML = `<div style="background:#171a21;color:#e5e7eb;border:1px solid #2a2f3a;border-radius:12px;padding:14px;width:min(860px,95vw);max-height:90vh;overflow:auto">
      <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">🎯 ${pieza.nom} · textura</h3><button id="rt-x" style="font-size:16px">✕</button></div>
      <div style="margin:8px 0;display:flex;gap:16px;flex-wrap:wrap;align-items:center">
        <label><input type="radio" name="rt-sc" value="pieza" ${alc0 === 'pieza' ? 'checked' : ''}> Solo esta pieza</label>
        <label><input type="radio" name="rt-sc" value="tipo" ${alc0 === 'tipo' ? 'checked' : ''}> Todos los «${NOM[slot] || slot}»</label>
        <label>m/repetición <input id="rt-m" type="number" min="0.1" step="0.1" placeholder="auto" style="width:70px"></label>
        <button id="rt-q">Quitar textura</button><small style="color:#94a3b8">${actual ? 'Ahora: ' + actual : 'Sin textura'}</small></div>
      <div id="rt-pasto"></div>
      ${ORDEN[slot].map(g => `<h4 style="margin:10px 0 4px;color:#e8c37a">${GN[g]}</h4><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px">${cat.filter(t => t.grupo === g).map(t => `<div data-id="${t.id}" title="${t.nombre} — ${t.uso}" style="cursor:pointer;text-align:center;font-size:11px"><img src="../lib-objetos/tex/${t.archivo}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:2px solid #2a2f3a"><div>${t.nombre}</div></div>`).join('')}</div>`).join('')}</div>`;
    modal.style.display = 'flex';
    const cerrar = () => { modal.style.display = 'none'; pickerAbierto = false; try { controls.lock(); } catch (_) { overlay.style.display = 'flex'; } };
    const alcance = () => modal.querySelector('input[name=rt-sc]:checked').value;
    const guardar = (valor, quedar) => {
      if (alcance() === 'tipo') { const t = ctx.leer(ctx.LS_TEX) || {}; if (valor) t[slot] = valor; else delete t[slot]; ctx.guardar(ctx.LS_TEX, t); }
      else { const t = ctx.leer(ctx.LS_TOBJ) || {}; if (valor) t[tag.id] = valor; else delete t[tag.id]; ctx.guardar(ctx.LS_TOBJ, t); }
      ctx.reconstruir();
      if (quedar) abrirSelector(pieza, alcance()); else cerrar();
    };
    // ajustes del pasto (viento, tamaño, densidad, color…): se ven al instante
    const caja = modal.querySelector('#rt-pasto');
    const montarPastoUI = () => {
      caja.innerHTML = ''; const cur = pastoAct(); if (!cur) return;
      const t = document.createElement('div'); t.style.cssText = 'border:1px solid #2a2f3a;border-radius:10px;padding:10px;margin:6px 0';
      t.innerHTML = '<div style="font-weight:700;margin-bottom:6px">🌿 Ajustes del pasto <small style="color:#94a3b8;font-weight:400">(se aplican al instante; ' + (alcance() === 'tipo' ? 'todos los ' + (NOM[slot] || slot).toLowerCase() : 'esta pieza') + ')</small></div>';
      let tm = 0;
      t.appendChild(formularioPasto(cur, (cfg) => {
        const sc = alcance(), alm = sc === 'tipo' ? ctx.LS_TEX : ctx.LS_TOBJ, d = ctx.leer(alm) || {}, k = sc === 'tipo' ? slot : tag.id;
        if (!d[k]) return; d[k].pasto = cfg; ctx.guardar(alm, d);
        clearTimeout(tm); tm = setTimeout(() => ctx.reconstruirPasto(), 60);
      }));
      const ok = document.createElement('button'); ok.textContent = 'Listo'; ok.style.marginTop = '8px'; ok.onclick = cerrar; t.appendChild(ok);
      caja.appendChild(t);
    };
    montarPastoUI();
    modal.querySelectorAll('input[name=rt-sc]').forEach(i => i.onchange = montarPastoUI);
    modal.querySelector('#rt-x').onclick = cerrar;
    modal.querySelector('#rt-q').onclick = () => guardar(null);
    modal.querySelectorAll('[data-id]').forEach(el => el.onclick = () => {
      const t = cat.find(q => q.id === el.dataset.id), m = parseFloat(modal.querySelector('#rt-m').value);
      guardar(Object.assign({ img: '../lib-objetos/tex/' + t.archivo, m: m > 0 ? m : (t.tile || 1), lib: t.id }, t.pasto ? { pasto: normalizarPasto(t.pasto) } : {}), !!t.pasto);   // con pasto se queda abierto para ajustarlo
    });
    modal.onmousedown = (e) => { if (e.target === modal) cerrar(); };
  }

  window.addEventListener('keydown', (e) => {
    if (pickerAbierto) { if (e.code === 'Escape') { modal.style.display = 'none'; pickerAbierto = false; overlay.style.display = 'flex'; } return; }
    if (!controls.isLocked) return;
    if (e.code === 'KeyG') { alternar(); }
    if (e.code === 'KeyT' && apuntado && !(ctx.apuntaObjeto && ctx.apuntaObjeto())) abrirSelector(apuntado);
  });

  function update(dt, keys, ahora) {
    if (caminar && controls.isLocked) pasos(dt, keys);
    if (controls.isLocked && ahora - tiempoApunte > 0.12) {
      tiempoApunte = ahora; apuntado = mirar();
      if (apuntado && !(ctx.apuntaObjeto && ctx.apuntaObjeto())) { etq.textContent = '🎯 ' + nombrePieza(apuntado) + ' · T = textura'; etq.style.display = 'block'; } else etq.style.display = 'none';
    }
    if (!controls.isLocked) etq.style.display = 'none';
  }
  return { actualizarSolidos, update, alternar, entrar, activo: () => caminar, pickerAbierto: () => pickerAbierto, _dbg: { abrir: abrirSelector, camera, pasos, pos: () => ({ x, z, feetY, suelo }), solidos: () => solidos.length, mirar } };
}
