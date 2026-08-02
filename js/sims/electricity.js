'use strict';
Object.assign(SIMS,{
/* ================== ЭЛЕКТРОСТАТИКА: ЗАКОН КУЛОНА И ПОЛЕ ================= */
efield:{
  title:'Электрическая сила и поле',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
  },
  anchors(s,p){ return this.charges(p).map(c=>({x:c.x,y:c.y})).concat([{x:p.tx,y:p.ty}]); },
  readouts(s,p){
    const F=this.coulomb(p), E=this.fieldAt(p,p.tx,p.ty);
    const Fon=E.mag*Math.abs(p.qt)*1e-9;
    const cs=this.charges(p), r=cs.length>=2?Math.hypot(cs[1].x-cs[0].x,cs[1].y-cs[0].y):0;
    return [['сила Кулона F (q₁–q₂)',F*1e9,'нН'],
            ['расстояние r',r,'м'],
            ['поле E в точке пробы',E.mag,'Н/Кл'],
            ['Eₓ',E.Ex,'Н/Кл'],['Eᵧ',E.Ey,'Н/Кл'],
            ['сила на пробный заряд',Fon*1e9,'нН'],
            ['направление поля',Math.atan2(E.Ey,E.Ex)*180/Math.PI,'°']];
  },
  graphs:[],
  presets:[
    {name:'Притяжение: +8 и −8 нКл',values:{scene:'two',q1:8,q2:-8,d:3,qt:1,tx:0,ty:2.5}},
    {name:'Отталкивание: два +8 нКл',values:{scene:'same',q1:8,q2:8,d:3,qt:1,tx:0,ty:2.5}},
    {name:'Диполь: силовые линии',values:{scene:'dipole',q1:10,q2:-10,d:3,qt:1,tx:0,ty:2,fieldLines:true}},
    {name:'Три заряда: суперпозиция',values:{scene:'triangle',q1:8,q2:8,q3:-6,d:4,qt:1,tx:0,ty:0}},
    {name:'Сетка векторов поля',values:{scene:'two',q1:10,q2:-10,d:4,fieldGrid:true,fieldLines:false}}
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
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
    return [['заряд внутри Qвнутр',Qin*1e9,'нКл'],
            ['поток Φ (численно)',Phi,'усл.ед.'],
            ['2πk·Qвнутр (теорема Гаусса)',PhiTheory,'усл.ед.'],
            ['Φ = 2πk·Qвнутр',match?1:0,match?'выполняется':'—'],
            ['радиус поверхности R',p.gr,'м'],
            ['всего зарядов',this.charges(p).length,'']];
  },
  graphs:[],
  presets:[
    {name:'Заряд внутри — поток есть',values:{scene:'single',Q1:10,gx:0,gy:0,gr:2.5}},
    {name:'Поверхность не охватывает заряд — поток 0',values:{scene:'single',Q1:10,gx:5,gy:0,gr:2}},
    {name:'Большой радиус — тот же поток',values:{scene:'single',Q1:10,gx:0,gy:0,gr:5}},
    {name:'Диполь: оба внутри — поток 0',values:{scene:'plusminus',Q1:10,sep:3,gx:0,gy:0,gr:4}},
    {name:'Диполь: только + внутри',values:{scene:'plusminus',Q1:10,sep:3,gx:-1.5,gy:0,gr:1.2}}
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
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
  },
  dragPoints(p){ return [{x:p.px,y:p.py}]; },
  dragMove(p,idx,x,y){ p.px=Math.round(x*10)/10; p.py=Math.round(y*10)/10; },
  anchors(s,p){ return [{x:0,y:0},{x:p.px,y:p.py}]; },
  readouts(s,p){
    const d=this.distOf(p,p.px,p.py), E=this.fieldMag(p,d);
    const law={sphere:(d<=p.R?'внутри: E ∝ r':'снаружи: E = kQ/r²'),
               line:'нить: E = 2kλ/r',plane:'плоскость: E = 2πkσ (однородно)'}[p.shape];
    const out=[['расстояние до тела',d,'м'],
               ['поле E',E,'В/м'],['закон',0,law]];
    if(p.shape==='sphere'){
      out.push(['E на поверхности',this.fieldMag(p,p.R),'В/м'],
               ['E точечного kQ/r²',this.k*p.Q*1e-9/Math.max(d*d,0.01),'В/м']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Шар: поле внутри и снаружи',values:{shape:'sphere',Q:15,R:2,px:4,py:0}},
    {name:'Шар: проба внутри (E ∝ r)',values:{shape:'sphere',Q:15,R:3,px:1,py:0}},
    {name:'Линейный заряд (нить): E ∝ 1/r',values:{shape:'line',Q:15,R:2,px:0,py:3}},
    {name:'Плоскость: однородное поле',values:{shape:'plane',Q:15,R:3,px:0,py:3}}
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
  /* Сцена — не пространство: пластины растянуты, чтобы зазор в доли
     миллиметра был виден. Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'volt',   label:'Напряжение U',unit:'В',min:1,max:200,step:1,default:50},
    {key:'plateL', label:'Площадь пластин S',unit:'усл.ед.',min:1,max:12,step:0.5,default:6},
    {key:'gap',    label:'Зазор между пластинами d',unit:'мм',min:0.5,max:10,step:0.1,default:3},
    {key:'eps',    label:'Диэлектрическая проницаемость ε',min:1,max:10,step:0.1,default:1},

    {type:'group',label:'Показывать'},
    {key:'dielectric',label:'Диэлектрик между пластинами',type:'check',default:false},
    {key:'fieldLines',label:'Однородное поле',type:'check',default:true},
    {key:'charges',    label:'Заряды на пластинах',type:'check',default:true},

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
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const c=this.calc(p);
    return [['напряжение U',p.volt,'В'],
            ['ёмкость C = εε₀S/d',c.C*1e12,'пФ'],
            ['заряд Q = CU',c.Q*1e9,'нКл'],
            ['поле E = U/d',c.E,'В/м'],
            ['энергия W = ½CU²',c.W*1e9,'нДж'],
            ['плотность энергии u',c.u,'Дж/м³'],
            ['диэлектрик ε',c.eps,''],
            ['во сколько ↑ ёмкость',c.eps,'раз']];
  },
  graphs:[],
  presets:[
    {name:'Вакуумный конденсатор',values:{volt:50,plateL:6,gap:3,eps:1,dielectric:false}},
    {name:'С диэлектриком ε=5 (ёмкость ×5)',values:{volt:50,plateL:6,gap:3,eps:5,dielectric:true}},
    {name:'Меньше зазор — больше ёмкость',values:{volt:50,plateL:6,gap:1,eps:1,dielectric:false}},
    {name:'Больше площадь — больше ёмкость',values:{volt:50,plateL:12,gap:3,eps:1,dielectric:false}}
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

/* ========== КОНСТРУКТОР ЦЕПЕЙ: ЗАКОН ОМА И ЗАКОНЫ КИРХГОФА ==========
   Схему рисует сам ученик: провода и резисторы тянутся мышью по сетке.
   Считается она не «правилами для последовательного и параллельного», а
   узловым методом — то есть ровно законами Кирхгофа:

     • ПЕРВЫЙ закон (узловой): сумма токов, сходящихся в узле, равна нулю.
       Каждая строка матрицы проводимостей — это и есть такое уравнение
       для одного узла.
     • ВТОРОЙ закон (контурный): выполняется тождественно, потому что ток
       через элемент считается по РАЗНОСТИ ПОТЕНЦИАЛОВ его концов, а
       потенциал — однозначная функция узла. Обойдя контур, разности
       потенциалов телескопически сокращаются: сумма падений по контуру
       равна нулю сама собой.

   Поэтому работает ЛЮБАЯ топология — в том числе мост Уитстона, который
   через «последовательно/параллельно» не раскладывается в принципе.

   Провода — не абстрактные «слияния узлов», а элементы с крошечным
   сопротивлением Rw. Это даёт два важных следствия: у каждого отрезка
   схемы появляется определённый ток (значит, движение тока рисуется в
   правильную сторону и правильной густотой), а первый закон Кирхгофа
   можно проверить численно в каждом узле. */
resistors:{
  title:'Конструктор цепей: закон Ома и законы Кирхгофа',
  /* Сцена — схема: клетка это место для элемента, а не метр. Поэтому ни осей
     с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  A:{x:-6,y:0},                      // клемма «+» источника, φ = U
  Rw:1e-4,                           // сопротивление куска идеального провода, Ом
  SUB:'₀₁₂₃₄₅₆₇₈₉',
  params:[
    {key:'demo',label:'Готовая схема',type:'select',default:'series',
     options:[{v:'series',  t:'Последовательное: R₁ + R₂'},
              {v:'parallel',t:'Параллельное: R₁ ∥ R₂'},
              {v:'mixed',   t:'Смешанное: R₁ + (R₂ ∥ R₃)'},
              {v:'bridge',  t:'Мост Уитстона (5 резисторов)'},
              {v:'cpar',    t:'Конденсатор параллельно резистору'},
              {v:'cdiv',    t:'Два конденсатора последовательно'},
              {v:'cadd',    t:'Два конденсатора параллельно'},
              {v:'blank',   t:'Пустая сетка — рисовать самому'}]},
    {key:'tool',label:'Инструмент (или ПКМ по сцене)',type:'select',default:'wire',
     options:[{v:'wire',t:'Провод (тянуть от узла)'},
              {v:'R',   t:'Резистор (тянуть от узла)'},
              {v:'C',   t:'Конденсатор (тянуть от узла)'}]},
    {key:'U',   label:'Напряжение источника U (A→B)',unit:'В',min:1,max:50,step:1,default:12},

    {type:'group',label:'Номиналы резисторов (в порядке появления в схеме)'},
    {key:'R1',label:'R₁',unit:'Ом',min:1,max:2000,step:1,default:100},
    {key:'R2',label:'R₂',unit:'Ом',min:1,max:2000,step:1,default:200},
    {key:'R3',label:'R₃',unit:'Ом',min:1,max:2000,step:1,default:150},
    {key:'R4',label:'R₄',unit:'Ом',min:1,max:2000,step:1,default:300},
    {key:'R5',label:'R₅',unit:'Ом',min:1,max:2000,step:1,default:470},
    {key:'Rnew',label:'Номинал шестого и следующих',unit:'Ом',min:1,max:2000,step:1,default:100},

    {type:'group',label:'Номиналы конденсаторов (в порядке появления)'},
    {key:'C1',label:'C₁',unit:'мкФ',min:0.1,max:1000,step:0.1,default:47},
    {key:'C2',label:'C₂',unit:'мкФ',min:0.1,max:1000,step:0.1,default:100},
    {key:'C3',label:'C₃',unit:'мкФ',min:0.1,max:1000,step:0.1,default:22},
    {key:'Cnew',label:'Номинал четвёртого и следующих',unit:'мкФ',min:0.1,max:1000,step:0.1,default:47},

    {type:'group',label:'Показывать'},
    {key:'flow',  label:'Движение тока',type:'check',default:true},
    {key:'values',label:'Номиналы, токи и падения',type:'check',default:true},
    {key:'phi',   label:'Потенциалы узлов φ',type:'check',default:true},
    {key:'src',   label:'Источник и замыкающий контур',type:'check',default:true},
    {key:'clear', label:'Очистить схему',type:'check',default:false}
  ],

  /* --- схема: отрезки между узлами целочисленной сетки --- */
  key(x,y){ return (x+0)+','+(y+0); },        // +0 убирает «-0» в ключе
  sub(n){ return String(n).split('').map(d=>this.SUB[+d]).join(''); },
  /* Номинал k-го резистора: первые пять берутся из ползунков — их можно
     крутить и смотреть, как перераспределяются токи; дальше — из значения,
     с которым резистор был нарисован. */
  Rval(p,idx,seg){
    const v=p['R'+idx];
    if(idx<=5 && typeof v==='number' && isFinite(v) && v>0) return v;
    return (seg&&seg.value)||p.Rnew||100;
  },
  /* Ёмкость k-го конденсатора, мкФ: первые три — с ползунков, дальше — то, с
     чем конденсатор был нарисован. Всё как у резисторов. */
  Cval(p,idx,seg){
    const v=p['C'+idx];
    if(idx<=3 && typeof v==='number' && isFinite(v) && v>0) return v;
    return (seg&&seg.cap)||p.Cnew||47;
  },
  /* ---- Конденсаторы в установившемся режиме ----
     phi — уже известные потенциалы (их задала резистивная часть), извест —
     множество узлов с известным потенциалом. Достраиваем потенциалы «висячих»
     узлов из сохранения заряда и заполняем у каждого конденсатора напряжение,
     заряд и энергию. Возвращаем суммарную запасённую энергию.

     Уравнение для висячего узла: сумма зарядов всех сходящихся в нём обкладок
     равна нулю (до включения он был не заряжен), то есть ΣC(φ−φ′) = 0. Это та
     же узловая система, что и для токов, только с ёмкостями вместо
     проводимостей — потому и решается тем же методом Гаусса.

     Отдельная тонкость — СКЛЕЙКА УЗЛОВ. Висячие точки схемы почти никогда не
     стоят вплотную: ученик соединяет два конденсатора проводом, и между ними
     оказывается два разных узла сетки. По этому проводу тока нет (иначе он
     шёл бы через конденсатор), значит падения на нём тоже нет — оба конца
     сидят на одном потенциале. То же верно и для резистора в висячей части:
     раз ток нулевой, U = IR = 0, и резистор в установившемся режиме ничем не
     отличается от провода.

     Поэтому перед решением все точки, связанные резистивными элементами,
     объединяются в один узел. Без этого делитель C₁—провод—C₂ разбирался бы
     как два независимых висячих узла, и каждый уравнение ΣC(φ−φ′)=0 решало бы
     само по себе: оба конденсатора получили бы 0 В вместо 8,16 и 3,84. */
  зарядить(elsC,phi,извест,elsR){
    /* Система непересекающихся множеств: точка → её электрический узел.
       Известные узлы не склеиваем — они уже разобраны резистивным расчётом,
       и там у концов резистора потенциалы РАЗНЫЕ (по ним и течёт ток). */
    const par={};
    const корень=k=>{ if(!(k in par)) par[k]=k; while(par[k]!==k){ par[k]=par[par[k]]; k=par[k]; } return k; };
    for(const e of elsR||[]){
      if(извест.has(e.a) || извест.has(e.b)) continue;
      const x=корень(e.a), y=корень(e.b); if(x!==y) par[x]=y;
    }
    const узел=k=>извест.has(k)?k:корень(k);

    const неизв=new Map();
    for(const e of elsC) for(const k of [e.a,e.b]){
      const u=узел(k);
      if(!извест.has(u) && !неизв.has(u)) неизв.set(u,неизв.size);
    }
    const n=неизв.size;
    if(n){
      const M=Array.from({length:n},()=>new Array(n).fill(0)), b=new Array(n).fill(0);
      for(const e of elsC){
        const ka=узел(e.a), kb=узел(e.b);
        if(ka===kb) continue;                      // обе обкладки на одном узле — замкнут
        const ia=неизв.has(ka)?неизв.get(ka):-1, ib=неизв.has(kb)?неизв.get(kb):-1;
        if(ia>=0) M[ia][ia]+=e.C;
        if(ib>=0) M[ib][ib]+=e.C;
        if(ia>=0&&ib>=0){ M[ia][ib]-=e.C; M[ib][ia]-=e.C; }
        // конец на известном потенциале уходит в правую часть
        if(ia>=0&&ib<0) b[ia]+=e.C*(phi[kb]||0);
        if(ib>=0&&ia<0) b[ib]+=e.C*(phi[ka]||0);
      }
      const x=this.solveLinear(M,b);
      for(const [k,i] of неизв) phi[k]=x[i];
    }
    /* Найденный потенциал принадлежит всему склеенному узлу, а на схеме это
       несколько точек: пробник и подписи спрашивают потенциал у каждой. */
    const раздать=k=>{ if(!(k in phi)){ const u=узел(k); if(u in phi) phi[k]=phi[u]; } };
    for(const e of elsC){ раздать(e.a); раздать(e.b); }
    for(const e of elsR||[]){ раздать(e.a); раздать(e.b); }

    let W=0;
    for(const e of elsC){
      e.dU=(phi[e.a]||0)-(phi[e.b]||0);
      e.I=0; e.P=0;                    // постоянному току конденсатор хода не даёт
      e.Q=e.C*e.dU;                    // мкФ · В = мкКл
      e.W=0.5*e.C*e.dU*e.dU;           // мкДж
      W+=e.W;
    }
    return W;
  },
  demoNet(name){
    const segs=[], B={x:0,y:0};
    const w=(x1,y1,x2,y2)=>segs.push({x1,y1,x2,y2,type:'wire',value:0});
    const r=(x1,y1,x2,y2)=>segs.push({x1,y1,x2,y2,type:'R',value:100});
    const cc=(x1,y1,x2,y2)=>segs.push({x1,y1,x2,y2,type:'C',cap:47});
    /* Схемы нарочно растянуты: подписи «R₁ = 100 Ом» и «41.2 мА · 4.12 В»
       живут под своими резисторами, и если поставить элементы вплотную, эти
       строки налезают друг на друга. */
    if(name==='series'){
      w(-6,0,-5,0); r(-5,0,-3,0); w(-3,0,1,0); r(1,0,3,0); w(3,0,4,0);
      B.x=4; B.y=0;
    } else if(name==='parallel'){
      w(-6,0,-6,3); w(-6,0,-6,-3);
      r(-6,3,0,3); r(-6,-3,0,-3);
      w(0,3,0,0); w(0,-3,0,0); w(0,0,3,0);
      B.x=3; B.y=0;
    } else if(name==='mixed'){
      w(-6,0,-5,0); r(-5,0,-3,0);
      w(-3,0,-3,3); w(-3,0,-3,-3);
      r(-3,3,2,3); r(-3,-3,2,-3);
      w(2,3,2,0); w(2,-3,2,0); w(2,0,4,0);
      B.x=4; B.y=0;
    } else if(name==='bridge'){
      w(-6,0,-6,3); w(-6,0,-6,-3);
      r(-6,3,-1,3);     // R₁ — верхнее левое плечо
      r(-1,3,4,3);      // R₂ — верхнее правое плечо
      r(-6,-3,-1,-3);   // R₃ — нижнее левое плечо
      r(-1,-3,4,-3);    // R₄ — нижнее правое плечо
      r(-1,3,-1,-3);    // R₅ — сам мост (диагональ)
      w(4,3,4,0); w(4,-3,4,0);
      B.x=4; B.y=0;
    } else if(name==='cpar'){
      /* Конденсатор параллельно резистору. Ток идёт по резистору, а
         конденсатор просто заряжается до напряжения на нём — сколько ни жди,
         через него не потечёт ничего. */
      w(-6,0,-5,0); r(-5,0,-1,0); w(-1,0,3,0);
      w(-5,0,-5,3); cc(-5,3,-1,3); w(-1,3,-1,0);
      B.x=3; B.y=0;
    } else if(name==='cdiv'){
      /* Два конденсатора последовательно: делитель напряжения наоборот —
         больше ёмкость, меньше напряжение, а заряд у обоих одинаковый. */
      w(-6,0,-5,0); cc(-5,0,-1,0); cc(-1,0,3,0); w(3,0,4,0);
      B.x=4; B.y=0;
    } else if(name==='cadd'){
      /* Два конденсатора параллельно — обратный случай к предыдущему.
         Напряжение у них общее, зато заряды складываются: обкладки просто
         становятся больше, и общая ёмкость равна C₁ + C₂. */
      w(-6,0,-6,3); w(-6,0,-6,-3);
      cc(-6,3,1,3); cc(-6,-3,1,-3);
      w(1,3,1,0); w(1,-3,1,0); w(1,0,3,0);
      B.x=3; B.y=0;
    } else return {segs:[],B:null,demo:name};
    return {segs,B,demo:name};
  },
  netOf(p){
    if(!p._net) p._net=this.demoNet(p.demo||'series');
    if(p.clear){ p._net={segs:[],B:null,demo:p.demo}; p.clear=false; }
    /* смена «готовой схемы» пересобирает сетку; пока выбор не меняется,
       нарисованное руками остаётся нетронутым */
    if(p._net.demo!==p.demo) p._net=this.demoNet(p.demo);
    return p._net;
  },

  /* Все элементы схемы. Резисторы — как нарисованы. Провода разрезаются
     узлами, которые на них попали: без этого тройник, упёршийся в середину
     готового провода, выглядел бы соединённым, а считался разомкнутым. */
  elements(p){
    const net=this.netOf(p);
    const nodes=[{x:this.A.x,y:this.A.y}];
    if(net.B) nodes.push({x:net.B.x,y:net.B.y});
    for(const g of net.segs) nodes.push({x:g.x1,y:g.y1},{x:g.x2,y:g.y2});
    const els=[]; let rIdx=0, cIdx=0;
    for(const g of net.segs){
      if(g.type==='R'){
        rIdx++;
        /* Нули ставим сразу всем элементам: расчёт выходит раньше, чем дойдёт
           до токов, если цепь разомкнута или замкнута накоротко, а отрисовка
           показания всё равно спрашивает — и получала бы undefined. */
        els.push({type:'R',idx:rIdx,seg:g,R:Math.max(this.Rval(p,rIdx,g),1e-6),I:0,dU:0,P:0,
                  a:this.key(g.x1,g.y1),b:this.key(g.x2,g.y2),
                  x1:g.x1,y1:g.y1,x2:g.x2,y2:g.y2});
        continue;
      }
      if(g.type==='C'){
        cIdx++;
        els.push({type:'C',idx:cIdx,seg:g,C:Math.max(this.Cval(p,cIdx,g),1e-6),R:Infinity,
                  I:0,dU:0,P:0,Q:0,W:0,                    // см. примечание у резистора
                  a:this.key(g.x1,g.y1),b:this.key(g.x2,g.y2),
                  x1:g.x1,y1:g.y1,x2:g.x2,y2:g.y2});
        continue;
      }
      const dx=g.x2-g.x1, dy=g.y2-g.y1, L2=dx*dx+dy*dy;
      const cuts=[{t:0,x:g.x1,y:g.y1},{t:1,x:g.x2,y:g.y2}];
      if(L2>1e-12) for(const q of nodes){
        const t=((q.x-g.x1)*dx+(q.y-g.y1)*dy)/L2;
        if(t<=1e-9||t>=1-1e-9) continue;
        if(Math.hypot(g.x1+dx*t-q.x, g.y1+dy*t-q.y)>1e-9) continue;
        if(cuts.some(c=>Math.abs(c.t-t)<1e-9)) continue;
        cuts.push({t,x:q.x,y:q.y});
      }
      cuts.sort((u,v)=>u.t-v.t);
      for(let i=0;i+1<cuts.length;i++){
        const c1=cuts[i], c2=cuts[i+1];
        els.push({type:'wire',seg:g,R:this.Rw,I:0,dU:0,P:0,
                  a:this.key(c1.x,c1.y),b:this.key(c2.x,c2.y),
                  x1:c1.x,y1:c1.y,x2:c2.x,y2:c2.y});
      }
    }
    return els;
  },

  /* Гаусс с выбором главного элемента. Вырожденные строки (висящий кусок
     схемы, ни к чему не подключённый) дают нулевой потенциал, а не NaN. */
  solveLinear(A,b){
    const n=b.length, M=A.map((r,i)=>[...r,b[i]]);
    for(let col=0;col<n;col++){
      let piv=col; for(let r=col+1;r<n;r++) if(Math.abs(M[r][col])>Math.abs(M[piv][col])) piv=r;
      if(Math.abs(M[piv][col])<1e-14) continue;
      [M[col],M[piv]]=[M[piv],M[col]];
      for(let r=0;r<n;r++){ if(r===col) continue; const f=M[r][col]/M[col][col];
        for(let c=col;c<=n;c++) M[r][c]-=f*M[col][c]; }
    }
    return M.map((row,i)=>Math.abs(M[i][i])<1e-14?0:row[n]/M[i][i]);
  },

  /* Расчёт спрашивают трижды за кадр: шагом времени, отрисовкой и показаниями,
     а пробником — и четвёртый раз. Схема между этими вызовами не меняется, и
     решать одну и ту же систему заново незачем: на плотно заполненной сетке
     (за две сотни элементов) метод Гаусса занимает около 9 мс, и три прогона
     съедали бы четверть кадра.

     Ключом служит полный слепок исходных данных: все параметры из описания и
     все отрезки. Параметры перебираются по самому списку params — так в ключ
     не забудешь добавить новый ползунок, если он когда-нибудь появится. */
  подпись(p){
    const net=this.netOf(p);
    let s=(net.B?net.B.x+':'+net.B.y:'—')+'|';
    for(const q of this.params) if(q.key) s+=p[q.key]+',';
    s+='|';
    for(const g of net.segs) s+=g.x1+' '+g.y1+' '+g.x2+' '+g.y2+g.type+(g.value||0)+'/'+(g.cap||0)+';';
    return s;
  },
  calc(p){
    const ключ=this.подпись(p);
    if(this._ключ===ключ && this._расчёт) return this._расчёт;
    const res=this.решить(p);
    this._ключ=ключ; this._расчёт=res;
    return res;
  },
  решить(p){
    const net=this.netOf(p), els=this.elements(p);
    const kA=this.key(this.A.x,this.A.y);
    const nR=els.filter(e=>e.type==='R').length;
    if(!net.B) return {status:'noB',els,nR};
    const kB=this.key(net.B.x,net.B.y);
    if(kA===kB) return {status:'short',els,nR,Req:0};

    /* Резистивную часть и конденсаторы считаем ОТДЕЛЬНО, и вот почему.

       В установившемся режиме через конденсатор постоянный ток не идёт, значит
       потенциалы задаёт только сеть из проводов и резисторов. А напряжение на
       самих конденсаторах определяется не сопротивлением, а СОХРАНЕНИЕМ
       ЗАРЯДА: на узле, который держится в цепи одними конденсаторами, суммарный
       заряд обкладок так и остался нулевым, каким был до включения. Отсюда для
       таких узлов выходит своё уравнение ΣC(φ−φ′) = 0 — с ёмкостями на месте
       проводимостей.

       Если этого не делать, а изобразить конденсатор просто очень большим
       сопротивлением, два последовательных конденсатора поделят напряжение
       поровну. На деле у них одинаков ЗАРЯД, и напряжения делятся обратно
       ёмкостям: U₁/U₂ = C₂/C₁. Ошибка не тонкая — при 47 и 100 мкФ вместо
       8,16 и 3,84 В вышло бы 6 и 6. */
    const elsR=els.filter(e=>e.type!=='C'), elsC=els.filter(e=>e.type==='C');
    const обход=(набор,старт)=>{
      const adj={};
      for(const e of набор){ (adj[e.a]=adj[e.a]||[]).push(e.b); (adj[e.b]=adj[e.b]||[]).push(e.a); }
      const s=new Set([старт]), q=[старт];
      while(q.length){ const x=q.pop(); for(const y of adj[x]||[]) if(!s.has(y)){ s.add(y); q.push(y); } }
      return s;
    };
    const seen=обход(elsR,kA);                 // куда дотягивается ток от клеммы A
    const всё=обход(els,kA);                   // связность с учётом конденсаторов
    if(!всё.has(kB)) return {status:'open',els,nR};
    if(!seen.has(kB)){
      /* A и B соединены, но только через конденсатор. Тока нет вовсе, а значит
         нет и падений напряжения: весь остров вокруг A сидит на U, весь остров
         вокруг B — на нуле, промежуточные узлы разберёт ёмкостный расчёт. */
      const островB=обход(elsR,kB);
      const phi={};
      for(const k of seen) phi[k]=p.U;
      for(const k of островB) phi[k]=0;
      for(const e of els){ e.I=0; e.dU=0; e.P=0; }
      const Wc=this.зарядить(elsC,phi,new Set([...seen,...островB]),elsR);
      /* Заряд, взятый от источника, — это сумма зарядов тех обкладок, что сидят
         на острове вокруг клеммы A. Отношение Q/U и есть эквивалентная ёмкость
         всей батареи: то же, чем R_экв служит для резисторов. Считать её имеет
         смысл именно здесь: ток не идёт, и вся цепь A→B — чистая ёмкость. */
      let Qa=0;
      for(const e of elsC){
        if(seen.has(e.a)) Qa+=e.Q;
        if(seen.has(e.b)) Qa-=e.Q;
      }
      const Ceq=Math.abs(p.U)>1e-12?Qa/p.U:0;
      return {status:'blocked',els,live:[],nR,nC:elsC.length,phi,seen:всё,Wc,I:0,Req:Infinity,
              Qa,Ceq,loops:this.контуры(els,всё)};
    }
    const live=elsR.filter(e=>seen.has(e.a)&&seen.has(e.b)&&e.a!==e.b);

    /* Узловой метод. Земля — клемма B (φ = 0), источник задаёт φ(A) = U.
       Неизвестные: потенциалы всех прочих узлов + ток через источник. */
    const ids=new Map();
    const idOf=k=>{ if(k===kB) return -1; if(!ids.has(k)) ids.set(k,ids.size); return ids.get(k); };
    idOf(kA); for(const e of live){ idOf(e.a); idOf(e.b); }
    const n=ids.size, sz=n+1;
    const G=Array.from({length:sz},()=>new Array(sz).fill(0)), Iv=new Array(sz).fill(0);
    for(const e of live){
      const g=1/e.R, ia=idOf(e.a), ib=idOf(e.b);
      if(ia>=0) G[ia][ia]+=g;
      if(ib>=0) G[ib][ib]+=g;
      if(ia>=0&&ib>=0){ G[ia][ib]-=g; G[ib][ia]-=g; }
    }
    const iA=idOf(kA), row=n;
    G[iA][row]+=1; G[row][iA]+=1; Iv[row]=p.U;
    const x=this.solveLinear(G,Iv);
    const I=-x[row];                                  // ток, отдаваемый источником в узел A

    const phi={}; phi[kB]=0;
    for(const [k,i] of ids) phi[k]=x[i];
    // ток каждого элемента — по разности потенциалов его концов (закон Ома)
    for(const e of els){
      const ok=seen.has(e.a)&&seen.has(e.b)&&e.a!==e.b;
      e.I = ok ? (phi[e.a]-phi[e.b])/e.R : 0;
    }
    const Req = Math.abs(I)>1e-12 ? p.U/I : Infinity;
    if(!(Req>0.01)) return {status:'short',els,nR,Req,I,phi,seen};

    /* ПРОВЕРКА ПЕРВОГО ЗАКОНА: в каждом узле сумма втекающих токов должна
       обратиться в ноль. Это не украшение — это независимая проверка того,
       что линейная система решена верно, и считается она по «сырым» токам,
       до всякого округления. */
    const bal={};
    for(const e of live){ bal[e.a]=(bal[e.a]||0)-e.I; bal[e.b]=(bal[e.b]||0)+e.I; }
    bal[kA]=(bal[kA]||0)+I; bal[kB]=(bal[kB]||0)-I;
    let kcl=0; for(const k in bal) kcl=Math.max(kcl,Math.abs(bal[k]));

    // баланс мощностей: источник отдаёт ровно то, что рассеивают резисторы
    let Psum=0; for(const e of live) Psum+=e.I*e.I*e.R;

    /* Шумовой порог. Провода в модели имеют крошечное, но НЕ нулевое
       сопротивление Rw, поэтому идеально сбалансированный мост оказывается
       разбалансирован на ~10⁻⁷ В, и «нулевой» ток через мост показывался бы
       как 7·10⁻⁷ мА. Всё, что на шесть порядков меньше тока источника, — это
       шум модели, а не физика: обнуляем его для показаний и анимации. */
    const eps=Math.abs(I)*1e-6;
    for(const e of els){
      if(Math.abs(e.I)<eps) e.I=0;
      e.dU=e.I*e.R;
      e.P =e.I*e.I*e.R;
    }
    // конденсаторы: потенциалы резистивной сети уже известны, достраиваем остальное
    const Wc=this.зарядить(elsC,phi,new Set(Object.keys(phi)),elsR);
    const nC=els.filter(e=>e.type==='C').length;

    return {status:'ok',els,live,nR,nC,I,Req,phi,seen,kcl,Psum,Psrc:p.U*I,
            loops:this.контуры(els,всё),Wc};
  },

  /* Сколько независимых контуров в собранной цепи — столько уравнений даёт
     второй закон Кирхгофа. По формуле Эйлера это рёбра − узлы + 1.

     Рёбер на одно больше, чем нарисовано: сам источник тоже ветвь, он
     соединяет A и B в обход схемы. Забыть его — характерная ошибка: тогда у
     простой последовательной цепи выходит ноль контуров, хотя контур там
     ровно один, и именно по нему пишется U = IR₁ + IR₂.

     Считаем по всей связной части схемы, включая конденсаторные ветви: на
     конденсаторе тоже есть напряжение, и в уравнение контура оно входит. */
  контуры(els,узлы){
    let рёбер=1;                                    // ветвь источника A→B
    for(const e of els) if(e.a!==e.b && узлы.has(e.a)) рёбер++;
    return Math.max(0, рёбер - узлы.size + 1);
  },

  /* --- рисование схемы мышью --- */
  nodesList(p){
    const net=this.netOf(p), pts=[{x:this.A.x,y:this.A.y}];
    if(net.B) pts.push({x:net.B.x,y:net.B.y});
    for(const g of net.segs) pts.push({x:g.x1,y:g.y1},{x:g.x2,y:g.y2});
    return pts;
  },
  wireStart(p,x,y){
    let best=null,bd=0.55;
    for(const q of this.nodesList(p)){ const d=Math.hypot(q.x-x,q.y-y); if(d<bd){ bd=d; best=q; } }
    return best?{sx:best.x,sy:best.y}:null;
  },
  wireMove(p,h,x,y){
    const dx=x-h.sx, dy=y-h.sy;
    let ex,ey;
    if(Math.abs(dx)>=Math.abs(dy)){ ex=Math.round(h.sx+dx); ey=h.sy; }   // горизонталь
    else { ex=h.sx; ey=Math.round(h.sy+dy); }                            // вертикаль
    ex=clamp(ex,-7,7); ey=clamp(ey,-4,4);
    p._preview={x1:h.sx,y1:h.sy,x2:ex,y2:ey};
  },
  wireEnd(p,h){
    const pv=p._preview; p._preview=null;
    if(!pv) return;
    if(Math.abs(pv.x2-pv.x1)+Math.abs(pv.y2-pv.y1)<1) return;
    const тип = p.tool==='R'?'R' : p.tool==='C'?'C' : 'wire';
    this.netOf(p).segs.push({x1:pv.x1,y1:pv.y1,x2:pv.x2,y2:pv.y2,
                             type:тип,value:p.Rnew,cap:p.Cnew});
  },
  /* развилки образуются сами: сегменты, сошедшиеся в одном узле сетки,
     оказываются подключены к одному и тому же потенциалу */
  undoAction(p){
    const net=this.netOf(p);
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
      {label:m('wire')+'Инструмент: провод',                on:q=>{ q.tool='wire'; }},
      {label:m('R')+`Инструмент: резистор (${p.Rnew} Ом)`,  on:q=>{ q.tool='R'; }},
      {label:m('C')+`Инструмент: конденсатор (${p.Cnew} мкФ)`, on:q=>{ q.tool='C'; }},
      {label:'Создать вывод B (конец цепи)',                on:q=>{ SIMS.resistors.makeOutput(q); }},
      {label:'Отменить последний отрезок (Ctrl+Z)',         on:q=>{ SIMS.resistors.undoAction(q); }},
      {label:'Пересобрать выбранную готовую схему',         on:q=>{ if(q._net) q._net.demo=null; }},
      {label:'Очистить схему',                              on:q=>{ q.clear=true; }}
    ];
  },

  init(p){ this.netOf(p); return {t:0,flow:0,event:null,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    const c=this.calc(p);
    // фаза бегущих точек: скорость пропорциональна току, но с потолком
    const I=(c.status==='ok')?Math.abs(c.I):0;
    s.flow+=clamp(I*8,0.15,3)*dt;
    s.I=I;
  },
  anchors(s,p){
    const net=this.netOf(p), out=[{x:this.A.x,y:this.A.y}];
    if(net.B) out.push({x:net.B.x,y:net.B.y});
    return out;
  },
  /* пробник: подносим к узлу — читаем его потенциал, как вольтметром
     относительно клеммы B */
  probe(s,p,x,y){
    const c=this.calc(p);
    if(!c.phi) return [];
    let best=null,bd=0.6;
    for(const q of this.nodesList(p)){ const d=Math.hypot(q.x-x,q.y-y); if(d<bd){ bd=d; best=q; } }
    if(!best) return [];
    const k=this.key(best.x,best.y);
    if(!(k in c.phi)) return [];
    return [['φ узла',c.phi[k],'В']];
  },
  readouts(s,p){
    const net=this.netOf(p), c=this.calc(p);
    const deg={}; const bump=k=>deg[k]=(deg[k]||0)+1;
    for(const g of net.segs){ bump(this.key(g.x1,g.y1)); bump(this.key(g.x2,g.y2)); }
    const forks=Object.values(deg).filter(d=>d>=3).length;
    const конд=c.els?c.els.filter(e=>e.type==='C'):[];
    const out=[['напряжение источника U',p.U,'В'],
      ['резисторов в схеме',c.nR,''],
      ['конденсаторов в схеме',конд.length,''],
      ['отрезков нарисовано',net.segs.length,''],
      ['развилок (узлов со степенью ≥ 3)',forks,'']];

    /* Показания конденсаторов выносим в отдельную часть: они осмысленны и
       тогда, когда ток по цепи вообще не идёт. */
    const конденсаторы=()=>{
      for(const e of конд.slice(0,6)){
        const i=this.sub(e.idx);
        out.push([`C${i} = ${e.C} мкФ · напряжение U${i}`, Math.abs(e.dU),'В'],
                 [`      заряд Q${i} = C${i}·U${i}`, Math.abs(e.Q),'мкКл'],
                 [`      энергия W${i} = ½C${i}U${i}²`, e.W,'мкДж']);
      }
      if(конд.length>1) out.push(['запасено всего',c.Wc||0,'мкДж']);
      if(конд.length) out.push(['ток через конденсаторы',0,'мА — постоянный ток не проходит']);
    };

    if(c.status==='noB'){ out.push(['состояние',NaN,'нет вывода B — кнопка «вывод B»']); return out; }
    if(c.status==='open'){ out.push(['состояние',NaN,'цепь разомкнута: A и B не соединены']); return out; }
    if(c.status==='short'){ out.push(['состояние',NaN,'КОРОТКОЕ ЗАМЫКАНИЕ: путь A→B без резисторов']); return out; }
    if(c.status==='blocked'){
      out.push(['состояние',NaN,'конденсатор разрывает цепь: постоянный ток не идёт'],
               ['ток источника I',0,'мА'],
               ['эквивалентное R_экв',Infinity,'Ом'],
               ['потенциал клеммы A',p.U,'В'],
               ['потенциал клеммы B (земля)',0,'В']);
      конденсаторы();
      /* Проверка того же сорта, что баланс мощностей у резисторов: энергия,
         посчитанная по каждому конденсатору отдельно, обязана сойтись с
         ½C_эквU² для всей батареи. */
      out.push(['заряд от источника Q = C_экв·U',c.Qa||0,'мкКл'],
               ['эквивалентная ёмкость C_экв',c.Ceq||0,'мкФ'],
               ['сверка энергии: ½C_эквU² − ΣW',0.5*(c.Ceq||0)*p.U*p.U-(c.Wc||0),'мкДж'],
               ['независимых контуров (II закон)',c.loops,'']);
      return out;
    }

    out.push(['эквивалентное R_экв',c.Req,'Ом'],
             ['ток источника I = U/R_экв',c.I*1000,'мА'],
             ['мощность источника P = U·I',c.Psrc,'Вт'],
             ['потенциал клеммы A',p.U,'В'],
             ['потенциал клеммы B (земля)',0,'В']);

    // каждый резистор: закон Ома в чистом виде
    const rs=c.els.filter(e=>e.type==='R').slice(0,8);
    for(const e of rs){
      const i=this.sub(e.idx);
      out.push([`R${i} = ${e.R.toFixed(0)} Ом · ток I${i}`, Math.abs(e.I)*1000,'мА'],
               [`      падение U${i} = I${i}·R${i}`, Math.abs(e.dU),'В'],
               [`      мощность P${i} = I${i}²·R${i}`, e.P,'Вт']);
    }
    конденсаторы();
    out.push(['независимых контуров (II закон)',c.loops,''],
             ['I закон Кирхгофа: макс. невязка ΣI в узле',c.kcl,'А'],
             ['баланс мощностей: ΣI²R − U·I',c.Psum-c.Psrc,'Вт']);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Последовательно: R складываются',
     values:{demo:'series',R1:100,R2:200,U:12,phi:true,values:true}},
    {name:'Делитель напряжения: φ середины = 9 В',
     values:{demo:'series',R1:100,R2:300,U:12,phi:true,values:true}},
    {name:'Параллельно: R меньше меньшего',
     values:{demo:'parallel',R1:100,R2:200,U:12,phi:true,values:true}},
    {name:'Смешанное: R₁ + (R₂ ∥ R₃)',
     values:{demo:'mixed',R1:100,R2:200,R3:300,U:12,phi:true,values:true}},
    {name:'Мост Уитстона сбалансирован: через мост тока нет',
     values:{demo:'bridge',R1:100,R2:200,R3:150,R4:300,R5:470,U:12,phi:true,values:true}},
    {name:'Мост Уитстона разбалансирован: ток пошёл',
     values:{demo:'bridge',R1:100,R2:200,R3:150,R4:200,R5:470,U:12,phi:true,values:true}},
    {name:'Конденсатор параллельно резистору: заряжен, но тока не пропускает',
     values:{demo:'cpar',R1:100,C1:47,U:12,phi:true,values:true}},
    {name:'Два конденсатора последовательно: заряд один, напряжения разные',
     values:{demo:'cdiv',C1:47,C2:100,U:12,phi:true,values:true}},
    {name:'Два конденсатора параллельно: напряжение одно, ёмкости складываются',
     values:{demo:'cadd',C1:47,C2:100,U:12,phi:true,values:true}},
    {name:'Пустая сетка — собрать схему самому',
     values:{demo:'blank',U:12,phi:true,values:true}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-60)/(15.5*PX_PER_M),(H-60)/(12.6*PX_PER_M)),0.002,30);
    return {x:0,y:-0.5,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const net=this.netOf(p), c=this.calc(p);
    /* Подписи в схеме центрируем по своей точке: VIEW.label выравнивает текст
       по левому краю, поэтому половину ширины (моноширинный 11px ≈ 6,1 px на
       знак) вычитаем вручную. Без этого длинные подписи уползали влево и
       ложились на соседний элемент. */
    const mid=t=>-Math.round(String(t).length*3.05);
    /* Потенциалы известны и когда ток не идёт: у батареи конденсаторов они
       и есть весь ответ. Признак заводим один на всю отрисовку — иначе имена
       клемм и их потенциалы разъезжаются по разным условиям и печатаются
       дважды: «A(+) · φ = 12,00 В» и тут же «A (+)». */
    const сФи = p.phi && (c.status==='ok' || c.status==='blocked');

    // ---- узлы сетки, куда можно вести провод
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.globalAlpha=.3;
    for(let gx=-7;gx<=7;gx++) for(let gy=-4;gy<=4;gy++){
      ctx.beginPath(); ctx.moveTo(gx-0.12,gy); ctx.lineTo(gx+0.12,gy);
      ctx.moveTo(gx,gy-0.12); ctx.lineTo(gx,gy+0.12); ctx.stroke();
    }
    ctx.globalAlpha=1;

    // ---- замыкающий контур источника: чтобы цепь читалась как замкнутая
    if(p.src && net.B){
      const yb=-5.4;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1.6);
      ctx.setLineDash([v.lw(5),v.lw(4)]);
      ctx.beginPath();
      ctx.moveTo(this.A.x,this.A.y); ctx.lineTo(this.A.x,yb);
      ctx.lineTo(net.B.x,yb); ctx.lineTo(net.B.x,net.B.y);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      // батарейка посередине нижней перемычки
      const mx=(this.A.x+net.B.x)/2;
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(3);
      ctx.beginPath(); ctx.moveTo(mx-0.18,yb-0.45); ctx.lineTo(mx-0.18,yb+0.45); ctx.stroke();
      ctx.lineWidth=v.lw(1.6);
      ctx.beginPath(); ctx.moveTo(mx+0.18,yb-0.24); ctx.lineTo(mx+0.18,yb+0.24); ctx.stroke();
      v.label(ctx,`источник U = ${p.U} В`,mx,yb,mid(`источник U = ${p.U} В`),-16,dang);
    }

    // ---- провода и резисторы
    for(const g of net.segs){
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(g.type==='R'?2.2:2.2);
      ctx.beginPath(); ctx.moveTo(g.x1,g.y1); ctx.lineTo(g.x2,g.y2); ctx.stroke();
    }
    const rEls=c.els.filter(e=>e.type==='R');
    for(const e of rEls){
      const cx=(e.x1+e.x2)/2, cy=(e.y1+e.y2)/2, horiz=e.y1===e.y2;
      ctx.fillStyle=v.c('--canvas'); ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
      ctx.beginPath();
      if(horiz) ctx.rect(cx-0.6,cy-0.24,1.2,0.48); else ctx.rect(cx-0.24,cy-0.6,0.48,1.2);
      ctx.fill(); ctx.stroke();
      if(p.values){
        const i=this.sub(e.idx);
        const mA=Math.abs(e.I)*1000;
        const t1=`R${i} = ${e.R.toFixed(0)} Ом`;
        const t2=`${mA>=10?mA.toFixed(1):mA.toFixed(2)} мА · ${Math.abs(e.dU).toFixed(2)} В`;
        /* Горизонтальный резистор подписываем ПОД собой, вертикальный — справа.
           Сверху над узлами идут потенциалы, поэтому верх мы не занимаем. */
        v.label(ctx,t1,cx,cy,horiz?mid(t1):16,horiz?18:-8,acc);
        if(c.status==='ok') v.label(ctx,t2,cx,cy,horiz?mid(t2):16,horiz?32:7,ink3);
      }
    }

    /* ---- конденсаторы: две обкладки с зазором.
       Провод под ними стираем цветом холста — иначе линия проходила бы прямо
       через зазор, и на схеме конденсатор выглядел бы замкнутым, ровно
       наоборот тому, что он делает с постоянным током. */
    for(const e of c.els.filter(e=>e.type==='C')){
      const cx=(e.x1+e.x2)/2, cy=(e.y1+e.y2)/2, horiz=e.y1===e.y2;
      const зазор=0.17, пласт=0.42;
      ctx.strokeStyle=v.c('--canvas'); ctx.lineWidth=v.lw(4);
      ctx.beginPath();
      if(horiz){ ctx.moveTo(cx-0.3,cy); ctx.lineTo(cx+0.3,cy); }
      else     { ctx.moveTo(cx,cy-0.3); ctx.lineTo(cx,cy+0.3); }
      ctx.stroke();
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2.6);
      ctx.beginPath();
      if(horiz){
        ctx.moveTo(cx-зазор,cy-пласт); ctx.lineTo(cx-зазор,cy+пласт);
        ctx.moveTo(cx+зазор,cy-пласт); ctx.lineTo(cx+зазор,cy+пласт);
      } else {
        ctx.moveTo(cx-пласт,cy-зазор); ctx.lineTo(cx+пласт,cy-зазор);
        ctx.moveTo(cx-пласт,cy+зазор); ctx.lineTo(cx+пласт,cy+зазор);
      }
      ctx.stroke();
      if(p.values){
        const i=this.sub(e.idx);
        const t1=`C${i} = ${e.C} мкФ`;
        const t2=`${Math.abs(e.dU).toFixed(2)} В · ${Math.abs(e.Q).toFixed(1)} мкКл`;
        v.label(ctx,t1,cx,cy,horiz?mid(t1):16,horiz?18:-8,sec);
        if(c.status==='ok'||c.status==='blocked')
          v.label(ctx,t2,cx,cy,horiz?mid(t2):16,horiz?32:7,ink3);
      }
    }

    // ---- предпросмотр рисуемого отрезка
    if(p._preview){
      const pv=p._preview;
      // цвет предпросмотра — как у будущего элемента: провод серый, резистор
      // цветом резисторов, конденсатор цветом обкладок
      ctx.strokeStyle=p.tool==='R'?acc:p.tool==='C'?sec:ink3; ctx.lineWidth=v.lw(2);
      ctx.setLineDash([v.lw(5),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(pv.x1,pv.y1); ctx.lineTo(pv.x2,pv.y2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- развилки
    const deg={}; const bump=k=>deg[k]=(deg[k]||0)+1;
    for(const g of net.segs){ bump(this.key(g.x1,g.y1)); bump(this.key(g.x2,g.y2)); }
    ctx.fillStyle=ink;
    for(const k in deg) if(deg[k]>=3){
      const [x,y]=k.split(',').map(Number);
      ctx.beginPath(); ctx.arc(x,y,v.lw(4),0,7); ctx.fill();
    }

    /* Кружки клемм рисуем ДО подписей: иначе окружность прочерчивается прямо
       поверх текста «A(+) · φ = 12,00 В» и съедает из него пару знаков. */
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.arc(this.A.x,this.A.y,0.3,0,7); ctx.stroke();
    if(net.B){
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2.4);
      ctx.beginPath(); ctx.arc(net.B.x,net.B.y,0.3,0,7); ctx.stroke();
    }

    /* ---- ПОТЕНЦИАЛЫ. Именно разности φ и дают токи, поэтому подписываем
       концы резисторов и клеммы. Но точки, соединённые ТОЛЬКО проводами, —
       это один и тот же электрический узел с одним потенциалом: подписываем
       его один раз, иначе «φ = 12,00 В» дублируется через каждую клетку и
       подписи наезжают друг на друга. */
    if(сФи){
      const par={};
      const find=k=>{ if(!(k in par)) par[k]=k; while(par[k]!==k){ par[k]=par[par[k]]; k=par[k]; } return k; };
      const uni=(a,b)=>{ const x=find(a),y=find(b); if(x!==y) par[x]=y; };
      for(const e of c.els) if(e.type==='wire') uni(e.a,e.b);
      const done=new Set();
      const mark=(x,y,col,pre)=>{
        const k=this.key(x,y);
        if(!(k in c.phi)) return;
        const root=find(k);
        if(done.has(root)) return;
        done.add(root);
        if(!pre){ ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,v.lw(3),0,7); ctx.fill(); }
        const t=(pre||'')+`φ = ${c.phi[k].toFixed(2)} В`;
        /* Клеммы стоят у самого края кадра, поэтому их длинные подписи
           поднимаем на отдельную строку: иначе кадр отжимает их внутрь схемы,
           прямо на потенциалы соседних узлов. */
        v.label(ctx,t,x,y,mid(t),pre?-32:-17,col);
      };
      // у клемм потенциал пишем вместе с именем — два ярлыка на одном узле лишние
      mark(this.A.x,this.A.y,dang,'A(+) · ');
      if(net.B) mark(net.B.x,net.B.y,sec,'B(−, земля) · ');
      for(const e of rEls){ mark(e.x1,e.y1,meas); mark(e.x2,e.y2,meas); }
      /* Обкладки конденсаторов подписываем тоже: в делителе из двух ёмкостей
         весь смысл в потенциале точки между ними, а резисторов там может не
         быть вовсе — иначе эта цифра нигде бы не появилась. */
      for(const e of c.els) if(e.type==='C'){ mark(e.x1,e.y1,meas); mark(e.x2,e.y2,meas); }
    }

    /* ---- ДВИЖЕНИЕ ТОКА. Точки бегут по КАЖДОМУ элементу в направлении его
       собственного тока и тем гуще, чем ток больше. Раньше они одинаково
       бежали всюду — даже по ветвям, где тока нет вовсе (в сбалансированном
       мосте это прямо вводило в заблуждение). */
    if(p.flow && c.status==='ok'){
      const Imax=Math.max(1e-12,...c.els.map(e=>Math.abs(e.I||0)));
      ctx.fillStyle=dang;
      for(const e of c.els){
        const rel=Math.abs(e.I||0)/Imax;
        if(rel<0.02) continue;                    // ветвь без тока — и точек нет
        const L=Math.hypot(e.x2-e.x1,e.y2-e.y1);
        const nd=Math.max(1,Math.round(L*1.6));
        const dir=Math.sign(e.I||0);
        for(let k=0;k<nd;k++){
          const t=(((s.flow*dir+k/nd)%1)+1)%1;
          ctx.globalAlpha=0.35+0.65*rel;
          ctx.beginPath();
          ctx.arc(e.x1+(e.x2-e.x1)*t, e.y1+(e.y2-e.y1)*t, v.lw(1.6+2*rel),0,7);
          ctx.fill();
        }
      }
      ctx.globalAlpha=1;
    }

    // ---- имена клемм: отдельной подписью только когда потенциалы выключены
    if(!сФи){
      v.label(ctx,'A (+)',this.A.x,this.A.y,mid('A (+)'),-17,dang);
      if(net.B) v.label(ctx,'B (−, земля)',net.B.x,net.B.y,mid('B (−, земля)'),-17,sec);
    }

    // ---- строка состояния
    let st,col=ink3;
    if(c.status==='noB'){ st='нарисуйте цепь от A и нажмите «вывод B»'; }
    else if(c.status==='open'){ st='цепь разомкнута: A и B не соединены'; col=meas; }
    else if(c.status==='short'){ st='КОРОТКОЕ ЗАМЫКАНИЕ: путь A→B без резисторов'; col=dang; }
    else if(c.status==='blocked'){
      st=`постоянный ток не идёт: путь A→B только через конденсатор · запасено ${(c.Wc||0).toFixed(0)} мкДж`;
      col=sec;
    }
    else st=`R_экв = ${c.Req.toFixed(2)} Ом · I = ${(c.I*1000).toFixed(2)} мА · P = ${c.Psrc.toFixed(3)} Вт`;
    v.label(ctx,st,0,5.1,mid(st),0,col);
    if(c.status==='ok'){
      const t=`ΣI в узле = ${c.kcl.toExponential(1)} А · независимых контуров: ${c.loops}`;
      v.label(ctx,t,0,5.1,mid(t),14,ink3);
    }
    const hint='ЛКМ от узла — вести провод · ПКМ — инструменты · Ctrl+Z — отменить отрезок';
    v.label(ctx,hint,0,-6.5,mid(hint),0,ink3);
  }
}
,


});
