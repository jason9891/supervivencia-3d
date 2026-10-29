/** Editor v23.3 — solo celdas · planos transparentes por distancia · selección */
const canvas=document.getElementById('cv'),ctx=canvas.getContext('2d');
const statusEl=document.getElementById('status'),hudEl=document.getElementById('hud');
const propsEl=document.getElementById('properties'),container=document.getElementById('canvas-container');
const toastEl=document.getElementById('toast'),LS_KEY='castillo-v20',GRID=0.1;
let scale=50,offsetX=0,offsetY=0,tool='sala',activeLevel=0;
let data={rooms:[],walls:[],doors:[],holes:[],blocks:[],doorTypes:[],activeDoorType:null};
let selected=null,mouseWorld={x:0,z:0},hoverCell={x:0,z:0};
let isPanning=false,panStart={x:0,y:0},spacePressed=false;
let isDraggingNew=false,dragTemp=null,isDrawingWall=false,currentWall=[];
let isDrawingPoly=false,currentPoly=[],paintingBlocks=false,blockErase=false,blockChanged=false;
let isMovingExisting=false,moveStart=null,moveOrig=null,hist=[],histIdx=-1,_raf=0;
const W2S=(x,z)=>[x*scale+offsetX,-z*scale+offsetY];
const S2W=(px,py)=>[(px-offsetX)/scale,-(py-offsetY)/scale];
const cellOf=v=>+(Math.floor(v/GRID+1e-9)*GRID).toFixed(1);
const almost=(a,b,eps=GRID*0.55)=>Math.abs(a-b)<=eps;
const isLevel=y=>Math.abs((y||0)-activeLevel)<0.5;
const levelAlpha=y=>{const d=Math.abs((y||0)-activeLevel);if(d<0.5)return 1;if(d<1.5)return 0.42;if(d<3)return 0.24;if(d<6)return 0.12;return 0.06;};
const el=id=>document.getElementById(id);
const uid=p=>p+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
const deep=o=>JSON.parse(JSON.stringify(o));
const blockH=()=>{const i=el('block-h');return i?Math.max(0.5,parseFloat(i.value)||4):4};

