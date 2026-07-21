'use strict';
Object.assign(SIMS,{
/* ================== ЭЛЕКТРОСТАТИКА: ЗАКОН КУЛОНА И ПОЛЕ ================= */
efield:{
  title:'Электрическая сила и поле',
  params:[
    {key:'scene',label:'Конфигурация',type:'select',default:'two',
     options:[{v:'two',   t:'Два заряда (закон Кулона)'},
              {v:'dipole',t:'Диполь (+Q и −Q)'},
              {v:'same',  t:'Два одинаковых (отталкивание)'},
              {v:'triangle',t:'Три заряда: суперпозиция сил'}]},
    {key:'q1', label:'Заряд q₁',unit:'нКл',min:-20,max:20,step:0.5,default:8},
    {key:'q2', label:'Заряд q₂',unit:'нКл',min:-20,max:20,step:0.5,default:-8},
    {key:'q3', label:'Заряд q₃ (для трёх)',unit:'нКл',min:-20,max:20,step:0.5,default:5},
    {key:'d',  label:'Расстояние между зарядами',unit:'м',min:0.5,max:8,step:0.1,default:3},

    {type:'group',label:'Пробный заряд'},
    {key:'qt', label:'Пробный заряд q₀',unit:'нКл',min:-5,max:5,step:0.5,default:1},
    {key:'tx', label:'Положение пробного заряда x',unit:'м',min:-6,max:6,step:0.1,default:0},
    {key:'ty', label:'Положение пробного заряда y',unit:'м',min:-6,max:6,step:0.1,default:2.5},

    {type:'group',label:'Показывать'},
    {key:'fieldLines',label:'Силовые линии поля',type:'check',default:true},
    {key:'fieldGrid', label:'Сетка векторов поля',type:'check',default:false},
    {key:'forceVec',  label:'Сила на пробный заряд',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  k:8.99e9,                                       // постоянная Кулона
  /* базовые позиции по конфигурации (если пользователь не двигал заряды) */
  basePos(p){
    const h=p.d/2;
    if(p.scene==='triangle') return [{x:-h,y:-h*0.6},{x:h,y:-h*0.6},{x:0,y:h}];
    return [{x:-h,y:0},{x:h,y:0}];
  },
  /* список зарядов сцены: [{x,y,q(Кл)}]. Позиции берём из p.pos, если заданы (перетащены). */
  charges(p){
    const nC=1e-9, base=this.basePos(p);
    const pos = (p._pos && p._pos.length===base.length) ? p._pos : base;
    let qs;
    if(p.scene==='dipole') qs=[Math.abs(p.q1),-Math.abs(p.q1)];
    else if(p.scene==='same') qs=[Math.abs(p.q1),Math.abs(p.q1)];
    else if(p.scene==='triangle') qs=[p.q1,p.q2,p.q3];
    else qs=[p.q1,p.q2];
    return pos.map((c,i)=>({x:c.x,y:c.y,q:qs[i]*nC}));
  },
  /* перетаскиваемые точки: заряды + пробный заряд */
  dragPoints(p){
    const cs=this.charges(p).map(c=>({x:c.x,y:c.y}));
    cs.push({x:p.tx,y:p.ty});
    return cs;
  },
  dragMove(p,idx,x,y){
    const cs=this.charges(p);
    if(idx>=cs.length){ p.tx=Math.round(x*10)/10; p.ty=Math.round(y*10)/10; return; }  // проба
    // двигаем заряд: сохраняем позиции в p._pos
    if(!p._pos || p._pos.length!==cs.length) p._pos=cs.map(c=>({x:c.x,y:c.y}));
    p._pos[idx]={x:Math.round(x*10)/10, y:Math.round(y*10)/10};
  },
  /* поле E в точке (x,y) от всех зарядов, В/м */
  fieldAt(p,x,y){
    let Ex=0,Ey=0;
    for(const c of this.charges(p)){
      const dx=x-c.x, dy=y-c.y, r2=dx*dx+dy*dy, r=Math.sqrt(r2);
      if(r<0.08) continue;
      const E=this.k*c.q/r2;
      Ex+=E*dx/r; Ey+=E*dy/r;
    }
    return {Ex,Ey,mag:Math.hypot(Ex,Ey)};
  },
  /* сила Кулона между двумя первыми зарядами (для наглядной подписи) */
  coulomb(p){
    const cs=this.charges(p); if(cs.length<2) return 0;
    const dx=cs[1].x-cs[0].x, dy=cs[1].y-cs[0].y, r=Math.hypot(dx,dy);
    return this.k*Math.abs(cs[0].q*cs[1].q)/(r*r);
  },
  init(p){
    // если число зарядов не совпадает с _pos (сменилась конфигурация) — сбросить перетаскивание
    if(p._pos && p._pos.length!==this.basePos(p).length) p._pos=null;
    return {t:0,event:null,__stop:null};
  },
  step(s,dt,p){
    s.t+=dt;
    if(p.tStop>0&&s.t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; }
  },
  anchors(s,p){ return this.charges(p).map(c=>({x:c.x,y:c.y})).concat([{x:p.tx,y:p.ty}]); },
  readouts(s,p){
    const F=this.coulomb(p), E=this.fieldAt(p,p.tx,p.ty);
    const Fon=E.mag*Math.abs(p.qt)*1e-9;
    const cs=this.charges(p), r=cs.length>=2?Math.hypot(cs[1].x-cs[0].x,cs[1].y-cs[0].y):0;
    return [['t',s.t,'с'],
            ['сила Кулона F (q₁–q₂)',F*1e9,'нН'],
            ['расстояние r',r,'м'],
            ['поле E в точке пробы',E.mag,'Н/Кл'],
            ['Eₓ',E.Ex,'Н/Кл'],['Eᵧ',E.Ey,'Н/Кл'],
            ['сила на пробный заряд',Fon*1e9,'нН'],
            ['направление поля',Math.atan2(E.Ey,E.Ex)*180/Math.PI,'°']];
  },
  graphs:[
    {label:'Модуль поля E вдоль движения пробы',unit:'Н/Кл',series:['E'],
     get(s,p){ return [SIMS.efield.fieldAt(p,p.tx,p.ty).mag,null]; }}
  ],
  presets:[
    {name:'Притяжение: +8 и −8 нКл',values:{scene:'two',q1:8,q2:-8,d:3,qt:1,tx:0,ty:2.5,tStop:0}},
    {name:'Отталкивание: два +8 нКл',values:{scene:'same',q1:8,q2:8,d:3,qt:1,tx:0,ty:2.5,tStop:0}},
    {name:'Диполь: силовые линии',values:{scene:'dipole',q1:10,q2:-10,d:3,qt:1,tx:0,ty:2,fieldLines:true,tStop:0}},
    {name:'Три заряда: суперпозиция',values:{scene:'triangle',q1:8,q2:8,q3:-6,d:4,qt:1,tx:0,ty:0,tStop:0}},
    {name:'Сетка векторов поля',values:{scene:'two',q1:10,q2:-10,d:4,fieldGrid:true,fieldLines:false,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const span=Math.max(p.d*2.4,10);
    const scale=clamp(Math.min((W-60)/(span*PX_PER_M),(H-60)/(span*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    const pos=v.c('--danger'), neg=v.c('--accent');    // + красный, − синий
    const cs=this.charges(p);

    // сетка векторов поля
    if(p.fieldGrid){
      const span=Math.max(p.d*2,8), step=span/9;
      /* Длину стрелки берём не по абсолютной величине поля (она зависит от заряда
         и может быть любой), а по её доле от самого сильного поля на сетке.
         Степень 0,3 сжимает разброс: у центра стрелки почти во всю ячейку,
         вдали они укорачиваются и бледнеют — поле «рассеивается». */
      const pts=[]; let Emax=0;
      for(let x=-span;x<=span;x+=step) for(let y=-span;y<=span;y+=step){
        const E=this.fieldAt(p,x,y);
        if(E.mag<1e-9) continue;
        pts.push({x,y,E}); if(E.mag>Emax) Emax=E.mag;
      }
      if(Emax>0) for(const q of pts){
        const rel=clamp(q.E.mag/Emax,0,1);
        const f=clamp(Math.pow(rel,0.30),0.30,1);        // 0,30…1 — далёкие вдвое-втрое короче
        const len=step*0.62*f;                            // короче: сетка не должна забивать сцену
        const ux=q.E.Ex/q.E.mag, uy=q.E.Ey/q.E.mag;
        ctx.lineWidth=v.lw(0.9);
        ctx.globalAlpha=clamp(0.16+0.30*Math.pow(rel,0.26),0.16,0.46);
        // стрелка центрирована на узле сетки — так сетка читается ровнее
        v.arrow(ctx,q.x-ux*len/2,q.y-uy*len/2,q.x+ux*len/2,q.y+uy*len/2,ink3);
      }
      ctx.globalAlpha=1;
    }

    // силовые линии: из каждого заряда выпускаем нити и трассируем ПО полю от + и
    // ПРОТИВ поля от − (тогда линии всегда «текут» от + к −, без петель).
    // RK-4, мелкий шаг, честная остановка у любого заряда или на границе.
    if(p.fieldLines){
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.3); ctx.globalAlpha=.7;
      const h=0.05, maxSteps=1400, bound=20;
      const trace=(x0,y0,sign)=>{               // sign=+1 идём по полю, −1 против
        let x=x0,y=y0;
        ctx.beginPath(); ctx.moveTo(x,y);
        for(let step=0;step<maxSteps;step++){
          const f=(xx,yy)=>{ const E=this.fieldAt(p,xx,yy); const m=E.mag||1; return [sign*E.Ex/m, sign*E.Ey/m]; };
          const [k1x,k1y]=f(x,y);
          const [k2x,k2y]=f(x+k1x*h/2, y+k1y*h/2);
          const [k3x,k3y]=f(x+k2x*h/2, y+k2y*h/2);
          const [k4x,k4y]=f(x+k3x*h, y+k3y*h);
          x+=(k1x+2*k2x+2*k3x+k4x)/6*h;
          y+=(k1y+2*k2y+2*k3y+k4y)/6*h;
          ctx.lineTo(x,y);
          if(Math.abs(x)>bound||Math.abs(y)>bound) break;
          // остановка при подходе к ЛЮБОМУ заряду (нить пришла к стоку/истоку)
          let stop=false;
          for(const c2 of cs){ if(Math.hypot(x-c2.x,y-c2.y)<0.28){ stop=true; break; } }
          if(stop) break;
        }
        ctx.stroke();
      };
      /* ВАЖНО: силовая линия, вышедшая из «+» и пришедшая в «−», — ОДНА И ТА ЖЕ линия.
         Если засеивать её и от плюса, и от минуса, она рисуется дважды; при симметрии
         обе копии совпадают, но стоит сдвинуть заряд — численные траектории расходятся,
         и линия выглядит раздвоенной. Поэтому засеиваем линии только от источников.

         Считаем баланс: сколько линий выходит из плюсов, столько же входит в минусы.
         Отдельно засеиваем от минусов лишь те линии, которым не нашлось пары среди
         плюсов, — они приходят из бесконечности (случай нескомпенсированного минуса). */
      const nLines=16;
      let Qpos=0, Qneg=0;
      for(const c of cs){ const q=c.q*1e9; if(q>0) Qpos+=q; else Qneg+=-q; }
      const Qref=Math.max(Qpos,Qneg,1e-9);
      const perUnit=nLines/Math.max(Qref/ (cs.length>2?1.6:1), 1e-9);
      // доля линий у минусов, которым не хватило плюсов (0, если плюсов достаточно)
      const negShare = Qneg>1e-12 ? Math.max(0,(Qneg-Qpos)/Qneg) : 0;

      const seed=(c,N,sign)=>{
        if(N<1) return;
        for(let i=0;i<N;i++){
          const a0=(i+0.5)/N*2*Math.PI;
          const x0=c.x+0.28*Math.cos(a0), y0=c.y+0.28*Math.sin(a0);
          trace(x0,y0,sign);
        }
      };
      for(const c of cs){
        const q=c.q*1e9, qmag=Math.abs(q);
        const N=Math.max(8, Math.round(clamp(perUnit*qmag,8,34)));
        if(q>0) seed(c,N,+1);                        // из «+» линии выходят
      }
      for(const c of cs){
        const q=c.q*1e9;
        if(q>=0) continue;
        // линии, входящие в «−» со стороны бесконечности
        const N=Math.round(Math.max(8, clamp(perUnit*(-q),8,34))*negShare);
        if(Qpos<1e-12) seed(c,Math.max(8,Math.round(clamp(perUnit*(-q),8,34))),-1);  // плюсов нет вовсе
        else seed(c,N,-1);
      }
      ctx.globalAlpha=1;
    }

    // заряды (компактные)
    for(const c of cs){
      const R=0.2+0.012*Math.abs(c.q*1e9);
      ctx.fillStyle=c.q>0?pos:neg;
      ctx.beginPath(); ctx.arc(c.x,c.y,R,0,7); ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=v.lw(2);
      // знак
      ctx.beginPath();
      if(c.q>0){ ctx.moveTo(c.x-R*0.45,c.y); ctx.lineTo(c.x+R*0.45,c.y); ctx.moveTo(c.x,c.y-R*0.45); ctx.lineTo(c.x,c.y+R*0.45); }
      else { ctx.moveTo(c.x-R*0.45,c.y); ctx.lineTo(c.x+R*0.45,c.y); }
      ctx.stroke();
      // подпись — выше заряда с отступом, чтобы не налегала
      v.label(ctx,`${(c.q*1e9).toFixed(1)} нКл`,c.x,c.y-R,-20,-12,c.q>0?pos:neg);
    }

    // сила Кулона между двумя зарядами (стрелки вдоль линии)
    if(cs.length===2){
      const F=this.coulomb(p), attract=cs[0].q*cs[1].q<0;
      const dx=cs[1].x-cs[0].x, dy=cs[1].y-cs[0].y, r=Math.hypot(dx,dy), ux=dx/r, uy=dy/r;
      const al=Math.min(1.5, 0.4+Math.log10(1+F*1e9)*0.4);
      // на заряд 1
      const s1=attract?1:-1, s2=attract?-1:1;
      v.arrow(ctx,cs[0].x,cs[0].y,cs[0].x+ux*al*s1,cs[0].y+uy*al*s1,dang);
      v.arrow(ctx,cs[1].x,cs[1].y,cs[1].x+ux*al*s2,cs[1].y+uy*al*s2,dang);
      v.label(ctx,`F = ${(F*1e9).toFixed(2)} нН`,(cs[0].x+cs[1].x)/2,(cs[0].y+cs[1].y)/2-1.2,-30,0,dang);
      v.label(ctx,attract?'притяжение':'отталкивание',(cs[0].x+cs[1].x)/2,(cs[0].y+cs[1].y)/2-1.2,-40,16,ink3);
    }

    // пробный заряд и сила на него
    const E=this.fieldAt(p,p.tx,p.ty);
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(p.tx,p.ty,0.22,0,7); ctx.fill();
    v.label(ctx,`проба q₀ = ${p.qt} нКл`,p.tx,p.ty,10,-8,meas);
    if(p.forceVec && E.mag>1e-6){
      const dir=Math.sign(p.qt)||1;
      const fl=Math.min(2.5, 0.5+Math.log10(1+E.mag)*0.5);
      const ux=E.Ex/E.mag*dir, uy=E.Ey/E.mag*dir;
      v.arrow(ctx,p.tx,p.ty,p.tx+ux*fl,p.ty+uy*fl,meas);
      v.label(ctx,`F = q₀·E`,p.tx+ux*fl,p.ty+uy*fl,8,0,meas);
    }
  }
}
,

/* ================== ТЕОРЕМА ГАУССА: ПОТОК ПОЛЯ ================= */
gauss:{
  title:'Теорема Гаусса: поток через поверхность',
  params:[
    {key:'scene',label:'Конфигурация зарядов',type:'select',default:'single',
     options:[{v:'single',t:'Один заряд'},
              {v:'pair',  t:'Два заряда рядом'},
              {v:'plusminus',t:'Заряд + и − (диполь)'}]},
    {key:'Q1', label:'Заряд Q₁',unit:'нКл',min:-20,max:20,step:0.5,default:10},
    {key:'Q2', label:'Заряд Q₂ (для двух)',unit:'нКл',min:-20,max:20,step:0.5,default:6},
    {key:'sep',label:'Расстояние между зарядами',unit:'м',min:1,max:8,step:0.1,default:3},

    {type:'group',label:'Гауссова поверхность (окружность)'},
    {key:'gx', label:'Центр поверхности x',unit:'м',min:-8,max:8,step:0.1,default:0},
    {key:'gy', label:'Центр поверхности y',unit:'м',min:-8,max:8,step:0.1,default:0},
    {key:'gr', label:'Радиус поверхности R',unit:'м',min:0.5,max:8,step:0.1,default:2.5},

    {type:'group',label:'Показывать'},
    {key:'flux',label:'Стрелки потока по поверхности',type:'check',default:true},
    {key:'lines',label:'Силовые линии',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  k:8.99e9, eps0:8.854e-12,
  charges(p){
    const nC=1e-9, h=p.sep/2;
    if(p.scene==='single') return [{x:0,y:0,q:p.Q1*nC}];
    if(p.scene==='pair')   return [{x:-h,y:0,q:p.Q1*nC},{x:h,y:0,q:p.Q2*nC}];
    return [{x:-h,y:0,q:Math.abs(p.Q1)*nC},{x:h,y:0,q:-Math.abs(p.Q1)*nC}];
  },
  /* Двумерная электростатика: поле E ∝ 1/r (как у длинной заряженной нити).
     В 2D именно при таком поле теорема Гаусса ∮E·n·dl = Q/ε₀ выполняется ТОЧНО и
     не зависит от радиуса — что и демонстрирует симуляция. */
  fieldAt(p,x,y){
    let Ex=0,Ey=0;
    for(const c of this.charges(p)){
      const dx=x-c.x, dy=y-c.y, r=Math.hypot(dx,dy);
      if(r<0.05) continue;
      const Em=this.k*c.q/r;                       // 2D-поле: спад как 1/r
      Ex+=Em*dx/r; Ey+=Em*dy/r;
    }
    return {Ex,Ey,mag:Math.hypot(Ex,Ey)};
  },
  /* заряд, заключённый внутри гауссовой окружности */
  enclosed(p){
    let Q=0;
    for(const c of this.charges(p)) if(Math.hypot(c.x-p.gx,c.y-p.gy)<p.gr) Q+=c.q;
    return Q;
  },
  /* численный поток Φ = ∮ E·n dl по окружности. Для 2D-поля E=kq/r он равен 2πk·Q_внутр
     и НЕ зависит от радиуса — двумерный аналог теоремы Гаусса. */
  flux(p){
    const N=240; let Phi=0;
    for(let i=0;i<N;i++){
      const a=i/N*2*Math.PI, x=p.gx+p.gr*Math.cos(a), y=p.gy+p.gr*Math.sin(a);
      const E=this.fieldAt(p,x,y);
      const nx=Math.cos(a), ny=Math.sin(a);
      const dl=2*Math.PI*p.gr/N;
      Phi+=(E.Ex*nx+E.Ey*ny)*dl;
    }
    return Phi;
  },
  fluxTheory(p){ return 2*Math.PI*this.k*this.enclosed(p); },   // 2πk·Q_внутр
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt;
    if(p.tStop>0&&s.t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; }
  },
  dragPoints(p){
    const cs=this.charges(p).map(c=>({x:c.x,y:c.y}));
    cs.push({x:p.gx,y:p.gy});                         // центр гауссовой поверхности
    return cs;
  },
  dragMove(p,idx,x,y){
    const cs=this.charges(p);
    if(idx>=cs.length){ p.gx=Math.round(x*10)/10; p.gy=Math.round(y*10)/10; }
    // заряды тут не двигаем (геометрия задаётся scene/sep) — только поверхность
  },
  anchors(s,p){ return this.charges(p).map(c=>({x:c.x,y:c.y})).concat([{x:p.gx,y:p.gy}]); },
  readouts(s,p){
    const Qin=this.enclosed(p), Phi=this.flux(p), PhiTheory=this.fluxTheory(p);
    const match=Math.abs(Phi-PhiTheory)<Math.abs(PhiTheory)*0.05+1;
    return [['t',s.t,'с'],
            ['заряд внутри Qвнутр',Qin*1e9,'нКл'],
            ['поток Φ (численно)',Phi,'усл.ед.'],
            ['2πk·Qвнутр (теорема Гаусса)',PhiTheory,'усл.ед.'],
            ['Φ = 2πk·Qвнутр',match?1:0,match?'выполняется':'—'],
            ['радиус поверхности R',p.gr,'м'],
            ['всего зарядов',this.charges(p).length,'']];
  },
  graphs:[
    {label:'Поток Φ через поверхность',unit:'В·м',series:['Φ'],get(s,p){ return [SIMS.gauss.flux(p),null]; }},
    {label:'Заряд внутри поверхности',unit:'нКл',series:['Q'],get(s,p){ return [SIMS.gauss.enclosed(p)*1e9,null]; }}
  ],
  presets:[
    {name:'Заряд внутри — поток есть',values:{scene:'single',Q1:10,gx:0,gy:0,gr:2.5,tStop:0}},
    {name:'Поверхность не охватывает заряд — поток 0',values:{scene:'single',Q1:10,gx:5,gy:0,gr:2,tStop:0}},
    {name:'Большой радиус — тот же поток',values:{scene:'single',Q1:10,gx:0,gy:0,gr:5,tStop:0}},
    {name:'Диполь: оба внутри — поток 0',values:{scene:'plusminus',Q1:10,sep:3,gx:0,gy:0,gr:4,tStop:0}},
    {name:'Диполь: только + внутри',values:{scene:'plusminus',Q1:10,sep:3,gx:-1.5,gy:0,gr:1.2,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const span=Math.max(p.gr*2.6, p.sep*2.4, 12);
    const scale=clamp(Math.min((W-60)/(span*PX_PER_M),(H-60)/(span*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    const pos=v.c('--danger'), neg=v.c('--accent');
    const cs=this.charges(p);

    // силовые линии (используем ту же трассировку, что и в efield)
    if(p.lines){
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.2); ctx.globalAlpha=.55;
      const hasPos=cs.some(c=>c.q>0);
      const sources=hasPos?cs.filter(c=>c.q>0):[{x:0,y:0,q:1}];
      const h=0.06;
      for(const c of sources){ for(let i=0;i<14;i++){
        const a0=i/14*2*Math.PI+0.001; let x=c.x+0.32*Math.cos(a0), y=c.y+0.32*Math.sin(a0);
        ctx.beginPath(); ctx.moveTo(x,y);
        for(let st=0;st<900;st++){ const E1=this.fieldAt(p,x,y); if(E1.mag<1e-9)break;
          const d=hasPos?1:-1; let ux=d*E1.Ex/E1.mag, uy=d*E1.Ey/E1.mag;
          const E2=this.fieldAt(p,x+ux*h/2,y+uy*h/2); if(E2.mag<1e-9)break;
          ux=d*E2.Ex/E2.mag; uy=d*E2.Ey/E2.mag; x+=ux*h; y+=uy*h; ctx.lineTo(x,y);
          if(Math.abs(x)>16||Math.abs(y)>16)break;
          let stop=false; for(const c2 of cs){ const t=hasPos?c2.q<0:c2.q>0; if(t&&Math.hypot(x-c2.x,y-c2.y)<0.3){stop=true;break;} }
          if(stop)break;
        } ctx.stroke();
      }}
      ctx.globalAlpha=1;
    }

    // гауссова поверхность
    const Qin=this.enclosed(p);
    ctx.strokeStyle=Qin>1e-12?dang:(Qin<-1e-12?neg:ink3); ctx.lineWidth=v.lw(2.4);
    ctx.setLineDash([v.lw(6),v.lw(4)]);
    ctx.beginPath(); ctx.arc(p.gx,p.gy,p.gr,0,7); ctx.stroke(); ctx.setLineDash([]);
    // лёгкая заливка
    ctx.fillStyle=Qin>1e-12?dang:(Qin<-1e-12?neg:ink3); ctx.globalAlpha=.06;
    ctx.beginPath(); ctx.arc(p.gx,p.gy,p.gr,0,7); ctx.fill(); ctx.globalAlpha=1;
    v.label(ctx,'гауссова поверхность',p.gx,p.gy-p.gr,-40,-8,ink3);

    // стрелки потока (E·n) по поверхности
    if(p.flux){
      const M=16;
      for(let i=0;i<M;i++){
        const a=i/M*2*Math.PI, x=p.gx+p.gr*Math.cos(a), y=p.gy+p.gr*Math.sin(a);
        const E=this.fieldAt(p,x,y); if(E.mag<1e-6) continue;
        const nx=Math.cos(a), ny=Math.sin(a);
        const En=E.Ex*nx+E.Ey*ny;                     // проекция на нормаль
        const len=Math.max(-0.9,Math.min(0.9, En/1e10));
        v.arrow(ctx,x,y,x+nx*len,y+ny*len, En>=0?dang:neg);
      }
    }

    // заряды
    for(const c of cs){
      const R=0.32+0.02*Math.abs(c.q*1e9);
      ctx.fillStyle=c.q>0?pos:neg; ctx.beginPath(); ctx.arc(c.x,c.y,R,0,7); ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=v.lw(2.5); ctx.beginPath();
      if(c.q>0){ ctx.moveTo(c.x-R*0.5,c.y);ctx.lineTo(c.x+R*0.5,c.y);ctx.moveTo(c.x,c.y-R*0.5);ctx.lineTo(c.x,c.y+R*0.5); }
      else { ctx.moveTo(c.x-R*0.5,c.y);ctx.lineTo(c.x+R*0.5,c.y); }
      ctx.stroke();
      v.label(ctx,`${(c.q*1e9).toFixed(1)} нКл`,c.x,c.y-R,-22,-8,c.q>0?pos:neg);
    }

    // сводка потока
    const Phi=this.flux(p);
    v.label(ctx,`Q_внутр = ${(Qin*1e9).toFixed(1)} нКл`,p.gx,p.gy+p.gr,-40,16,ink3);
    v.label(ctx,`поток Φ ≈ Q/ε₀`,p.gx,p.gy+p.gr,-30,30,ink3);
  }
}
,

/* ================== ЭЛЕКТРОСТАТИКА: РАСПРЕДЕЛЕНИЯ ЗАРЯДА ================= */
charged:{
  title:'Распределения заряда и теорема Гаусса',
  params:[
    {key:'shape',label:'Заряженное тело',type:'select',default:'sphere',
     options:[{v:'sphere',t:'Равномерно заряженный шар'},
              {v:'line',  t:'Линейный заряд (нить)'},
              {v:'plane', t:'Плоскость (пластина)'}]},
    {key:'Q',   label:'Полный заряд Q',unit:'нКл',min:-30,max:30,step:1,default:15},
    {key:'R',   label:'Размер тела (радиус шара / — )',unit:'м',min:0.5,max:5,step:0.1,default:2},

    {type:'group',label:'Пробная точка (измеряем поле)'},
    {key:'px',  label:'Положение пробы x',unit:'м',min:-10,max:10,step:0.1,default:4},
    {key:'py',  label:'Положение пробы y',unit:'м',min:-10,max:10,step:0.1,default:0},

    {type:'group',label:'Показывать'},
    {key:'gauss', label:'Гауссова поверхность',type:'check',default:true},
    {key:'graph', label:'График E(r)',type:'check',default:true},
    {key:'arrows',label:'Стрелки поля',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  k:8.99e9,
  /* модуль поля на расстоянии d от центра/оси/плоскости */
  fieldMag(p,d){
    const Q=p.Q*1e-9;
    if(p.shape==='sphere'){
      if(d<=p.R) return this.k*Q*d/(p.R*p.R*p.R);   // внутри: линейно растёт (∝ r)
      return this.k*Q/(d*d);                        // снаружи: как точечный
    }
    if(p.shape==='line'){
      const lam=Q/(2*p.R);                           // погонная плотность (длина ≈ 2R)
      return 2*this.k*lam/Math.max(d,0.05);          // поле нити ∝ 1/r
    }
    // плоскость: однородное, не зависит от расстояния
    const sigma=Q/(Math.PI*p.R*p.R);
    return 2*Math.PI*this.k*sigma;
  },
  /* расстояние пробной точки до тела */
  distOf(p,x,y){
    if(p.shape==='sphere') return Math.hypot(x,y);
    if(p.shape==='line')   return Math.abs(y);       // нить вдоль оси x, r = |y|
    return Math.abs(y);                              // плоскость в xz (y=0), r = |y|
  },
  fieldVec(p,x,y){
    const d=this.distOf(p,x,y), E=this.fieldMag(p,d);
    if(p.shape==='sphere'){ const r=Math.hypot(x,y)||1; return {Ex:E*x/r,Ey:E*y/r,mag:E}; }
    if(p.shape==='line'){ const s=Math.sign(y)||1; return {Ex:0,Ey:E*s,mag:E}; }
    const s=Math.sign(y)||1; return {Ex:0,Ey:E*s,mag:E};
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt;
    if(p.tStop>0&&s.t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; }
  },
  dragPoints(p){ return [{x:p.px,y:p.py}]; },
  dragMove(p,idx,x,y){ p.px=Math.round(x*10)/10; p.py=Math.round(y*10)/10; },
  anchors(s,p){ return [{x:0,y:0},{x:p.px,y:p.py}]; },
  readouts(s,p){
    const d=this.distOf(p,p.px,p.py), E=this.fieldMag(p,d);
    const law={sphere:(d<=p.R?'внутри: E ∝ r':'снаружи: E = kQ/r²'),
               line:'нить: E = 2kλ/r',plane:'плоскость: E = 2πkσ (однородно)'}[p.shape];
    const out=[['t',s.t,'с'],['расстояние до тела',d,'м'],
               ['поле E',E,'В/м'],['закон',0,law]];
    if(p.shape==='sphere'){
      out.push(['E на поверхности',this.fieldMag(p,p.R),'В/м'],
               ['E точечного kQ/r²',this.k*p.Q*1e-9/Math.max(d*d,0.01),'В/м']);
    }
    return out;
  },
  graphs:[
    {label:'E(r) — поле от расстояния',unit:'В/м',series:['E'],
     get(s,p){ return [SIMS.charged.fieldMag(p,SIMS.charged.distOf(p,p.px,p.py)),null]; }}
  ],
  presets:[
    {name:'Шар: поле внутри и снаружи',values:{shape:'sphere',Q:15,R:2,px:4,py:0,tStop:0}},
    {name:'Шар: проба внутри (E ∝ r)',values:{shape:'sphere',Q:15,R:3,px:1,py:0,tStop:0}},
    {name:'Линейный заряд (нить): E ∝ 1/r',values:{shape:'line',Q:15,R:2,px:0,py:3,tStop:0}},
    {name:'Плоскость: однородное поле',values:{shape:'plane',Q:15,R:3,px:0,py:3,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const span=Math.max(p.R*2.5, 12);
    const scale=clamp(Math.min((W-60)/(span*PX_PER_M),(H-60)/(span*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    const chg=p.Q>0?dang:acc;

    // тело
    if(p.shape==='sphere'){
      ctx.fillStyle=chg; ctx.globalAlpha=.22; ctx.beginPath(); ctx.arc(0,0,p.R,0,7); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=chg; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(0,0,p.R,0,7); ctx.stroke();
      v.label(ctx,`шар Q = ${p.Q} нКл, R = ${p.R} м`,0,-p.R,-46,-8,chg);
    } else if(p.shape==='line'){
      // заряженный участок длиной 2R
      ctx.strokeStyle=chg; ctx.lineWidth=v.lw(5);
      ctx.beginPath(); ctx.moveTo(-p.R,0); ctx.lineTo(p.R,0); ctx.stroke();
      // пунктирное продолжение: нить считаем бесконечной
      ctx.lineWidth=v.lw(2.5); ctx.globalAlpha=.45; ctx.setLineDash([v.lw(5),v.lw(5)]);
      ctx.beginPath();
      ctx.moveTo(-p.R,0); ctx.lineTo(-p.R-2.5,0);
      ctx.moveTo( p.R,0); ctx.lineTo( p.R+2.5,0);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,`нить Q = ${p.Q} нКл, λ = ${(p.Q/(2*p.R)).toFixed(2)} нКл/м`,0,0,-62,-14,chg);
    } else {
      ctx.strokeStyle=chg; ctx.lineWidth=v.lw(5);
      ctx.beginPath(); ctx.moveTo(-p.R*2,0); ctx.lineTo(p.R*2,0); ctx.stroke();
      // штриховка плоскости
      ctx.lineWidth=v.lw(1);
      for(let x=-p.R*2;x<=p.R*2;x+=0.6){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x-0.2,-0.3); ctx.stroke(); }
      v.label(ctx,`плоскость σ, Q = ${p.Q} нКл`,0,0,-46,-12,chg);
    }

    // стрелки поля на сетке
    if(p.arrows){
      const span=Math.max(p.R*2.2,10), st=span/7;
      const pts=[]; let Emax=0;
      for(let x=-span;x<=span;x+=st) for(let y=-span;y<=span;y+=st){
        const E=this.fieldVec(p,x,y);
        if(!isFinite(E.mag)||E.mag<1e-9) continue;
        pts.push({x,y,E}); if(E.mag>Emax) Emax=E.mag;
      }
      if(Emax>0) for(const q of pts){
        const rel=clamp(q.E.mag/Emax,0,1);
        const f=clamp(Math.pow(rel,0.30),0.30,1);
        const len=st*0.62*f;
        const ux=q.E.Ex/q.E.mag, uy=q.E.Ey/q.E.mag;
        ctx.lineWidth=v.lw(0.9);
        ctx.globalAlpha=clamp(0.16+0.30*Math.pow(rel,0.26),0.16,0.46);
        v.arrow(ctx,q.x-ux*len/2,q.y-uy*len/2,q.x+ux*len/2,q.y+uy*len/2,ink3);
      }
      ctx.globalAlpha=1;
    }

    // гауссова поверхность вокруг тела через пробную точку
    if(p.gauss){
      const d=Math.max(this.distOf(p,p.px,p.py),0.25);
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.setLineDash([v.lw(5),v.lw(4)]);
      if(p.shape==='sphere'){
        ctx.beginPath(); ctx.arc(0,0,d,0,7); ctx.stroke();
        ctx.setLineDash([]);
        v.label(ctx,'гауссова сфера радиуса r',0,d,-52,-6,sec);
      }
      else if(p.shape==='line'){
        /* цилиндр соосен нити и КОРОЧЕ заряженного участка, поэтому нить
           входит через одну крышку и выходит через другую — как и должно быть */
        const Lc=Math.min(Math.max(d*0.9,0.35), p.R*0.9);   // всегда короче заряженного участка
        ctx.beginPath();
        ctx.moveTo(-Lc, d); ctx.lineTo(Lc, d);           // верхняя образующая
        ctx.moveTo(-Lc,-d); ctx.lineTo(Lc,-d);           // нижняя образующая
        ctx.stroke();
        // торцевые крышки — эллипсы (цилиндр в перспективе)
        const capW=Math.max(d*0.28,0.18);
        for(const sx of [-Lc,Lc]){
          ctx.beginPath();
          if(ctx.ellipse) ctx.ellipse(sx,0,capW,d,0,0,7);
          else { ctx.moveTo(sx,-d); ctx.lineTo(sx,d); }
          ctx.stroke();
        }
        ctx.setLineDash([]);
        // радиус цилиндра
        ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.2);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,d); ctx.stroke();
        v.label(ctx,`r = ${d.toFixed(2)} м`,0,d/2,6,4,sec);
        v.label(ctx,'гауссов цилиндр вокруг нити',0,d,-64,-8,sec);
        v.label(ctx,'через торцы поток не идёт: поле им параллельно',0,-d,-96,20,ink3);
      }
      else {
        ctx.beginPath(); ctx.moveTo(-6,d); ctx.lineTo(6,d); ctx.moveTo(-6,-d); ctx.lineTo(6,-d); ctx.stroke();
        // боковые грани коробки
        ctx.beginPath(); ctx.moveTo(-6,-d); ctx.lineTo(-6,d); ctx.moveTo(6,-d); ctx.lineTo(6,d); ctx.stroke();
        ctx.setLineDash([]);
        v.label(ctx,'гауссова коробка по обе стороны плоскости',0,d,-84,-6,sec);
      }
    }

    // пробная точка + вектор поля
    const Ev=this.fieldVec(p,p.px,p.py);
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(p.px,p.py,0.18,0,7); ctx.stroke();
    if(Ev.mag>1e-6){
      const fl=Math.min(2.2,0.4+Math.log10(1+Ev.mag)*0.4);
      v.arrow(ctx,p.px,p.py,p.px+Ev.Ex/Ev.mag*fl,p.py+Ev.Ey/Ev.mag*fl,meas);
      v.label(ctx,`E = ${Ev.mag.toExponential(1)} В/м`,p.px+Ev.Ex/Ev.mag*fl,p.py+Ev.Ey/Ev.mag*fl,6,0,meas);
    }
    v.label(ctx,'пробу можно перетаскивать',0,-Math.max(p.R*2,10)+0.5,-56,0,ink3);
  }
},

/* ================= ЭЛЕКТРОСТАТИКА: КОНДЕНСАТОР, ДИЭЛЕКТРИК, ЭНЕРГИЯ ================= */
capacitor:{
  title:'Конденсатор: ёмкость, диэлектрик, энергия',
  params:[
    {key:'volt',   label:'Напряжение U',unit:'В',min:1,max:200,step:1,default:50},
    {key:'plateL', label:'Площадь пластин S',unit:'усл.ед.',min:1,max:12,step:0.5,default:6},
    {key:'gap',    label:'Зазор между пластинами d',unit:'мм',min:0.5,max:10,step:0.1,default:3},
    {key:'eps',    label:'Диэлектрическая проницаемость ε',min:1,max:10,step:0.1,default:1},

    {type:'group',label:'Показывать'},
    {key:'dielectric',label:'Диэлектрик между пластинами',type:'check',default:false},
    {key:'fieldLines',label:'Однородное поле',type:'check',default:true},
    {key:'charges',    label:'Заряды на пластинах',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  eps0:8.854e-12,
  /* ёмкость, заряд, энергия. S в усл.ед² (·1e-4 м²), d в мм (·1e-3 м). */
  calc(p){
    const eps=p.dielectric?p.eps:1;
    const S=p.plateL*1e-4, d=p.gap*1e-3;
    const C=eps*this.eps0*S/d;                       // Ф
    const Q=C*p.volt;                                // Кл
    const E=p.volt/d;                                // В/м
    const W=0.5*C*p.volt*p.volt;                     // Дж (энергия)
    const u=0.5*this.eps0*eps*E*E;                   // плотность энергии Дж/м³
    return {eps,C,Q,E,W,u,S,d};
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt;
    if(p.tStop>0&&s.t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; }
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const c=this.calc(p);
    return [['t',s.t,'с'],['напряжение U',p.volt,'В'],
            ['ёмкость C = εε₀S/d',c.C*1e12,'пФ'],
            ['заряд Q = CU',c.Q*1e9,'нКл'],
            ['поле E = U/d',c.E,'В/м'],
            ['энергия W = ½CU²',c.W*1e9,'нДж'],
            ['плотность энергии u',c.u,'Дж/м³'],
            ['диэлектрик ε',c.eps,''],
            ['во сколько ↑ ёмкость',c.eps,'раз']];
  },
  graphs:[
    {label:'Энергия W = ½CU²',unit:'нДж',series:['W'],get(s,p){ return [SIMS.capacitor.calc(p).W*1e9,null]; }},
    {label:'Ёмкость C',unit:'пФ',series:['C'],get(s,p){ return [SIMS.capacitor.calc(p).C*1e12,null]; }}
  ],
  presets:[
    {name:'Вакуумный конденсатор',values:{volt:50,plateL:6,gap:3,eps:1,dielectric:false,tStop:0}},
    {name:'С диэлектриком ε=5 (ёмкость ×5)',values:{volt:50,plateL:6,gap:3,eps:5,dielectric:true,tStop:0}},
    {name:'Меньше зазор — больше ёмкость',values:{volt:50,plateL:6,gap:1,eps:1,dielectric:false,tStop:0}},
    {name:'Больше площадь — больше ёмкость',values:{volt:50,plateL:12,gap:3,eps:1,dielectric:false,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-80)/(10*PX_PER_M),(H-80)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    const c=this.calc(p);
    // геометрия пластин на сцене
    const half=Math.max(1.2, p.gap*0.5), L=p.plateL*0.55;
    // диэлектрик — с зазорами до пластин и поляризационными зарядами на гранях
    if(p.dielectric){
      const gap=half*0.22, dh=half-gap;              // грани диэлектрика отступают от пластин
      ctx.fillStyle=sec; ctx.globalAlpha=.16; ctx.fillRect(-L*0.92,-dh,2*L*0.92,2*dh); ctx.globalAlpha=1;
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.4); ctx.strokeRect(-L*0.92,-dh,2*L*0.92,2*dh);
      v.label(ctx,`диэлектрик ε = ${p.eps}`,0,0,-34,0,sec);
      // связанные (поляризационные) заряды: у верхней грани — «−», у нижней — «+»
      // (индуцированы полем: поле направлено вниз от + пластины к − пластине)
      const npol=Math.max(3,Math.round(L*1.0));
      ctx.fillStyle=acc;
      for(let i=0;i<npol;i++){ const x=-L*0.92+(i+0.5)*(2*L*0.92/npol); v.label(ctx,'−',x,dh,-3,-8,acc); }
      ctx.fillStyle=dang;
      for(let i=0;i<npol;i++){ const x=-L*0.92+(i+0.5)*(2*L*0.92/npol); v.label(ctx,'+',x,-dh,-3,12,dang); }
      v.label(ctx,'связанные заряды поляризации',0,-dh,-56,26,sec);
    }
    // поле (однородные стрелки сверху вниз)
    if(p.fieldLines){
      const n=Math.max(3,Math.round(L*1.4));
      for(let i=0;i<n;i++){ const x=-L+ (i+0.5)*(2*L/n);
        ctx.globalAlpha=.6; v.arrow(ctx,x,half*0.85,x,-half*0.85,ink3); ctx.globalAlpha=1; }
      v.label(ctx,`E = ${c.E.toExponential(1)} В/м`,L,0,8,0,ink3);
    }
    // пластины
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(5);
    ctx.beginPath(); ctx.moveTo(-L,half); ctx.lineTo(L,half); ctx.stroke();      // верх +
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(5);
    ctx.beginPath(); ctx.moveTo(-L,-half); ctx.lineTo(L,-half); ctx.stroke();    // низ −
    // заряды на пластинах
    if(p.charges){
      const nq=Math.max(3,Math.round(L*1.2));
      ctx.fillStyle=dang;
      for(let i=0;i<nq;i++){ const x=-L+(i+0.5)*(2*L/nq); v.label(ctx,'+',x,half,-3,-10,dang); }
      ctx.fillStyle=acc;
      for(let i=0;i<nq;i++){ const x=-L+(i+0.5)*(2*L/nq); v.label(ctx,'−',x,-half,-3,14,acc); }
    }
    v.label(ctx,`+ ${p.volt} В`,-L,half,-6,-14,dang);
    v.label(ctx,`0 В`,-L,-half,-6,16,acc);
    // сводка
    v.label(ctx,`C = ${(c.C*1e12).toFixed(2)} пФ`,0,-half,-30,32,ink3);
    v.label(ctx,`Q = ${(c.Q*1e9).toFixed(2)} нКл`,0,-half,-30,46,ink3);
    v.label(ctx,`энергия W = ${(c.W*1e9).toFixed(2)} нДж`,0,-half,-40,60,meas);
  }
}
,

/* ================== ЭЛЕКТРИЧЕСКИЙ ТОК: RC-ЦЕПИ (MNA-решатель) ================= */
circuit:{
  title:'Конструктор соединений: R или C',
  params:[
    {key:'elem',label:'Тип элемента',type:'select',default:'R',
     options:[{v:'R',t:'Резисторы (R)'},{v:'C',t:'Конденсаторы (C)'}]},
    {key:'conn',label:'Тип соединения',type:'select',default:'series',
     options:[{v:'series',  t:'Последовательное'},
              {v:'parallel',t:'Параллельное'}]},
    {key:'n',label:'Число элементов',min:1,max:4,step:1,default:2},
    {key:'U',label:'Напряжение источника U (клеммы A–B)',unit:'В',min:1,max:50,step:1,default:12},

    {type:'group',label:'Номиналы (используются по числу элементов)'},
    {key:'R1',label:'R₁ / C₁',min:0.1,max:20,step:0.1,default:2},
    {key:'R2',label:'R₂ / C₂',min:0.1,max:20,step:0.1,default:3},
    {key:'R3',label:'R₃ / C₃',min:0.1,max:20,step:0.1,default:1},
    {key:'R4',label:'R₄ / C₄',min:0.1,max:20,step:0.1,default:4},

    {type:'group',label:'Показывать'},
    {key:'flow',  label:'Движение тока',type:'check',default:true},
    {key:'values',label:'Номиналы и напряжения',type:'check',default:true}
  ],
  vals(p){ return [p.R1,p.R2,p.R3,p.R4].slice(0,p.n); },
  /* эквивалент и токи. R в кОм, C в мкФ. */
  calc(p){
    const vals=this.vals(p), U=p.U, isR=p.elem==='R';
    let Req,Ceq,I,items=[];
    if(isR){
      if(p.conn==='series'){ Req=vals.reduce((a,b)=>a+b,0); I=U/(Req*1e3);
        items=vals.map((R,i)=>({name:`R${i+1}`,val:R,unit:'кОм',I:I,U:I*R*1e3})); }
      else { const g=vals.reduce((a,R)=>a+1/R,0); Req=1/g; I=U/(Req*1e3);
        items=vals.map((R,i)=>({name:`R${i+1}`,val:R,unit:'кОм',I:U/(R*1e3),U:U})); }
      return {isR,Req,I,items,total:Req,totalUnit:'кОм'};
    } else {
      // конденсаторы: последовательное 1/C=Σ1/Ci, параллельное C=ΣCi
      if(p.conn==='series'){ const inv=vals.reduce((a,C)=>a+1/C,0); Ceq=1/inv;
        const Q=Ceq*1e-6*U; items=vals.map((C,i)=>({name:`C${i+1}`,val:C,unit:'мкФ',Q:Q*1e6,U:Q/(C*1e-6)})); }
      else { Ceq=vals.reduce((a,b)=>a+b,0); items=vals.map((C,i)=>({name:`C${i+1}`,val:C,unit:'мкФ',Q:C*1e-6*U*1e6,U:U})); }
      const Wtot=0.5*Ceq*1e-6*U*U;
      return {isR:false,Ceq,items,Wtot,total:Ceq,totalUnit:'мкФ'};
    }
  },
  init(p){ return {t:0,flow:0,event:null,__stop:null}; },
  step(s,dt,p){ const c=this.calc(p); s.flow += (c.isR?c.I*30:0.6)*dt; s.t+=dt; },
  anchors(s,p){ return [{x:-6,y:0},{x:6,y:0}]; },     // клеммы A и B
  readouts(s,p){
    const c=this.calc(p);
    const out=[['t',s.t,'с'],['напряжение A–B',p.U,'В'],['тип',0,p.elem==='R'?'резисторы':'конденсаторы'],
               ['соединение',0,p.conn==='series'?'последовательное':'параллельное']];
    if(c.isR){
      out.push(['эквивалент R',c.Req,'кОм'],['общий ток I',c.I*1000,'мА']);
      c.items.forEach(it=>out.push([`${it.name}: ток / напряж.`,it.I*1000, `мА → ${it.U.toFixed(1)} В`]));
    } else {
      out.push(['эквивалент C',c.Ceq,'мкФ'],['энергия W=½CU²',c.Wtot*1e6,'мкДж']);
      c.items.forEach(it=>out.push([`${it.name}: заряд / напряж.`,it.Q, `нКл → ${it.U.toFixed(1)} В`]));
    }
    return out;
  },
  graphs:[
    {label:'Эквивалент (R в кОм или C в мкФ)',unit:'',series:['экв'],get(s,p){ return [SIMS.circuit.calc(p).total,null]; }}
  ],
  presets:[
    {name:'Резисторы последовательно',values:{elem:'R',conn:'series',n:2,U:12,R1:2,R2:3}},
    {name:'Резисторы параллельно',values:{elem:'R',conn:'parallel',n:2,U:12,R1:2,R2:3}},
    {name:'Конденсаторы последовательно',values:{elem:'C',conn:'series',n:2,U:12,R1:2,R2:3}},
    {name:'Конденсаторы параллельно',values:{elem:'C',conn:'parallel',n:2,U:12,R1:2,R2:3}},
    {name:'Три резистора параллельно',values:{elem:'R',conn:'parallel',n:3,U:12,R1:2,R2:3,R3:1}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(15*PX_PER_M),(H-70)/(10*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  /* --- рисование элементов на проводе (провод разрывается под элементом) --- */
  drawResistor(ctx,v,cx,cy,horiz,col){
    const L=1.6, w=0.5;
    ctx.fillStyle=v.c('--canvas'); ctx.strokeStyle=col; ctx.lineWidth=v.lw(2);
    if(horiz){ ctx.beginPath(); ctx.rect(cx-L/2,cy-w/2,L,w); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.rect(cx-w/2,cy-L/2,w,L); ctx.fill(); ctx.stroke(); }
  },
  drawCap(ctx,v,cx,cy,horiz,col){
    // пластины ПЕРПЕНДИКУЛЯРНЫ проводу: горизонтальный провод → вертикальные пластины
    ctx.strokeStyle=col; ctx.lineWidth=v.lw(3); const g=0.18, pl=0.5;
    if(horiz){
      ctx.beginPath(); ctx.moveTo(cx-g,cy-pl); ctx.lineTo(cx-g,cy+pl);
      ctx.moveTo(cx+g,cy-pl); ctx.lineTo(cx+g,cy+pl); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(cx-pl,cy-g); ctx.lineTo(cx+pl,cy-g);
      ctx.moveTo(cx-pl,cy+g); ctx.lineTo(cx+pl,cy+g); ctx.stroke();
    }
  },
  /* провод с разрывом под элементом (element gap) */
  wireGap(ctx,v,ax,ay,bx,by,gapCenters,gapHalf){
    // рисуем провод от a до b, вырезая отрезки вокруг каждого центра из gapCenters (вдоль прямой)
    ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
    const dx=bx-ax, dy=by-ay, len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len;
    // параметры t центров вдоль линии
    const gaps=gapCenters.map(c=>{ const t=((c.x-ax)*ux+(c.y-ay)*uy); return t; }).sort((p,q)=>p-q);
    let t0=0;
    for(const gc of gaps){
      const gStart=gc-gapHalf, gEnd=gc+gapHalf;
      if(gStart>t0){ ctx.beginPath(); ctx.moveTo(ax+ux*t0,ay+uy*t0); ctx.lineTo(ax+ux*gStart,ay+uy*gStart); ctx.stroke(); }
      t0=gEnd;
    }
    if(t0<len){ ctx.beginPath(); ctx.moveTo(ax+ux*t0,ay+uy*t0); ctx.lineTo(bx,by); ctx.stroke(); }
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const c=this.calc(p), n=p.n, isR=p.elem==='R', col=isR?acc:sec;
    const Ax=-6, Bx=6, midT=1;                       // клеммы
    // клеммы A и B (кружки-разъёмы)
    const term=(x,lab)=>{ ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.arc(x,0,0.28,0,7); ctx.stroke();
      v.label(ctx,lab,x,0,x<0?-18:10,-16,ink); };
    term(Ax,'A'); term(Bx,'B');

    const drawElem=(cx,cy,horiz,idx)=>{
      if(isR) this.drawResistor(ctx,v,cx,cy,horiz,col);
      else    this.drawCap(ctx,v,cx,cy,horiz,col);
      if(p.values){
        const it=c.items[idx];
        v.label(ctx,`${it.name} = ${it.val} ${isR?'кОм':'мкФ'}`,cx,cy,horiz?-20:14,horiz?-18:0,col);
        v.label(ctx,`${it.U.toFixed(1)} В`,cx,cy,horiz?-12:14,horiz?18:14,ink3);
      }
    };

    if(p.conn==='series'){
      // все элементы в ряд между A и B на одной линии
      const x0=Ax+0.28, x1=Bx-0.28, span=x1-x0;
      const centers=[]; for(let i=0;i<n;i++) centers.push({x:x0+span*(i+0.5)/n, y:0});
      this.wireGap(ctx,v,x0,0,x1,0,centers,0.85);
      centers.forEach((ct,i)=>drawElem(ct.x,ct.y,true,i));
    } else {
      // параллельно: n горизонтальных ветвей между двумя вертикальными шинами
      const busL=Ax+2, busR=Bx-2, ys=[];
      for(let i=0;i<n;i++){ const y=(n===1)?0:(-2.4+4.8*i/(n-1)); ys.push(y); }
      // провода от клемм к шинам
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(Ax+0.28,0); ctx.lineTo(busL,0); ctx.moveTo(busR,0); ctx.lineTo(Bx-0.28,0); ctx.stroke();
      // вертикальные шины
      const ymin=Math.min(...ys), ymax=Math.max(...ys);
      ctx.beginPath(); ctx.moveTo(busL,ymin); ctx.lineTo(busL,ymax); ctx.moveTo(busR,ymin); ctx.lineTo(busR,ymax); ctx.stroke();
      // узлы соединения
      ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(busL,0,v.lw(3),0,7); ctx.fill(); ctx.beginPath(); ctx.arc(busR,0,v.lw(3),0,7); ctx.fill();
      // ветви с элементами
      ys.forEach((y,i)=>{
        const cx=(busL+busR)/2;
        this.wireGap(ctx,v,busL,y,busR,y,[{x:cx,y}],0.85);
        drawElem(cx,y,true,i);
      });
    }

    // движение тока (только для резисторов; конденсаторы в статике заряжены)
    if(p.flow && isR && c.I>1e-9){
      // простая анимация: точки бегут по внешнему проводу A→B
      const path=[[Ax+0.28,0],[Bx-0.28,0]];
      const nd=10; ctx.fillStyle=dang;
      for(let k=0;k<nd;k++){ const t=((s.flow+k/nd)%1+1)%1;
        const px=path[0][0]+(path[1][0]-path[0][0])*t;
        ctx.beginPath(); ctx.arc(px,0.001,v.lw(2.5),0,7); ctx.fill(); }
    }

    // сводка
    if(isR) v.label(ctx,`R_экв = ${c.Req.toFixed(2)} кОм,  I = ${(c.I*1000).toFixed(2)} мА`,0,3.4,-56,0,ink3);
    else    v.label(ctx,`C_экв = ${c.Ceq.toFixed(2)} мкФ,  W = ${(c.Wtot*1e6).toFixed(2)} мкДж`,0,3.4,-56,0,ink3);
    v.label(ctx,'меняйте тип, число и номиналы элементов',0,3.4,-64,16,ink3);
  }
},

resistors:{
  title:'Конструктор цепей (закон Ома)',
  A:{x:-6,y:0},
  params:[
    {key:'tool',label:'Инструмент (или ПКМ по сцене)',type:'select',default:'wire',
     options:[{v:'wire',t:'Провод (тянуть от узла)'},
              {v:'R',   t:'Резистор (тянуть от узла)'}]},
    {key:'U',   label:'Напряжение источника U (A→B)',unit:'В',min:1,max:50,step:1,default:12},
    {key:'Rnew',label:'Номинал нового резистора',unit:'Ом',min:1,max:1000,step:1,default:100},
    {type:'group',label:'Показывать'},
    {key:'flow',  label:'Движение тока',type:'check',default:true},
    {key:'values',label:'Номиналы',type:'check',default:true},
    {key:'clear', label:'Очистить схему',type:'check',default:false}
  ],
  /* --- сеть: сегменты между узлами целочисленной сетки --- */
  netOf(p){
    if(!p._net) p._net={segs:[],B:null};
    if(p.clear){ p._net={segs:[],B:null}; p.clear=false; }
    return p._net;
  },
  key(x,y){ return x+','+y; },
  solveLinear(A,b){
    const n=b.length, M=A.map((r,i)=>[...r,b[i]]);
    for(let col=0;col<n;col++){
      let piv=col; for(let r=col+1;r<n;r++) if(Math.abs(M[r][col])>Math.abs(M[piv][col])) piv=r;
      if(Math.abs(M[piv][col])<1e-12) continue;
      [M[col],M[piv]]=[M[piv],M[col]];
      for(let r=0;r<n;r++){ if(r===col) continue; const f=M[r][col]/M[col][col];
        for(let c=col;c<=n;c++) M[r][c]-=f*M[col][c]; }
    }
    return M.map((row,i)=>Math.abs(M[i][i])<1e-12?0:row[n]/M[i][i]);
  },
  /* Расчёт: провода объединяют узлы (union-find), резисторы — рёбра между
     супер-узлами, MNA даёт ток источника U между A и B. Работает для ЛЮБОЙ
     топологии — это и есть «раскрытие скобок», выполненное честной алгеброй. */
  calc(p){
    const net=this.netOf(p), U=p.U;
    const par={};
    const add=k=>{ if(!(k in par)) par[k]=k; return k; };
    const find=k=>{ k=add(k); while(par[k]!==k){ par[k]=par[par[k]]; k=par[k]; } return k; };
    const uni=(x,y)=>{ x=find(x); y=find(y); if(x!==y) par[x]=y; };
    const kA=this.key(this.A.x,this.A.y); add(kA);
    for(const g of net.segs){
      const k1=this.key(g.x1,g.y1), k2=this.key(g.x2,g.y2); add(k1); add(k2);
      if(g.type==='wire') uni(k1,k2);
    }
    if(!net.B) return {status:'noB'};
    const kB=this.key(net.B.x,net.B.y); add(kB);
    const nA=find(kA), nB=find(kB);
    if(nA===nB) return {status:'short',Req:0};
    const rs=[];
    for(const g of net.segs) if(g.type==='R'){
      const x=find(this.key(g.x1,g.y1)), y=find(this.key(g.x2,g.y2));
      if(x!==y) rs.push({a:x,b:y,R:g.value});
    }
    // связность A—B по резисторному графу
    const adj={}; rs.forEach(r=>{ (adj[r.a]=adj[r.a]||[]).push(r.b); (adj[r.b]=adj[r.b]||[]).push(r.a); });
    const seen=new Set([nA]), q=[nA];
    while(q.length){ const x=q.pop(); for(const y of adj[x]||[]) if(!seen.has(y)){ seen.add(y); q.push(y); } }
    if(!seen.has(nB)) return {status:'open'};
    // MNA: земля = nB, источник U между nA и землёй
    const ids=new Map();
    const idOf=k=>{ if(k===nB) return -1; if(!ids.has(k)) ids.set(k,ids.size); return ids.get(k); };
    idOf(nA); rs.forEach(r=>{ idOf(r.a); idOf(r.b); });
    const n=ids.size, sz=n+1;
    const G=Array.from({length:sz},()=>new Array(sz).fill(0)), Iv=new Array(sz).fill(0);
    for(const r of rs){ const g=1/r.R, ia=idOf(r.a), ib=idOf(r.b);
      if(ia>=0)G[ia][ia]+=g; if(ib>=0)G[ib][ib]+=g;
      if(ia>=0&&ib>=0){ G[ia][ib]-=g; G[ib][ia]-=g; } }
    const iA=idOf(nA), row=n;
    G[iA][row]+=1; G[row][iA]+=1; Iv[row]=U;
    const x=this.solveLinear(G,Iv);
    const I=-x[row], Req=Math.abs(I)>1e-12?U/I:Infinity;
    return {status:'ok',I,Req};
  },
  /* --- интерактив: рисование проводов зажатием ЛКМ от узла --- */
  nodesList(p){
    const net=this.netOf(p), pts=[{x:this.A.x,y:this.A.y}];
    for(const g of net.segs){ pts.push({x:g.x1,y:g.y1},{x:g.x2,y:g.y2}); }
    return pts;
  },
  wireStart(p,x,y){
    // старт только от существующего узла (A или конец сегмента)
    let best=null,bd=0.55;
    for(const q of this.nodesList(p)){ const d=Math.hypot(q.x-x,q.y-y); if(d<bd){ bd=d; best=q; } }
    if(best) return {sx:best.x, sy:best.y};
    return null;
  },
  wireMove(p,h,x,y){
    const dx=x-h.sx, dy=y-h.sy;
    let ex,ey;
    if(Math.abs(dx)>=Math.abs(dy)){ ex=Math.round(h.sx+dx); ey=h.sy; }   // горизонталь
    else { ex=h.sx; ey=Math.round(h.sy+dy); }                            // вертикаль
    p._preview={x1:h.sx,y1:h.sy,x2:ex,y2:ey};
  },
  wireEnd(p,h){
    const pv=p._preview; p._preview=null;
    if(!pv) return;
    const len=Math.abs(pv.x2-pv.x1)+Math.abs(pv.y2-pv.y1);
    if(len<1) return;
    const type=p.tool==='R'?'R':'wire';
    this.netOf(p).segs.push({x1:pv.x1,y1:pv.y1,x2:pv.x2,y2:pv.y2,type,value:p.Rnew});
  },
  /* развилки образуются автоматически: сегменты, сходящиеся в одном узле сетки,
     объединяются союзом узлов при расчёте — отдельный инструмент не нужен. */
  undoAction(p){
    const net=this.netOf(p);
    if(net.B){ net.B=null; return true; }
    if(net.segs.length){ net.segs.pop(); return true; }
    return false;
  },
  makeOutput(p){
    const net=this.netOf(p);
    if(!net.segs.length) return;
    const l=net.segs[net.segs.length-1];
    net.B={x:l.x2,y:l.y2};
  },
  ctxTools(p){
    const m=t=>(p.tool===t?'● ':'○ ');
    return [
      {label:m('wire')+'Инструмент: провод',       on:q=>{ q.tool='wire'; }},
      {label:m('R')+`Инструмент: резистор (${p.Rnew} Ом)`, on:q=>{ q.tool='R'; }},
      {label:'Создать вывод B (конец цепи)',       on:q=>{ SIMS.resistors.makeOutput(q); }},
      {label:'Отменить последнее (Ctrl+Z)',        on:q=>{ SIMS.resistors.undoAction(q); }}
    ];
  },
  init(p){ this.netOf(p); return {t:0,flow:0,event:null,__stop:null}; },
  step(s,dt,p){
    const c=this.calc(p);
    const I=(c.status==='ok')?c.I:(c.status==='short'?0.05:0);
    s.flow+=Math.min(Math.abs(I),0.05)*dt*60; s.t+=dt;
  },
  anchors(s,p){
    const net=this.netOf(p), out=[{x:this.A.x,y:this.A.y}];
    if(net.B) out.push({x:net.B.x,y:net.B.y});
    return out;
  },
  readouts(s,p){
    const net=this.netOf(p), c=this.calc(p);
    // развилки: узлы со степенью >= 3
    const deg={}; const bump=k=>deg[k]=(deg[k]||0)+1;
    for(const g of net.segs){ bump(this.key(g.x1,g.y1)); bump(this.key(g.x2,g.y2)); }
    const forks=Object.values(deg).filter(d=>d>=3).length;
    const nR=net.segs.filter(g=>g.type==='R').length;
    const out=[['t',s.t,'с'],['напряжение U (A→B)',p.U,'В'],
      ['сегментов',net.segs.length,''],['резисторов',nR,''],['развилок',forks,'']];
    if(c.status==='noB') out.push(['состояние',0,'нет вывода B — кнопка «вывод B»']);
    else if(c.status==='open') out.push(['состояние',0,'цепь разомкнута (A и B не связаны)']);
    else if(c.status==='short') out.push(['состояние',0,'КОРОТКОЕ ЗАМЫКАНИЕ (R=0)']);
    else out.push(['эквивалентное R',c.Req,'Ом'],['ток I = U/R',c.I*1000,'мА'],['мощность P = UI',p.U*c.I,'Вт']);
    return out;
  },
  graphs:[
    {label:'Ток I',unit:'мА',series:['I'],get(s,p){ const c=SIMS.resistors.calc(p); return [c.status==='ok'?c.I*1000:0,null]; }},
    {label:'Эквивалентное R',unit:'Ом',series:['R'],get(s,p){ const c=SIMS.resistors.calc(p); return [c.status==='ok'?c.Req:0,null]; }}
  ],
  presets:[],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(18*PX_PER_M),(H-70)/(11*PX_PER_M)),0.002,30);
    return {x:1,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const net=this.netOf(p), c=this.calc(p);
    // перекрестия сетки в рабочей области (узлы, куда можно вести провод)
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.globalAlpha=.35;
    for(let gx=-7;gx<=9;gx++) for(let gy=-4;gy<=4;gy++){
      ctx.beginPath(); ctx.moveTo(gx-0.12,gy); ctx.lineTo(gx+0.12,gy);
      ctx.moveTo(gx,gy-0.12); ctx.lineTo(gx,gy+0.12); ctx.stroke();
    }
    ctx.globalAlpha=1;
    // сегменты
    let rIdx=0;
    for(const g of net.segs){
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.2);
      ctx.beginPath(); ctx.moveTo(g.x1,g.y1); ctx.lineTo(g.x2,g.y2); ctx.stroke();
      if(g.type==='R'){
        rIdx++;
        const cx=(g.x1+g.x2)/2, cy=(g.y1+g.y2)/2, horiz=g.y1===g.y2;
        ctx.fillStyle=v.c('--canvas'); ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
        if(horiz){ ctx.beginPath(); ctx.rect(cx-0.6,cy-0.24,1.2,0.48); ctx.fill(); ctx.stroke(); }
        else { ctx.beginPath(); ctx.rect(cx-0.24,cy-0.6,0.48,1.2); ctx.fill(); ctx.stroke(); }
        if(p.values){ v.label(ctx,`R${rIdx}`,cx,cy,horiz?-8:12,horiz?-14:-4,acc);
          v.label(ctx,`${g.value} Ом`,cx,cy,horiz?-14:12,horiz?16:10,ink3); }
      }
    }
    // предпросмотр рисуемого сегмента
    if(p._preview){
      const pv=p._preview;
      ctx.strokeStyle=p.tool==='R'?acc:sec; ctx.lineWidth=v.lw(2); ctx.setLineDash([v.lw(5),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(pv.x1,pv.y1); ctx.lineTo(pv.x2,pv.y2); ctx.stroke(); ctx.setLineDash([]);
    }
    // узлы-развилки (степень >= 3)
    const deg={}; const bump=k=>deg[k]=(deg[k]||0)+1;
    for(const g of net.segs){ bump(this.key(g.x1,g.y1)); bump(this.key(g.x2,g.y2)); }
    ctx.fillStyle=ink;
    for(const k in deg){ if(deg[k]>=3){ const [x,y]=k.split(',').map(Number);
      ctx.beginPath(); ctx.arc(x,y,v.lw(4),0,7); ctx.fill(); } }
    // клемма A
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.arc(this.A.x,this.A.y,0.3,0,7); ctx.stroke();
    v.label(ctx,'A (ввод)',this.A.x,this.A.y,-24,-16,dang);
    // клемма B
    if(net.B){
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2.4);
      ctx.beginPath(); ctx.arc(net.B.x,net.B.y,0.3,0,7); ctx.stroke();
      v.label(ctx,'B (вывод)',net.B.x,net.B.y,10,-16,sec);
    }
    // движение тока
    if(p.flow && c.status==='ok' && Math.abs(c.I)>1e-9){
      ctx.fillStyle=dang;
      for(const g of net.segs){
        const L=Math.abs(g.x2-g.x1)+Math.abs(g.y2-g.y1), nd=Math.max(2,Math.round(L*2));
        for(let k=0;k<nd;k++){ const t=((s.flow+k/nd)%1+1)%1;
          ctx.beginPath(); ctx.arc(g.x1+(g.x2-g.x1)*t, g.y1+(g.y2-g.y1)*t, v.lw(2.2),0,7); ctx.fill(); }
      }
    }
    // статус
    let st;
    if(c.status==='noB') st='нарисуйте цепь от A и нажмите «вывод B»';
    else if(c.status==='open') st='цепь разомкнута: A и B не соединены';
    else if(c.status==='short') st='КОРОТКОЕ ЗАМЫКАНИЕ: A и B связаны проводом без резисторов';
    else st=`R_экв = ${c.Req.toFixed(1)} Ом,   I = ${(c.I*1000).toFixed(2)} мА`;
    v.label(ctx,st,1,-4.6,-90,0,c.status==='short'?dang:ink3);
    v.label(ctx,'зажмите ЛКМ на узле и ведите провод по сетке · ПКМ — инструменты · Ctrl+Z — отмена',1,4.6,-150,0,ink3);
  }
},
});
