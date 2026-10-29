/** Editor v23 — solo celdas (núcleo). Respaldo: backup-pre-v23 / commit 0ec5568c */
const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const hudEl = document.getElementById('hud');
const propsEl = document.getElementById('properties');
const container = document.getElementById('canvas-container');
const toastEl = document.getElementById('toast');
const LS_KEY = 'castillo-v20';
const GRID = 0.1;
let scale = 50, offsetX = 0, offsetY = 0, tool = 'sala', activeLevel = 0;
let data = { rooms: [], walls: [], doors: [], holes: [], blocks: [], doorTypes: [] };
let selected = null, mouseWorld = { x: 0, z: 0 }, hoverCell = { x: 0, z: 0 };
let isPanning = false, panStart = { x: 0, y: 0 }, spacePressed = false;
let isDraggingNew = false, dragTemp = null, isDrawingWall = false, currentWall = [];
let hist = [], histIdx = -1, _raf = 0;

const W2S = (x, z) => [x * scale + offsetX, -z * scale + offsetY];
const S2W = (px, py) => [(px - offsetX) / scale, -(py - offsetY) / scale];
const cellOf = (v) => +(Math.floor(v / GRID + 1e-9) * GRID).toFixed(1);
const almost = (a, b) => Math.abs(a - b) <= GRID * 0.6;
const isLevel = (y) => Math.abs((y || 0) - activeLevel) < 0.5;
const el = (id) => document.getElementById(id);
const uid = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 9999).toString(36);

function mouseToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width ? canvas.width / rect.width : 1;
  const sy = rect.height ? canvas.height / rect.height : 1;
  const cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX);
  const cy = e.clientY != null ? e.clientY : (e.touches && e.touches[0].clientY);
  return S2W((cx - rect.left) * sx, (cy - rect.top) * sy);
}
function cellUnder(e) {
  const [wx, wz] = mouseToWorld(e);
  return { x: cellOf(wx), z: cellOf(wz), wx, wz };
}
function toast(m) {
  toastEl.textContent = m; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), 1400);
}
function normalizeData() {
  if (!data || typeof data !== 'object') data = {};
  ['rooms','walls','doors','holes','blocks'].forEach(k => { if (!Array.isArray(data[k])) data[k] = []; });
}
function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} }
function commit() {
  const s = JSON.stringify(data); persist();
  if (histIdx >= 0 && hist[histIdx] === s) return;
  hist.splice(histIdx + 1); hist.push(s); if (hist.length > 200) hist.shift(); histIdx = hist.length - 1;
}
function undo() {
  if (isDrawingWall && currentWall.length) { currentWall.pop(); if (!currentWall.length) cancelWall(); draw(); return; }
  if (histIdx > 0) { histIdx--; data = JSON.parse(hist[histIdx]); normalizeData(); selected = null; persist(); draw(); toast('↩️'); }
}
function redo() {
  if (histIdx < hist.length - 1) { histIdx++; data = JSON.parse(hist[histIdx]); normalizeData(); selected = null; persist(); draw(); toast('↪️'); }
}
function resize() {
  canvas.width = container.clientWidth; canvas.height = container.clientHeight;
  if (!offsetX && !offsetY) { offsetX = canvas.width / 2; offsetY = canvas.height / 2; }
  draw();
}
window.addEventListener('resize', resize);
function resetView() { offsetX = canvas.width / 2; offsetY = canvas.height / 2; scale = 50; draw(); }
function changeLevel(v) { const n = parseFloat(v); if (!isFinite(n)) return; activeLevel = n; selected = null; draw(); updateStatus(); }
function nudgeLevel(d) { changeLevel(activeLevel + d); if (el('level-input')) el('level-input').value = activeLevel; }
function updateStatus() {
  const n = { sala:'Suelo', pared:'Muro', sel:'Seleccionar', borrar:'Borrar' };
  if (statusEl) statusEl.textContent = 'Nivel: ' + activeLevel + ' | ' + (n[tool] || tool);
}
function setTool(t) {
  if (isDrawingWall) finishWall();
  tool = t;
  container.classList.toggle('painting', t !== 'sel');
  document.querySelectorAll('#topbar button').forEach(b => b.classList.remove('active'));
  const b = el('btn-' + t); if (b) b.classList.add('active');
  updateStatus();
}
function roomWalls(r) {
  if (r.type !== 'sala' || r.open || r.points) return [];
  const others = data.rooms.filter(o => o !== r && !o.points && o.type === 'sala' && !o.open && isLevel(o.y));
  return Celdas.roomWallCells(r, others);
}
function fillCell(cx, cz, fill, stroke) {
  const p = Math.max(1, scale * GRID);
  const [bx, by] = W2S(cx, cz + GRID);
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(bx + 0.5, by + 0.5, p - 1, p - 1); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, p - 1, p - 1); }
}
function draw() {
  ctx.fillStyle = '#0f1115'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const step = scale * GRID;
  if (step >= 3) {
    ctx.strokeStyle = '#1a1f2a'; ctx.beginPath();
    for (let x = offsetX % step; x < canvas.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = offsetY % step; y < canvas.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
  }
  ctx.strokeStyle = '#2a3344'; ctx.beginPath();
  for (let x = offsetX % scale; x < canvas.width; x += scale) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
  for (let y = offsetY % scale; y < canvas.height; y += scale) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
  ctx.stroke();
  ctx.strokeStyle = '#475569'; ctx.beginPath();
  ctx.moveTo(offsetX, 0); ctx.lineTo(offsetX, canvas.height);
  ctx.moveTo(0, offsetY); ctx.lineTo(canvas.width, offsetY); ctx.stroke();

  data.rooms.forEach(r => {
    if (!isLevel(r.y) || r.points) return;
    const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1);
    const z0 = Math.min(r.z0, r.z1), z1 = Math.max(r.z0, r.z1);
    const sel = selected && selected.type === 'room' && selected.id === r.id;
    for (let x = cellOf(x0); x < x1 - 1e-9; x = +(x + GRID).toFixed(1))
      for (let z = cellOf(z0); z < z1 - 1e-9; z = +(z + GRID).toFixed(1))
        fillCell(x, z, sel ? 'rgba(59,130,246,0.2)' : 'rgba(148,163,184,0.08)', null);
    roomWalls(r).forEach(c => fillCell(c.x, c.z, sel ? 'rgba(59,130,246,0.75)' : 'rgba(200,210,225,0.85)', sel ? '#3b82f6' : '#94a3b8'));
  });
  data.walls.forEach(w => {
    if (!isLevel(w.y || 0)) return;
    const sel = selected && selected.type === 'wall' && selected.id === w.id;
    Celdas.wallCells(w).forEach(c => fillCell(c.x, c.z, sel ? 'rgba(59,130,246,0.8)' : 'rgba(96,165,250,0.7)', '#60a5fa'));
  });
  if (isDraggingNew && dragTemp) {
    const xa = Math.min(dragTemp.x0, dragTemp.x1), xb = Math.max(dragTemp.x0, dragTemp.x1);
    const za = Math.min(dragTemp.z0, dragTemp.z1), zb = Math.max(dragTemp.z0, dragTemp.z1);
    for (let x = cellOf(xa); x < xb - 1e-9; x = +(x + GRID).toFixed(1))
      for (let z = cellOf(za); z < zb - 1e-9; z = +(z + GRID).toFixed(1))
        fillCell(x, z, 'rgba(59,130,246,0.35)', '#3b82f6');
  }
  if (isDrawingWall && currentWall.length) {
    Celdas.wallCells({ points: [...currentWall, hoverCell] }).forEach(c => fillCell(c.x, c.z, 'rgba(59,130,246,0.55)', '#3b82f6'));
    currentWall.forEach(p => {
      const [px, py] = W2S(p.x + GRID / 2, p.z + GRID / 2);
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    });
  }
  fillCell(hoverCell.x, hoverCell.z, 'rgba(59,130,246,0.15)', 'rgba(59,130,246,0.9)');
  const [gx, gy] = W2S(hoverCell.x + GRID / 2, hoverCell.z + GRID / 2);
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.beginPath();
  ctx.moveTo(gx - 5, gy); ctx.lineTo(gx + 5, gy); ctx.moveTo(gx, gy - 5); ctx.lineTo(gx, gy + 5); ctx.stroke();
}
function scheduleDraw() {
  if (_raf) return;
  _raf = requestAnimationFrame(() => { _raf = 0; draw(); });
}

container.addEventListener('mousemove', e => {
  if (isPanning) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? canvas.width / rect.width : 1;
    const sy = rect.height ? canvas.height / rect.height : 1;
    offsetX += (e.clientX - panStart.x) * sx; offsetY += (e.clientY - panStart.y) * sy;
    panStart = { x: e.clientX, y: e.clientY }; scheduleDraw(); return;
  }
  const c = cellUnder(e);
  mouseWorld = { x: c.wx, z: c.wz }; hoverCell = { x: c.x, z: c.z };
  if (hudEl) hudEl.textContent = 'Celda ' + c.x.toFixed(1) + ', ' + c.z.toFixed(1) + ' | Zoom ' + Math.round(scale * 10) + '%';
  if (isDraggingNew && dragTemp) { dragTemp.x1 = c.x + GRID; dragTemp.z1 = c.z + GRID; }
  scheduleDraw();
});

