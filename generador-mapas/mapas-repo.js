/* Mapas guardados en el repo (generador-mapas/mapas/*.json), compartido por el editor y el visor.
   Script normal (no módulo): expone window.MapasRepo.

   Leer y listar no necesita nada (el repo es público). Guardar necesita un token de GitHub
   (fine-grained, solo este repo, permiso «Contents: Read and write») que se guarda únicamente en el
   localStorage de este navegador. Cada guardado es un commit en la rama principal. */
(function () {
  const K_TOKEN = 'mapas-repo-token', K_CFG = 'mapas-repo-cfg';
  const rd = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const wr = (k, v) => { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (_) { return false; } };

  function configBase() {
    // En GitHub Pages (usuario.github.io/repo/...) el dueño y el repo salen de la URL.
    const c = { owner: 'jason9891', repo: 'supervivencia-3d', branch: 'main', dir: 'generador-mapas/mapas' };
    const m = /^([^.]+)\.github\.io$/i.exec(location.hostname);
    if (m) { c.owner = m[1]; const r = location.pathname.split('/')[1]; if (r) c.repo = r; }
    try { Object.assign(c, JSON.parse(rd(K_CFG) || '{}')); } catch (_) {}
    return c;
  }

  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

  const b64 = (str) => { const by = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < by.length; i += 0x8000) s += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000)); return btoa(s); };

  function cab(extra) {
    const h = Object.assign({ Accept: 'application/vnd.github+json' }, extra || {});
    const t = rd(K_TOKEN); if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  const url = (c, id) => `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${c.dir}${id ? '/' + encodeURIComponent(id) + '.json' : ''}`;

  async function fallo(r, que) {
    let m = ''; try { m = (await r.json()).message || ''; } catch (_) {}
    if (r.status === 401) return new Error('El token no es válido o venció.');
    if (r.status === 403 && /rate limit/i.test(m)) return new Error('GitHub limitó las consultas por un rato. Pon un token o espera unos minutos.');
    if (r.status === 403 || r.status === 404 && rd(K_TOKEN)) return new Error('El token no tiene permiso en este repo (necesita «Contents: Read and write» sobre ' + configBase().repo + ').');
    return new Error(`${que}: ${r.status} ${m}`.trim());
  }

  const API = {
    config: configBase,
    slug,
    tieneToken: () => !!rd(K_TOKEN),
    ponerToken: (t) => wr(K_TOKEN, (t || '').trim()),
    quitarToken: () => wr(K_TOKEN, null),

    /** [{id, size}] de los mapas guardados (vacío si la carpeta aún no existe). */
    async listar() {
      const c = configBase();
      const r = await fetch(url(c) + '?ref=' + encodeURIComponent(c.branch), { headers: cab(), cache: 'no-store' });
      if (r.status === 404) return [];
      if (!r.ok) throw await fallo(r, 'No se pudo listar los mapas');
      const j = await r.json();
      return (Array.isArray(j) ? j : []).filter(f => f.type === 'file' && /\.json$/i.test(f.name))
        .map(f => ({ id: f.name.replace(/\.json$/i, ''), size: f.size })).sort((a, b) => a.id.localeCompare(b.id));
    },

    /** Contenido (objeto) de un mapa guardado. */
    async leer(id) {
      const c = configBase();
      const r = await fetch(url(c, id) + '?ref=' + encodeURIComponent(c.branch), { headers: cab({ Accept: 'application/vnd.github.raw+json' }), cache: 'no-store' });
      if (r.status === 404) throw new Error('No existe el mapa «' + id + '» en el repo.');
      if (!r.ok) throw await fallo(r, 'No se pudo leer el mapa');
      return JSON.parse(await r.text());
    },

    /** ¿Existe ya? Devuelve su sha o null. */
    async existe(id) {
      const c = configBase();
      const r = await fetch(url(c, id) + '?ref=' + encodeURIComponent(c.branch), { headers: cab(), cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) throw await fallo(r, 'No se pudo comprobar el mapa');
      return (await r.json()).sha || null;
    },

    /** Guarda (crea o reemplaza) un mapa como commit. Devuelve {id, creado}. */
    async guardar(id, objeto) {
      id = slug(id); if (!id) throw new Error('Pon un nombre para el mapa.');
      if (!rd(K_TOKEN)) throw new Error('Falta el token de GitHub para guardar.');
      const c = configBase();
      const sha = await API.existe(id);
      const cuerpo = { message: `mapa: ${sha ? 'actualizar' : 'añadir'} ${id}`, content: b64(JSON.stringify(objeto, null, 1)), branch: c.branch };
      if (sha) cuerpo.sha = sha;
      const r = await fetch(url(c, id), { method: 'PUT', headers: cab({ 'Content-Type': 'application/json' }), body: JSON.stringify(cuerpo) });
      if (!r.ok) throw await fallo(r, 'No se pudo guardar');
      return { id, creado: !sha };
    },
  };
  window.MapasRepo = API;
})();
