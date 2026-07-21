'use strict';
Object.assign(SIMS,{
/* ================== КОЛЕБАНИЯ: ПРУЖИННЫЙ МАЯТНИК ================= */
spring:{
  title:'Пружинный маятник (закон Гука)',
  params:[
    {key:'m',label:'Масса груза m',unit:'кг',min:0.1,max:20,step:0.1,default:1},
    {key:'k',label:'Жёсткость пружины k',unit:'Н/м',min:1,max:400,step:1,default:20},
    {key:'A',label:'Начальное смещение x₀',unit:'м',min:0.1,max:4,step:0.1,default:2},

    {type:'group',label:'Показывать'},
    {key:'dx',   label:'Отметка смещения Δx',type:'check',default:true},
    {key:'ampl', label:'Границы амплитуды',type:'check',default:true},
    {key:'force',label:'Сила упругости',type:'check',default:true},
    {key:'damp', label:'Затухание (реалистичнее)',type:'check',default:false},

    {type:'group',label:'Остановка таймера'},
    {key:'periods',label:'Через N полных колебаний (0 — выкл)',min:0,max:50,step:0.5,default:0},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  /* собственная частота: ω = √(k/m), период T = 2π√(m/k) */
  w(p){ return Math.sqrt(p.k/p.m); },
  T(p){ return 2*Math.PI/this.w(p); },
  init(p){ return {t:0,q:p.A,v:0,periods:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt, w=this.w(p);
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    const g=p.damp?0.06:0;
    const acc=(q,vv)=>-w*w*q - g*vv;
    const a1=acc(s.q,s.v);
    s.q+=s.v*dt+0.5*a1*dt*dt;
    const a2=acc(s.q,s.v+a1*dt);
    s.v+=0.5*(a1+a2)*dt;
    s.t=t; s.periods=s.t/this.T(p);
    if(p.periods>0 && s.periods>=p.periods){
      s.event={t:s.t,type:'periods'};
      s.__stop=`Пройдено ${p.periods} колебан. : t = ${s.t.toFixed(2)} с (период T = ${this.T(p).toFixed(3)} с)`;
    }
  },
  anchors(s,p){ return [{x:s.q,y:0},{x:0,y:0}]; },
  energies(s,p){ const Ek=0.5*p.m*s.v*s.v, Eel=0.5*p.k*s.q*s.q; return {Ek,Ep:0,Eel,Eth:0,tot:Ek+Eel}; },
  readouts(s,p){
    const E=this.energies(s,p);
    return [['t',s.t,'с'],
      ['период T = 2π√(m/k)',this.T(p),'с'],
      ['частота ν',1/this.T(p),'Гц'],
      ['круговая частота ω',this.w(p),'рад/с'],
      ['смещение Δx',s.q,'м'],
      ['скорость v',s.v,'м/с'],
      ['сила упругости −kx',-p.k*s.q,'Н'],
      ['кинетическая энергия',E.Ek,'Дж'],
      ['потенциальная энергия пружины',E.Eel,'Дж'],
      ['полная энергия',E.tot,'Дж'],
      ['колебаний пройдено',s.periods,'']];
  },
  graphs:[
    {label:'Смещение Δx во времени',unit:'м',series:['x'],get:s=>[s.q,null]},
    {label:'Скорость',unit:'м/с',series:['v'],get:s=>[s.v,null]},
    {label:'Энергия: кинетическая и упругая',unit:'Дж',series:['K','U'],
     get(s,p){ const E=SIMS.spring.energies(s,p); return [E.Ek,E.Eel]; }}
  ],
  presets:[
    {name:'Пружина m = 1 кг, k = 20 Н/м',values:{m:1,k:20,A:2,periods:0,tStop:0}},
    {name:'Жёстче пружина — чаще колебания',values:{m:1,k:100,A:2,tStop:0}},
    {name:'Тяжелее груз — медленнее',values:{m:8,k:20,A:2,tStop:0}},
    {name:'Малая амплитуда — период тот же',values:{m:1,k:20,A:0.5,tStop:0}},
    {name:'Затухающие колебания',values:{m:1,k:20,A:2,damp:true,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const spanX=Math.max(p.A*3.2,4.5), spanY=spanX*H/W;
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const wall=-Math.max(p.A*2,2.5), sz=0.28+0.06*Math.cbrt(p.m), yb=0.5;
    // стена и опора
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(wall,-1.4); ctx.lineTo(wall,1.5); ctx.moveTo(wall,0); ctx.lineTo(Math.max(p.A,s.q)+1.2,0); ctx.stroke();
    // штриховка стены
    ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
    for(let i=0;i<9;i++){ const y=-1.3+i*0.34;
      ctx.beginPath(); ctx.moveTo(wall,y); ctx.lineTo(wall-0.22,y+0.18); ctx.stroke(); }
    ctx.globalAlpha=1;
    // пружина: витки сжимаются и растягиваются вместе с грузом
    const coils=16, x2=s.q-sz;
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath(); ctx.moveTo(wall,yb);
    for(let i=0;i<=coils;i++) ctx.lineTo(wall+(x2-wall)*i/coils, yb+(i%2?0.24:-0.24));
    ctx.lineTo(x2,yb); ctx.stroke();
    // положение равновесия
    ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(0,-1.5); ctx.lineTo(0,1.4); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,'равновесие',0,1.4,-30,-2,ink3);
    // границы амплитуды
    if(p.ampl){
      ctx.strokeStyle=sec; ctx.globalAlpha=.5; ctx.setLineDash([v.lw(2),v.lw(4)]); ctx.lineWidth=v.lw(1);
      for(const sgn of [1,-1]){
        ctx.beginPath(); ctx.moveTo(sgn*p.A,-1.2); ctx.lineTo(sgn*p.A,1.2); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'−x₀',-p.A,1.2,-8,-4,sec);
      v.label(ctx,'+x₀',p.A,1.2,-8,-4,sec);
    }
    // груз
    ctx.fillStyle=acc; ctx.fillRect(s.q-sz,yb-sz,2*sz,2*sz);
    // ЛИНИЯ СМЕЩЕНИЯ Δx — от положения равновесия до груза
    if(p.dx){
      const yd=-1.05;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
      ctx.beginPath(); ctx.moveTo(0,yd); ctx.lineTo(s.q,yd); ctx.stroke();
      // засечки на концах
      ctx.beginPath(); ctx.moveTo(0,yd-0.14); ctx.lineTo(0,yd+0.14);
      ctx.moveTo(s.q,yd-0.14); ctx.lineTo(s.q,yd+0.14); ctx.stroke();
      if(Math.abs(s.q)>0.12) v.arrow(ctx,0,yd,s.q,yd,meas);
      v.label(ctx,`Δx = ${s.q.toFixed(2)} м`,s.q/2,yd,-24,-10,meas);
      // связь груза с отметкой
      ctx.strokeStyle=meas; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(s.q,yb-sz); ctx.lineTo(s.q,yd); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
    }
    // сила упругости
    if(p.force && Math.abs(s.q)>0.05){
      const F=-p.k*s.q, len=clamp(Math.abs(F)*0.02,0.2,1.8);
      v.arrow(ctx,s.q,yb,s.q+Math.sign(F)*len,yb,dang);
      v.label(ctx,`F = −kx = ${F.toFixed(1)} Н`,s.q+Math.sign(F)*len,yb,Math.sign(F)>0?6:-90,-8,dang);
    }
    v.label(ctx,`T = 2π√(m/k) = ${this.T(p).toFixed(2)} с`,wall,1.5,10,0,ink3);
    v.label(ctx,'период не зависит от амплитуды',wall,1.5,10,16,ink3);
  }
},

/* ================= КОЛЕБАНИЯ: МАТЕМАТИЧЕСКИЙ МАЯТНИК ================= */
pendulum:{
  title:'Математический маятник',
  params:[
    {key:'L',  label:'Длина нити L',unit:'м',min:0.2,max:20,step:0.1,default:1},
    {key:'th0',label:'Начальный угол θ₀',unit:'°',min:1,max:80,step:1,default:20},
    {key:'m',  label:'Масса груза m',unit:'кг',min:0.1,max:20,step:0.1,default:1},
    {key:'g',  label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},

    {type:'group',label:'Показывать'},
    {key:'arc',  label:'Дуга угла и траектория',type:'check',default:true},
    {key:'forces',label:'Возвращающая сила',type:'check',default:true},
    {key:'exact',label:'Точное уравнение (не малые углы)',type:'check',default:true},
    {key:'damp', label:'Затухание',type:'check',default:false},

    {type:'group',label:'Остановка таймера'},
    {key:'periods',label:'Через N полных колебаний (0 — выкл)',min:0,max:50,step:0.5,default:0},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  /* малые колебания: T = 2π√(L/g) */
  w(p){ return Math.sqrt(p.g/p.L); },
  T(p){ return 2*Math.PI*Math.sqrt(p.L/p.g); },
  /* поправка на конечную амплитуду (первый член ряда) */
  Texact(p){ const a=p.th0*Math.PI/180; return this.T(p)*(1+a*a/16); },
  init(p){ return {t:0,q:p.th0*Math.PI/180,v:0,periods:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt, w=this.w(p);
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    const g=p.damp?0.06:0;
    // точное уравнение маятника: θ'' = −(g/L)·sinθ; приближённое: θ'' = −(g/L)·θ
    const acc=(q,vv)=>-w*w*(p.exact?Math.sin(q):q) - g*vv;
    const a1=acc(s.q,s.v);
    s.q+=s.v*dt+0.5*a1*dt*dt;
    const a2=acc(s.q,s.v+a1*dt);
    s.v+=0.5*(a1+a2)*dt;
    s.t=t; s.periods=s.t/this.T(p);
    if(p.periods>0 && s.periods>=p.periods){
      s.event={t:s.t,type:'periods'};
      s.__stop=`Пройдено ${p.periods} колебан. : t = ${s.t.toFixed(2)} с (период T = ${this.T(p).toFixed(3)} с)`;
    }
  },
  pos(s,p){ return {x:p.L*Math.sin(s.q), y:-p.L*Math.cos(s.q)}; },
  anchors(s,p){ const c=this.pos(s,p); return [{x:0,y:0},{x:c.x,y:c.y}]; },
  energies(s,p){
    const I=p.m*p.L*p.L, Ek=0.5*I*s.v*s.v, Ep=p.m*p.g*p.L*(1-Math.cos(s.q));
    return {Ek,Ep,Eel:0,Eth:0,tot:Ek+Ep};
  },
  readouts(s,p){
    const E=this.energies(s,p);
    return [['t',s.t,'с'],
      ['период T = 2π√(L/g)',this.T(p),'с'],
      ['с поправкой на амплитуду',this.Texact(p),'с'],
      ['частота ν',1/this.T(p),'Гц'],
      ['угол θ',s.q*180/Math.PI,'°'],
      ['угловая скорость',s.v,'рад/с'],
      ['скорость груза',Math.abs(s.v)*p.L,'м/с'],
      ['высота подъёма',p.L*(1-Math.cos(s.q)),'м'],
      ['кинетическая энергия',E.Ek,'Дж'],
      ['потенциальная энергия',E.Ep,'Дж'],
      ['полная энергия',E.tot,'Дж'],
      ['колебаний пройдено',s.periods,''],
      ['период не зависит от массы',1,'проверьте, меняя m']];
  },
  graphs:[
    {label:'Угол во времени',unit:'°',series:['θ'],get:s=>[s.q*180/Math.PI,null]},
    {label:'Угловая скорость',unit:'рад/с',series:['ω'],get:s=>[s.v,null]},
    {label:'Энергия: кинетическая и потенциальная',unit:'Дж',series:['K','U'],
     get(s,p){ const E=SIMS.pendulum.energies(s,p); return [E.Ek,E.Ep]; }}
  ],
  presets:[
    {name:'Маятник L = 1 м (T ≈ 2 с)',values:{L:1,th0:20,m:1,g:9.8,tStop:0}},
    {name:'Длиннее нить — медленнее',values:{L:4,th0:20,m:1,g:9.8,tStop:0}},
    {name:'Другая масса — период тот же',values:{L:1,th0:20,m:10,g:9.8,tStop:0}},
    {name:'Часы: период ровно 2 с',values:{L:0.994,th0:10,m:1,g:9.8,tStop:0}},
    {name:'Большой угол — формула уже врёт',values:{L:1,th0:70,m:1,g:9.8,exact:true,tStop:0}},
    {name:'Маятник на Луне',values:{L:1,th0:20,m:1,g:1.62,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const spanX=p.L*2.6, spanY=p.L*2.3;
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:0,y:-p.L*0.5,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const c=this.pos(s,p), L=p.L;
    // потолок
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.moveTo(-L*0.5,0); ctx.lineTo(L*0.5,0); ctx.stroke();
    ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
    for(let i=0;i<7;i++){ const x=-L*0.45+i*L*0.15;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x-L*0.06,L*0.08); ctx.stroke(); }
    ctx.globalAlpha=1;
    // вертикаль равновесия
    ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-L*1.15); ctx.stroke(); ctx.setLineDash([]);
    // траектория
    if(p.arc){
      const a0=p.th0*Math.PI/180;
      ctx.strokeStyle=sec; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.arc(0,0,L,-Math.PI/2-a0,-Math.PI/2+a0); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
    }
    // нить и груз
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.8);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(c.x,c.y); ctx.stroke();
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(0,0,v.lw(3),0,7); ctx.fill();
    const R=v.lw(8)+p.m*0.2;
    ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(c.x,c.y,Math.max(v.lw(8),L*0.09),0,7); ctx.fill();
    v.label(ctx,`m = ${p.m} кг`,c.x,c.y,12,0,acc);
    // дуга угла
    if(p.arc){
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.arc(0,0,L*0.32,-Math.PI/2,-Math.PI/2+s.q,s.q<0); ctx.stroke();
      v.label(ctx,`θ = ${(s.q*180/Math.PI).toFixed(1)}°`,0,-L*0.38,12,0,sec);
    }
    // возвращающая сила: составляющая тяжести вдоль дуги
    if(p.forces && Math.abs(s.q)>0.02){
      const F=-p.m*p.g*Math.sin(s.q);
      const tx=Math.cos(s.q), ty=Math.sin(s.q);      // касательная к траектории
      const len=clamp(Math.abs(F)*0.05,0.15,L*0.5);
      v.arrow(ctx,c.x,c.y,c.x+Math.sign(F)*tx*len,c.y+Math.sign(F)*ty*len,dang);
      v.label(ctx,`mg·sinθ = ${Math.abs(F).toFixed(2)} Н`,c.x,c.y,-40,L*0.14*20+14,dang);
      // сила тяжести
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.lineTo(c.x,c.y-L*0.3); ctx.stroke(); ctx.globalAlpha=1;
    }
    v.label(ctx,`T = 2π√(L/g) = ${this.T(p).toFixed(2)} с`,0,-L*1.2,-52,0,ink3);
    if(p.th0>25) v.label(ctx,`при θ₀ = ${p.th0}° точный период уже ${this.Texact(p).toFixed(2)} с`,0,-L*1.2,-70,16,dang);
    else v.label(ctx,'период не зависит ни от массы, ни от амплитуды',0,-L*1.2,-90,16,ink3);
  }
},

/* ================= КОЛЕБАНИЯ: ФИЗИЧЕСКИЙ МАЯТНИК ================= */
physpend:{
  title:'Физический маятник (стержень)',
  params:[
    {key:'Lr', label:'Длина стержня',unit:'м',min:0.2,max:10,step:0.1,default:2},
    {key:'mr', label:'Масса стержня',unit:'кг',min:0.1,max:20,step:0.1,default:1},
    {key:'thR',label:'Начальный угол',unit:'°',min:1,max:80,step:1,default:25},
    {key:'g',  label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},

    {type:'group',label:'Показывать'},
    {key:'cm',   label:'Центр масс',type:'check',default:true},
    {key:'compare',label:'Сравнить с нитяным маятником',type:'check',default:true},
    {key:'exact',label:'Точное уравнение',type:'check',default:true},
    {key:'damp', label:'Затухание',type:'check',default:false},

    {type:'group',label:'Остановка таймера'},
    {key:'periods',label:'Через N полных колебаний (0 — выкл)',min:0,max:50,step:0.5,default:0},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  /* стержень, подвешенный за конец: I = mL²/3, расстояние до центра масс d = L/2.
     ω = √(mgd/I) = √(3g/2L), T = 2π√(2L/3g) */
  I(p){ return p.mr*p.Lr*p.Lr/3; },
  d(p){ return p.Lr/2; },
  w(p){ return Math.sqrt(3*p.g/(2*p.Lr)); },
  T(p){ return 2*Math.PI/this.w(p); },
  /* приведённая длина: нитяной маятник с таким же периодом */
  Lred(p){ return 2*p.Lr/3; },
  init(p){ return {t:0,q:p.thR*Math.PI/180,v:0,periods:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt, w=this.w(p);
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    const g=p.damp?0.06:0;
    const acc=(q,vv)=>-w*w*(p.exact?Math.sin(q):q) - g*vv;
    const a1=acc(s.q,s.v);
    s.q+=s.v*dt+0.5*a1*dt*dt;
    const a2=acc(s.q,s.v+a1*dt);
    s.v+=0.5*(a1+a2)*dt;
    s.t=t; s.periods=s.t/this.T(p);
    if(p.periods>0 && s.periods>=p.periods){
      s.event={t:s.t,type:'periods'};
      s.__stop=`Пройдено ${p.periods} колебан. : t = ${s.t.toFixed(2)} с (период T = ${this.T(p).toFixed(3)} с)`;
    }
  },
  pos(s,p){ return {x:this.d(p)*Math.sin(s.q), y:-this.d(p)*Math.cos(s.q)}; },
  anchors(s,p){ const c=this.pos(s,p); return [{x:0,y:0},{x:c.x,y:c.y}]; },
  energies(s,p){
    const Ek=0.5*this.I(p)*s.v*s.v, Ep=p.mr*p.g*this.d(p)*(1-Math.cos(s.q));
    return {Ek,Ep,Eel:0,Eth:0,tot:Ek+Ep};
  },
  readouts(s,p){
    const E=this.energies(s,p);
    return [['t',s.t,'с'],
      ['период T = 2π√(I/mgd)',this.T(p),'с'],
      ['момент инерции I = mL²/3',this.I(p),'кг·м²'],
      ['до центра масс d = L/2',this.d(p),'м'],
      ['приведённая длина 2L/3',this.Lred(p),'м'],
      ['период нитяного той же длины',2*Math.PI*Math.sqrt(p.Lr/p.g),'с'],
      ['угол θ',s.q*180/Math.PI,'°'],
      ['угловая скорость',s.v,'рад/с'],
      ['кинетическая энергия',E.Ek,'Дж'],
      ['потенциальная энергия',E.Ep,'Дж'],
      ['полная энергия',E.tot,'Дж'],
      ['колебаний пройдено',s.periods,'']];
  },
  graphs:[
    {label:'Угол во времени',unit:'°',series:['θ'],get:s=>[s.q*180/Math.PI,null]},
    {label:'Угловая скорость',unit:'рад/с',series:['ω'],get:s=>[s.v,null]},
    {label:'Энергия: кинетическая и потенциальная',unit:'Дж',series:['K','U'],
     get(s,p){ const E=SIMS.physpend.energies(s,p); return [E.Ek,E.Ep]; }}
  ],
  presets:[
    {name:'Стержень 2 м',values:{Lr:2,mr:1,thR:25,g:9.8,tStop:0}},
    {name:'Короткий стержень — чаще колебания',values:{Lr:0.6,mr:1,thR:25,g:9.8,tStop:0}},
    {name:'Другая масса — период тот же',values:{Lr:2,mr:12,thR:25,g:9.8,tStop:0}},
    {name:'Сравнение с нитяным маятником',values:{Lr:3,mr:1,thR:20,compare:true,g:9.8,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const spanX=p.Lr*2.4, spanY=p.Lr*2.1;
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:0,y:-p.Lr*0.45,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const L=p.Lr, c=this.pos(s,p);
    const ex=L*Math.sin(s.q), ey=-L*Math.cos(s.q);
    // потолок
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.moveTo(-L*0.4,0); ctx.lineTo(L*0.4,0); ctx.stroke();
    ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
    for(let i=0;i<6;i++){ const x=-L*0.36+i*L*0.14;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x-L*0.05,L*0.07); ctx.stroke(); }
    ctx.globalAlpha=1;
    // вертикаль
    ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-L*1.1); ctx.stroke(); ctx.setLineDash([]);
    // сравнение: нитяной маятник приведённой длины качается в такт
    if(p.compare){
      const Lr2=this.Lred(p);
      ctx.strokeStyle=sec; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.lineTo(Lr2*Math.sin(s.q),-Lr2*Math.cos(s.q)); ctx.stroke();
      ctx.fillStyle=sec; ctx.beginPath();
      ctx.arc(Lr2*Math.sin(s.q),-Lr2*Math.cos(s.q),v.lw(5),0,7); ctx.fill();
      ctx.globalAlpha=1;
      v.label(ctx,`нитяной маятник длиной 2L/3 = ${Lr2.toFixed(2)} м`,
        Lr2*Math.sin(s.q),-Lr2*Math.cos(s.q),12,0,sec);
      v.label(ctx,'качается совершенно в такт',Lr2*Math.sin(s.q),-Lr2*Math.cos(s.q),12,16,ink3);
    }
    // стержень
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(6); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ex,ey); ctx.stroke(); ctx.lineCap='butt';
    // ось
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(0,0,v.lw(4),0,7); ctx.fill();
    v.label(ctx,'ось',0,0,-22,-6,ink3);
    // центр масс
    if(p.cm){
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(c.x,c.y,v.lw(5),0,7); ctx.fill();
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.arc(c.x,c.y,v.lw(8),0,7); ctx.stroke();
      v.label(ctx,'центр масс (L/2)',c.x,c.y,12,0,meas);
      // плечо силы тяжести
      ctx.strokeStyle=dang; ctx.globalAlpha=.6; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.lineTo(c.x,c.y-L*0.25); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.arrow(ctx,c.x,c.y,c.x,c.y-L*0.22,dang);
      v.label(ctx,'mg',c.x,c.y-L*0.22,6,0,dang);
    }
    // дуга угла
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.arc(0,0,L*0.28,-Math.PI/2,-Math.PI/2+s.q,s.q<0); ctx.stroke();
    v.label(ctx,`θ = ${(s.q*180/Math.PI).toFixed(1)}°`,0,-L*0.34,12,0,sec);
    v.label(ctx,`T = 2π√(I/mgd) = ${this.T(p).toFixed(2)} с`,0,-L*1.15,-56,0,ink3);
    v.label(ctx,`нитяной той же длины дал бы ${(2*Math.PI*Math.sqrt(L/p.g)).toFixed(2)} с — стержень быстрее`,
      0,-L*1.15,-116,16,ink3);
  }
}
,
});
