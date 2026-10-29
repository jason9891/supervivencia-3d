// v22 editor — ensambla el editor completo (celdas, sin vértices)
(async function () {
  try {
    const base = (document.currentScript && document.currentScript.src)
      ? document.currentScript.src.replace(/[^/]+$/, '')
      : './';
    const [a, b] = await Promise.all([
      fetch(base + 'editor_part1.js?v=22').then(r => { if (!r.ok) throw new Error('part1 ' + r.status); return r.text(); }),
      fetch(base + 'editor_part2.js?v=22').then(r => { if (!r.ok) throw new Error('part2 ' + r.status); return r.text(); }),
    ]);
    (0, eval)(a + b);
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div style="color:#e2e8f0;background:#0f1115;padding:40px;font:16px system-ui">Error cargando editor v22: ' + err.message + '<br>Haz hard refresh o sustituye los archivos del ZIP.</div>';
  }
})();