function mouseToWorld(e){
  const rect=canvas.getBoundingClientRect();
  const sx=rect.width?canvas.width/rect.width:1,sy=rect.height?canvas.height/rect.height:1;
  const cx=e.clientX!=null?e.clientX:(e.touches&&e.touches[0]?e.touches[0].clientX:0);
  const cy=e.clientY!=null?e.clientY:(e.touches&&e.touches[0]?e.touches[0].clientY:0);
  return S2W((cx-rect.left)*sx,(cy-rect.top)*sy);
}
function cellUnder(e){const[wx,wz]=mouseToWorld(e);return{x:cellOf(wx),z:cellOf(wz),wx,wz};}
function toast(m){if(!toastEl)return;toastEl.textContent=m;toastEl.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toastEl.classList.remove('show'),1400);}
function normalizeData(){
  if(!data||typeof data!=='object')data={};
  ['rooms','walls','doors','holes','blocks'].forEach(k=>{if(!Array.isArray(data[k]))data[k]=[];});
  if(!Array.isArray(data.doorTypes))data.doorTypes=[];
  if(!data.doorTypes.length){data.doorTypes.push({id:'dt_default',nombre:'Puerta estándar',w:1.5,h:3.6,sill:0,fw:0.1,depth:0.5,angle:72,panel:'single',hinge:'left',swing:'in'});data.activeDoorType='dt_default';}
  if(!data.activeDoorType)data.activeDoorType=data.doorTypes[0].id;
}
function persist(){try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(_){}}
function commit(){const s=JSON.stringify(data);persist();if(histIdx>=0&&hist[histIdx]===s)return;hist.splice(histIdx+1);hist.push(s);if(hist.length>200)hist.shift();histIdx=hist.length-1;}
function undo(){
  if(isDrawingWall&&currentWall.length){currentWall.pop();if(!currentWall.length)cancelDraw();draw();return;}
  if(isDrawingPoly&&currentPoly.length){currentPoly.pop();if(!currentPoly.length)cancelDraw();draw();return;}
  if(histIdx>0){histIdx--;data=JSON.parse(hist[histIdx]);normalizeData();selected=null;persist();draw();toast('↩️');}
}
function redo(){if(histIdx<hist.length-1){histIdx++;data=JSON.parse(hist[histIdx]);normalizeData();selected=null;persist();draw();toast('↪️');}}
function resize(){canvas.width=container.clientWidth;canvas.height=container.clientHeight;if(!offsetX&&!offsetY){offsetX=canvas.width/2;offsetY=canvas.height/2;}draw();}
window.addEventListener('resize',resize);
function resetView(){offsetX=canvas.width/2;offsetY=canvas.height/2;scale=50;draw();}
function changeLevel(v){const n=parseFloat(v);if(!isFinite(n))return;activeLevel=n;draw();updateStatus();toast('Plano Y='+activeLevel);}
function nudgeLevel(d){changeLevel(activeLevel+d);if(el('level-input'))el('level-input').value=activeLevel;}
function updateStatus(){
  const n={sala:'Suelo',poly:'Polilínea',hueco:'Hueco',rampa:'Rampa',escalera:'Escalera',pared:'Muro',bloque:'Bloques',puerta:'Puerta',sel:'Seleccionar',borrar:'Borrar'};
  if(statusEl)statusEl.textContent='Nivel: '+activeLevel+' | '+(n[tool]||tool);
  if(el('block-h-wrap'))el('block-h-wrap').style.display=tool==='bloque'?'inline-flex':'none';
}
function setTool(t){
  if(t!=='poly'&&isDrawingPoly)finishDraw();
  if(t!=='pared'&&isDrawingWall)finishDraw();
  tool=t;container.classList.toggle('painting',t!=='sel');
  document.querySelectorAll('#topbar button').forEach(b=>b.classList.remove('active'));
  const b=el('btn-'+t);if(b)b.classList.add('active');updateStatus();
}
function roomWalls(r){
  if(r.open||r.points||(r.type&&r.type!=='sala'))return[];
  const others=data.rooms.filter(o=>o!==r&&!o.points&&(!o.type||o.type==='sala')&&!o.open&&Math.abs((o.y||0)-(r.y||0))<0.5);
  return Celdas.roomWallCells(r,others);
}
function getObj(){if(!selected)return null;const m={room:data.rooms,wall:data.walls,door:data.doors,hole:data.holes,block:data.blocks};const a=m[selected.type];return a?a.find(x=>x.id===selected.id):null;}

function pickAt(wx,wz,anyLevel){
  const cx=cellOf(wx),cz=cellOf(wz);
  const tryPick=(onlyActive)=>{
    const ok=y=>onlyActive?isLevel(y):true;
    for(let i=data.doors.length-1;i>=0;i--){const d=data.doors[i];if(!ok(d.y))continue;if(Celdas.doorCells(d).some(c=>almost(c.x,cx)&&almost(c.z,cz)))return{type:'door',id:d.id,y:d.y};}
    for(let i=data.blocks.length-1;i>=0;i--){const b=data.blocks[i];if(!ok(b.y||0))continue;if(almost(b.x,cx)&&almost(b.z,cz))return{type:'block',id:b.id,y:b.y||0};}
    for(let i=data.walls.length-1;i>=0;i--){const w=data.walls[i];if(!ok(w.y||0))continue;if(Celdas.wallCells(w).some(c=>almost(c.x,cx)&&almost(c.z,cz)))return{type:'wall',id:w.id,y:w.y||0};}
    for(let i=data.holes.length-1;i>=0;i--){const h=data.holes[i];if(!ok(h.y))continue;if(wx>=Math.min(h.x0,h.x1)&&wx<Math.max(h.x0,h.x1)&&wz>=Math.min(h.z0,h.z1)&&wz<Math.max(h.z0,h.z1))return{type:'hole',id:h.id,y:h.y};}
    for(let i=data.rooms.length-1;i>=0;i--){
      const r=data.rooms[i];if(!ok(r.y))continue;
      if(r.points){const xs=r.points.map(p=>p.x),zs=r.points.map(p=>p.z);if(wx>=Math.min(...xs)&&wx<=Math.max(...xs)+GRID&&wz>=Math.min(...zs)&&wz<=Math.max(...zs)+GRID)return{type:'room',id:r.id,y:r.y};continue;}
      if(wx>=Math.min(r.x0,r.x1)&&wx<Math.max(r.x0,r.x1)&&wz>=Math.min(r.z0,r.z1)&&wz<Math.max(r.z0,r.z1))return{type:'room',id:r.id,y:r.y};
    }
    return null;
  };
  return tryPick(true)||(anyLevel?tryPick(false):null);
}

