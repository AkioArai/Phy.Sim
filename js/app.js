'use strict';
/* =============================== СОСТОЯНИЕ ============================== */
const LS={get:(k,d)=>{try{const v=localStorage.getItem('physim.'+k);return v?JSON.parse(v):d}catch{return d}},
          set:(k,v)=>{try{localStorage.setItem('physim.'+k,JSON.stringify(v))}catch{}}};
const RT={};
const S={topic:null,tab:'notes',active:null,playing:false,tool:'pan',markMode:false,graphOn:true,rec:null,speed:1,
  snap:LS.get('snap',true), marks:LS.get('marks',[]), open:LS.get('open',['intro','mech']),
  trace:LS.get('trace',false), probe:null, recent:LS.get('recent',[]),
  scrub:null, loop:LS.get('loop',false), favs:LS.get('favs',[]),
  coords:LS.get('coords',false), mouse:null,
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
  if(typeof fpClampAll==='function') setTimeout(fpClampAll,0);   // панели держим внутри сцены
  const r=$('#cwrap').getBoundingClientRect();
  DPR=S.settings.quality==='low'?1:Math.min(devicePixelRatio||1,S.settings.quality==='high'?2:1.5);
  const cap=+S.settings.dprCap||0; if(cap>0) DPR=Math.min(DPR,cap);   // жёсткий предел чёткости из настроек
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
  /* Подписи на сцене. Позиции в симуляциях заданы вручную пиксельными
     сдвигами, поэтому на разных зумах и наборах параметров они наезжали друг
     на друга и уползали за кадр. Раскладку чиним здесь, централизованно —
     как это делают CAD и библиотеки графиков:
       1) подпись прижимается внутрь кадра, если вылезла за край;
       2) если она перекрыла уже нарисованную, её сдвигаем по вертикали до
          свободного места (несколько попыток вверх/вниз).
     Список занятых прямоугольников обнуляется каждый кадр (labelFrame). */
  _lbl:[],
  /* Память раскладки. Без неё каждый кадр решался с нуля: стоило сцене
     сдвинуться на пиксель, как подпись перескакивала на соседний ряд и тут же
     обратно — на панорамировании это выглядело как дрожь. Теперь для каждой
     подписи запоминается её вертикальная поправка, она переиспользуется, пока
     не мешает, а меняется — плавно, по несколько пикселей за кадр. */
  _lblMem:new Map(), _lblSeq:0, _lblFrame:0,
  labelFrame(){
    this._lbl.length=0; this._lblSeq=0; this._lblFrame++;
    if(this._lblFrame%600===0){                      // изредка чистим память
      for(const [k,m] of this._lblMem) if(this._lblFrame-m.f>600) this._lblMem.delete(k);
    }
  },
  label(ctx,text,wx,wy,dx=0,dy=0,color){
    if(S.settings.nums===false){                       // режим «без чисел»
      text=String(text).replace(/=\s*[-+]?[\d.,]+(?:e[-+]?\d+)?\s*[^\s,;]*/gi,'')
                       .replace(/\s{2,}/g,' ').trim();
      if(!text) return;
    }
    const [sx,sy]=toScreen(wx,wy);
    ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
    const base=+prefGet('labelSize')||11;
    ctx.fillStyle=color||css('--ink-2'); ctx.font=sceneFont(base); ctx.textBaseline='middle';
    let x=sx+dx, y=sy+dy;
    if(S.settings.labelFix!==false && isFinite(x) && isFinite(y)){
      // 0) длинные пояснения ужимаем по кеглю, пока не влезут в кадр
      let w=ctx.measureText(text).width;
      if(w>CW-6){
        for(let fs=base-1;fs>=Math.max(7,base-3)&&w>CW-6;fs--){
          ctx.font=sceneFont(fs);
          w=ctx.measureText(text).width;
        }
      }
      const h=base+1;
      // 1) вернуть в кадр
      x=Math.max(2,Math.min(x,CW-w-2));
      y=Math.max(8,Math.min(y,CH-6));
      // 2) развести с уже нарисованными
      const hit=(yy)=>this._lbl.some(r=>
        x < r.x+r.w+3 && x+w+3 > r.x && yy-h/2 < r.y+r.h && yy+h/2 > r.y-0);
      /* Ключ подписи: текст с выкинутыми числами (значения меняются каждый
         кадр, а надпись — та же) плюс её номер по порядку отрисовки. */
      const key=String(text).replace(/[-+0-9.,]+/g,'#')+'|'+(this._lblSeq++);
      const mem=this._lblMem.get(key);
      let tgt = mem ? mem.tgt : 0;
      if(hit(y+tgt)){                                // прошлая поправка больше не годится
        tgt=0;
        if(hit(y)){
          const step=13;
          for(let i=1;i<=6;i++){
            let done=false;
            for(const d of [step*i, -step*i]){
              const cand=y+d;
              if(cand<8||cand>CH-6) continue;
              if(!hit(cand)){ tgt=d; done=true; break; }
            }
            if(done) break;
          }
        }
      } else if(tgt!==0 && !hit(y)){
        /* Место под подписью освободилось — возвращаемся, но не сразу:
           иначе на границе она принялась бы мигать туда-сюда. */
        const free=(mem.free||0)+1;
        if(free>25){ tgt=0; mem.free=0; } else mem.free=free;
      } else if(mem) mem.free=0;
      // плавный переход к целевой поправке — вместо скачка на целый ряд
      let cur = mem ? mem.cur : tgt;
      const d=tgt-cur;
      cur += Math.max(-2.5,Math.min(2.5,d));
      if(Math.abs(tgt-cur)<0.5) cur=tgt;
      this._lblMem.set(key,{tgt,cur,free:mem?mem.free:0,f:this._lblFrame});
      y+=cur;
      this._lbl.push({x,y:y-h/2,w,h});
      if(this._lbl.length>400) this._lbl.shift();      // страховка от разрастания
    }
    ctx.fillText(text,x,y); ctx.restore();
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
    // размер наконечника настраивается: с задней парты мелкие стрелки не видны
    const a=Math.atan2(y2-y1,x2-x1), h=Math.min(L*0.35,this.lw(9*(+prefGet('arrowScale')||1)));
    ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=this.lw(1.8);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2,y2);
    ctx.lineTo(x2-h*Math.cos(a-0.42),y2-h*Math.sin(a-0.42));
    ctx.lineTo(x2-h*Math.cos(a+0.42),y2-h*Math.sin(a+0.42));
    ctx.closePath(); ctx.fill();
  },
  /* Дуговая стрелка момента силы вокруг точки (cx,cy).
     dir > 0 — против часовой, dir < 0 — по часовой. r — радиус дуги (в метрах).
     Дуга рисуется полилинией с явной параметризацией, а не ctx.arc: мировая
     система перевёрнута по y (setTransform ... −k), и флаг направления arc в ней
     зеркалится — из-за этого дуга выходила короткой, а наконечник вставал
     поперёк неё («кривые стрелки момента»). У полилинии направление хода и
     касательная в конце известны точно. */
  torqueArc(ctx,cx,cy,r,dir,color){
    if(Math.abs(dir)<1e-9) return;
    const sgn=dir>0?1:-1;                    // +1 — против часовой (в мире y — вверх)
    const span=4.2;                          // длина дуги ~240°
    const gap=2*Math.PI-span;
    const th0=-Math.PI/2+sgn*gap/2;          // разрыв дуги всегда смотрит вниз
    ctx.strokeStyle=color; ctx.fillStyle=color;
    ctx.lineWidth=this.lw(2.2); ctx.lineCap='round';
    ctx.beginPath();
    const N=42;
    for(let i=0;i<=N;i++){
      const th=th0+sgn*span*i/N;
      const x=cx+r*Math.cos(th), y=cy+r*Math.sin(th);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.stroke();
    // наконечник: касательная в конце дуги по направлению хода
    const the=th0+sgn*span;
    const tx=cx+r*Math.cos(the), ty=cy+r*Math.sin(the);
    const tang=the+sgn*Math.PI/2;
    const h=Math.min(this.lw(10),r*0.55);
    ctx.beginPath(); ctx.moveTo(tx+h*0.3*Math.cos(tang),ty+h*0.3*Math.sin(tang));
    ctx.lineTo(tx-h*Math.cos(tang-0.46),ty-h*Math.sin(tang-0.46));
    ctx.lineTo(tx-h*Math.cos(tang+0.46),ty-h*Math.sin(tang+0.46));
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
  // настройка крупности: сдвигаем автоматический шаг на одну ступень
  const m=S.settings.gridStepMode;
  if(m==='coarse') s*=(String(s)[0]==='1'?2.5:2);
  else if(m==='fine') s/=(String(s)[0]==='1'?2:2.5);
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
  const ga=+prefGet('gridAlpha')||1;                     // насыщенность сетки из настроек
  ctx.save(); ctx.globalAlpha=Math.min(1,ga);
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
  ctx.restore();
  if(S.settings.gridLabels!==false)
    VIEW.label(ctx,`сетка ${step} м`,x1,y0,-80,-10,css('--ink-3'));
}
/* Семейство и кегль подписей на сцене — из настроек оформления. */
const SCENE_FONTS={mono:'ui-monospace,monospace',sans:'system-ui,sans-serif',serif:'Georgia,serif'};
function sceneFont(px){
  const f=SCENE_FONTS[prefGet('sceneFont')]||SCENE_FONTS.mono;
  return (px||prefGet('labelSize')||11)+'px '+f;
}
const fmt=v=>{
  if(!isFinite(v)) return '—';
  const d=+S.settings.numPrec||2;                        // точность из настроек
  return (Math.abs(v)>=1e4||(Math.abs(v)<0.01&&v!==0))?(+v).toExponential(d):(+v).toFixed(d);
};

function drawAll(){
  const a=A(); if(!a) return;
  VIEW.labelFrame();                       // новый кадр — раскладка подписей с чистого листа
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
    } else if(an.type==='dim'){
      /* Размерная линия как в чертеже: сама линия со стрелками на концах
         и две выноски-перпендикуляра от измеряемых точек. */
      const [x1,y1,x2,y2]=an.p, dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy)||1e-9;
      const nx=-dy/L, ny=dx/L, off=VIEW.lw(14);
      const ax=x1+nx*off, ay=y1+ny*off, bx=x2+nx*off, by=y2+ny*off;
      octx.strokeStyle=css('--measure'); octx.lineWidth=VIEW.lw(1);
      octx.beginPath();
      octx.moveTo(x1,y1); octx.lineTo(ax+nx*off*0.25,ay+ny*off*0.25);
      octx.moveTo(x2,y2); octx.lineTo(bx+nx*off*0.25,by+ny*off*0.25);
      octx.stroke();
      VIEW.arrow(octx,ax,ay,bx,by,css('--measure'));
      VIEW.arrow(octx,bx,by,ax,ay,css('--measure'));
      VIEW.label(octx,`${L.toFixed(2)} м`,(ax+bx)/2,(ay+by)/2,-16,-8,css('--measure'));
    } else if(an.type==='circle'){
      const [cx0,cy0,px2,py2]=an.p, R=Math.hypot(px2-cx0,py2-cy0);
      octx.strokeStyle=css('--second'); octx.lineWidth=VIEW.lw(1.4);
      octx.beginPath(); octx.arc(cx0,cy0,R,0,7); octx.stroke();
      octx.setLineDash([VIEW.lw(3),VIEW.lw(3)]);
      octx.beginPath(); octx.moveTo(cx0,cy0); octx.lineTo(px2,py2); octx.stroke();
      octx.setLineDash(EMPTY_DASH);
      VIEW.label(octx,`R = ${R.toFixed(2)} м   S = ${(Math.PI*R*R).toFixed(2)} м²`,cx0,cy0,8,-10,css('--second'));
    } else if(an.type==='angle'&&an.pts.length>=2){
      // транспортир: вершина — вторая точка
      const P=an.pts, col=css('--accent');
      octx.strokeStyle=col; octx.lineWidth=VIEW.lw(1.4);
      octx.beginPath(); P.forEach((q,i)=>i?octx.lineTo(q[0],q[1]):octx.moveTo(q[0],q[1])); octx.stroke();
      if(P.length>=3){
        const [A1,V0,B1]=P;
        const a1=Math.atan2(A1[1]-V0[1],A1[0]-V0[0]), a2=Math.atan2(B1[1]-V0[1],B1[0]-V0[0]);
        let d=a2-a1; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
        const R=Math.min(Math.hypot(A1[0]-V0[0],A1[1]-V0[1]),Math.hypot(B1[0]-V0[0],B1[1]-V0[1]))*0.4;
        octx.beginPath();
        for(let i=0;i<=30;i++){ const t=a1+d*i/30, x=V0[0]+R*Math.cos(t), y=V0[1]+R*Math.sin(t); i?octx.lineTo(x,y):octx.moveTo(x,y); }
        octx.stroke();
        VIEW.label(octx,`${Math.abs(d*180/Math.PI).toFixed(1)}°`,V0[0]+R*Math.cos(a1+d/2),V0[1]+R*Math.sin(a1+d/2),8,-6,col);
      }
    } else if(an.type==='area'&&an.pts.length>=2){
      const P=an.pts, col=css('--second');
      octx.strokeStyle=col; octx.lineWidth=VIEW.lw(1.4);
      octx.beginPath(); P.forEach((q,i)=>i?octx.lineTo(q[0],q[1]):octx.moveTo(q[0],q[1]));
      if(P.length>=3){
        octx.closePath();
        octx.fillStyle=col; octx.globalAlpha=.14; octx.fill(); octx.globalAlpha=1;
      }
      octx.stroke();
      if(P.length>=3){
        // площадь по формуле шнурования (Гаусса)
        let S2=0, cx0=0, cy0=0;
        for(let i=0;i<P.length;i++){ const j=(i+1)%P.length; S2+=P[i][0]*P[j][1]-P[j][0]*P[i][1]; cx0+=P[i][0]; cy0+=P[i][1]; }
        let per=0; for(let i=0;i<P.length;i++){ const j=(i+1)%P.length; per+=Math.hypot(P[j][0]-P[i][0],P[j][1]-P[i][1]); }
        VIEW.label(octx,`S = ${Math.abs(S2/2).toFixed(2)} м²   P = ${per.toFixed(2)} м`,
          cx0/P.length,cy0/P.length,-40,0,col);
      }
    } else if(an.type==='note'){
      const [x,y]=an.p, col=css('--measure');
      octx.fillStyle=col; octx.beginPath(); octx.arc(x,y,VIEW.lw(3),0,7); octx.fill();
      VIEW.label(octx,an.text,x,y,10,-8,col);
    } else if(an.type==='guide'){
      const [x,y]=an.p;
      const [wx0,wy1]=toWorld(0,0), [wx1,wy0]=toWorld(CW,CH);
      octx.strokeStyle=css('--accent'); octx.globalAlpha=.55;
      octx.lineWidth=VIEW.lw(1); octx.setLineDash([VIEW.lw(6),VIEW.lw(4)]);
      octx.beginPath();
      if(an.dir==='v'){ octx.moveTo(x,wy0); octx.lineTo(x,wy1); }
      else { octx.moveTo(wx0,y); octx.lineTo(wx1,y); }
      octx.stroke(); octx.setLineDash(EMPTY_DASH); octx.globalAlpha=1;
      VIEW.label(octx,an.dir==='v'?`x = ${x.toFixed(2)}`:`y = ${y.toFixed(2)}`,
        an.dir==='v'?x:wx0, an.dir==='v'?wy0:y, 6, -6, css('--accent'));
    } else if(an.type==='marquee'){
      const [x1,y1,x2,y2]=an.p;
      octx.strokeStyle=css('--accent'); octx.lineWidth=VIEW.lw(1);
      octx.setLineDash([VIEW.lw(4),VIEW.lw(3)]);
      octx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));
      octx.setLineDash(EMPTY_DASH);
    }
  }
  // координаты под курсором
  if(S.coords&&S.mouse){
    const col=css('--ink-3'), {x,y}=S.mouse;
    octx.strokeStyle=col; octx.globalAlpha=.45; octx.lineWidth=VIEW.lw(1);
    octx.setLineDash([VIEW.lw(3),VIEW.lw(3)]);
    const [wx0,wy1]=toWorld(0,0), [wx1,wy0]=toWorld(CW,CH);
    octx.beginPath();
    octx.moveTo(wx0,y); octx.lineTo(wx1,y); octx.moveTo(x,wy0); octx.lineTo(x,wy1);
    octx.stroke(); octx.setLineDash(EMPTY_DASH); octx.globalAlpha=1;
    VIEW.label(octx,`${x.toFixed(2)} ; ${y.toFixed(2)} м`,x,y,10,-10,col);
  }
  // отметка пробника
  if(S.probe){
    const col=css('--danger'), {x,y}=S.probe;
    octx.strokeStyle=col; octx.lineWidth=VIEW.lw(1.2);
    const r=VIEW.lw(7);
    octx.beginPath(); octx.moveTo(x-r,y); octx.lineTo(x+r,y); octx.moveTo(x,y-r); octx.lineTo(x,y+r); octx.stroke();
    octx.beginPath(); octx.arc(x,y,r*0.55,0,7); octx.stroke();
    VIEW.label(octx,S.probe.text,x,y,10,-12,col);
  }
  /* След за телами: копим позиции якорей и рисуем путь. Инструмент общий —
     работает в любой симуляции, объявляющей anchors(). */
  if(S.trace&&a.def.anchors){
    const pts=a.def.anchors(a.state,a.params)||[];
    a.tracePts=a.tracePts||[];
    if(S.playing){
      pts.forEach((q,i)=>{
        (a.tracePts[i]=a.tracePts[i]||[]).push([q.x,q.y]);
        if(a.tracePts[i].length>900) a.tracePts[i].shift();
      });
    }
    const cols=[css('--accent'),css('--second'),css('--measure'),css('--danger')];
    a.tracePts.forEach((path,i)=>{
      if(!path||path.length<2) return;
      octx.strokeStyle=cols[i%cols.length]; octx.globalAlpha=.55;
      octx.lineWidth=VIEW.lw(1.4); octx.lineJoin='round';
      octx.beginPath(); path.forEach((q,j)=>j?octx.lineTo(q[0],q[1]):octx.moveTo(q[0],q[1]));
      octx.stroke(); octx.globalAlpha=1;
    });
  }
  /* Ручки перетаскивания. Постоянные кружки засоряли рисунок, поэтому по
     умолчанию их видно только под курсором: подвели мышь к точке — ручка
     появилась, увели — исчезла. Режим задаётся настройкой «Ручки
     перетаскивания»: под курсором / всегда / никогда. */
  const hMode=prefGet('handles');
  if(a.def.dragPoints && hMode!=='never' && (S.tool==='cursor'||S.tool==='pan')){
    let pts=[]; try{ pts=a.def.dragPoints(a.params)||[]; }catch(_){}
    for(const q of pts){
      if(!isFinite(q.x)||!isFinite(q.y)) continue;
      if(hMode!=='always'){
        const held=drag&&drag.mode==='dragpt';           // пока тянем — ручка видна
        let near=held;
        if(!near&&S.ptr){
          const sp=toScreen(q.x,q.y);
          near=Math.hypot(sp[0]-S.ptr.px,sp[1]-S.ptr.py)<26;
        }
        if(!near) continue;
      }
      const rr=VIEW.lw(6.5);
      octx.fillStyle=css('--accent'); octx.globalAlpha=.16;
      octx.beginPath(); octx.arc(q.x,q.y,rr,0,7); octx.fill();
      octx.globalAlpha=1;
      octx.strokeStyle=css('--accent'); octx.lineWidth=VIEW.lw(1.6);
      octx.beginPath(); octx.arc(q.x,q.y,rr,0,7); octx.stroke();
      octx.beginPath();
      octx.moveTo(q.x-rr*0.45,q.y); octx.lineTo(q.x+rr*0.45,q.y);
      octx.moveTo(q.x,q.y-rr*0.45); octx.lineTo(q.x,q.y+rr*0.45);
      octx.stroke();
    }
  }
  if(S.snap&&S.tool!=='pan'){
    octx.fillStyle=css('--measure'); octx.globalAlpha=.7;
    for(const an of (a.def.anchors?a.def.anchors(a.state,a.params):[])){
      octx.beginPath(); octx.arc(an.x,an.y,VIEW.lw(3.5),0,7); octx.fill();
    }
    octx.globalAlpha=1;
  }
  drawSceneChrome(a);
  updateEnergyBox(a);
  $('#btn-makeout').style.display = a.def.makeOutput ? '' : 'none';
  updateHistoBox(a);
  updatePVBox(a);
  const w=a.def.warn?a.def.warn(a.params,a.state):null;
  const wb=$('#warnbar');
  const showW = w && S.settings.events!==false;
  if((showW?w:'')!==wb.dataset.msg){ wb.dataset.msg=showW?w:''; wb.textContent=showW?w:''; wb.classList.toggle('hidden',!showW); }
  updateHud(a);
  $('#clock').textContent=`t = ${a.state.t.toFixed(2)} c`;
}

