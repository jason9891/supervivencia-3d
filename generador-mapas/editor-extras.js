/* editor-extras.js — panel de propiedades y diseñador de puertas, TODO EN CELDAS (1 celda = 10 cm).
   Sin vértices ni coordenadas de intersección: posiciones y medidas son números de cuadros.
   Se carga después de editor.js y sustituye renderProps / updateProp / openDoorDesigner. */
(function () {
  const G = 0.1, C = (m) => Math.round(m / G), M = (c) => +(c * G).toFixed(2);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const col = (id) => data.doorTypes.find(t => t.id === id);
  const hint = (c) => `<span style="font-size:10px;color:#64748b">${c} celdas = ${M(c)} m</span>`;

  /* ---------------- PANEL DE PROPIEDADES ---------------- */
  window.renderProps = function () {
    if (!propsEl) return;
    if (!selected) { propsEl.innerHTML = '<div style="color:#64748b;width:100%;text-align:center;margin-top:16px">Selecciona un elemento · Otros planos se ven transparentes</div>'; return; }
    const obj = getObj(); if (!obj) { selectHit(null); return; }
    const T = selected.type, id = selected.id;
    const n = (label, k, v, step, extra) => `<div class="field-group"><label>${label}</label><input type="number" step="${step || 1}" value="${v}" onchange="updateProp('${T}','${id}','${k}',this.value)">${extra || ''}</div>`;
    const sel = (label, k, v, opts) => `<div class="field-group"><label>${label}</label><select onchange="updateProp('${T}','${id}','${k}',this.value)">${opts.map(([val, tx]) => `<option value="${val}" ${String(v) === val ? 'selected' : ''}>${tx}</option>`).join('')}</select></div>`;
    const names = { room: 'Sala', wall: 'Muro', door: 'Puerta', hole: 'Hueco', block: 'Bloque' };
    let h = `<div class="field-group"><label>Elemento</label><div style="font-weight:bold">${names[T] || T}</div></div>`;
    if (T === 'room' || T === 'hole') {
      if (T === 'room') h += `<div class="field-group"><label>Nombre</label><input type="text" value="${esc(obj.nombre)}" onchange="updateProp('room','${id}','nombre',this.value)"></div>`;
      if (!obj.points) {
        const a = C(Math.min(obj.x0, obj.x1)), b = C(Math.max(obj.x0, obj.x1)) - 1, c = C(Math.min(obj.z0, obj.z1)), d = C(Math.max(obj.z0, obj.z1)) - 1;
        h += n('Celda X inicial', 'cx0', a) + n('Celda X final', 'cx1', b) + n('Celda Z inicial', 'cz0', c) + n('Celda Z final', 'cz1', d)
          + `<div class="field-group"><label>Tamaño</label><div>${b - a + 1} × ${d - c + 1} celdas</div></div>`;
      }
      h += n('Nivel Y (m)', 'y', obj.y || 0, 0.5);
      if (T === 'room' && obj.y2 != null) h += n('Y final (m)', 'y2', obj.y2, 0.5);
      if (T === 'room' && (obj.type === 'rampa' || obj.type === 'escalera')) h += sel('Sube hacia', 'dir', obj.dir || '+x', [['+x', '+X (este)'], ['-x', '−X (oeste)'], ['+z', '+Z (norte)'], ['-z', '−Z (sur)']]);
      if (T === 'room' && obj.type === 'sala') h += sel('Muros', 'open', String(!!obj.open), [['false', 'Cerrada'], ['true', 'Abierta']]);
    } else if (T === 'wall') {
      h += n('Alto (celdas)', 'hC', C(obj.h || 3), 1, hint(C(obj.h || 3))) + n('Nivel Y (m)', 'y', obj.y || 0, 0.5)
        + `<div class="field-group"><label>Largo</label><div>${Celdas.wallCells(obj).length} celdas</div></div>`;
    } else if (T === 'block') {
      h += n('Celda X', 'cx', C(obj.x)) + n('Celda Z', 'cz', C(obj.z)) + n('Alto (celdas)', 'hC', C(obj.h || 4), 1, hint(C(obj.h || 4))) + n('Nivel Y (m)', 'y', obj.y || 0, 0.5);
    } else if (T === 'door') {
      const tipos = data.doorTypes.map(t => [t.id, t.nombre]);
      h += sel('Tipo', 'tipo', obj.tipo || '', [['', '(a medida)'], ...tipos])
        + sel('Dirección del muro', 'ax', obj.ax || 'x', [['x', 'a lo largo de X'], ['z', 'a lo largo de Z']])
        + n('Celda X', 'cx', Math.floor(obj.x / G + 1e-9)) + n('Celda Z', 'cz', Math.floor(obj.z / G + 1e-9))
        + n('Ancho (celdas)', 'wC', C(obj.w || 1.5)) + n('Alto (celdas)', 'hC', C(obj.h || 3.6)) + n('Alféizar (celdas)', 'sillC', C(obj.sill || 0))
        + n('Nivel Y (m)', 'y', obj.y || 0, 0.5) + n('Ángulo °', 'angle', obj.angle != null ? obj.angle : 72, 5)
        + sel('Hoja', 'panel', obj.panel || 'single', [['single', 'Simple'], ['double', 'Doble'], ['none', 'Sin hoja (arco)']])
        + sel('Bisagra', 'hinge', obj.hinge || 'left', [['left', 'Izquierda'], ['right', 'Derecha']])
        + sel('Apertura', 'swing', obj.swing || 'in', [['in', 'Hacia adentro'], ['out', 'Hacia afuera']])
        + `<div class="field-group"><label>&nbsp;</label><button onclick="openDoorDesigner()">📐 Editar tipo…</button></div>`;
    }
    h += `<div class="field-group"><label>&nbsp;</label><button class="danger" onclick="deleteSelected()">🗑️ Eliminar</button></div>`;
    propsEl.innerHTML = h;
  };

  window.updateProp = function (type, id, key, val) {
    const arr = { room: data.rooms, wall: data.walls, door: data.doors, hole: data.holes, block: data.blocks }[type]; if (!arr) return;
    const o = arr.find(x => x.id === id); if (!o) return;
    const v = parseFloat(val);
    if (key === 'nombre' || key === 'dir' || key === 'ax' || key === 'panel' || key === 'hinge' || key === 'swing') o[key] = val;
    else if (key === 'tipo') { const t = col(val); if (t) Object.assign(o, doorParams(t)); else delete o.tipo; }
    else if (key === 'open') o.open = val === 'true';
    else if (!isFinite(v)) return;
    else if (key === 'cx0') o.x0 = M(v), o.x1 = Math.max(o.x1, o.x0 + G);
    else if (key === 'cz0') o.z0 = M(v), o.z1 = Math.max(o.z1, o.z0 + G);
    else if (key === 'cx1') o.x1 = M(Math.max(v + 1, C(o.x0) + 1));
    else if (key === 'cz1') o.z1 = M(Math.max(v + 1, C(o.z0) + 1));
    else if (key === 'cx') o.x = type === 'block' ? M(v) : M(v + 0.5);
    else if (key === 'cz') o.z = type === 'block' ? M(v) : M(v + 0.5);
    else if (key.endsWith('C')) o[key.slice(0, -1)] = M(Math.max(key === 'sillC' ? 0 : 1, v));
    else o[key] = v;
    renderProps(); draw(); commit();
  };

  /* ---------------- DISEÑADOR DE PUERTAS (en celdas) ---------------- */
  let ddTypeId = null;
  const ddType = () => col(ddTypeId);
  const params = (t) => ({ w: t.w, h: t.h, sill: t.sill, fw: t.fw, depth: t.depth, panel: t.panel, hinge: t.hinge, swing: t.swing, angle: t.angle, tipo: t.id });
  if (typeof window.doorParams === 'undefined') window.doorParams = params;

  window.openDoorDesigner = function (typeId) {
    let pick = typeId;
    if (!pick && selected && selected.type === 'door') { const d = getObj(); if (d && d.tipo) pick = d.tipo; }
    if (!pick || !col(pick)) pick = data.activeDoorType;
    ddTypeId = pick; el('door-modal').classList.add('open'); el('dd-msg').textContent = ''; ddRefresh();
  };
  window.closeDoorDesigner = function () { el('door-modal').classList.remove('open'); updateStatus(); if (selected) renderProps(); };
  function ddFillSelect() {
    el('dd-type').innerHTML = data.doorTypes.map(t => `<option value="${t.id}" ${t.id === ddTypeId ? 'selected' : ''}>${esc(t.nombre)}${t.id === data.activeDoorType ? ' ★' : ''}</option>`).join('');
  }
  function ddRefresh() {
    ddFillSelect(); const t = ddType(); if (!t) return;
    document.querySelectorAll('#door-modal [data-dd]').forEach(i => {
      const k = i.dataset.dd, v = t[k];
      i.value = i.dataset.cells ? (v != null ? C(v) : '') : (v != null ? v : '');
    });
    ddDraw();
  }
  window.ddSelectType = (id) => { ddTypeId = id; el('dd-msg').textContent = ''; ddRefresh(); };
  window.ddField = function (i) {
    const t = ddType(); if (!t) return; const k = i.dataset.dd; let v = i.value;
    if (i.type === 'number') {
      v = parseFloat(v); if (!isFinite(v) || v < 0) return;
      if (i.dataset.cells) { if ((k === 'w' || k === 'h' || k === 'fw') && v < 1) return; v = M(v); }
    }
    t[k] = v; if (k === 'nombre') ddFillSelect(); ddDraw(); commit();
  };
  window.ddNew = function () {
    const t = { id: uid('dt'), nombre: 'Puerta nueva', w: 1.5, h: 3.6, sill: 0, fw: 0.1, depth: 0.5, panel: 'single', hinge: 'left', swing: 'in', angle: 72 };
    data.doorTypes.push(t); ddTypeId = t.id; ddRefresh(); commit();
  };
  window.ddDuplicate = function () { const t = ddType(); if (!t) return; const c = Object.assign(deep(t), { id: uid('dt'), nombre: t.nombre + ' (copia)' }); data.doorTypes.push(c); ddTypeId = c.id; ddRefresh(); commit(); };
  window.ddDelete = function () {
    if (data.doorTypes.length <= 1) { el('dd-msg').textContent = 'Debe quedar al menos un tipo.'; return; }
    const t = ddType(); if (!t) return;
    data.doorTypes = data.doorTypes.filter(x => x.id !== t.id); data.doors.forEach(d => { if (d.tipo === t.id) delete d.tipo; });
    if (data.activeDoorType === t.id) data.activeDoorType = data.doorTypes[0].id;
    ddTypeId = data.doorTypes[0].id; ddRefresh(); commit();
  };
  window.ddUse = function () { const t = ddType(); if (!t) return; data.activeDoorType = t.id; commit(); closeDoorDesigner(); setTool('puerta'); toast('Puerta activa: ' + t.nombre); };
  window.ddApplySelected = function () {
    const t = ddType(), d = selected && selected.type === 'door' ? getObj() : null;
    if (!d) { el('dd-msg').textContent = 'Selecciona primero una puerta en el plano.'; return; }
    Object.assign(d, params(t)); draw(); commit(); el('dd-msg').textContent = 'Aplicado a la puerta seleccionada.';
  };
  window.ddApplyAll = function () {
    const t = ddType(); if (!t) return; const list = data.doors.filter(d => d.tipo === t.id);
    list.forEach(d => Object.assign(d, params(t))); draw(); commit();
    el('dd-msg').textContent = list.length ? `Actualizadas ${list.length} puerta(s).` : 'Aún no hay puertas de este tipo.';
  };

  function ddDraw() {
    const c = el('dd-canvas'), g = c.getContext('2d'), t = ddType(); if (!t) return;
    const W = c.width, H = c.height; g.clearRect(0, 0, W, H); g.fillStyle = '#0b0d11'; g.fillRect(0, 0, W, H);
    const w = t.w, h = t.h, sill = t.sill || 0, fw = t.fw != null ? t.fw : G, mode = t.panel || 'single';
    g.font = '12px monospace'; g.textAlign = 'center';
    // ALZADO: cada cuadro de 10 cm se dibuja como una cuadrícula
    const ew = W * 0.62, margin = 0.8, wallW = w + margin * 2, wallH = sill + h + 0.6;
    const s = Math.min((ew - 70) / wallW, (H - 80) / wallH), ox = ew / 2, gy = H - 40, X = (x) => ox + x * s, Y = (y) => gy - y * s;
    g.fillStyle = '#64748b'; g.fillText('ALZADO (cada cuadro = 10 cm)', ew / 2, 16);
    g.fillStyle = '#3b4252'; g.fillRect(X(-wallW / 2), Y(wallH), wallW * s, wallH * s);
    g.fillStyle = '#4a2e15'; g.fillRect(X(-w / 2 - fw / 2), Y(sill + h + fw / 2), (w + fw) * s, (h + fw / 2) * s);
    const ix0 = -w / 2 + fw / 2, ix1 = w / 2 - fw / 2, iy1 = sill + h - fw / 2;
    if (ix1 > ix0 && iy1 > sill) {
      g.fillStyle = mode === 'none' ? '#1b2a3a' : '#a67c52'; g.fillRect(X(ix0), Y(iy1), (ix1 - ix0) * s, (iy1 - sill) * s);
      if (mode === 'double') { g.strokeStyle = '#3a2a18'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(0), Y(iy1)); g.lineTo(X(0), Y(sill)); g.stroke(); }
    }
    if (G * s >= 4) {                                           // trama de cuadros sobre la abertura
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i <= C(w); i++) { g.moveTo(X(-w / 2 + i * G), Y(sill)); g.lineTo(X(-w / 2 + i * G), Y(sill + h)); }
      for (let j = 0; j <= C(h); j++) { g.moveTo(X(-w / 2), Y(sill + j * G)); g.lineTo(X(w / 2), Y(sill + j * G)); }
      g.stroke();
    }
    g.strokeStyle = '#94a3b8'; g.beginPath(); g.moveTo(X(-wallW / 2) - 10, gy); g.lineTo(X(wallW / 2) + 10, gy); g.stroke();
    g.strokeStyle = '#22d3ee'; g.fillStyle = '#22d3ee';
    g.beginPath(); g.moveTo(X(-w / 2), gy + 16); g.lineTo(X(w / 2), gy + 16); g.stroke(); g.fillText(`${C(w)} celdas`, X(0), gy + 30);
    const dxr = X(w / 2) + Math.max(18, fw * s + 12);
    g.beginPath(); g.moveTo(dxr, Y(sill)); g.lineTo(dxr, Y(sill + h)); g.stroke();
    g.save(); g.translate(dxr + 14, Y(sill + h / 2)); g.rotate(-Math.PI / 2); g.fillText(`${C(h)} celdas`, 0, 0); g.restore();
    // PLANTA: el muro es de 1 celda
    const pw = W - ew, pcx = ew + pw / 2, pcy = H * 0.42, depth = G, sp = Math.min((pw - 30) / (w + 1.4), (H - 90) / (w + 0.8 + depth));
    g.fillStyle = '#64748b'; g.fillText('PLANTA', pcx, 16);
    const PX = (x) => pcx + x * sp, PY = (z) => pcy + z * sp;
    g.fillStyle = '#3b4252'; g.fillRect(PX(-w / 2 - 0.7), PY(-depth / 2), 0.7 * sp, depth * sp); g.fillRect(PX(w / 2), PY(-depth / 2), 0.7 * sp, depth * sp);
    if (mode !== 'none') {
      const ang = ((t.angle != null ? t.angle : 72) * Math.PI) / 180, dirY = t.swing === 'out' ? -1 : 1;
      const leaf = (hx, side, L) => { g.strokeStyle = '#a67c52'; g.lineWidth = 3; g.beginPath(); g.moveTo(PX(hx), PY(0)); g.lineTo(PX(hx + side * L * Math.cos(ang)), PY(dirY * L * Math.sin(ang))); g.stroke(); };
      if (mode === 'double') { leaf(-w / 2, 1, w / 2); leaf(w / 2, -1, w / 2); } else if (t.hinge === 'right') leaf(w / 2, -1, w); else leaf(-w / 2, 1, w);
    }
    g.fillStyle = '#94a3b8'; g.fillText(t.swing === 'out' ? '↑ afuera' : '↓ adentro', pcx, H - 12);
  }
})();
