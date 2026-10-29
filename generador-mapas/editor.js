// v22.2: editor base + parche celdas (puntero sigue mouse)
(function () {
  var base = document.createElement('script');
  base.src = 'https://cdn.jsdelivr.net/gh/jason9891/supervivencia-3d@0ec5568c9ac3a74a18c7aad615eb3d01804acbb7/generador-mapas/editor.js';
  base.onload = function () {
    var p = document.createElement('script');
    p.src = 'v22-patch.js?v=6';
    document.head.appendChild(p);
  };
  base.onerror = function () {
    document.body.innerHTML = '<div style="color:#e2e8f0;background:#0f1115;padding:40px;font:16px system-ui">No se pudo cargar el editor.</div>';
  };
  document.head.appendChild(base);
})();
