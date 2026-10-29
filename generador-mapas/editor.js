// Editor v23.1 — loader base64 (completo: poly, hueco, rampa, escalera, bloques, puerta…)
(async function () {
  try {
    const n = 12;
    const chunks = [];
    for (let i = 0; i < n; i++) {
      const t = await fetch('editor-b64-' + i + '.txt?v=1').then(r => {
        if (!r.ok) throw new Error('b64-' + i + ' ' + r.status);
        return r.text();
      });
      chunks.push(t.trim());
    }
    const bin = atob(chunks.join(''));
    const code = decodeURIComponent(escape(bin));
    (0, eval)(code);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div style="color:#e2e8f0;background:#0f1115;padding:40px;font:16px system-ui">Error cargando editor v23.1: ' + err.message + '<br>Usa el ZIP de respaldo si hace falta.</div>';
  }
})();
