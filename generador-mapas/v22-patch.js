// v22-patch.js — editor por CELDAS (sin vértices)
(function () {
  if (typeof GRID === 'undefined' || typeof cellOf !== 'function') {
    console.error('v22-patch: editor base no cargó');
    return;
  }

  window.cellCenter = function (v) {
    return +(cellOf(v) + GRID / 2).toFixed(2);
  };

  // Corregir puntos de muro/polilínea al centro de celda justo después del handler original
  container.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    const [wx, wz] = mouseToWorld(e);
    if (tool === 'pared' && isDrawingWall && currentWall.length) {
      currentWall[currentWall.length - 1] = { x: cellCenter(wx), z: cellCenter(wz) };
      draw();
    }
    if (tool === 'poly' && isDrawingPoly && currentPoly.length) {
      currentPoly[currentPoly.length - 1] = { x: cellCenter(wx), z: cellCenter(wz) };
      draw();
    }
    // Sala/hueco: forzar dragTemp a celdas enteras
    if ((tool === 'sala' || tool === 'rampa' || tool === 'escalera' || tool === 'hueco') && isDraggingNew && dragTemp) {
      const c0x = cellOf(wx), c0z = cellOf(wz);
      dragTemp.x0 = c0x; dragTemp.z0 = c0z;
      dragTemp.x1 = c0x + GRID; dragTemp.z1 = c0z + GRID;
    }
  }, false);

  container.addEventListener('mousemove', function (e) {
    const [wx, wz] = mouseToWorld(e);
    if (hudEl) {
      hudEl.textContent = 'X: ' + (+cellCenter(wx)).toFixed(2) + ', Z: ' + (+cellCenter(wz)).toFixed(2) +
        ' | Zoom: ' + Math.round(scale * 10) + '%';
    }
    if (isDraggingNew && dragTemp && (tool === 'sala' || tool === 'rampa' || tool === 'escalera' || tool === 'hueco')) {
      const c1x = cellOf(wx), c1z = cellOf(wz);
      dragTemp.x1 = c1x + GRID;
      dragTemp.z1 = c1z + GRID;
    }
  }, false);

  const origDraw = draw;
  window.draw = function () {
    origDraw();
    try {
      // Guía: celda + cruz en centro
      if (!isPanning && !isBoxSelecting && mouseWorld) {
        const cellPx = Math.max(1, scale * GRID);
        const [bx, by] = W2S(cellOf(mouseWorld.x), cellOf(mouseWorld.z) + GRID);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.10)';
        ctx.fillRect(bx + 0.5, by + 0.5, cellPx - 1, cellPx - 1);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, cellPx - 1, cellPx - 1);
        const [gx, gy] = W2S(cellCenter(mouseWorld.x), cellCenter(mouseWorld.z));
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gx - 5, gy); ctx.lineTo(gx + 5, gy);
        ctx.moveTo(gx, gy - 5); ctx.lineTo(gx, gy + 5);
        ctx.stroke();
      }
      // Preview sala/hueco: cuadrados de celdas
      if (isDraggingNew && dragTemp) {
        const xa = Math.min(dragTemp.x0, dragTemp.x1);
        const xb = Math.max(dragTemp.x0, dragTemp.x1);
        const za = Math.min(dragTemp.z0, dragTemp.z1);
        const zb = Math.max(dragTemp.z0, dragTemp.z1);
        const cellPx = Math.max(1, scale * GRID);
        const fill = tool === 'hueco' ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)';
        const stroke = tool === 'hueco' ? '#ef4444' : '#3b82f6';
        for (let x = cellOf(xa); x < xb - 1e-9; x = +(x + GRID).toFixed(1)) {
          for (let z = cellOf(za); z < zb - 1e-9; z = +(z + GRID).toFixed(1)) {
            const [px, py] = W2S(x, z + GRID);
            ctx.fillStyle = fill;
            ctx.fillRect(px + 0.5, py + 0.5, cellPx - 1, cellPx - 1);
            ctx.strokeStyle = stroke; ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, cellPx - 1, cellPx - 1);
          }
        }
      }
    } catch (err) { console.warn('v22 draw overlay', err); }
  };

  console.log('v22-patch OK: celdas (puntero centro, preview cuadrados, muros en centros)');
})();
