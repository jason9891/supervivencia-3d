/* Panel «☁️ Mapas del repo»: guardar el mapa del editor en generador-mapas/mapas/ y abrir los guardados.
   Depende de mapas-repo.js (window.MapasRepo) y de editor-ref.js (window.__mapaCompleto). */
(function () {
  const M = window.MapasRepo; if (!M) return;
  const K_NOM = 'mapas-repo-ultimo-nombre';
  const rd = (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = document.createElement('style');
  css.textContent = `#mr-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:60}
  #mr-modal.open{display:flex}#mr-box{background:#171a21;border:1px solid #2a2f3a;border-radius:12px;padding:16px;width:min(640px,94vw);max-height:90vh;overflow:auto;color:#e5e7eb}
  #mr-box h4{margin:14px 0 6px;color:#e8c37a}#mr-box small{color:#94a3b8}#mr-box input[type=text],#mr-box input[type=password]{padding:5px 8px;min-width:0}
  .mr-fila{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mr-map{display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid #2a2f3a}
  .mr-map b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.mr-map a{color:#7dd3fc}`;
  document.head.appendChild(css);

  const modal = document.createElement('div'); modal.id = 'mr-modal';
  modal.innerHTML = `<div id="mr-box">
    <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">☁️ Mapas del repo</h3><button id="mr-x">✕</button></div>
    <p style="color:#94a3b8;margin:6px 0 0">Guarda el mapa actual (con sus texturas y objetos) en el repo para abrirlo desde cualquier dispositivo. Cada guardado es un commit en <code id="mr-donde"></code>.</p>
    <h4>Guardar el mapa actual</h4>
    <div class="mr-fila"><input id="mr-nom" type="text" placeholder="nombre del mapa" style="flex:1"><button id="mr-g" style="background:#0f766e">Guardar en el repo</button></div>
    <small id="mr-estado"></small>
    <h4>Mapas guardados <button id="mr-r" title="Actualizar la lista" style="margin-left:6px">↻</button></h4>
    <div id="mr-lista"><small>Cargando…</small></div>
    <details id="mr-tk" style="margin-top:14px"><summary style="cursor:pointer;color:#8c8">🔑 Token de GitHub (para guardar)</summary>
      <p style="color:#94a3b8;margin:6px 0">Solo hace falta para guardar; abrir y ver mapas no lo necesita. Créalo en GitHub → Settings → Developer settings → Personal access tokens → <i>Fine-grained</i>: solo el repo <b id="mr-repo"></b>, permiso <b>Contents: Read and write</b>. Se guarda solo en este navegador (en otro dispositivo hay que ponerlo otra vez).</p>
      <div class="mr-fila"><input id="mr-tok" type="password" placeholder="github_pat_…" style="flex:1" autocomplete="off"><button id="mr-tg">Guardar token</button><button id="mr-tq">Quitar</button></div>
      <small id="mr-tstate"></small></details>
  </div>`;
  document.body.appendChild(modal);
  const $ = (id) => modal.querySelector('#' + id);
  const estado = (t, mal) => { $('mr-estado').textContent = t || ''; $('mr-estado').style.color = mal ? '#f87171' : '#94a3b8'; };

  function pintarToken() {
    const c = M.config();
    $('mr-donde').textContent = `${c.repo}/${c.dir} (${c.branch})`; $('mr-repo').textContent = `${c.owner}/${c.repo}`;
    $('mr-tstate').textContent = M.tieneToken() ? '✅ Hay un token guardado en este navegador.' : 'Sin token: solo puedes abrir mapas, no guardar.';
    $('mr-tk').open = !M.tieneToken();
  }

  const enlaceVisor = (id) => new URL('index.html?mapa=' + encodeURIComponent(id), location.href).href;

  async function lista() {
    const el = $('mr-lista'); el.innerHTML = '<small>Cargando…</small>';
    try {
      const m = await M.listar();
      el.innerHTML = m.length ? m.map(x => `<div class="mr-map" data-id="${esc(x.id)}"><b title="${esc(x.id)}">${esc(x.id)}</b><small>${(x.size / 1024).toFixed(0)} KB</small>
        <button data-a="abrir">Abrir en el editor</button><a href="${esc(enlaceVisor(x.id))}" target="_blank" rel="noopener">Ver en 3D</a><button data-a="copiar" title="Copiar el enlace del visor 3D">🔗</button></div>`).join('')
        : '<small>Aún no hay mapas guardados. Guarda el primero arriba.</small>';
    } catch (e) { el.innerHTML = `<small style="color:#f87171">${esc(e.message)}</small>`; }
  }

  async function abrir(id) {
    if (!confirm(`Esto reemplaza el mapa que tienes ahora en el editor por «${id}». ¿Seguir?`)) return;
    estado('Abriendo ' + id + '…');
    try {
      const j = await M.leer(id);
      j.texturas = j.texturas || {}; j.texobj = j.texobj || {}; // si el mapa no trae, no arrastres las del anterior
      window.importJSON({ files: [new File([JSON.stringify(j)], id + '.json')], value: '' });
      wr(K_NOM, id); $('mr-nom').value = id; estado('Abierto: ' + id);
      setTimeout(() => modal.classList.remove('open'), 400);
    } catch (e) { estado(e.message, true); }
  }

  async function guardar() {
    const id = M.slug($('mr-nom').value);
    if (!id) return estado('Pon un nombre para el mapa.', true);
    if (!M.tieneToken()) { $('mr-tk').open = true; return estado('Falta el token de GitHub (abajo).', true); }
    const obj = window.__mapaCompleto ? window.__mapaCompleto() : null; if (!obj) return estado('No se pudo leer el mapa del editor.', true);
    try {
      if (await M.existe(id) && !confirm(`Ya existe «${id}» en el repo. ¿Reemplazarlo? (queda el commit anterior en el historial de GitHub)`)) return estado('Cancelado.');
      estado('Guardando…'); $('mr-g').disabled = true;
      const r = await M.guardar(id, obj);
      wr(K_NOM, r.id); $('mr-nom').value = r.id;
      const subidas = Object.values(obj.texturas || {}).filter(t => t && !t.lib).length;
      estado(`✅ ${r.creado ? 'Guardado' : 'Actualizado'}: ${r.id}` + (subidas ? ` · incluye ${subidas} imagen(es) subida(s) por ti (pesan en el repo)` : ''));
      lista();
    } catch (e) { estado(e.message, true); } finally { $('mr-g').disabled = false; }
  }

  $('mr-x').onclick = () => modal.classList.remove('open');
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) modal.classList.remove('open'); });
  $('mr-g').onclick = guardar; $('mr-r').onclick = lista;
  $('mr-nom').addEventListener('keydown', (e) => { if (e.key === 'Enter') guardar(); e.stopPropagation(); });
  $('mr-tok').addEventListener('keydown', (e) => e.stopPropagation());
  $('mr-tg').onclick = () => { const t = $('mr-tok').value.trim(); if (!t) return; M.ponerToken(t); $('mr-tok').value = ''; pintarToken(); estado('Token guardado en este navegador.'); };
  $('mr-tq').onclick = () => { M.quitarToken(); pintarToken(); estado('Token quitado.'); };
  $('mr-lista').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.closest('.mr-map').dataset.id;
    if (b.dataset.a === 'abrir') abrir(id);
    else if (navigator.clipboard) navigator.clipboard.writeText(enlaceVisor(id)).then(() => estado('Enlace copiado: ' + enlaceVisor(id))).catch(() => estado(enlaceVisor(id)));
  });

  window.openMapasRepo = () => { pintarToken(); if (!$('mr-nom').value) $('mr-nom').value = rd(K_NOM); estado(''); modal.classList.add('open'); lista(); };

  const bar = document.getElementById('topbar'), anchor = document.getElementById('btn-sel');
  const b = document.createElement('button'); b.innerHTML = '☁️ Mapas del repo'; b.onclick = window.openMapasRepo;
  if (bar) bar.insertBefore(b, anchor || null);
})();