function fillCell(cx,cz,fill,stroke){
  const p=Math.max(1,scale*GRID);const[bx,by]=W2S(cx,cz+GRID);
  if(fill){ctx.fillStyle=fill;ctx.fillRect(bx+.5,by+.5,p-1,p-1);}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(bx+.5,by+.5,p-1,p-1);}
}

function drawGrid(){
  const step=scale*GRID;
  if(step>=3){ctx.strokeStyle='#1a1f2a';ctx.beginPath();for(let x=offsetX%step;x<canvas.width;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);}for(let y=offsetY%step;y<canvas.height;y+=step){ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);}ctx.stroke();}
  ctx.strokeStyle='#2a3344';ctx.beginPath();for(let x=offsetX%scale;x<canvas.width;x+=scale){ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);}for(let y=offsetY%scale;y<canvas.height;y+=scale){ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);}ctx.stroke();
  ctx.strokeStyle='#475569';ctx.beginPath();ctx.moveTo(offsetX,0);ctx.lineTo(offsetX,canvas.height);ctx.moveTo(0,offsetY);ctx.lineTo(canvas.width,offsetY);ctx.stroke();
}

function drawRoom(r,a){
  const sel=selected&&selected.type==='room'&&selected.id===r.id;
  ctx.globalAlpha=a;
  if(r.points&&r.points.length>=3){
    ctx.beginPath();r.points.forEach((p,i)=>{const[px,py]=W2S(p.x+GRID/2,p.z+GRID/2);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});
    ctx.closePath();ctx.fillStyle=sel?'rgba(59,130,246,0.25)':'rgba(148,163,184,0.12)';ctx.fill();
    ctx.strokeStyle=sel?'#3b82f6':'#64748b';ctx.lineWidth=2;ctx.stroke();return;
  }
  if(r.x0==null)return;
  const x0=Math.min(r.x0,r.x1),x1=Math.max(r.x0,r.x1),z0=Math.min(r.z0,r.z1),z1=Math.max(r.z0,r.z1);
  const isRamp=r.type==='rampa'||r.type==='escalera';
  const ff=isRamp?(sel?'rgba(245,158,11,0.3)':'rgba(245,158,11,0.14)'):(sel?'rgba(59,130,246,0.22)':'rgba(148,163,184,0.1)');
  for(let x=cellOf(x0);x<x1-1e-9;x=+(x+GRID).toFixed(1))
    for(let z=cellOf(z0);z<z1-1e-9;z=+(z+GRID).toFixed(1))
      fillCell(x,z,ff,null);
  if(!isRamp&&!r.open)roomWalls(r).forEach(c=>fillCell(c.x,c.z,sel?'rgba(59,130,246,0.8)':'rgba(200,210,225,0.9)',sel?'#3b82f6':'#94a3b8'));
  if(a>0.3){const[lx,ly]=W2S((x0+x1)/2,(z0+z1)/2);ctx.fillStyle='#94a3b8';ctx.font='11px system-ui';ctx.textAlign='center';
    ctx.fillText((r.nombre||r.type||'Sala')+' Y:'+(r.y||0),lx,ly);}
}

