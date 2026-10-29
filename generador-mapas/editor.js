// Editor v23.3 — planos transparentes + selección
(async function () {
  try {
    const [a, b] = await Promise.all([
      fetch('editor-v23-3a.js?v=1').then(r => { if (!r.ok) throw new Error('a ' + r.status); return r.text(); }),
      fetch('editor-v23-3b.js?v=1').then(r => { if (!r.ok) throw new Error('b ' + r.status); return r.text(); }),
    ]);
    (0, eval)(a + b);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div style="color:#e2e8f0;background:#0f1115;padding:40px;font:16px system-ui">Error v23.3: ' + err.message + '</div>';
  }
})();