/* ================= ОБВЯЗКА СЦЕНЫ =================
   Пять необязательных слоёв поверх картинки, каждый со своим выключателем в
   настройках: оси координат, линейки по краям кадра, перекрестие курсора,
   мини-карта и заголовок сцены. Всё рисуется в ЭКРАННЫХ координатах на слое
   пометок — поэтому не зависит от зума и не мешает самой симуляции. */
function drawSceneChrome(a){
  const on=k=>prefGet(k)!==false;
  if(!on('axes')&&!on('edgeRuler')&&!on('crosshair')&&!on('miniMap')&&!on('sceneTitle')) return;
  octx.save(); octx.setTransform(DPR,0,0,DPR,0,0);
  octx.font='10px ui-monospace,monospace'; octx.textBaseline='middle';
  const ink3=css('--ink-3'), line=css('--line'), acc=css('--accent');
  const k=ppm();

  // --- оси координат: где в кадре начало отсчёта и куда растут x и y
  if(on('axes')){
    const o=toScreen(0,0);
    octx.strokeStyle=ink3; octx.globalAlpha=.55; octx.lineWidth=1;
    if(o[1]>=0&&o[1]<=CH){ octx.beginPath(); octx.moveTo(0,o[1]); octx.lineTo(CW,o[1]); octx.stroke(); }
    if(o[0]>=0&&o[0]<=CW){ octx.beginPath(); octx.moveTo(o[0],0); octx.lineTo(o[0],CH); octx.stroke(); }
    octx.globalAlpha=1;
    if(o[0]>=0&&o[0]<=CW&&o[1]>=0&&o[1]<=CH){
      octx.fillStyle=ink3;
      octx.fillText('0',o[0]+4,o[1]+9);
      octx.fillText('x',Math.min(CW-10,o[0]+42),o[1]-7);
      octx.fillText('y',o[0]+7,Math.max(9,o[1]-42));
    }
  }

  // --- линейки по краям кадра, как в графических редакторах
  if(on('edgeRuler')){
    const step=gridStep(), T=15;
    octx.globalAlpha=.86; octx.fillStyle=css('--panel');
    octx.fillRect(0,0,CW,T); octx.fillRect(0,0,T,CH); octx.globalAlpha=1;
    octx.strokeStyle=line; octx.lineWidth=1; octx.globalAlpha=.8;
    octx.beginPath(); octx.moveTo(0,T+.5); octx.lineTo(CW,T+.5);
    octx.moveTo(T+.5,0); octx.lineTo(T+.5,CH); octx.stroke(); octx.globalAlpha=1;
    octx.fillStyle=ink3;
    const [wx0,wy1]=toWorld(0,0), [wx1,wy0]=toWorld(CW,CH);
    for(let i=Math.ceil(wx0/step)*step;i<=wx1;i+=step){
      const sx=toScreen(i,0)[0]; if(sx<T) continue;
      octx.strokeStyle=line; octx.beginPath(); octx.moveTo(sx,T-4); octx.lineTo(sx,T); octx.stroke();
      octx.fillText(fmtShort(i),sx+2,7);
    }
    for(let j=Math.ceil(wy0/step)*step;j<=wy1;j+=step){
      const sy=toScreen(0,j)[1]; if(sy<T) continue;
      octx.strokeStyle=line; octx.beginPath(); octx.moveTo(T-4,sy); octx.lineTo(T,sy); octx.stroke();
      octx.save(); octx.translate(7,sy); octx.rotate(-Math.PI/2);
      octx.textAlign='center'; octx.fillText(fmtShort(j),0,0); octx.restore(); octx.textAlign='left';
    }
  }

  // --- перекрестие через весь кадр: точное прицеливание, как в CAD
  if(on('crosshair')&&S.ptr){
    octx.strokeStyle=acc; octx.globalAlpha=.3; octx.lineWidth=1;
    octx.setLineDash([4,4]);
    octx.beginPath();
    octx.moveTo(0,S.ptr.py+.5); octx.lineTo(CW,S.ptr.py+.5);
    octx.moveTo(S.ptr.px+.5,0); octx.lineTo(S.ptr.px+.5,CH);
    octx.stroke(); octx.setLineDash([]); octx.globalAlpha=1;
  }

  // --- мини-карта: где мы находимся относительно всей сцены
  if(on('miniMap')){
    let box=null;
    try{
      const pts=(a.def.anchors?a.def.anchors(a.state,a.params):[])||[];
      if(pts.length){
        const xs=pts.map(q=>q.x).filter(isFinite), ys=pts.map(q=>q.y).filter(isFinite);
        if(xs.length) box={x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
      }
    }catch(_){}
    if(box){
      const [vx0,vy1]=toWorld(0,0), [vx1,vy0]=toWorld(CW,CH);
      const wx0=Math.min(box.x0,vx0), wx1=Math.max(box.x1,vx1);
      const wy0=Math.min(box.y0,vy0), wy1=Math.max(box.y1,vy1);
      const wW=Math.max(wx1-wx0,1e-6), wH=Math.max(wy1-wy0,1e-6);
      const MW=86, MH=Math.max(34,Math.min(70,MW*wH/wW));
      const mx=CW-MW-8, my=CH-MH-8;
      const sc=Math.min(MW/wW,MH/wH);
      const P=(x,y)=>[mx+MW/2+(x-(wx0+wx1)/2)*sc, my+MH/2-(y-(wy0+wy1)/2)*sc];
      octx.globalAlpha=.82; octx.fillStyle=css('--panel'); octx.fillRect(mx,my,MW,MH); octx.globalAlpha=1;
      octx.strokeStyle=line; octx.lineWidth=1; octx.strokeRect(mx+.5,my+.5,MW,MH);
      const b0=P(box.x0,box.y1), b1=P(box.x1,box.y0);
      octx.strokeStyle=ink3; octx.globalAlpha=.7;
      octx.strokeRect(b0[0],b0[1],Math.max(2,b1[0]-b0[0]),Math.max(2,b1[1]-b0[1]));
      octx.globalAlpha=1;
      const v0=P(vx0,vy1), v1=P(vx1,vy0);
      octx.strokeStyle=acc; octx.lineWidth=1.4;
      octx.strokeRect(v0[0],v0[1],Math.max(3,v1[0]-v0[0]),Math.max(3,v1[1]-v0[1]));
    }
  }

  // --- заголовок сцены: чтобы снимок экрана был самодостаточным
  if(on('sceneTitle')){
    const t=a.def.title||'';
    octx.font='11px ui-monospace,monospace'; octx.fillStyle=ink3;
    const w=octx.measureText(t).width;
    octx.fillText(t,Math.max(4,(CW-w)/2),CH-8);
  }
  octx.restore();
}
/* короткая подпись деления линейки: 2.5 вместо 2.50, 1e3 вместо 1000 */
function fmtShort(v){
  if(Math.abs(v)<1e-9) return '0';
  if(Math.abs(v)>=1e4||Math.abs(v)<1e-3) return (+v).toExponential(0);
  return String(+(+v).toFixed(2));
}
/* Панель показаний. Уменьшая её, пользователь раньше получал полосу прокрутки
   внутри крошечного окошка — прокручивать её мышью на сцене неудобно, да и
   выглядит чужеродно. Теперь полосы нет: сколько строк влезло, столько и
   показано, а про остальные честно сказано в последней строке. */
function updateHud(a){
  const body=$('#hud-body'), panel=$('#hud'); if(!body||!panel) return;
  const rows=a.def.readouts(a.state,a.params)
    .map(([l,v,u])=>`${l.padEnd(14)} ${fmt(v).padStart(9)} ${u}`);
  const lh=parseFloat(getComputedStyle(body).lineHeight)||17;
  /* Обрезаем строки, только если размер панели чем-то ОГРАНИЧЕН: явной высотой
     (пользователь потянул за уголок) или max-height из темы (на телефоне).
     Мерить при этом надо по самому ограничению, а не по фактической высоте:
     содержимое влияет на высоту, высота — на число строк, и получилась бы
     петля, в которой панель ужимается до одной строки. И не по положению:
     перетащив панель вниз, пользователь просил её подвинуть, а не сократить. */
  const head=panel.querySelector('.fp-head');
  const headH=head?head.offsetHeight:0;
  let avail=Infinity;
  if(panel.style.height) avail=parseFloat(panel.style.height)-headH-13;
  else {
    const mh=parseFloat(getComputedStyle(panel).maxHeight);
    if(isFinite(mh)) avail=mh-headH-13;
  }
  let n=rows.length;
  if(isFinite(avail) && avail>0 && lh>0){
    const fits=Math.floor(avail/lh);
    if(fits<rows.length) n=Math.max(1,fits-1);       // строка «ещё N» тоже место занимает
  }
  body.textContent = n>=rows.length ? rows.join('\n')
    : rows.slice(0,n).concat([`… ещё ${rows.length-n} — растяните панель`]).join('\n');
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
  /* Ось времени строится по РЕАЛЬНОМУ диапазону истории, а не от нуля.
     Раньше начало оси было жёстко привязано к t = 0, и стоило первой точке
     истории уехать вперёд, как кривая переставала доставать до левого края. */
  const t0=H[0].t, tMax=Math.max(H[H.length-1].t,t0+1e-3);
  const span=Math.max(tMax-t0,1e-3);
  a.def.graphs.forEach((g,gi)=>{
    const cv=gcanvas[gi], ctx=cv.getContext('2d');
    const W=cv.width/DPR, Hh=cv.height/DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,Hh);
    let lo=Infinity,hi=-Infinity;
    for(const h of H) for(const y of h.v[gi]) if(y!==null&&isFinite(y)){ if(y<lo)lo=y; if(y>hi)hi=y; }
    if(!isFinite(lo)) return;
    if(hi-lo<1e-6){ hi+=1; lo-=1; }
    const pad=(hi-lo)*0.15; lo-=pad; hi+=pad;
    const X=t=>(t-t0)/span*(W-4)+2, Y=y=>Hh-4-(y-lo)/(hi-lo)*(Hh-8);
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
    // если начало истории уже не в нуле, честно показываем видимый интервал
    const tlab = t0>0.05 ? `${t0.toFixed(1)}…${tMax.toFixed(1)} c` : `t=${tMax.toFixed(1)} c`;
    ctx.fillText(tlab,W-6-ctx.measureText(tlab).width,Hh-3);
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
  const scrubbing=S.scrub!==null&&S.scrub!==undefined;   // на перемотке расчёт стоит
  if(a&&S.playing&&!idle&&!scrubbing){
    acc+=Math.min(raw,0.05)*S.speed;                       // ускорение/замедление времени
    const budget=Math.ceil(1200*Math.max(1,S.speed));      // шагов за кадр
    let g=0;
    while(acc>=DT&&g++<budget&&S.playing){
      a.def.step(a.state,DT,a.params); acc-=DT;
      if(++a.tick%(+S.settings.graphEvery||6)===0) record(a);
      if(a.state.__stop){
        const ty=a.state.event&&a.state.event.type;
        a.state.done=a.state.done||{};
        if(a.state.done[ty]){ a.state.__stop=null; a.state.event=null; continue; }  // уже показывали
        a.state.done[ty]=true; record(a);
        if(S.loop){ restart(a); S.playing=true; setPlayIcon(); break; }   // зацикливание
        stopEvent(a); break;
      }
    }
  }
  if(a&&!idle){ drawAll(); drawGraphs(); updateCompare(); updateTimeline(); }
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
  $('#histo-body').innerHTML=`<div class="hbars">`+
    cnt.map(c=>`<div class="hb" style="height:${(c/maxC*100).toFixed(0)}%"></div>`).join('')+`</div>`+
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
  $('#energy-body').innerHTML=`<div class="tot">полная<br>${E.tot.toFixed(0)} Дж</div>`+
    bars.map(([lab,val,col])=>`<div class="ebar">
      <div class="val">${val.toFixed(0)}</div>
      <div class="track"><div class="fill" style="height:${(Math.abs(val)/tot*100).toFixed(1)}%;background:${col}"></div></div>
      <div class="lab">${lab}</div></div>`).join('');
  box.classList.remove('hidden');
}
function record(a){
  if(a.def.graphs){
    a.hist.push({t:a.state.t, v:a.def.graphs.map(g=>g.get(a.state,a.params))});
    /* Переполнение истории раньше выбрасывало САМЫЕ СТАРЫЕ точки: на длинном
       прогоне начало кривой пропадало, а сама кривая уползала вправо, потому
       что ось по-прежнему начиналась от нуля. Теперь вместо выбрасывания мы
       ПРОРЕЖИВАЕМ старшую половину — весь прогон остаётся на экране, просто в
       старой части шаг по времени вдвое крупнее (так делают самописцы). */
    if(a.hist.length>4000){
      const half=a.hist.length>>1, kept=[];
      for(let i=0;i<half;i+=2) kept.push(a.hist[i]);
      a.hist=kept.concat(a.hist.slice(half));
    }
  }
  /* Лента состояний для шкалы времени: храним снимки самого state, чтобы
     можно было отмотать расчёт назад и рассмотреть момент. Снимки берём
     реже, чем точки графиков, — иначе память растёт слишком быстро. */
  if(prefGet('timeline')!==false){
    a.tape=a.tape||[];
    const last=a.tape[a.tape.length-1];
    if(!last || a.state.t-last.t>=0.02){
      try{ a.tape.push({t:a.state.t, s:JSON.stringify(a.state)}); }catch(_){}
      if(a.tape.length>900) a.tape.shift();
    }
  }
}
function stopEvent(a){
  const msg=a.state.__stop; a.state.__stop=null; acc=0;
  // по настройке событие может лишь помечаться плашкой, не останавливая время
  if(prefGet('eventPause')!==false){ S.playing=false; setPlayIcon(); }
  const f=$('#eventflag'); f.textContent=msg; f.classList.remove('hidden');
  toast(msg);
}

/* ============================== ДЕРЕВО ТЕМ ============================== */
/* Избранные симуляции — быстрый доступ через палитру (клавиша J). */
function toggleFav(id){
  if(!id){ toast('Сначала откройте симуляцию'); return; }
  const i=S.favs.indexOf(id);
  i<0? S.favs.push(id) : S.favs.splice(i,1);
  LS.set('favs',S.favs);
  toast((i<0?'В избранное: ':'Убрано из избранного: ')+(SIMS[id]?SIMS[id].title:id));
}
/* Закладка на тему: используется и звёздочкой в дереве, и клавишей S. */
function toggleMark(id){
  if(!id) return;
  const i=S.marks.indexOf(id);
  i<0? S.marks.push(id) : S.marks.splice(i,1);
  LS.set('marks',S.marks);
  renderTree($('#search').value);
  const t=ALL.find(x=>x.id===id);
  toast((i<0?'В закладки: ':'Убрано из закладок: ')+(t?t.title:id));
}
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
      st.onclick=e=>{ e.stopPropagation(); toggleMark(t.id); };
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
  // список недавних тем — для быстрого возврата через палитру
  S.recent=[t.id].concat((S.recent||[]).filter(x=>x!==t.id)).slice(0,12);
  LS.set('recent',S.recent);
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
  // симуляция темы открывается сама; на телефоне это поведение настраивается
  if(sims.length && !sims.includes(S.active)){
    if(isNarrow() && prefGet('mAutoOpen')===false){
      // готовим симуляцию (панели, параметры), но конспект не перекрываем
      S.active=sims[0]; rt(S.active); sel.value=sims[0];
      renderParams(); buildGraphs(); renderPresets();
      closeSimMobile();
    } else openSim(sims[0]);
  }
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
  S.probe=null; a.tracePts=[];
  renderParams(); buildGraphs(); renderPresets(); renderSimTools(); renderSectTools();
  try{ syncMbar(); }catch(_){}
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
          <!-- text, а не number: браузер отбрасывает у number всё нечисловое,
               и выражения вида «2*9.8» просто не доходили бы до обработчика.
               inputmode="decimal" всё равно поднимает числовую клавиатуру. -->
          <input type="text" inputmode="decimal" data-num="1"
                 step="${p.step}" min="${p.min}" max="${p.max}" value="${a.params[p.key]}">
          <button class="inc" tabindex="-1">+</button>
        </div><div class="unit">${p.unit||''}</div>`;
      const inp=d.querySelector('input');
      const put=v=>{ if(Number.isNaN(v)) v=p.default; v=clamp(round(v,p.step),p.min,p.max); inp.value=v; commit(p.key,v); };
      /* Поле принимает не только число, но и выражение: «2*9.8», «1/3», «5+2».
         Так работают числовые поля в Blender и CAD — считать в уме не нужно. */
      const evalNum=str=>{
        const s=String(str).replace(',','.').trim();
        if(/^[-+]?[\d.]+(e[-+]?\d+)?$/i.test(s)) return parseFloat(s);
        if(!/^[-+*/().\d\s eE]+$/.test(s)) return NaN;      // только арифметика
        try{ const r=Function('"use strict";return('+s+')')(); return typeof r==='number'&&isFinite(r)?r:NaN; }
        catch(_){ return NaN; }
      };
      inp.onchange=()=>put(evalNum(inp.value));
      inp.onkeydown=e=>{
        e.stopPropagation();
        if(e.key==='Enter'){ inp.blur(); return; }
        // стрелки меняют значение шагами, с Shift — в десять раз крупнее
        if(e.key==='ArrowUp'||e.key==='ArrowDown'){
          e.preventDefault();
          const st=p.step*(e.shiftKey?10:1)*(e.key==='ArrowUp'?1:-1);
          put((evalNum(inp.value)||0)+st);
        }
      };
      // колесо над полем тоже меняет значение — привычно по CAD
      inp.addEventListener('wheel',e=>{
        if(document.activeElement!==inp) return;
        e.preventDefault();
        put((evalNum(inp.value)||0)+p.step*(e.shiftKey?10:1)*(e.deltaY<0?1:-1));
      },{passive:false});
      d.querySelector('.dec').onclick=()=>put(+inp.value-p.step);
      d.querySelector('.inc').onclick=()=>put(+inp.value+p.step);
      // средняя кнопка по строке параметра — вернуть значение по умолчанию
      d.addEventListener('auxclick',e=>{ if(e.button===1){ e.preventDefault(); put(p.default); toast(p.label+': по умолчанию'); } });
      d.title=`допустимый диапазон: ${p.min} … ${p.max}\nможно вписать выражение (2*9.8), стрелки и колесо меняют шагами, средняя кнопка — сброс`;
    }
    // помечаем параметры, изменённые относительно значения по умолчанию
    if(p.default!==undefined && String(a.params[p.key])!==String(p.default))
      d.classList.add('changed');
    d.dataset.search=(p.label+' '+(p.unit||'')).toLowerCase();
    box.append(d);
  }
  applyParamFilter();
}
/* Фильтр по названию параметра — у симуляций с полусотней полей это спасает. */
function applyParamFilter(){
  const q=(($('#pfilter')&&$('#pfilter').value)||'').trim().toLowerCase();
  document.querySelectorAll('#params .param').forEach(d=>{
    d.classList.toggle('hide', !!q && !(d.dataset.search||'').includes(q));
  });
  // заголовки групп прячем, если в группе ничего не осталось
  const kids=[...document.querySelectorAll('#params > *')];
  kids.forEach((el,i)=>{
    if(!el.classList.contains('pgroup')) return;
    let any=false;
    for(let j=i+1;j<kids.length;j++){
      if(kids[j].classList.contains('pgroup')) break;
      if(!kids[j].classList.contains('hide')){ any=true; break; }
    }
    el.style.display=any?'':'none';
  });
}
if($('#pfilter')){
  $('#pfilter').oninput=applyParamFilter;
  $('#pfilter').onkeydown=e=>{ e.stopPropagation(); if(e.key==='Escape'){ e.target.value=''; applyParamFilter(); } };
}
if($('#btn-pdefaults')) $('#btn-pdefaults').onclick=()=>{
  const a=A(); if(!a) return;
  for(const p of a.def.params) if(p.type!=='group') a.params[p.key]=p.default;
  pushUndo(a); restart(a); renderParams(); buildGraphs(); toast('Параметры сброшены к исходным');
};
if($('#btn-prand')) $('#btn-prand').onclick=()=>{
  const a=A(); if(!a) return;
  /* Случайные значения — чтобы быстро «пощупать» диапазон. Берём только
     числовые поля и держимся середины диапазона, иначе легко получить
     физически бессмысленную комбинацию. */
  for(const p of a.def.params){
    if(p.type==='group'||p.type==='check'||p.type==='select') continue;
    if(p.min===undefined||p.max===undefined) continue;
    const lo=p.min+(p.max-p.min)*0.15, hi=p.min+(p.max-p.min)*0.85;
    a.params[p.key]=round(lo+Math.random()*(hi-lo), p.step||0.1);
  }
  pushUndo(a); restart(a); renderParams(); buildGraphs(); toast('Случайные параметры — Ctrl+Z вернёт');
};
const round=(v,step)=>{ const dg=(String(step).split('.')[1]||'').length; return +(+v).toFixed(dg); };
function commit(key,val){
  const a=A(); if(!a) return;
  a.params[key]=val;
  restart(a); fitView();
  pushUndo(a);
}
/* Запись текущих параметров в историю Undo (общая точка для commit,
   сброса к умолчаниям и случайных значений). */
function pushUndo(a){
  a=a||A(); if(!a) return;
  const s=JSON.stringify(a.params);
  if(a.undo[a.undo.length-1]!==s){ a.undo.push(s); if(a.undo.length>60) a.undo.shift(); a.redo=[]; }
}
function restart(a){
  a.state=a.def.init(a.params); a.hist=[]; a.tick=0; acc=0;
  a.tape=[]; S.scrub=null; updateTimeline();
  $('#eventflag').classList.add('hidden');
}

/* ======================= ШКАЛА ВРЕМЕНИ (перемотка) =======================
   Пока идёт расчёт, ползунок стоит в конце и просто показывает время. Стоит
   потянуть его — включается режим просмотра (S.scrub): состояние берётся из
   ленты снимков, расчёт при этом стоит. Кнопка «живой расчёт» возвращает
   всё как было. Похоже на таймлайн видеоредактора. */
function updateTimeline(){
  const a=A(), tl=$('#timeline'); if(!tl) return;
  const on=prefGet('timeline')!==false && !!a;
  tl.classList.toggle('hidden',!on);
  if(!on) return;
  const tape=a.tape||[];
  const r=$('#tl-range');
  r.max=String(Math.max(0,tape.length-1));
  const scrubbing=S.scrub!==null&&S.scrub!==undefined;
  if(!scrubbing) r.value=String(Math.max(0,tape.length-1));
  tl.classList.toggle('scrub',scrubbing);
  const t=scrubbing? (tape[S.scrub]?tape[S.scrub].t:0) : (a.state.t||0);
  $('#tl-time').textContent=(scrubbing?'◀ ':'')+`t = ${t.toFixed(2)} c`;
}
function scrubTo(i){
  const a=A(); if(!a||!a.tape||!a.tape.length) return;
  const idx=clamp(Math.round(i),0,a.tape.length-1);
  S.scrub=idx;
  try{ a.state=JSON.parse(a.tape[idx].s); }catch(_){}
  if(S.playing){ S.playing=false; setPlayIcon(); }
  $('#tl-range').value=String(idx);
  updateTimeline();
}
function scrubLive(){
  const a=A(); if(!a) return;
  if(S.scrub!==null&&S.scrub!==undefined&&a.tape&&a.tape.length){
    // возвращаемся к последнему рассчитанному состоянию
    try{ a.state=JSON.parse(a.tape[a.tape.length-1].s); }catch(_){}
  }
  S.scrub=null; updateTimeline();
}
if($('#tl-range')){
  $('#tl-range').addEventListener('input',e=>scrubTo(+e.target.value));
  $('#tl-range').addEventListener('keydown',e=>e.stopPropagation());
  $('#tl-prev').onclick=()=>{ const a=A(); if(!a||!a.tape) return;
    scrubTo((S.scrub===null||S.scrub===undefined? a.tape.length-1 : S.scrub)-1); };
  $('#tl-next').onclick=()=>{ const a=A(); if(!a||!a.tape) return;
    scrubTo((S.scrub===null||S.scrub===undefined? a.tape.length-1 : S.scrub)+1); };
  $('#tl-live').onclick=()=>{ scrubLive(); toast('Живой расчёт'); };
  $('#tl-loop').onclick=()=>{ S.loop=!S.loop; LS.set('loop',S.loop);
    $('#tl-loop').classList.toggle('on',S.loop);
    toast('Зацикливание: '+(S.loop?'вкл — по событию сброс и заново':'выкл')); };
  $('#tl-loop').classList.toggle('on',S.loop);
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
/* Ни выделения, ни нативного перетаскивания в области сцены: браузер иначе
   принимает движение мыши по панели за протягивание выделенного текста и
   тащит его как файл. CSS user-select это уже запрещает, но два обработчика
   нужны для случаев, когда выделение началось ВНЕ сцены и дотянулось до неё. */
$('#cwrap').addEventListener('dragstart',e=>e.preventDefault());
$('#cwrap').addEventListener('selectstart',e=>{
  if(e.target.closest('input,textarea,[contenteditable]')) return;   // поля ввода не трогаем
  e.preventDefault();
});

/* Любой клик мимо текстового поля снимает случайное выделение. Раньше оно
   снималось только кликом по конспекту (там выделение начинается заново), а
   ткнув в сцену, панель или кнопку, убрать подсветку было нечем. */
document.addEventListener('pointerdown',e=>{
  if(e.target.closest&&e.target.closest('input,textarea,[contenteditable]')) return;
  const sel=window.getSelection&&window.getSelection();
  if(sel&&!sel.isCollapsed) sel.removeAllRanges();
},true);

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
  /* Панорама: средняя кнопка, Shift+ЛКМ и ПРАВАЯ кнопка (как в CAD).
     Раньше правая кнопка не панорамировала вовсе, зато успевала схватить
     точку симуляции и одновременно открыть контекстное меню. */
  if(e.button===1||e.button===2||e.shiftKey){
    drag={mode:'pan',px,py,vx:a.view.x,vy:a.view.y,rmb:e.button===2,moved:false};
    try{ e.currentTarget.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId); }catch(_){}
    return;
  }
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
  if(a.def.dragPoints && e.button===0 && (S.tool==='cursor'||S.tool==='pan')){
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
  else if(S.tool==='ruler'||S.tool==='vector'||S.tool==='dim'||S.tool==='circle'){
    a.draft={type:S.tool,p:[sx,sy,sx,sy]}; drag={mode:'draw'};
  }
  else if(S.tool==='eraser'){ annSnapshot(a); erase(wx,wy); drag={mode:'erase'}; }
  else if(S.tool==='marquee'){ drag={mode:'marquee',x0:wx,y0:wy}; a.draft={type:'marquee',p:[wx,wy,wx,wy]}; }
  else if(S.tool==='probe'){ probeAt(wx,wy); drag={mode:'probe'}; }
  else if(S.tool==='guide'){
    annSnapshot(a);
    // ЛКМ — горизонтальная направляющая, с Alt — вертикальная
    a.annos.push({type:'guide',p:[sx,sy],dir:e.altKey?'v':'h'});
    toast(e.altKey?'Вертикальная направляющая':'Горизонтальная направляющая (Alt — вертикальная)');
  }
  else if(S.tool==='note'){
    const txt=prompt('Текст заметки:');
    if(txt&&txt.trim()){ annSnapshot(a); a.annos.push({type:'note',p:[sx,sy],text:txt.trim()}); }
  }
  else if(S.tool==='angle'||S.tool==='area'){
    /* Многоточечные инструменты: копим вершины кликами, замыкаем двойным
       кликом, клавишей Enter или (для угла) третьей точкой. */
    if(!a.draft||a.draft.type!==S.tool) a.draft={type:S.tool,pts:[]};
    a.draft.pts.push([sx,sy]);
    if(S.tool==='angle'&&a.draft.pts.length===3){ annSnapshot(a); a.annos.push(a.draft); a.draft=null; }
    else if(S.tool==='area'&&e.detail>=2&&a.draft.pts.length>=4){
      a.draft.pts.pop(); annSnapshot(a); a.annos.push(a.draft); a.draft=null;
    }
  }
});
/* Пробник: показывает координаты точки и величины симуляции в ней */
function probeAt(wx,wy){
  const a=A(); if(!a) return;
  const parts=[`x = ${wx.toFixed(3)} м`,`y = ${wy.toFixed(3)} м`];
  if(a.def.probe){ try{ for(const [l,v,u] of a.def.probe(a.state,a.params,wx,wy)) parts.push(`${l} = ${fmt(v)} ${u||''}`.trim()); }catch(_){} }
  const txt=parts.join('   ');
  S.probe={x:wx,y:wy,text:txt};
  copyText(txt.replace(/\s{2,}/g,'; '));
  toast(txt+' — скопировано');
}
addEventListener('pointermove',e=>{
  const a=A(); if(!drag||!a) return;
  const r=scene.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  const [wx,wy]=toWorld(px,py);
  if(drag.mode==='pan'){
    if(Math.hypot(px-drag.px,py-drag.py)>3) drag.moved=true;
    a.view.x=drag.vx-(px-drag.px)/ppm(); a.view.y=drag.vy+(py-drag.py)/ppm();
  }
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
  else if(drag.mode==='marquee'&&a.draft){ a.draft.p[2]=wx; a.draft.p[3]=wy; }
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
let pendingMenu=null;        // отложенный запрос меню от правой кнопки
addEventListener('pointerup',()=>{
  const a=A();
  if(drag&&drag.mode==='pan'&&drag.rmb){
    // кнопку не тащили — значит это был обычный правый клик, показываем меню
    if(!drag.moved&&pendingMenu) openSimMenu(pendingMenu.x,pendingMenu.y);
    pendingMenu=null;
  }
  if(a&&a.draft&&drag&&drag.mode==='draw'){
    const d=a.draft;
    const ok=d.type==='pencil'?d.pts.length>2:Math.hypot(d.p[2]-d.p[0],d.p[3]-d.p[1])>0.05;
    if(ok){ annSnapshot(a); a.annos.push(d); }
  }
  // зум рамкой: вписываем обведённую область в кадр
  if(a&&drag&&drag.mode==='marquee'&&a.draft){
    const [x1,y1,x2,y2]=a.draft.p;
    const w=Math.abs(x2-x1), h=Math.abs(y2-y1);
    if(w>1e-6&&h>1e-6&&CW&&CH){
      const sc=clamp(Math.min(CW/(w*PX_PER_M),CH/(h*PX_PER_M))*0.92,ZMIN,ZMAX);
      a.view.scale=sc; a.view.x=(x1+x2)/2; a.view.y=(y1+y2)/2; setZoom();
    }
    a.draft=null;
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
  /* Черновик сбрасываем, КРОМЕ многоточечных инструментов (транспортир,
     площадь): у них вершины копятся между кликами, а завершает набор
     двойной клик или Enter. */
  if(a&&!(a.draft&&(a.draft.type==='area'||a.draft.type==='angle'))) a.draft=null;
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
  const nearSeg=(x1,y1,x2,y2)=>{
    const dx=x2-x1, dy=y2-y1, L2=dx*dx+dy*dy||1e-9;
    const t=clamp(((x-x1)*dx+(y-y1)*dy)/L2,0,1);
    return Math.hypot(x1+t*dx-x,y1+t*dy-y)<=r;
  };
  a.annos=a.annos.filter(an=>{
    if(an.type==='pencil') return !an.pts.some(q=>Math.hypot(q[0]-x,q[1]-y)<r);
    if(an.type==='angle'||an.type==='area'){
      const P=an.pts;
      for(let i=0;i<P.length-1;i++) if(nearSeg(P[i][0],P[i][1],P[i+1][0],P[i+1][1])) return false;
      if(an.type==='area'&&P.length>2&&nearSeg(P[P.length-1][0],P[P.length-1][1],P[0][0],P[0][1])) return false;
      return true;
    }
    if(an.type==='note') return Math.hypot(an.p[0]-x,an.p[1]-y)>r;
    if(an.type==='guide') return an.dir==='v'? Math.abs(an.p[0]-x)>r : Math.abs(an.p[1]-y)>r;
    if(an.type==='circle'){
      const R=Math.hypot(an.p[2]-an.p[0],an.p[3]-an.p[1]);
      return Math.abs(Math.hypot(x-an.p[0],y-an.p[1])-R)>r;
    }
    return !nearSeg(an.p[0],an.p[1],an.p[2],an.p[3]);
  });
}
$('#cwrap').addEventListener('wheel',e=>{
  const a=A(); if(!a) return;
  e.preventDefault();
  const r=scene.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
  const [wx,wy]=toWorld(px,py);
  // чувствительность и направление настраиваются пользователем
  const k=Math.exp(-e.deltaY*0.006*(+prefGet('zoomSens')||1)*(prefGet('zoomInvert')?-1:1));
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
/* Нижний предел зума опущен до 1e-7: иначе сцены планетарного масштаба
   (пример «Экватор Земли», R = 6370 км) не помещались в кадр — fit упирался
   в старый предел 0.002 и показывал пустое поле. */
const ZMIN=1e-7, ZMAX=30;                      // 0.00001% … 3000%
function zoomLabel(v){
  const p=v*100;
  if(p<0.01) return p.toExponential(1)+'%';    // планетарные масштабы
  return (p<10?p.toFixed(p<1?2:1):Math.round(p))+'%';
}
function setZoom(){ $('#zoomval').value=zoomLabel(A()?A().view.scale:1); }
const zoom=f=>{ const a=A(); if(!a) return; a.view.scale=clamp(a.view.scale*f,ZMIN,ZMAX); setZoom(); };
function fitView(){ const a=A(); if(!a) return; Object.assign(a.view,a.def.fit(a.params,{W:CW,H:CH})); setZoom(); }
const kzs=()=>clamp(+prefGet('keyZoomStep')||1.8,1.2,2.6);   // настраиваемый шаг зума
$('#btn-zin').onclick=()=>zoom(kzs());
$('#btn-zout').onclick=()=>zoom(1/kzs());
$('#zoomval').onchange=e=>{ const a=A(), v=parseFloat(String(e.target.value).replace(',','.')); if(a&&v) a.view.scale=clamp(v/100,ZMIN,ZMAX); setZoom(); };
$('#zoomval').onkeydown=e=>e.stopPropagation();
$('#btn-fit').onclick=fitView;

/* ================================== UI ================================= */
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
function setTool(t){
  const a=A(); if(a&&a.draft&&a.draft.type!==t) a.draft=null;   // бросаем недорисованное
  S.tool=t;
  document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  const CUR={pan:'grab',eraser:'cell',note:'text',marquee:'crosshair',probe:'crosshair'};
  $('#cwrap').style.cursor=CUR[t]||'crosshair';
  // подсказка, как завершить многоточечный инструмент
  if(t==='area') toast('Площадь: кликайте вершины, двойной клик — замкнуть');
  else if(t==='angle') toast('Транспортир: три точки — луч, вершина, луч');
  else if(t==='guide') toast('Направляющая: клик — горизонтальная, Alt+клик — вертикальная');
  else if(t==='marquee') toast('Зум рамкой: обведите область');
  else if(t==='probe') toast('Пробник: клик по сцене — координаты в буфер обмена');
}
/* Копирование в буфер: clipboard API работает только в защищённом контексте,
   поэтому для http-адресов локальной сети оставлен запасной путь. */
function copyText(t){
  try{
    if(navigator.clipboard&&window.isSecureContext) { navigator.clipboard.writeText(t); return true; }
  }catch(_){}
  try{
    const ta=document.createElement('textarea');
    ta.value=t; ta.style.cssText='position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); return true;
  }catch(_){ return false; }
}
$('#btn-snap').onclick=()=>{ S.snap=!S.snap; LS.set('snap',S.snap);
  $('#btn-snap').classList.toggle('on',S.snap); toast('Привязка: '+(S.snap?'вкл':'выкл')); };
$('#btn-snap').classList.toggle('on',S.snap);
$('#btn-clear').onclick=()=>{ const a=A(); if(a){ annSnapshot(a); a.annos=[]; S.probe=null; toast('Пометки стёрты (Ctrl+Z вернёт)'); } };
/* След за телами: рисует путь якорных точек симуляции поверх сцены. */
$('#btn-trace').onclick=()=>{
  S.trace=!S.trace; LS.set('trace',S.trace);
  $('#btn-trace').classList.toggle('on',S.trace);
  const a=A(); if(a) a.tracePts=[];
  toast('След за телами: '+(S.trace?'вкл':'выкл'));
};
$('#btn-trace').classList.toggle('on',S.trace);
/* Координаты под курсором: постоянная подсказка у указателя — как строка
   состояния в CAD. Работает с любым инструментом, ничего не рисует в сцену. */
$('#btn-coords').onclick=()=>{
  S.coords=!S.coords; LS.set('coords',S.coords);
  $('#btn-coords').classList.toggle('on',S.coords);
  toast('Координаты под курсором: '+(S.coords?'вкл':'выкл'));
};
$('#btn-coords').classList.toggle('on',S.coords);
$('#cwrap').addEventListener('pointermove',e=>{
  const r=scene.getBoundingClientRect();
  const px=e.clientX-r.left, py=e.clientY-r.top;
  const out=px<0||py<0||px>r.width||py>r.height;
  /* S.ptr нужен всегда — по нему всплывают ручки перетаскивания под курсором;
     S.mouse наполняем только когда включены координаты под курсором. */
  S.ptr = out ? null : {px,py};
  if(!S.coords||out){ S.mouse=null; return; }
  const [wx,wy]=toWorld(px,py); S.mouse={x:wx,y:wy};
});
$('#cwrap').addEventListener('pointerleave',()=>{ S.mouse=null; S.ptr=null; });

/* ===== Папки в панели инструментов =====
   Панель разрослась, поэтому кнопки собраны в сворачиваемые группы. */
function initRailGroups(){
  const open=LS.get('railGroups',{classic:true,sect:true,build:true});
  document.querySelectorAll('.railgrp').forEach(g=>{
    const id=g.dataset.grp;
    g.classList.toggle('closed',open[id]===false);
    g.querySelector('.grphead').onclick=()=>{
      const closed=g.classList.toggle('closed');
      const st=LS.get('railGroups',{}); st[id]=!closed; LS.set('railGroups',st);
    };
  });
}
initRailGroups();

/* ===== ИНСТРУМЕНТЫ РАЗДЕЛА =====
   Не пометки поверх картинки, а вмешательство в саму физику сцены — как
   нагреватель в кинетической теории. Каждый инструмент объявляет, какие
   параметры ему нужны, и показывается ТОЛЬКО в тех симуляциях, где такие
   параметры есть. Поэтому механика получает невесомость и трение, термодинамика
   — нагрев и поршень, электричество — поле и полярность, и всё это одним
   общим механизмом, без списка «инструмент → симуляция». */
const SECT_TOOLS=[
  {id:'zerog',glyph:'g',keys:['g','ay'],
   label:(P,ks)=>ks.every(k=>P[k]===0)?'Вернуть тяготение':'Невесомость: g = 0',
   on:(P,ks)=>{ const off=ks.every(k=>P[k]===0);
     ks.forEach(k=>{ const d=paramDef(k); P[k]= off ? (d?d.default:9.8) : 0; }); },
   active:(P,ks)=>ks.every(k=>P[k]===0)},
  {id:'nofric',glyph:'µ',keys:['mu','mus','mud','muF','muK','b','drag'],
   label:(P,ks)=>ks.every(k=>P[k]===0)?'Вернуть трение':'Убрать трение и сопротивление',
   on:(P,ks)=>{ const off=ks.every(k=>P[k]===0);
     ks.forEach(k=>{ const d=paramDef(k); P[k]= off ? (d?d.default:0) : 0; }); },
   active:(P,ks)=>ks.every(k=>P[k]===0)},
  /* Затухание почти везде объявлено галочкой, а не числом, поэтому у него
     отдельная кнопка — иначе «убрать трение» его бы не касалось. */
  {id:'damp',glyph:'≈',keys:['damp'],flag:true,
   label:P=>P.damp?'Выключить затухание':'Включить затухание (реалистичнее)',
   on:P=>{ P.damp=!P.damp; }, active:P=>!!P.damp},
  {id:'mass2',glyph:'m',keys:['m','m1','m2','M','mMol','m₁','m₂'],
   label:'Удвоить массу (Ctrl+Z вернёт)',
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]*2))},
  {id:'heat',glyph:'↑T',keys:['T','T1','Tн'],
   label:'Нагреть: +100 K',
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]+100))},
  {id:'cool',glyph:'↓T',keys:['T','T1','Tн'],
   label:'Охладить: −100 K',
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]-100))},
  {id:'heater',glyph:'⌇',keys:['heater'],
   label:P=>P.heater?'Выключить нагреватель':'Включить нагреватель',
   on:P=>{ P.heater=!P.heater; }, active:P=>!!P.heater},
  {id:'squeeze',glyph:'⇥',keys:['pistonX'],
   label:'Сжать поршнем на 10 %',
   on:P=>{ P.piston=true; P.pistonX=clampParam('pistonX',+(P.pistonX-0.1).toFixed(2)); }},
  {id:'field2',glyph:'B',keys:['B','E','E0','Emax'],
   label:'Удвоить поле',
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]*2))},
  {id:'flip',glyph:'±',keys:['q','q1','q2','q0','B','U','v0','v01','v02','I','a1','a2','a01','a02'],signed:true,
   label:'Обратить знак: полярность, направление движения',
   on:(P,ks)=>ks.forEach(k=>{ P[k]=clampParam(k,-P[k]); })},
  {id:'lam2',glyph:'λ',keys:['lam','lam1','lamPm'],
   label:'Удвоить длину волны',
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]*2))},
  {id:'more',glyph:'N',keys:['N','parts','rays','atoms'],
   label:(P,ks)=>'Вдвое больше: '+labelOf(ks),
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,Math.round(P[k]*2)))},
  /* Дальше — универсальные «удвоить/прибавить». Подпись кнопки берётся из
     самого параметра симуляции, поэтому в каждой сцене она честная: в линзе
     это фокусное расстояние, в эффекте Доплера — частота сирены. */
  {id:'volt2',glyph:'U',keys:['U','volt','U0','I'],
   label:(P,ks)=>'Удвоить: '+labelOf(ks),
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]*2))},
  {id:'chg2',glyph:'Q',keys:['Q','Q1','Q2','q','q1','q2'],
   label:(P,ks)=>'Удвоить: '+labelOf(ks),
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]*2))},
  {id:'freq2',glyph:'f',keys:['f','f0'],
   label:(P,ks)=>'Удвоить: '+labelOf(ks),
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]*2))},
  {id:'pow2',glyph:'P',keys:['P','P2'],
   label:(P,ks)=>'Удвоить: '+labelOf(ks),
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]*2))},
  {id:'half2',glyph:'½',keys:['half'],
   label:(P,ks)=>'Удвоить: '+labelOf(ks),
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]*2))},
  {id:'zplus',glyph:'Z',keys:['Z'],
   label:(P,ks)=>'На единицу больше: '+labelOf(ks),
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]+1))},
  {id:'speed2',glyph:'v',keys:['u','vb','vs','vo','vball'],
   label:(P,ks)=>'Удвоить: '+labelOf(ks),
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]*2))},
  {id:'nplus',glyph:'n',keys:['n','ni','A'],
   label:(P,ks)=>'На единицу больше: '+labelOf(ks),
   on:(P,ks)=>ks.forEach(k=>P[k]=clampParam(k,P[k]+1))}
];
/* Подпись параметра симуляции — чтобы кнопка называла вещи их именами. */
function labelOf(ks){
  return ks.map(k=>{ const d=paramDef(k); return d?(d.label||k):k; })
           .join(', ').toLowerCase();
}
/* описание параметра текущей симуляции по ключу — оттуда берём границы */
function paramDef(k){
  const a=A(); if(!a) return null;
  return a.def.params.find(q=>q.key===k&&q.type!=='group')||null;
}
function clampParam(k,v){
  const d=paramDef(k); if(!d||!isFinite(v)) return v;
  if(d.min!==undefined&&v<d.min) v=d.min;
  if(d.max!==undefined&&v>d.max) v=d.max;
  return +v.toFixed(6);
}
/* Инструмент годится, если у симуляции есть хоть один его числовой параметр
   (галочки и списки в расчёт не идут — «удвоить режим» бессмысленно). */
function sectToolKeys(t){
  const a=A(); if(!a) return [];
  return t.keys.filter(k=>{
    const d=paramDef(k); if(!d) return false;
    if(t.flag||t.id==='heater') return d.type==='check';       // переключатели
    if(d.type==='select'||d.type==='check') return false;
    if(typeof a.params[k]!=='number') return false;
    /* «Обратить знак» показываем только там, где минус вообще допустим:
       у напряжения источника в конструкторе цепей min = 1, и кнопка была бы
       мёртвой. */
    if(t.signed && !(d.min<0)) return false;
    return true;
  });
}
function renderSectTools(){
  const box=$('#secttools'), grp=$('#grp-sect'); if(!box||!grp) return;
  const a=A();
  box.innerHTML='';
  let n=0;
  if(a && prefGet('sectTools')!==false) for(const t of SECT_TOOLS){
    const ks=sectToolKeys(t); if(!ks.length) continue;
    const b=document.createElement('button');
    b.className='iconbtn simtool';
    b.textContent=t.glyph;
    b.title=typeof t.label==='function'? t.label(a.params,ks) : t.label;
    if(t.active&&t.active(a.params,ks)) b.classList.add('on');
    b.onclick=()=>{
      const cur=A(); if(!cur) return;
      pushUndo(cur);                               // всё это откатывается Ctrl+Z
      t.on(cur.params,sectToolKeys(t));
      cur.state=cur.def.init(cur.params); cur.hist=[]; acc=0;
      renderParams(); renderSectTools(); toast(b.title);
    };
    box.appendChild(b); n++;
  }
  grp.style.display=n?'':'none';
}

/* ===== Инструменты конкретной симуляции в левой панели =====
   Раньше ctxTools жили только в меню по правой кнопке — на телефоне туда
   вообще не попасть. Теперь они рисуются кнопками в общей папке. */
function renderSimTools(){
  const box=$('#simtools'), sep=$('#grp-build'); if(!box) return;
  const a=A();
  const items=(a&&a.def.ctxTools)? a.def.ctxTools(a.params) : [];
  box.innerHTML=''; sep.style.display=items.length?'':'none';
  items.forEach((it,i)=>{
    const b=document.createElement('button');
    b.className='iconbtn simtool';
    // «● » в начале подписи означает выбранный инструмент симуляции
    const on=/^●/.test(it.label);
    b.classList.toggle('on',on);
    b.title=it.label.replace(/^[●○]\s*/,'');
    b.textContent=simToolGlyph(it.label,i);
    b.onclick=()=>{
      const cur=A(); if(!cur) return;
      it.on(cur.params); cur.state=cur.def.init(cur.params);
      renderSimTools();
    };
    box.appendChild(b);
  });
}
/* Короткий значок для кнопки: берём осмысленную букву из подписи. */
function simToolGlyph(label,i){
  const t=label.replace(/^[●○]\s*/,'').toLowerCase();
  if(/провод|wire/.test(t)) return '╱';
  if(/резистор/.test(t))    return 'R';
  if(/конденсатор/.test(t)) return 'C';
  if(/катушк|индуктив/.test(t)) return 'L';
  if(/лампа|нагруз/.test(t)) return '⊗';
  if(/батаре|источник|эдс/.test(t)) return '⎓';
  if(/ключ|выключ/.test(t)) return '⌁';
  if(/стереть|удал|ласт/.test(t)) return '⌫';
  if(/отменить|назад/.test(t)) return '↶';
  if(/вывод|выход/.test(t))  return 'B';
  if(/груз|масса/.test(t))   return 'm';
  if(/блок/.test(t))         return '◎';
  if(/опор|закреп/.test(t))  return '⊥';
  if(/нить|верёвк/.test(t))  return '│';
  return String(i+1);
}
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
$('#btn-reset').onclick=()=>{ const a=A(); if(!a) return;
  if(prefGet('confirmReset') && !confirm('Сбросить симуляцию к начальному состоянию?')) return;
  restart(a); toast('Симуляция сброшена'); };
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
$('#btn-cmdk').onclick=()=>cmdkOpen('');
$('#mi-cmdk').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); cmdkOpen(''); };
$('#mi-snap').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); takeSnapshot(); };
$('#mi-copyout').onclick=()=>{ $('#pop-simmenu').classList.add('hidden'); copyReadouts(); };
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
  nums:true,hud:true,events:true,energy:true,grid:true,graphs:true,lineW:1,labelFix:true,timeline:true,
  autoplay:false,restore:true,confirmReset:false,
  // новая волна настроек
  serifNotes:false,toasts:true,dockSize:'norm',
  gridStepMode:'auto',gridLabels:true,hudSide:'left',hudScale:1,numPrec:2,
  clockShow:true,fpsShow:true,
  eventPause:true,zoomInvert:false,zoomSens:1,keyZoomStep:1.8,defSpeed:1,
  autoFit:true,mAutoOpen:true,
  dprCap:0,graphEvery:6,
  // обвязка сцены и папка инструментов раздела
  axes:false,edgeRuler:false,crosshair:false,miniMap:false,sceneTitle:false,sectTools:true,
  handles:'hover',
  // кастомизация окружения
  uiMode:'auto',bgStyle:'plain',gridAlpha:1,sceneFont:'mono',labelSize:11,arrowScale:1,
  panelAlpha:93,railSide:'left',traceLen:900};
const PREFS=[
  {cat:'look',key:'theme',type:'select',def:'light',
   name:'Тема оформления',desc:'Светлая удобнее при проекции на доску, тёмная — при работе в затемнённом классе. «Как в системе» следует за настройкой устройства.',
   options:[['light','Светлая'],['dark','Тёмная'],['auto','Как в системе']]},
  {cat:'look',key:'accent',type:'select',def:'violet',
   name:'Акцентный цвет',desc:'Цвет выделения, активных кнопок и первого ряда на графиках.',
   options:[['violet','Фиолетовый'],['blue','Синий'],['teal','Бирюзовый'],['amber','Янтарный'],['rose','Красный']]},
  {cat:'look',key:'fs',type:'range',def:12,min:10,max:16,step:0.5,unit:' pt',
   name:'Размер шрифта',desc:'Влияет на конспект, формулы и подписи в интерфейсе.'},
  {cat:'look',key:'density',type:'select',def:'cozy',
   name:'Плотность интерфейса',desc:'Компактная умещает больше на экран, просторная удобнее для сенсорного экрана и проектора.',
   options:[['compact','Компактная'],['cozy','Обычная'],['roomy','Просторная']]},
  {cat:'look',key:'serifNotes',type:'toggle',def:false,
   name:'Конспект с засечками',desc:'Текст конспектов набирается шрифтом с засечками — ближе к бумажному учебнику.'},
  {cat:'look',key:'toasts',type:'toggle',def:true,
   name:'Всплывающие подсказки',desc:'Короткие сообщения внизу экрана: «симуляция сброшена», «привязка: вкл» и подобные.'},
  {cat:'look',key:'dockSize',type:'select',def:'norm',
   name:'Размер пульта на телефоне',desc:'Крупный удобнее для больших пальцев, обычный экономит место на сцене.',
   options:[['norm','Обычный'],['big','Крупный']]},

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
  {cat:'scene',key:'gridStepMode',type:'select',def:'auto',
   name:'Крупность сетки',desc:'Автоматика подбирает шаг под текущий зум; крупная и мелкая сдвигают его на один шаг в свою сторону.',
   options:[['auto','Автоматически'],['coarse','Крупнее'],['fine','Мельче']]},
  {cat:'scene',key:'gridLabels',type:'toggle',def:true,
   name:'Подпись шага сетки',desc:'Надпись «сетка N м» в углу сцены.'},
  {cat:'scene',key:'hudSide',type:'select',def:'left',
   name:'Сторона панели показаний',desc:'Слева — классика; справа может мешать PV-диаграмме и панели энергии.',
   options:[['left','Слева'],['right','Справа']]},
  {cat:'scene',key:'hudScale',type:'range',def:1,min:0.8,max:1.6,step:0.1,unit:'×',
   name:'Размер панели показаний',desc:'Множитель шрифта в панели показаний. Крупнее — виднее с задних парт.'},
  {cat:'scene',key:'numPrec',type:'select',def:2,
   name:'Точность чисел в показаниях',desc:'Сколько знаков после запятой выводить в панели показаний.',
   options:[[1,'1 знак'],[2,'2 знака'],[3,'3 знака']]},
  {cat:'scene',key:'clockShow',type:'toggle',def:true,
   name:'Часы t в шапке',desc:'Текущее время симуляции над сценой (на компьютере).'},
  {cat:'scene',key:'timeline',type:'toggle',def:true,
   name:'Шкала времени под сценой',desc:'Полоса перемотки: можно вернуться к любому моменту расчёта и рассмотреть его покадрово. Отключите, если не нужна — расчёт станет чуть легче.'},
  {cat:'scene',key:'labelFix',type:'toggle',def:true,
   name:'Разводить подписи на сцене',desc:'Автоматически сдвигает наехавшие друг на друга подписи и возвращает в кадр уехавшие за край. Выключите, если хотите видеть их строго там, где они рассчитаны.'},

  {cat:'scene',key:'handles',type:'select',def:'hover',
   name:'Ручки перетаскивания',desc:'Кружки на телах, за которые их можно тянуть. По умолчанию всплывают только под курсором — сцена остаётся чистой, но подсказка никуда не делась.',
   options:[['hover','Под курсором'],['always','Показывать всегда'],['never','Не показывать']]},
  {cat:'scene',key:'axes',type:'toggle',def:false,
   name:'Оси координат',desc:'Тонкие оси x и y через начало отсчёта с отметкой нуля — сразу видно, откуда считаются координаты.'},
  {cat:'scene',key:'edgeRuler',type:'toggle',def:false,
   name:'Линейки по краям кадра',desc:'Шкалы сверху и слева, как в графических редакторах: показывают, какие метры сейчас в кадре.'},
  {cat:'scene',key:'crosshair',type:'toggle',def:false,
   name:'Перекрестие курсора',desc:'Пунктирные линии через весь кадр от указателя — помогают точно совместить точку с телом или делением.'},
  {cat:'scene',key:'miniMap',type:'toggle',def:false,
   name:'Мини-карта сцены',desc:'Окошко в углу: вся сцена целиком и рамка того, что сейчас видно. Удобно, когда зумом ушли далеко.'},
  {cat:'scene',key:'sceneTitle',type:'toggle',def:false,
   name:'Название сцены на картинке',desc:'Подпись симуляции внизу кадра — снимок экрана становится самодостаточным.'},
  {cat:'scene',key:'sectTools',type:'toggle',def:true,
   name:'Папка «Инструменты раздела»',desc:'Кнопки, меняющие саму физику сцены: невесомость, трение, нагрев, поле. Показываются только там, где применимы.'},

  {cat:'look',key:'bgStyle',type:'select',def:'plain',
   name:'Фон сцены',desc:'Подложка под рисунком. «Тетрадь» и «миллиметровка» ближе к бумажному черновику, «точки» — к макетным программам.',
   options:[['plain','Сплошной'],['paper','Тетрадь в клетку'],['mm','Миллиметровка'],['dots','Точки'],['dark','Тёмная лаборатория']]},
  {cat:'look',key:'gridAlpha',type:'range',def:1,min:0.2,max:2,step:0.1,unit:'×',
   name:'Насыщенность сетки',desc:'Насколько заметны линии координатной сетки.'},
  {cat:'look',key:'sceneFont',type:'select',def:'mono',
   name:'Шрифт подписей на сцене',desc:'Моноширинный ровно выстраивает числа в столбик, пропорциональный компактнее.',
   options:[['mono','Моноширинный'],['sans','Без засечек'],['serif','С засечками']]},
  {cat:'look',key:'labelSize',type:'range',def:11,min:9,max:16,step:0.5,unit:' px',
   name:'Кегль подписей на сцене',desc:'Размер надписей у тел и векторов. Крупнее — видно с задней парты.'},
  {cat:'look',key:'arrowScale',type:'range',def:1,min:0.6,max:2,step:0.1,unit:'×',
   name:'Размер наконечников стрелок',desc:'Величина «оперения» у векторов сил, скоростей и полей.'},
  {cat:'look',key:'panelAlpha',type:'range',def:93,min:40,max:100,step:1,unit:' %',
   name:'Непрозрачность плавающих панелей',desc:'Насколько панели показаний и энергии перекрывают рисунок под собой.'},
  {cat:'look',key:'uiMode',type:'select',def:'auto',
   name:'Вид интерфейса',desc:'Телефонный вид — тонкая шапка, ящик тем и плавающая панель — включается сам, когда управление идёт пальцем на маленьком экране. Узкое окно на компьютере телефоном не считается. Здесь вид можно задать вручную.',
   options:[['auto','Определять автоматически'],['desktop','Компьютерный'],['mobile','Телефонный']]},
  {cat:'look',key:'railSide',type:'select',def:'left',
   name:'Панель инструментов',desc:'С какой стороны экрана держать колонку инструментов.',
   options:[['left','Слева'],['right','Справа']]},

  {cat:'behav',key:'autoplay',type:'toggle',def:false,
   name:'Запускать время сразу',desc:'Симуляция начинает считать, как только вы её открыли, без нажатия на пуск.'},
  {cat:'behav',key:'restore',type:'toggle',def:true,
   name:'Открывать последнюю тему',desc:'При следующем запуске приложение вернётся туда, где вы остановились.'},
  {cat:'behav',key:'eventPause',type:'toggle',def:true,
   name:'Останавливать время на событиях',desc:'Падение, столкновение, срыв — таймер встаёт, чтобы рассмотреть момент. Выключите, и события будут лишь помечаться плашкой.'},
  {cat:'behav',key:'confirmReset',type:'toggle',def:false,
   name:'Подтверждать сброс симуляции',desc:'Перед сбросом по кнопке или клавише R появится вопрос — защита от случайного нажатия.'},
  {cat:'behav',key:'defSpeed',type:'select',def:1,
   name:'Скорость времени при запуске',desc:'С каким множителем времени открывается приложение.',
   options:[[0.5,'0.5× — замедленно'],[1,'1× — обычная'],[2,'2×'],[4,'4×']]},
  {cat:'behav',key:'zoomInvert',type:'toggle',def:false,
   name:'Инвертировать зум колесом',desc:'Поменять направление: колесо от себя будет отдалять, а не приближать.'},
  {cat:'behav',key:'zoomSens',type:'range',def:1,min:0.4,max:2.5,step:0.1,unit:'×',
   name:'Чувствительность зума колесом',desc:'Насколько быстро колесо мыши и тачпад меняют масштаб. Жест двумя пальцами не масштабируется — он следует прямо за пальцами.'},
  {cat:'behav',key:'keyZoomStep',type:'range',def:1.8,min:1.2,max:2.6,step:0.1,unit:'×',
   name:'Шаг зума кнопками',desc:'Во сколько раз меняется масштаб по кнопкам «+/−» и клавишам.'},
  {cat:'behav',key:'autoFit',type:'toggle',def:true,
   name:'Вписывать сцену при повороте',desc:'При повороте телефона или изменении окна вид заново подгоняется под сцену. Выключите, чтобы зум и панорама не сбрасывались.'},
  {cat:'behav',key:'mAutoOpen',type:'toggle',def:true,
   name:'Телефон: открывать симуляцию сразу',desc:'При выборе темы на телефоне симуляция разворачивается сама. Выключите, чтобы начинать с конспекта и открывать её кнопкой ▷.'},

  {cat:'perf',key:'quality',type:'select',def:'high',
   name:'Качество отрисовки',desc:'На высоком включены следы тел, чёткость под плотные экраны и мелкая сетка.',
   options:[['high','Высокое — следы, чёткость, мелкая сетка'],['med','Среднее'],['low','Экономное — без следов, без сглаживания']]},
  {cat:'perf',key:'bgPause',type:'toggle',def:true,
   name:'Останавливать время в фоне',desc:'Пока вкладка свёрнута или сцена скрыта, расчёт не идёт и ноутбук не греется.'},
  {cat:'perf',key:'fps',type:'select',def:0,
   name:'Ограничение частоты кадров',desc:'Реже перерисовывать сцену. Точность расчёта не меняется — шаг физики остаётся прежним.',
   options:[[0,'Без ограничения'],[60,'60 кадров в секунду'],[30,'30 кадров'],[24,'24 кадра — самый экономный']]},
  {cat:'perf',key:'dprCap',type:'select',def:0,
   name:'Чёткость на плотных экранах',desc:'Предел разрешения холста. 1× заметно разгружает слабые устройства с retina-экраном ценой лёгкой нечёткости.',
   options:[[0,'Автоматически'],[1,'1× — экономно'],[2,'2× — максимум']]},
  {cat:'perf',key:'graphEvery',type:'select',def:6,
   name:'Плотность точек графиков',desc:'Как часто запоминать точку для графиков под сценой. Реже — легче для памяти на длинных прогонах.',
   options:[[3,'Часто — плавные кривые'],[6,'Обычно'],[12,'Редко — экономно']]},
  {cat:'perf',key:'fpsShow',type:'toggle',def:true,
   name:'Счётчик кадров',desc:'Показатель fps в правом нижнем углу (на компьютере).'},

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
        <div class="pset-c"><button class="btn" id="pref-clear-all">Очистить</button></div></div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Сохранить настройки в файл</div>
        <div class="pset-desc">Скачивает файл с настройками, наборами и закладками — чтобы перенести их на другой компьютер.</div></div>
        <div class="pset-c"><button class="btn" id="pref-export">Скачать</button></div></div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Загрузить настройки из файла</div>
        <div class="pset-desc">Восстанавливает настройки, наборы и закладки из ранее сохранённого файла.</div></div>
        <div class="pset-c"><button class="btn" id="pref-import">Выбрать файл</button>
          <input type="file" id="pref-import-file" accept="application/json" style="display:none"></div></div>
      <div class="pset"><div class="pset-l"><div class="pset-name">Закрыть доступ</div>
        <div class="pset-desc">Выход из пособия: при следующем открытии снова спросит пароль.</div></div>
        <div class="pset-c"><button class="btn" id="pref-logout">Выйти</button></div></div>`;
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
    $('#pref-export').onclick=()=>{
      const data=JSON.stringify({app:'physim',v:1,settings:S.settings,
        presets:LS.get('presets',{}),marks:S.marks},null,1);
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));
      a.download='physim-настройки.json'; a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),2000);
      toast('Файл настроек сохранён');
    };
    $('#pref-import').onclick=()=>$('#pref-import-file').click();
    $('#pref-import-file').onchange=e=>{
      const f=e.target.files&&e.target.files[0]; if(!f) return;
      const rd=new FileReader();
      rd.onload=()=>{
        try{
          const j=JSON.parse(rd.result);
          if(j.app!=='physim') throw 0;
          if(j.settings) S.settings={...PREF_DEFAULTS,...j.settings};
          if(j.presets)  LS.set('presets',j.presets);
          if(j.marks){ S.marks=j.marks; LS.set('marks',S.marks); }
          applySettings(); renderPrefs(); renderTree(); toast('Настройки загружены');
        }catch(_){ toast('Это не файл настроек Phy.Sim'); }
      };
      rd.readAsText(f);
    };
    $('#pref-logout').onclick=()=>{
      if(!confirm('Выйти? При следующем открытии пособие снова спросит пароль.')) return;
      try{ localStorage.removeItem('physim.authv1'); }catch(_){}
      location.reload();
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
/* ================= РЕЖИМ ИНТЕРФЕЙСА =================
   Раньше телефонная раскладка включалась просто по ширине окна. Но узкое окно
   на компьютере — это всё ещё компьютер: там есть мышь, есть клавиатура, и
   плавающая панель с ящиком только мешают. Поэтому решаем по СПОСОБУ ВВОДА:
   телефон — это грубый указатель без наведения (палец) и узкий кадр. Плюс
   явный выбор в настройках, если автоматика не угадала. */
function uiMode(){
  const forced=prefGet('uiMode');
  if(forced==='mobile'||forced==='desktop') return forced;
  const coarse = matchMedia('(pointer:coarse)').matches;   // палец, а не мышь
  const noHover= matchMedia('(hover:none)').matches;       // навести курсор нечем
  const narrow = matchMedia('(max-width:900px)').matches;
  const uaMob  = /Android|iPhone|iPad|iPod|IEMobile|Mobile Safari|Silk/i.test(navigator.userAgent||'');
  return (((coarse&&noHover)||uaMob) && narrow) ? 'mobile' : 'desktop';
}
function applyUiMode(){
  const m=uiMode(), root=document.documentElement;
  if(root.dataset.ui===m) return false;
  root.dataset.ui=m;
  return true;                                             // режим сменился
}
applyUiMode();
const isNarrow=()=>document.documentElement.dataset.ui==='mobile';
function closeSimMobile(){
  mSheet(false);                          // на всякий случай закрываем шторку параметров
  $('#simpane').classList.add('hidden');
  $('#splitter').classList.add('hidden');
  $('#content').classList.add('wide');
  $('#app').classList.remove('simfull');
  resize();
}
$('#btn-simback').onclick=()=>{ closeSimMobile(); syncMbar(); };
/* Открыть сцену поверх конспекта (кнопка «открыть симуляцию» в шапке). */
function openSimMobile(){
  if(!S.active) return;
  $('#simpane').classList.remove('hidden');
  $('#splitter').classList.add('hidden');
  $('#content').classList.add('wide');
  requestAnimationFrame(()=>{ resize(); });
}

/* ===== Инструменты сцены на телефоне =====
   Левой панели на узком экране нет, поэтому её содержимое показываем списком
   в таком же попапе, как меню симуляции: те же кнопки, те же обработчики. */
function fillToolsPop(){
  const box=$('#pop-tools-body'); if(!box) return;
  box.innerHTML='';
  const add=(label,on,active)=>{
    if(!label) return;
    const b=document.createElement('button');
    b.className='item'+(active?' on':'');
    b.textContent=label;
    b.onclick=()=>{ on(); $('#pop-tools').classList.add('hidden'); };
    box.appendChild(b);
  };
  const clean=t=>String(t||'').replace(/\s*\([^)]*\)$/,'');
  document.querySelectorAll('#rail .tool').forEach(t=>
    add(clean(t.title),()=>setTool(t.dataset.tool),t.classList.contains('on')));
  for(const id of ['btn-snap','btn-coords','btn-trace','btn-clear']){
    const t=$('#'+id); if(t) add(clean(t.title),()=>t.click(),t.classList.contains('on'));
  }
  document.querySelectorAll('#secttools button,#simtools button').forEach(t=>
    add(t.title,()=>t.click(),t.classList.contains('on')));
}

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
$('#m-cmdk').onclick=()=>cmdkOpen('');
popup($('#m-menu'),$('#pop-simmenu'));      // та же логика попапа, что и у кнопки в топбаре

