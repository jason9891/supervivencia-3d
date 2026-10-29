/**
 * Editor de mapas v23 — SOLO CELDAS (parte 1)
 * Ver editor.js bootstrap que ensambla p1+p2
 */
const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const hudEl = document.getElementById('hud');
const propsEl = document.getElementById('properties');
const container = document.getElementById('canvas-container');
const toastEl = document.getElementById('toast');
const LS_KEY = 'castillo-v20';

const GRID = 0.1;
let scale = 50, offsetX = 0, offsetY = 0;
let tool = 'sala';
let activeLevel = 0;
let data = { rooms: [], walls: [], doors: [], holes: [], blocks: [], doorTypes: [], activeDoorType: null };
let selected = null, multiSel = [];
let mouseWorld = { x: 0, z: 0 };
let hoverCell = { x: 0, z: 0 };

let isPanning = false, panStart = { x: 0, y: 0 }, spacePressed = false;
let isDraggingNew = false, dragTemp = null;
let isDrawingWall = false, currentWall = [];
let isMovingExisting = false, moveStart = { x: 0, z: 0 }, moveOrig = null;

const W2S = (x, z) => [x * scale + offsetX, -z * scale + offsetY];
const S2W = (px, py) => [(px - offsetX) / scale, -(py - offsetY) / scale];
const cellOf = (v) => +(Math.floor(v / GRID + 1e-9) * GRID).toFixed(1);
const cellCenter = (v) => +(cellOf(v) + GRID / 2).toFixed(2);
const almost = (a, b, eps = GRID * 0.6) => Math.abs(a - b) <= eps;
const isLevel = (y) => Math.abs((y || 0) - activeLevel) < 0.5;
const el = (id) => document.getElementById(id);
const uid = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const deep = (o) => JSON.parse(JSON.stringify(o));

function mouseToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width ? (canvas.width / rect.width) : 1;
  const sy = rect.height ? (canvas.height / rect.height) : 1;
  const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  return S2W((clientX - rect.left) * sx, (clientY - rect.top) * sy);
}
function cellUnder(e) {
  const [wx, wz] = mouseToWorld(e);
  return { x: cellOf(wx), z: cellOf(wz), wx, wz };
}

function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), 1400);
}

function normalizeData() {
  if (!data || typeof data !== 'object') data = {};
  ['rooms', 'walls', 'doors', 'holes', 'blocks'].forEach(k => { if (!Array.isArray(data[k])) data[k] = []; });
  if (!Array.isArray(data.doorTypes)) data.doorTypes = [];
}
function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {}
}

let hist = [], histIdx = -1;
function commit() {
  const s = JSON.stringify(data);
  persist();
  if (histIdx >= 0 && hist[histIdx] === s) return;
  hist.splice(histIdx + 1);
  hist.push(s);
  if (hist.length > 200) hist.shift();
  histIdx = hist.length - 1;
  updateHistButtons();
}
function undo() {
  if (isDrawingWall && currentWall.length) { currentWall.pop(); if (!currentWall.length) cancelWall(); draw(); return; }
  if (histIdx > 0) { histIdx--; data = JSON.parse(hist[histIdx]); normalizeData(); clearSelection(); persist(); draw(); toast('↩️ Deshacer'); }
}
function redo() {
  if (histIdx < hist.length - 1) { histIdx++; data = JSON.parse(hist[histIdx]); normalizeData(); clearSelection(); persist(); draw(); toast('↪️ Rehacer'); }
}
function updateHistButtons() {
  if (el('btn-undo')) el('btn-undo').disabled = histIdx <= 0 && !isDrawingWall;
  if (el('btn-redo')) el('btn-redo').disabled = histIdx >= hist.length - 1;
}

function resize() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  if (offsetX === 0 && offsetY === 0) { offsetX = canvas.width / 2; offsetY = canvas.height / 2; }
  draw();
}
window.addEventListener('resize', resize);

function resetView() {
  offsetX = canvas.width / 2; offsetY = canvas.height / 2; scale = 50; draw();
}

function changeLevel(val) {
  const n = parseFloat(val);
  if (!isFinite(n)) return;
  activeLevel = n;
  clearSelection(); draw(); updateStatus();
}
function nudgeLevel(d) { changeLevel(activeLevel + d); if (el('level-input')) el('level-input').value = activeLevel; }

function updateStatus() {
  const names = { sala: 'Suelo', pared: 'Muro', sel: 'Seleccionar', borrar: 'Borrar', poly: 'Polilínea', hueco: 'Hueco', rampa: 'Rampa', escalera: 'Escalera', puerta: 'Puerta', bloque: 'Bloques' };
  if (statusEl) statusEl.textContent = 'Nivel: ' + activeLevel + ' | Herramienta: ' + (names[tool] || tool);
}

