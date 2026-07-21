'use strict';
/* =============================== СОСТОЯНИЕ ============================== */
const LS={get:(k,d)=>{try{const v=localStorage.getItem('physim.'+k);return v?JSON.parse(v):d}catch{return d}},
          set:(k,v)=>{try{localStorage.setItem('physim.'+k,JSON.stringify(v))}catch{}}};
const RT={};
const S={topic:null,tab:'notes',active:null,playing:false,tool:'pan',markMode:false,graphOn:true,rec:null,speed:1,
  snap:LS.get('snap',true), marks:LS.get('marks',[]), open:LS.get('open',['intro','mech']),
  settings:LS.get('settings',{theme:'light',fs:12,quality:'high',bgPause:true,videoQ:'med',nums:true,hud:true,events:true,energy:true})};

function rt(id){
  if(!RT[id]){
    const def=SIMS[id];
    const params={};
    for(const p of def.params) if(p.type!=='group') params[p.key]=p.default;
    RT[id]={def,params,state:def.init(params),view:{...def.fit(params,{W:CW,H:CH})},
            hist:[],tick:0,annos:[],draft:null,undo:[JSON.stringify(params)],redo:[]};
  }
  return RT[id];
}
const A=()=>S.active?RT[S.active]:null;

/* ================================ ХОЛСТЫ =============================== */
const scene=$('#scene'), overlay=$('#overlay');
const sctx=scene.getContext('2d'), octx=overlay.getContext('2d');
let CW=0,CH=0,DPR=1, gcanvas=[];
function resize(){
  const r=$('#cwrap').getBoundingClientRect();
  DPR=S.settings.quality==='low'?1:Math.min(devicePixelRatio||1,S.settings.quality==='high'?2:1.5);
  CW=r.width; CH=r.height;
  for(const c of [scene,overlay]){ c.width=Math.max(1,CW*DPR); c.height=Math.max(1,CH*DPR); }
  for(const c of gcanvas){ const b=c.getBoundingClientRect();
    c.width=Math.max(1,b.width*DPR); c.height=Math.max(1,b.height*DPR); }
}
let _rzPending=false;
new ResizeObserver(()=>{                       // rAF-обёртка гасит «ResizeObserver loop»
  if(_rzPending) return;
  _rzPending=true;
  requestAnimationFrame(()=>{ _rzPending=false; resize(); });
}).observe($('#cwrap'));

const ppm=()=>PX_PER_M*(A()?A().view.scale:1);
const toScreen=(x,y)=>{const v=A().view; return [(x-v.x)*ppm()+CW/2, -(y-v.y)*ppm()+CH/2];};
const toWorld=(px,py)=>{const v=A().view; return [(px-CW/2)/ppm()+v.x, -(py-CH/2)/ppm()+v.y];};
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const VIEW={
  get quality(){return S.settings.quality}, c:css,
  lw:px=>px*(S.settings.lineW||1)/ppm(),
  label(ctx,text,wx,wy,dx=0,dy=0,color){
    if(S.settings.nums===false){                       // режим «без чисел»
      text=String(text).replace(/=\s*[-+]?[\d.,]+(?:e[-+]?\d+)?\s*[^\s,;]*/gi,'')
                       .replace(/\s{2,}/g,' ').trim();
      if(!text) return;
    }
    const [sx,sy]=toScreen(wx,wy);
    ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle=color||css('--ink-2'); ctx.font='11px ui-monospace,monospace'; ctx.textBaseline='middle';
    ctx.fillText(text,sx+dx,sy+dy); ctx.restore();
  },
  /* ---- Диаграмма свободного тела (рис. 4-10 у Орира) ----
     o = { x, y,                      точка приложения (центр тела)
           forces:[{fx,fy,label,color?}],   силы в ньютонах
           len,                       длина самой большой стрелки в метрах сцены
           resultant:true|false,      рисовать ли F_рез
           sum:{x,y}|null,            где строить треугольник (многоугольник) сил
           units:'Н' }                                                              */
  fbd(ctx,o){
    const F=o.forces.filter(f=>Math.hypot(f.fx,f.fy)>1e-9);
    if(!F.length) return {k:1,rx:0,ry:0};
    const maxF=Math.max(...F.map(f=>Math.hypot(f.fx,f.fy)));
    const k=(o.len||2)/maxF;                       // метров сцены на ньютон
    const u=o.units||'Н';
    const rx=F.reduce((a,f)=>a+f.fx,0), ry=F.reduce((a,f)=>a+f.fy,0);
    for(const f of F){
      const c=f.color||this.c('--ink-2');
      this.arrow(ctx,o.x,o.y,o.x+f.fx*k,o.y+f.fy*k,c);
      const m=Math.hypot(f.fx,f.fy);
      this.label(ctx,`${f.label} = ${m.toFixed(1)} ${u}`,o.x+f.fx*k,o.y+f.fy*k,
        f.fx>=0?8:-8-String(f.label).length*7, f.fy>=0?-10:12, c);
    }
    if(o.resultant!==false && Math.hypot(rx,ry)>1e-6){
      ctx.save(); ctx.setLineDash([this.lw(5),this.lw(4)]);
      this.arrow(ctx,o.x,o.y,o.x+rx*k,o.y+ry*k,this.c('--danger'));
      ctx.restore();
      this.label(ctx,`F рез = ${Math.hypot(rx,ry).toFixed(1)} ${u}`,
        o.x+rx*k,o.y+ry*k,8,12,this.c('--danger'));
    }
    if(o.sum){                                     // правило многоугольника: хвост к концу
      let px=o.sum.x, py=o.sum.y;
      ctx.save(); ctx.globalAlpha=.9;
      for(const f of F){
        const c=f.color||this.c('--ink-2');
        this.arrow(ctx,px,py,px+f.fx*k,py+f.fy*k,c);
        px+=f.fx*k; py+=f.fy*k;
      }
      ctx.restore();
      if(Math.hypot(rx,ry)>1e-6){
        ctx.save(); ctx.setLineDash([this.lw(5),this.lw(4)]);
        this.arrow(ctx,o.sum.x,o.sum.y,o.sum.x+rx*k,o.sum.y+ry*k,this.c('--danger'));
        ctx.restore();
      } else {
        this.label(ctx,'F рез = 0',o.sum.x,o.sum.y,10,-10,this.c('--danger'));
      }
      this.label(ctx,'сумма сил',o.sum.x,o.sum.y,-30,16,this.c('--ink-3'));
    }
    return {k,rx,ry};
  },
  arrow(ctx,x1,y1,x2,y2,color){
    const L=Math.hypot(x2-x1,y2-y1); if(L<1e-9) return;
    const a=Math.atan2(y2-y1,x2-x1), h=Math.min(L*0.35,this.lw(9));
    ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=this.lw(1.8);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2,y2);
    ctx.lineTo(x2-h*Math.cos(a-0.42),y2-h*Math.sin(a-0.42));
    ctx.lineTo(x2-h*Math.cos(a+0.42),y2-h*Math.sin(a+0.42));
    ctx.closePath(); ctx.fill();
  },
  /* Дуговая стрелка момента силы вокруг точки (cx,cy).
     dir > 0 — против часовой, dir < 0 — по часовой. r — радиус дуги (в метрах). */
  torqueArc(ctx,cx,cy,r,dir,color){
    if(Math.abs(dir)<1e-9) return;
    const ccw=dir>0;
    const a0=ccw?-0.5:0.5, a1=ccw?3.9:-3.9;         // ~250° дуга
    ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=this.lw(2.2);
    ctx.beginPath(); ctx.arc(cx,cy,r,a0,a1,ccw); ctx.stroke();
    // наконечник на конце дуги
    const ea=a1, tx=cx+r*Math.cos(ea), ty=cy+r*Math.sin(ea);
    const tang=ea+(ccw?Math.PI/2:-Math.PI/2);        // касательная (направление хода)
    const h=this.lw(9);
    ctx.beginPath(); ctx.moveTo(tx,ty);
    ctx.lineTo(tx-h*Math.cos(tang-0.42),ty-h*Math.sin(tang-0.42));
    ctx.lineTo(tx-h*Math.cos(tang+0.42),ty-h*Math.sin(tang+0.42));
    ctx.closePath(); ctx.fill();
  },
  /* Маркер вектора, перпендикулярного экрану:
     out=true — «на нас» (точка ⊙), out=false — «от нас» (крестик ⊗). */
  outOfPlane(ctx,x,y,out,color,rr){
    const r=rr||this.lw(7);
    ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=this.lw(1.6);
    ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.stroke();
    if(out){ ctx.beginPath(); ctx.arc(x,y,r*0.28,0,7); ctx.fill(); }        // точка внутри
    else {                                                                  // крестик внутри
      const d=r*0.62;
      ctx.beginPath();
      ctx.moveTo(x-d,y-d); ctx.lineTo(x+d,y+d);
      ctx.moveTo(x-d,y+d); ctx.lineTo(x+d,y-d); ctx.stroke();
    }
  }
};
function gridStep(){
  const k=ppm(); let s=1;
  while(s*k<42) s*=(String(s)[0]==='1'?2.5:2);
  while(s*k>130) s/=(String(s)[0]==='1'?2:2.5);
  return s;
}
function applyWorld(ctx){
  const v=A().view, k=ppm();
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,CW,CH);
  ctx.setTransform(k*DPR,0,0,-k*DPR,(CW/2-v.x*k)*DPR,(CH/2+v.y*k)*DPR);
}
function drawGrid(ctx){
  const k=ppm(), step=gridStep();
  const [x0,y1]=toWorld(0,0), [x1,y0]=toWorld(CW,CH);
  ctx.lineWidth=1/k;
  const minor=S.settings.quality==='high';
  for(let i=Math.floor(x0/step)*step;i<=x1;i+=step){
    const maj=Math.abs(i%(step*5))<step/9; if(!minor&&!maj) continue;
    ctx.strokeStyle=maj?css('--grid-major'):css('--grid');
    ctx.beginPath(); ctx.moveTo(i,y0); ctx.lineTo(i,y1); ctx.stroke();
  }
  for(let j=Math.floor(y0/step)*step;j<=y1;j+=step){
    const maj=Math.abs(j%(step*5))<step/9; if(!minor&&!maj) continue;
    ctx.strokeStyle=maj?css('--grid-major'):css('--grid');
    ctx.beginPath(); ctx.moveTo(x0,j); ctx.lineTo(x1,j); ctx.stroke();
  }
  VIEW.label(ctx,`сетка ${step} м`,x1,y0,-80,-10,css('--ink-3'));
}
const fmt=v=>{
  if(!isFinite(v)) return '—';
  return (Math.abs(v)>=1e4||(Math.abs(v)<0.01&&v!==0))?(+v).toExponential(2):(+v).toFixed(2);
};