/* ================= РЕАЛЬНЫЙ ВИДИМЫЙ ЭКРАН ТЕЛЕФОНА =================
   Адресная строка браузера то выезжает, то прячется, и на телефоне это
   съедает заметную полосу сверху или снизу. Обычные 100vh про неё не знают:
   в Safari они считаются по экрану БЕЗ панелей, поэтому нижняя панель
   управления регулярно оказывалась наполовину под поисковой строкой.

   Поэтому берём размеры у visualViewport — это ровно та область, которую
   пользователь видит: --appvh идёт в высоту приложения, --vvbottom — сколько
   отъедено снизу (панель браузера или экранная клавиатура), и на эту величину
   приподнимается всё плавающее. */
function syncViewport(){
  const vv=window.visualViewport;
  const root=document.documentElement;
  const h = vv ? vv.height : window.innerHeight;
  root.style.setProperty('--appvh', h+'px');
  const hidden = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  root.style.setProperty('--vvbottom', Math.round(hidden)+'px');
}
syncViewport();
addEventListener('resize',syncViewport);
addEventListener('orientationchange',()=>setTimeout(syncViewport,120));
if(window.visualViewport){
  visualViewport.addEventListener('resize',syncViewport);
  visualViewport.addEventListener('scroll',syncViewport);
}

