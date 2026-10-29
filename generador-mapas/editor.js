// Editor v23.1 — solo celdas (carga a+b+c)
(async function () {
  try {
    const parts = await Promise.all([
      fetch('editor-v23-a.js?v=2').then(r => { if (!r.ok) throw new Error('a ' + r.status); return r.text(); }),
      fetch('editor-v23-b.js?v=2').then(r => { if (!r.ok) throw new Error('b ' + r.status); return r.text(); }),
      fetch('editor-v23-c.js?v=2').then(r => { if (!r.ok) throw new Error('c ' + r.status); return r.text(); }),
    ]);
    (0, eval)(parts.join(''));
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div style="color:#e2e8f0;background:#0f1115;padding:40px;font:16px system-ui">Error v23.1: ' + err.message + '</div>';
  }
})();
