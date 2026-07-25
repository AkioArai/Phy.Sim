'use strict';
Object.assign(SIMS,{
/* ================== ГЛ.20: БЕГУЩАЯ ВОЛНА ================= */
wave:{
  title:'Бегущая волна: λ, частота, скорость',
  params:[
    {key:'A',   label:'Амплитуда A',unit:'м',min:0.1,max:2,step:0.1,default:1},
    {key:'lam', label:'Длина волны λ',unit:'м',min:0.5,max:8,step:0.1,default:4},
    {key:'f',   label:'Частота f',unit:'Гц',min:0.1,max:3,step:0.05,default:0.5},
    {key:'dir', label:'Направление',type:'select',default:'right',
     options:[{v:'right',t:'Вправо →'},{v:'left',t:'Влево ←'}]},

    {type:'group',label:'Пробная частица среды'},
    {key:'px',label:'Положение частицы x',unit:'м',min:-9,max:9,step:0.1,default:0},

    {type:'group',label:'Показывать'},
    {key:'run',    label:'Волна бежит',type:'check',default:true},
    {key:'lamMark',label:'Отметка длины волны',type:'check',default:true},
    {key:'trail',  label:'След частицы (колебание)',type:'check',default:true}
  ],
  k(p){ return 2*Math.PI/p.lam; },
  omega(p){ return 2*Math.PI*p.f; },
  speed(p){ return p.lam*p.f; },                      // v = λf
  yAt(p,x,t){
    const sgn=p.dir==='right'?1:-1;
    return p.A*Math.sin(this.k(p)*x - sgn*this.omega(p)*t);
  },
  vyAt(p,x,t){                                        // скорость частицы (поперечная)
    const sgn=p.dir==='right'?1:-1;
    return -sgn*this.omega(p)*p.A*Math.cos(this.k(p)*x - sgn*this.omega(p)*t);
  },
  init(p){ return {t:0,trail:[],event:null,__stop:null}; },
  step(s,dt,p){
    if(p.run) s.t+=dt;
    if(p.trail){ s.trail.push(this.yAt(p,p.px,s.t)); if(s.trail.length>240) s.trail.shift(); }
  },
  dragPoints(p){ return [{x:p.px,y:0}]; },
  dragMove(p,idx,x,y){ p.px=clamp(Math.round(x*10)/10,-9,9); },
  anchors(s,p){ return [{x:p.px,y:this.yAt(p,p.px,s.t)}]; },
  readouts(s,p){
    return [['t',s.t,'с'],['длина волны λ',p.lam,'м'],['частота f',p.f,'Гц'],
      ['период T = 1/f',1/p.f,'с'],
      ['скорость v = λf',this.speed(p),'м/с'],
      ['волновое число k = 2π/λ',this.k(p),'1/м'],
      ['круговая частота ω = 2πf',this.omega(p),'рад/с'],
      ['проверка ω/k = v',this.omega(p)/this.k(p),'м/с'],
      ['смещение частицы y',this.yAt(p,p.px,s.t),'м'],
      ['скорость частицы',this.vyAt(p,p.px,s.t),'м/с']];
  },
  graphs:[
    {label:'Смещение частицы y(t)',unit:'м',series:['y'],get(s,p){ return [SIMS.wave.yAt(p,p.px,s.t),null]; }},
    {label:'Скорость частицы',unit:'м/с',series:['vy'],get(s,p){ return [SIMS.wave.vyAt(p,p.px,s.t),null]; }}
  ],
  presets:[
    {name:'Основная волна',values:{A:1,lam:4,f:0.5,dir:'right'}},
    {name:'Короче волна — та же частота, меньше скорость',values:{A:1,lam:2,f:0.5,dir:'right'}},
    {name:'Выше частота — быстрее волна',values:{A:1,lam:4,f:1.5,dir:'right'}},
    {name:'Волна влево',values:{A:1,lam:4,f:0.5,dir:'left'}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-60)/(20*PX_PER_M),(H-60)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    // ось
    ctx.strokeStyle=ink3; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(-9.5,0); ctx.lineTo(9.5,0); ctx.stroke(); ctx.globalAlpha=1;
    // сама волна
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.4); ctx.beginPath();
    for(let i=0;i<=400;i++){ const x=-9.5+i/400*19, y=this.yAt(p,x,s.t);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
    // частицы среды — показываем, что они колеблются на месте (поперечно)
    ctx.fillStyle=sec;
    for(let x=-9;x<=9;x+=1){ const y=this.yAt(p,x,s.t);
      ctx.beginPath(); ctx.arc(x,y,v.lw(2.2),0,7); ctx.fill(); }
    // отметка длины волны
    if(p.lamMark){
      const x0=-8;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.setLineDash([v.lw(4),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(x0,-p.A-0.6); ctx.lineTo(x0,p.A+0.6);
      ctx.moveTo(x0+p.lam,-p.A-0.6); ctx.lineTo(x0+p.lam,p.A+0.6); ctx.stroke(); ctx.setLineDash([]);
      v.arrow(ctx,x0,-p.A-0.4,x0+p.lam,-p.A-0.4,meas);
      v.label(ctx,`λ = ${p.lam} м`,x0+p.lam/2,-p.A-0.4,-20,18,meas);
    }
    // направление движения волны
    const sgn=p.dir==='right'?1:-1;
    v.arrow(ctx,sgn>0?6:-6,p.A+1.1,sgn>0?8:-8,p.A+1.1,dang);
    v.label(ctx,`v = λf = ${this.speed(p).toFixed(2)} м/с`,sgn>0?7:-7,p.A+1.1,-32,-12,dang);
    // пробная частица
    const yp=this.yAt(p,p.px,s.t);
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(p.px,yp,v.lw(4.5),0,7); ctx.fill();
    // вертикальная линия — частица движется только вверх-вниз
    ctx.strokeStyle=dang; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(3),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(p.px,-p.A-0.2); ctx.lineTo(p.px,p.A+0.2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
    // поперечная скорость частицы
    const vy=this.vyAt(p,p.px,s.t);
    if(Math.abs(vy)>0.05) v.arrow(ctx,p.px,yp,p.px,yp+clamp(vy*0.25,-1.2,1.2),meas);
    v.label(ctx,'частица среды',p.px,yp,10,-10,dang);
    // след колебаний частицы (осциллограмма справа)
    if(p.trail&&s.trail.length>2){
      ctx.strokeStyle=meas; ctx.globalAlpha=.7; ctx.lineWidth=v.lw(1.4); ctx.beginPath();
      s.trail.forEach((y,i)=>{ const x=9.6+ (i-s.trail.length)*0.012; i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
      ctx.stroke(); ctx.globalAlpha=1;
    }
    v.label(ctx,'частицы колеблются поперёк, а волна переносит энергию вдоль',0,-p.A-1.6,-108,0,ink3);
    v.label(ctx,'пробную частицу можно перетаскивать',0,-p.A-1.6,-64,16,ink3);
  }
},

/* ================= ГЛ.20: ЭЛЕКТРОМАГНИТНАЯ ВОЛНА ================= */
emwave:{
  title:'Электромагнитная волна: E, B и скорость света',
  params:[
    {key:'band',label:'Диапазон спектра',type:'select',default:'visible',
     options:[{v:'radio',  t:'Радиоволны (1 МГц)'},
              {v:'micro',  t:'СВЧ (10 ГГц)'},
              {v:'ir',     t:'Инфракрасное (30 ТГц)'},
              {v:'visible',t:'Видимый свет (600 ТГц)'},
              {v:'uv',     t:'Ультрафиолет (3·10¹⁵ Гц)'},
              {v:'xray',   t:'Рентген (3·10¹⁸ Гц)'}]},
    {key:'E0',  label:'Амплитуда поля E₀',unit:'В/м',min:1,max:100,step:1,default:20},
    {key:'lamV',label:'Длина волны на экране (масштаб)',unit:'усл.',min:1,max:8,step:0.1,default:4},

    {type:'group',label:'Наблюдение'},
    {key:'px',label:'Точка наблюдения x',unit:'усл.',min:-9,max:9,step:0.1,default:0},

    {type:'group',label:'Показывать'},
    {key:'run',  label:'Волна бежит',type:'check',default:true},
    {key:'Bfld', label:'Магнитное поле B',type:'check',default:true},
    {key:'poynt',label:'Направление переноса энергии',type:'check',default:true}
  ],
  eps0:8.854187817e-12, mu0:4*Math.PI*1e-7,
  /* c = 1/√(ε₀μ₀) — Максвелл получил скорость света из электрических измерений! */
  cLight(){ return 1/Math.sqrt(this.eps0*this.mu0); },
  freq(p){ return {radio:1e6,micro:1e10,ir:3e13,visible:6e14,uv:3e15,xray:3e18}[p.band]; },
  lambda(p){ return this.cLight()/this.freq(p); },
  Bamp(p){ return p.E0/this.cLight(); },              // B = E/c
  Eat(p,x,t){ return p.E0*Math.sin(2*Math.PI*(x/p.lamV) - 2*Math.PI*0.4*t); },
  Bat(p,x,t){ return this.Bamp(p)*Math.sin(2*Math.PI*(x/p.lamV) - 2*Math.PI*0.4*t); },
  intensity(p){ return 0.5*this.eps0*this.cLight()*p.E0*p.E0; },   // средняя интенсивность
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ if(p.run) s.t+=dt; },
  dragPoints(p){ return [{x:p.px,y:0}]; },
  dragMove(p,idx,x,y){ p.px=clamp(Math.round(x*10)/10,-9,9); },
  anchors(s,p){ return [{x:p.px,y:0}]; },
  readouts(s,p){
    const c=this.cLight(), f=this.freq(p), lam=this.lambda(p);
    const E=this.Eat(p,p.px,s.t), B=this.Bat(p,p.px,s.t);
    const name={radio:'радиоволны',micro:'СВЧ',ir:'инфракрасное',visible:'видимый свет',uv:'ультрафиолет',xray:'рентген'}[p.band];
    return [['t',s.t,'с'],['диапазон',0,name],
      ['частота f',f,'Гц'],['длина волны λ = c/f',lam,'м'],
      ['скорость c = 1/√(ε₀μ₀)',c,'м/с'],
      ['амплитуда E₀',p.E0,'В/м'],
      ['амплитуда B₀ = E₀/c',this.Bamp(p),'Тл'],
      ['E в точке наблюдения',E,'В/м'],
      ['B в точке наблюдения',B,'Тл'],
      ['проверка E/B = c',Math.abs(B)>1e-14?E/B:c,'м/с'],
      ['интенсивность ½ε₀cE₀²',this.intensity(p),'Вт/м²']];
  },
  graphs:[
    {label:'Электрическое поле E',unit:'В/м',series:['E'],get(s,p){ return [SIMS.emwave.Eat(p,p.px,s.t),null]; }},
    {label:'Магнитное поле B',unit:'Тл',series:['B'],get(s,p){ return [SIMS.emwave.Bat(p,p.px,s.t),null]; }}
  ],
  presets:[
    {name:'Видимый свет',values:{band:'visible',E0:20,lamV:4}},
    {name:'Радиоволна: λ сотни метров',values:{band:'radio',E0:20,lamV:6}},
    {name:'Рентген: λ меньше атома',values:{band:'xray',E0:20,lamV:2}},
    {name:'Сильное поле — больше интенсивность',values:{band:'visible',E0:80,lamV:4}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-60)/(20*PX_PER_M),(H-60)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    const sc=2.6/Math.max(p.E0,1);                    // масштаб поля на экране
    // ось распространения
    ctx.strokeStyle=ink3; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(-9.5,0); ctx.lineTo(9.5,0); ctx.stroke(); ctx.globalAlpha=1;
    v.label(ctx,'направление распространения',8,0,-70,14,ink3);
    // электрическое поле — вертикальная синусоида
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
    for(let i=0;i<=400;i++){ const x=-9.5+i/400*19, y=this.Eat(p,x,s.t)*sc;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
    // векторы E
    for(let x=-9;x<=9;x+=0.8){ const y=this.Eat(p,x,s.t)*sc;
      if(Math.abs(y)>0.05){ ctx.globalAlpha=.55; v.arrow(ctx,x,0,x,y,dang); ctx.globalAlpha=1; } }
    v.label(ctx,'E (электрическое поле)',-9,2.8,0,0,dang);
    // магнитное поле — перпендикулярно, показываем «в перспективе» наклонной синусоидой
    if(p.Bfld){
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2); ctx.beginPath();
      for(let i=0;i<=400;i++){ const x=-9.5+i/400*19, b=this.Bat(p,x,s.t)/this.Bamp(p);
        const yy=b*1.1*0.5, xx=x+b*1.1*0.55;          // косой ракурс: B перпендикулярно E и оси
        i?ctx.lineTo(xx,yy-0.02):ctx.moveTo(xx,yy-0.02); }
      ctx.stroke();
      for(let x=-9;x<=9;x+=1.2){ const b=this.Bat(p,x,s.t)/this.Bamp(p);
        if(Math.abs(b)>0.06){ ctx.globalAlpha=.5;
          v.arrow(ctx,x,0,x+b*1.1*0.55,b*1.1*0.5,sec); ctx.globalAlpha=1; } }
      v.label(ctx,'B (магнитное поле, перпендикулярно E)',-9,-2.6,0,0,sec);
    }
    // перенос энергии
    if(p.poynt){
      v.arrow(ctx,6.4,3.2,8.6,3.2,meas);
      v.label(ctx,'перенос энергии',7.5,3.2,-40,-12,meas);
    }
    // точка наблюдения
    const E=this.Eat(p,p.px,s.t);
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.arc(p.px,0,0.2,0,7); ctx.stroke();
    ctx.strokeStyle=meas; ctx.globalAlpha=.4; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(p.px,-2.8); ctx.lineTo(p.px,2.8); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
    v.label(ctx,`E = ${E.toFixed(1)} В/м`,p.px,E*sc,8,-10,meas);
    // сводка
    const c=this.cLight(), lam=this.lambda(p), f=this.freq(p);
    const fs = f>=1e12?`${(f/1e12).toPrecision(3)} ТГц`:(f>=1e9?`${(f/1e9).toPrecision(3)} ГГц`:`${(f/1e6).toPrecision(3)} МГц`);
    const ls = lam>=1?`${lam.toPrecision(3)} м`:(lam>=1e-6?`${(lam*1e6).toPrecision(3)} мкм`:`${(lam*1e9).toPrecision(3)} нм`);
    v.label(ctx,`f = ${fs},   λ = c/f = ${ls}`,0,-3.4,-56,0,ink3);
    v.label(ctx,`c = 1/√(ε₀μ₀) = ${(c/1e8).toFixed(4)}·10⁸ м/с,   E/B = c`,0,-3.4,-84,16,ink3);
    v.label(ctx,'E, B и направление движения взаимно перпендикулярны',0,-3.4,-100,32,ink3);
  }
},

/* ================= ГЛ.20: ПЕРЕНОС ЭНЕРГИИ И ИНТЕНСИВНОСТЬ ================= */
intensity:{
  title:'Перенос энергии волной: интенсивность',
  params:[
    {key:'P',label:'Мощность источника P',unit:'Вт',min:1,max:500,step:1,default:100},
    {key:'dx',label:'Детектор: расстояние x',unit:'м',min:0.5,max:9,step:0.1,default:3},
    {key:'dy',label:'Детектор: смещение y',unit:'м',min:-5,max:5,step:0.1,default:0},

    {type:'group',label:'Второй источник (для сравнения)'},
    {key:'two',label:'Показать второй источник',type:'check',default:false},
    {key:'P2', label:'Мощность второго P₂',unit:'Вт',min:1,max:500,step:1,default:100},
    {key:'sx', label:'Его положение x',unit:'м',min:-9,max:9,step:0.1,default:-5},

    {type:'group',label:'Показывать'},
    {key:'rings',label:'Фронты волн',type:'check',default:true},
    {key:'grid', label:'Линии равной интенсивности',type:'check',default:true}
  ],
  /* интенсивность точечного источника: I = P/(4πr²) — закон обратных квадратов */
  Iof(P,r){ return P/(4*Math.PI*Math.max(r,0.05)*Math.max(r,0.05)); },
  total(p){
    const r1=Math.hypot(p.dx,p.dy), I1=this.Iof(p.P,r1);
    if(!p.two) return {I:I1,r1,I1,r2:null,I2:0};
    const r2=Math.hypot(p.dx-p.sx,p.dy), I2=this.Iof(p.P2,r2);
    return {I:I1+I2,r1,I1,r2,I2};
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  dragPoints(p){ return [{x:p.dx,y:p.dy}]; },
  dragMove(p,idx,x,y){ p.dx=clamp(Math.round(x*10)/10,0.5,9); p.dy=clamp(Math.round(y*10)/10,-5,5); },
  anchors(s,p){ return [{x:0,y:0},{x:p.dx,y:p.dy}]; },
  readouts(s,p){
    const c=this.total(p);
    const out=[['t',s.t,'с'],['мощность источника P',p.P,'Вт'],
      ['расстояние до детектора r',c.r1,'м'],
      ['интенсивность I = P/4πr²',c.I1,'Вт/м²'],
      ['при удвоении r станет',this.Iof(p.P,c.r1*2),'Вт/м² (вчетверо меньше)']];
    if(p.two) out.push(['от второго источника',c.I2,'Вт/м²'],['суммарная интенсивность',c.I,'Вт/м²']);
    return out;
  },
  graphs:[
    {label:'Интенсивность на детекторе',unit:'Вт/м²',series:['I'],get(s,p){ return [SIMS.intensity.total(p).I,null]; }},
    {label:'Расстояние до источника',unit:'м',series:['r'],get(s,p){ return [Math.hypot(p.dx,p.dy),null]; }}
  ],
  presets:[
    {name:'Точечный источник',values:{P:100,dx:3,dy:0,two:false}},
    {name:'Вдвое дальше — вчетверо слабее',values:{P:100,dx:6,dy:0,two:false}},
    {name:'Два источника',values:{P:100,dx:3,dy:0,two:true,P2:100,sx:-5}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-60)/(20*PX_PER_M),(H-60)/(11*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    const c=this.total(p);
    // фронты волн от источника
    if(p.rings){
      ctx.strokeStyle=acc; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1.2);
      for(let k=0;k<7;k++){ const r=((s.t*1.2+k*0.9)%6.3);
        ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.stroke(); }
      if(p.two){ ctx.strokeStyle=sec;
        for(let k=0;k<7;k++){ const r=((s.t*1.2+k*0.9)%6.3);
          ctx.beginPath(); ctx.arc(p.sx,0,r,0,7); ctx.stroke(); } }
      ctx.globalAlpha=1;
    }
    // линии равной интенсивности
    if(p.grid){
      ctx.strokeStyle=ink3; ctx.globalAlpha=.25; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(4)]);
      for(const r of [1,2,4,8]){ ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.stroke();
        v.label(ctx,`I/${r*r}`,r,0,-8,-8,ink3); }
      ctx.setLineDash([]); ctx.globalAlpha=1;
    }
    // источник
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(0,0,0.28,0,7); ctx.fill();
    v.label(ctx,`источник P = ${p.P} Вт`,0,0,-30,-18,dang);
    if(p.two){ ctx.fillStyle=sec; ctx.beginPath(); ctx.arc(p.sx,0,0.24,0,7); ctx.fill();
      v.label(ctx,`P₂ = ${p.P2} Вт`,p.sx,0,-24,-16,sec); }
    // луч до детектора
    ctx.strokeStyle=meas; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1.4); ctx.setLineDash([v.lw(4),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(p.dx,p.dy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
    // детектор
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2.4);
    ctx.strokeRect(p.dx-0.3,p.dy-0.3,0.6,0.6);
    v.label(ctx,'детектор',p.dx,p.dy,10,-12,meas);
    v.label(ctx,`r = ${c.r1.toFixed(2)} м`,p.dx,p.dy,10,4,meas);
    v.label(ctx,`I = ${c.I.toFixed(3)} Вт/м²`,p.dx,p.dy,10,20,meas);
    // вектор переноса энергии
    const ux=p.dx/(c.r1||1), uy=p.dy/(c.r1||1);
    v.arrow(ctx,p.dx-ux*0.9,p.dy-uy*0.9,p.dx-ux*0.35,p.dy-uy*0.35,dang);
    // сводка
    v.label(ctx,`I = P/4πr² — закон обратных квадратов`,0,-5.4,-70,0,ink3);
    v.label(ctx,'детектор можно перетаскивать: удалите вдвое — интенсивность упадёт вчетверо',0,-5.4,-140,16,ink3);
  }
}
,

/* ================== ГЛ.20: ТОК СМЕЩЕНИЯ И УРАВНЕНИЯ МАКСВЕЛЛА ================= */
displacement:{
  title:'Ток смещения: поправка Максвелла',
  params:[
    {key:'I',label:'Ток зарядки конденсатора I',unit:'мА',min:0.5,max:50,step:0.5,default:10},
    {key:'Rp',label:'Радиус пластин R',unit:'м',min:0.5,max:3,step:0.1,default:1.5},
    {key:'gap',label:'Зазор между пластинами',unit:'м',min:0.3,max:2,step:0.1,default:1},

    {type:'group',label:'Контур Ампера'},
    {key:'where',label:'Где взят контур',type:'select',default:'plates',
     options:[{v:'wire',  t:'Вокруг провода (обычный ток)'},
              {v:'plates',t:'Между пластинами (ток смещения)'}]},
    {key:'r',label:'Радиус контура r',unit:'м',min:0.2,max:3,step:0.1,default:1},

    {type:'group',label:'Показывать'},
    {key:'efield',label:'Поле E между пластинами',type:'check',default:true},
    {key:'bfield',label:'Магнитное поле контура',type:'check',default:true}
  ],
  mu0:4*Math.PI*1e-7, eps0:8.854e-12,
  /* Ток смещения: I_см = ε₀·dΦ_E/dt. Для конденсатора он В ТОЧНОСТИ равен току
     проводимости I: Φ_E = Q/ε₀ ⇒ ε₀·dΦ_E/dt = dQ/dt = I. */
  Idisp(p){ return p.I*1e-3; },
  /* поле между пластинами: E = σ/ε₀ = Q/(ε₀·S). Скорость его роста: dE/dt = I/(ε₀·S) */
  dEdt(p){ const S=Math.PI*p.Rp*p.Rp; return (p.I*1e-3)/(this.eps0*S); },
  /* магнитное поле на контуре радиуса r */
  Bat(p,r){
    const I=p.I*1e-3, R=p.Rp;
    if(p.where==='wire') return this.mu0*I/(2*Math.PI*Math.max(r,0.05));
    // между пластинами охвачена лишь часть тока смещения: I·(r²/R²)
    if(r<=R) return this.mu0*I*r/(2*Math.PI*R*R);
    return this.mu0*I/(2*Math.PI*r);
  },
  /* охваченный контуром ток (проводимости или смещения) */
  Ienc(p,r){
    const I=p.I*1e-3;
    if(p.where==='wire') return I;
    return r<=p.Rp ? I*(r*r)/(p.Rp*p.Rp) : I;
  },
  init(p){ return {t:0,Q:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.Q+=p.I*1e-3*dt; },
  dragPoints(p){ return [{x:p.where==='wire'?-3.4:0, y:p.r}]; },
  dragMove(p,idx,x,y){ p.r=clamp(Math.round(Math.abs(y)*10)/10,0.2,3); },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const Id=this.Idisp(p), B=this.Bat(p,p.r), S=Math.PI*p.Rp*p.Rp;
    const E=s.Q/(this.eps0*S);
    return [['t',s.t,'с'],['ток проводимости I',p.I,'мА'],
      ['ток смещения ε₀·dΦ/dt',Id*1e3,'мА'],
      ['совпадение токов',Math.abs(Id-p.I*1e-3)<1e-12?1:0,'✓ равны точно'],
      ['поле E между пластинами',E,'В/м'],
      ['скорость роста dE/dt',this.dEdt(p),'В/(м·с)'],
      ['радиус контура r',p.r,'м'],
      ['охваченный ток',this.Ienc(p,p.r)*1e3,'мА'],
      ['поле на контуре B',B*1e9,'нТл'],
      ['циркуляция ∮B·ds',B*2*Math.PI*p.r*1e9,'нТл·м'],
      ['μ₀·Iохв',this.mu0*this.Ienc(p,p.r)*1e9,'нТл·м']];
  },
  graphs:[
    {label:'Поле B на контуре',unit:'нТл',series:['B'],get(s,p){ return [SIMS.displacement.Bat(p,p.r)*1e9,null]; }},
    {label:'Поле E между пластинами',unit:'В/м',series:['E'],get(s,p){ return [s.Q/(SIMS.displacement.eps0*Math.PI*p.Rp*p.Rp),null]; }}
  ],
  presets:[
    {name:'Контур между пластинами',values:{where:'plates',I:10,Rp:1.5,r:1}},
    {name:'Контур вокруг провода — тот же B',values:{where:'wire',I:10,Rp:1.5,r:1}},
    {name:'Контур шире пластин',values:{where:'plates',I:10,Rp:1.5,r:2.4}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const g=p.gap/2, R=p.Rp;
    // провода и пластины
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(-4.6,0); ctx.lineTo(-g,0); ctx.moveTo(g,0); ctx.lineTo(4.6,0); ctx.stroke();
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(4);
    ctx.beginPath(); ctx.moveTo(-g,-R); ctx.lineTo(-g,R); ctx.moveTo(g,-R); ctx.lineTo(g,R); ctx.stroke();
    v.label(ctx,`пластины R = ${R} м`,0,R,-40,-14,dang);
    v.label(ctx,`I = ${p.I} мА`,-3.6,0,-16,-14,ink3);
    // поле E между пластинами (растёт)
    if(p.efield){
      for(let y=-R*0.75;y<=R*0.75;y+=R*0.5){ v.arrow(ctx,-g*0.8,y,g*0.8,y,sec); }
      v.label(ctx,'E растёт → есть ток смещения',0,-R,-70,22,sec);
    }
    // контур Ампера
    const cx=(p.where==='wire')?-3.4:0;
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2); ctx.setLineDash([v.lw(5),v.lw(4)]);
    ctx.beginPath(); ctx.moveTo(cx,-p.r); ctx.lineTo(cx,p.r); ctx.stroke();
    ctx.beginPath(); ctx.ellipse ? ctx.ellipse(cx,0,0.32,p.r,0,0,7) : ctx.arc(cx,0,p.r,0,7); ctx.stroke();
    ctx.setLineDash([]);
    v.label(ctx,`контур r = ${p.r} м`,cx,p.r,-30,-10,meas);
    // магнитное поле на контуре
    if(p.bfield){
      const B=this.Bat(p,p.r);
      v.outOfPlane(ctx,cx,p.r,true,meas,v.lw(6));
      v.outOfPlane(ctx,cx,-p.r,false,meas,v.lw(6));
      v.label(ctx,`B = ${(B*1e9).toFixed(2)} нТл`,cx,p.r,10,4,meas);
    }
    // подписи-выводы
    const Id=this.Idisp(p);
    v.label(ctx,`ток смещения ε₀·dΦ_E/dt = ${(Id*1e3).toFixed(2)} мА = ток провода`,0,-R,-116,40,acc);
    v.label(ctx,p.where==='plates'
      ? 'между пластинами провода нет, но поле B есть — его создаёт меняющееся поле E'
      : 'вокруг провода поле B создаёт обычный ток проводимости',0,-R,-142,56,ink3);
  }
},

/* ================= ГЛ.20: ЭЛЕКТРОМАГНИТНАЯ ВОЛНА ================= */
fourier:{
  title:'Разложение Фурье: любой сигнал — сумма синусоид',
  params:[
    {key:'shape',label:'Форма сигнала',type:'select',default:'square',
     options:[{v:'square',t:'Прямоугольный'},{v:'saw',t:'Пилообразный'},{v:'tri',t:'Треугольный'}]},
    {key:'N',label:'Сколько гармоник сложить',min:1,max:25,step:1,default:3},
    {key:'auto',label:'Сигнал бежит',type:'check',default:true},

    {type:'group',label:'Показывать'},
    {key:'target',label:'Точная форма (цель)',type:'check',default:true},
    {key:'parts', label:'Отдельные гармоники',type:'check',default:true}
  ],
  /* амплитуда n-й гармоники для разных форм (ряды Фурье) */
  coef(shape,n){
    if(shape==='square') return (n%2===1)? 4/(Math.PI*n) : 0;              // только нечётные
    if(shape==='saw')    return 2/(Math.PI*n)*((n%2===1)?1:-1);            // знакочередующийся
    return (n%2===1)? 8/(Math.PI*Math.PI*n*n)*((((n-1)/2)%2===0)?1:-1) : 0; // треугольный
  },
  /* частичная сумма N гармоник */
  sum(p,x,ph){
    let y=0;
    for(let n=1;n<=p.N;n++){ const a=this.coef(p.shape,n); if(a) y+=a*Math.sin(n*(x-ph)); }
    return y;
  },
  /* точная форма */
  exact(p,x,ph){
    const t=((x-ph)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
    if(p.shape==='square') return t<Math.PI?1:-1;
    if(p.shape==='saw')    return (t<Math.PI? t/Math.PI : t/Math.PI-2);
    return (2/Math.PI)*Math.asin(Math.sin(t));      // треугольный: пик при t=π/2, как у ряда
  },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; if(p.auto) s.ph+=dt*1.1; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    // среднеквадратичная ошибка приближения
    let err=0,cnt=0;
    for(let i=0;i<200;i++){ const x=i/200*2*Math.PI;
      const d=this.sum(p,x,0)-this.exact(p,x,0); err+=d*d; cnt++; }
    err=Math.sqrt(err/cnt);
    const out=[['t',s.t,'с'],['форма',0,{square:'прямоугольный',saw:'пилообразный',tri:'треугольный'}[p.shape]],
      ['число гармоник N',p.N,''],['ошибка приближения',err,'']];
    for(let n=1;n<=Math.min(p.N,5);n++){ const a=this.coef(p.shape,n);
      if(a) out.push([`амплитуда ${n}-й гармоники`,a,'']); }
    return out;
  },
  graphs:[
    {label:'Ошибка приближения',unit:'',series:['ошибка'],get(s,p){
      let e=0; for(let i=0;i<120;i++){ const x=i/120*2*Math.PI; const d=SIMS.fourier.sum(p,x,0)-SIMS.fourier.exact(p,x,0); e+=d*d; }
      return [Math.sqrt(e/120),null]; }}
  ],
  presets:[
    {name:'Прямоугольный: 1 гармоника',values:{shape:'square',N:1,auto:true}},
    {name:'Прямоугольный: 9 гармоник',values:{shape:'square',N:9,auto:true}},
    {name:'Прямоугольный: 25 гармоник',values:{shape:'square',N:25,auto:true}},
    {name:'Пилообразный сигнал',values:{shape:'saw',N:9,auto:true}},
    {name:'Треугольный — сходится быстро',values:{shape:'tri',N:5,auto:true}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(14*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink3=v.c('--ink-3');
    const X0=-6, X1=6, sx=(X1-X0)/(4*Math.PI), amp=1.6;
    // оси
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(X0,0); ctx.lineTo(X1,0); ctx.stroke(); ctx.globalAlpha=1;
    // отдельные гармоники
    if(p.parts){
      for(let n=1;n<=p.N;n++){
        const a=this.coef(p.shape,n); if(!a) continue;
        ctx.strokeStyle=sec; ctx.globalAlpha=.28; ctx.lineWidth=v.lw(1);
        ctx.beginPath();
        for(let i=0;i<=300;i++){ const x=X0+(X1-X0)*i/300, ang=(x-X0)/sx;
          const y=amp*a*Math.sin(n*(ang-s.ph));
          i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
        ctx.stroke(); ctx.globalAlpha=1;
      }
    }
    // точная форма
    if(p.target){
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.6); ctx.setLineDash([v.lw(5),v.lw(4)]);
      ctx.beginPath();
      for(let i=0;i<=600;i++){ const x=X0+(X1-X0)*i/600, ang=(x-X0)/sx;
        const y=amp*this.exact(p,ang,s.ph);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'точная форма сигнала',X0,amp,10,-12,ink3);
    }
    // сумма гармоник
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.4); ctx.beginPath();
    for(let i=0;i<=600;i++){ const x=X0+(X1-X0)*i/600, ang=(x-X0)/sx;
      const y=amp*this.sum(p,ang,s.ph);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
    v.label(ctx,`сумма ${p.N} гармоник`,X1,amp,-70,-12,dang);
    // спектр амплитуд снизу
    const bx=-5.4, by=-2.4, bw=10.8;
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+bw,by); ctx.stroke(); ctx.globalAlpha=1;
    const maxA=Math.max(...Array.from({length:25},(_,i)=>Math.abs(this.coef(p.shape,i+1))))||1;
    for(let n=1;n<=25;n++){
      const a=Math.abs(this.coef(p.shape,n)); if(a<1e-6) continue;
      const xx=bx+(n-0.5)*(bw/25), hh=1.2*a/maxA;
      ctx.fillStyle=(n<=p.N)?dang:ink3; ctx.globalAlpha=(n<=p.N)?1:.3;
      ctx.fillRect(xx-0.14,by,0.28,hh); ctx.globalAlpha=1;
    }
    v.label(ctx,'спектр: амплитуды гармоник (закрашены — учтённые)',bx,by,0,20,ink3);
    v.label(ctx,'любой периодический сигнал = сумма синусоид разных частот',0,3,-116,0,ink3);
  }
}
,

/* ================== ГЕОМЕТРИЧЕСКАЯ ОПТИКА: ТОНКАЯ ЛИНЗА ================= */
tir:{
  title:'Полное внутреннее отражение и световод',
  params:[
    {key:'mode',label:'Что смотрим',type:'select',default:'flat',
     options:[{v:'flat', t:'Плоская граница: рождение полного отражения'},
              {v:'fiber',t:'Световод: как свет ведётся по волокну'}]},
    {key:'mat1',label:'Плотная среда (откуда идёт свет)',type:'select',default:'glass',
     options:[{v:'water',t:'вода, n = 1,333'},{v:'glass',t:'стекло, n = 1,50'},
              {v:'core', t:'сердцевина волокна, n = 1,48'},{v:'diam',t:'алмаз, n = 2,42'}]},
    {key:'mat2',label:'Менее плотная среда (куда выходит)',type:'select',default:'air',
     options:[{v:'air',  t:'воздух, n = 1,00'},{v:'water',t:'вода, n = 1,333'},
              {v:'clad', t:'оболочка волокна, n = 1,46'}]},
    {key:'ang',label:'Угол падения θ₁ (от нормали)',unit:'°',min:0,max:89,step:0.5,default:30},

    {type:'group',label:'Световод'},
    {key:'angIn',label:'Угол входа в торец',unit:'°',min:0,max:60,step:0.5,default:8},
    {key:'len',  label:'Длина участка',unit:'усл. ед.',min:4,max:14,step:0.5,default:9},

    {type:'group',label:'Показывать'},
    {key:'crit', label:'Предельный угол',type:'check',default:true},
    {key:'weak', label:'Слабый отражённый луч до предела',type:'check',default:true}
  ],
  N:{water:1.333, glass:1.50, core:1.48, diam:2.42, air:1.00, clad:1.46},
  nameOf:{water:'вода', glass:'стекло', core:'сердцевина', diam:'алмаз', air:'воздух', clad:'оболочка'},
  n1(p){ return this.N[p.mat1]; },
  n2(p){ return this.N[p.mat2]; },
  /* Предельный угол существует, только если свет идёт из более плотной среды. */
  critical(p){ const a=this.n1(p), b=this.n2(p); return a>b? Math.asin(b/a)*180/Math.PI : null; },
  isTIR(p){ const c=this.critical(p); return c!==null && p.ang>=c-1e-9; },
  /* Угол преломления по Снеллиусу; null — если преломлённого луча нет. */
  refr(p){
    const sn=this.n1(p)*Math.sin(p.ang*Math.PI/180)/this.n2(p);
    return Math.abs(sn)<=1? Math.asin(sn)*180/Math.PI : null;
  },
  /* Числовая апертура: NA = √(n₁²−n₂²) — насколько широкий конус волокно принимает. */
  NA(p){ const a=this.n1(p), b=this.n2(p); return a>b? Math.sqrt(a*a-b*b) : 0; },
  acceptance(p){ const s=this.NA(p); return s>=1? 90 : Math.asin(s)*180/Math.PI; },
  /* Луч, вошедший в торец под углом angIn, идёт внутри под меньшим углом к оси. */
  inside(p){
    const s=Math.sin(p.angIn*Math.PI/180)/this.n1(p);
    return Math.abs(s)<=1? Math.asin(s)*180/Math.PI : null;
  },
  wallAngle(p){ const t=this.inside(p); return t===null? null : 90-t; },
  guided(p){
    const w=this.wallAngle(p), c=this.critical(p);
    return c!==null && w!==null && w>=c-1e-9;
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  readouts(s,p){
    const c=this.critical(p), out=[['t',s.t,'с'],
      ['n₁ (плотная)',this.n1(p),''],['n₂ (менее плотная)',this.n2(p),'']];
    out.push(['предельный угол θпр', c===null?NaN:c,
      c===null?'полного отражения нет: свет идёт в более плотную среду':'°']);
    if(p.mode==='flat'){
      out.push(['угол падения θ₁',p.ang,'°']);
      const r=this.refr(p);
      out.push(['угол преломления θ₂', r===null?NaN:r,
        r===null?'преломлённого луча нет — всё отразилось':'°']);
      out.push(['доля отражённого света', this.isTIR(p)?100:this.reflectPct(p), '%']);
      out.push(['режим',0, this.isTIR(p)?'ПОЛНОЕ внутреннее отражение':'обычное преломление']);
    } else {
      const t=this.inside(p), w=this.wallAngle(p);
      out.push(['угол входа в торец',p.angIn,'°']);
      out.push(['угол к оси внутри', t===null?NaN:t,'°']);
      out.push(['угол падения на стенку', w===null?NaN:w,'°']);
      out.push(['числовая апертура NA',this.NA(p),'']);
      out.push(['предельный угол входа', this.acceptance(p),'° — шире свет не удержится']);
      out.push(['режим',0, this.guided(p)?'свет ведётся по волокну':'свет уходит в оболочку']);
      out.push(['отражений на участке', this.bounces(p), '']);
    }
    return out;
  },
  /* Доля отражения по формулам Френеля (неполяризованный свет). */
  reflectPct(p){
    const th1=p.ang*Math.PI/180, n1=this.n1(p), n2=this.n2(p);
    const sn=n1*Math.sin(th1)/n2;
    if(Math.abs(sn)>1) return 100;
    const th2=Math.asin(sn);
    const c1=Math.cos(th1), c2=Math.cos(th2);
    const rs=(n1*c1-n2*c2)/(n1*c1+n2*c2);
    const rp=(n1*c2-n2*c1)/(n1*c2+n2*c1);
    return 100*(rs*rs+rp*rp)/2;
  },
  /* Полуширина сердцевины на схеме нарочно мала: у настоящего волокна
     сердцевина в тысячи раз тоньше длины, и отражений там миллионы.
     Углы при этом настоящие — условен только вид сбоку. */
  geom(p){ return {H:0.30, L:p.len}; },
  bounces(p){
    const t=this.inside(p);
    if(t===null||!this.guided(p)) return 0;
    const {H,L}=this.geom(p);
    const tan=Math.tan(t*Math.PI/180);
    return tan<1e-9? 0 : Math.floor(L*tan/(2*H));
  },
  presets:[
    {name:'Стекло → воздух: предел 41,8°',values:{mode:'flat',mat1:'glass',mat2:'air',ang:30}},
    {name:'За пределом: свет заперт',values:{mode:'flat',mat1:'glass',mat2:'air',ang:55}},
    {name:'Вода → воздух: предел 48,6°',values:{mode:'flat',mat1:'water',mat2:'air',ang:40}},
    {name:'Алмаз: предел всего 24,4° — оттого и блеск',values:{mode:'flat',mat1:'diam',mat2:'air',ang:30}},
    {name:'Волокно связи: узкий конус приёма',values:{mode:'fiber',mat1:'core',mat2:'clad',angIn:8,len:9}},
    {name:'Волокно: угол больше приёмного — свет теряется',values:{mode:'fiber',mat1:'core',mat2:'clad',angIn:20,len:9}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const spanX=p.mode==='fiber'? p.len+4 : 11, spanY=8;
    const scale=clamp(Math.min((W-50)/(spanX*PX_PER_M),(H-50)/(spanY*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  /* Дуга между двумя направлениями — строим по векторам, а не через ctx.arc:
     ось Y в сцене направлена вверх, и углы холста зеркалились бы. */
  arcBetween(ctx,v,ax,ay,bx,by,rad,col,txt,cx,cy){
    cx=cx||0; cy=cy||0;
    const na=Math.hypot(ax,ay)||1, nb=Math.hypot(bx,by)||1;
    ax/=na; ay/=na; bx/=nb; by/=nb;
    const sweep=Math.acos(clamp(ax*bx+ay*by,-1,1));
    const sgn=(ax*by-ay*bx)>=0?1:-1;
    ctx.strokeStyle=col; ctx.lineWidth=v.lw(1.5); ctx.globalAlpha=.9;
    ctx.beginPath();
    for(let i=0;i<=32;i++){
      const t=sweep*i/32*sgn, c=Math.cos(t), sn=Math.sin(t);
      ctx.lineTo? null : null;
      const x=cx+(ax*c-ay*sn)*rad, y=cy+(ax*sn+ay*c)*rad;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.stroke(); ctx.globalAlpha=1;
    if(txt){
      const tm=sweep/2*sgn, c=Math.cos(tm), sn=Math.sin(tm);
      v.label(ctx,txt,cx+(ax*c-ay*sn)*rad*1.24,cy+(ax*sn+ay*c)*rad*1.24,-16,4,col);
    }
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const c=this.critical(p);
    if(p.mode==='flat') this.drawFlat(ctx,s,v,p,{acc,meas,dang,sec,ink,ink3,c});
    else this.drawFiber(ctx,s,v,p,{acc,meas,dang,sec,ink,ink3,c});
  },
  drawFlat(ctx,s,v,p,C){
    const {acc,meas,dang,sec,ink,ink3,c}=C;
    const th=p.ang*Math.PI/180, S1=Math.sin(th), C1=Math.cos(th), L=4.2;
    /* Плотная среда СНИЗУ, менее плотная сверху: только так возможен полный
       внутренний отражённый луч. Свет идёт снизу слева к точке на границе. */
    ctx.fillStyle=sec; ctx.globalAlpha=.10; ctx.fillRect(-6,-4.2,12,4.2); ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.stroke();
    v.label(ctx,`${this.nameOf[p.mat1]}, n₁ = ${this.n1(p).toFixed(3)}`,-5.8,0,0,18,sec);
    v.label(ctx,`${this.nameOf[p.mat2]}, n₂ = ${this.n2(p).toFixed(3)}`,-5.8,0,0,-10,ink3);
    // нормаль
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.setLineDash([v.lw(4),v.lw(4)]); ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(0,-3.4); ctx.lineTo(0,3.4); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
    v.label(ctx,'нормаль',0,3.4,-22,-8,ink3);
    // предельный угол — опорный луч
    if(p.crit && c!==null){
      const cc=c*Math.PI/180;
      ctx.strokeStyle=meas; ctx.globalAlpha=.4; ctx.setLineDash([v.lw(3),v.lw(5)]); ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-L*Math.sin(cc),-L*Math.cos(cc)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,`θпр = ${c.toFixed(1)}°`,-L*0.62*Math.sin(cc),-L*0.62*Math.cos(cc),-30,16,meas);
    }
    // падающий луч (снизу слева к началу координат)
    const ix=-L*S1, iy=-L*C1;
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2); ctx.globalAlpha=.95;
    ctx.beginPath(); ctx.moveTo(ix,iy); ctx.lineTo(0,0); ctx.stroke(); ctx.globalAlpha=1;
    v.arrow(ctx,ix*0.55,iy*0.55,ix*0.32,iy*0.32,dang);
    v.label(ctx,`падающий, θ₁ = ${p.ang}°`,ix,iy,-20,-12,dang);
    this.arcBetween(ctx,v,0,-1,-S1,-C1,1.25,dang,`θ₁ = ${p.ang}°`);
    const tir=this.isTIR(p);
    // отражённый (всегда есть; до предела — слабый)
    const rPct=tir?100:this.reflectPct(p);
    if(tir || p.weak){
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(tir?2:1.3);
      ctx.globalAlpha=tir?0.95:clamp(0.25+rPct/100,0.25,0.9);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(L*S1,-L*C1); ctx.stroke(); ctx.globalAlpha=1;
      v.arrow(ctx,L*0.5*S1,-L*0.5*C1,L*0.72*S1,-L*0.72*C1,meas);
      v.label(ctx,tir?`отражено 100 %`:`отражено ${rPct.toFixed(1)} %`,
        L*S1,-L*C1,8,tir?-8:8,meas);
      this.arcBetween(ctx,v,0,-1,S1,-C1,1.6,meas,'',0,0);
    }
    // преломлённый — только пока угол меньше предельного
    const r=this.refr(p);
    if(r!==null){
      const rr=r*Math.PI/180, S2=Math.sin(rr), C2=Math.cos(rr);
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.9);
      ctx.globalAlpha=clamp(1-rPct/100,0.15,1);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(L*S2,L*C2); ctx.stroke(); ctx.globalAlpha=1;
      v.arrow(ctx,L*0.5*S2,L*0.5*C2,L*0.72*S2,L*0.72*C2,acc);
      v.label(ctx,`преломлённый, θ₂ = ${r.toFixed(1)}°`,L*S2,L*C2,8,-8,acc);
      this.arcBetween(ctx,v,0,1,S2,C2,1.25,acc,`θ₂ = ${r.toFixed(1)}°`);
    }
    // точка падения
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(0,0,v.lw(3),0,7); ctx.fill();
    // итог
    if(c===null){
      v.label(ctx,'свет идёт в более плотную среду — полного отражения быть не может',
        -5.8,-3.7,0,0,ink3);
    } else if(tir){
      v.label(ctx,`θ₁ = ${p.ang}° ≥ θпр = ${c.toFixed(1)}° — весь свет остаётся внутри`,-5.8,-3.7,0,0,meas);
      v.label(ctx,'преломлённого луча нет вовсе: это и есть полное внутреннее отражение',-5.8,-3.7,0,16,ink3);
    } else {
      v.label(ctx,`θ₁ = ${p.ang}° < θпр = ${c.toFixed(1)}° — свет делится на два луча`,-5.8,-3.7,0,0,ink3);
      v.label(ctx,`чем ближе к пределу, тем больше уходит в отражение (сейчас ${rPct.toFixed(1)} %)`,-5.8,-3.7,0,16,ink3);
    }
  },
  drawFiber(ctx,s,v,p,C){
    const {acc,meas,dang,sec,ink,ink3,c}=C;
    const {H,L}=this.geom(p), X0=-L/2;
    // оболочка и сердцевина
    ctx.fillStyle=sec; ctx.globalAlpha=.09;
    ctx.fillRect(X0,-H-0.40,L,2*(H+0.40)); ctx.globalAlpha=1;
    ctx.fillStyle=acc; ctx.globalAlpha=.07; ctx.fillRect(X0,-H,L,2*H); ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.8);
    ctx.beginPath(); ctx.moveTo(X0,H); ctx.lineTo(X0+L,H);
    ctx.moveTo(X0,-H); ctx.lineTo(X0+L,-H); ctx.stroke();
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1.2);
    ctx.beginPath(); ctx.moveTo(X0,H+0.40); ctx.lineTo(X0+L,H+0.40);
    ctx.moveTo(X0,-H-0.40); ctx.lineTo(X0+L,-H-0.40); ctx.stroke(); ctx.globalAlpha=1;
    v.label(ctx,`сердцевина n₁ = ${this.n1(p).toFixed(2)}`,X0+0.15,0,0,-4,acc);
    v.label(ctx,`оболочка n₂ = ${this.n2(p).toFixed(2)}`,X0+0.15,H+0.40,0,-8,ink3);
    // ось
    ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(X0,0); ctx.lineTo(X0+L,0); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;

    const tIn=this.inside(p), ok=this.guided(p);
    // входной луч снаружи
    const aIn=p.angIn*Math.PI/180;
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2);
    ctx.beginPath();
    ctx.moveTo(X0-2.2, 2.2*Math.tan(aIn)); ctx.lineTo(X0,0); ctx.stroke();
    v.arrow(ctx,X0-1.3,1.3*Math.tan(aIn),X0-0.6,0.6*Math.tan(aIn),dang);
    v.label(ctx,`вход под ${p.angIn}°`,X0-2.2,2.2*Math.tan(aIn),0,-12,dang);

    if(tIn!==null){
      // ломаная внутри волокна
      const tan=Math.tan(tIn*Math.PI/180);
      const pts=[[X0,0]];
      let x=X0, y=0, dir=1;
      let guard=0;
      while(x<X0+L && guard++<200){
        if(tan<1e-9){ pts.push([X0+L,0]); break; }
        const dy=(dir>0? H-y : -H-y);
        const dx=Math.abs(dy)/tan;
        if(x+dx>=X0+L){ pts.push([X0+L, y+dir*(X0+L-x)*tan]); break; }
        x+=dx; y=dir>0?H:-H; pts.push([x,y]);
        if(!ok) break;                       // не ведётся — на первой же стенке уходит
        dir=-dir;
      }
      ctx.strokeStyle=ok?acc:dang; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));
      ctx.stroke();
      // отметки отражений
      if(ok) for(let i=1;i<pts.length-1;i++){
        ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(pts[i][0],pts[i][1],v.lw(2.4),0,7); ctx.fill();
      }
      // бегущий квант — видно направление
      {
        let tot=0; const seg=[];
        for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); seg.push(d); tot+=d; }
        if(tot>0.01){
          const u=((s.t*0.55)%1+1)%1, want=u*tot;
          let accd=0, px=pts[0][0], py=pts[0][1];
          for(let i=0;i<seg.length;i++){
            if(accd+seg[i]>=want){ const f=(want-accd)/seg[i];
              px=pts[i][0]+(pts[i+1][0]-pts[i][0])*f; py=pts[i][1]+(pts[i+1][1]-pts[i][1])*f; break; }
            accd+=seg[i];
          }
          ctx.fillStyle=ok?acc:dang; ctx.beginPath(); ctx.arc(px,py,v.lw(3.4),0,7); ctx.fill();
        }
      }
      // если не ведётся — показываем, как луч выходит в оболочку
      if(!ok && pts.length>1){
        const last=pts[pts.length-1];
        const rr=this.n1(p)*Math.cos(tIn*Math.PI/180)/this.n2(p);
        if(Math.abs(rr)<=1){
          const out=Math.asin(rr);
          const sgn=last[1]>0?1:-1;
          ctx.strokeStyle=dang; ctx.globalAlpha=.75; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.6);
          ctx.beginPath(); ctx.moveTo(last[0],last[1]);
          ctx.lineTo(last[0]+1.6*Math.cos(out), last[1]+sgn*1.6*Math.sin(out));
          ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
          v.label(ctx,'свет ушёл наружу',last[0],last[1],14,sgn>0?-14:20,dang);
        }
      }
      // угол падения на стенку — у первой точки отражения
      if(pts.length>1 && c!==null){
        const q=pts[1], sgn=q[1]>0?1:-1;
        this.arcBetween(ctx,v,0,-sgn,-Math.cos(tIn*Math.PI/180),-sgn*Math.sin(tIn*Math.PI/180),
          0.75,ok?meas:dang,`${this.wallAngle(p).toFixed(1)}°`,q[0],q[1]);
      }
    }
    // конус приёма
    const accAng=this.acceptance(p);
    ctx.strokeStyle=meas; ctx.globalAlpha=.30; ctx.lineWidth=v.lw(1.2);
    for(const sg of [1,-1]){
      ctx.beginPath(); ctx.moveTo(X0,0);
      ctx.lineTo(X0-2.0, sg*2.0*Math.tan(accAng*Math.PI/180)); ctx.stroke();
    }
    ctx.globalAlpha=1;
    v.label(ctx,`конус приёма ±${accAng.toFixed(1)}°`,X0-2.0,-2.0*Math.tan(accAng*Math.PI/180),-4,20,meas);

    // итог
    const yb=-H-1.4;
    if(c===null){
      v.label(ctx,'оболочка плотнее сердцевины — волокно не удержит свет',X0,yb,0,0,dang);
    } else if(ok){
      v.label(ctx,`на стенку свет падает под ${this.wallAngle(p).toFixed(1)}° ≥ θпр = ${c.toFixed(1)}° — отражается полностью`,X0,yb,0,0,acc);
      v.label(ctx,`поэтому луч идёт зигзагом и не теряется: ${this.bounces(p)} отражений на этом участке`,X0,yb,0,17,ink3);
      v.label(ctx,`NA = √(n₁²−n₂²) = ${this.NA(p).toFixed(3)}; шире ${accAng.toFixed(1)}° волокно не принимает`,X0,yb,0,34,ink3);
      v.label(ctx,'на схеме сердцевина утолщена: в настоящем волокне отражений миллионы',X0,yb,0,51,ink3);
    } else {
      v.label(ctx,`на стенку свет падает под ${this.wallAngle(p).toFixed(1)}° < θпр = ${c.toFixed(1)}° — часть уходит в оболочку`,X0,yb,0,0,dang);
      v.label(ctx,`угол входа ${p.angIn}° больше приёмного ${accAng.toFixed(1)}° — свет теряется`,X0,yb,0,17,ink3);
    }
  }
},

lens:{
  title:'Тонкая линза: построение изображения',
  params:[
    {key:'kind',label:'Тип линзы',type:'select',default:'conv',
     options:[{v:'conv',t:'Собирающая (положительная)'},
              {v:'div', t:'Рассеивающая (отрицательная)'}]},
    {key:'f',  label:'Фокусное расстояние |F|',unit:'м',min:0.4,max:3,step:0.1,default:1.5},

    {type:'group',label:'Предмет (точку можно перетаскивать в любую четверть)'},
    {key:'side',label:'Сторона от линзы',type:'select',default:'left',
     options:[{v:'left', t:'Слева — луч идёт через F'},
              {v:'right',t:'Справа — луч идёт через F′'}]},
    {key:'updown',label:'Относительно оси',type:'select',default:'up',
     options:[{v:'up',  t:'Выше оси'},
              {v:'down',t:'Ниже оси'}]},
    {key:'d',  label:'Расстояние до линзы d',unit:'м',min:0.2,max:9,step:0.1,default:3.5},
    {key:'h',  label:'Высота предмета h',unit:'м',min:0.2,max:2.5,step:0.1,default:1},

    {type:'group',label:'Показывать'},
    {key:'rays',   label:'Построение лучами',type:'check',default:true},
    {key:'ray3',   label:'Третий луч (через передний фокус)',type:'check',default:false},
    {key:'marks',  label:'Отметки F, 2F, 3F',type:'check',default:true},
    {key:'extend', label:'Продолжения лучей (для мнимого)',type:'check',default:true}
  ],
  /* фокусное расстояние со знаком: собирающая > 0, рассеивающая < 0 */
  F(p){ return p.kind==='conv'? p.f : -p.f; },
  /* Четверть, в которой стоит предмет.
     sx = +1 — предмет слева (свет идёт вправо), sx = −1 — предмет справа.
     sy = +1 — предмет выше оси, sy = −1 — ниже.
     Формулы линзы работают с модулями d и h, а знаки отвечают только за то,
     куда всё это отложено на чертеже. */
  sx(p){ return p.side==='right' ? -1 : 1; },
  sy(p){ return p.updown==='down' ? -1 : 1; },
  /* положение предмета и изображения в реальных координатах чертежа */
  objXY(p){ return {x:-this.sx(p)*p.d, y:this.sy(p)*p.h}; },
  imgXY(p){
    const dp=this.dPrime(p); if(!isFinite(dp)) return null;
    return {x:this.sx(p)*dp, y:this.sy(p)*this.H(p)};
  },
  /* фокус, через который проходит преломлённый луч: он всегда с ДРУГОЙ стороны
     от предмета. Слева стоит предмет — луч идёт через F (справа), и наоборот. */
  focusName(p){ return p.side==='right' ? 'F′' : 'F'; },
  /* оптическая сила в диоптриях: D = 1/F */
  D(p){ return 1/this.F(p); },
  /* формула тонкой линзы: 1/F = 1/d + 1/d'  ⇒  d' = d·F/(d − F)
     d' > 0 — изображение справа (действительное), d' < 0 — слева (мнимое) */
  dPrime(p){
    const F=this.F(p), d=p.d;
    if(Math.abs(d-F)<1e-9) return Infinity;          // предмет в фокусе — изображения нет
    return d*F/(d-F);
  },
  /* увеличение Γ = −d'/d. Отрицательное — изображение перевёрнутое */
  gamma(p){
    const dp=this.dPrime(p);
    if(!isFinite(dp)) return Infinity;
    return -dp/p.d;
  },
  H(p){ const g=this.gamma(p); return isFinite(g)? g*p.h : Infinity; },
  /* характеристика изображения */
  kindOf(p){
    const dp=this.dPrime(p), g=this.gamma(p);
    if(!isFinite(dp)) return {real:null,inverted:null,text:'изображения нет: лучи выходят параллельно'};
    const real=dp>0, inverted=g<0, big=Math.abs(g)>1;
    return {real,inverted,big,
      text:`${real?'действительное':'мнимое'}, ${inverted?'перевёрнутое':'прямое'}, ${
        Math.abs(Math.abs(g)-1)<1e-6?'в натуральную величину':(big?'увеличенное':'уменьшенное')}`};
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  /* перетаскиваем вершину предмета: меняются и расстояние, и высота */
  dragPoints(p){ const o=this.objXY(p); return [{x:o.x, y:o.y}]; },
  dragMove(p,idx,x,y){
    // сторона и верх/низ определяются тем, в какую четверть утащили точку
    if(Math.abs(x)>0.2) p.side = (x>0) ? 'right' : 'left';
    if(Math.abs(y)>0.1) p.updown = (y<0) ? 'down' : 'up';
    p.d=clamp(Math.round(Math.abs(x)*10)/10,0.2,9);
    p.h=clamp(Math.round(Math.abs(y)*10)/10,0.2,2.5);
  },
  anchors(s,p){
    const o=this.objXY(p), im=this.imgXY(p);
    return im? [o,im] : [o];
  },
  readouts(s,p){
    const F=this.F(p), dp=this.dPrime(p), g=this.gamma(p), H=this.H(p), k=this.kindOf(p);
    const out=[['t',s.t,'с'],
      ['фокусное расстояние F',F,'м'],
      ['оптическая сила D = 1/F',this.D(p),'дптр'],
      ['расстояние до предмета d',p.d,'м'],
      ['высота предмета h',p.h,'м'],
      ['четверть',0,`${p.side==='right'?'справа':'слева'} от линзы, ${p.updown==='down'?'ниже':'выше'} оси`],
      ['преломлённый луч идёт через',0,this.focusName(p)]];
    if(isFinite(dp)){
      out.push(['расстояние до изображения d′',dp,'м'],
        ['высота изображения H',H,'м'],
        ['увеличение Γ = −d′/d',g,''],
        ['|Γ| (во сколько раз)',Math.abs(g),''],
        ['проверка 1/d + 1/d′',1/p.d+1/dp,'= 1/F'],
        ['1/F',1/F,''],
        ['изображение',0,k.text]);
    } else {
      out.push(['расстояние до изображения',0,'бесконечность'],
        ['изображение',0,k.text]);
    }
    return out;
  },
  graphs:[
    {label:'Расстояние до изображения d′',unit:'м',series:['d′'],
     get(s,p){ const dp=SIMS.lens.dPrime(p); return [isFinite(dp)?clamp(dp,-40,40):0,null]; }},
    {label:'Увеличение Γ',unit:'',series:['Γ'],
     get(s,p){ const g=SIMS.lens.gamma(p); return [isFinite(g)?clamp(g,-20,20):0,null]; }}
  ],
  presets:[
    {name:'За 2F: действительное, перевёрнутое, уменьшенное',values:{kind:'conv',f:1.5,d:5,h:1}},
    {name:'В точке 2F: равное по величине',values:{kind:'conv',f:1.5,d:3,h:1}},
    {name:'Между F и 2F: увеличенное (проектор)',values:{kind:'conv',f:1.5,d:2.2,h:1}},
    {name:'В фокусе: изображения нет',values:{kind:'conv',f:1.5,d:1.5,h:1}},
    {name:'Ближе фокуса: лупа — мнимое, прямое',values:{kind:'conv',f:1.5,d:0.9,h:1}},
    {name:'Рассеивающая: всегда мнимое, уменьшенное',values:{kind:'div',f:1.5,d:3,h:1}},
    {name:'Четверть I: слева сверху — через F',values:{kind:'conv',f:1.5,d:4,h:1.2,side:'left',updown:'up'}},
    {name:'Четверть II: слева снизу — через F',values:{kind:'conv',f:1.5,d:4,h:1.2,side:'left',updown:'down'}},
    {name:'Четверть III: справа сверху — через F′',values:{kind:'conv',f:1.5,d:4,h:1.2,side:'right',updown:'up'}},
    {name:'Четверть IV: справа снизу — через F′',values:{kind:'conv',f:1.5,d:4,h:1.2,side:'right',updown:'down'}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const dp=this.dPrime(p);
    const span=clamp(Math.max(p.d,isFinite(dp)?Math.abs(dp):0,p.f*3)*2.3, 8, 26);
    const scale=clamp(Math.min((W-60)/(span*PX_PER_M),(H-60)/(span*0.55*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const F=this.F(p), af=Math.abs(F), dp=this.dPrime(p), g=this.gamma(p), H=this.H(p);
    const conv=p.kind==='conv';
    const span=Math.max(p.d,isFinite(dp)?Math.abs(dp):0,af*3)*1.35+1;

    // главная оптическая ось
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.moveTo(-span,0); ctx.lineTo(span,0); ctx.stroke();
    v.arrow(ctx,span-0.6,0,span,0,ink);
    v.label(ctx,'главная оптическая ось',span,0,-96,-14,ink3);

    // линза: вертикальный отрезок со стрелками (собирающая — наружу, рассеивающая — внутрь)
    const LH=Math.max(2.2, p.h*1.6);
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.6);
    ctx.beginPath(); ctx.moveTo(0,-LH); ctx.lineTo(0,LH); ctx.stroke();
    const tip=(y,dir)=>{ ctx.beginPath();
      ctx.moveTo(-0.22,y-dir*0.28); ctx.lineTo(0,y); ctx.lineTo(0.22,y-dir*0.28); ctx.stroke(); };
    if(conv){ tip(LH,1); tip(-LH,-1); } else { tip(LH,-1); tip(-LH,1); }
    v.label(ctx,conv?'собирающая линза':'рассеивающая линза',0,LH,-40,-16,acc);
    v.label(ctx,`F = ${F.toFixed(2)} м,  D = ${this.D(p).toFixed(2)} дптр`,0,-LH,-56,20,acc);

    // отметки F, 2F, 3F по обе стороны
    if(p.marks){
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4);
      for(let n=1;n<=3;n++){
        for(const sgn of [-1,1]){
          const x=sgn*n*af;
          ctx.beginPath(); ctx.moveTo(x,-0.22); ctx.lineTo(x,0.22); ctx.stroke();
          // F и F′ закреплены за сторонами: справа F, слева F′
          const lab=(n===1?'F':`${n}F`)+(sgn<0?'′':'');
          const active=(n===1)&&((sgn>0)===(p.side!=='right'));
          v.label(ctx,lab,x,0,-6,16,active?v.c('--measure'):ink3);
        }
      }
    }

    /* Чертёж строится в «каноническом» виде (предмет слева сверху),
       а затем отражается по четвертям: MX по горизонтали, MY по вертикали.
       Подписи при этом не переворачиваются — они выводятся в готовых точках. */
    const SX=this.sx(p), SY=this.sy(p);
    const MX=x=>SX*x, MY=y=>SY*y;
    const OX=MX(-p.d), OY=MY(p.h);

    // предмет — стрелка от оси
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.6);
    v.arrow(ctx,OX,0,OX,OY,dang);
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(OX,OY,v.lw(4),0,7); ctx.fill();
    v.label(ctx,'предмет',OX,OY,-24,OY>=0?-14:18,dang);
    v.label(ctx,`h = ${p.h.toFixed(2)} м`,OX,OY/2,-32,0,dang);
    // отметка расстояния d
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
    const dy=MY(-0.5), dy2=MY(-0.4);
    ctx.beginPath(); ctx.moveTo(OX,0); ctx.lineTo(OX,dy); ctx.moveTo(0,dy); ctx.lineTo(0,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(OX,dy2); ctx.lineTo(0,dy2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
    v.label(ctx,`d = ${p.d.toFixed(2)} м`,OX/2,dy2,-26,SY>0?16:-6,ink3);

    /* ---------- построение лучей ---------- */
    if(p.rays){
      const R=span;
      /* Преломлённый луч всегда идёт через фокус на ПРОТИВОПОЛОЖНОЙ стороне
         от предмета: предмет слева — через F (справа), предмет справа — через F′ (слева).
         В каноническом виде это фокус с координатой +af (для собирающей). */
      // ЛУЧ 1: параллельно оси, после линзы — через дальний фокус
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.8);
      ctx.beginPath(); ctx.moveTo(OX,OY); ctx.lineTo(0,OY); ctx.stroke();
      v.arrow(ctx,MX(-p.d*0.55),OY,MX(-p.d*0.35),OY,meas);
      const slope1 = conv ? (0-p.h)/(af-0) : (0-p.h)/(-af-0);
      ctx.beginPath(); ctx.moveTo(0,OY); ctx.lineTo(MX(R), MY(p.h+slope1*R)); ctx.stroke();
      if(p.extend){
        ctx.strokeStyle=meas; ctx.globalAlpha=.55; ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.lineWidth=v.lw(1.2);
        ctx.beginPath(); ctx.moveTo(0,OY); ctx.lineTo(MX(-R), MY(p.h-slope1*R)); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
      }
      // подпись: через какой именно фокус пошёл луч
      if(conv){
        const fx=MX(af);
        ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(fx,0,v.lw(3.2),0,7); ctx.fill();
        v.label(ctx,`луч 1 идёт через ${this.focusName(p)}`,fx,0,-30,SY>0?-12:20,meas);
      }

      // ЛУЧ 2: через оптический центр — не преломляется
      const slope2 = (0-p.h)/(0-(-p.d));
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8);
      ctx.beginPath(); ctx.moveTo(OX,OY); ctx.lineTo(MX(R), MY(slope2*R)); ctx.stroke();
      if(p.extend){
        ctx.strokeStyle=sec; ctx.globalAlpha=.55; ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.lineWidth=v.lw(1.2);
        ctx.beginPath(); ctx.moveTo(OX,OY); ctx.lineTo(MX(-R), MY(slope2*(-R))); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
      }

      // ЛУЧ 3: через ближний фокус → после линзы параллельно оси
      if(p.ray3 && conv && Math.abs(p.d-af)>1e-6){
        const yAtLens = p.h + (0-(-p.d))*((0-p.h)/((-af)-(-p.d)));
        ctx.strokeStyle=acc; ctx.globalAlpha=.85; ctx.lineWidth=v.lw(1.5);
        ctx.beginPath();
        ctx.moveTo(OX,OY); ctx.lineTo(0,MY(yAtLens)); ctx.lineTo(MX(R),MY(yAtLens)); ctx.stroke();
        ctx.globalAlpha=1;
      }
    }

    /* ---------- изображение ---------- */
    if(isFinite(dp)){
      const real=dp>0, IX=MX(dp), IY=MY(H);
      ctx.strokeStyle=real?dang:sec; ctx.lineWidth=v.lw(2.6);
      v.arrow(ctx,IX,0,IX,IY,real?dang:sec);
      ctx.fillStyle=real?dang:sec; ctx.beginPath(); ctx.arc(IX,IY,v.lw(4),0,7); ctx.fill();
      v.label(ctx,real?'изображение (действительное)':'изображение (мнимое)',IX,IY,-40,IY>=0?-14:18,real?dang:sec);
      v.label(ctx,`H = ${H.toFixed(2)} м`,IX,IY/2,IX>0?10:-40,0,real?dang:sec);
      // отметка расстояния d'
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
      const iy=MY(0.5), iy2=MY(0.42);
      ctx.beginPath(); ctx.moveTo(IX,0); ctx.lineTo(IX,iy); ctx.moveTo(0,iy); ctx.lineTo(0,0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,iy2); ctx.lineTo(IX,iy2); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,`d′ = ${dp.toFixed(2)} м`,IX/2,iy2,-26,SY>0?-8:16,ink3);
    }

    // сводка
    const k=this.kindOf(p);
    const yInfo=-Math.max(2.6, p.h*1.7);
    if(isFinite(dp)){
      v.label(ctx,`Γ = −d′/d = ${g.toFixed(2)}   (${Math.abs(g).toFixed(2)}×)`,0,yInfo,-60,0,ink3);
      v.label(ctx,k.text,0,yInfo,-Math.round(k.text.length*3.1),18,k.real?dang:sec);
    } else {
      v.label(ctx,'предмет ровно в фокусе — лучи после линзы параллельны, изображения нет',0,yInfo,-142,0,ink3);
    }
    v.label(ctx,`предмет ${p.side==='right'?'справа':'слева'} — преломлённый луч идёт через ${this.focusName(p)}`,
      0,yInfo,-96,36,ink3);
    v.label(ctx,'вершину предмета можно перетащить в любую из четырёх четвертей',0,yInfo,-108,54,ink3);
  }
}
,

/* ================== ГЛ.21: ЭНЕРГИЯ И ИМПУЛЬС ИЗЛУЧЕНИЯ ================= */
radpressure:{
  title:'Импульс излучения и световое давление',
  params:[
    {key:'surf',label:'Поверхность',type:'select',default:'black',
     options:[{v:'black',t:'Чёрная (поглощает)'},
              {v:'mirror',t:'Зеркальная (отражает)'},
              {v:'radio',t:'Радиометр: обе лопасти'}]},
    {key:'P',label:'Мощность источника',unit:'Вт',min:1,max:5000,step:1,default:1000},
    {key:'r',label:'Расстояние до источника',unit:'м',min:0.5,max:12,step:0.1,default:4},
    {key:'A',label:'Площадь мишени S',unit:'м²',min:0.1,max:20,step:0.1,default:2},

    {type:'group',label:'Показывать'},
    {key:'rays',label:'Лучи и отражение',type:'check',default:true},
    {key:'force',label:'Сила давления',type:'check',default:true}
  ],
  c:2.99792458e8,
  /* интенсивность точечного источника: I = P/(4πr²) */
  I(p){ return p.P/(4*Math.PI*p.r*p.r); },
  /* импульс излучения: p = U/c. Давление: поглощение I/c, отражение 2I/c */
  pressure(p){ const k=(p.surf==='mirror')?2:1; return k*this.I(p)/this.c; },
  force(p){ return this.pressure(p)*p.A; },
  /* энергия, принесённая за время t, и её импульс */
  energyAt(p,t){ return this.I(p)*p.A*t; },
  momentumAt(p,t){ return this.energyAt(p,t)/this.c*((p.surf==='mirror')?2:1); },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt*1.6; },
  dragPoints(p){ return [{x:p.r,y:0}]; },
  dragMove(p,idx,x,y){ p.r=clamp(Math.round(Math.abs(x)*10)/10,0.5,12); },
  anchors(s,p){ return [{x:0,y:0},{x:p.r,y:0}]; },
  readouts(s,p){
    const I=this.I(p), pr=this.pressure(p), F=this.force(p);
    const out=[['t',s.t,'с'],['мощность источника',p.P,'Вт'],
      ['расстояние r',p.r,'м'],
      ['интенсивность I = P/4πr²',I,'Вт/м²'],
      ['площадь мишени',p.A,'м²'],
      ['давление света',pr*1e6,'мкПа'],
      ['сила давления F',F*1e6,'мкН'],
      ['энергия за 1 с',this.energyAt(p,1),'Дж'],
      ['импульс за 1 с (p = U/c)',this.momentumAt(p,1)*1e6,'мкН·с']];
    if(p.surf==='radio') out.push(['зеркальная лопасть',2,'× импульс'],['чёрная лопасть',1,'× импульс']);
    else out.push(['множитель импульса',(p.surf==='mirror')?2:1,p.surf==='mirror'?'(отражение)':'(поглощение)']);
    return out;
  },
  graphs:[
    {label:'Интенсивность',unit:'Вт/м²',series:['I'],get(s,p){ return [SIMS.radpressure.I(p),null]; }},
    {label:'Сила светового давления',unit:'мкН',series:['F'],get(s,p){ return [SIMS.radpressure.force(p)*1e6,null]; }}
  ],
  presets:[
    {name:'Чёрная мишень: p = U/c',values:{surf:'black',P:1000,r:4,A:2}},
    {name:'Зеркало: импульс вдвое больше',values:{surf:'mirror',P:1000,r:4,A:2}},
    {name:'Радиометр Крукса',values:{surf:'radio',P:1000,r:3,A:2}},
    {name:'Ближе к источнику — сильнее давление',values:{surf:'mirror',P:1000,r:1.5,A:2}},
    {name:'Солнечный парус: большая площадь',values:{surf:'mirror',P:5000,r:3,A:20}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const span=Math.max(p.r*1.9,8);
    const scale=clamp(Math.min((W-70)/(span*PX_PER_M),(H-70)/(span*0.62*PX_PER_M)),0.002,30);
    return {x:p.r/2,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const I=this.I(p), F=this.force(p);
    // источник
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(0,0,0.3,0,7); ctx.fill();
    ctx.strokeStyle=dang; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1.4);
    for(let i=0;i<8;i++){ const a=i/8*2*Math.PI;
      ctx.beginPath(); ctx.moveTo(0.42*Math.cos(a),0.42*Math.sin(a)); ctx.lineTo(0.62*Math.cos(a),0.62*Math.sin(a)); ctx.stroke(); }
    ctx.globalAlpha=1;
    v.label(ctx,`источник ${p.P} Вт`,0,0,-30,-22,dang);

    const hh=Math.min(2.2,0.5+p.A*0.12);      // полувысота мишени по площади
    if(p.surf==='radio'){
      // радиометр: две лопасти на оси — зеркальная сверху, чёрная снизу
      ctx.fillStyle=ink3; ctx.fillRect(p.r-0.06,-0.05,0.12,0.1);
      // зеркальная
      ctx.fillStyle=sec; ctx.fillRect(p.r-0.09,0.15,0.18,hh);
      v.label(ctx,'зеркальная: импульс ×2',p.r,hh,10,-6,sec);
      // чёрная
      ctx.fillStyle=ink; ctx.fillRect(p.r-0.09,-hh-0.15,0.18,hh);
      v.label(ctx,'чёрная: импульс ×1',p.r,-hh,10,10,ink);
      // вращение
      v.arrow(ctx,p.r+0.5,hh*0.6,p.r+0.5,hh*0.2,acc);
      v.label(ctx,'зеркальная сторона получает вдвое больший импульс',p.r,0,-100,hh*20+30,ink3);
    } else {
      const mirror=p.surf==='mirror';
      ctx.fillStyle=mirror?sec:ink;
      ctx.fillRect(p.r-0.09,-hh,0.18,2*hh);
      v.label(ctx,mirror?'зеркало (отражает)':'чёрная мишень (поглощает)',p.r,hh,-30,-14,mirror?sec:ink);
      v.label(ctx,`S = ${p.A} м²`,p.r,-hh,-20,18,ink3);
    }

    // лучи от источника к мишени и отражённые от зеркала
    if(p.rays){
      const n=7, xs=0.5, xm=p.r-0.09;
      let anyRefl=false;
      for(let i=0;i<n;i++){
        const y=(-hh+2*hh*(i+0.5)/n);
        const y0=y*0.12;                                  // луч выходит почти из точки
        const dx=xm-xs, dy=y-y0;
        // отражает ли поверхность именно в этом месте
        const refl=(p.surf==='mirror') || (p.surf==='radio' && y>0);
        if(refl) anyRefl=true;
        // падающий луч
        ctx.strokeStyle=dang; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1.5);
        ctx.beginPath(); ctx.moveTo(xs,y0); ctx.lineTo(xm,y); ctx.stroke();
        // отражённый: зеркало вертикально, поэтому у скорости меняет знак
        // только составляющая вдоль x — угол падения равен углу отражения
        let xe=xm, ye=y;
        if(refl){
          const back=Math.min(dx*0.92, xm-0.55);           // докуда рисуем обратный луч
          xe=xm-back; ye=y+dy*(back/dx);
          ctx.strokeStyle=sec; ctx.globalAlpha=.85; ctx.lineWidth=v.lw(1.7);
          ctx.beginPath(); ctx.moveTo(xm,y); ctx.lineTo(xe,ye); ctx.stroke();
        }
        ctx.globalAlpha=1;
        /* Один и тот же фотон: первую половину периода летит к мишени,
           вторую — уже отражённым. Так видно, что он именно отразился,
           а не что рядом нарисована лишняя полоса. */
        const per=refl?2:1;
        const ph=(((s.ph+i*0.17)%per)+per)%per;
        if(ph<1){
          ctx.fillStyle=dang;
          ctx.beginPath(); ctx.arc(xs+dx*ph, y0+dy*ph, v.lw(2.8),0,7); ctx.fill();
        } else if(refl){
          const t=ph-1;
          ctx.fillStyle=sec;
          ctx.beginPath(); ctx.arc(xm+(xe-xm)*t, y+(ye-y)*t, v.lw(2.8),0,7); ctx.fill();
        }
      }
      if(anyRefl){
        v.label(ctx,'отражённые лучи уносят импульс назад',xs+0.2,-hh-0.35,0,16,sec);
        v.label(ctx,'поэтому зеркало получает вдвое больший импульс',xs+0.2,-hh-0.35,0,32,ink3);
      } else {
        v.label(ctx,'свет поглощается: отражённых лучей нет',xs+0.2,-hh-0.35,0,16,ink3);
      }
    }
    // сила давления
    if(p.force){
      const fl=clamp(0.3+Math.log10(1+F*1e6)*0.5,0.3,2);
      v.arrow(ctx,p.r+0.2,0,p.r+0.2+fl,0,acc);
      v.label(ctx,`F = ${(F*1e6).toFixed(3)} мкН`,p.r+0.2+fl,0,6,-6,acc);
    }
    // сводка
    const yb=-Math.max(hh+1.2,2.4);
    v.label(ctx,`I = P/4πr² = ${I.toFixed(2)} Вт/м²,   давление = ${(this.pressure(p)*1e6).toFixed(3)} мкПа`,p.r/2,yb,-120,0,ink3);
    v.label(ctx,'импульс излучения p = U/c; при отражении он передаётся вдвое',p.r/2,yb,-116,16,ink3);
  }
},

/* ================= ГЛ.21: ПОКАЗАТЕЛЬ ПРЕЛОМЛЕНИЯ ================= */
refraction:{
  title:'Показатель преломления и преломление света',
  params:[
    {key:'mat1',label:'Среда сверху',type:'select',default:'air',
     options:[{v:'air',t:'Воздух (n = 1,00)'},{v:'water',t:'Вода (n = 1,33)'},
              {v:'glass',t:'Стекло (n = 1,50)'},{v:'diamond',t:'Алмаз (n = 2,42)'}]},
    {key:'mat2',label:'Среда снизу',type:'select',default:'glass',
     options:[{v:'air',t:'Воздух (n = 1,00)'},{v:'water',t:'Вода (n = 1,33)'},
              {v:'glass',t:'Стекло (n = 1,50)'},{v:'diamond',t:'Алмаз (n = 2,42)'}]},
    {key:'ang',label:'Угол падения',unit:'°',min:0,max:89,step:1,default:35},
    {key:'lam',label:'Длина волны в вакууме',unit:'нм',min:400,max:700,step:10,default:550},

    {type:'group',label:'Показывать'},
    {key:'refl',label:'Отражённый луч',type:'check',default:true},
    {key:'arcs',label:'Дуги углов и их отсчёт',type:'check',default:true},
    {key:'norm',label:'Нормаль',type:'check',default:true}
  ],
  c:2.99792458e8,
  N:{air:1.0,water:1.333,glass:1.50,diamond:2.417},
  n1(p){ return this.N[p.mat1]; },
  n2(p){ return this.N[p.mat2]; },
  /* скорость света в среде: v = c/n */
  vIn(n){ return this.c/n; },
  /* закон Снеллиуса: n₁·sinθ₁ = n₂·sinθ₂ */
  theta2(p){
    const s2=this.n1(p)*Math.sin(p.ang*Math.PI/180)/this.n2(p);
    if(Math.abs(s2)>1) return null;                     // полное внутреннее отражение
    return Math.asin(s2)*180/Math.PI;
  },
  /* предельный угол: sinθкр = n₂/n₁ (только если n₁ > n₂) */
  critical(p){
    const n1=this.n1(p), n2=this.n2(p);
    if(n1<=n2) return null;
    return Math.asin(n2/n1)*180/Math.PI;
  },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt*2; },
  dragPoints(p){
    const a=p.ang*Math.PI/180, R=3.2;
    return [{x:-R*Math.sin(a), y:R*Math.cos(a)}];
  },
  dragMove(p,idx,x,y){
    /* Луч падает из левой верхней четверти; угол отсчитывается от нормали.
       Раньше знак x игнорировался (|x|), а y зажимался снизу микрозначением:
       правее нормали ручка «зеркалилась», а ниже границы угол намертво
       прыгал к 89° — луч не слушался пальца. Теперь ручка честно следует
       за курсором внутри четверти, а за её пределами угол мягко упирается
       в 0° (за нормалью) или 89° (за границей сред). */
    const a=Math.atan2(-x, y)*180/Math.PI;      // левая верхняя четверть → 0…90°
    p.ang=clamp(Math.round(a*2)/2, 0, 89);      // шаг 0.5° — плавнее слайдера
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const n1=this.n1(p), n2=this.n2(p), t2=this.theta2(p), cr=this.critical(p);
    const out=[['t',s.t,'с'],
      ['показатель среды 1: n₁',n1,''],
      ['показатель среды 2: n₂',n2,''],
      ['скорость в среде 1: v = c/n',this.vIn(n1)/1e8,'·10⁸ м/с'],
      ['скорость в среде 2: v = c/n',this.vIn(n2)/1e8,'·10⁸ м/с'],
      ['угол падения θ₁',p.ang,'°']];
    if(t2===null){
      out.push(['угол преломления',0,'ПОЛНОЕ ВНУТРЕННЕЕ ОТРАЖЕНИЕ'],
        ['предельный угол θкр',cr!==null?cr:0,'°']);
    } else {
      out.push(['угол преломления θ₂',t2,'°'],
        ['проверка n₁·sinθ₁',n1*Math.sin(p.ang*Math.PI/180),''],
        ['n₂·sinθ₂',n2*Math.sin(t2*Math.PI/180),'']);
      if(cr!==null) out.push(['предельный угол θкр',cr,'°']);
    }
    out.push(['длина волны в вакууме',p.lam,'нм'],
      ['длина волны в среде 2: λ/n',p.lam/n2,'нм'],
      ['частота (не меняется)',this.c/(p.lam*1e-9)/1e12,'ТГц']);
    return out;
  },
  graphs:[
    {label:'Угол преломления θ₂',unit:'°',series:['θ₂'],get(s,p){ const t=SIMS.refraction.theta2(p); return [t===null?0:t,null]; }}
  ],
  presets:[
    {name:'Воздух → стекло: луч прижимается к нормали',values:{mat1:'air',mat2:'glass',ang:45}},
    {name:'Воздух → вода',values:{mat1:'air',mat2:'water',ang:50}},
    {name:'Стекло → воздух: луч отходит от нормали',values:{mat1:'glass',mat2:'air',ang:30}},
    {name:'Полное внутреннее отражение (стекло→воздух)',values:{mat1:'glass',mat2:'air',ang:60}},
    {name:'Алмаз: маленький предельный угол — игра света',values:{mat1:'diamond',mat2:'air',ang:30}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(10*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const n1=this.n1(p), n2=this.n2(p), a1=p.ang*Math.PI/180, t2=this.theta2(p), cr=this.critical(p);
    const R=3.4;
    // среды
    ctx.fillStyle=sec; ctx.globalAlpha=.07; ctx.fillRect(-5,0,10,4); ctx.globalAlpha=.16; ctx.fillRect(-5,-4,10,4); ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke();
    const nm={air:'воздух',water:'вода',glass:'стекло',diamond:'алмаз'};
    v.label(ctx,`${nm[p.mat1]}, n₁ = ${n1.toFixed(2)}`,-5,0,10,-16,ink3);
    v.label(ctx,`${nm[p.mat2]}, n₂ = ${n2.toFixed(2)}`,-5,0,10,20,ink3);
    // нормаль
    if(p.norm){
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.setLineDash([v.lw(4),v.lw(4)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(0,-3.6); ctx.lineTo(0,3.6); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'нормаль',0,3.6,6,-4,ink3);
    }
    // падающий луч
    const ix=-R*Math.sin(a1), iy=R*Math.cos(a1);
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(ix,iy); ctx.lineTo(0,0); ctx.stroke();
    v.arrow(ctx,ix*0.55,iy*0.55,ix*0.3,iy*0.3,dang);
    v.label(ctx,`падающий, θ₁ = ${p.ang}°`,ix,iy,-30,-10,dang);
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(ix,iy,v.lw(4),0,7); ctx.fill();
    // отражённый
    if(p.refl){
      const rx=R*Math.sin(a1), ry=R*Math.cos(a1);
      ctx.strokeStyle=meas; ctx.globalAlpha=(t2===null)?1:.5; ctx.lineWidth=v.lw(t2===null?2.2:1.6);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(rx,ry); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,t2===null?'отражённый (весь свет!)':'отражённый',rx,ry,4,-8,meas);
    }
    // преломлённый
    if(t2!==null){
      const a2=t2*Math.PI/180, tx=R*Math.sin(a2), ty=-R*Math.cos(a2);
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(tx,ty); ctx.stroke();
      v.arrow(ctx,tx*0.5,ty*0.5,tx*0.75,ty*0.75,acc);
      v.label(ctx,`преломлённый, θ₂ = ${t2.toFixed(1)}°`,tx,ty,4,10,acc);
    } else {
      v.label(ctx,'ПОЛНОЕ ВНУТРЕННЕЕ ОТРАЖЕНИЕ: свет не выходит',0,-2.2,-104,0,dang);
      if(cr!==null) v.label(ctx,`угол падения ${p.ang}° больше предельного ${cr.toFixed(1)}°`,0,-2.2,-104,16,ink3);
    }
    /* УГЛЫ. Все углы в оптике отсчитываются от нормали, а не от поверхности,
       поэтому рисуем дугу от вертикали до каждого луча и подписываем её. */
    if(p.arcs){
      // дуга от нормали до луча; ang — угол от нормали, up — в верхней полуплоскости
      /* Дугу строим ЯВНО по двум направлениям — от нормали к лучу, интерполируя
         единичные векторы. Через ctx.arc углы зеркалились, потому что ось Y в сцене
         направлена вверх, а холст считает углы по своей, перевёрнутой системе. */
      const arcBetween=(ax,ay,bx,by,rad,col,txt)=>{
        const na=Math.hypot(ax,ay)||1, nb=Math.hypot(bx,by)||1;
        ax/=na; ay/=na; bx/=nb; by/=nb;
        let dot=clamp(ax*bx+ay*by,-1,1);
        const sweep=Math.acos(dot);
        const cross=ax*by-ay*bx;                       // знак задаёт сторону обхода
        const sgn=cross>=0?1:-1;
        ctx.strokeStyle=col; ctx.lineWidth=v.lw(1.7); ctx.globalAlpha=.95;
        ctx.beginPath();
        const N=36;
        for(let i=0;i<=N;i++){
          const t=sweep*i/N*sgn;
          const c=Math.cos(t), sn=Math.sin(t);
          const x=(ax*c-ay*sn)*rad, y=(ax*sn+ay*c)*rad;
          i?ctx.lineTo(x,y):ctx.moveTo(x,y);
        }
        ctx.stroke(); ctx.globalAlpha=1;
        // подпись на середине дуги
        const tm=sweep/2*sgn, cm=Math.cos(tm), sm=Math.sin(tm);
        const mx=(ax*cm-ay*sm)*rad*1.2, my=(ax*sm+ay*cm)*rad*1.2;
        v.label(ctx,txt,mx,my,-16,4,col);
      };
      const S1=Math.sin(a1), C1=Math.cos(a1);
      // падающий приходит сверху слева: дуга от нормали вверх к нему
      arcBetween(0,1,-S1,C1,1.15,dang,`θ₁ = ${p.ang}°`);
      // отражённый уходит вверх вправо
      if(p.refl) arcBetween(0,1,S1,C1,1.55,meas,`θ₁ = ${p.ang}°`);
      // преломлённый уходит вниз вправо: дуга от нормали вниз к нему
      if(t2!==null){
        const r2=t2*Math.PI/180;
        arcBetween(0,-1,Math.sin(r2),-Math.cos(r2),1.15,acc,`θ₂ = ${t2.toFixed(1)}°`);
      }

      // прямое сравнение углов столбиками — сразу видно, какой больше
      const bx=-4.6, by=-2.4, bw=1.5;
      const bar=(lab,val,col,row)=>{
        const yy=by-row*0.55;
        ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(bx,yy); ctx.lineTo(bx+bw,yy); ctx.stroke(); ctx.globalAlpha=1;
        ctx.strokeStyle=col; ctx.lineWidth=v.lw(5);
        ctx.beginPath(); ctx.moveTo(bx,yy); ctx.lineTo(bx+bw*clamp(val/90,0,1),yy); ctx.stroke();
        v.label(ctx,`${lab} ${val.toFixed(1)}°`,bx+bw,yy,8,4,col);
      };
      bar('θ₁',p.ang,dang,0);
      if(t2!==null){
        bar('θ₂',t2,acc,1);
        const closer=(t2<p.ang);
        v.label(ctx, closer? 'луч прижался к нормали: среда плотнее'
                           : 'луч отклонился от нормали: среда реже',
                bx,by-1.15,0,4,ink3);
      }
      // предельный угол — если он есть
      if(cr!==null){
        ctx.strokeStyle=dang; ctx.globalAlpha=.5; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1.4);
        const cx2=-R*Math.sin(cr*Math.PI/180), cy2=R*Math.cos(cr*Math.PI/180);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(cx2,cy2); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
        v.label(ctx,`предельный ${cr.toFixed(1)}°`,cx2,cy2,-30,-6,dang);
      }
    }
    // сводка
    v.label(ctx,`n₁·sinθ₁ = ${(n1*Math.sin(a1)).toFixed(3)}${t2!==null?`  =  n₂·sinθ₂ = ${(n2*Math.sin(t2*Math.PI/180)).toFixed(3)}`:''}`,0,-3.9,-90,0,ink3);
    v.label(ctx,`скорость света в среде: v = c/n  (${(this.vIn(n2)/1e8).toFixed(2)}·10⁸ м/с)`,0,-3.9,-96,16,ink3);
    v.label(ctx,'точку падающего луча можно перетаскивать',0,-3.9,-80,32,ink3);
  }
},

/* ================= ГЛ.21: ИЗЛУЧЕНИЕ В ИОНИЗОВАННОЙ СРЕДЕ ================= */
plasma:{
  title:'Радиоволны в ионосфере: плазменная частота',
  params:[
    {key:'Ne',label:'Плотность электронов N',unit:'10¹¹ 1/м³',min:0.5,max:50,step:0.5,default:10},
    {key:'f', label:'Частота волны f',unit:'МГц',min:0.5,max:30,step:0.1,default:5},

    {type:'group',label:'Показывать'},
    {key:'layer',label:'Слой ионосферы',type:'check',default:true},
    {key:'wave', label:'Волна',type:'check',default:true}
  ],
  e:1.602176634e-19, me:9.1093837e-31, eps0:8.8541878e-12, c:2.99792458e8,
  /* плазменная частота: ωp = √(N e²/(ε₀ m)),  fp = ωp/2π */
  fp(p){
    const N=p.Ne*1e11;
    const w=Math.sqrt(N*this.e*this.e/(this.eps0*this.me));
    return w/(2*Math.PI);
  },
  /* показатель преломления плазмы: n² = 1 − (fp/f)² */
  n(p){
    const r=this.fp(p)/(p.f*1e6);
    const n2=1-r*r;
    return n2>0? Math.sqrt(n2) : 0;                    // n=0 ⇒ волна не проходит
  },
  passes(p){ return p.f*1e6 > this.fp(p); },
  /* фазовая скорость c/n (> c) и групповая c·n (< c); их произведение = c² */
  vphase(p){ const n=this.n(p); return n>0? this.c/n : Infinity; },
  vgroup(p){ return this.c*this.n(p); },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt*1.8; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const fp=this.fp(p)/1e6, n=this.n(p), pass=this.passes(p);
    const out=[['t',s.t,'с'],['плотность электронов',p.Ne,'·10¹¹ 1/м³'],
      ['плазменная частота fp',fp,'МГц'],
      ['частота волны f',p.f,'МГц'],
      ['показатель преломления n',n,''],
      ['поведение',pass?1:0,pass?'проходит сквозь ионосферу':'ОТРАЖАЕТСЯ от ионосферы']];
    if(pass){
      out.push(['фазовая скорость c/n',this.vphase(p)/1e8,'·10⁸ м/с (> c)'],
        ['групповая скорость c·n',this.vgroup(p)/1e8,'·10⁸ м/с (< c)'],
        ['произведение скоростей',this.vphase(p)*this.vgroup(p)/(this.c*this.c),'= c²']);
    }
    return out;
  },
  graphs:[
    {label:'Показатель преломления n',unit:'',series:['n'],get(s,p){ return [SIMS.plasma.n(p),null]; }},
    {label:'Групповая скорость',unit:'·10⁸ м/с',series:['v'],get(s,p){ return [SIMS.plasma.vgroup(p)/1e8,null]; }}
  ],
  presets:[
    {name:'Низкая частота — отражается (радиосвязь)',values:{Ne:10,f:2}},
    {name:'Высокая частота — уходит в космос',values:{Ne:10,f:20}},
    {name:'Ровно на плазменной частоте',values:{Ne:10,f:9}},
    {name:'Плотная ионосфера днём',values:{Ne:40,f:5}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const fp=this.fp(p)/1e6, n=this.n(p), pass=this.passes(p);
    // Земля снизу
    ctx.fillStyle=ink3; ctx.globalAlpha=.25; ctx.fillRect(-6,-4,12,1.2); ctx.globalAlpha=1;
    v.label(ctx,'Земля',-5.4,-3.4,0,0,ink3);
    // слой ионосферы
    if(p.layer){
      ctx.fillStyle=sec; ctx.globalAlpha=.13; ctx.fillRect(-6,1.2,12,1.6); ctx.globalAlpha=1;
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(5),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(-6,1.2); ctx.lineTo(6,1.2); ctx.moveTo(-6,2.8); ctx.lineTo(6,2.8); ctx.stroke();
      ctx.setLineDash([]);
      // свободные электроны
      ctx.fillStyle=sec;
      for(let i=0;i<28;i++){
        const x=-5.7+ (i*0.41)%11.4, y=1.35+ (i*0.37)%1.3;
        ctx.beginPath(); ctx.arc(x,y,v.lw(2),0,7); ctx.fill();
      }
      v.label(ctx,`ионосфера: свободные электроны, fp = ${fp.toFixed(2)} МГц`,0,2.8,-100,-12,sec);
    }
    // передатчик
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.moveTo(-4,-2.8); ctx.lineTo(-4,-1.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4.3,-1.4); ctx.lineTo(-4,-1.9); ctx.lineTo(-3.7,-1.4); ctx.stroke();
    v.label(ctx,'передатчик',-4,-2.8,-22,16,dang);
    // траектория волны
    if(p.wave){
      /* Волна рисуется как ОДНА непрерывная линия по ломаному пути:
         от кончика антенны передатчика — до точки поворота в ионосфере — и дальше.
         Колебание откладывается по нормали к пути, а его амплитуда гасится
         на концах огибающей, поэтому линия точно упирается в антенну и в приёмник,
         а не обрывается посреди воздуха. */
      const snake=(pts,col,{tailFade=false,arrow=false}={})=>{
        // длины звеньев и полная длина пути
        const seg=[], N=220;
        let total=0;
        for(let i=1;i<pts.length;i++){
          const L=Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
          seg.push(L); total+=L;
        }
        // точка на пути по пройденной длине
        const at=(dist)=>{
          let d=clamp(dist,0,total);
          for(let i=0;i<seg.length;i++){
            if(d<=seg[i]||i===seg.length-1){
              const t=seg[i]>1e-9? d/seg[i] : 0;
              const x0=pts[i][0], y0=pts[i][1], x1=pts[i+1][0], y1=pts[i+1][1];
              const ux=(x1-x0)/(seg[i]||1), uy=(y1-y0)/(seg[i]||1);
              return {x:x0+(x1-x0)*t, y:y0+(y1-y0)*t, nx:-uy, ny:ux};
            }
            d-=seg[i];
          }
          return {x:pts[0][0],y:pts[0][1],nx:0,ny:1};
        };
        const A=0.20, k=2*Math.PI/1.35;
        ctx.strokeStyle=col; ctx.lineWidth=v.lw(2.2);
        ctx.beginPath();
        let ex=0, ey=0, edx=0, edy=0;
        for(let i=0;i<=N;i++){
          const u=i/N, d=u*total, q=at(d);
          // огибающая: 0 на старте, 1 в середине, 0 в конце (или плавное угасание в хвосте)
          const env = tailFade ? Math.sin(Math.PI*Math.min(u,0.5))*(1-clamp((u-0.72)/0.28,0,1))
                               : Math.sin(Math.PI*u);
          const off=A*env*Math.sin(k*d - s.ph*3);
          const x=q.x+q.nx*off, y=q.y+q.ny*off;
          if(i===N-1){ edx=x; edy=y; }
          if(i===N){ ex=x; ey=y; }
          i?ctx.lineTo(x,y):ctx.moveTo(x,y);
        }
        ctx.stroke();
        if(arrow && (Math.hypot(ex-edx,ey-edy)>1e-6)){
          const L=Math.hypot(ex-edx,ey-edy);
          v.arrow(ctx,ex-(ex-edx)/L*0.45,ey-(ey-edy)/L*0.45,ex,ey,col);
        }
      };
      const TX=[-4,-1.4];                       // кончик антенны передатчика
      const HIT=[0,1.2];                        // точка входа в ионосферу
      if(pass){
        // проходит насквозь: линия начинается на антенне и уходит вверх, угасая
        snake([TX,HIT,[3.6,3.7]],dang,{tailFade:true,arrow:true});
        v.label(ctx,'волна уходит в космос (спутники, космическая связь)',3.6,3.8,-160,0,acc);
        v.label(ctx,`n = ${n.toFixed(3)} < 1`,1.6,2.4,10,0,acc);
      } else {
        // отражается: одна линия от передатчика через точку поворота к приёмнику
        const RX=[4,-1.6];                      // кончик антенны приёмника
        snake([TX,HIT,RX],meas,{arrow:false});
        // точка поворота
        ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(HIT[0],HIT[1],v.lw(3.4),0,7); ctx.fill();
        v.label(ctx,'точка поворота',HIT[0],HIT[1],8,-8,meas);
        v.label(ctx,'волна отражается — дальняя радиосвязь за горизонт',3.8,-1.9,-170,14,meas);
        // приёмник: антенна начинается ровно там, где заканчивается волна
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2.4);
        ctx.beginPath(); ctx.moveTo(4,-2.8); ctx.lineTo(4,-1.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3.7,-1.6); ctx.lineTo(4,-2.1); ctx.lineTo(4.3,-1.6); ctx.stroke();
        v.label(ctx,'приёмник',4,-2.8,-20,16,meas);
      }
    }
    v.label(ctx,`f = ${p.f} МГц ${pass?'>':'<'} fp = ${fp.toFixed(2)} МГц`,0,-3.9,-58,0,pass?acc:meas);
    v.label(ctx,pass?'частота выше плазменной: n² = 1 − (fp/f)² > 0, волна проходит'
                   :'частота ниже плазменной: n² < 0, волна не может распространяться и отражается',
      0,-3.9,-150,16,ink3);
  }
}
,

/* ================== ГЛ.22: СТОЯЧИЕ ВОЛНЫ ================= */
standing:{
  title:'Стоячие волны: узлы и пучности',
  params:[
    {key:'L',label:'Длина струны L',unit:'м',min:1,max:8,step:0.1,default:6},
    {key:'n',label:'Номер гармоники n',min:1,max:8,step:1,default:3},
    {key:'v',label:'Скорость волны v',unit:'м/с',min:0.5,max:8,step:0.1,default:3},
    {key:'A',label:'Амплитуда',unit:'м',min:0.2,max:1.5,step:0.1,default:0.9},

    {type:'group',label:'Показывать'},
    {key:'parts',label:'Две встречные волны',type:'check',default:true},
    {key:'nodes',label:'Узлы и пучности',type:'check',default:true},
    {key:'env',  label:'Огибающая',type:'check',default:true},
    {key:'auto', label:'Колебания идут',type:'check',default:true}
  ],
  /* закреплённые концы: на длине L укладывается n полуволн ⇒ λ = 2L/n */
  lam(p){ return 2*p.L/p.n; },
  freq(p){ return p.v/this.lam(p); },              // f = v/λ = n·v/(2L)
  k(p){ return 2*Math.PI/this.lam(p); },
  omega(p){ return 2*Math.PI*this.freq(p); },
  /* бегущие волны навстречу друг другу */
  yRight(p,x,t){ return p.A/2*Math.sin(this.k(p)*x-this.omega(p)*t); },
  yLeft(p,x,t){ return p.A/2*Math.sin(this.k(p)*x+this.omega(p)*t); },
  /* их сумма — стоячая волна: y = A·sin(kx)·cos(ωt) */
  y(p,x,t){ return p.A*Math.sin(this.k(p)*x)*Math.cos(this.omega(p)*t); },
  nodePos(p){ const out=[]; for(let m=0;m<=p.n;m++) out.push(m*this.lam(p)/2); return out; },
  antinodePos(p){ const out=[]; for(let m=0;m<p.n;m++) out.push((m+0.5)*this.lam(p)/2); return out; },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ if(p.auto) s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0},{x:p.L,y:0}]; },
  readouts(s,p){
    return [['t',s.t,'с'],['длина струны L',p.L,'м'],['номер гармоники n',p.n,''],
      ['длина волны λ = 2L/n',this.lam(p),'м'],
      ['частота f = nv/2L',this.freq(p),'Гц'],
      ['скорость волны v',p.v,'м/с'],
      ['проверка v = λf',this.lam(p)*this.freq(p),'м/с'],
      ['узлов (с концами)',p.n+1,''],
      ['пучностей',p.n,''],
      ['расстояние между узлами λ/2',this.lam(p)/2,'м']];
  },
  graphs:[
    {label:'Смещение в пучности',unit:'м',series:['y'],
     get(s,p){ const a=SIMS.standing.antinodePos(p)[0]||0; return [SIMS.standing.y(p,a,s.t),null]; }},
    {label:'Частота гармоники',unit:'Гц',series:['f'],get(s,p){ return [SIMS.standing.freq(p),null]; }}
  ],
  presets:[
    {name:'Основной тон (n = 1)',values:{L:6,n:1,v:3,A:0.9}},
    {name:'Вторая гармония (n = 2)',values:{L:6,n:2,v:3,A:0.9}},
    {name:'Третья гармоника (n = 3)',values:{L:6,n:3,v:3,A:0.9}},
    {name:'Высокая гармоника (n = 6)',values:{L:6,n:6,v:3,A:0.9}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/((p.L+2)*PX_PER_M),(H-70)/(6*PX_PER_M)),0.002,30);
    return {x:p.L/2,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const L=p.L, lam=this.lam(p);
    // ось и закреплённые концы
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(L,0); ctx.stroke(); ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(0,-1.4); ctx.lineTo(0,1.4); ctx.moveTo(L,-1.4); ctx.lineTo(L,1.4); ctx.stroke();
    v.label(ctx,'закреплённый конец',0,-1.4,-10,20,ink3);
    v.label(ctx,'закреплённый конец',L,-1.4,-70,20,ink3);
    // огибающая
    if(p.env){
      ctx.strokeStyle=sec; ctx.globalAlpha=.4; ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.lineWidth=v.lw(1.2);
      for(const sgn of [1,-1]){
        ctx.beginPath();
        for(let i=0;i<=300;i++){ const x=L*i/300, y=sgn*p.A*Math.sin(this.k(p)*x);
          i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha=1;
    }
    // две встречные бегущие волны
    if(p.parts){
      ctx.lineWidth=v.lw(1.2); ctx.globalAlpha=.45;
      ctx.strokeStyle=acc; ctx.beginPath();
      for(let i=0;i<=300;i++){ const x=L*i/300, y=this.yRight(p,x,s.t); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      ctx.strokeStyle=meas; ctx.beginPath();
      for(let i=0;i<=300;i++){ const x=L*i/300, y=this.yLeft(p,x,s.t); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      ctx.globalAlpha=1;
      v.label(ctx,'волна вправо',L,1.7,-70,0,acc);
      v.label(ctx,'волна влево',L,1.7,-70,14,meas);
    }
    // стоячая волна (сумма)
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.6); ctx.beginPath();
    for(let i=0;i<=400;i++){ const x=L*i/400, y=this.y(p,x,s.t); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
    // узлы и пучности
    if(p.nodes){
      ctx.fillStyle=ink;
      for(const x of this.nodePos(p)){ ctx.beginPath(); ctx.arc(x,0,v.lw(4),0,7); ctx.fill(); }
      v.label(ctx,'узлы (не колеблются)',this.nodePos(p)[0],0,-4,-16,ink);
      for(const x of this.antinodePos(p)){
        ctx.strokeStyle=sec; ctx.globalAlpha=.6; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(x,-p.A*1.15); ctx.lineTo(x,p.A*1.15); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
      }
      v.label(ctx,'пучности (максимальный размах)',this.antinodePos(p)[0],p.A*1.15,-30,-10,sec);
      // разметка λ/2 между соседними узлами
      const n0=this.nodePos(p)[0], n1=this.nodePos(p)[1];
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(n0,-1.9); ctx.lineTo(n1,-1.9); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,`λ/2 = ${(lam/2).toFixed(2)} м`,(n0+n1)/2,-1.9,-26,16,ink3);
    }
    v.label(ctx,`n = ${p.n},  λ = 2L/n = ${lam.toFixed(2)} м,  f = ${this.freq(p).toFixed(2)} Гц`,L/2,2.3,-104,0,ink3);
    v.label(ctx,'узлы стоят на месте — это результат сложения двух встречных волн',L/2,2.3,-134,16,ink3);
  }
},

/* ================= ГЛ.22: ИНТЕРФЕРЕНЦИЯ ОТ ДВУХ ИСТОЧНИКОВ ================= */
interf2:{
  title:'Интерференция от двух источников (опыт Юнга)',
  params:[
    {key:'d',  label:'Расстояние между источниками d',unit:'мм',min:0.05,max:1,step:0.01,default:0.2},
    {key:'lam',label:'Длина волны λ',unit:'нм',min:400,max:700,step:10,default:550},
    {key:'Ls', label:'Расстояние до экрана L',unit:'м',min:0.5,max:5,step:0.1,default:2},
    {key:'ymm',label:'Точка наблюдения на экране y',unit:'мм',min:-20,max:20,step:0.1,default:5.5},

    {type:'group',label:'Показывать'},
    {key:'field',label:'Волновая картина',type:'check',default:true},
    {key:'plot', label:'Распределение интенсивности',type:'check',default:true},
    {key:'coh',  label:'Когерентные источники',type:'check',default:true}
  ],
  /* разность хода Δ = d·sinθ; максимумы при Δ = mλ, минимумы при Δ = (m+½)λ */
  theta(p,y){ return Math.atan2(y, p.Ls); },                       // y и Ls в метрах
  delta(p,y){ return p.d*1e-3*Math.sin(this.theta(p,y)); },
  /* интенсивность: I = 4I₀cos²(πΔ/λ) — формула Орира I = 2I₀[1+cos(kΔ)] */
  I(p,y){
    const lam=p.lam*1e-9;
    if(!p.coh) return 2;                                            // некогерентные: интенсивности просто складываются
    const ph=Math.PI*this.delta(p,y)/lam;
    return 4*Math.cos(ph)*Math.cos(ph);
  },
  /* положения максимумов на экране: y = mλL/d (при малых углах) */
  ymax(p,m){ return m*(p.lam*1e-9)*p.Ls/(p.d*1e-3); },
  spacing(p){ return (p.lam*1e-9)*p.Ls/(p.d*1e-3); },               // Δy между полосами
  order(p,y){ return this.delta(p,y)/(p.lam*1e-9); },               // порядок m = Δ/λ
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt*1.6; },
  dragPoints(p){ return [{x:4.2, y:p.ymm*0.28}]; },
  dragMove(p,idx,x,y){ p.ymm=clamp(Math.round(y/0.28*10)/10,-20,20); },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const y=p.ymm*1e-3, d=this.delta(p,y), m=this.order(p,y), I=this.I(p,y);
    const near=Math.round(m), isMax=Math.abs(m-near)<0.08, isMin=Math.abs(Math.abs(m-near)-0.5)<0.08;
    return [['t',s.t,'с'],
      ['расстояние между источниками d',p.d,'мм'],
      ['длина волны λ',p.lam,'нм'],
      ['расстояние до экрана L',p.Ls,'м'],
      ['точка наблюдения y',p.ymm,'мм'],
      ['угол θ',this.theta(p,y)*180/Math.PI,'°'],
      ['разность хода Δ = d·sinθ',d*1e9,'нм'],
      ['порядок m = Δ/λ',m,''],
      ['интенсивность (в долях I₀)',I,''],
      ['что здесь',0, !p.coh?'некогерентные: полос нет':(isMax?'СВЕТЛАЯ полоса (максимум)':(isMin?'ТЁМНАЯ полоса (минимум)':'между полосами'))],
      ['ширина полосы Δy = λL/d',this.spacing(p)*1e3,'мм']];
  },
  graphs:[
    {label:'Интенсивность в точке наблюдения',unit:'I₀',series:['I'],
     get(s,p){ return [SIMS.interf2.I(p,p.ymm*1e-3),null]; }}
  ],
  presets:[
    {name:'Опыт Юнга: светлые и тёмные полосы',values:{d:0.2,lam:550,Ls:2,ymm:5.5,coh:true}},
    {name:'Источники ближе — полосы шире',values:{d:0.1,lam:550,Ls:2,ymm:5.5,coh:true}},
    {name:'Красный свет — полосы шире синего',values:{d:0.2,lam:700,Ls:2,ymm:7,coh:true}},
    {name:'Синий свет',values:{d:0.2,lam:450,Ls:2,ymm:4.5,coh:true}},
    {name:'Некогерентные источники — картина пропадает',values:{d:0.2,lam:550,Ls:2,ymm:5.5,coh:false}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:1.2,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const S1={x:-3.4,y:0.55}, S2={x:-3.4,y:-0.55}, SCR=4.2;
    // источники
    ctx.fillStyle=dang;
    for(const S of [S1,S2]){ ctx.beginPath(); ctx.arc(S.x,S.y,0.14,0,7); ctx.fill(); }
    v.label(ctx,'источник 1',S1.x,S1.y,-56,-6,dang);
    v.label(ctx,'источник 2',S2.x,S2.y,-56,10,dang);
    ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(S1.x,S1.y); ctx.lineTo(S2.x,S2.y); ctx.stroke(); ctx.globalAlpha=1;
    v.label(ctx,`d = ${p.d} мм`,S1.x,0,-46,0,ink3);
    // круговые фронты (принцип Гюйгенса: каждый источник даёт сферические волны)
    if(p.field){
      const step=0.42;
      for(const S of [S1,S2]){
        ctx.strokeStyle=p.coh?acc:ink3; ctx.globalAlpha=.28; ctx.lineWidth=v.lw(1);
        for(let k=1;k<=18;k++){
          const r=k*step + (p.coh? (s.ph*0.1)%step : (S===S1?(s.ph*0.1)%step:(s.ph*0.083)%step));
          ctx.beginPath(); ctx.arc(S.x,S.y,r,-Math.PI/2.1,Math.PI/2.1); ctx.stroke();
        }
        ctx.globalAlpha=1;
      }
    }
    // экран
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(SCR,-3); ctx.lineTo(SCR,3); ctx.stroke();
    v.label(ctx,`экран (L = ${p.Ls} м)`,SCR,3,-30,-12,ink3);
    // картина на экране: яркость полос
    const ys=3, N=160;
    for(let i=0;i<N;i++){
      const yy=-ys+2*ys*i/N;
      const ymeters=(yy/0.28)*1e-3;
      const I=this.I(p,ymeters)/4;
      ctx.globalAlpha=clamp(I,0,1);
      ctx.fillStyle=dang;
      ctx.fillRect(SCR+0.06, yy, 0.3, 2*ys/N*1.2);
      ctx.globalAlpha=1;
    }
    // график интенсивности
    if(p.plot){
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath();
      for(let i=0;i<=300;i++){
        const yy=-ys+2*ys*i/300;
        const ymeters=(yy/0.28)*1e-3;
        const I=this.I(p,ymeters);
        const xx=SCR+0.5+I*0.42;
        i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);
      }
      ctx.stroke();
      v.label(ctx,'I(y)',SCR+1.9,ys,-8,-8,meas);
    }
    // лучи к точке наблюдения и разность хода
    const yObs=p.ymm*0.28;
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.6);
    for(const S of [S1,S2]){ ctx.beginPath(); ctx.moveTo(S.x,S.y); ctx.lineTo(SCR,yObs); ctx.stroke(); }
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(SCR,yObs,v.lw(4),0,7); ctx.fill();
    const ym=p.ymm*1e-3, m=this.order(p,ym);
    v.label(ctx,`точка y = ${p.ymm} мм`,SCR,yObs,-72,-10,meas);
    // сводка
    v.label(ctx,`Δ = d·sinθ = ${(this.delta(p,ym)*1e9).toFixed(0)} нм = ${m.toFixed(2)}·λ`,0.4,-3.4,-70,0,ink3);
    const near=Math.round(m);
    const txt = !p.coh ? 'некогерентные источники: интенсивности просто складываются, полос нет'
      : (Math.abs(m-near)<0.08 ? `разность хода целое число длин волн ⇒ СВЕТЛАЯ полоса (m = ${near})`
      : (Math.abs(Math.abs(m-near)-0.5)<0.08 ? 'разность хода полуцелая ⇒ ТЁМНАЯ полоса'
      : 'промежуточная яркость'));
    v.label(ctx,txt,0.4,-3.4,-Math.round(txt.length*3),16,p.coh?acc:ink3);
    v.label(ctx,`ширина полосы Δy = λL/d = ${(this.spacing(p)*1e3).toFixed(2)} мм`,0.4,-3.4,-84,32,ink3);
  }
},

