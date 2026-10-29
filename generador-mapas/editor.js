// Editor v23 — solo celdas (carga ensamblada)
(async function () {
  try {
    const [a, b] = await Promise.all([
      fetch('editor-v23-p1.js?v=1').then(r => { if (!r.ok) throw new Error('p1 ' + r.status); return r.text(); }),
      fetch('editor-v23-p2.js?v=1').then(r => { if (!r.ok) throw new Error('p2 ' + r.status); return r.text(); }),
    ]);
    (0, eval)(a + b);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div style="color:#e2e8f0;background:#0f1115;padding:40px;font:16px system-ui">Error cargando editor v23: ' + err.message + '</div>';
  }
})();
