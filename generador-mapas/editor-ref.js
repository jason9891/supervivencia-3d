/* Personaje de referencia + ranuras de texturas.
   Se guardan aparte del mapa (no entran en el historial ni inflan el JSON del mapa):
   castillo-v20-ref = {visible,x,z,y,h}   castillo-v20-tex = {slot:{img,m}}
   Al exportar el JSON se incluyen como "ref" y "texturas". */
(function () {
  'use strict';
  const K_REF = LS_KEY + '-ref', K_TEX = LS_KEY + '-tex';
  const rd = (k, d) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (_) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { toast('No cabe en el almacenamiento: usa una imagen más pequeña'); return false; } };
  let ref = rd(K_REF, null), tex = rd(K_TEX, {});

  /* ---------- Personaje de referencia ---------- */
  const R_SHOULDER = 0.25; // radio en planta (hombros ≈ 0,5 m)
  function saveRef() { wr(K_REF, ref); draw(); }
  function placeRef(x, z) {
    ref = Object.assign({ h: 1.75 }, ref, { visible: true, x: +x.toFixed(2), z: +z.toFixed(2), y: activeLevel });
    saveRef(); renderRefInfo();
  }
  function drawRef() {
    if (!ref || ref.visible === false) return;
    const a = typeof levelAlpha === 'function' ? Math.max(levelAlpha(ref.y || 0), 0.35) : 1;
    const [px, py] = W2S(ref.x, ref.z), r = Math.max(4, R_SHOULDER * scale);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(251,191,36,0.35)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // hombros
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(px, py, Math.max(2.5, 0.115 * scale), 0, Math.PI * 2); ctx.fill(); // cabeza
    ctx.fillStyle = '#fde68a'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🧍 ' + (+ref.h || 1.75).toFixed(2) + ' m · Y=' + (ref.y || 0), px, py - r - 6);
    ctx.restore();
  }
  const _draw = window.draw;
  window.draw = function () { _draw(); drawRef(); };

  // Herramienta «Personaje»: clic = colocar, arrastrar = mover
  let movingRef = false;
  container.addEventListener('mousedown', (e) => {
    if (tool !== 'ref' || e.button !== 0 || spacePressed) return;
    e.stopImmediatePropagation(); const c = cellUnder(e);
    placeRef(c.x + GRID / 2, c.z + GRID / 2); movingRef = true;
  }, true);
  container.addEventListener('mousemove', (e) => {
    if (!movingRef) return; e.stopImmediatePropagation(); const c = cellUnder(e);
    ref.x = +(c.x + GRID / 2).toFixed(2); ref.z = +(c.z + GRID / 2).toFixed(2); saveRef();
  }, true);
  window.addEventListener('mouseup', () => { if (movingRef) { movingRef = false; renderRefInfo(); } });

  /* ---------- Interfaz ---------- */
  const SLOTS = [['muro', '🧱 Muros y bloques'], ['piso', '⬛ Pisos'], ['techo', '🟫 Techos'], ['rampa', '📐 Rampas'], ['escalera', '🪜 Escaleras'], ['puerta', '🚪 Puertas']];
  const css = document.createElement('style');
  css.textContent = `#tx-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:50}
  #tx-modal.open{display:flex}#tx-box{background:#171a21;border:1px solid #2a2f3a;border-radius:12px;padding:16px;width:min(720px,94vw);max-height:90vh;overflow:auto;color:#e5e7eb}
  .tx-row{display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid #2a2f3a}.tx-row:last-child{border:0}
  .tx-prev{width:64px;height:64px;border-radius:8px;border:1px dashed #475569;background:#0b0d11 center/cover;flex:none}
  .tx-row label.n{width:170px;flex:none}.tx-row input[type=number]{width:70px}.tx-row small{color:#94a3b8}.tx-row input[type=file]{width:190px;min-width:0;flex:1}.tx-row button{flex:none}`;
  document.head.appendChild(css);

  const modal = document.createElement('div'); modal.id = 'tx-modal';
  modal.innerHTML = `<div id="tx-box"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">🎨 Texturas</h3><button onclick="closeTexturas()">✕</button></div>
    <p style="color:#94a3b8;margin:6px 0 10px">Una imagen por tipo de superficie. «Metros por repetición» es el tamaño real que cubre una copia de la imagen (se repite en mosaico, sin deformarse en 3D). Se ven en el visor 3D.</p>
    <div id="tx-rows"></div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeTexturas(); });

  function renderTex() {
    document.getElementById('tx-rows').innerHTML = SLOTS.map(([k, nom]) => {
      const t = tex[k];
      return `<div class="tx-row"><div class="tx-prev" style="${t ? `background-image:url(${t.img});border-style:solid` : ''}"></div>
        <label class="n">${nom}<br><small>${t ? 'cargada' : 'sin textura (color liso)'}</small></label>
        <input type="file" accept="image/*" onchange="loadTex('${k}',this)">
        <label>m/repetición <input type="number" min="0.1" step="0.1" value="${t ? t.m : 1}" ${t ? '' : 'disabled'} onchange="setTexM('${k}',this.value)"></label>
        <button ${t ? '' : 'disabled'} onclick="clearTex('${k}')">Quitar</button></div>`;
    }).join('');
  }
  window.openTexturas = () => { renderTex(); modal.classList.add('open'); };
  window.closeTexturas = () => modal.classList.remove('open');
  window.loadTex = function (k, input) {
    const f = input.files && input.files[0]; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const s = Math.min(1, 512 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      const prev = tex[k]; tex[k] = { img: c.toDataURL('image/jpeg', 0.85), m: prev ? prev.m : 1 };
      if (!wr(K_TEX, tex)) { if (prev) tex[k] = prev; else delete tex[k]; } else toast('Textura: ' + k);
      renderTex();
    };
    img.onerror = () => toast('No se pudo leer la imagen'); img.src = url; input.value = '';
  };
  window.setTexM = (k, v) => { const m = parseFloat(v); if (tex[k] && m > 0) { tex[k].m = m; wr(K_TEX, tex); } };
  window.clearTex = (k) => { delete tex[k]; wr(K_TEX, tex); renderTex(); };

  // Botones en la barra
  const bar = document.getElementById('topbar'), anchor = document.getElementById('btn-sel');
  function mk(html, id, fn) { const b = document.createElement('button'); b.innerHTML = html; if (id) b.id = id; b.onclick = fn; bar.insertBefore(b, anchor); return b; }
  mk('🧍 Personaje', 'btn-ref', () => setTool('ref'));
  mk('🎨 Texturas', null, () => openTexturas());
  const nm = window.updateStatus; window.updateStatus = function () { nm(); if (tool === 'ref' && statusEl) statusEl.textContent = 'Nivel: ' + activeLevel + ' | Personaje (clic o arrastra para colocarlo)'; };

  // Panel de propiedades del personaje cuando la herramienta está activa
  function renderRefInfo() {
    if (tool !== 'ref' || !propsEl) return;
    propsEl.innerHTML = ref ? `<div class="field-group"><label>Altura (m)</label><input type="number" step="0.05" min="0.5" value="${ref.h || 1.75}" onchange="refSet('h',this.value)"></div>
      <div class="field-group"><label>Mostrar</label><input type="checkbox" ${ref.visible === false ? '' : 'checked'} onchange="refSet('visible',this.checked)"></div>
      <div class="field-group"><label>Posición</label><div>X ${ref.x} · Z ${ref.z} · Y ${ref.y || 0}</div></div>
      <div class="field-group"><label>&nbsp;</label><button class="danger" onclick="refSet('del')">Quitar personaje</button></div>`
      : '<div style="padding:8px;color:#94a3b8">Haz clic en el plano para colocar el personaje de referencia (1,75 m).</div>';
  }
  window.refSet = (k, v) => {
    if (k === 'del') ref = null; else if (k === 'h') ref.h = Math.max(0.5, parseFloat(v) || 1.75); else ref[k] = v;
    if (ref === null) { try { localStorage.removeItem(K_REF); } catch (_) {} draw(); } else saveRef();
    renderRefInfo();
  };
  const st = window.setTool; window.setTool = function (t) { st(t); renderRefInfo(); };

  /* ---------- Exportar / importar incluyendo ref y texturas ---------- */
  const withExtras = () => Object.assign({}, data, ref ? { ref } : {}, Object.keys(tex).length ? { texturas: tex } : {});
  window.exportJSON = () => navigator.clipboard.writeText(JSON.stringify(withExtras(), null, 2)).then(() => toast('JSON copiado')).catch(() => toast('Error'));
  window.downloadJSON = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(withExtras(), null, 2)], { type: 'application/json' })); a.download = 'mapa.json'; a.click(); };
  window.importJSON = function (input) {
    const f = input.files && input.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (j.texturas) { tex = j.texturas; wr(K_TEX, tex); } if (j.ref) { ref = j.ref; wr(K_REF, ref); }
        delete j.texturas; delete j.ref; data = j; normalizeData(); selectHit(null); commit(); draw(); toast('Importado');
      } catch (_) { toast('JSON inválido'); }
    }; r.readAsText(f); input.value = '';
  };
  draw();
})();