/* ================= ГЛ.22: РЕШЁТКА И ДИФРАКЦИЯ НА ЩЕЛИ ================= */
grating:{
  title:'Дифракционная решётка и дифракция на щели',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'grating',
     options:[{v:'grating',t:'Решётка: N источников'},
              {v:'slit',   t:'Дифракция на одной щели'}]},
    {key:'N',  label:'Число щелей N (решётка)',min:2,max:20,step:1,default:5},
    {key:'d',  label:'Период решётки d',unit:'мкм',min:1,max:10,step:0.1,default:3},
    {key:'a',  label:'Ширина щели a',unit:'мкм',min:0.5,max:10,step:0.1,default:3},
    {key:'lam',label:'Длина волны λ',unit:'нм',min:400,max:700,step:10,default:550},

    {type:'group',label:'Показывать'},
    {key:'marks',label:'Отметки максимумов',type:'check',default:true},
    {key:'scheme',label:'Схема опыта',type:'check',default:true}
  ],
  /* решётка из N щелей: I = I₀·[sin(Nφ/2)/sin(φ/2)]², φ = 2πd·sinθ/λ.
     Главные максимумы при d·sinθ = mλ, и они тем острее, чем больше N. */
  Igrating(p,th){
    const lam=p.lam*1e-9, d=p.d*1e-6, N=p.N;
    const ph=2*Math.PI*d*Math.sin(th)/lam;
    const den=Math.sin(ph/2);
    if(Math.abs(den)<1e-9) return N*N;
    const r=Math.sin(N*ph/2)/den;
    return r*r;
  },
  /* одна щель: I = I₀·[sin α / α]², α = πa·sinθ/λ. Минимумы при a·sinθ = mλ. */
  Islit(p,th){
    const lam=p.lam*1e-9, a=p.a*1e-6;
    const al=Math.PI*a*Math.sin(th)/lam;
    if(Math.abs(al)<1e-9) return 1;
    const r=Math.sin(al)/al;
    return r*r;
  },
  I(p,th){ return p.mode==='grating'? this.Igrating(p,th)/(p.N*p.N) : this.Islit(p,th); },
  /* углы главных максимумов решётки: sinθ = mλ/d */
  maxAngles(p){
    const lam=p.lam*1e-9, d=p.d*1e-6, out=[];
    for(let m=-8;m<=8;m++){ const s=m*lam/d; if(Math.abs(s)<=1) out.push({m,th:Math.asin(s)}); }
    return out;
  },
  /* углы минимумов одной щели: sinθ = mλ/a */
  minAngles(p){
    const lam=p.lam*1e-9, a=p.a*1e-6, out=[];
    for(let m=-8;m<=8;m++){ if(m===0) continue; const s=m*lam/a; if(Math.abs(s)<=1) out.push({m,th:Math.asin(s)}); }
    return out;
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    if(p.mode==='grating'){
      const ms=this.maxAngles(p);
      const out=[['t',s.t,'с'],['число щелей N',p.N,''],['период d',p.d,'мкм'],['длина волны λ',p.lam,'нм'],
        ['главных максимумов',ms.length,''],
        ['условие максимума','','d·sinθ = mλ']];
      for(const q of ms.filter(q=>q.m>=0&&q.m<=3)) out.push([`максимум m = ${q.m}: угол`,q.th*180/Math.PI,'°']);
      out.push(['относительная ширина максимума ~1/N',1/p.N,''],
        ['яркость главного максимума ~N²',p.N*p.N,'I₀']);
      return out;
    }
    const mins=this.minAngles(p);
    const first=mins.find(q=>q.m===1);
    return [['t',s.t,'с'],['ширина щели a',p.a,'мкм'],['длина волны λ',p.lam,'нм'],
      ['условие минимума','','a·sinθ = mλ'],
      ['первый минимум: угол',first?first.th*180/Math.PI:0,'°'],
      ['полуширина центрального максимума',first?first.th*180/Math.PI:0,'°'],
      ['минимумов всего',mins.length,''],
      ['чем уже щель',0,'тем шире центральный максимум']];
  },
  graphs:[
    {label:'Интенсивность в центре',unit:'I₀',series:['I'],get(s,p){ return [SIMS.grating.I(p,0),null]; }}
  ],
  presets:[
    {name:'Две щели (как у Юнга)',values:{mode:'grating',N:2,d:3,lam:550}},
    {name:'Пять щелей — максимумы острее',values:{mode:'grating',N:5,d:3,lam:550}},
    {name:'Двадцать щелей — настоящая решётка',values:{mode:'grating',N:20,d:3,lam:550}},
    {name:'Красный свет отклоняется сильнее',values:{mode:'grating',N:20,d:3,lam:700}},
    {name:'Дифракция на широкой щели',values:{mode:'slit',a:6,lam:550}},
    {name:'Узкая щель — свет расходится широко',values:{mode:'slit',a:1.2,lam:550}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const X0=-5, XS=-2.2, XSCR=4.6, HH=3.2;

    // падающая плоская волна
    if(p.scheme){
      ctx.strokeStyle=dang; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1.2);
      for(let x=X0;x<XS-0.3;x+=0.45){ ctx.beginPath(); ctx.moveTo(x,-HH*0.8); ctx.lineTo(x,HH*0.8); ctx.stroke(); }
      ctx.globalAlpha=1;
      v.arrow(ctx,X0+0.3,HH*0.95,X0+1.1,HH*0.95,dang);
      v.label(ctx,'плоская волна',X0,HH,10,-8,dang);
    }

    // преграда со щелями
    ctx.fillStyle=ink;
    if(p.mode==='grating'){
      const N=p.N, span=Math.min(2.6, N*0.22), step=N>1? (2*span)/(N-1) : 0;
      const slits=[];
      for(let i=0;i<N;i++){ const y=(N>1? -span+i*step : 0); slits.push(y); }
      // сама преграда
      let prev=-HH;
      for(const y of slits){
        ctx.fillRect(XS-0.07, prev, 0.14, (y-0.07)-prev);
        prev=y+0.07;
      }
      ctx.fillRect(XS-0.07, prev, 0.14, HH-prev);
      // вторичные волны из каждой щели (принцип Гюйгенса)
      ctx.strokeStyle=acc; ctx.globalAlpha=.22; ctx.lineWidth=v.lw(1);
      for(const y of slits){ for(let k=1;k<=7;k++){
        ctx.beginPath(); ctx.arc(XS,y,k*0.36,-Math.PI/2.3,Math.PI/2.3); ctx.stroke(); } }
      ctx.globalAlpha=1;
      v.label(ctx,`${N} щелей, период d = ${p.d} мкм`,XS,HH,-40,-12,ink3);
    } else {
      const half=clamp(p.a*0.16,0.15,1.4);
      ctx.fillRect(XS-0.07,-HH,0.14,HH-half);
      ctx.fillRect(XS-0.07,half,0.14,HH-half);
      // вторичные источники по ширине щели
      ctx.strokeStyle=acc; ctx.globalAlpha=.22; ctx.lineWidth=v.lw(1);
      for(let i=0;i<6;i++){ const y=-half+2*half*(i+0.5)/6;
        for(let k=1;k<=6;k++){ ctx.beginPath(); ctx.arc(XS,y,k*0.4,-Math.PI/2.3,Math.PI/2.3); ctx.stroke(); } }
      ctx.globalAlpha=1;
      v.label(ctx,`щель шириной a = ${p.a} мкм`,XS,half,10,-10,ink3);
      v.label(ctx,'каждая точка щели — источник вторичной волны (Гюйгенс)',XS,-HH,-20,20,ink3);
    }

    // экран и картина
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(XSCR,-HH); ctx.lineTo(XSCR,HH); ctx.stroke();
    const thMax=Math.PI/2.6;
    const yOf=th=>Math.tan(th)*2.6;
    // яркость
    const NB=200;
    for(let i=0;i<NB;i++){
      const th=-thMax+2*thMax*i/NB;
      const y=yOf(th); if(Math.abs(y)>HH) continue;
      const I=this.I(p,th);
      ctx.globalAlpha=clamp(I,0,1); ctx.fillStyle=dang;
      ctx.fillRect(XSCR+0.06,y-0.03,0.3,0.09);
      ctx.globalAlpha=1;
    }
    // кривая интенсивности
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath();
    let started=false;
    for(let i=0;i<=400;i++){
      const th=-thMax+2*thMax*i/400, y=yOf(th);
      if(Math.abs(y)>HH){ started=false; continue; }
      const xx=XSCR+0.5+this.I(p,th)*1.5;
      if(!started){ ctx.moveTo(xx,y); started=true; } else ctx.lineTo(xx,y);
    }
    ctx.stroke();
    v.label(ctx,'I(θ)',XSCR+2.1,HH*0.9,-8,0,meas);

    // отметки максимумов / минимумов
    if(p.marks){
      if(p.mode==='grating'){
        for(const q of this.maxAngles(p)){
          const y=yOf(q.th); if(Math.abs(y)>HH) continue;
          ctx.strokeStyle=sec; ctx.globalAlpha=.5; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
          ctx.beginPath(); ctx.moveTo(XS,0); ctx.lineTo(XSCR,y); ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha=1;
          v.label(ctx,`m=${q.m}`,XSCR,y,-26,-4,sec);
        }
      } else {
        for(const q of this.minAngles(p)){
          const y=yOf(q.th); if(Math.abs(y)>HH) continue;
          ctx.fillStyle=ink3; ctx.beginPath(); ctx.arc(XSCR+0.06,y,v.lw(2.5),0,7); ctx.fill();
          v.label(ctx,`мин m=${q.m}`,XSCR,y,-40,-4,ink3);
        }
      }
    }
    // сводка
    const txt = p.mode==='grating'
      ? `d·sinθ = mλ — главные максимумы; при N = ${p.N} они в ${p.N}² = ${p.N*p.N} раз ярче и в ${p.N} раз уже`
      : `a·sinθ = mλ — минимумы; чем уже щель, тем шире центральный максимум`;
    v.label(ctx,txt,0,-HH-0.5,-Math.round(txt.length*3),0,ink3);
  }
}
,
});
