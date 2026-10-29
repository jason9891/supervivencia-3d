// Restauración temporal: carga la última versión buena del editor
// (commit 0ec5568) mientras se sube el archivo completo.
(function () {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/jason9891/supervivencia-3d@0ec5568c9ac3a74a18c7aad615eb3d01804acbb7/generador-mapas/editor.js';
  s.onerror = function () {
    document.body.innerHTML = '<div style="color:#e2e8f0;background:#0f1115;padding:40px;font:16px/1.5 system-ui">No se pudo cargar el editor desde CDN.<br>Descarga el ZIP de restauración y sustituye generador-mapas/editor.js</div>';
  };
  document.head.appendChild(s);
})();