function drawAll(){
  const a=A(); if(!a) return;
  applyWorld(sctx);
  if(S.settings.grid!==false) drawGrid(sctx);
  /* Сцену рисуем в собственном состоянии холста. Внутри draw бывают ранние
     выходы (например, соленоид рисуется и сразу return), и если там осталась
     непогашенной прозрачность или пунктир, они протекли бы в слой пометок
     и в следующий кадр. save/restore закрывает это раз и навсегда. */
  sctx.save();
  sctx.globalAlpha=1; sctx.setLineDash(EMPTY_DASH); sctx.lineWidth=1;
  try{ a.def.draw(sctx,a.state,VIEW,a.params); }
  finally{ sctx.restore(); }
  applyWorld(octx);
  const list=a.draft?a.annos.concat([a.draft]):a.annos;
  for(const an of list){
    if(an.type==='pencil'){
      octx.strokeStyle=css('--danger'); octx.lineWidth=VIEW.lw(2); octx.lineJoin='round';
      octx.beginPath(); an.pts.forEach((q,i)=>i?octx.lineTo(q[0],q[1]):octx.moveTo(q[0],q[1])); octx.stroke();
    } else if(an.type==='ruler'){
      const [x1,y1,x2,y2]=an.p, d=Math.hypot(x2-x1,y2-y1);
      octx.strokeStyle=css('--measure'); octx.lineWidth=VIEW.lw(1.4);
      octx.beginPath(); octx.moveTo(x1,y1); octx.lineTo(x2,y2); octx.stroke();
      VIEW.label(octx,`${d.toFixed(2)} м`,(x1+x2)/2,(y1+y2)/2,6,-8,css('--measure'));
    } else if(an.type==='vector'){
      const [x1,y1,x2,y2]=an.p;
      VIEW.arrow(octx,x1,y1,x2,y2,css('--accent'));
      VIEW.label(octx,`${Math.hypot(x2-x1,y2-y1).toFixed(2)} ∠${(Math.atan2(y2-y1,x2-x1)*180/Math.PI).toFixed(0)}°`,x2,y2,8,-8,css('--accent'));
    }
  }
  if(S.snap&&S.tool!=='pan'){
    octx.fillStyle=css('--measure'); octx.globalAlpha=.7;
    for(const an of (a.def.anchors?a.def.anchors(a.state,a.params):[])){
      octx.beginPath(); octx.arc(an.x,an.y,VIEW.lw(3.5),0,7); octx.fill();
    }
    octx.globalAlpha=1;
  }
  updateEnergyBox(a);
  $('#btn-makeout').style.display = a.def.makeOutput ? '' : 'none';
  updateHistoBox(a);
  updatePVBox(a);
  const w=a.def.warn?a.def.warn(a.params,a.state):null;
  const wb=$('#warnbar');
  const showW = w && S.settings.events!==false;
  if((showW?w:'')!==wb.dataset.msg){ wb.dataset.msg=showW?w:''; wb.textContent=showW?w:''; wb.classList.toggle('hidden',!showW); }
  $('#hud').textContent=a.def.readouts(a.state,a.params)
    .map(([l,v,u])=>`${l.padEnd(14)} ${fmt(v).padStart(9)} ${u}`).join('\n');
  $('#clock').textContent=`t = ${a.state.t.toFixed(2)} c`;
}

/* ------------------------------- ГРАФИКИ -------------------------------- */
function buildGraphs(){
  const box=$('#gbox'), a=A(); box.innerHTML=''; gcanvas=[];
  if(!a||!a.def.graphs) return;
  a.def.graphs.forEach((g,i)=>{
    const two=a.params.bodies==='2';
    const names=g.series||['тело 1','тело 2'];
    const show2 = g.series ? (g.series.length>1) : two;
    const t=document.createElement('div'); t.className='gtitle';
    t.innerHTML=`<span>${g.label}, ${g.unit}</span>
      <span class="lg"><span class="sw" style="background:var(--accent)"></span>${names[0]}</span>
      ${show2?`<span class="lg"><span class="sw" style="background:var(--second)"></span>${names[1]}</span>`:''}`;
    const c=document.createElement('canvas');
    box.append(t,c); gcanvas.push(c);
  });
  requestAnimationFrame(resize);
}
function drawGraphs(){
  const a=A(); if(!a||!S.graphOn||!gcanvas.length) return;
  if(S.settings.graphs===false) return;
  const H=a.hist; if(H.length<2) return;
  const tMax=Math.max(H[H.length-1].t,1e-3);
  a.def.graphs.forEach((g,gi)=>{
    const cv=gcanvas[gi], ctx=cv.getContext('2d');
    const W=cv.width/DPR, Hh=cv.height/DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,Hh);
    let lo=Infinity,hi=-Infinity;
    for(const h of H) for(const y of h.v[gi]) if(y!==null&&isFinite(y)){ if(y<lo)lo=y; if(y>hi)hi=y; }
    if(!isFinite(lo)) return;
    if(hi-lo<1e-6){ hi+=1; lo-=1; }
    const pad=(hi-lo)*0.15; lo-=pad; hi+=pad;
    const X=t=>t/tMax*(W-4)+2, Y=y=>Hh-4-(y-lo)/(hi-lo)*(Hh-8);
    if(lo<0&&hi>0){ ctx.strokeStyle=css('--line'); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,Y(0)); ctx.lineTo(W,Y(0)); ctx.stroke(); }
    for(let s=0;s<2;s++){
      if(H[H.length-1].v[gi][s]===null) continue;
      ctx.strokeStyle=s?css('--second'):css('--accent'); ctx.lineWidth=1.6;
      if(s) ctx.setLineDash([4,3]);
      ctx.beginPath();
      let started=false;
      for(const h of H){ const y=h.v[gi][s]; if(y===null||!isFinite(y)) continue;
        started?ctx.lineTo(X(h.t),Y(y)):ctx.moveTo(X(h.t),Y(y)); started=true; }
      ctx.stroke(); ctx.setLineDash([]);
    }
    const ev=a.state.event;
    if(ev){
      ctx.strokeStyle=css('--measure'); ctx.lineWidth=1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(X(ev.t),0); ctx.lineTo(X(ev.t),Hh); ctx.stroke(); ctx.setLineDash([]);
      if(gi===0&&ev.type==='meet'){
        ctx.fillStyle=css('--measure'); ctx.beginPath(); ctx.arc(X(ev.t),Y(ev.x),3.5,0,7); ctx.fill();
      }
    }
    ctx.fillStyle=css('--ink-3'); ctx.font='9px ui-monospace,monospace';
    ctx.fillText(fmt(hi),3,9); ctx.fillText(fmt(lo),3,Hh-3);
    ctx.fillText(`t=${tMax.toFixed(1)} c`,W-52,Hh-3);
  });
}