/* ================= ТЕЛЕФОН: ЯЩИК С ТЕМАМИ =================
   Дерево тем уезжает за левый край и выдвигается поверх текста с затемнением;
   тап по затемнению возвращает к чтению. */
function drawer(open){
  const sb=$('#sidebar'), bg=$('#drawer-bg'); if(!sb||!bg) return;
  const now = open===undefined ? !sb.classList.contains('open') : open;
  sb.classList.remove('hidden');
  sb.classList.toggle('open', now);
  bg.classList.toggle('show', now);
}
$('#m-drawer').onclick=()=>drawer();
$('#drawer-bg').onclick=()=>drawer(false);
$('#d-help').onclick=()=>{ drawer(false); $('#btn-help').click(); };
$('#d-settings').onclick=()=>{ drawer(false); openPrefs(); };
// выбрал тему — ящик закрывается сам, иначе он загораживает то, что открыл
$('#tree').addEventListener('click',e=>{
  if(isNarrow()&&e.target.closest('.topic-item')) drawer(false);
});
$('#m-more').onclick=null;
popup($('#m-more'),$('#pop-simmenu'));
$('#m-opensim').onclick=()=>{ const a=A(); if(a) openSimMobile(); else toast('Сначала выберите тему с симуляцией'); };

/* ================= ТЕЛЕФОН: НИЖНЯЯ ПАНЕЛЬ УПРАВЛЕНИЯ =================
   Основной ряд по макету и второй ряд «ещё» (зум, вписать, скорость).
   Кнопки проксируют на уже существующие обработчики — логика не двоится. */
