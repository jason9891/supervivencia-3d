/* Herramienta «Objeto»: coloca piezas del catálogo de lib-objetos sobre el plano.
   Se guardan en data.objetos = [{id,tipo,x,z,y,giro,alto,params}] (mismo formato que "objetos" de decorado.json),
   así entran en el historial, el guardado y el JSON exportado; el visor los dibuja con montarDecorado. */
(function () {
  'use strict';
  let LIB = null, tipoSel = 'mesa', selObj = null, dragO = null, dragMoved = false;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const objs = () => (data.objetos || (data.objetos = []));
  const nid = () => 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  import('../lib-objetos/biblioteca.js').then(m => { LIB = m; m.registrarTodo(); if (!m.CATALOGO[tipoSel]) tipoSel = Object.keys(m.CATALOGO)[0]; draw(); renderPanel(); })
    .catch(e => { console.error('lib-objetos', e); toast('No se pudo cargar lib-objetos'); });

  const nombreDe = t => (LIB && LIB.CATALOGO[t] && LIB.CATALOGO[t].nombre) || t;
  function huellaDe(o) {
    try { const h = LIB.huella(o.tipo, LIB.paramsPorDefecto(o.tipo, o.params)); return [h[0], h[1]]; } catch (_) { return [0.5, 0.5]; }
  }
  const corners = (o) => {
    const [w, d] = huellaDe(o), a = (o.giro || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([lx, lz]) => [o.x + lx * c + lz * s, o.z - lx * s + lz * c]);
  };
  function hit(o, wx, wz) {
    const [w, d] = huellaDe(o), a = (o.giro || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = wx - o.x, dz = wz - o.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) <= Math.max(w, 0.2) / 2 && Math.abs(lz) <= Math.max(d, 0.2) / 2;
  }

  /* ---------- dibujo ---------- */
  function drawObjs() {
    if (!LIB) return;
    objs().forEach(o => {
      const al = levelAlpha(o.y || 0), sel = selObj && selObj.id === o.id;
      const pts = corners(o).map(p => W2S(p[0], p[1]));
      ctx.save(); ctx.globalAlpha = al;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      ctx.fillStyle = sel ? 'rgba(244,114,182,0.55)' : 'rgba(236,72,153,0.32)'; ctx.fill();
      ctx.strokeStyle = sel ? '#f9a8d4' : '#ec4899'; ctx.lineWidth = sel ? 2 : 1.2; ctx.stroke();
      // frente (+z local): línea desde el centro hacia el lado "frente"
      const a = (o.giro || 0) * Math.PI / 180, [, d] = huellaDe(o);
      const [cx, cy] = W2S(o.x, o.z), [fx, fy] = W2S(o.x + Math.sin(a) * d / 2, o.z + Math.cos(a) * d / 2);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(fx, fy); ctx.strokeStyle = '#fff'; ctx.stroke();
      if (scale >= 40) { ctx.fillStyle = '#fbcfe8'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(nombreDe(o.tipo), cx, cy - 4); }
      ctx.restore();
    });
  }
  const _draw = window.draw; window.draw = function () { _draw(); drawObjs(); };

  /* ---------- interacción ---------- */
  function pickObj(e) {
    const c = cellUnder(e), list = objs().filter(o => Math.abs((o.y || 0) - activeLevel) < 0.5);
    for (let i = list.length - 1; i >= 0; i--) if (hit(list[i], c.wx, c.wz)) return { o: list[i], c };
    return { o: null, c };
  }
  function select(o) { selObj = o; if (o) { selected = null; const b = document.getElementById('btn-del-sel'); if (b) b.style.display = 'inline-block'; } renderPanel(); draw(); }
  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || spacePressed || !LIB) return;
    if (tool === 'obj') {
      e.stopImmediatePropagation(); const { o, c } = pickObj(e);
      if (o) { select(o); dragO = { o, dx: o.x - c.wx, dz: o.z - c.wz }; dragMoved = false; return; }
      const n = { id: nid(), tipo: tipoSel, x: +(c.x + GRID / 2).toFixed(2), z: +(c.z + GRID / 2).toFixed(2), y: activeLevel, giro: 0, params: {} };
      objs().push(n); commit(); select(n); return;
    }
    if (tool === 'sel') {
      const { o, c } = pickObj(e);
      if (o) { e.stopImmediatePropagation(); select(o); dragO = { o, dx: o.x - c.wx, dz: o.z - c.wz }; dragMoved = false; }
      else if (selObj) { selObj = null; renderPanel(); draw(); }
    }
  }, true);
  container.addEventListener('mousemove', (e) => {
    if (!dragO) return; e.stopImmediatePropagation();
    const c = cellUnder(e); dragO.o.x = +(Math.round((c.wx + dragO.dx) / (GRID / 2)) * (GRID / 2)).toFixed(2); dragO.o.z = +(Math.round((c.wz + dragO.dz) / (GRID / 2)) * (GRID / 2)).toFixed(2);
    dragMoved = true; draw();
  }, true);
  window.addEventListener('mouseup', () => { if (dragO) { if (dragMoved) commit(); dragO = null; renderPanel(); } });
  window.addEventListener('keydown', (e) => {
    if (!selObj || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); window.deleteSelected(); return; }
    if (e.code === 'KeyR') { selObj.giro = ((selObj.giro || 0) + (e.shiftKey ? -15 : 15) + 360) % 360; commit(); renderPanel(); draw(); }
  });

  const _sel = window.selectHit; window.selectHit = function (h) { if (h) selObj = null; _sel(h); };
  const _del = window.deleteSelected;
  window.deleteSelected = function () {
    if (selObj) { const i = objs().findIndex(o => o.id === selObj.id); if (i >= 0) objs().splice(i, 1); selObj = null; commit(); renderPanel(); draw(); const b = document.getElementById('btn-del-sel'); if (b) b.style.display = 'none'; return; }
    _del();
  };
  const _norm = window.normalizeData; window.normalizeData = function () { _norm(); if (!Array.isArray(data.objetos)) data.objetos = []; };
  if (!Array.isArray(data.objetos)) data.objetos = [];

  /* ---------- panel de propiedades ---------- */
  function paramInputs(o) {
    const cat = LIB.CATALOGO[o.tipo]; if (!cat) return '';
    const cur = LIB.paramsPorDefecto(o.tipo, o.params), lab = LIB.ETIQUETAS || {};
    return Object.keys(cat.params).map(k => {
      const [mn, mx, df, st] = cat.params[k];
      return `<div class="field-group"><label>${esc(lab[k] || k)}</label><input type="number" min="${mn}" max="${mx}" step="${st || 0.01}" value="${+(+cur[k]).toFixed(3)}" onchange="objSet('p:${k}',this.value)"></div>`;
    }).join('');
  }
  function renderPanel() {
    if (!propsEl) return;
    if (selObj && !objs().some(o => o.id === selObj.id)) selObj = null;
    if (tool !== 'obj' && !selObj) return;
    let h = '';
    if (tool === 'obj') {
      if (!LIB) h += '<div style="padding:8px;color:#94a3b8">Cargando catálogo…</div>';
      else h += `<div class="field-group"><label>Tipo a colocar</label><select onchange="objTipo(this.value)">${Object.keys(LIB.CATALOGO).sort((a, b) => nombreDe(a).localeCompare(nombreDe(b))).map(k => `<option value="${k}" ${k === tipoSel ? 'selected' : ''}>${esc(nombreDe(k))}</option>`).join('')}</select></div>
        <div style="padding:4px 8px;color:#94a3b8;align-self:center">Clic = colocar · arrastrar = mover · R = girar 15°</div>`;
    }
    if (selObj && LIB) {
      const o = selObj, f = (lab, key, v, st) => `<div class="field-group"><label>${lab}</label><input type="number" step="${st}" value="${v}" onchange="objSet('${key}',this.value)"></div>`;
      h += `<div class="field-group"><label>Objeto</label><div><b>${esc(nombreDe(o.tipo))}</b></div></div>`
        + f('X (m)', 'x', o.x, 0.05) + f('Z (m)', 'z', o.z, 0.05) + f('Nivel Y (m)', 'y', o.y || 0, 0.5) + f('Giro (°)', 'giro', o.giro || 0, 15) + f('Altura extra (m)', 'alto', o.alto || 0, 0.1)
        + paramInputs(o)
        + `<div class="field-group"><label>&nbsp;</label><button onclick="objDup()">⧉ Duplicar</button> <button class="danger" onclick="deleteSelected()">🗑️ Eliminar</button></div>`;
    }
    propsEl.innerHTML = h;
  }
  window.objTipo = (t) => { tipoSel = t; };
  window.objSet = (k, v) => {
    if (!selObj) return; const n = parseFloat(v); if (!isFinite(n)) return;
    if (k.startsWith('p:')) { selObj.params = selObj.params || {}; selObj.params[k.slice(2)] = n; }
    else if (k === 'giro') selObj.giro = ((n % 360) + 360) % 360; else selObj[k] = n;
    commit(); renderPanel(); draw();
  };
  window.objDup = () => { if (!selObj) return; const c = JSON.parse(JSON.stringify(selObj)); c.id = nid(); c.x += 0.5; c.z += 0.5; objs().push(c); commit(); select(c); };
  const _rp = window.renderProps; window.renderProps = function () { if (selObj) { renderPanel(); return; } _rp(); };
  const _st = window.setTool; window.setTool = function (t) { if (t !== 'obj' && t !== 'sel') selObj = null; _st(t); renderPanel(); };
  const _us = window.updateStatus; window.updateStatus = function () { _us(); if (tool === 'obj' && statusEl) statusEl.textContent = 'Nivel: ' + activeLevel + ' | Objeto (clic para colocar)'; };

  const bar = document.getElementById('topbar'), anchor = document.getElementById('btn-sel');
  const b = document.createElement('button'); b.id = 'btn-obj'; b.innerHTML = '🪑 Objeto'; b.onclick = () => setTool('obj'); bar.insertBefore(b, anchor);
  draw();
})();