/* ================================= ЦИКЛ ================================= */
let acc=0,last=performance.now(),frames=0,fpsT=last;
let frameAcc=0;
function loop(now){
  const raw=(now-last)/1000; last=now;
  /* Ограничение частоты кадров. Физика идёт своим фиксированным шагом,
     поэтому реже рисуем — но считаем ровно так же точно. */
  const cap=+(S.settings.fps||0);
  if(cap>0){
    frameAcc+=raw;
    if(frameAcc<1/cap-1e-4){ requestAnimationFrame(loop); return; }
    frameAcc=0;
  }
  const a=A();
  const idle=S.settings.bgPause&&(document.hidden||$('#simpane').classList.contains('hidden'));
  if(a&&S.playing&&!idle){
    acc+=Math.min(raw,0.05)*S.speed;                       // ускорение/замедление времени
    const budget=Math.ceil(1200*Math.max(1,S.speed));      // шагов за кадр
    let g=0;
    while(acc>=DT&&g++<budget&&S.playing){
      a.def.step(a.state,DT,a.params); acc-=DT;
      if(++a.tick%6===0) record(a);
      if(a.state.__stop){
        const ty=a.state.event&&a.state.event.type;
        a.state.done=a.state.done||{};
        if(a.state.done[ty]){ a.state.__stop=null; a.state.event=null; continue; }  // уже показывали
        a.state.done[ty]=true; record(a); stopEvent(a); break;
      }
    }
  }
  if(a&&!idle){ drawAll(); drawGraphs(); }
  frames++;
  if(now-fpsT>800){ $('#fps').textContent=Math.round(frames/((now-fpsT)/1000))+' fps'; frames=0; fpsT=now; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function bodyPoints(a){                                   // где центры тел (для триггера)
  const an=a.def.anchors?a.def.anchors(a.state,a.params):[];
  // используем именно позиции тел: они всегда среди anchors; берём все
  return an;
}
function updatePVBox(a){
  const box=$('#pvbox');
  const isCarnot=a.def===SIMS.carnot;
  if(a.def!==SIMS.thermo && !isCarnot){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  $('#pvbox').querySelector('.pvhead b').textContent = isCarnot?'Цикл Карно':'PV-диаграмма';
  const T=a.def, p=a.params, s=a.state;
  const fmax=isCarnot?4:1, fstep=isCarnot?0.05:0.02;
  // диапазоны
  let Pmin=1e18,Pmax=-1e18,Vmin=1e18,Vmax=-1e18;
  for(let u=0;u<=fmax;u+=fstep){ const st=T.stateAt(p,u); Pmin=Math.min(Pmin,st.P);Pmax=Math.max(Pmax,st.P);Vmin=Math.min(Vmin,st.V);Vmax=Math.max(Vmax,st.V); }
  if(!isCarnot && p.proc==='isochor'){ Vmin=p.V0-2; Vmax=p.V0+2; }
  const pd=(Pmax-Pmin)*0.12||Pmax*0.1; Pmin=Math.max(0,Pmin-pd); Pmax+=pd;
  const vd=(Vmax-Vmin)*0.1||1; Vmin=Math.max(0,Vmin-vd); Vmax+=vd;
  const W=300,H=210,mL=12,mB=20;
  const X=V=>clamp(mL+((V-Vmin)/(Vmax-Vmin))*(W-mL-6), mL, W-4);
  const Y=P=>clamp((H-mB)-((P-Pmin)/(Pmax-Pmin))*(H-mB-6), 6, H-mB);
  const CY=y=>Math.max(6,Math.min(H-mB,y)).toFixed(1);   // зажим по вертикали
  const CX=x=>Math.max(mL,Math.min(W-4,x)).toFixed(1);   // зажим по горизонтали
  const cur=isCarnot?s.f:s.u;
  const st=T.stateAt(p,cur);
  // путь кривой (для Карно — вся замкнутая петля)
  let path=''; for(let u=0;u<=fmax+1e-9;u+=fstep){ const q=T.stateAt(p,u); path+=(u===0?'M':'L')+CX(X(q.V))+' '+CY(Y(q.P))+' '; }
  if(isCarnot) path+='Z';
  // площадь
  let area='';
  if(isCarnot && p.showArea){
    area='M'; for(let u=0;u<=fmax+1e-9;u+=fstep){ const q=T.stateAt(p,u); area+=X(q.V).toFixed(1)+' '+Y(q.P).toFixed(1)+' L'; }
    area=area.slice(0,-1)+'Z';
  } else if(!isCarnot && p.proc!=='isochor' && p.showWork!==false){
    const base=(H-mB);                       // основание — ось V, а не Y(0)
    area='M'+X(p.V0).toFixed(1)+' '+base+' ';
    for(let u=0;u<=s.u+1e-9;u+=0.02){ const q=T.stateAt(p,u); area+='L'+X(q.V).toFixed(1)+' '+CY(Y(q.P))+' '; }
    area+='L'+X(st.V).toFixed(1)+' '+base+' Z';
  }
  let nm, rows;
  if(isCarnot){
    const pf=T.perf(p);
    nm='цикл Карно (2 изотермы + 2 адиабаты)';
    rows=`<div class="pvrow"><span>T₁ / T₂</span><span>${p.T1}/${p.T2} K</span></div>`+
         `<div class="pvrow"><span>Q₁ нагрев.</span><span>${pf.Q1.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>Q₂ холод.</span><span>${pf.Q2.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>работа/цикл</span><span>${pf.W.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>КПД 1−T₂/T₁</span><span>${(pf.eff*100).toFixed(1)}%</span></div>`;
  } else {
    const W_=T.workTo(p,s.u), dU=p.proc==='iso'?0:(3/2)*p.n*8.314*(st.T-p.T0), Q=dU+W_;
    nm={iso:'изотерма PV=const',isobar:'изобара P=const',isochor:'изохора V=const',adiab:'адиабата PVᵞ=const'}[p.proc];
    rows=`<div class="pvrow"><span>V</span><span>${st.V.toFixed(1)} л</span></div>`+
         `<div class="pvrow"><span>P</span><span>${(st.P/1000).toFixed(0)} кПа</span></div>`+
         `<div class="pvrow"><span>T</span><span>${st.T.toFixed(0)} K</span></div>`+
         `<div class="pvrow"><span>работа W</span><span>${W_.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>ΔU</span><span>${dU.toFixed(0)} Дж</span></div>`+
         `<div class="pvrow"><span>Q = ΔU+W</span><span>${Q.toFixed(0)} Дж</span></div>`;
  }
  // деления и подписи осей
  const nT=4; let ticks='';
  for(let i=0;i<=nT;i++){
    const Vv=Vmin+(Vmax-Vmin)*i/nT, Pv=Pmin+(Pmax-Pmin)*i/nT;
    const xx=X(Vv), yy=Y(Pv);
    // ось V (снизу)
    ticks+=`<line x1="${xx.toFixed(1)}" y1="${H-mB}" x2="${xx.toFixed(1)}" y2="${H-mB+3}" stroke="var(--ink-3)" stroke-width="1"/>`+
           `<text x="${xx.toFixed(1)}" y="${H-3}" font-size="10" fill="var(--ink-3)" text-anchor="middle">${Vv.toFixed(0)}</text>`;
    // ось P (слева)
    if(i>0) ticks+=`<line x1="${mL-3}" y1="${yy.toFixed(1)}" x2="${mL}" y2="${yy.toFixed(1)}" stroke="var(--ink-3)" stroke-width="1"/>`+
           `<text x="${mL+2}" y="${(yy-2).toFixed(1)}" font-size="10" fill="var(--ink-3)">${(Pv/1000).toFixed(0)}</text>`;
  }
  $('#pvbody').innerHTML=
    `<svg viewBox="0 0 ${W} ${H}">`+
    `<defs><clipPath id="pvclip"><rect x="${mL}" y="6" width="${W-mL-4}" height="${H-mB-6}"/></clipPath></defs>`+
    `<line x1="${mL}" y1="6" x2="${mL}" y2="${H-mB}" stroke="var(--ink-3)" stroke-width="1"/>`+
    `<line x1="${mL}" y1="${H-mB}" x2="${W-4}" y2="${H-mB}" stroke="var(--ink-3)" stroke-width="1"/>`+
    ticks+
    `<text x="${mL+3}" y="12" font-size="11" fill="var(--ink-2)">P, кПа</text>`+
    `<text x="${W-30}" y="${H-4}" font-size="11" fill="var(--ink-2)">V, л</text>`+
    `<g clip-path="url(#pvclip)">`+
    (area?`<path d="${area}" fill="var(--accent)" opacity="0.16"/>`:'')+
    `<path d="${path}" fill="none" stroke="var(--second)" stroke-width="2"/>`+
    `<circle cx="${CX(X(st.V))}" cy="${CY(Y(st.P))}" r="4.5" fill="var(--measure)"/>`+
    `</g>`+
    (isCarnot?(()=>{
      const pt=T.points(p);
      const verts=[['A',pt.VA*1000,pt.PA],['B',pt.VB*1000,pt.PB],['C',pt.VC*1000,pt.PC],['D',pt.VD*1000,pt.PD]];
      return verts.map(([lab,Vv,Pv])=>{
        const xx=X(Vv).toFixed(1), yy=Y(Pv).toFixed(1);
        return `<circle cx="${xx}" cy="${yy}" r="3.4" fill="var(--ink)"/>`+
               `<text x="${(+xx+4).toFixed(1)}" y="${(+yy-3).toFixed(1)}" font-size="12" font-weight="600" fill="var(--ink)">${lab}</text>`;
      }).join('');
    })():'')+
    `</svg>`+
    `<div class="pvrow"><span>${nm}</span><span></span></div>`+rows;
}
function updateHistoBox(a){
  const box=$('#histobox');
  if(a.def!==SIMS.gas || a.params.histo===false){ box.classList.add('hidden'); return; }
  const p=a.params, s=a.state;
  const M=a.def.measure(s,p), vr=M.vrms||1, bins=16, cnt=new Array(bins).fill(0), vmax=vr*2.6||1;
  for(const m of s.mol){ const sp=Math.hypot(m.vx,m.vy); const bi=Math.min(bins-1,Math.floor(sp/vmax*bins)); cnt[bi]++; }
  const maxC=Math.max(...cnt,1);
  box.innerHTML=`<div class="htitle">распределение по скоростям (Максвелл)</div>`+
    `<div class="hbars">`+cnt.map(c=>`<div class="hb" style="height:${(c/maxC*100).toFixed(0)}%"></div>`).join('')+`</div>`+
    `<div class="hx">медленные ← v → быстрые</div>`;
  box.classList.remove('hidden');
}
function updateEnergyBox(a){
  const box=$('#energybox');
  if(!a.def.energies || S.settings.energy===false){ box.classList.add('hidden'); return; }
  const E=a.def.energies(a.state,a.params), p=a.params;
  const bars=[['E_кин',E.Ek,'var(--accent)']];
  // вторую полоску подбираем по тому, какая форма энергии активна
  if(E.Eel>1e-9 || p.mode==='spring' || p.exp==='spring' || p.kind==='spring')
    bars.push(['E_упр',E.Eel,'var(--second)']);
  else if(E.Eth>1e-9 || p.mode==='fric' || p.exp==='collide')
    bars.push(['тепло',E.Eth,'var(--danger)']);
  else if(Math.abs(E.Ep)>1e-9 || p.mode==='hill' || p.exp==='orbit' || p.kind==='pend' || p.kind==='phys')
    bars.push(['E_пот',E.Ep,'var(--second)']);
  const tot=Math.max(E.tot, a.state.E0||E.tot, 1e-6);
  box.innerHTML=`<div class="tot">полная<br>${E.tot.toFixed(0)} Дж</div>`+
    bars.map(([lab,val,col])=>`<div class="ebar">
      <div class="val">${val.toFixed(0)}</div>
      <div class="track"><div class="fill" style="height:${(Math.abs(val)/tot*100).toFixed(1)}%;background:${col}"></div></div>
      <div class="lab">${lab}</div></div>`).join('');
  box.classList.remove('hidden');
}
function record(a){
  if(!a.def.graphs) return;
  a.hist.push({t:a.state.t, v:a.def.graphs.map(g=>g.get(a.state,a.params))});
  if(a.hist.length>4000) a.hist.shift();
}
function stopEvent(a){
  const msg=a.state.__stop; a.state.__stop=null; acc=0;
  S.playing=false; setPlayIcon();
  const f=$('#eventflag'); f.textContent=msg; f.classList.remove('hidden');
  toast(msg);
}

/* ============================== ДЕРЕВО ТЕМ ============================== */
function renderTree(q=''){
  const box=$('#tree'); box.innerHTML=''; q=q.trim().toLowerCase();
  let total=0;
  for(const sec of SECTIONS){
    const kids=sec.topics.filter(t=>{
      if(S.markMode&&!S.marks.includes(t.id)) return false;
      if(!q) return true;
      const hay=(t.title+' '+t.theory+' '+t.formulas.map(f=>f.tex+f.note).join(' ')).toLowerCase();
      return hay.includes(q)||sec.title.toLowerCase().includes(q);
    });
    if(!kids.length) continue;
    total+=kids.length;
    const el=document.createElement('div');
    el.className='sec'+((S.open.includes(sec.id)||q||S.markMode)?' open':'')+(sec.hard?' hard':'');
    const hd=document.createElement('button'); hd.className='hd';
    hd.innerHTML=`<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
      <span class="dot"></span><span>${sec.title}</span>${
        sec.hard?'<span class="hardtag" title="Раздел повышенной сложности, не обязателен к изучению">сложный</span>':''
      }<span class="n">${kids.length}</span>`;
    hd.onclick=()=>{ el.classList.toggle('open');
      const i=S.open.indexOf(sec.id); i<0?S.open.push(sec.id):S.open.splice(i,1); LS.set('open',S.open); };
    const kbox=document.createElement('div'); kbox.className='kids';
    for(const t of kids){
      const ready=!!(t.theory||t.formulas.length);
      const b=document.createElement('button');
      b.className='topic-item'+(S.topic&&S.topic.id===t.id?' active':'')+(ready?'':' wip')+(sec.hard?' hard':'');
      const st=document.createElement('span');
      st.className='star'+(S.marks.includes(t.id)?' on':''); st.textContent='★';
      st.onclick=e=>{ e.stopPropagation();
        const i=S.marks.indexOf(t.id); i<0?S.marks.push(t.id):S.marks.splice(i,1);
        LS.set('marks',S.marks); renderTree($('#search').value); };
      const ch=document.createElement('span'); ch.className='ch'; ch.textContent=t.ch?t.ch+'.':'§';
      const tx=document.createElement('span'); tx.textContent=t.title; tx.style.flex='1';
      b.append(st,ch,tx);
      b.onclick=()=>{ openTopic(t.id); autoCloseRail(); };
      kbox.append(b);
    }
    el.append(hd,kbox); box.append(el);
  }
  if(!total) box.innerHTML=`<div class="empty">${S.markMode?'Закладок нет. Нажмите ★ у темы.':'Ничего не нашлось.'}</div>`;
}

/* ============================= ОТКРЫТИЕ ТЕМЫ ============================ */
function openTopic(id){
  const t=ALL.find(x=>x.id===id); if(!t) return;
  S.topic=t; S.tab='notes';
  LS.set('lastTopic',t.id);
  $('#t-title').textContent=t.title;
  $('#t-sub').textContent = t.ch ? `${t.section} · тема ${t.ch} · по Дж. Ориру, «Физика»` : `${t.section} · руководство`;
  $('#crumb').textContent=t.section;
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab==='notes'));
  renderPane(); renderTree($('#search').value); $('#pane').scrollTop=0;
  const sims=[...new Set([...t.formulas,...t.problems].map(x=>x.sim).filter(Boolean))];
  const sel=$('#simsel');
  sel.innerHTML=sims.map(id=>`<option value="${id}">${SIMS[id].title}</option>`).join('');
  sel.style.display=sims.length?'block':'none';
  sel.onchange=e=>openSim(e.target.value);
  if(sims.length && !sims.includes(S.active)) openSim(sims[0]);          // симуляция темы открывается сама
  else if(sims.length) sel.value=S.active;
}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
  S.tab=b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
  renderPane();
});