function mbarRow(second){
  $('#mbar').classList.toggle('hide', !!second);
  $('#mbar2').classList.toggle('show', !!second);
  $('#mbar2').classList.toggle('hide', !second);
}
function syncMbar(){
  /* Панель нужна только на телефоне и только когда есть что запускать.
     На экране конспекта она тоже видна: симуляция под ним продолжает идти,
     и останавливать её, не уходя с текста, — ровно то, что нужно. */
  const show = isNarrow() && !!A();
  $('#mbar').classList.toggle('show', show);
  if(!show){ $('#mbar2').classList.remove('show'); $('#mbar').classList.remove('hide'); }
}
$('#mb-play').onclick=()=>$('#btn-play').click();
$('#mb-back').onclick=()=>$('#tl-prev').click();
$('#mb-fwd').onclick=()=>$('#tl-next').click();
$('#mb-params').onclick=()=>mSheet();
$('#mb-more').onclick=()=>mbarRow(true);
$('#mb-back2').onclick=()=>mbarRow(false);
$('#mb-reset').onclick=()=>$('#btn-reset').click();
$('#mb-zin').onclick=()=>$('#btn-zin').click();
$('#mb-zout').onclick=()=>$('#btn-zout').click();
$('#mb-fit').onclick=()=>{ if(!$('#simpane').classList.contains('hidden')) fitView(); else { openSimMobile(); requestAnimationFrame(fitView); } };
$('#mb-slow').onclick=()=>stepSpeed(-1);
$('#mb-fast').onclick=()=>stepSpeed(1);
/* Инструменты сцены: на телефоне левой панели нет, поэтому открываем их
   списком — и сразу переключаемся на сцену, иначе рисовать будет негде. */
