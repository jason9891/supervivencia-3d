/** Editor v23.1 — solo celdas (completo compacto) */
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
function changeLevel(v){const n=parseFloat(v);if(!isFinite(n))return;activeLevel=n;selected=null;draw();updateStatus();}
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
  const others=data.rooms.filter(o=>o!==r&&!o.points&&(!o.type||o.type==='sala')&&!o.open&&isLevel(o.y));
  return Celdas.roomWallCells(r,others);
}
function pickAt(wx,wz){
  const cx=cellOf(wx),cz=cellOf(wz);
  for(let i=data.doors.length-1;i>=0;i--){const d=data.doors[i];if(!isLevel(d.y))continue;if(Celdas.doorCells(d).some(c=>almost(c.x,cx)&&almost(c.z,cz)))return{type:'door',id:d.id};}
  for(let i=data.blocks.length-1;i>=0;i--){const b=data.blocks[i];if(!isLevel(b.y||0))continue;if(almost(b.x,cx)&&almost(b.z,cz))return{type:'block',id:b.id};}
  for(let i=data.walls.length-1;i>=0;i--){const w=data.walls[i];if(!isLevel(w.y||0))continue;if(Celdas.wallCells(w).some(c=>almost(c.x,cx)&&almost(c.z,cz)))return{type:'wall',id:w.id};}
  for(let i=data.holes.length-1;i>=0;i--){const h=data.holes[i];if(!isLevel(h.y))continue;if(wx>=Math.min(h.x0,h.x1)&&wx<Math.max(h.x0,h.x1)&&wz>=Math.min(h.z0,h.z1)&&wz<Math.max(h.z0,h.z1))return{type:'hole',id:h.id};}
  for(let i=data.rooms.length-1;i>=0;i--){
    const r=data.rooms[i];if(!isLevel(r.y))continue;
    if(r.points){const xs=r.points.map(p=>p.x),zs=r.points.map(p=>p.z);if(wx>=Math.min(...xs)&&wx<=Math.max(...xs)+GRID&&wz>=Math.min(...zs)&&wz<=Math.max(...zs)+GRID)return{type:'room',id:r.id};continue;}
    if(wx>=Math.min(r.x0,r.x1)&&wx<Math.max(r.x0,r.x1)&&wz>=Math.min(r.z0,r.z1)&&wz<Math.max(r.z0,r.z1))return{type:'room',id:r.id};
  }
  return null;
}
function fillCell(cx,cz,fill,stroke){
  const p=Math.max(1,scale*GRID);const[bx,by]=W2S(cx,cz+GRID);
  if(fill){ctx.fillStyle=fill;ctx.fillRect(bx+.5,by+.5,p-1,p-1);}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(bx+.5,by+.5,p-1,p-1);}
}
function draw(){
  ctx.fillStyle='#0f1115';ctx.fillRect(0,0,canvas.width,canvas.height);
  const step=scale*GRID;
  if(step>=3){ctx.strokeStyle='#1a1f2a';ctx.beginPath();for(let x=offsetX%step;x<canvas.width;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);}for(let y=offsetY%step;y<canvas.height;y+=step){ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);}ctx.stroke();}
  ctx.strokeStyle='#2a3344';ctx.beginPath();for(let x=offsetX%scale;x<canvas.width;x+=scale){ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);}for(let y=offsetY%scale;y<canvas.height;y+=scale){ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);}ctx.stroke();
  ctx.strokeStyle='#475569';ctx.beginPath();ctx.moveTo(offsetX,0);ctx.lineTo(offsetX,canvas.height);ctx.moveTo(0,offsetY);ctx.lineTo(canvas.width,offsetY);ctx.stroke();
  data.holes.forEach(h=>{if(!isLevel(h.y))return;const x0=Math.min(h.x0,h.x1),x1=Math.max(h.x0,h.x1),z0=Math.min(h.z0,h.z1),z1=Math.max(h.z0,h.z1);const sel=selected&&selected.type==='hole'&&selected.id===h.id;for(let x=cellOf(x0);x<x1-1e-9;x=+(x+GRID).toFixed(1))for(let z=cellOf(z0);z<z1-1e-9;z=+(z+GRID).toFixed(1))fillCell(x,z,sel?'rgba(239,68,68,0.5)':'rgba(239,68,68,0.3)','#ef4444');});
  data.rooms.forEach(r=>{
    if(!isLevel(r.y))return;const sel=selected&&selected.type==='room'&&selected.id===r.id;
    if(r.points&&r.points.length>=3){ctx.beginPath();r.points.forEach((p,i)=>{const[px,py]=W2S(p.x+GRID/2,p.z+GRID/2);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.closePath();ctx.fillStyle=sel?'rgba(59,130,246,0.2)':'rgba(148,163,184,0.12)';ctx.fill();ctx.strokeStyle=sel?'#3b82f6':'#64748b';ctx.lineWidth=2;ctx.stroke();return;}
    if(r.x0==null)return;
    const x0=Math.min(r.x0,r.x1),x1=Math.max(r.x0,r.x1),z0=Math.min(r.z0,r.z1),z1=Math.max(r.z0,r.z1);
    const isRamp=r.type==='rampa'||r.type==='escalera';
    const ff=isRamp?(sel?'rgba(245,158,11,0.25)':'rgba(245,158,11,0.12)'):(sel?'rgba(59,130,246,0.2)':'rgba(148,163,184,0.08)');
    for(let x=cellOf(x0);x<x1-1e-9;x=+(x+GRID).toFixed(1))for(let z=cellOf(z0);z<z1-1e-9;z=+(z+GRID).toFixed(1))fillCell(x,z,ff,null);
    if(!isRamp&&!r.open)roomWalls(r).forEach(c=>fillCell(c.x,c.z,sel?'rgba(59,130,246,0.75)':'rgba(200,210,225,0.85)',sel?'#3b82f6':'#94a3b8'));
  });
  data.blocks.forEach(b=>{if(!isLevel(b.y||0))return;const sel=selected&&selected.type==='block'&&selected.id===b.id;fillCell(b.x,b.z,sel?'rgba(168,85,247,0.7)':'rgba(139,92,246,0.55)','#8b5cf6');});
  data.walls.forEach(w=>{if(!isLevel(w.y||0))return;Celdas.wallCells(w).forEach(c=>fillCell(c.x,c.z,'rgba(96,165,250,0.7)','#60a5fa'));});
  data.doors.forEach(d=>{if(!isLevel(d.y))return;Celdas.doorCells(d).forEach(c=>fillCell(c.x,c.z,'rgba(34,197,94,0.45)','#22c55e'));});
  if(isDraggingNew&&dragTemp){const xa=Math.min(dragTemp.x0,dragTemp.x1),xb=Math.max(dragTemp.x0,dragTemp.x1),za=Math.min(dragTemp.z0,dragTemp.z1),zb=Math.max(dragTemp.z0,dragTemp.z1);const f=tool==='hueco'?'rgba(239,68,68,0.4)':'rgba(59,130,246,0.35)';const s=tool==='hueco'?'#ef4444':'#3b82f6';for(let x=cellOf(xa);x<xb-1e-9;x=+(x+GRID).toFixed(1))for(let z=cellOf(za);z<zb-1e-9;z=+(z+GRID).toFixed(1))fillCell(x,z,f,s);}
  if(isDrawingPoly&&currentPoly.length){ctx.beginPath();currentPoly.forEach((p,i)=>{const[px,py]=W2S(p.x+GRID/2,p.z+GRID/2);i?ctx.lineTo(px,py):ctx.moveTo(px,py);});const[ex,ey]=W2S(hoverCell.x+GRID/2,hoverCell.z+GRID/2);ctx.lineTo(ex,ey);ctx.strokeStyle='#3b82f6';ctx.lineWidth=2;ctx.stroke();}
  if(isDrawingWall&&currentWall.length){Celdas.wallCells({points:[...currentWall,hoverCell]}).forEach(c=>fillCell(c.x,c.z,'rgba(59,130,246,0.55)','#3b82f6'));currentWall.forEach(p=>{const[px,py]=W2S(p.x+GRID/2,p.z+GRID/2);ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();});}
  fillCell(hoverCell.x,hoverCell.z,'rgba(59,130,246,0.12)','rgba(59,130,246,0.9)');
  const[gx,gy]=W2S(hoverCell.x+GRID/2,hoverCell.z+GRID/2);ctx.strokeStyle='#3b82f6';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(gx-5,gy);ctx.lineTo(gx+5,gy);ctx.moveTo(gx,gy-5);ctx.lineTo(gx,gy+5);ctx.stroke();
}
function scheduleDraw(){if(_raf)return;_raf=requestAnimationFrame(()=>{_raf=0;draw();});}
function paintBlockAt(wx,wz){
  const cx=cellOf(wx),cz=cellOf(wz);const i=data.blocks.findIndex(b=>almost(b.x,cx)&&almost(b.z,cz)&&isLevel(b.y||0));
  if(blockErase){if(i>=0){data.blocks.splice(i,1);blockChanged=true;}}
  else{const h=blockH();if(i>=0){data.blocks[i].h=h;blockChanged=true;}else{data.blocks.push({id:uid('b'),x:cx,z:cz,h,y:activeLevel});blockChanged=true;}}
  draw();
}
function placeDoorAt(wx,wz){
  const cx=cellOf(wx),cz=cellOf(wz);let ok=false,ax='z';
  if(data.walls.some(w=>isLevel(w.y||0)&&Celdas.wallCells(w).some(c=>almost(c.x,cx)&&almost(c.z,cz))))ok=true;
  const bk=data.blocks.find(b=>almost(b.x,cx)&&almost(b.z,cz)&&isLevel(b.y||0));
  if(bk){ok=true;const has=(x,z)=>data.blocks.some(o=>almost(o.x,x)&&almost(o.z,z)&&isLevel(o.y||0));const nx=(has(cx-GRID,cz)?1:0)+(has(cx+GRID,cz)?1:0);const nz=(has(cx,cz-GRID)?1:0)+(has(cx,cz+GRID)?1:0);ax=nx>=nz?'x':'z';}
  data.rooms.forEach(r=>{if(!isLevel(r.y)||r.points||r.open)return;if(roomWalls(r).some(c=>almost(c.x,cx)&&almost(c.z,cz)))ok=true;});
  if(!ok){toast('Clic sobre muro o bloque');return;}
  const dt=data.doorTypes.find(t=>t.id===data.activeDoorType)||data.doorTypes[0];
  data.doors.push({id:uid('d'),x:cx+GRID/2,z:cz+GRID/2,ax,y:activeLevel,w:dt.w,h:dt.h,sill:dt.sill||0,fw:dt.fw!=null?dt.fw:0.1,depth:dt.depth||0.5,angle:dt.angle!=null?dt.angle:72,panel:dt.panel||'single',hinge:dt.hinge||'left',swing:dt.swing||'in',tipo:dt.id});
  commit();toast('Puerta');draw();
}
container.addEventListener('mousemove',e=>{
  if(isPanning){const rect=canvas.getBoundingClientRect();const sx=rect.width?canvas.width/rect.width:1,sy=rect.height?canvas.height/rect.height:1;offsetX+=(e.clientX-panStart.x)*sx;offsetY+=(e.clientY-panStart.y)*sy;panStart={x:e.clientX,y:e.clientY};scheduleDraw();return;}
  const c=cellUnder(e);mouseWorld={x:c.wx,z:c.wz};hoverCell={x:c.x,z:c.z};
  if(hudEl)hudEl.textContent='Celda '+c.x.toFixed(1)+', '+c.z.toFixed(1)+' | Zoom '+Math.round(scale*10)+'%';
  if(paintingBlocks)paintBlockAt(c.wx,c.wz);
  if(isDraggingNew&&dragTemp){dragTemp.x1=c.x+GRID;dragTemp.z1=c.z+GRID;}
  if(isMovingExisting&&moveOrig&&selected){
    const dx=cellOf(c.wx)-cellOf(moveStart.x),dz=cellOf(c.wz)-cellOf(moveStart.z);const obj=getObj();
    if(obj&&moveOrig){if(obj.x0!=null){obj.x0=moveOrig.x0+dx;obj.x1=moveOrig.x1+dx;obj.z0=moveOrig.z0+dz;obj.z1=moveOrig.z1+dz;}if(obj.x!=null&&selected.type==='block'){obj.x=moveOrig.x+dx;obj.z=moveOrig.z+dz;}if(obj.points)obj.points=moveOrig.points.map(p=>({x:p.x+dx,z:p.z+dz}));if(selected.type==='door'){obj.x=moveOrig.x+dx;obj.z=moveOrig.z+dz;}}
  }
  scheduleDraw();
});
function getObj(){if(!selected)return null;const m={room:data.rooms,wall:data.walls,door:data.doors,hole:data.holes,block:data.blocks};const a=m[selected.type];return a?a.find(x=>x.id===selected.id):null;}
container.addEventListener('mousedown',e=>{
  if(e.button===1||e.button===2||spacePressed){isPanning=true;panStart={x:e.clientX,y:e.clientY};return;}
  if(e.button!==0)return;const c=cellUnder(e);hoverCell={x:c.x,z:c.z};
  if(tool==='sel'||e.ctrlKey){const hit=pickAt(c.wx,c.wz);if(hit){selected=hit;isMovingExisting=true;moveStart={x:c.wx,z:c.wz};moveOrig=deep(getObj());if(el('btn-del-sel'))el('btn-del-sel').style.display='inline-block';draw();return;}selected=null;if(el('btn-del-sel'))el('btn-del-sel').style.display='none';draw();return;}
  if(tool==='poly'){if(!isDrawingPoly){isDrawingPoly=true;currentPoly=[];if(el('btn-finish'))el('btn-finish').style.display='inline-block';}currentPoly.push({x:c.x,z:c.z});draw();return;}
  if(tool==='bloque'){paintingBlocks=true;blockErase=e.shiftKey;blockChanged=false;paintBlockAt(c.wx,c.wz);return;}
  if(tool==='pared'){if(!isDrawingWall){isDrawingWall=true;currentWall=[];if(el('btn-finish'))el('btn-finish').style.display='inline-block';}if(currentWall.length>=3&&almost(c.x,currentWall[0].x)&&almost(c.z,currentWall[0].z)){finishDraw(true);return;}currentWall.push({x:c.x,z:c.z});draw();return;}
  if(tool==='sala'||tool==='rampa'||tool==='escalera'||tool==='hueco'){isDraggingNew=true;dragTemp={x0:c.x,z0:c.z,x1:c.x+GRID,z1:c.z+GRID};draw();return;}
  if(tool==='puerta'){placeDoorAt(c.wx,c.wz);return;}
  if(tool==='borrar'){const hit=pickAt(c.wx,c.wz);if(hit){selected=hit;deleteSelected();}else{const i=data.blocks.findIndex(b=>almost(b.x,c.x)&&almost(b.z,c.z)&&isLevel(b.y||0));if(i>=0){data.blocks.splice(i,1);commit();draw();}}}
});
container.addEventListener('mouseup',()=>{
  if(isPanning){isPanning=false;return;}
  if(paintingBlocks){paintingBlocks=false;if(blockChanged)commit();return;}
  if(isMovingExisting){isMovingExisting=false;moveOrig=null;commit();return;}
  if(!isDraggingNew||!dragTemp)return;isDraggingNew=false;
  const x0=cellOf(Math.min(dragTemp.x0,dragTemp.x1)),x1=+Math.max(dragTemp.x0,dragTemp.x1).toFixed(1);
  const z0=cellOf(Math.min(dragTemp.z0,dragTemp.z1)),z1=+Math.max(dragTemp.z0,dragTemp.z1).toFixed(1);dragTemp=null;
  if(x1-x0<GRID-1e-6||z1-z0<GRID-1e-6){draw();return;}
  if(tool==='sala'){data.rooms.push({id:uid('r'),nombre:'Sala',x0,x1,z0,z1,type:'sala',y:activeLevel,open:false});commit();toast('Sala');}
  else if(tool==='hueco'){data.holes.push({id:uid('h'),x0,x1,z0,z1,y:activeLevel});commit();toast('Hueco');}
  else if(tool==='rampa'||tool==='escalera'){data.rooms.push({id:uid('r'),nombre:tool==='rampa'?'Rampa':'Escalera',x0,x1,z0,z1,type:tool,y:activeLevel,y2:activeLevel+3,dir:'+x',open:false});commit();toast(tool);}
  draw();
});
function finishDraw(close){
  let ch=false;
  if(isDrawingPoly){if(currentPoly.length>=3){data.rooms.push({id:uid('poly'),nombre:'Patio Libre',type:'patio',open:true,points:currentPoly.map(p=>({x:p.x,z:p.z})),y:activeLevel});ch=true;toast('Patio');}isDrawingPoly=false;currentPoly=[];}
  if(isDrawingWall){if(currentWall.length>=2){const pts=currentWall.map(p=>({x:p.x+GRID/2,z:p.z+GRID/2}));const w={id:uid('w'),points:pts,h:blockH(),y:activeLevel};if(close&&pts.length>=3)w.closed=true;data.walls.push(w);ch=true;toast('Muro');}isDrawingWall=false;currentWall=[];}
  if(el('btn-finish'))el('btn-finish').style.display='none';draw();if(ch)commit();
}
function cancelDraw(){isDrawingPoly=false;currentPoly=[];isDrawingWall=false;currentWall=[];if(el('btn-finish'))el('btn-finish').style.display='none';}
function deleteSelected(){if(!selected)return;const m={room:data.rooms,wall:data.walls,door:data.doors,hole:data.holes,block:data.blocks};const a=m[selected.type];if(a){const i=a.findIndex(x=>x.id===selected.id);if(i>=0)a.splice(i,1);}selected=null;if(el('btn-del-sel'))el('btn-del-sel').style.display='none';commit();draw();toast('Eliminado');}
function newMap(){if(!confirm('¿Borrar todo?'))return;data={rooms:[],walls:[],doors:[],holes:[],blocks:[],doorTypes:data.doorTypes,activeDoorType:data.activeDoorType};selected=null;commit();draw();}
function exportJSON(){navigator.clipboard.writeText(JSON.stringify(data,null,2)).then(()=>toast('JSON copiado')).catch(()=>toast('Error'));}
function downloadJSON(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='mapa.json';a.click();}
function importJSON(input){const f=input.files&&input.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);normalizeData();selected=null;commit();draw();toast('Importado');}catch(_){toast('JSON inválido');}};r.readAsText(f);input.value='';}
function openDoorDesigner(){toast('Tipos de puerta en JSON (doorTypes)');}
window.addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();spacePressed=true;}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();redo();}
  if(e.key==='Enter'&&(isDrawingWall||isDrawingPoly))finishDraw();
  if(e.key==='Escape'){cancelDraw();selected=null;draw();}
  if((e.key==='Delete'||e.key==='Backspace')&&selected&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();deleteSelected();}
});
window.addEventListener('keyup',e=>{if(e.code==='Space')spacePressed=false;});
container.addEventListener('wheel',e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();const sx=rect.width?canvas.width/rect.width:1,sy=rect.height?canvas.height/rect.height:1;const mx=(e.clientX-rect.left)*sx,my=(e.clientY-rect.top)*sy;const f=e.deltaY<0?1.1:0.9;const ns=Math.max(10,Math.min(200,scale*f));offsetX=mx-(mx-offsetX)*(ns/scale);offsetY=my-(my-offsetY)*(ns/scale);scale=ns;scheduleDraw();},{passive:false});
container.addEventListener('contextmenu',e=>e.preventDefault());
try{const raw=localStorage.getItem(LS_KEY);if(raw)data=JSON.parse(raw);}catch(_){}
normalizeData();hist=[JSON.stringify(data)];histIdx=0;resize();setTool('sala');
console.log('Editor v23.1 — solo celdas (completo)');
