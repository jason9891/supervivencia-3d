// v22-patch.js — editor por CELDAS v22.1
// - Muro: 1 celda (puntos en centros; celdas.js Bresenham)
// - Poly: sin desfase +x/+z (cellOf, no snap a vértice)
// - Suelo: sin cambios
(function () {
  if (typeof GRID === 'undefined' || typeof cellOf !== 'function') {
    console.error('v22-patch: editor base no cargó');
    return;
  }

  window.cellCenter = function (v) {
    return +(cellOf(v) + GRID / 2).toFixed(2);
  };

  // finishDraw: NO usar snap() a vértices (generaba muros de 2 celdas)
  window.finishDraw = function (close) {
    let changed = false;
    if (isDrawingPoly) {
      if (currentPoly.length >= 3) {
        const pts = currentPoly.map(p => ({ x: cellOf(p.x), z: cellOf(p.z) }));
        const clean = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.z !== pts[i - 1].z);
        if (clean.length >= 3) {
          data.rooms.push({
            id: uid('poly'), nombre: 'Patio Libre', type: 'patio', open: true,
            points: clean, y: activeLevel, y2: null
          });
          changed = true;
        }
      }
      isDrawingPoly = false; currentPoly = [];
    }
    if (isDrawingWall) {
      let pts = currentWall
        .filter((p, i) => i === 0 || p.x !== currentWall[i - 1].x || p.z !== currentWall[i - 1].z)
        .map(p => ({ x: cellCenter(p.x), z: cellCenter(p.z) }));
      let closed = close === true;
      if (pts.length > 2) {
        const dClose = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z);
        if (dClose <= GRID * 1.5) { pts.pop(); closed = true; }
      }
      if (pts.length >= 2) {
        const w = { id: uid('w'), points: pts, h: blockH(), y: activeLevel };
        if (closed && pts.length >= 3) w.closed = true;
        data.walls.push(w);
        changed = true;
      }
      isDrawingWall = false; currentWall = [];
    }
    el('btn-finish').style.display = 'none';
    draw();
    if (changed) commit(); else updateHistButtons();
  };

  container.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    const [wx, wz] = mouseToWorld(e);
    if (tool === 'pared' && isDrawingWall && currentWall.length) {
      currentWall[currentWall.length - 1] = { x: cellCenter(wx), z: cellCenter(wz) };
      draw();
    }
    if (tool === 'poly' && isDrawingPoly && currentPoly.length) {
      currentPoly[currentPoly.length - 1] = { x: cellOf(wx), z: cellOf(wz) };
      draw();
    }
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
      dragTemp.x1 = cellOf(wx) + GRID;
      dragTemp.z1 = cellOf(wz) + GRID;
    }
  }, false);

  const origDraw = draw;
  window.draw = function () {
    origDraw();
    try {
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

  console.log('v22.1-patch OK: muro 1 celda, poly sin desfase');
})();