popup($('#mb-tools'),$('#pop-tools'));
{ // перед показом наполняем список актуальными инструментами
  const btn=$('#mb-tools'), base=btn.onclick;
  btn.onclick=e=>{ if($('#simpane').classList.contains('hidden')) openSimMobile();
                   fillToolsPop(); base(e); };
}

/* Поворот экрана и любое изменение размера окна. */
let lastNarrow=isNarrow();
function onViewportChange(){
  applyUiMode();                       // мышь подключили, окно растянули — режим мог смениться
  const now=isNarrow();
  syncViewport(); try{ syncMbar(); }catch(_){}
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
  // вписываем сцену заново: при повороте пропорции меняются сильно.
  // Отключается настройкой «вписывать сцену при повороте».
  const a=A();
  if(prefGet('autoFit')!==false && a && a.def.fit && !$('#simpane').classList.contains('hidden')){
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
  // «как в системе»: слушаем текущее значение prefers-color-scheme
  root.dataset.theme = s.theme==='auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light') : s.theme;
  root.dataset.density=s.density||'cozy';
  root.dataset.serif = prefGet('serifNotes') ? '1' : '0';
  root.dataset.dock  = prefGet('dockSize')==='big' ? 'big' : 'norm';
  root.dataset.hudside = prefGet('hudSide')==='right' ? 'right' : 'left';
  root.style.setProperty('--fs',s.fs+'pt');
  root.style.setProperty('--hudk',String(prefGet('hudScale')||1));
  // акцентный цвет: подкрашиваем и полупрозрачную заливку под ним
  const ACC={blue:'#3b82f6',teal:'#0d9488',violet:'#7c5cff',amber:'#d97706',rose:'#e11d48'};
  if(s.accent && ACC[s.accent]){
    root.style.setProperty('--accent',ACC[s.accent]);
    root.style.setProperty('--accent-soft',ACC[s.accent]+'22');
  } else { root.style.removeProperty('--accent'); root.style.removeProperty('--accent-soft'); }
  /* Кастомизация окружения: стиль фона, насыщенность сетки, шрифт и кегль
     подписей, размер стрелок, прозрачность панелей и сторона панели
     инструментов. Всё через data-атрибуты и CSS-переменные, поэтому подхваты-
     вается сразу и на уже нарисованных элементах. */
  root.dataset.bg = prefGet('bgStyle')||'plain';
  root.dataset.rail = prefGet('railSide')==='right' ? 'right' : 'left';
  root.style.setProperty('--panel-a',(prefGet('panelAlpha')||93)+'%');
  $('#hud').classList.toggle('hidden',s.hud===false);
  $('#clock').classList.toggle('hidden',prefGet('clockShow')===false);
  $('#fps').classList.toggle('hidden',prefGet('fpsShow')===false);
  // графики можно выключить целиком — это заметно разгружает слабые машины
  const gp=$('#gbox'); if(gp) gp.classList.toggle('hidden',s.graphs===false);
  // вид интерфейса и папка инструментов раздела — сразу после смены настройки
  try{ if(applyUiMode()){ syncViewport(); syncMbar(); } }catch(_){}
  try{ renderSectTools(); }catch(_){}
  LS.set('settings',s); resize();
}
// тема «как в системе» реагирует на смену темы устройства на лету
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{
  if(S.settings.theme==='auto') applySettings();
});