function renderPane(){
  const t=S.topic, pane=$('#pane');
  if(S.tab==='notes'){
    if(!t.theory&&!t.formulas.length){
      pane.innerHTML=`<div class="empty">Конспект этой главы ещё не добавлен.<br>
        Пришлите ключевые моменты — тема появится здесь целиком, со своей симуляцией.</div>`;
      return;
    }
    const hardNote = t.hard ? `<div class="hardnote"><span>▲</span><span>
      <b>Раздел повышенной сложности.</b> Эта тема не входит в обязательную программу и требует
      уверенного владения предыдущими разделами. Её можно спокойно пропустить и вернуться позже.
      <br><b>Осторожно с симуляциями.</b> Здесь они дают лишь наглядный образ и могут содержать
      серьёзные расхождения с действительностью: масштабы условны, многое упрощено, а часть явлений
      вообще не имеет корректного наглядного изображения. Опирайтесь на формулы и текст, а картинку
      воспринимайте как подсказку для интуиции, а не как портрет реальности.
      </span></div>` : '';
    pane.innerHTML=`<article>${hardNote}
      <h2 class="sect">Конспект</h2>${t.theory}
      <h2 class="sect">Основные формулы</h2>
      ${t.formulas.map((f,i)=>`
        <div class="formula" data-f="${i}">
          <div>$$${f.tex}$$</div>
          ${f.note?`<div class="note">${f.note}</div>`:''}
        </div>`).join('')}
    </article>`;
  } else {
    if(!t.problems.length){ pane.innerHTML='<div class="empty">Задач по этой главе пока нет.</div>'; return; }
    const dots=n=>`<span class="dots">${'<i class="f"></i>'.repeat(n)}${'<i></i>'.repeat(5-n)}</span>`;
    pane.innerHTML=`
      <p style="color:var(--ink-3);font-size:13px;margin-bottom:14px;line-height:1.6">
        Условия привязаны к симуляции: ответ пересчитывается под текущие параметры. Допуск 1,5 %.</p>
      ${t.problems.map((pr,i)=>`
        <div class="problem" data-i="${i}">
          <div class="head">${dots(pr.level)}
            <span style="font-family:var(--mono);font-size:11px;color:var(--ink-3)">задача ${i+1}</span>
            ${pr.sim?`<button class="tagsim">${SIMS[pr.sim].title} ▷</button>`:''}
          </div>
          <div class="st">${pr.statement}</div>
          <div class="answer">
            <input type="text" inputmode="decimal" placeholder="ответ, ${pr.unit}">
            <button class="btn primary check">Проверить</button>
            ${pr.hint?'<button class="btn hint">Подсказка</button>':''}
            <button class="btn reveal">Показать ответ</button>
            <span class="verdict"></span>
          </div>
        </div>`).join('')}`;
    pane.querySelectorAll('.problem').forEach(el=>{
      const pr=t.problems[+el.dataset.i];
      const out=el.querySelector('.verdict'), inp=el.querySelector('input');
      const P=()=>pr.sim?rt(pr.sim).params:{};
      el.querySelector('.check').onclick=()=>{
        const u=parseFloat(inp.value.replace(',','.'));
        if(Number.isNaN(u)){ out.className='verdict no'; out.textContent='введите число'; return; }
        const ans=pr.answer(P());
        if(!isFinite(ans)){ out.className='verdict no'; out.textContent='при этих параметрах события нет'; return; }
        const ok=Math.abs(u-ans)<=Math.max(Math.abs(ans)*0.015,1e-9);
        out.className='verdict '+(ok?'ok':'no');
        out.textContent=ok?'✓ верно':'✗ не сходится';
      };
      el.querySelector('.reveal').onclick=()=>{
        const ans=pr.answer(P()); out.className='verdict ok';
        out.textContent=isFinite(ans)?`${fmt(ans)} ${pr.unit}`:'события не происходит';
      };
      const h=el.querySelector('.hint'); if(h) h.onclick=()=>toast(pr.hint);
      const ts=el.querySelector('.tagsim'); if(ts) ts.onclick=()=>openSim(pr.sim);
    });
  }
  typeset(pane);
}
function typeset(el){
  if(!window.renderMathInElement) return;
  try{ renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false}); }catch{}
}

/* ========================== УПРАВЛЕНИЕ СИМУЛЯЦИЕЙ ====================== */
function openSim(id){
  S.active=id; const a=rt(id);
  $('#simpane').classList.remove('hidden');
  if(isNarrow()){
    // поверх конспекта, во весь экран: разделитель и вторая колонка не нужны
    $('#splitter').classList.add('hidden');
    $('#content').classList.add('wide');
  } else {
    $('#splitter').classList.remove('hidden');
    $('#content').classList.remove('wide');
  }
  $('#nosim').style.display='none';
  $('#simtitle').textContent=a.def.title;
  if(S.settings.autoplay && !S.playing){ S.playing=true; setPlayIcon(); acc=0; }
  const sel=$('#simsel'); if([...sel.options].some(o=>o.value===id)) sel.value=id;
  $('#eventflag').classList.add('hidden');
  S.playing=true; setPlayIcon(); acc=0;
  renderParams(); buildGraphs(); renderPresets();
  requestAnimationFrame(()=>{ resize(); fitView(); });   // сначала знаем размер холста, потом вписываем
}
function renderParams(){
  const box=$('#params'), a=A(); box.innerHTML='';
  if(!a){ box.innerHTML='<div class="empty" style="padding:10px 0">Симуляция не открыта.</div>'; return; }
  const two=a.params.bodies==='2';
  let skip=false;
  for(const p of a.def.params){
    if(p.type==='group'){
      skip = (p.label==='Тело 2' && !two);
      if(skip) continue;
      const g=document.createElement('div'); g.className='pgroup'; g.textContent=p.label; box.append(g); continue;
    }
    if(skip) continue;
    const d=document.createElement('div'); d.className='param';
    if(p.type==='check'){
      d.innerHTML=`<label class="chk"><input type="checkbox" ${a.params[p.key]?'checked':''}>${p.label}</label>`;
      d.querySelector('input').onchange=e=>commit(p.key,e.target.checked);
    } else if(p.type==='select'){
      d.innerHTML=`<div class="name">${p.label}</div>
        <select>${p.options.map(o=>`<option value="${o.v}" ${a.params[p.key]===o.v?'selected':''}>${o.t}</option>`).join('')}</select>`;
      d.querySelector('select').onchange=e=>{ commit(p.key,e.target.value); renderParams(); buildGraphs(); };
    } else {
      d.innerHTML=`<div class="name">${p.label}</div>
        <div class="numfield">
          <button class="dec" tabindex="-1">−</button>
          <input type="number" step="${p.step}" min="${p.min}" max="${p.max}" value="${a.params[p.key]}">
          <button class="inc" tabindex="-1">+</button>
        </div><div class="unit">${p.unit||''}</div>`;
      const inp=d.querySelector('input');
      const put=v=>{ if(Number.isNaN(v)) v=p.default; v=clamp(round(v,p.step),p.min,p.max); inp.value=v; commit(p.key,v); };
      inp.onchange=()=>put(parseFloat(String(inp.value).replace(',','.')));
      inp.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter') inp.blur(); };
      d.querySelector('.dec').onclick=()=>put(+inp.value-p.step);
      d.querySelector('.inc').onclick=()=>put(+inp.value+p.step);
      d.title=`допустимый диапазон: ${p.min} … ${p.max}`;
    }
    box.append(d);
  }
}
const round=(v,step)=>{ const dg=(String(step).split('.')[1]||'').length; return +(+v).toFixed(dg); };
function commit(key,val){
  const a=A(); if(!a) return;
  a.params[key]=val;
  restart(a); fitView();
  const s=JSON.stringify(a.params);
  if(a.undo[a.undo.length-1]!==s){ a.undo.push(s); if(a.undo.length>60) a.undo.shift(); a.redo=[]; }
}
function restart(a){
  a.state=a.def.init(a.params); a.hist=[]; a.tick=0; acc=0;
  $('#eventflag').classList.add('hidden');
}
function applyParams(s){ const a=A(); a.params=JSON.parse(s); restart(a); renderParams(); buildGraphs(); }
function undo(){ const a=A(); if(!a||a.undo.length<2) return; a.redo.push(a.undo.pop()); applyParams(a.undo[a.undo.length-1]); toast('Параметры: назад'); }
function redo(){ const a=A(); if(!a||!a.redo.length) return; const s=a.redo.pop(); a.undo.push(s); applyParams(s); toast('Параметры: вперёд'); }

/* =========================== ИНСТРУМЕНТЫ / МЫШЬ ======================== */
function snapPt(x,y){
  const a=A(); if(!S.snap) return [x,y];
  let best=null,bd=14/ppm();
  for(const an of (a.def.anchors?a.def.anchors(a.state,a.params):[])){
    const d=Math.hypot(an.x-x,an.y-y); if(d<bd){ bd=d; best=[an.x,an.y]; }
  }
  if(best) return best;
  const g=gridStep(), gx=Math.round(x/g)*g, gy=Math.round(y/g)*g;   // узлы сетки
  return Math.hypot(gx-x,gy-y)<12/ppm()?[gx,gy]:[x,y];
}
let drag=null;
/* ===== ПИНЧ-ЗУМ ДВУМЯ ПАЛЬЦАМИ =====
   Аналог зума колесом мыши/тачпадом, но для сенсорных экранов: два пальца
   на сцене масштабируют её к точке между пальцами и одновременно панорамируют
   (разведение — приблизить, сведение — отдалить). Отслеживаем только касания
   (pointerType==='touch'), так что поведение мыши и пера не меняется. */