function setTool(t) {
  if (isDrawingWall) finishWall();
  tool = t;
  container.classList.toggle('painting', t !== 'sel');
  document.querySelectorAll('#topbar button').forEach(b => b.classList.remove('active'));
  const btn = el('btn-' + t);
  if (btn) btn.classList.add('active');
  updateStatus();
}

function clearSelection() {
  selected = null; multiSel = [];
  if (el('btn-del-sel')) el('btn-del-sel').style.display = 'none';
  if (propsEl) propsEl.innerHTML = '<div style="color:#64748b;width:100%;text-align:center;margin-top:30px">Selecciona un elemento.</div>';
}

function getObj(sel) {
  if (!sel) return null;
  const arr = sel.type === 'room' ? data.rooms : sel.type === 'wall' ? data.walls : sel.type === 'door' ? data.doors : sel.type === 'hole' ? data.holes : data.blocks;
  return arr.find(x => x.id === sel.id) || null;
}

function roomWalls(r) {
  if (r.type !== 'sala' || r.open || r.points) return [];
  const others = data.rooms.filter(o => o !== r && !o.points && o.type === 'sala' && !o.open && isLevel(o.y) && isLevel(r.y));
  return Celdas.roomWallCells(r, others);
}

function pickAt(wx, wz) {
  const cx = cellOf(wx), cz = cellOf(wz);
  for (let i = data.doors.length - 1; i >= 0; i--) {
    const d = data.doors[i];
    if (!isLevel(d.y)) continue;
    const cells = Celdas.doorCells(d);
    if (cells.some(c => almost(c.x, cx) && almost(c.z, cz))) return { type: 'door', id: d.id };
  }
  for (let i = data.walls.length - 1; i >= 0; i--) {
    const w = data.walls[i];
    if (!isLevel(w.y || 0)) continue;
    const cells = Celdas.wallCells(w);
    if (cells.some(c => almost(c.x, cx) && almost(c.z, cz))) return { type: 'wall', id: w.id };
  }
  for (let i = data.rooms.length - 1; i >= 0; i--) {
    const r = data.rooms[i];
    if (!isLevel(r.y) || r.points) continue;
    const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1);
    const z0 = Math.min(r.z0, r.z1), z1 = Math.max(r.z0, r.z1);
    if (wx >= x0 && wx < x1 && wz >= z0 && wz < z1) return { type: 'room', id: r.id };
  }
  return null;
}

function drawGrid() {
  const step = scale * GRID;
  if (step >= 3) {
    ctx.strokeStyle = '#1a1f2a'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = offsetX % step; x < canvas.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = offsetY % step; y < canvas.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
  }
  const major = scale;
  ctx.strokeStyle = '#2a3344'; ctx.beginPath();
  for (let x = offsetX % major; x < canvas.width; x += major) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
  for (let y = offsetY % major; y < canvas.height; y += major) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
  ctx.stroke();
  ctx.strokeStyle = '#475569'; ctx.beginPath();
  ctx.moveTo(offsetX, 0); ctx.lineTo(offsetX, canvas.height);
  ctx.moveTo(0, offsetY); ctx.lineTo(canvas.width, offsetY); ctx.stroke();
}

function fillCell(cx, cz, fill, stroke) {
  const cellPx = Math.max(1, scale * GRID);
  const [bx, by] = W2S(cx, cz + GRID);
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(bx + 0.5, by + 0.5, cellPx - 1, cellPx - 1); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, cellPx - 1, cellPx - 1); }
}

function draw() {
  ctx.fillStyle = '#0f1115';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  data.rooms.forEach(r => {
    if (!isLevel(r.y) || r.points) return;
    const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1);
    const z0 = Math.min(r.z0, r.z1), z1 = Math.max(r.z0, r.z1);
    const sel = selected && selected.type === 'room' && selected.id === r.id;
    for (let x = cellOf(x0); x < x1 - 1e-9; x = +(x + GRID).toFixed(1))
      for (let z = cellOf(z0); z < z1 - 1e-9; z = +(z + GRID).toFixed(1))
        fillCell(x, z, sel ? 'rgba(59,130,246,0.2)' : 'rgba(148,163,184,0.08)', null);
    roomWalls(r).forEach(c => fillCell(c.x, c.z, sel ? 'rgba(59,130,246,0.75)' : 'rgba(200,210,225,0.85)', sel ? '#3b82f6' : '#94a3b8'));
    const [lx, ly] = W2S((x0 + x1) / 2, (z0 + z1) / 2);
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText((r.nombre || 'Sala') + ' (Y:' + (r.y || 0) + ')', lx, ly);
  });