container.addEventListener('mousedown', e => {
  if (e.button === 1 || e.button === 2 || spacePressed) { isPanning = true; panStart = { x: e.clientX, y: e.clientY }; return; }
  if (e.button !== 0) return;
  const c = cellUnder(e);
  hoverCell = { x: c.x, z: c.z };
  if (tool === 'sel' || e.ctrlKey) {
    // pick room by cell
    let hit = null;
    for (let i = data.rooms.length - 1; i >= 0; i--) {
      const r = data.rooms[i]; if (!isLevel(r.y) || r.points) continue;
      if (c.wx >= Math.min(r.x0,r.x1) && c.wx < Math.max(r.x0,r.x1) && c.wz >= Math.min(r.z0,r.z1) && c.wz < Math.max(r.z0,r.z1)) { hit = { type: 'room', id: r.id }; break; }
    }
    if (!hit) {
      for (let i = data.walls.length - 1; i >= 0; i--) {
        const w = data.walls[i]; if (!isLevel(w.y||0)) continue;
        if (Celdas.wallCells(w).some(x => almost(x.x,c.x) && almost(x.z,c.z))) { hit = { type: 'wall', id: w.id }; break; }
      }
    }
    selected = hit; draw(); return;
  }
  if (tool === 'pared') {
    if (!isDrawingWall) { isDrawingWall = true; currentWall = []; if (el('btn-finish')) el('btn-finish').style.display = 'inline-block'; }
    if (currentWall.length >= 3 && almost(c.x, currentWall[0].x) && almost(c.z, currentWall[0].z)) { finishWall(true); return; }
    currentWall.push({ x: c.x, z: c.z }); draw(); return;
  }
  if (tool === 'sala') {
    isDraggingNew = true;
    dragTemp = { x0: c.x, z0: c.z, x1: c.x + GRID, z1: c.z + GRID };
    draw(); return;
  }
  if (tool === 'borrar' && selected) deleteSelected();
});

container.addEventListener('mouseup', () => {
  if (isPanning) { isPanning = false; return; }
  if (!isDraggingNew || !dragTemp) return;
  isDraggingNew = false;
  const x0 = cellOf(Math.min(dragTemp.x0, dragTemp.x1));
  const x1 = +Math.max(dragTemp.x0, dragTemp.x1).toFixed(1);
  const z0 = cellOf(Math.min(dragTemp.z0, dragTemp.z1));
  const z1 = +Math.max(dragTemp.z0, dragTemp.z1).toFixed(1);
  dragTemp = null;
  if (x1 - x0 >= GRID - 1e-6 && z1 - z0 >= GRID - 1e-6 && tool === 'sala') {
    data.rooms.push({ id: uid('r'), nombre: 'Sala', x0, x1, z0, z1, type: 'sala', y: activeLevel, open: false });
    commit(); toast('Sala');
  }
  draw();
});

function finishWall(close) {
  if (currentWall.length >= 2) {
    data.walls.push({ id: uid('w'), points: currentWall.map(p => ({ x: p.x + GRID/2, z: p.z + GRID/2 })), h: 3, y: activeLevel, closed: !!close && currentWall.length >= 3 });
    commit(); toast('Muro');
  }
  cancelWall(); draw();
}
function cancelWall() { isDrawingWall = false; currentWall = []; if (el('btn-finish')) el('btn-finish').style.display = 'none'; }
function finishDraw() { if (isDrawingWall) finishWall(); }
function deleteSelected() {
  if (!selected) return;
  const arr = selected.type === 'room' ? data.rooms : data.walls;
  const i = arr.findIndex(x => x.id === selected.id);
  if (i >= 0) arr.splice(i, 1);
  selected = null; commit(); draw(); toast('Eliminado');
}
function newMap() {
  if (!confirm('¿Borrar todo?')) return;
  data = { rooms: [], walls: [], doors: [], holes: [], blocks: [], doorTypes: [] };
  selected = null; commit(); draw();
}
function exportJSON() { navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => toast('JSON copiado')); }
function downloadJSON() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'mapa.json'; a.click();
}
function importJSON(input) {
  const f = input.files && input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { data = JSON.parse(r.result); normalizeData(); selected = null; commit(); draw(); toast('Importado'); } catch (_) { toast('JSON inválido'); } };
  r.readAsText(f); input.value = '';
}
function openDoorDesigner() { toast('Puertas: se reañaden en v23'); }

window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); spacePressed = true; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if (e.key === 'Enter' && isDrawingWall) finishWall();
  if (e.key === 'Escape') { cancelWall(); selected = null; draw(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteSelected(); }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') spacePressed = false; });
container.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width ? canvas.width / rect.width : 1;
  const sy = rect.height ? canvas.height / rect.height : 1;
  const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
  const f = e.deltaY < 0 ? 1.1 : 0.9;
  const ns = Math.max(10, Math.min(200, scale * f));
  offsetX = mx - (mx - offsetX) * (ns / scale);
  offsetY = my - (my - offsetY) * (ns / scale);
  scale = ns; scheduleDraw();
}, { passive: false });
container.addEventListener('contextmenu', e => e.preventDefault());

try { const raw = localStorage.getItem(LS_KEY); if (raw) data = JSON.parse(raw); } catch (_) {}
normalizeData();
hist = [JSON.stringify(data)]; histIdx = 0;
resize(); setTool('sala');
console.log('Editor v23 — solo celdas (núcleo: suelo + muro + selección)');