const touches=new Map();          // pointerId → {x,y} в координатах холста
let pinch=null;                   // база жеста: {dist, cx, cy} с прошлого кадра
function startPinch(){
  const [p1,p2]=[...touches.values()];
  pinch={dist:Math.max(1,Math.hypot(p1.x-p2.x,p1.y-p2.y)),cx:(p1.x+p2.x)/2,cy:(p1.y+p2.y)/2};
}
$('#cwrap').addEventListener('pointerdown',e=>{
  const a=A(); if(!a) return;
  const r=scene.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  const [wx,wy]=toWorld(px,py);
  if(e.pointerType==='touch'){
    touches.set(e.pointerId,{x:px,y:py});
    if(touches.size>=2){                 // второй палец — переходим в пинч, отменяя одиночный жест
      if(drag&&drag.mode==='dragpt'&&drag.wasPlaying){ S.playing=true; setPlayIcon(); acc=0; }
      if(a.draft) a.draft=null;          // отбрасываем случайно начатую пометку
      drag=null; startPinch(); return;
    }
  }
  if(e.button===1||e.shiftKey){ drag={mode:'pan',px,py,vx:a.view.x,vy:a.view.y}; return; }
  // КОНСТРУКТОР ЦЕПЕЙ: если симуляция умеет строиться мышью, ЛКМ отдаётся ей
  // ЦЕЛИКОМ — независимо от выбранного инструмента (перо, линейка и пр. не мешают).
  // Панорама остаётся на Shift, средней кнопке и протягивании пустого места.
  // держим указатель за собой: жест не теряется, если увели за край сцены
  try{ e.currentTarget.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
  if((a.def.clickAt || a.def.wireStart) && e.button===0){   // строит ТОЛЬКО левая кнопка; ПКМ — меню
    if(a.def.wireStart){
      const h=a.def.wireStart(a.params,wx,wy);       // попали в узел → тянем провод
      if(h){ drag={mode:'simdraw',handle:h}; return; }
    }
    drag={mode:'click',px,py,wx,wy,moved:false,vx:a.view.x,vy:a.view.y};
    return;
  }
  // перетаскивание точек симуляции (заряды, пробы, гауссова поверхность) — приоритет над панорамой.
  // Работает в режимах курсора и панорамы: если кликнули близко к точке, хватаем её.
  if(a.def.dragPoints && (S.tool==='cursor'||S.tool==='pan')){
    const pts=a.def.dragPoints(a.params);
    let best=-1, bestPx=22;                       // 22 px радиус попадания
    for(let i=0;i<pts.length;i++){
      const sp=toScreen(pts[i].x,pts[i].y);
      const dpx=Math.hypot(sp[0]-px, sp[1]-py);
      if(dpx<bestPx){ bestPx=dpx; best=i; }
    }
    if(best>=0){
      drag={mode:'dragpt',idx:best, wasPlaying:S.playing};   // запоминаем, шло ли время
      if(S.playing){ S.playing=false; setPlayIcon(); }        // на время перетаскивания — пауза
      return;
    }
  }
  if(S.tool==='pan'){ drag={mode:'pan',px,py,vx:a.view.x,vy:a.view.y}; return; }
  const [sx,sy]=snapPt(wx,wy);
  if(S.tool==='pencil'){ a.draft={type:'pencil',pts:[[sx,sy]]}; drag={mode:'draw'}; }
  else if(S.tool==='ruler'||S.tool==='vector'){ a.draft={type:S.tool,p:[sx,sy,sx,sy]}; drag={mode:'draw'}; }
  else if(S.tool==='eraser'){ annSnapshot(a); erase(wx,wy); drag={mode:'erase'}; }
});
addEventListener('pointermove',e=>{
  const a=A(); if(!drag||!a) return;
  const r=scene.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  const [wx,wy]=toWorld(px,py);
  if(drag.mode==='pan'){ a.view.x=drag.vx-(px-drag.px)/ppm(); a.view.y=drag.vy+(py-drag.py)/ppm(); }
  else if(drag.mode==='simdraw'){ a.def.wireMove(a.params,drag.handle,wx,wy); }
  else if(drag.mode==='click'){
    if(Math.hypot(px-drag.px,py-drag.py)>6) drag.moved=true;
    // потянули мимо узла — значит хотели подвинуть сцену
    if(drag.moved){ a.view.x=drag.vx-(px-drag.px)/ppm(); a.view.y=drag.vy+(py-drag.py)/ppm(); }
  }
  else if(drag.mode==='dragpt'){ a.def.dragMove(a.params,drag.idx,wx,wy); a.state=a.def.init(a.params); }
  else if(drag.mode==='draw'&&a.draft){
    const [sx,sy]=snapPt(wx,wy);
    if(a.draft.type==='pencil') a.draft.pts.push([wx,wy]);
    else { a.draft.p[2]=sx; a.draft.p[3]=sy; }
  } else if(drag.mode==='erase') erase(wx,wy);
});
/* pointercancel — отдельный случай: система может забрать жест себе
   (звонок, системный свайп, переключение окна), и тогда pointerup НЕ придёт.
   Без этого обработчика объект остался бы «приклеен» к курсору. */
addEventListener('pointercancel',()=>{
  const a=A();
  if(drag&&drag.mode==='dragpt'&&drag.wasPlaying){ S.playing=true; setPlayIcon(); acc=0; }
  if(a) a.draft=null;
  drag=null;
});
addEventListener('pointerup',()=>{
  const a=A();
  if(a&&a.draft&&drag&&drag.mode==='draw'){
    const d=a.draft;
    const ok=d.type==='pencil'?d.pts.length>2:Math.hypot(d.p[2]-d.p[0],d.p[3]-d.p[1])>0.05;
    if(ok){ annSnapshot(a); a.annos.push(d); }
  }
  if(drag&&drag.mode==='dragpt'&&drag.wasPlaying){         // возобновляем время, если оно шло до перетаскивания
    S.playing=true; setPlayIcon(); acc=0;
  }
  if(a&&drag&&drag.mode==='click'&&!drag.moved&&a.def.clickAt){   // клик по схеме конструктора
    a.def.clickAt(a.params, drag.wx, drag.wy);
    a.state=a.def.init(a.params);
  }
  if(a&&drag&&drag.mode==='simdraw'&&a.def.wireEnd){               // завершение рисования провода
    a.def.wireEnd(a.params, drag.handle);
    a.state=a.def.init(a.params);
  }
  if(a) a.draft=null;
  drag=null;
});
/* ===== ИСТОРИЯ ПОМЕТОК: карандаш, линейка, вектор, резинка отменяются по Ctrl+Z ===== */
function annSnapshot(a){
  a=a||A(); if(!a) return;
  (a.annHist=a.annHist||[]).push(JSON.stringify(a.annos||[]));
  if(a.annHist.length>60) a.annHist.shift();     // держим последние 60 действий
}
function annUndo(){
  const a=A();
  if(!a||!a.annHist||!a.annHist.length) return false;
  a.annos=JSON.parse(a.annHist.pop());
  toast(a.annHist.length? 'Пометка отменена' : 'Отменена последняя пометка');
  return true;
}
function erase(x,y){
  const a=A(), r=12/ppm();
  a.annos=a.annos.filter(an=>{
    if(an.type==='pencil') return !an.pts.some(q=>Math.hypot(q[0]-x,q[1]-y)<r);
    const [x1,y1,x2,y2]=an.p, dx=x2-x1, dy=y2-y1, L2=dx*dx+dy*dy||1e-9;
    const t=clamp(((x-x1)*dx+(y-y1)*dy)/L2,0,1);
    return Math.hypot(x1+t*dx-x,y1+t*dy-y)>r;
  });
}
$('#cwrap').addEventListener('wheel',e=>{
  const a=A(); if(!a) return;
  e.preventDefault();
  const r=scene.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  const [wx,wy]=toWorld(px,py);
  const k=Math.exp(-e.deltaY*0.006);                 // усиленный зум колесом
  a.view.scale=clamp(a.view.scale*clamp(k,0.35,2.9),ZMIN,ZMAX); setZoom();
  const [nx,ny]=toWorld(px,py); a.view.x+=wx-nx; a.view.y+=wy-ny;
},{passive:false});
/* Пинч: отдельный слушатель. Обычный pointermove выше на пинч не реагирует
   (drag сброшен при заходе в жест), поэтому конфликта нет. */
addEventListener('pointermove',e=>{
  if(!pinch||e.pointerType!=='touch') return;
  const a=A(); const p=touches.get(e.pointerId); if(!a||!p) return;
  const r=scene.getBoundingClientRect(); p.x=e.clientX-r.left; p.y=e.clientY-r.top;
  if(touches.size<2) return;
  const [p1,p2]=[...touches.values()];
  const dist=Math.max(1,Math.hypot(p1.x-p2.x,p1.y-p2.y)), cx=(p1.x+p2.x)/2, cy=(p1.y+p2.y)/2;
  // 1) масштаб: держим мировую точку под ПРЕЖНЕЙ серединой на месте
  const [wcx,wcy]=toWorld(pinch.cx,pinch.cy);
  a.view.scale=clamp(a.view.scale*(dist/pinch.dist),ZMIN,ZMAX);
  const [ncx,ncy]=toWorld(pinch.cx,pinch.cy); a.view.x+=wcx-ncx; a.view.y+=wcy-ncy;
  // 2) панорама: середина между пальцами сдвинулась — двигаем вид следом
  a.view.x-=(cx-pinch.cx)/ppm(); a.view.y+=(cy-pinch.cy)/ppm();
  pinch.dist=dist; pinch.cx=cx; pinch.cy=cy; setZoom();
},{passive:false});
function dropTouch(e){
  if(touches.delete(e.pointerId) && touches.size<2) pinch=null;   // палец поднят — жест окончен
}
addEventListener('pointerup',dropTouch);
addEventListener('pointercancel',dropTouch);
const ZMIN=0.002, ZMAX=30;                     // 0.2% … 3000%
function zoomLabel(v){ const p=v*100; return (p<10?p.toFixed(p<1?2:1):Math.round(p))+'%'; }
function setZoom(){ $('#zoomval').value=zoomLabel(A()?A().view.scale:1); }
const zoom=f=>{ const a=A(); if(!a) return; a.view.scale=clamp(a.view.scale*f,ZMIN,ZMAX); setZoom(); };
function fitView(){ const a=A(); if(!a) return; Object.assign(a.view,a.def.fit(a.params,{W:CW,H:CH})); setZoom(); }
$('#btn-zin').onclick=()=>zoom(1.8);
$('#btn-zout').onclick=()=>zoom(1/1.8);
$('#zoomval').onchange=e=>{ const a=A(), v=parseFloat(String(e.target.value).replace(',','.')); if(a&&v) a.view.scale=clamp(v/100,ZMIN,ZMAX); setZoom(); };
$('#zoomval').onkeydown=e=>e.stopPropagation();
$('#btn-fit').onclick=fitView;

/* ================================== UI ================================= */
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
function setTool(t){
  S.tool=t;
  document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  $('#cwrap').style.cursor=t==='pan'?'grab':(t==='eraser'?'cell':'crosshair');
}
$('#btn-snap').onclick=()=>{ S.snap=!S.snap; LS.set('snap',S.snap);
  $('#btn-snap').classList.toggle('on',S.snap); toast('Привязка: '+(S.snap?'вкл':'выкл')); };
$('#btn-snap').classList.toggle('on',S.snap);
$('#btn-clear').onclick=()=>{ const a=A(); if(a){ annSnapshot(a); a.annos=[]; toast('Пометки стёрты (Ctrl+Z вернёт)'); } };
$('#btn-rail').onclick=()=>{ const sb=$('#sidebar'); sb.classList.toggle('hidden');
  $('#btn-rail').setAttribute('aria-pressed',String(!sb.classList.contains('hidden'))); };
/* в полноэкранном режиме накладная панель тем закрывается сразу после выбора темы */
function autoCloseRail(){
  if($('#app').classList.contains('simfull')){
    $('#sidebar').classList.add('hidden');
    $('#btn-rail').setAttribute('aria-pressed','false');
  }
}
const tabOn=s=>['#tab-topics','#tab-search','#tab-marks'].forEach(x=>$(x).classList.toggle('on',x===s));
$('#tab-topics').onclick=()=>{ S.markMode=false; tabOn('#tab-topics'); $('#search').value=''; renderTree(); };
$('#tab-search').onclick=()=>{ tabOn('#tab-search'); $('#sidebar').classList.remove('hidden'); $('#search').focus(); };
$('#tab-marks').onclick=()=>{ S.markMode=true; tabOn('#tab-marks'); renderTree(); };
$('#search').oninput=e=>{ S.markMode=false; renderTree(e.target.value); };
$('#search').onkeydown=e=>e.stopPropagation();

$('#btn-simhide').onclick=()=>{
  const p=$('#simpane'), was=p.classList.contains('hidden');
  p.classList.toggle('hidden');
  if(isNarrow()){
    // на узком экране сцена всегда во весь экран, разделителя нет
    $('#splitter').classList.add('hidden');
    $('#content').classList.add('wide');
  } else {
    $('#splitter').classList.toggle('hidden',!was);
    $('#content').classList.toggle('wide',p.classList.contains('hidden'));
  }
  if(was) requestAnimationFrame(resize); else resize();
};
$('#btn-simfull').onclick=()=>{
  if(!S.active){ toast('Сначала откройте симуляцию из формулы'); return; }
  const on=$('#app').classList.toggle('simfull');
  $('#simpane').classList.remove('hidden'); $('#splitter').classList.remove('hidden');
  /* входя в полный экран, прячем список тем; выходя — возвращаем.
     Кнопкой ☰ (или клавишей B) его можно открыть поверх симуляции в любой момент. */
  const sb=$('#sidebar');
  sb.classList.toggle('hidden',on);
  $('#btn-rail').setAttribute('aria-pressed',String(!on));
  if(on) toast('Список тем — кнопка ☰ слева вверху или клавиша B');
  requestAnimationFrame(resize);
};
$('#btn-play').onclick=()=>{
  const a=A(); if(!a) return;
  if(!S.playing && a.state.event){                        // продолжаем прогон дальше, а не начинаем заново
    a.state.done=a.state.done||{};
    a.state.done[a.state.event.type]=true;                // это событие уже отработали
    a.state.event=null; a.state.__stop=null;
    $('#eventflag').classList.add('hidden');
  }
  S.playing=!S.playing; setPlayIcon();
};
function setPlayIcon(){
  const pl=S.playing;
  $('#ic-play').style.display=pl?'none':'block'; $('#ic-pause').style.display=pl?'block':'none';
  const mp=$('#ic-mplay'), mq=$('#ic-mpause');       // дублируем на мобильный док
  if(mp&&mq){ mp.style.display=pl?'none':'block'; mq.style.display=pl?'block':'none'; }
}
$('#btn-reset').onclick=()=>{ const a=A(); if(!a) return; restart(a); toast('Симуляция сброшена'); };
$('#btn-undo').onclick=undo; $('#btn-redo').onclick=redo;
$('#btn-makeout').onclick=()=>{
  const a=A(); if(!a||!a.def.makeOutput) return;
  a.def.makeOutput(a.params); a.state=a.def.init(a.params);
  toast('Вывод B создан в конце цепи');
};
$('#btn-graph').onclick=()=>{ S.graphOn=!S.graphOn; $('#gbox').classList.toggle('off',!S.graphOn);
  $('#btn-graph').setAttribute('aria-pressed',String(S.graphOn)); requestAnimationFrame(resize); };

/* нижняя панель симуляции: перетаскивание высоты + сворачивание двойным кликом */
let hdrag=null;
const bottom=$('#simbottom'), hsplit=$('#hsplit');
hsplit.addEventListener('pointerdown',e=>{
  hdrag={y:e.clientY,h:bottom.getBoundingClientRect().height};
  hsplit.classList.add('drag'); e.preventDefault();
});
addEventListener('pointermove',e=>{
  if(!hdrag) return;
  const max=$('#simpane').getBoundingClientRect().height-180;
  const h=clamp(hdrag.h-(e.clientY-hdrag.y),0,Math.max(60,max));
  bottom.classList.toggle('collapsed',h<24);
  bottom.style.height=h+'px';
  resize();
});
addEventListener('pointerup',()=>{ if(hdrag){ hdrag=null; hsplit.classList.remove('drag'); requestAnimationFrame(resize); } });
hsplit.addEventListener('dblclick',()=>{
  const col=bottom.classList.toggle('collapsed');
  if(!col) bottom.style.height='300px';
  requestAnimationFrame(resize);
});

let sdrag=false;
$('#splitter').addEventListener('pointerdown',e=>{ sdrag=true; $('#splitter').classList.add('drag'); e.preventDefault(); });
addEventListener('pointermove',e=>{ if(!sdrag) return;
  const w=clamp(innerWidth-e.clientX,340,innerWidth-440);
  $('#simpane').style.flex=`0 0 ${w}px`; $('#simpane').style.width=w+'px'; resize(); });
addEventListener('pointerup',()=>{ sdrag=false; $('#splitter').classList.remove('drag'); });

function popup(btn,pop){
  btn.onclick=e=>{
    e.stopPropagation();
    document.querySelectorAll('.pop').forEach(p=>{ if(p!==pop) p.classList.add('hidden'); });
    if(!pop.classList.contains('hidden')){ pop.classList.add('hidden'); return; }
    const r=btn.getBoundingClientRect();
    pop.style.visibility='hidden'; pop.classList.remove('hidden');
    const h=pop.offsetHeight,w=pop.offsetWidth;
    pop.style.top=(r.bottom+h+8>innerHeight?r.top-h-6:r.bottom+6)+'px';
    pop.style.left=clamp(r.left,8,innerWidth-w-8)+'px';
    pop.style.visibility='visible';
  };
}
popup($('#btn-simmenu'),$('#pop-simmenu'));
$('#btn-settings').onclick=()=>openPrefs();
popup($('#btn-help'),$('#pop-help'));
addEventListener('click',()=>document.querySelectorAll('.pop').forEach(p=>p.classList.add('hidden')));
document.querySelectorAll('.pop').forEach(p=>p.addEventListener('click',e=>e.stopPropagation()));

$('#mi-save').onclick=()=>{
  const a=A(); if(!a){ toast('Симуляция не открыта'); return; }
  const name=prompt('Название набора параметров:',a.def.title); if(!name) return;
  const all=LS.get('presets',{}); if(!all[S.active]) all[S.active]=[];
  all[S.active].push({name,values:{...a.params}});
  LS.set('presets',all); renderPresets(); toast('Параметры сохранены');
};
$('#mi-reset').onclick=()=>{
  const a=A(); if(!a) return;
  a.params={}; for(const p of a.def.params) if(p.type!=='group') a.params[p.key]=p.default;
  restart(a); a.annos=[];
  renderParams(); buildGraphs(); fitView(); toast('Всё сброшено');
};
$('#mi-png').onclick=()=>{
  if(!A()) return;
  const o=document.createElement('canvas'); o.width=scene.width; o.height=scene.height;
  const c=o.getContext('2d'); c.fillStyle=css('--canvas'); c.fillRect(0,0,o.width,o.height);
  c.drawImage(scene,0,0); c.drawImage(overlay,0,0);
  const a=document.createElement('a'); a.download=S.active+'.png'; a.href=o.toDataURL(); a.click();
  toast('Кадр сохранён');
};
const VQ={low:{b:2.5e6,fps:24,k:1},med:{b:8e6,fps:30,k:1},high:{b:16e6,fps:60,k:1},max:{b:40e6,fps:60,k:2}};
$('#mi-rec').onclick=()=>{
  if(S.rec){ S.rec.stop(); return; }
  if(!A()){ toast('Симуляция не открыта'); return; }
  const q=VQ[S.settings.videoQ||'med'];
  const m=document.createElement('canvas');
  m.width=scene.width*q.k; m.height=scene.height*q.k;
  const mc=m.getContext('2d'); mc.imageSmoothingQuality='high'; let alive=true;
  (function pump(){ if(!alive) return;
    mc.fillStyle=css('--canvas'); mc.fillRect(0,0,m.width,m.height);
    mc.drawImage(scene,0,0,m.width,m.height); mc.drawImage(overlay,0,0,m.width,m.height);
    requestAnimationFrame(pump); })();
  const types=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
  const mime=types.find(t=>MediaRecorder.isTypeSupported(t))||'video/webm';
  const rec=new MediaRecorder(m.captureStream(q.fps),{mimeType:mime,videoBitsPerSecond:q.b});
  const chunks=[];
  rec.ondataavailable=e=>chunks.push(e.data);
  rec.onstop=()=>{ alive=false; S.rec=null; $('#rec-label').textContent='Записать симуляцию (WebM)';
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));
    a.download=S.active+'.webm'; a.click(); toast('Запись сохранена'); };
  rec.start(); S.rec=rec; $('#rec-label').textContent='Остановить запись'; toast('Идёт запись…');
};
function loadPreset(values){
  const a=A(); if(!a) return;
  /* Значение из набора приводим к допустимому диапазону параметра.
     Иначе поле показывало бы одно, а состояние держало другое, и первое же
     нажатие «+» молча схлопнуло бы сценарий к границе. */
  for(const p of a.def.params){
    if(p.type==='group' || values[p.key]===undefined) continue;
    let v=values[p.key];
    if(typeof v==='number' && typeof p.min==='number') v=clamp(v,p.min,p.max);
    a.params[p.key]=v;
  }
  // конструкторы могут собирать не только числа, но и саму схему
  if(values.__preset && a.def.applyPreset) a.def.applyPreset(a.params, values.__preset);
  restart(a); renderParams(); buildGraphs(); fitView();
  const s=JSON.stringify(a.params);
  if(a.undo[a.undo.length-1]!==s){ a.undo.push(s); a.redo=[]; }
  toast('Загружен набор параметров');
}
function renderPresets(){
  const box=$('#presets'); box.innerHTML='';
  const a=A(); if(!a) return;
  const built=a.def.presets||[];
  const mine=LS.get('presets',{})[S.active]||[];

  if(built.length){
    const h=document.createElement('div'); h.className='ttl'; h.style.padding='2px 9px 4px';
    h.textContent='Примеры из учебника'; box.append(h);
    built.forEach(pr=>{
      const d=document.createElement('div'); d.className='preset';
      const b=document.createElement('button'); b.textContent=pr.name; b.title=pr.note||'';
      b.onclick=()=>loadPreset(pr.values);
      const t=document.createElement('span'); t.className='del'; t.style.cursor='default';
      t.textContent='§'; t.title='Готовый пример, удалить нельзя';
      d.append(b,t); box.append(d);
    });
  }
  const h2=document.createElement('div'); h2.className='ttl'; h2.style.padding='8px 9px 4px';
  h2.textContent='Мои наборы'; box.append(h2);
  if(!mine.length){ const e=document.createElement('div'); e.className='preset';
    e.style.color='var(--ink-3)'; e.textContent='Пока пусто'; box.append(e); return; }
  mine.forEach((pr,i)=>{
    const d=document.createElement('div'); d.className='preset';
    const b=document.createElement('button'); b.textContent=pr.name;
    b.onclick=()=>loadPreset(pr.values);
    const x=document.createElement('button'); x.className='del'; x.textContent='✕';
    x.onclick=()=>{ const all=LS.get('presets',{}); all[S.active].splice(i,1); LS.set('presets',all); renderPresets(); };
    d.append(b,x); box.append(d);
  });
}
/* ============================ ПОЛНОЭКРАННЫЕ НАСТРОЙКИ ============================
   Схема описывает каждую настройку декларативно: раздел, тип, подпись, пояснение
   и значение по умолчанию. Отсюда сами собой получаются поиск по всем разделам
   и сброс отдельной настройки — не нужно дублировать разметку. */
