'use strict';
/* =============================================================================
   СПЕЦИАЛЬНАЯ ТЕОРИЯ ОТНОСИТЕЛЬНОСТИ (3.0.0)

   Три сцены на одну идею: скорость света одинакова для всех, и из этого
   одного факта следуют замедление времени, сокращение длины, новое правило
   сложения скоростей и связь энергии с массой.

   Все три считаются по точным формулам, без шагов интегрирования: у
   равномерного движения и у разгона постоянной силой решение известно в
   замкнутом виде, и ошибке накопиться негде.
   ============================================================================= */
const C_LIGHT=299792458;                          // м/с, точно по определению метра
const REL={
  gamma(b){ b=Math.min(Math.abs(b),0.999999); return 1/Math.sqrt(1-b*b); },
  /* сложение скоростей вдоль одной прямой, скорости в долях c */
  add(b,u){ return (b+u)/(1+b*u); }
};

Object.assign(SIMS,{
/* ================== СВЕТОВЫЕ ЧАСЫ ================= */
lightclock:{
  title:'Световые часы: замедление времени и сокращение длины',
  /* Свет проходит 0,3 м за наносекунду. Покажи мы его в настоящем темпе —
     вспышка пролетала бы кадр за миллиардную долю секунды. Поэтому секунда
     сцены изображает одну наносекунду: всё остальное — расстояния, скорости,
     отношения — настоящее. */
  timeUnit:'нс',
  schema:true,
  params:[
    {key:'beta',label:'Скорость часов v/c',min:0,max:0.99,step:0.01,default:0.6},
    {key:'L0',label:'Расстояние между зеркалами L₀',unit:'м',min:0.15,max:1.5,step:0.05,default:0.3},

    {type:'group',label:'Показывать'},
    {key:'path',label:'Путь света в лаборатории',type:'check',default:true},
    {key:'tri', label:'Треугольник: L₀, vΔt/2, cΔt/2',type:'check',default:true},
    {key:'rod', label:'Стержень: сокращение длины',type:'check',default:true},
    {key:'l0',label:'Длина стержня в покое ℓ₀',unit:'м',min:0.3,max:3,step:0.1,default:1.2,если:p=>!!p.rod},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'нс',min:0,max:200,step:1,default:0}
  ],
  c:C_LIGHT*1e-9,                                   // м/нс
  g(p){ return REL.gamma(p.beta); },
  /* период тика часов в покое: свет туда и обратно */
  T0(p){ return 2*p.L0/this.c; },
  track(p){ const W=Math.max(7*p.L0, p.rod? 1.5*p.l0+2.6*p.L0 : 0); return {xL:-W/2, xR:W/2, W}; },
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){
    const t=s.t+dt;
    if(p.tStop>0 && t>=p.tStop){ s.t=p.tStop;
      s.__stop=`Остановка: по часам лаборатории прошло ${p.tStop} нс, по движущимся — ${(p.tStop/this.g(p)).toFixed(2)} нс`; return; }
    s.t=t;
  },
  /* высота вспышки над нижним зеркалом при периоде тика T (по часам лаборатории) */
  photonY(t,T,L){ const ph=t/(T/2), k=Math.floor(ph), f=ph-k; return (k%2? 1-f : f)*L; },
  movX(s,p){
    const tr=this.track(p), v=p.beta*this.c;
    if(v<1e-9) return {x:0, t0:0};
    const run=v*s.t, off=run%tr.W;
    return {x:tr.xL+off, t0:s.t-off/v};
  },
  anchors(s,p){ return [{x:this.movX(s,p).x,y:p.L0/2}]; },
  readouts(s,p){
    const g=this.g(p), T0=this.T0(p);
    const out=[['t (часы лаборатории)',s.t,'нс'],
      ['γ = 1/√(1 − v²/c²)',g,''],
      ['скорость часов v',p.beta*C_LIGHT/1e8,'·10⁸ м/с'],
      ['τ движущихся часов = t/γ',s.t/g,'нс'],
      ['отставание t − τ',s.t-s.t/g,'нс'],
      ['тик часов в покое T₀ = 2L₀/c',T0,'нс'],
      ['тик движущихся по часам лаборатории γT₀',g*T0,'нс'],
      ['тиков у часов в покое',Math.floor(s.t/T0),''],
      ['тиков у движущихся часов',Math.floor(s.t/(g*T0)),'']];
    if(p.rod) out.push(['длина стержня в покое ℓ₀',p.l0,'м'],
      ['длина движущегося ℓ = ℓ₀/γ',p.l0/g,'м']);
    return out;
  },
  graphs:[
    {label:'Показания часов',unit:'нс',series:['лаборатория t','движущиеся τ'],
     get(s,p){ return [s.t, s.t/SIMS.lightclock.g(p)]; }},
    {label:'Число тиков',unit:'',series:['в покое','в движении'],
     get(s,p){ const d=SIMS.lightclock, T0=d.T0(p); return [Math.floor(s.t/T0), Math.floor(s.t/(d.g(p)*T0))]; }}
  ],
  presets:[
    {name:'Часы стоят: ход одинаков',values:{beta:0,L0:0.3,tStop:0}},
    {name:'v = 0,6c: γ = 1,25',values:{beta:0.6,L0:0.3,tStop:0}},
    {name:'v = 0,8c: γ = 5/3',values:{beta:0.8,L0:0.3,tStop:0}},
    {name:'v ≈ 0,87c: время вдвое медленнее',values:{beta:0.87,L0:0.3,tStop:0}},
    {name:'v = 0,99c: γ ≈ 7',values:{beta:0.99,L0:0.3,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, tr=this.track(p), L=p.L0;
    const spanX=tr.W+0.6*L, spanY=4.6*L;
    const scale=clamp(Math.min((W-40)/(spanX*PX_PER_M),(H-50)/(spanY*PX_PER_M)),0.002,300);
    return {x:0,y:1.35*L,scale};
  },
  /* одни часы: два зеркала, пунктир «трубки», вспышка */
  clock(ctx,v,x,y0,L,py,col,ph){
    const w=0.32*L;
    ctx.strokeStyle=col; ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(x-w,y0); ctx.lineTo(x+w,y0); ctx.moveTo(x-w,y0+L); ctx.lineTo(x+w,y0+L); ctx.stroke();
    ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(x-w,y0); ctx.lineTo(x-w,y0+L); ctx.moveTo(x+w,y0); ctx.lineTo(x+w,y0+L); ctx.stroke();
    ctx.setLineDash(EMPTY_DASH);
    ctx.fillStyle=ph; ctx.beginPath(); ctx.arc(x,y0+py,v.lw(4.5),0,7); ctx.fill();
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const L=p.L0, g=this.g(p), T0=this.T0(p), tr=this.track(p), c=this.c, vv=p.beta*c;
    const yR=2.5*L;                                 // полоса часов в покое
    // полосы-«рельсы»
    ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(tr.xL,-0.12*L); ctx.lineTo(tr.xR,-0.12*L);
    ctx.moveTo(tr.xL,yR-0.12*L); ctx.lineTo(tr.xR,yR-0.12*L); ctx.stroke();

    // часы в покое
    const xr=tr.xL+0.7*L;
    this.clock(ctx,v,xr,yR,L,this.photonY(s.t,T0,L),ink,meas);
    v.label(ctx,`в покое: τ = t = ${s.t.toFixed(2)} нс · тиков ${Math.floor(s.t/T0)}`,xr,yR+L,-20,-14,ink);

    // движущиеся часы и путь вспышки в лаборатории
    const m=this.movX(s,p), Tm=g*T0;
    let tri=null;
    ctx.save(); ctx.beginPath(); ctx.rect(tr.xL,-2*L,tr.W,10*L); ctx.clip();
    if(p.path && vv>1e-9){
      const pts=[], k0=Math.ceil(m.t0/(Tm/2)), k1=Math.floor(s.t/(Tm/2));
      const X=t=>m.x-vv*(s.t-t);
      pts.push([X(m.t0),this.photonY(m.t0,Tm,L)]);
      for(let k=k0;k<=k1;k++){ const t=k*Tm/2; pts.push([X(t),this.photonY(t,Tm,L)]); }
      pts.push([m.x,this.photonY(s.t,Tm,L)]);
      ctx.strokeStyle=meas; ctx.globalAlpha=.7; ctx.lineWidth=v.lw(1.6);
      ctx.beginPath(); pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke();
      ctx.globalAlpha=1;
      // треугольник на первом целом подъёме снизу вверх
      if(p.tri && p.beta>0.05){
        // последний целый подъём снизу вверх — он рядом с часами и виден целиком
        let kk=Math.floor(s.t/(Tm/2))-1; if(kk%2) kk--;
        if(kk>=k0 && (kk+1)*Tm/2<=s.t){
          const ta=kk*Tm/2, tb=(kk+1)*Tm/2, xa=X(ta), xb=X(tb);
          ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(4),v.lw(3)]);
          ctx.beginPath(); ctx.moveTo(xa,0); ctx.lineTo(xb,0); ctx.lineTo(xb,L); ctx.stroke();
          ctx.setLineDash(EMPTY_DASH);
          tri=[xa,xb];
        }
      }
    }
    this.clock(ctx,v,m.x,0,L,this.photonY(s.t,Tm,L),acc,meas);
    if(vv>1e-9) v.arrow(ctx,m.x+0.45*L,L/2,m.x+0.45*L+Math.max(0.3*L,1.4*L*p.beta),L/2,acc);

    // стержни: в покое и движущийся, сокращённый в γ раз
    if(p.rod){
      const h=0.12*L, xs=xr-0.3*L;
      ctx.fillStyle=sec; ctx.globalAlpha=.85;
      ctx.fillRect(xs,yR-0.42*L-h/2,p.l0,h);
      ctx.fillRect(m.x-p.l0/(2*g),-0.42*L-h/2,p.l0/g,h);
      ctx.globalAlpha=1;
      v.label(ctx,`стержень в покое ℓ₀ = ${p.l0.toFixed(2)} м`,xs,yR-0.42*L,0,-12,sec);
      v.label(ctx,`движется: ℓ = ℓ₀/γ = ${(p.l0/g).toFixed(2)} м`,m.x-p.l0/(2*g),-0.42*L,0,14,sec);
    }
    ctx.restore();
    if(tri){
      v.label(ctx,'vΔt/2',(tri[0]+tri[1])/2,0,-16,12,sec);
      v.label(ctx,'L₀',tri[1],L/2,6,0,sec);
      v.label(ctx,'cΔt/2',(tri[0]+tri[1])/2,L/2,-44,-8,meas);
    }
    v.label(ctx,`движутся: τ = t/γ = ${(s.t/g).toFixed(2)} нс · тиков ${Math.floor(s.t/Tm)}`,m.x,L,-40,-14,acc);
    v.label(ctx,`γ = ${g.toFixed(3)}: движущиеся часы тикают в ${g.toFixed(2)} раза реже`,tr.xL,-L,0,6,ink3);
    v.label(ctx,'1 с сцены = 1 нс: за это время свет проходит 0,30 м',tr.xL,-L,0,22,ink3);
  }
},