$('#pvhead').onclick=()=>{ $('#pvbox').classList.toggle('collapsed'); $('#pvtoggle').textContent=$('#pvbox').classList.contains('collapsed')?'▸':'▾'; };

const KEYS=[['Ctrl + P','Командная палитра: темы, симуляции, команды'],
 ['Ctrl + Shift + P','Палитра: только команды'],
 ['Ctrl + D','Снимок показаний для сравнения'],['S','Закладка на тему'],['F11','Во весь экран'],
 ['J','Симуляция в избранное'],['Ctrl + L','Зациклить проигрывание'],
 [', / .','Шаг по записи назад / вперёд'],['`','Вернуться к живому расчёту'],
 ['Ctrl + ,','Настройки'],['Space','Пуск / стоп'],['R','Сбросить симуляцию'],['Ctrl + Z','Параметры: назад'],['Ctrl + Y','Параметры: вперёд'],
 ['V / P / L / Y / E','Курсор / карандаш / линейка / вектор / резинка'],
 ['Q / M','Пробник координат / зум рамкой'],
 ['D / G / C','Размер / транспортир / окружность'],
 ['Shift + A','Площадь многоугольника'],['N / U','Заметка / направляющая'],
 ['Enter / Esc','Замкнуть / отменить построение'],
 ['T','След за телами'],['K','Координаты под курсором'],['A','Привязка к анкерам и узлам сетки'],
 ['F','Симуляция во весь экран'],['H','Скрыть симуляцию'],['Tab','Скрыть панель тем'],['Ctrl + K','Поиск'],
 ['+ / −','Зум'],['[ / ]','Замедлить / ускорить время'],['0','Вписать вид'],['Колесо','Зум к курсору'],['Shift + drag','Панорама'],
 ['Два пальца','Зум и панорама на сенсоре'],['ПКМ','Меню симуляции']];
$('#kb-list').innerHTML=KEYS.map(([k,v])=>`<div class="kb"><span>${v}</span><kbd>${k}</kbd></div>`).join('');
$('#mi-kb').onclick=()=>openPrefs('keys');
$('#kb-close').onclick=()=>$('#modal-kb').classList.add('hidden');
$('#modal-kb').onclick=e=>{ if(e.target.id==='modal-kb') $('#modal-kb').classList.add('hidden'); };

addEventListener('keydown',e=>{
  // пока открыт экран доступа — никакие горячие клавиши не работают
  const lk=document.getElementById('lock');
  if(lk && !lk.classList.contains('hidden')) return;
  // палитра перехватывает клавиатуру целиком (её поле слушает отдельно)
  const ck=document.getElementById('cmdk');
  if(ck && !ck.classList.contains('hidden')) return;
  const t=e.target, typing=/INPUT|SELECT|TEXTAREA/.test(t.tagName)||t.isContentEditable;
  const C=e.code, mod=e.ctrlKey||e.metaKey;                 // e.code не зависит от раскладки
  // настройки открыты — гасим все прочие сочетания, чтобы не управлять сценой вслепую
  const prefsOpen=!$('#prefs').classList.contains('hidden');
  // командная палитра: Ctrl+P — всё подряд, Ctrl+Shift+P — только команды
  if(mod&&C==='KeyP'){ e.preventDefault(); cmdkOpen(e.shiftKey?'>':''); return; }
  if(mod&&C==='KeyD'){ e.preventDefault(); takeSnapshot(); return; }
  if(mod&&C==='KeyL'){ e.preventDefault(); $('#tl-loop').click(); return; }
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
  // многоточечные инструменты: Enter — замкнуть, Escape — отменить набор
  {
    const ad=A();
    if(ad&&ad.draft&&(ad.draft.type==='area'||ad.draft.type==='angle')){
      if(C==='Enter'||C==='NumpadEnter'){
        e.preventDefault();
        if(ad.draft.pts.length>=(ad.draft.type==='area'?3:2)){ annSnapshot(ad); ad.annos.push(ad.draft); }
        ad.draft=null; return;
      }
      if(C==='Escape'){ e.preventDefault(); ad.draft=null; toast('Построение отменено'); return; }
    }
    if(ad&&C==='Escape'&&S.probe){ e.preventDefault(); S.probe=null; return; }
  }
  const map={
    KeyV:()=>setTool('pan'), KeyP:()=>setTool('pencil'), KeyL:()=>setTool('ruler'),
    KeyY:()=>setTool('vector'), KeyE:()=>setTool('eraser'),
    KeyQ:()=>setTool('probe'), KeyM:()=>setTool('marquee'), KeyD:()=>setTool('dim'),
    KeyG:()=>setTool('angle'), KeyC:()=>setTool('circle'), KeyN:()=>setTool('note'),
    KeyU:()=>setTool('guide'), KeyT:()=>$('#btn-trace').click(),
    KeyK:()=>$('#btn-coords').click(),
    KeyA:()=>e.shiftKey? setTool('area') : $('#btn-snap').click(),
    KeyR:()=>$('#btn-reset').click(),
    KeyS:()=>toggleMark(S.topic&&S.topic.id),      // закладка на текущую тему
    F11:()=>toggleFullscreen(),
    Comma:()=>$('#tl-prev').click(),              // покадрово назад
    Period:()=>$('#tl-next').click(),             // покадрово вперёд
    KeyJ:()=>toggleFav(S.active),                 // избранная симуляция
    Backquote:()=>{ scrubLive(); },
    KeyF:()=>$('#btn-simfull').click(), KeyH:()=>$('#btn-simhide').click(),
    Space:()=>$('#btn-play').click(), Tab:()=>$('#btn-rail').click(), KeyB:()=>$('#btn-rail').click(),
    Digit0:fitView, Numpad0:fitView,
    BracketLeft:()=>stepSpeed(-1), BracketRight:()=>stepSpeed(1),
    Equal:()=>zoom(kzs()), NumpadAdd:()=>zoom(kzs()),
    Minus:()=>zoom(1/kzs()), NumpadSubtract:()=>zoom(1/kzs())
  };
  if(map[C]){ e.preventDefault(); map[C](); }
});

/* ПКМ по симуляции → меню симуляции вместо меню браузера */
/* Меню симуляции по правой кнопке.
   ВАЖНО: в браузерах на Linux событие contextmenu приходит уже на НАЖАТИИ,
   поэтому при панорамировании правой кнопкой меню успевало выскочить в
   начале жеста. Поэтому меню не открывается сразу: запрос запоминается, а
   показывается в pointerup — и только если кнопку не тащили. */