const PREF_CATS=[
  {id:'look', name:'Внешний вид', icon:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>'},
  {id:'scene',name:'Сцена',        icon:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/>'},
  {id:'behav',name:'Поведение',    icon:'<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1"/>'},
  {id:'perf', name:'Быстродействие',icon:'<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 12l5-3"/>'},
  {id:'rec',  name:'Запись видео',  icon:'<rect x="2" y="6" width="13" height="12" rx="2"/><path d="M15 10l7-4v12l-7-4"/>'},
  {id:'keys', name:'Горячие клавиши',icon:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>'},
  {id:'data', name:'Данные',        icon:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'},
  {id:'about',name:'О программе',   icon:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>'}
];
const PREF_DEFAULTS={theme:'light',accent:'violet',density:'cozy',fs:12,
  quality:'high',bgPause:true,fps:0,videoQ:'med',
  nums:true,hud:true,events:true,energy:true,grid:true,graphs:true,lineW:1,
  autoplay:false,restore:true,confirmReset:false};
const PREFS=[
  {cat:'look',key:'theme',type:'select',def:'light',
   name:'Тема оформления',desc:'Светлая удобнее при проекции на доску, тёмная — при работе в затемнённом классе.',
   options:[['light','Светлая'],['dark','Тёмная']]},
  {cat:'look',key:'accent',type:'select',def:'violet',
   name:'Акцентный цвет',desc:'Цвет выделения, активных кнопок и первого ряда на графиках.',
   options:[['violet','Фиолетовый'],['blue','Синий'],['teal','Бирюзовый'],['amber','Янтарный'],['rose','Красный']]},
  {cat:'look',key:'fs',type:'range',def:12,min:10,max:16,step:0.5,unit:' pt',
   name:'Размер шрифта',desc:'Влияет на конспект, формулы и подписи в интерфейсе.'},
  {cat:'look',key:'density',type:'select',def:'cozy',
   name:'Плотность интерфейса',desc:'Компактная умещает больше на экран, просторная удобнее для сенсорного экрана и проектора.',
   options:[['compact','Компактная'],['cozy','Обычная'],['roomy','Просторная']]},

  {cat:'scene',key:'nums',type:'toggle',def:true,
   name:'Числа на сцене',desc:'Подписи величин прямо у тел и векторов. Выключите, если хотите, чтобы ученики считали сами.'},
  {cat:'scene',key:'hud',type:'toggle',def:true,
   name:'Панель показаний',desc:'Список величин в левом верхнем углу сцены.'},
  {cat:'scene',key:'events',type:'toggle',def:true,
   name:'Плашки событий',desc:'Всплывающие отметки о падении, столкновении, достижении предела.'},
  {cat:'scene',key:'energy',type:'toggle',def:true,
   name:'Диаграмма энергии',desc:'Столбики кинетической, потенциальной и полной энергии.'},
  {cat:'scene',key:'grid',type:'toggle',def:true,
   name:'Координатная сетка',desc:'Разметка сцены с шагом в метрах. Без неё картинка чище, но труднее оценить масштаб.'},
  {cat:'scene',key:'graphs',type:'toggle',def:true,
   name:'Графики под сценой',desc:'Зависимости величин от времени. Отключение немного разгружает слабые машины.'},
  {cat:'scene',key:'lineW',type:'range',def:1,min:0.6,max:2,step:0.1,unit:'×',
   name:'Толщина линий',desc:'Общий множитель для всех штрихов на сцене. Увеличьте при показе через проектор из дальнего ряда.'},

  {cat:'behav',key:'autoplay',type:'toggle',def:false,
   name:'Запускать время сразу',desc:'Симуляция начинает считать, как только вы её открыли, без нажатия на пуск.'},
  {cat:'behav',key:'restore',type:'toggle',def:true,
   name:'Открывать последнюю тему',desc:'При следующем запуске приложение вернётся туда, где вы остановились.'},

  {cat:'perf',key:'quality',type:'select',def:'high',
   name:'Качество отрисовки',desc:'На высоком включены следы тел, чёткость под плотные экраны и мелкая сетка.',
   options:[['high','Высокое — следы, чёткость, мелкая сетка'],['med','Среднее'],['low','Экономное — без следов, без сглаживания']]},
  {cat:'perf',key:'bgPause',type:'toggle',def:true,
   name:'Останавливать время в фоне',desc:'Пока вкладка свёрнута или сцена скрыта, расчёт не идёт и ноутбук не греется.'},
  {cat:'perf',key:'fps',type:'select',def:0,
   name:'Ограничение частоты кадров',desc:'Реже перерисовывать сцену. Точность расчёта не меняется — шаг физики остаётся прежним.',
   options:[[0,'Без ограничения'],[60,'60 кадров в секунду'],[30,'30 кадров'],[24,'24 кадра — самый экономный']]},

  {cat:'rec',key:'videoQ',type:'select',def:'med',
   name:'Качество записи',desc:'Чем выше, тем крупнее файл. Для показа в классе обычно хватает среднего.',
   options:[['low','Экономное — 2,5 Мбит/с, 24 кадра'],['med','Среднее — 8 Мбит/с, 30 кадров'],
            ['high','Высокое — 16 Мбит/с, 60 кадров'],['max','Максимальное — 40 Мбит/с, 60 кадров, 2×']]}
];
let prefCat='look';
function prefGet(k){ const v=S.settings[k]; return v===undefined? PREF_DEFAULTS[k] : v; }
function prefSet(k,v){ S.settings[k]=v; applySettings(); renderPrefs(); }

function renderPrefsSide(){
  const box=$('#prefs-side'); if(!box) return;
  box.innerHTML='<div class="grp">Разделы</div>'+PREF_CATS.map(c=>
    `<button class="prefs-cat${c.id===prefCat?' on':''}" data-cat="${c.id}">
       <svg viewBox="0 0 24 24">${c.icon}</svg><span>${c.name}</span></button>`).join('');
  box.querySelectorAll('.prefs-cat').forEach(b=>b.onclick=()=>{
    prefCat=b.dataset.cat;
    // подсветку переключаем сразу здесь: перерисовывается только правая часть,
    // поэтому сам список разделов иначе остался бы со старой отметкой
    box.querySelectorAll('.prefs-cat').forEach(x=>x.classList.toggle('on',x===b));
    $('#prefs-search').value=''; renderPrefs();
  });
}
function prefRow(p){
  const v=prefGet(p.key), isDef=String(v)===String(p.def);
  let ctl='';
  if(p.type==='toggle')
    ctl=`<label class="sw-t"><input type="checkbox" data-k="${p.key}" ${v?'checked':''}><i></i></label>`;
  else if(p.type==='select')
    ctl=`<select data-k="${p.key}">${p.options.map(([ov,ot])=>
      `<option value="${ov}"${String(ov)===String(v)?' selected':''}>${ot}</option>`).join('')}</select>`;
  else if(p.type==='range')
    ctl=`<input type="range" data-k="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}">
         <span class="pset-val">${v}${p.unit||''}</span>`;
  const reset=isDef?'':`<button class="pset-reset" data-reset="${p.key}" title="Вернуть значение по умолчанию">
      <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button>`;
  return `<div class="pset" data-search="${(p.name+' '+p.desc).toLowerCase()}">
      <div class="pset-l"><div class="pset-name">${p.name}</div><div class="pset-desc">${p.desc}</div></div>
      <div class="pset-c">${reset}${ctl}</div></div>`;
}
function renderPrefs(){
  const body=$('#prefs-body'); if(!body) return;
  const q=($('#prefs-search').value||'').trim().toLowerCase();
  const cat=PREF_CATS.find(c=>c.id===prefCat);
  $('#prefs-title').textContent = q? 'Поиск по настройкам' : cat.name;
  if(q){
    // при поиске показываем совпадения из всех разделов сразу
    const hits=PREFS.filter(p=>(p.name+' '+p.desc).toLowerCase().includes(q));
    const keys=KEYS.filter(([k,v])=>(k+' '+v).toLowerCase().includes(q));
    let html='';
    if(hits.length){
      const byCat={};
      for(const p of hits) (byCat[p.cat]=byCat[p.cat]||[]).push(p);
      for(const c of PREF_CATS) if(byCat[c.id])
        html+=`<div class="pset-h">${c.name}</div>`+byCat[c.id].map(prefRow).join('');
    }
    if(keys.length)
      html+=`<div class="pset-h">Горячие клавиши</div><div class="prefs-keys">`+
        keys.map(([k,v])=>`<div class="kb"><span>${v}</span><kbd>${k}</kbd></div>`).join('')+`</div>`;
    body.innerHTML = html || `<div class="prefs-empty">Ничего не найдено по запросу «${q}».</div>`;
  } else if(prefCat==='keys'){
    body.innerHTML=`<div class="pset-h">Клавиши и мышь</div><div class="prefs-keys">`+
      KEYS.map(([k,v])=>`<div class="kb"><span>${v}</span><kbd>${k}</kbd></div>`).join('')+`</div>`;
  } else if(prefCat==='data'){
    let bytes=0, keysN=0;
    try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
      if(k&&k.startsWith('physim.')){ keysN++; bytes+=(localStorage.getItem(k)||'').length; } } }catch(_){}
    const presets=(()=>{ try{ return Object.keys(LS.get('presets',{})).length; }catch(_){ return 0; } })();
    body.innerHTML=`
      <div class="pset-h">Что хранится на этом компьютере</div>
      <div class="prefs-stat">
        <div><b>${keysN}</b>записей</div>
        <div><b>${(bytes/1024).toFixed(1)} КБ</b>занято</div>
        <div><b>${presets}</b>своих наборов</div>
      </div>
      <div class="pset-desc" style="margin:10px 0 4px">Данные никуда не отправляются и остаются только в этом браузере.</div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Сбросить настройки</div>
        <div class="pset-desc">Вернуть внешний вид, сцену и качество к исходным значениям. Наборы и пометки не тронутся.</div></div>
        <div class="pset-c"><button class="btn" id="pref-reset-all">Сбросить</button></div></div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Удалить свои наборы параметров</div>
        <div class="pset-desc">Сохранённые вами состояния симуляций. Готовые примеры останутся.</div></div>
        <div class="pset-c"><button class="btn" id="pref-clear-presets">Удалить</button></div></div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Очистить всё хранилище</div>
        <div class="pset-desc">Удаляет настройки, наборы и пометки. Отменить это будет нельзя.</div></div>
        <div class="pset-c"><button class="btn" id="pref-clear-all">Очистить</button></div></div>`;
    $('#pref-reset-all').onclick=()=>{
      if(!confirm('Вернуть все настройки к исходным значениям?')) return;
      S.settings={...PREF_DEFAULTS}; applySettings(); renderPrefs(); toast('Настройки сброшены');
    };
    $('#pref-clear-presets').onclick=()=>{
      if(!confirm('Удалить все свои наборы параметров?')) return;
      LS.set('presets',{}); renderPrefs(); toast('Наборы удалены');
    };
    $('#pref-clear-all').onclick=()=>{
      if(!confirm('Удалить все сохранённые данные? Это нельзя отменить.')) return;
      try{ const del=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
        if(k&&k.startsWith('physim.')) del.push(k); } del.forEach(k=>localStorage.removeItem(k)); }catch(_){}
      S.settings={...PREF_DEFAULTS}; applySettings(); renderPrefs(); toast('Хранилище очищено');
    };
  } else if(prefCat==='about'){
    const nSim=Object.keys(SIMS).length;
    const nTop=SECTIONS.reduce((a,s)=>a+s.topics.length,0);
    const nF=SECTIONS.flatMap(s=>s.topics).reduce((a,t)=>a+(t.formulas||[]).length,0);
    body.innerHTML=`
      <div class="pset-h">Phy.Sim</div>
      <div class="prefs-stat">
        <div><b>${SECTIONS.length}</b>разделов</div><div><b>${nTop}</b>тем</div>
        <div><b>${nF}</b>формул</div><div><b>${nSim}</b>симуляций</div>
      </div>
      <div class="prefs-about" style="margin-top:14px">
        Интерактивный курс физики по учебнику <b>Дж. Орира</b>, тома 1 и 2.
        Каждая формула связана с живой моделью: параметры можно менять и сразу видеть,
        что произойдёт.<br><br>
        Работает целиком в браузере, без интернета и установки — файл можно носить на флешке
        и открывать на любом компьютере. Всё, что вы настроите или сохраните,
        остаётся только на этом устройстве.
      </div>`;
  } else {
    const list=PREFS.filter(p=>p.cat===prefCat);
    body.innerHTML=`<div class="pset-h">${cat.name}</div>`+list.map(prefRow).join('');
  }
  // общие обработчики для всех отрисованных управляющих элементов
  body.querySelectorAll('[data-k]').forEach(el=>{
    const k=el.dataset.k, p=PREFS.find(x=>x.key===k);
    if(p.type==='toggle') el.onchange=()=>prefSet(k,el.checked);
    // у числовых настроек приводим тип: select всегда отдаёт строку
    else if(p.type==='select') el.onchange=()=>
      prefSet(k, typeof p.def==='number'? +el.value : el.value);
    else if(p.type==='range'){
      el.oninput=()=>{ S.settings[k]=+el.value;
        const lab=el.parentElement.querySelector('.pset-val');
        if(lab) lab.textContent=el.value+(p.unit||'');
        applySettings(); };
      el.onchange=()=>renderPrefs();
    }
  });
  body.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{
    const p=PREFS.find(x=>x.key===b.dataset.reset); prefSet(p.key,p.def);
  });
}
function openPrefs(cat){
  if(cat) prefCat=cat;
  $('#prefs').classList.remove('hidden');
  renderPrefsSide(); renderPrefs();
  setTimeout(()=>$('#prefs-search').focus(),30);
}
function closePrefs(){ $('#prefs').classList.add('hidden'); resize(); }
$('#prefs-close').onclick=closePrefs;
$('#prefs-search').oninput=()=>renderPrefs();
$('#prefs').addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.stopPropagation(); closePrefs(); } });