/* ================== ДИАГРАММА МИНКОВСКОГО ================= */
minkowski:{
  title:'Диаграмма Минковского: одновременность и сложение скоростей',
  schema:true,
  timeless:true,
  params:[
    {key:'beta',label:'Скорость ракеты v/c',min:-0.9,max:0.9,step:0.05,default:0.6},
    {key:'u',label:'Скорость снаряда в ракете u′/c',min:-0.95,max:0.95,step:0.05,default:0.6},
    {key:'dx',label:'Расстояние между событиями в ракете Δx′',unit:'св. год',min:0,max:3,step:0.25,default:2},

    {type:'group',label:'Показывать'},
    {key:'grid',label:'Сетка ракеты (x′, ct′)',type:'check',default:true},
    {key:'cone',label:'Световой конус',type:'check',default:true},
    {key:'simul',label:'Одновременные в ракете события',type:'check',default:true},
    {key:'galileo',label:'Ответ Галилея v + u′',type:'check',default:true}
  ],
  g(p){ return REL.gamma(p.beta); },
  uLab(p){ return REL.add(p.beta,p.u); },
  /* перевод событий ракеты (x′, ct′) в координаты Земли (x, ct) */
  toLab(p,x1,t1){ const g=this.g(p), b=p.beta; return [g*(x1+b*t1), g*(t1+b*x1)]; },
  T1:1.5,                                            // «сейчас» ракеты для пары событий
  init(p){ return {t:0}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const g=this.g(p), b=p.beta, u=this.uLab(p);
    const A=this.toLab(p,0,this.T1), B=this.toLab(p,p.dx,this.T1);
    const dt=B[1]-A[1], dX=B[0]-A[0];
    return [['γ ракеты',g,''],
      ['u = (v + u′)/(1 + vu′/c²)',u,'c'],
      ['по Галилею v + u′',b+p.u, Math.abs(b+p.u)>=1?'c — быстрее света!':'c'],
      ['события A, B: Δt′ в ракете',0,'год — одновременны'],
      ['Δt на Земле = γvΔx′/c²',dt,'год'],
      ['интервал (cΔt)² − Δx² в ракете',-p.dx*p.dx,'св. год²'],
      ['интервал (cΔt)² − Δx² на Земле',dt*dt-dX*dX,'св. год² — тот же'],
      ['наклон осей ракеты',Math.atan(Math.abs(b))*180/Math.PI,'°']];
  },
  graphs:[],
  presets:[
    {name:'0,6c + 0,6c = 0,88c',values:{beta:0.6,u:0.6,dx:2}},
    {name:'0,9c + 0,9c = 0,994c',values:{beta:0.9,u:0.9,dx:2}},
    {name:'Медленно: почти как у Галилея',values:{beta:0.1,u:0.1,dx:2}},
    {name:'Встречный снаряд',values:{beta:0.6,u:-0.8,dx:2}},
    {name:'Ракета стоит: сетки совпадают',values:{beta:0,u:0.5,dx:2}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(8.6*PX_PER_M),(H-30)/(7.2*PX_PER_M)),0.002,30);
    return {x:0,y:2.8,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), ok=v.c('--ok'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const X0=-4, X1=4, Tm=6, b=p.beta, g=this.g(p);
    ctx.save(); ctx.beginPath(); ctx.rect(X0-0.3,-0.6,X1-X0+0.6,Tm+0.8); ctx.clip();
    // сетка Земли — бледная
    ctx.strokeStyle=line; ctx.lineWidth=v.lw(1); ctx.globalAlpha=.5;
    for(let k=-4;k<=4;k++){ ctx.beginPath(); ctx.moveTo(k,-0.5); ctx.lineTo(k,Tm); ctx.stroke(); }
    for(let k=0;k<=6;k++){ ctx.beginPath(); ctx.moveTo(X0,k); ctx.lineTo(X1,k); ctx.stroke(); }
    ctx.globalAlpha=1;
    // световой конус
    if(p.cone){
      ctx.fillStyle=meas; ctx.globalAlpha=.08;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Tm,Tm); ctx.lineTo(-Tm,Tm); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.4); ctx.setLineDash([v.lw(5),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(-Tm,Tm); ctx.lineTo(0,0); ctx.lineTo(Tm,Tm); ctx.stroke();
      ctx.setLineDash(EMPTY_DASH);
    }
    // сетка ракеты: линии x′ = const и ct′ = const
    if(p.grid && Math.abs(b)>1e-6){
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1); ctx.globalAlpha=.28;
      for(let k=-8;k<=8;k++){
        const a=this.toLab(p,k,-8), c2=this.toLab(p,k,8);
        ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(c2[0],c2[1]); ctx.stroke();
        const d=this.toLab(p,-8,k), e=this.toLab(p,8,k);
        ctx.beginPath(); ctx.moveTo(d[0],d[1]); ctx.lineTo(e[0],e[1]); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    // оси Земли
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.moveTo(X0,0); ctx.lineTo(X1,0); ctx.moveTo(0,-0.5); ctx.lineTo(0,Tm); ctx.stroke();
    // оси ракеты
    {
      const a=this.toLab(p,0,-2), c2=this.toLab(p,0,8), d=this.toLab(p,-8,0), e=this.toLab(p,8,0);
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(c2[0],c2[1]); ctx.moveTo(d[0],d[1]); ctx.lineTo(e[0],e[1]); ctx.stroke();
      // деления: единица ракеты на её осях длиннее — масштаб тоже меняется
      ctx.fillStyle=acc;
      for(let k=1;k<=6;k++){
        const q=this.toLab(p,0,k); if(q[1]<Tm){ ctx.beginPath(); ctx.arc(q[0],q[1],v.lw(2.6),0,7); ctx.fill(); }
        const r=this.toLab(p,k,0); if(r[0]<X1){ ctx.beginPath(); ctx.arc(r[0],r[1],v.lw(2.6),0,7); ctx.fill(); }
      }
    }
    // мировая линия снаряда и ответ Галилея
    const u=this.uLab(p), uG=b+p.u;
    const wl=(uu,col,dash)=>{
      ctx.strokeStyle=col; ctx.lineWidth=v.lw(2.2); if(dash) ctx.setLineDash([v.lw(6),v.lw(4)]);
      const tEnd=Math.min(Tm, Math.abs(uu)>1e-6? 3.9/Math.abs(uu):Tm);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(uu*tEnd,tEnd); ctx.stroke(); ctx.setLineDash(EMPTY_DASH);
      return [uu*tEnd,tEnd];
    };
    let pg=null;
    if(p.galileo && Math.abs(uG-u)>0.005) pg=wl(uG,dang,true);
    const pu=wl(u,ok,false);
    // одновременные в ракете события A и B
    let A=null,B=null;
    if(p.simul){
      A=this.toLab(p,0,this.T1); B=this.toLab(p,p.dx,this.T1);
      const l1=this.toLab(p,-8,this.T1), l2=this.toLab(p,8,this.T1);
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(l1[0],l1[1]); ctx.lineTo(l2[0],l2[1]); ctx.stroke();
      ctx.strokeStyle=ink3;
      ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.lineTo(X0,A[1]); ctx.moveTo(B[0],B[1]); ctx.lineTo(X0,B[1]); ctx.stroke();
      ctx.setLineDash(EMPTY_DASH);
      for(const q of [A,B]){ ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(q[0],q[1],v.lw(5),0,7); ctx.fill(); }
    }
    ctx.restore();
    // подписи — вне обрезки, чтобы раскладчик мог их прижать к краю
    v.label(ctx,'x, св. год',X1,0,-64,12,ink);
    v.label(ctx,'ct, год',0,Tm,6,8,ink);
    { const e=this.toLab(p,0,Math.min(4.5,Tm/g*0.9)); v.label(ctx,'ct′ (ракета)',e[0],e[1],6,0,acc); }
    { const e=this.toLab(p,Math.min(3.6,3.9/g),0); v.label(ctx,'x′',e[0],e[1],4,-10,acc); }
    v.label(ctx,`снаряд: u = ${u.toFixed(3)}c`,pu[0],pu[1],6,10,ok);
    if(pg) v.label(ctx,`Галилей: v + u′ = ${uG.toFixed(2)}c${Math.abs(uG)>=1?' — быстрее света':''}`,pg[0],pg[1],-40,-12,dang);
    if(p.cone) v.label(ctx,'свет: x = ±ct',-Tm*0.8,Tm*0.8,6,0,meas);
    if(A){
      v.label(ctx,'A',A[0],A[1],-14,-8,acc); v.label(ctx,'B',B[0],B[1],8,-8,acc);
      v.label(ctx,`в ракете A и B одновременны; на Земле B позже на ${(B[1]-A[1]).toFixed(2)} года`,X0,-0.35,0,0,ink3);
    }
  }
},

/* ================== РАЗГОН ПОСТОЯННОЙ СИЛОЙ ================= */
relmotion:{
  title:'Разгон до скорости света: постоянная сила',
  schema:true,
  params:[
    {key:'part',label:'Частица',type:'select',default:'e',
     options:[{v:'e',t:'Электрон — mc² = 511 кэВ'},{v:'mu',t:'Мюон — mc² = 105,7 МэВ'}]},
    {key:'E',label:'Напряжённость поля E',unit:'мВ/м',min:0.1,max:20,step:0.1,default:1},

    {type:'group',label:'Показывать'},
    {key:'newton',label:'Расчёт по Ньютону для сравнения',type:'check',default:true},
    {key:'energy',label:'Полоса энергии mc² + K',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'bStop',label:'Когда v/c достигнет (0 — выкл)',min:0,max:0.99,step:0.01,default:0},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:60,step:0.1,default:0}
  ],
  e:1.602176634e-19, c:C_LIGHT,
  M:{e:9.1093837e-31, mu:1.883531627e-28},
  m(p){ return this.M[p.part]||this.M.e; },
  F(p){ return this.e*p.E*1e-3; },
  /* Точное решение: dp/dt = F ⇒ p = Ft, E² = (pc)² + (mc²)², v = pc²/E,
     путь x = (mc²/F)(γ − 1) — работа силы Fx как раз и равна K. */
  st(t,p){
    const m=this.m(p), F=this.F(p), c=C_LIGHT, mc=m*c, P=F*t;
    const g=Math.sqrt(1+(P/mc)*(P/mc)), v=P/(g*m);
    const K=(g-1)*m*c*c, x=K/F;
    return {P,g,v,x,K,E:g*m*c*c, vN:P/m, xN:F*t*t/(2*m), KN:P*P/(2*m)};
  },
  keV:1.602176634e-16,
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){
    let t=s.t+dt;
    if(p.bStop>0){
      const b=p.bStop, tb=this.m(p)*C_LIGHT/this.F(p)*b/Math.sqrt(1-b*b);
      if(t>=tb){ s.t=tb; s.__stop=`v = ${b}c через t = ${tb.toFixed(3)} с. По Ньютону тело было бы уже на ${(this.st(tb,p).vN/C_LIGHT).toFixed(2)}c`; return; }
    }
    if(p.tStop>0 && t>=p.tStop){ s.t=p.tStop; s.__stop=`Остановка по времени: t = ${p.tStop} с`; return; }
    s.t=t;
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const r=this.st(s.t,p), k=this.keV, mc2=this.m(p)*C_LIGHT*C_LIGHT/k;
    const out=[['t',s.t,'с'],
      ['сила F = eE',this.F(p)*1e22,'·10⁻²² Н'],
      ['импульс p = Ft',r.P*C_LIGHT/k,'кэВ/c'],
      ['γ = E/mc²',r.g,''],
      ['скорость v/c',r.v/C_LIGHT,''],
      ['скорость v',r.v/1e6,'Мм/с'],
      ['путь x',r.x/1e6,'Мм'],
      ['K = (γ − 1)mc²',r.K/k,'кэВ'],
      ['работа поля eEx',this.F(p)*r.x/k,'кэВ — равна K'],
      ['полная энергия E = γmc²',r.E/k,'кэВ'],
      ['√(E² − (pc)²) = mc²',Math.sqrt(Math.max(0,r.E*r.E-(r.P*C_LIGHT)*(r.P*C_LIGHT)))/k,'кэВ — не меняется']];
    if(p.newton) out.push(['по Ньютону v = Ft/m',r.vN/1e6, r.vN>C_LIGHT?'Мм/с — больше c!':'Мм/с'],
      ['по Ньютону K = p²/2m',r.KN/k,'кэВ']);
    out.push(['энергия покоя mc²',mc2,'кэВ']);
    return out;
  },
  graphs:[
    {label:'Путь',unit:'Мм',series:['СТО','Ньютон'],
     get(s,p){ const r=SIMS.relmotion.st(s.t,p); return [r.x/1e6, p.newton? r.xN/1e6 : null]; }},
    {label:'Скорость (предел — c = 299,8 Мм/с)',unit:'Мм/с',наклон:0,series:['СТО','Ньютон'],
     get(s,p){ const r=SIMS.relmotion.st(s.t,p); return [r.v/1e6, p.newton? r.vN/1e6 : null]; }},
    {label:'Импульс растёт равномерно',unit:'кэВ/c',series:['p = Ft'],
     get(s,p){ const d=SIMS.relmotion, r=d.st(s.t,p); return [r.P*C_LIGHT/d.keV, null]; }},
    {label:'Кинетическая энергия',unit:'кэВ',series:['СТО','Ньютон'],
     get(s,p){ const d=SIMS.relmotion, r=d.st(s.t,p); return [r.K/d.keV, p.newton? r.KN/d.keV : null]; }}
  ],
  presets:[
    {name:'Электрон в поле 1 мВ/м',values:{part:'e',E:1,bStop:0,tStop:0}},
    {name:'Разгон до 0,9c',values:{part:'e',E:1,bStop:0.9,tStop:0}},
    {name:'Разгон до 0,99c: Ньютон ушёл за 7c',values:{part:'e',E:1,bStop:0.99,tStop:0}},
    {name:'Сильнее поле — быстрее упор в c',values:{part:'e',E:5,bStop:0,tStop:0}},
    {name:'Мюон: в 207 раз инертнее',values:{part:'mu',E:20,bStop:0,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-40)/(12.6*PX_PER_M),(H-40)/(7.4*PX_PER_M)),0.002,30);
    return {x:0.6,y:0.3,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const r=this.st(s.t,p), b=r.v/C_LIGHT, bN=r.vN/C_LIGHT;
    // шкала скорости: 0 → x=−5, c → x=3, дальше — только для Ньютона
    const x0=-5, xc=3, sx=b0=>x0+(xc-x0)*b0, y=2.9;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(xc,y); ctx.stroke();
    for(let k=0;k<=10;k++){ const xx=sx(k/10);
      ctx.beginPath(); ctx.moveTo(xx,y-0.1); ctx.lineTo(xx,y+(k%5?0.1:0.2)); ctx.stroke(); }
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.moveTo(xc,y-0.5); ctx.lineTo(xc,y+0.6); ctx.stroke();
    v.label(ctx,'c — предел',xc,y-0.5,-20,12,dang);
    v.label(ctx,'0',x0,y-0.5,-4,12,ink3); v.label(ctx,'0,5c',sx(0.5),y-0.5,-12,12,ink3);
    if(p.newton){
      const xn=Math.min(sx(bN),6.2);
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.6); ctx.setLineDash([v.lw(5),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(x0,y-0.35); ctx.lineTo(xn,y-0.35); ctx.stroke(); ctx.setLineDash(EMPTY_DASH);
      if(sx(bN)>6.2) v.arrow(ctx,5.8,y-0.35,6.4,y-0.35,dang);
      v.label(ctx,`Ньютон: ${bN.toFixed(2)}c`,xn,y-0.35,xn>4.6?-96:8,xn>4.6?14:0,dang);
    }
    ctx.fillStyle=acc; ctx.globalAlpha=.9; ctx.fillRect(x0,y+0.22,sx(b)-x0,0.26); ctx.globalAlpha=1;
    v.label(ctx,`СТО: v = ${b.toFixed(4)}c`,sx(b),y+0.48,-60,-12,acc);

    // частица на дорожке между пластинами поля
    const yT=0.1, W=10.4, xl=-5, ph=((r.x/2e8)%1+1)%1;       // дорожка «прокручивается» на каждые 200 Мм
    ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1);
    for(let k=0;k<=8;k++){ const xx=xl+k*W/8;
      v.arrow(ctx,xx,yT+0.8,xx+0.5,yT+0.8,ink3); }
    ctx.beginPath(); ctx.moveTo(xl,yT-0.5); ctx.lineTo(xl+W,yT-0.5); ctx.stroke();
    const xp=xl+ph*W;
    ctx.fillStyle=sec; ctx.beginPath(); ctx.arc(xp,yT,v.lw(7),0,7); ctx.fill();
    v.label(ctx,`поле E = ${p.E} мВ/м: сила F = eE всё время одна и та же`,xl,yT+0.8,0,-14,ink3);
    v.label(ctx,`пройдено ${(r.x/1e6).toFixed(0)} Мм; один проход дорожки — 200 Мм`,xl,yT-0.5,0,14,ink3);

    // энергия: mc² + K
    if(p.energy){
      const yE=-2.2, unit=1.3, cap=10.2, Ls=r.g*unit, full=Math.min(Ls,cap);
      ctx.fillStyle=ink3; ctx.globalAlpha=.55; ctx.fillRect(xl,yE,Math.min(unit,cap),0.4); ctx.globalAlpha=1;
      ctx.fillStyle=meas; ctx.fillRect(xl+unit,yE,Math.max(0,full-unit),0.4);
      if(Ls>cap) v.arrow(ctx,xl+cap-0.3,yE+0.2,xl+cap+0.3,yE+0.2,meas);
      v.label(ctx,'mc²',xl,yE+0.2,6,0,v.c('--panel'));
      v.label(ctx,`E = γmc² = ${r.g.toFixed(3)} mc²; K = ${(r.K/this.keV).toFixed(1)} кэВ`,xl,yE,0,18,meas);
      v.label(ctx,'энергия растёт без предела, а скорость упирается в c',xl,yE,0,34,ink3);
    }
  }
}
});