function openSimMenu(clientX,clientY){
  const pop=$('#pop-simmenu');
  // инструменты конструктора (если симуляция их объявляет)
  let tl=$('#simmenu-tools');
  if(!tl){ tl=document.createElement('div'); tl.id='simmenu-tools'; pop.prepend(tl); }
  tl.innerHTML='';
  const at=A();
  if(at&&at.def.ctxTools){
    for(const it of at.def.ctxTools(at.params)){
      const b=document.createElement('button'); b.className='item'; b.textContent=it.label;
      b.onclick=()=>{ it.on(at.params); at.state=at.def.init(at.params); pop.classList.add('hidden'); renderSimTools(); };
      tl.appendChild(b);
    }
    const hr=document.createElement('div');
    hr.style.cssText='height:1px;background:var(--line-soft);margin:4px 6px';
    tl.appendChild(hr);
  }
  document.querySelectorAll('.pop').forEach(p=>p.classList.add('hidden'));
  pop.style.visibility='hidden'; pop.classList.remove('hidden');
  const w=pop.offsetWidth, h=pop.offsetHeight;
  pop.style.left=clamp(clientX,8,innerWidth-w-8)+'px';
  pop.style.top=clamp(clientY,8,innerHeight-h-8)+'px';
  pop.style.visibility='visible';
}
$('#simpane').addEventListener('contextmenu',e=>{
  e.preventDefault();
  // жест правой кнопкой ещё идёт — решим в pointerup, тащили её или нет
  if(drag&&drag.mode==='pan'&&drag.rmb){ pendingMenu={x:e.clientX,y:e.clientY}; return; }
  openSimMenu(e.clientX,e.clientY);
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
setSpeed(+prefGet('defSpeed')||1);          // стартовая скорость времени — из настроек

let tt;
function toast(m){
  if(prefGet('toasts')===false) return;     // подсказки можно выключить в настройках
  const t=$('#toast'); t.textContent=m; t.classList.add('show');
  clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('show'),2400); }

/* ==================== ПЛАВАЮЩИЕ ПАНЕЛИ НАД СЦЕНОЙ ====================
   Показатели, энергия, PV-диаграмма, гистограмма и сравнение ведут себя как
   окна в системе: их таскают за заголовок, размер меняют за уголок, двойной
   клик по заголовку сворачивает в полоску. Геометрия каждой панели хранится
   в localStorage, поэтому расстановка переживает перезагрузку.

   Позиции задаются ТОЛЬКО через left/top: панели по умолчанию прижаты
   правым или нижним краем (right/bottom), и если этого не снять, при
   перетаскивании панель растягивалась бы вместо того, чтобы ехать. */
const FPANELS=['hud','energybox','pvbox','histobox','cmpbox'];
function fpLoad(){ return LS.get('panels',{}); }
function fpSave(id,geom){
  const all=fpLoad(); all[id]={...(all[id]||{}),...geom}; LS.set('panels',all);
}
function fpApply(el){
  const g=fpLoad()[el.id];
  if(!g) return;
  if(g.x!==undefined){ el.style.left=g.x+'px'; el.style.right='auto'; }
  if(g.y!==undefined){ el.style.top=g.y+'px';  el.style.bottom='auto'; }
  if(g.w) el.style.width=g.w+'px';
  if(g.h) el.style.height=g.h+'px';
  if(g.rolled) el.classList.add('rolled');
}
function fpClampAll(){
  const wrap=$('#cwrap'); if(!wrap) return;
  const W=wrap.clientWidth, H=wrap.clientHeight;
  for(const id of FPANELS){
    const el=document.getElementById(id);
    if(!el||el.classList.contains('hidden')||!el.style.left) continue;
    const r=el.getBoundingClientRect();
    const x=clamp(parseFloat(el.style.left)||0, 0, Math.max(0,W-Math.min(r.width,W)));
    const y=clamp(parseFloat(el.style.top)||0,  0, Math.max(0,H-28));
    el.style.left=x+'px'; el.style.top=y+'px';
  }
}
function makeFloating(el){
  if(!el||el.__fp) return; el.__fp=true;
  const head=el.querySelector('.fp-head');
  if(!head) return;
  // уголок изменения размера
  const grip=document.createElement('div');
  grip.className='fp-grip'; grip.title='Потяните, чтобы изменить размер';
  el.appendChild(grip);
  fpApply(el);

  // перевод из right/bottom в left/top перед первым перетаскиванием
  const toLeftTop=()=>{
    const wrap=$('#cwrap'), pr=wrap.getBoundingClientRect(), r=el.getBoundingClientRect();
    el.style.left=(r.left-pr.left)+'px'; el.style.top=(r.top-pr.top)+'px';
    el.style.right='auto'; el.style.bottom='auto';
  };

  let drag=null;
  head.addEventListener('pointerdown',e=>{
    if(e.target.closest('button')) return;          // кнопки в шапке работают как обычно
    e.preventDefault(); e.stopPropagation();
    toLeftTop();
    drag={sx:e.clientX, sy:e.clientY,
          x0:parseFloat(el.style.left)||0, y0:parseFloat(el.style.top)||0, moved:false};
    try{ head.setPointerCapture(e.pointerId); }catch(_){}
  });
  head.addEventListener('pointermove',e=>{
    if(!drag) return;
    const dx=e.clientX-drag.sx, dy=e.clientY-drag.sy;
    if(!drag.moved && Math.hypot(dx,dy)<3) return;   // порог: короткий клик не считается перетаскиванием
    drag.moved=true; el.classList.add('dragging');
    const wrap=$('#cwrap'), W=wrap.clientWidth, H=wrap.clientHeight, r=el.getBoundingClientRect();
    /* Панель не уезжает за нижний край: раньше вниз можно было утащить так,
       что от неё оставалась одна шапка, а уголок изменения размера просто
       обрезался сценой и становился недосягаем. */
    el.style.left=clamp(drag.x0+dx, 0, Math.max(0,W-r.width))+'px';
    el.style.top =clamp(drag.y0+dy, 0, Math.max(0,H-r.height))+'px';
  });
  const endDrag=()=>{
    if(!drag) return;
    if(drag.moved) fpSave(el.id,{x:parseFloat(el.style.left)||0, y:parseFloat(el.style.top)||0});
    drag=null; el.classList.remove('dragging');
  };
  head.addEventListener('pointerup',endDrag);
  head.addEventListener('pointercancel',endDrag);
  // двойной клик по шапке — свернуть/развернуть
  head.addEventListener('dblclick',e=>{
    if(e.target.closest('button')) return;
    const rolled=el.classList.toggle('rolled');
    fpSave(el.id,{rolled});
  });

  let rs=null;
  grip.addEventListener('pointerdown',e=>{
    e.preventDefault(); e.stopPropagation();
    const r=el.getBoundingClientRect();
    rs={sx:e.clientX, sy:e.clientY, w0:r.width, h0:r.height};
    try{ grip.setPointerCapture(e.pointerId); }catch(_){}
  });
  grip.addEventListener('pointermove',e=>{
    if(!rs) return;
    el.classList.remove('rolled');
    const wrap=$('#cwrap');
    const w=clamp(rs.w0+(e.clientX-rs.sx),120,wrap.clientWidth);
    const h=clamp(rs.h0+(e.clientY-rs.sy),60,wrap.clientHeight);
    el.style.width=w+'px'; el.style.height=h+'px';
  });
  const endRs=()=>{
    if(!rs) return;
    fpSave(el.id,{w:parseFloat(el.style.width)||undefined, h:parseFloat(el.style.height)||undefined, rolled:false});
    rs=null;
  };
  grip.addEventListener('pointerup',endRs);
  grip.addEventListener('pointercancel',endRs);
}
function initFloatingPanels(){ for(const id of FPANELS) makeFloating(document.getElementById(id)); }
function resetPanels(){
  LS.set('panels',{});
  for(const id of FPANELS){
    const el=document.getElementById(id); if(!el) continue;
    el.classList.remove('rolled');
    el.style.left=el.style.top=el.style.right=el.style.bottom=el.style.width=el.style.height='';
  }
  toast('Расположение панелей сброшено');
}

/* ======================== КОМАНДНАЯ ПАЛИТРА (Ctrl+P) =====================
   Единая строка поиска по темам, симуляциям, настройкам и действиям — как в
   Obsidian и VS Code. «>» в начале запроса оставляет только команды. */
const CMDS=[
  {k:'Симуляция',t:'Пуск / пауза',       hint:'Space', run:()=>$('#btn-play').click()},
  {k:'Симуляция',t:'Сбросить симуляцию', hint:'R',     run:()=>$('#btn-reset').click()},
  {k:'Симуляция',t:'Вписать вид',        hint:'0',     run:fitView},
  {k:'Симуляция',t:'Ускорить время',     hint:']',     run:()=>stepSpeed(1)},
  {k:'Симуляция',t:'Замедлить время',    hint:'[',     run:()=>stepSpeed(-1)},
  {k:'Симуляция',t:'Снимок кадра (PNG)', run:()=>$('#mi-png').click()},
  {k:'Симуляция',t:'Записать видео (WebM)', run:()=>$('#mi-rec').click()},
  {k:'Симуляция',t:'Сохранить параметры как набор', run:()=>$('#mi-save').click()},
  {k:'Симуляция',t:'Снимок для сравнения', hint:'Ctrl+D', run:()=>takeSnapshot()},
  {k:'Симуляция',t:'Скопировать все показания', run:()=>copyReadouts()},
  {k:'Симуляция',t:'Скопировать параметры', run:()=>copyParams()},
  {k:'Вид',t:'Во весь экран (браузер)', hint:'F11', run:()=>toggleFullscreen()},
  {k:'Вид',t:'Симуляция во весь экран', hint:'F', run:()=>$('#btn-simfull').click()},
  {k:'Вид',t:'Скрыть/показать симуляцию', hint:'H', run:()=>$('#btn-simhide').click()},
  {k:'Вид',t:'Скрыть/показать панель тем', hint:'Tab', run:()=>$('#btn-rail').click()},
  {k:'Вид',t:'Светлая тема',  run:()=>prefSet('theme','light')},
  {k:'Вид',t:'Тёмная тема',   run:()=>prefSet('theme','dark')},
  {k:'Вид',t:'Тема как в системе', run:()=>prefSet('theme','auto')},
  {k:'Вид',t:'Спокойный режим: убрать числа со сцены', run:()=>prefSet('nums',!prefGet('nums'))},
  {k:'Вид',t:'Показать/скрыть сетку', run:()=>prefSet('grid',!prefGet('grid'))},
  {k:'Вид',t:'Показать/скрыть графики', run:()=>prefSet('graphs',!prefGet('graphs'))},
  {k:'Инструмент',t:'Перемещение', hint:'V', run:()=>setTool('pan')},
  {k:'Инструмент',t:'Пробник координат', hint:'Q', run:()=>setTool('probe')},
  {k:'Инструмент',t:'Зум рамкой', hint:'M', run:()=>setTool('marquee')},
  {k:'Инструмент',t:'Карандаш', hint:'P', run:()=>setTool('pencil')},
  {k:'Инструмент',t:'Линейка', hint:'L', run:()=>setTool('ruler')},
  {k:'Инструмент',t:'Размерная линия', hint:'D', run:()=>setTool('dim')},
  {k:'Инструмент',t:'Транспортир', hint:'G', run:()=>setTool('angle')},
  {k:'Инструмент',t:'Окружность', hint:'C', run:()=>setTool('circle')},
  {k:'Инструмент',t:'Площадь многоугольника', hint:'Shift+A', run:()=>setTool('area')},
  {k:'Инструмент',t:'Заметка на сцене', hint:'N', run:()=>setTool('note')},
  {k:'Инструмент',t:'Направляющая', hint:'U', run:()=>setTool('guide')},
  {k:'Инструмент',t:'След за телами', hint:'T', run:()=>$('#btn-trace').click()},
  {k:'Инструмент',t:'Координаты под курсором', hint:'K', run:()=>$('#btn-coords').click()},
  {k:'Инструмент',t:'Стереть все пометки', run:()=>$('#btn-clear').click()},
  {k:'Симуляция',t:'Все параметры — по умолчанию', run:()=>$('#btn-pdefaults').click()},
  {k:'Симуляция',t:'Случайные параметры', run:()=>$('#btn-prand').click()},
  {k:'Симуляция',t:'В избранное / убрать', hint:'J', run:()=>toggleFav(S.active)},
  {k:'Время',t:'Зациклить проигрывание', hint:'Ctrl+L', run:()=>$('#tl-loop').click()},
  {k:'Время',t:'Шаг назад', hint:',', run:()=>$('#tl-prev').click()},
  {k:'Время',t:'Шаг вперёд', hint:'.', run:()=>$('#tl-next').click()},
  {k:'Время',t:'Вернуться к живому расчёту', hint:'`', run:()=>scrubLive()},
  {k:'Вид',t:'Сбросить расположение панелей', run:()=>resetPanels()},
  {k:'Прочее',t:'Настройки', hint:'Ctrl+,', run:()=>openPrefs()},
  {k:'Прочее',t:'Горячие клавиши', run:()=>openPrefs('keys')},
  {k:'Прочее',t:'Сохранить настройки в файл', run:()=>{ openPrefs('data'); setTimeout(()=>$('#pref-export')&&$('#pref-export').click(),120); }},
  {k:'Прочее',t:'Закрыть доступ (выйти)', run:()=>{ openPrefs('data'); }}
];
let cmdkSel=0, cmdkItems=[];
function cmdkOpen(prefix){
  const el=$('#cmdk'); if(!el) return;
  el.classList.remove('hidden');
  const inp=$('#cmdk-inp');
  inp.value=prefix||''; cmdkSel=0; cmdkRender();
  setTimeout(()=>{ inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length); },20);
}
function cmdkClose(){ $('#cmdk').classList.add('hidden'); }
function cmdkSource(){
  const q=($('#cmdk-inp').value||'');
  const onlyCmd=q.startsWith('>');
  const s=(onlyCmd?q.slice(1):q).trim().toLowerCase();
  let list=[];
  if(!onlyCmd){
    // недавние темы — первыми при пустом запросе
    if(!s){
      for(const id of (S.favs||[])){
        if(SIMS[id]) list.push({k:'Избранное',t:SIMS[id].title,hint:'симуляция',run:()=>openSim(id)});
      }
      for(const id of (S.recent||[]).slice(0,5)){
        const t=ALL.find(x=>x.id===id);
        if(t) list.push({k:'Недавнее',t:t.title,hint:t.section,run:()=>openTopic(t.id)});
      }
    }
    for(const t of ALL)
      list.push({k:'Тема',t:t.title,hint:t.section,sub:(t.theory||'').slice(0,400),run:()=>openTopic(t.id)});
    for(const id of Object.keys(SIMS))
      list.push({k:'Симуляция',t:SIMS[id].title,hint:'открыть',run:()=>openSim(id)});
    for(const pr of PREFS)
      list.push({k:'Настройка',t:pr.name,hint:(PREF_CATS.find(c=>c.id===pr.cat)||{}).name||'',
                 sub:pr.desc,run:()=>openPrefs(pr.cat)});
  }
  list=list.concat(CMDS);
  /* Без запроса показываем весь список команд (он прокручивается): при
     жёстком срезе в 40 записей последние команды были недостижимы. */
  if(!s) return list.slice(0,200);
  // нечёткий поиск: все буквы запроса встречаются по порядку
  const score=(txt)=>{
    const l=txt.toLowerCase();
    const i=l.indexOf(s);
    if(i>=0) return 100-i;
    let pos=-1;
    for(const ch of s){ pos=l.indexOf(ch,pos+1); if(pos<0) return -1; }
    return 30;
  };
  return list.map(it=>{
    let sc=score(it.t);
    if(sc<0&&it.sub) sc=score(it.sub)>0?10:-1;
    if(sc<0&&it.k) sc=score(it.k)>0?5:-1;
    return {it,sc};
  }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,60).map(x=>x.it);
}
function cmdkRender(){
  const box=$('#cmdk-list'); if(!box) return;
  cmdkItems=cmdkSource();
  if(!cmdkItems.length){ box.innerHTML='<div class="cmdk-empty">Ничего не найдено</div>'; return; }
  cmdkSel=clamp(cmdkSel,0,cmdkItems.length-1);
  box.innerHTML=cmdkItems.map((it,i)=>
    `<button class="cmdk-item${i===cmdkSel?' sel':''}" data-i="${i}">
       <span class="k">${it.k}</span><span class="t">${esc(it.t)}</span>
       ${it.hint?`<span class="h">${esc(it.hint)}</span>`:''}</button>`).join('');
  box.querySelectorAll('.cmdk-item').forEach(b=>{
    b.onclick=()=>cmdkRun(+b.dataset.i);
    b.onmousemove=()=>{ if(cmdkSel!==+b.dataset.i){ cmdkSel=+b.dataset.i;
      box.querySelectorAll('.cmdk-item').forEach(x=>x.classList.toggle('sel',x===b)); } };
  });
  const sel=box.querySelector('.sel'); if(sel) sel.scrollIntoView({block:'nearest'});
}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function cmdkRun(i){
  const it=cmdkItems[i]; if(!it) return;
  cmdkClose();
  try{ it.run(); }catch(e){ toast('Не удалось выполнить: '+e.message); }
}
if($('#cmdk-inp')){
  $('#cmdk-inp').addEventListener('input',()=>{ cmdkSel=0; cmdkRender(); });
  $('#cmdk-inp').addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='ArrowDown'){ e.preventDefault(); cmdkSel++; cmdkRender(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); cmdkSel--; cmdkRender(); }
    else if(e.key==='Enter'){ e.preventDefault(); cmdkRun(cmdkSel); }
    else if(e.key==='Escape'){ e.preventDefault(); cmdkClose(); }
  });
  $('#cmdk').addEventListener('click',e=>{ if(e.target.id==='cmdk') cmdkClose(); });
}

/* ================= УДОБСТВА: снимок, копирование, полный экран ============ */
function takeSnapshot(){
  const a=A(); if(!a){ toast('Сначала откройте симуляцию'); return; }
  S.snapshot={sim:S.active,t:a.state.t,
    rows:a.def.readouts(a.state,a.params).filter(r=>typeof r[1]==='number'&&isFinite(r[1]))};
  $('#cmpbox').classList.remove('hidden');
  updateCompare();
  toast('Снимок сделан: показания сравниваются с текущими');
}
function updateCompare(){
  const box=$('#cmpbox'); if(!box||box.classList.contains('hidden')) return;
  const a=A(), snap=S.snapshot;
  if(!a||!snap||snap.sim!==S.active){
    $('#cmp-body').innerHTML='<div style="color:var(--ink-3)">Снимок сделан в другой симуляции.</div>';
    return;
  }
  const now=a.def.readouts(a.state,a.params);
  const rows=snap.rows.map(([l,v0])=>{
    const cur=now.find(r=>r[0]===l);
    if(!cur||typeof cur[1]!=='number'||!isFinite(cur[1])) return '';
    const d=cur[1]-v0;
    const cls=Math.abs(d)<1e-9?'':(d>0?'up':'dn');
    const sign=d>0?'+':'';
    return `<div class="cmp-row"><span>${esc(l)}</span>
      <span class="d ${cls}">${sign}${fmt(d)}</span></div>`;
  }).join('');
  $('#cmp-body').innerHTML=`<div class="cmp-row" style="color:var(--ink-3)">
      <span>снимок при t</span><span>${snap.t.toFixed(2)} с</span></div>`+rows;
}
if($('#cmp-close')) $('#cmp-close').onclick=()=>{ $('#cmpbox').classList.add('hidden'); S.snapshot=null; };

function copyReadouts(){
  const a=A(); if(!a){ toast('Сначала откройте симуляцию'); return; }
  const txt=a.def.title+'\n'+a.def.readouts(a.state,a.params)
    .map(([l,v,u])=>`${l}\t${typeof v==='number'?fmt(v):v}\t${u||''}`).join('\n');
  toast(copyText(txt)?'Показания скопированы':'Не удалось скопировать');
}
function copyParams(){
  const a=A(); if(!a){ toast('Сначала откройте симуляцию'); return; }
  const txt=a.def.params.filter(q=>q.type!=='group')
    .map(q=>`${q.label}\t${a.params[q.key]}\t${q.unit||''}`).join('\n');
  toast(copyText(a.def.title+'\n'+txt)?'Параметры скопированы':'Не удалось скопировать');
}
function toggleFullscreen(){
  try{
    if(document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }catch(_){ toast('Полноэкранный режим недоступен'); }
}

/* ============================ ДОСТУП ПО ПАРОЛЮ ==========================
   В коде хранится ТОЛЬКО SHA-256-хэш пароля — самого пароля здесь нет.
   Это защита уровня «пособие не открыть без пароля от преподавателя», а не
   криптография: код выполняется на устройстве ученика и в принципе вскрываем.
   SHA-256 реализован на чистом JS, потому что crypto.subtle недоступен на
   http-адресах локальной сети (телефон, открывающий пособие с ноутбука). */
const AUTH_HASH='7fce9a9a82c9dad39f8a98a2c8a5bd37a5fb2c207af75ee40e4f39bf989b6239';
function sha256hex(msg){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const b=new TextEncoder().encode(msg);
  const L=b.length;
  // выравнивание: 1-бит, нули, 64-битная длина сообщения
  const total=(((L+8)>>6)+1)<<6;
  const m=new Uint8Array(total);
  m.set(b); m[L]=0x80;
  const dv=new DataView(m.buffer);
  dv.setUint32(total-8, Math.floor(L/536870912), false);   // старшие биты длины (L*8 / 2^32)
  dv.setUint32(total-4, (L<<3)>>>0, false);
  const rr=(x,n)=>(x>>>n)|(x<<(32-n));
  const w=new Uint32Array(64);
  for(let off=0; off<total; off+=64){
    for(let i=0;i<16;i++) w[i]=dv.getUint32(off+i*4,false);
    for(let i=16;i<64;i++){
      const s0=rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3);
      const s1=rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let[a,bb,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){
      const S1=rr(e,6)^rr(e,11)^rr(e,25);
      const ch=(e&f)^(~e&g);
      const t1=(h+S1+ch+K[i]+w[i])>>>0;
      const S0=rr(a,2)^rr(a,13)^rr(a,22);
      const mj=(a&bb)^(a&c)^(bb&c);
      const t2=(S0+mj)>>>0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=bb; bb=a; a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+bb)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  return H.map(x=>x.toString(16).padStart(8,'0')).join('');
}
function lockInit(){
  const lk=$('#lock'); if(!lk) return;
  if(LS.get('authv1',null)===AUTH_HASH){ lk.classList.add('hidden'); return; }
  const inp=$('#lock-pass'), err=$('#lock-err'), card=$('#lock-card');
  const attempt=()=>{
    if(sha256hex(inp.value.trim())===AUTH_HASH){
      LS.set('authv1',AUTH_HASH);
      lk.classList.add('hidden'); resize(); toast('Доступ открыт');
    } else {
      err.textContent='Неверный пароль'; inp.select();
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    }
  };
  $('#lock-enter').onclick=attempt;
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') attempt(); });
  setTimeout(()=>inp.focus(),60);
}
initFloatingPanels();
lockInit();

/* ================================= СТАРТ =============================== */
applySettings(); setTool('pan'); renderTree(); renderParams();
// при следующем запуске откроем ту же тему, если это разрешено в настройках
if(isNarrow()) closeSimMobile();          // на телефоне начинаем с конспекта
openTopic((S.settings.restore!==false && LS.get('lastTopic',null) && ALL.some(t=>t.id===LS.get('lastTopic',null)))
  ? LS.get('lastTopic',null) : 'intro');
resize();
addEventListener('load',()=>{ typeset($('#pane')); resize(); });