/* ======================= ПОВЕДЕНИЕ НА УЗКИХ ЭКРАНАХ =======================
   Телефон: конспект занимает всю ширину, симуляция открывается поверх него
   целиком и закрывается кнопкой «назад». При повороте экрана раскладка
   пересчитывается, а вид симуляции заново вписывается в новые пропорции. */
const isNarrow=()=>matchMedia('(max-width:900px)').matches;
function closeSimMobile(){
  mSheet(false);                          // на всякий случай закрываем шторку параметров
  $('#simpane').classList.add('hidden');
  $('#splitter').classList.add('hidden');
  $('#content').classList.add('wide');
  $('#app').classList.remove('simfull');
  resize();
}
$('#btn-simback').onclick=closeSimMobile;

/* ===== МОБИЛЬНОЕ УПРАВЛЕНИЕ: плавающий док + шторка параметров/графиков =====
   Кнопки дока проксируют на существующие обработчики — логика не дублируется. */
function mSheet(open){
  const sb=$('#simbottom'); if(!sb) return;
  const now = open===undefined ? !sb.classList.contains('msheet-open') : open;
  sb.classList.toggle('msheet-open', now);
  $('#msheet-bg').classList.toggle('show', now);
  if(now) requestAnimationFrame(resize);   // графики в раскрытой шторке получают размер
}
$('#m-params').onclick=()=>mSheet();
$('#msheet-close').onclick=()=>mSheet(false);
$('#msheet-bg').onclick=()=>mSheet(false);
$('#m-reset').onclick=()=>$('#btn-reset').click();
$('#m-play').onclick=()=>$('#btn-play').click();
$('#m-slow').onclick=()=>stepSpeed(-1);
$('#m-fast').onclick=()=>stepSpeed(1);
$('#m-settings').onclick=()=>openPrefs();
popup($('#m-menu'),$('#pop-simmenu'));      // та же логика попапа, что и у кнопки в топбаре