function draw(){
  ctx.fillStyle='#0f1115';ctx.fillRect(0,0,canvas.width,canvas.height);
  drawGrid();
  const byDist=(y)=>Math.abs((y||0)-activeLevel);
  const holes=[...data.holes].sort((a,b)=>byDist(b.y)-byDist(a.y));
  const rooms=[...data.rooms].sort((a,b)=>byDist(b.y)-byDist(a.y));
  const blocks=[...data.blocks].sort((a,b)=>byDist(b.y||0)-byDist(a.y||0));
  const walls=[...data.walls].sort((a,b)=>byDist(b.y||0)-byDist(a.y||0));
  const doors=[...data.doors].sort((a,b)=>byDist(b.y)-byDist(a.y));

  holes.forEach(h=>{
    const a=levelAlpha(h.y);ctx.globalAlpha=a;
    const x0=Math.min(h.x0,h.x1),x1=Math.max(h.x0,h.x1),z0=Math.min(h.z0,h.z1),z1=Math.max(h.z0,h.z1);
    const sel=selected&&selected.type==='hole'&&selected.id===h.id;
    for(let x=cellOf(x0);x<x1-1e-9;x=+(x+GRID).toFixed(1))
      for(let z=cellOf(z0);z<z1-1e-9;z=+(z+GRID).toFixed(1))
        fillCell(x,z,sel?'rgba(239,68,68,0.55)':'rgba(239,68,68,0.3)','#ef4444');
  });
  rooms.forEach(r=>{ctx.globalAlpha=levelAlpha(r.y);drawRoom(r,levelAlpha(r.y));});
  blocks.forEach(b=>{
    ctx.globalAlpha=levelAlpha(b.y||0);
    const sel=selected&&selected.type==='block'&&selected.id===b.id;
    fillCell(b.x,b.z,sel?'rgba(168,85,247,0.75)':'rgba(139,92,246,0.55)','#8b5cf6');
  });
  walls.forEach(w=>{
    ctx.globalAlpha=levelAlpha(w.y||0);
    const sel=selected&&selected.type==='wall'&&selected.id===w.id;
    Celdas.wallCells(w).forEach(c=>fillCell(c.x,c.z,sel?'rgba(59,130,246,0.85)':'rgba(96,165,250,0.7)','#60a5fa'));
  });
  doors.forEach(d=>{
    ctx.globalAlpha=levelAlpha(d.y);
    Celdas.doorCells(d).forEach(c=>fillCell(c.x,c.z,'rgba(34,197,94,0.5)','#22c55e'));
  });
  ctx.globalAlpha=1;

  if(isDraggingNew&&dragTemp){
    const xa=Math.min(dragTemp.x0,dragTemp.x1),xb=Math.max(dragTemp.x0,dragTemp.x1);
    const za=Math.min(dragTemp.z0,dragTemp.z1),zb=Math.max(dragTemp.z0,dragTemp.z1);
    const f=tool==='hueco'?'rgba(239,68,68,0.4)':'rgba(59,130,246,0.35)';
    const s=tool==='hueco'?'#ef4444':'#3b82f6';
    for(let x=cellOf(xa);x<xb-1e-9;x=+(x+GRID).toFixed(1))
      for(let z=cellOf(za);z<zb-1e-9;z=+(z+GRID).toFixed(1))fillCell(x,z,f,s);
  }
  if(isDrawingPoly&&currentPoly.length){
    ctx.beginPath();currentPoly.forEach((p,i)=>{const[px,py]=W2S(p.x+GRID/2,p.z+GRID/2);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});
    const[ex,ey]=W2S(hoverCell.x+GRID/2,hoverCell.z+GRID/2);ctx.lineTo(ex,ey);
    ctx.strokeStyle='#3b82f6';ctx.lineWidth=2;ctx.stroke();
  }
  if(isDrawingWall&&currentWall.length){