/* Поворот экрана и любое изменение размера окна. */
let lastNarrow=isNarrow();
function onViewportChange(){
  const now=isNarrow();
  if(now!==lastNarrow){
    lastNarrow=now;
    if(now){
      // перешли к узкому экрану: убираем разделитель и прячем сцену, чтобы
      // конспект не оказался зажат в полоску
      $('#splitter').classList.add('hidden');
      if(!$('#simpane').classList.contains('hidden')) $('#content').classList.add('wide');
    } else {
      // вернулись к широкому: восстанавливаем работу бок о бок
      $('#app').classList.remove('simfull');
      if(!$('#simpane').classList.contains('hidden')){
        $('#splitter').classList.remove('hidden');
        $('#content').classList.remove('wide');
      }
      $('#sidebar').classList.remove('hidden');
    }
  }
  resize();
  // вписываем сцену заново: при повороте пропорции меняются сильно
  const a=A();
  if(a && a.def.fit && !$('#simpane').classList.contains('hidden')){
    const f=a.def.fit(a.params,{W:CW,H:CH});
    a.view.scale=f.scale; a.view.x=f.x; a.view.y=f.y;
  }
}
addEventListener('orientationchange',()=>setTimeout(onViewportChange,120));
addEventListener('resize',()=>{ clearTimeout(window.__vpT);
  window.__vpT=setTimeout(onViewportChange,90); });

function applySettings(){
  const s=S.settings;
  if(s.fs>16) s.fs=12;                                  // миграция со старой px-шкалы
  const root=document.documentElement;
  root.dataset.theme=s.theme;
  root.dataset.density=s.density||'cozy';
  root.style.setProperty('--fs',s.fs+'pt');
  // акцентный цвет: подкрашиваем и полупрозрачную заливку под ним
  const ACC={blue:'#3b82f6',teal:'#0d9488',violet:'#7c5cff',amber:'#d97706',rose:'#e11d48'};
  if(s.accent && ACC[s.accent]){
    root.style.setProperty('--accent',ACC[s.accent]);
    root.style.setProperty('--accent-soft',ACC[s.accent]+'22');
  } else { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-soft'); }
  $('#hud').classList.toggle('hidden',s.hud===false);
  // графики можно выключить целиком — это заметно разгружает слабые машины
  const gp=$('#gbox'); if(gp) gp.classList.toggle('hidden',s.graphs===false);
  LS.set('settings',s); resize();
}

$('#pvhead').onclick=()=>{ $('#pvbox').classList.toggle('collapsed'); $('#pvtoggle').textContent=$('#pvbox').classList.contains('collapsed')?'▸':'▾'; };

const KEYS=[['Ctrl + ,','Настройки'],['Space','Пуск / стоп'],['R','Сбросить симуляцию'],['Ctrl + Z','Параметры: назад'],['Ctrl + Y','Параметры: вперёд'],
 ['V / P / L / Y / E','Курсор / карандаш / линейка / вектор / резинка'],['A','Привязка к анкерам и узлам сетки'],
 ['F','Симуляция во весь экран'],['H','Скрыть симуляцию'],['Tab','Скрыть панель тем'],['Ctrl + K','Поиск'],
 ['+ / −','Зум'],['[ / ]','Замедлить / ускорить время'],['0','Вписать вид'],['Колесо','Зум к курсору'],['Shift + drag','Панорама'],
 ['Два пальца','Зум и панорама на сенсоре'],['ПКМ','Меню симуляции']];
$('#kb-list').innerHTML=KEYS.map(([k,v])=>`<div class="kb"><span>${v}</span><kbd>${k}</kbd></div>`).join('');
$('#mi-kb').onclick=()=>openPrefs('keys');
$('#kb-close').onclick=()=>$('#modal-kb').classList.add('hidden');
$('#modal-kb').onclick=e=>{ if(e.target.id==='modal-kb') $('#modal-kb').classList.add('hidden'); };

addEventListener('keydown',e=>{
  const t=e.target, typing=/INPUT|SELECT|TEXTAREA/.test(t.tagName)||t.isContentEditable;
  const C=e.code, mod=e.ctrlKey||e.metaKey;                 // e.code не зависит от раскладки
  // настройки открыты — гасим все прочие сочетания, чтобы не управлять сценой вслепую
  const prefsOpen=!$('#prefs').classList.contains('hidden');
  if(mod&&C==='Comma'){ e.preventDefault(); prefsOpen? closePrefs() : openPrefs(); return; }
  if(prefsOpen){ if(e.key==='Escape'){ e.preventDefault(); closePrefs(); } return; }
  if(mod&&C==='KeyK'){ e.preventDefault(); $('#tab-search').click(); return; }
  if(mod&&C==='KeyZ'){ e.preventDefault();
    const az=A();                                            // в конструкторе цепей Ctrl+Z убирает последний сегмент
    if(az&&az.def.undoAction&&az.def.undoAction(az.params)){ az.state=az.def.init(az.params); return; }
    if(annUndo()) return;                                    // затем — пометки инструментами
    undo(); return; }
  if(mod&&C==='KeyY'){ e.preventDefault(); redo(); return; }
  if(mod) return;
  if(typing){ if(C==='Escape') t.blur(); return; }
  const map={
    KeyV:()=>setTool('pan'), KeyP:()=>setTool('pencil'), KeyL:()=>setTool('ruler'),
    KeyY:()=>setTool('vector'), KeyE:()=>setTool('eraser'),
    KeyA:()=>$('#btn-snap').click(), KeyR:()=>$('#btn-reset').click(),
    KeyF:()=>$('#btn-simfull').click(), KeyH:()=>$('#btn-simhide').click(),
    Space:()=>$('#btn-play').click(), Tab:()=>$('#btn-rail').click(), KeyB:()=>$('#btn-rail').click(),
    Digit0:fitView, Numpad0:fitView,
    BracketLeft:()=>stepSpeed(-1), BracketRight:()=>stepSpeed(1),
    Equal:()=>zoom(1.8), NumpadAdd:()=>zoom(1.8),
    Minus:()=>zoom(1/1.8), NumpadSubtract:()=>zoom(1/1.8)
  };
  if(map[C]){ e.preventDefault(); map[C](); }
});

/* ПКМ по симуляции → меню симуляции вместо меню браузера */
$('#simpane').addEventListener('contextmenu',e=>{
  e.preventDefault();
  const pop=$('#pop-simmenu');
  // инструменты конструктора цепей (если симуляция их объявляет)
  let tl=$('#simmenu-tools');
  if(!tl){ tl=document.createElement('div'); tl.id='simmenu-tools'; pop.prepend(tl); }
  tl.innerHTML='';
  const at=A();
  if(at&&at.def.ctxTools){
    for(const it of at.def.ctxTools(at.params)){
      const b=document.createElement('button'); b.className='item'; b.textContent=it.label;
      b.onclick=()=>{ it.on(at.params); at.state=at.def.init(at.params); pop.classList.add('hidden'); };
      tl.appendChild(b);
    }
    const hr=document.createElement('div');
    hr.style.cssText='height:1px;background:var(--line-soft);margin:4px 6px';
    tl.appendChild(hr);
  }
  document.querySelectorAll('.pop').forEach(p=>p.classList.add('hidden'));
  pop.style.visibility='hidden'; pop.classList.remove('hidden');
  const w=pop.offsetWidth, h=pop.offsetHeight;
  pop.style.left=clamp(e.clientX,8,innerWidth-w-8)+'px';
  pop.style.top=clamp(e.clientY,8,innerHeight-h-8)+'px';
  pop.style.visibility='visible';
});

const SPEEDS=[0.05,0.1,0.25,0.5,1,2,4,8,16,32,64,100,200];
function setSpeed(v){
  S.speed=clamp(v,0.05,200);
  const lbl=(S.speed>=1?(Number.isInteger(S.speed)?S.speed:S.speed.toFixed(1)):S.speed)+'×';
  $('#speedval').value=lbl;
  const m=$('#m-speed'); if(m) m.textContent=lbl;     // дублируем на мобильный док
}
function stepSpeed(dir){
  const i=SPEEDS.findIndex(x=>x>=S.speed-1e-9);
  const j=clamp((i<0?4:i)+dir,0,SPEEDS.length-1);
  setSpeed(SPEEDS[j]); toast('Скорость времени: '+S.speed+'×');
}
$('#btn-sup').onclick=()=>stepSpeed(1);
$('#btn-sdn').onclick=()=>stepSpeed(-1);
$('#speedval').onchange=e=>{ const v=parseFloat(String(e.target.value).replace(',','.')); setSpeed(v||1); };
$('#speedval').onkeydown=e=>e.stopPropagation();
setSpeed(1);

let tt;
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show');
  clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('show'),2400); }

/* ================================= СТАРТ =============================== */
applySettings(); setTool('pan'); renderTree(); renderParams();
// при следующем запуске откроем ту же тему, если это разрешено в настройках
if(isNarrow()) closeSimMobile();          // на телефоне начинаем с конспекта
openTopic((S.settings.restore!==false && LS.get('lastTopic',null) && ALL.some(t=>t.id===LS.get('lastTopic',null)))
  ? LS.get('lastTopic',null) : 'intro');
resize();
addEventListener('load',()=>{ typeset($('#pane')); resize(); });
