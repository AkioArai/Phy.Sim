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
    {key:'trail',  label:'След частицы (колебание)',type:'check',default:true},
    {key:'phasor', label:'Вектор фазы частицы',type:'check',default:true}
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
  /* фаза пробной частицы, приведённая к [0, 2π) */
  phase(p,t){ const sgn=p.dir==='right'?1:-1, f=this.k(p)*p.px-sgn*this.omega(p)*t, T=2*Math.PI;
    return ((f%T)+T)%T; },
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
      ['фаза частицы φ = kx − ωt',this.phase(p,s.t)*180/Math.PI,'° (по модулю 360°)'],
      ['смещение частицы y',this.yAt(p,p.px,s.t),'м'],
      ['скорость частицы',this.vyAt(p,p.px,s.t),'м/с']];
  },
  graphs:[
    {label:'Смещение частицы y(t)',unit:'м',series:['y'],get(s,p){ return [SIMS.wave.yAt(p,p.px,s.t),null]; }},
    {label:'Скорость частицы',unit:'м/с',наклон:0,series:['vy'],get(s,p){ return [SIMS.wave.vyAt(p,p.px,s.t),null]; }}
  ],
  presets:[
    {name:'Основная волна',values:{A:1,lam:4,f:0.5,dir:'right'}},
    {name:'Короче волна — та же частота, меньше скорость',values:{A:1,lam:2,f:0.5,dir:'right'}},
    {name:'Выше частота — быстрее волна',values:{A:1,lam:4,f:1.5,dir:'right'}},
    {name:'Волна влево',values:{A:1,lam:4,f:0.5,dir:'left'}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const w=p.phasor?23.5:20;
    const scale=clamp(Math.min((W-60)/(w*PX_PER_M),(H-60)/(8*PX_PER_M)),0.002,30);
    return {x:p.phasor?-1.75:0,y:0,scale};
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
    /* Вектор фазы: смещение частицы — проекция вращающегося вектора длины A
       на вертикаль. Угол вектора и есть фаза kx − ωt. Пунктир связывает конец
       вектора с частицей: высота у них одна. */
    if(p.phasor){
      const cx=-11.6, ph=this.phase(p,s.t), ex=cx+p.A*Math.cos(ph), ey=p.A*Math.sin(ph);
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.arc(cx,0,p.A,0,7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-p.A-0.2,0); ctx.lineTo(cx+p.A+0.2,0); ctx.stroke();
      v.arrow(ctx,cx,0,ex,ey,dang);
      ctx.strokeStyle=dang; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(3),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(p.px,yp); ctx.stroke(); ctx.setLineDash(EMPTY_DASH); ctx.globalAlpha=1;
      // дуга угла фазы
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.2); ctx.beginPath();
      for(let k=0;k<=24;k++){ const a=ph*k/24, r=p.A*0.3; k?ctx.lineTo(cx+r*Math.cos(a),r*Math.sin(a)):ctx.moveTo(cx+r,0); }
      ctx.stroke();
      v.label(ctx,`φ = ${(ph*180/Math.PI).toFixed(0)}°`,cx,-p.A,-24,16,dang);
      v.label(ctx,'y — проекция вектора',cx,-p.A,-44,32,ink3);
    }
    // подсказки — на фиксированном расстоянии в пикселях под волной
    { const k=1/ppm(), c=0;
      v.text(ctx,'частицы колеблются поперёк, а волна переносит энергию вдоль',c,-p.A-56*k,ink3,10,'center');
      v.text(ctx,'пробную частицу можно перетаскивать',c,-p.A-72*k,ink3,10,'center'); }
  }
},

/* ================= ГЛ.20: ЭЛЕКТРОМАГНИТНАЯ ВОЛНА ================= */
emwave:{
  title:'Электромагнитная волна: E, B и скорость света',
  /* Сцена в условном масштабе: длину волны на экране задаёт отдельный
     ползунок. Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* 3.3.0: объёмный вид по умолчанию. В плоском виде B приходилось рисовать
     косой синусоидой «в перспективе», и она читалась как вторая волна рядом
     с E, а не поперёк неё. В объёме E колеблется в вертикальной плоскости,
     B — в горизонтальной, и их перпендикулярность видна, если повернуть. */
  rotate3d(p){ return !!p.d3; },
  rot0:{yaw:-0.5,pitch:0.32},
  hudAware:true,
  params:[
    {key:'d3',label:'Объёмный вид: E и B в перпендикулярных плоскостях',type:'check',default:true},
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
  dragPoints(p){ return p.d3?[]:[{x:p.px,y:0}]; },
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
    if(p.d3){ const scale=clamp(Math.min((W-20)/(15*PX_PER_M),(H-20)/(10*PX_PER_M)),0.002,30); return {x:0,y:0,scale}; }
    const scale=clamp(Math.min((W-60)/(20*PX_PER_M),(H-60)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw3(ctx,s,v,p){
    const meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const пр0=v.p3(), OY=0.3, пр=(x,y,z)=>{ const q=пр0(x,y,z); return [q[0],q[1]+OY]; };
    const X0=-6.5, X1=6.5, A=2.0, e=x=>this.Eat(p,x,s.t)/p.E0, b=x=>this.Bat(p,x,s.t)/this.Bamp(p);
    const путь=(f,col,w)=>{ ctx.strokeStyle=col; ctx.lineWidth=v.lw(w); ctx.beginPath();
      for(let i=0;i<=300;i++){ const x=X0+(X1-X0)*i/300, q=f(x); i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); } ctx.stroke(); };
    const стрелка=(x,y,z,col,al)=>{ const a=пр(x,0,0), c=пр(x,y,z); if(Math.hypot(c[0]-a[0],c[1]-a[1])<0.05) return; ctx.globalAlpha=al; v.arrow(ctx,a[0],a[1],c[0],c[1],col); ctx.globalAlpha=1; };
    const грань=(pts,col)=>{ ctx.fillStyle=col; ctx.globalAlpha=.05; ctx.beginPath(); pts.forEach((q,i)=>{ const c=пр(q[0],q[1],q[2]); i?ctx.lineTo(c[0],c[1]):ctx.moveTo(c[0],c[1]); }); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; };
    грань([[X0,0,-A],[X1,0,-A],[X1,0,A],[X0,0,A]],dang);
    if(p.Bfld) грань([[X0,-A,0],[X1,-A,0],[X1,A,0],[X0,A,0]],sec);
    { const a=пр(X0-0.3,0,0), c=пр(X1+0.8,0,0); v.arrow(ctx,a[0],a[1],c[0],c[1],ink3); v.text(ctx,'x — туда бежит волна',c[0],c[1]-0.35,ink3,10,'right'); }
    for(let x=X0;x<=X1+1e-9;x+=0.65) стрелка(x,0,A*e(x),dang,.5);
    путь(x=>пр(x,0,A*e(x)),dang,2.4);
    /* E вдоль z, волна бежит вдоль +x, значит B — вдоль −y: E × B смотрит по ходу волны */
    if(p.Bfld){ for(let x=X0;x<=X1+1e-9;x+=0.65) стрелка(x,-A*b(x),0,sec,.5); путь(x=>пр(x,-A*b(x),0),sec,2.2); }
    { const q=пр(X0,0,A*1.15); v.text(ctx,'E',q[0],q[1],dang,13,'center',true); }
    if(p.Bfld){ const q=пр(X0,-A*1.25,0); v.text(ctx,'B',q[0],q[1],sec,13,'center',true); }
    { const x=clamp(p.px,X0,X1), o=пр(x,0,0);
      ctx.save(); ctx.lineWidth=v.lw(3.5); стрелка(x,0,A*e(x),dang,1); if(p.Bfld) стрелка(x,-A*b(x),0,sec,1); ctx.restore();
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(o[0],o[1],v.lw(6),0,7); ctx.stroke(); }
    if(p.poynt){ const a=пр(X1-1.6,0,A+0.6), c=пр(X1+0.4,0,A+0.6); v.arrow(ctx,a[0],a[1],c[0],c[1],meas); v.text(ctx,'перенос энергии',c[0],c[1]+0.35,meas,10,'right',true); }
    const c=this.cLight(), lam=this.lambda(p), f=this.freq(p);
    const fs = f>=1e12?`${(f/1e12).toPrecision(3)} ТГц`:(f>=1e9?`${(f/1e9).toPrecision(3)} ГГц`:`${(f/1e6).toPrecision(3)} МГц`);
    const ls = lam>=1?`${lam.toPrecision(3)} м`:(lam>=1e-6?`${(lam*1e6).toPrecision(3)} мкм`:`${(lam*1e9).toPrecision(3)} нм`);
    v.text(ctx,`f = ${fs},  λ = c/f = ${ls},  E/B = c`,0,-4.2,ink,10,'center',true);
    v.text(ctx,'E, B и направление бега взаимно перпендикулярны; поля в фазе',0,-4.6,ink3,9,'center');
  },
  draw(ctx,s,v,p){
    if(p.d3) return this.draw3(ctx,s,v,p);
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
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
    const out=[['мощность источника P',p.P,'Вт'],
      ['расстояние до детектора r',c.r1,'м'],
      ['интенсивность I = P/4πr²',c.I1,'Вт/м²'],
      ['при удвоении r станет',this.Iof(p.P,c.r1*2),'Вт/м² (вчетверо меньше)']];
    if(p.two) out.push(['от второго источника',c.I2,'Вт/м²'],['суммарная интенсивность',c.I,'Вт/м²']);
    return out;
  },
  graphs:[],
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
  /* Сцена — график сигнала и его гармоник. Поэтому ни осей с числами, ни
     надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
    const out=[['форма',0,{square:'прямоугольный',saw:'пилообразный',tri:'треугольный'}[p.shape]],
      ['число гармоник N',p.N,''],['ошибка приближения',err,'']];
    for(let n=1;n<=Math.min(p.N,5);n++){ const a=this.coef(p.shape,n);
      if(a) out.push([`амплитуда ${n}-й гармоники`,a,'']); }
    return out;
  },
  graphs:[],
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
  /* Сцена — ход лучей: важны углы, а не расстояния. Поэтому ни осей с
     числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
  /* Перетаскивание луча мышью и пальцем. Раньше его здесь не было вовсе —
     угол менялся только полем параметра, хотя тянуть сам луч куда нагляднее.
     Плоская граница: плотная среда СНИЗУ, луч приходит из левой нижней
     четверти, поэтому ручка стоит в (−L·sinθ, −L·cosθ).
     Световод: тем же жестом меняем угол входа в торец. */
  dragPoints(p){
    if(p.mode==='fiber'){
      const a=p.angIn*Math.PI/180, X0=-5.6;
      return [{x:X0-2.2, y:2.2*Math.tan(a)}];
    }
    const a=p.ang*Math.PI/180, L=4.2;
    return [{x:-L*Math.sin(a), y:-L*Math.cos(a)}];
  },
  dragMove(p,idx,x,y){
    if(p.mode==='fiber'){
      const X0=-5.6, dx=Math.max(0.3,X0-x);        // насколько ручка левее торца
      p.angIn=clamp(Math.round(Math.atan2(y,dx)*180/Math.PI*2)/2,0,60);
      return;
    }
    // угол от нормали, отсчитанной вниз: луч живёт в нижней полуплоскости
    p.ang=clamp(Math.round(Math.atan2(-x,-y)*180/Math.PI*2)/2,0,89);
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  readouts(s,p){
    const c=this.critical(p), out=[['n₁ (плотная)',this.n1(p),''],['n₂ (менее плотная)',this.n2(p),'']];
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
  geom(p){ return {H:0.8, L:p.len}; },
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
  /* 3.5.0: выводы — пояснением под рисунком, а не подписями с пиксельными сдвигами */
  пояснения(p){
    const c=this.critical(p), ink=css('--ink-2'), ink3=css('--ink-3');
    if(p.mode==='flat'){
      if(c===null) return [['свет идёт в более плотную среду — полного отражения быть не может',ink,true]];
      if(this.isTIR(p)) return [[`θ₁ = ${p.ang}° ≥ θпр = ${c.toFixed(1)}° — весь свет остаётся внутри`,css('--measure'),true],
        ['преломлённого луча нет вовсе: это и есть полное внутреннее отражение',ink3]];
      return [[`θ₁ = ${p.ang}° < θпр = ${c.toFixed(1)}° — свет делится на два луча`,ink,true],
        [`чем ближе к пределу, тем больше уходит в отражение: сейчас ${this.reflectPct(p).toFixed(1)} %`,ink3]];
    }
    const acc=this.acceptance(p);
    if(c===null) return [['оболочка плотнее сердцевины — волокно не удержит свет',css('--danger'),true]];
    if(this.guided(p)) return [[`на стенку свет падает под ${this.wallAngle(p).toFixed(1)}° ≥ θпр = ${c.toFixed(1)}° — отражается полностью`,css('--accent'),true],
      [`NA = √(n₁² − n₂²) = ${this.NA(p).toFixed(3)}: волокно принимает лучи в конусе ±${acc.toFixed(1)}°`,ink],
      ['на схеме сердцевина утолщена: в настоящем волокне отражений миллионы',ink3]];
    return [[`на стенку свет падает под ${this.wallAngle(p).toFixed(1)}° < θпр = ${c.toFixed(1)}° — часть уходит в оболочку`,css('--danger'),true],
      [`угол входа ${p.angIn}° больше приёмного ${acc.toFixed(1)}° — свет теряется`,ink]];
  },
  fit(p,vp){
    if(p.mode==='fiber'){ const L=p.len; return fitСПояснением(vp,L+4.8,6.4,-1.2,0.6,this.пояснения(p)); }
    return fitСПояснением(vp,12.4,8.8,0,0,this.пояснения(p));
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
    const c=this.critical(p), строки=this.пояснения(p);
    v.занятьНиз(строки);
    if(p.mode==='flat') this.drawFlat(ctx,s,v,p,{acc,meas,dang,sec,ink,ink3,c});
    else this.drawFiber(ctx,s,v,p,{acc,meas,dang,sec,ink,ink3,c});
    v.пояснение(ctx,строки);
  },
  drawFlat(ctx,s,v,p,C){
    const {acc,meas,dang,sec,ink,ink3,c}=C;
    const th=p.ang*Math.PI/180, S1=Math.sin(th), C1=Math.cos(th), L=4.2;
    /* Плотная среда СНИЗУ, менее плотная сверху: только так возможен полный
       внутренний отражённый луч. Свет идёт снизу слева к точке на границе. */
    ctx.fillStyle=sec; ctx.globalAlpha=.10; ctx.fillRect(-6,-4.2,12,4.2); ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.stroke();
    v.text(ctx,`${this.nameOf[p.mat1]}, n₁ = ${this.n1(p).toFixed(3)}`,5.85,-0.35,sec,10,'right',true);
    v.text(ctx,`${this.nameOf[p.mat2]}, n₂ = ${this.n2(p).toFixed(3)}`,-5.85,3.95,ink3,10,'left',true);
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
    v.label(ctx,'падающий',ix,iy,-20,12,dang);
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
      v.label(ctx,`преломлённый: ${(100-rPct).toFixed(1)} %`,L*S2,L*C2,8,-8,acc);
      this.arcBetween(ctx,v,0,1,S2,C2,1.25,acc,`θ₂ = ${r.toFixed(1)}°`);
    }
    // точка падения
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(0,0,v.lw(3),0,7); ctx.fill();
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
          /* угол out отсчитан от НОРМАЛИ к стенке (она вертикальна), а не от
             оси волокна: до 3.5.0 здесь были перепутаны sin и cos, и почти
             скользящий луч рисовался круто вверх */
          ctx.lineTo(last[0]+1.6*Math.sin(out), last[1]+sgn*1.6*Math.cos(out));
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
    const accAng=this.acceptance(p), ac=Math.min(accAng,75)*Math.PI/180, rc=2.0;
    ctx.strokeStyle=meas; ctx.globalAlpha=.30; ctx.lineWidth=v.lw(1.2);
    for(const sg of [1,-1]){
      ctx.beginPath(); ctx.moveTo(X0,0);
      ctx.lineTo(X0-rc*Math.cos(ac), sg*rc*Math.sin(ac)); ctx.stroke();
    }
    ctx.globalAlpha=1;
    v.label(ctx,accAng>=90?'принимает свет под любым углом (NA ≥ 1)':`конус приёма ±${accAng.toFixed(1)}°`,X0-rc*Math.cos(ac),-rc*Math.sin(ac),-4,16,meas);

  }
},

/* ============ КОНСТРУКТОР ОПТИЧЕСКОЙ СКАМЬИ ============
   Одна линза — это отдельная симуляция; здесь их можно поставить в ряд и
   собрать настоящий прибор: лупу, микроскоп, телескоп Кеплера и Галилея.

   Считаем двумя способами сразу, и они должны сходиться:
     1) ХОД ЛУЧЕЙ. Луч задаётся высотой y и наклоном u = dy/dx. На свободном
        промежутке длиной d: y += u·d. Тонкая линза меняет только наклон:
        u −= y/f. Это и есть матричная оптика, только без матриц.
     2) ФОРМУЛА ТОНКОЙ ЛИНЗЫ, применённая по очереди: изображение от одной
        линзы служит предметом для следующей. Для линзы с предметом на
        расстоянии a слева: 1/b = 1/f − 1/a, увеличение m = −b/a.
        Отрицательное a означает мнимый предмет (пучок уже сходился), и
        формула это спокойно переваривает.
   Полное увеличение — произведение увеличений ступеней.                    */
bench:{
  title:'Конструктор оптической скамьи: лупа, микроскоп, телескоп',
  /* Сцена — оптическая скамья со своей шкалой в сантиметрах. Поэтому ни осей
     с числами, ни надписи «сетка N м». */
  schema:true,
  params:[
    {key:'demo',label:'Готовый прибор',type:'select',default:'micro',
     options:[{v:'single',t:'Одна линза'},
              {v:'loupe', t:'Лупа: предмет ближе фокуса'},
              {v:'micro', t:'Микроскоп: объектив + окуляр'},
              {v:'kepler',t:'Телескоп Кеплера: две собирающие'},
              {v:'galileo',t:'Телескоп Галилея: рассеивающий окуляр'}]},
    {key:'n',  label:'Сколько линз',min:1,max:3,step:1,default:2},
    {key:'x0', label:'Положение предмета',unit:'см',min:-14,max:6,step:0.1,default:-7},
    {key:'h',  label:'Высота предмета',unit:'см',min:0.2,max:3,step:0.1,default:1},
    /* 3.5.0: телескоп смотрит на далёкий предмет — на входе параллельный
       пучок. До этого «телескопы» строили изображение предмета в 9 см от
       объектива, и итоговая картинка не имела отношения к телескопу. */
    {key:'far', label:'Предмет очень далеко (параллельный пучок)',type:'check',default:false},
    {key:'alpha',label:'Угол, под которым виден далёкий предмет',unit:'°',min:0.5,max:8,step:0.5,default:3,если:p=>p.far},

    {type:'group',label:'Линзы (слева направо)'},
    {key:'x1',label:'Линза 1: положение',unit:'см',min:-12,max:12,step:0.1,default:-4},
    {key:'f1',label:'Линза 1: фокусное F₁',unit:'см',min:-12,max:12,step:0.1,default:2},
    {key:'x2',label:'Линза 2: положение',unit:'см',min:-12,max:12,step:0.1,default:6},
    {key:'f2',label:'Линза 2: фокусное F₂',unit:'см',min:-12,max:12,step:0.1,default:3},
    {key:'x3',label:'Линза 3: положение',unit:'см',min:-12,max:12,step:0.1,default:10},
    {key:'f3',label:'Линза 3: фокусное F₃',unit:'см',min:-12,max:12,step:0.1,default:4},

    {type:'group',label:'Показывать'},
    {key:'rays', label:'Лучей от вершины предмета',min:3,max:15,step:2,default:7},
    {key:'foci', label:'Фокусы линз',type:'check',default:true},
    {key:'img',  label:'Промежуточные изображения',type:'check',default:true},
    {key:'axis', label:'Оптическую ось и шкалу',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  /* Готовые схемы: меняют сразу число линз, их положения и фокусы. */
  DEMOS:{
    single: {n:1,x0:-7, h:1,  x1:-4,f1:2,far:false},
    loupe:  {n:1,x0:-5.4,h:1, x1:-4,f1:2,far:false},
    micro:  {n:2,x0:-5.1,h:0.6,x1:-4,f1:1, x2:6,f2:3,far:false},
    kepler: {n:2,x0:-13,h:1,  x1:-6,f1:9, x2:4,f2:1,far:true,alpha:3},
    galileo:{n:2,x0:-13,h:1,  x1:-6,f1:9, x2:2,f2:-1,far:true,alpha:3}
  },
  ОПИСАНИЯ:{
    single:'одна линза: 1/a + 1/b = 1/F, увеличение m = −b/a',
    loupe:'лупа: предмет ближе фокуса — глаз видит мнимое, прямое, увеличенное изображение',
    micro:'микроскоп: объектив даёт действительное увеличенное изображение, окуляр рассматривает его как лупа',
    kepler:'телескоп Кеплера: задний фокус объектива совпадает с передним фокусом окуляра — пучок выходит параллельным, картинка перевёрнута',
    galileo:'телескоп Галилея: рассеивающий окуляр стоит перед фокусом объектива — пучок выходит параллельным, картинка прямая'
  },
  /* совпадает ли собранная схема с выбранным прибором (иначе описание прибора не выводим) */
  какПрибор(p){ const D=this.DEMOS[p.demo]; if(!D) return false;
    return Object.keys(D).every(k=>k==='alpha'||k==='x0'||k==='h'||(typeof D[k]==='number'?Math.abs(p[k]-D[k])<1e-9:p[k]===D[k])); },
  /* угол наклона входящих лучей для далёкого предмета */
  uIn(p){ return Math.tan((p.alpha||3)*Math.PI/180); },
  lensAt(p,i){ return {x:p['x'+i], f:p['f'+i]}; },
  lenses(p){
    const out=[];
    for(let i=1;i<=Math.max(1,Math.min(3,Math.round(p.n)));i++){
      const L=this.lensAt(p,i);
      if(isFinite(L.x)&&isFinite(L.f)&&Math.abs(L.f)>1e-6) out.push(L);
    }
    return out.sort((a,b)=>a.x-b.x);            // всегда слева направо
  },
  /* Последовательное применение формулы тонкой линзы. */
  chain(p){
    const Ls=this.lenses(p);
    let ox=p.x0, oh=p.h, mtot=1, steps=[], i0=0;
    if(p.far && Ls.length){
      /* далёкий предмет: первая линза строит изображение в своей фокальной
         плоскости, высота −F·tgα; угловое увеличение считаем трассировкой */
      const L=Ls[0], ih=-L.f*this.uIn(p);
      steps.push({L,a:Infinity,b:L.f,m:NaN,ix:L.x+L.f,ih,real:L.f>0});
      ox=L.x+L.f; oh=ih; i0=1; mtot=NaN;
    }
    for(const L of Ls.slice(i0)){
      const a=L.x-ox;                            // расстояние от предмета до линзы
      let b, m;
      if(Math.abs(a)<1e-9){ b=0; m=1; }          // предмет в самой линзе
      else {
        const inv=1/L.f-1/a;
        b = Math.abs(inv)<1e-12 ? Infinity : 1/inv;
        m = isFinite(b) ? -b/a : Infinity;
      }
      const ix = isFinite(b) ? L.x+b : Infinity;
      const ih = isFinite(m) ? m*oh : Infinity;
      steps.push({L,a,b,m,ix,ih,real:isFinite(b)&&b>0});
      mtot*= isFinite(m)?m:1;
      ox=ix; oh=ih;
    }
    // угловое увеличение: луч через центр первой линзы, наклон на выходе / на входе
    let уг=NaN;
    if(p.far && Ls.length){ let x=Ls[0].x, y=0, u=this.uIn(p);
      for(const L of Ls){ y+=u*(L.x-x); x=L.x; u-=y/L.f; }
      уг=u/this.uIn(p); }
    return {Ls,steps,mtot,x:ox,h:oh,уг};
  },
  /* Трассировка одного луча через все линзы: список изломов. */
  trace(p,y0,u0,xEnd,xStart){
    const Ls=this.lenses(p);
    const x00=xStart==null?p.x0:xStart;
    const pts=[[x00,y0]];
    let x=x00, y=y0, u=u0;
    for(const L of Ls){
      if(L.x<=x) continue;
      y+=u*(L.x-x); x=L.x;
      pts.push([x,y]);
      u-=y/L.f;                                  // тонкая линза меняет только наклон
    }
    y+=u*(xEnd-x); pts.push([xEnd,y]);
    return pts;
  },
  init(p){ return {t:0,event:null,__stop:null,demo:null}; },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
    // выбор готового прибора применяется один раз, дальше всё крутится руками
    if(s.demo!==p.demo){ s.demo=p.demo; Object.assign(p,this.DEMOS[p.demo]||{}); }
  },
  anchors(s,p){
    const out=[{x:p.x0,y:0},{x:p.x0,y:p.h}];
    for(const L of this.lenses(p)) out.push({x:L.x,y:0});
    return out;
  },
  /* Предмет и линзы двигаются мышью прямо по скамье. */
  dragPoints(p){
    const Ls=this.lenses(p);
    const out=[p.far&&Ls.length?{x:-13,y:-this.uIn(p)*(Ls[0].x+13)}:{x:p.x0,y:p.h}];
    for(let i=1;i<=Math.round(p.n);i++) out.push({x:p['x'+i],y:0});
    return out;
  },
  dragMove(p,idx,x,y){
    if(idx===0){
      if(p.far){ const Ls=this.lenses(p); if(Ls.length) p.alpha=clamp(Math.round(Math.atan2(-y,Math.max(0.5,Ls[0].x-x))*180/Math.PI*2)/2,0.5,8); return; }
      p.x0=clamp(+x.toFixed(1),-14,6); p.h=clamp(+Math.abs(y).toFixed(1),0.2,3); return; }
    p['x'+idx]=clamp(+x.toFixed(1),-12,12);
  },
  readouts(s,p){
    const c=this.chain(p);
    const out=[['t',s.t,'с'],['линз в схеме',c.Ls.length,'']];
    if(p.far) out.push(['предмет','очень далеко',''],['виден под углом α',p.alpha,'°']);
    else out.push(['предмет: положение',p.x0,'см'],['предмет: высота',p.h,'см']);
    c.steps.forEach((q,i)=>{
      const n=i+1;
      out.push([`линза ${n}: F`,q.L.f,'см']);
      out.push([`      расстояние до предмета a`,q.a,'см']);
      out.push([`      до изображения b (1/b = 1/F − 1/a)`,q.b,'см']);
      out.push([`      увеличение m = −b/a`,q.m,'']);
      out.push([`      изображение`,NaN,q.real?'действительное':'мнимое']);
    });
    if(p.far) out.push(['угловое увеличение',c.уг,'×'],['для двух линз −F₁/F₂',c.Ls.length===2?-c.Ls[0].f/c.Ls[1].f:NaN,'×']);
    else out.push(['ПОЛНОЕ увеличение',c.mtot,'×'],
             ['по модулю',Math.abs(c.mtot),'×'],
             ['ориентация',NaN,c.mtot<0?'перевёрнутое':'прямое'],
             ['итоговое изображение: положение',c.x,'см'],
             ['итоговое изображение: высота',c.h,'см']);
    return out;
  },
  graphs:[
    {label:'Полное увеличение',unit:'×',series:['m'],
     get(s,p){ return [SIMS.bench.chain(p).mtot,null]; }},
    {label:'Положение итогового изображения',unit:'см',series:['x'],
     get(s,p){ const c=SIMS.bench.chain(p); return [isFinite(c.x)?c.x:null,null]; }}
  ],
  presets:[
    {name:'Лупа: мнимое прямое увеличенное',values:{demo:'loupe',rays:7}},
    {name:'Микроскоп: объектив даёт действительное, окуляр — лупа',values:{demo:'micro',rays:7}},
    {name:'Телескоп Кеплера: перевёрнутое, увеличение F₁/F₂',values:{demo:'kepler',rays:7}},
    {name:'Телескоп Галилея: прямое, окуляр рассеивающий',values:{demo:'galileo',rays:7}},
    {name:'Одна линза: проверка формулы',values:{demo:'single',rays:9}}
  ],
  ctxTools(p){
    return [
      {label:'Добавить линзу',   on:q=>{ if(q.n<3){ q.n=Math.round(q.n)+1;
        const i=q.n; q['x'+i]=clamp((q['x'+(i-1)]||0)+4,-12,12); q['f'+i]=2.5; } }},
      {label:'Убрать последнюю', on:q=>{ if(q.n>1) q.n=Math.round(q.n)-1; }},
      {label:'Все линзы собирающие', on:q=>{ for(let i=1;i<=3;i++) q['f'+i]=Math.abs(q['f'+i]); }},
      {label:'Развернуть последнюю линзу (собирающая ↔ рассеивающая)',
       on:q=>{ const i=Math.round(q.n); q['f'+i]=-q['f'+i]; }}
    ];
  },
  пояснения(p){
    const c=this.chain(p), m=c.mtot, ink=css('--ink-2'), ink3=css('--ink-3'), out=[];
    if(p.far){
      const пар=Math.abs(c.steps.length?(c.steps[c.steps.length-1].b):0)>1e5||!isFinite(c.x);
      out.push([isFinite(c.уг)?`угловое увеличение ${Math.abs(c.уг).toFixed(2)}× · картинка ${c.уг<0?'перевёрнутая':'прямая'}${c.Ls.length===2?` · −F₁/F₂ = ${(-c.Ls[0].f/c.Ls[1].f).toFixed(2)}`:''}`:'',ink,true]);
      out.push([пар?'пучок на выходе параллельный — глаз видит далёкий предмет под бо́льшим углом':'пучок на выходе не параллельный: окуляр сдвинут с фокуса объектива',ink3]);
    } else out.push([isFinite(m)
      ?`полное увеличение ${Math.abs(m).toFixed(2)}× · изображение ${m<0?'перевёрнутое':'прямое'} (увеличения ступеней перемножаются)`
      :'лучи выходят параллельным пучком — изображение в бесконечности',ink,true]);
    if(this.какПрибор(p)) out.push([this.ОПИСАНИЯ[p.demo],css('--accent')]);
    out.push(['линза меняет только наклон луча: u → u − y/F; изображение одной линзы — предмет для следующей',ink3]);
    return out;
  },
  fit(p,vp){ return fitСПояснением(vp,29,9.6,0,-0.2,this.пояснения(p)); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'),
          dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    const mid=t=>-Math.round(String(t).length*3.05);
    const c=this.chain(p), X0=-15, X1=15, строки=this.пояснения(p);
    v.занятьНиз(строки);

    // ---- оптическая ось и шкала
    if(p.axis){
      ctx.strokeStyle=ink3; ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(X0,0); ctx.lineTo(X1,0); ctx.stroke();
      for(let x=-14;x<=14;x+=2){
        ctx.beginPath(); ctx.moveTo(x,-0.16); ctx.lineTo(x,0.16); ctx.stroke();
      }
      ctx.globalAlpha=1;
      v.label(ctx,'оптическая ось, см',12.4,0,-96,16,ink3);
    }

    /* ---- лучи. Целим их в АПЕРТУРУ первой линзы, а не разбрасываем веером
       наклонов: иначе большая часть лучей пролетала мимо стекла и картинка
       превращалась в пучок случайных прямых. */
    const HL=3.0;                                  // полувысота линзы на рисунке
    const nr=Math.max(3,Math.round(p.rays));
    const first=c.Ls[0];
    ctx.strokeStyle=acc; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1.2);
    for(let i=0;i<nr;i++){
      const yt=(i/(nr-1)*2-1)*HL*0.86;             // точка входа на первой линзе
      let pts;
      if(p.far && first){ const u=this.uIn(p); pts=this.trace(p,yt-u*(first.x-X0),u,X1,X0); }
      else {
        let u;
        if(first && Math.abs(first.x-p.x0)>1e-6) u=(yt-p.h)/(first.x-p.x0);
        else u=(i/(nr-1)-0.5)*1.1;
        pts=this.trace(p,p.h,u,X1);
      }
      ctx.beginPath();
      pts.forEach((q,j)=>j?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));
      ctx.stroke();
    }
    ctx.globalAlpha=1;

    // ---- линзы
    c.Ls.forEach((L,i)=>{
      const conv=L.f>0, Hh=3.0;
      ctx.strokeStyle=conv?acc:sec; ctx.lineWidth=v.lw(2.2);
      ctx.beginPath(); ctx.moveTo(L.x,-Hh); ctx.lineTo(L.x,Hh); ctx.stroke();
      // наконечники: у собирающей наружу, у рассеивающей внутрь
      const d=0.34;
      ctx.beginPath();
      if(conv){
        ctx.moveTo(L.x-d,-Hh+d); ctx.lineTo(L.x,-Hh); ctx.lineTo(L.x+d,-Hh+d);
        ctx.moveTo(L.x-d, Hh-d); ctx.lineTo(L.x, Hh); ctx.lineTo(L.x+d, Hh-d);
      } else {
        ctx.moveTo(L.x-d,-Hh); ctx.lineTo(L.x,-Hh+d); ctx.lineTo(L.x+d,-Hh);
        ctx.moveTo(L.x-d, Hh); ctx.lineTo(L.x, Hh-d); ctx.lineTo(L.x+d, Hh);
      }
      ctx.stroke();
      const nl=`${i+1}: F = ${L.f} см`;
      v.label(ctx,nl,L.x,Hh,mid(nl),-12,conv?acc:sec);
      if(p.foci){
        ctx.fillStyle=ink3;
        for(const fx of [L.x-Math.abs(L.f),L.x+Math.abs(L.f)]){
          ctx.beginPath(); ctx.arc(fx,0,v.lw(2.6),0,7); ctx.fill();
        }
        v.label(ctx,'F',L.x+Math.abs(L.f),0,-3,15,ink3);
      }
    });

    // ---- предмет
    if(p.far){ const u=this.uIn(p), q=first?-u*(first.x+13):0;
      ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(-13,q,v.lw(4),0,7); ctx.fill();
      v.label(ctx,`свет далёкого предмета, α = ${p.alpha}°`,-13,q,-10,-14,dang); }
    else { v.arrow(ctx,p.x0,0,p.x0,p.h,dang);
      v.label(ctx,'предмет',p.x0,p.h,-26,-12,dang); }

    // ---- промежуточные и итоговое изображения
    /* Промежуточное изображение микроскопа бывает в разы выше кадра, поэтому
       стрелку подрезаем по краю сцены и честно помечаем обрез. Точная высота
       всё равно есть в показаниях. */
    const HY=4.0;
    c.steps.forEach((q,i)=>{
      if(!isFinite(q.ix)||!isFinite(q.ih)) return;
      const last=(i===c.steps.length-1);
      if(!last && !p.img) return;
      const col = last ? ok : meas;
      const cut=Math.abs(q.ih)>HY, yv=clamp(q.ih,-HY,HY);
      ctx.save();
      if(!q.real) ctx.setLineDash([v.lw(4),v.lw(3)]);   // мнимое — пунктиром
      v.arrow(ctx,q.ix,0,q.ix,yv,col);
      ctx.restore();
      const nm = last ? 'итоговое' : `изобр. ${i+1}`;
      const t=`${nm}: ${q.real?'действ.':'мнимое'}, ${q.ih.toFixed(2)} см${cut?' ↓':''}`;
      v.label(ctx,t,q.ix,yv,mid(t),q.ih>=0?-12:14,col);
    });

    v.пояснение(ctx,строки);
  }
}
,
lens:{
  title:'Тонкая линза: построение изображения',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'kind',label:'Тип линзы',type:'select',default:'conv',
     options:[{v:'conv',t:'Собирающая (положительная)'},
              {v:'div', t:'Рассеивающая (отрицательная)'}]},
    {key:'f',  label:'Фокусное расстояние |F|',unit:'м',min:0.4,max:3,step:0.1,default:1.5},

    {type:'group',label:'Предмет (точку можно перетаскивать в любую четверть)'},
    {key:'side',label:'Сторона от линзы',type:'select',default:'left',
     options:[{v:'left', t:'Слева — свет идёт вправо'},
              {v:'right',t:'Справа — свет идёт влево'}]},
    {key:'updown',label:'Относительно оси',type:'select',default:'up',
     options:[{v:'up',  t:'Выше оси'},
              {v:'down',t:'Ниже оси'}]},
    {key:'d',  label:'Расстояние до линзы d',unit:'м',min:0.2,max:9,step:0.1,default:3.5},
    {key:'h',  label:'Высота предмета h',unit:'м',min:0.2,max:2.5,step:0.1,default:1},

    {type:'group',label:'Показывать'},
    {key:'rays',   label:'Построение лучами',type:'check',default:true},
    {key:'ray3',   label:'Третий луч (через передний фокус F)',type:'check',default:false},
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
  /* Обозначения — как в учебниках: F — передний фокус (со стороны предмета),
     F′ — задний (со стороны, куда уходит свет). Параллельный оси луч после
     собирающей линзы идёт через F′. До 3.5.0 фокусы были закреплены за
     сторонами чертежа («справа F, слева F′») — и для предмета слева луч шёл
     «через F», вразрез с обычным обозначением. */
  focusName(p){ return 'F′'; },
  сторонаЗаднего(p){ return p.side==='right' ? 'слева' : 'справа'; },
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
    const out=[['фокусное расстояние F',F,'м'],
      ['оптическая сила D = 1/F',this.D(p),'дптр'],
      ['расстояние до предмета d',p.d,'м'],
      ['высота предмета h',p.h,'м'],
      ['четверть',0,`${p.side==='right'?'справа':'слева'} от линзы, ${p.updown==='down'?'ниже':'выше'} оси`],
      ['параллельный луч после линзы',p.kind==='conv'?`идёт через F′ (${this.сторонаЗаднего(p)})`:'расходится, будто вышел из F','']];
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
  graphs:[],
  presets:[
    {name:'За 2F: действительное, перевёрнутое, уменьшенное',values:{kind:'conv',f:1.5,d:5,h:1}},
    {name:'В точке 2F: равное по величине',values:{kind:'conv',f:1.5,d:3,h:1}},
    {name:'Между F и 2F: увеличенное (проектор)',values:{kind:'conv',f:1.5,d:2.2,h:1}},
    {name:'В фокусе: изображения нет',values:{kind:'conv',f:1.5,d:1.5,h:1}},
    {name:'Ближе фокуса: лупа — мнимое, прямое',values:{kind:'conv',f:1.5,d:0.9,h:1}},
    {name:'Рассеивающая: всегда мнимое, уменьшенное',values:{kind:'div',f:1.5,d:3,h:1}},
    {name:'Четверть I: слева сверху',values:{kind:'conv',f:1.5,d:4,h:1.2,side:'left',updown:'up'}},
    {name:'Четверть II: слева снизу',values:{kind:'conv',f:1.5,d:4,h:1.2,side:'left',updown:'down'}},
    {name:'Четверть III: справа сверху, свет идёт влево',values:{kind:'conv',f:1.5,d:4,h:1.2,side:'right',updown:'up'}},
    {name:'Четверть IV: справа снизу, свет идёт влево',values:{kind:'conv',f:1.5,d:4,h:1.2,side:'right',updown:'down'}}
  ],
  пояснения(p){
    const dp=this.dPrime(p), g=this.gamma(p), k=this.kindOf(p), F=this.F(p);
    const out=[[`F = ${F.toFixed(2)} м, D = 1/F = ${this.D(p).toFixed(2)} дптр`,css('--accent'),true]];
    if(isFinite(dp)){
      out.push([`1/d + 1/d′ = 1/F: d′ = ${dp.toFixed(2)} м;  Γ = −d′/d = ${g.toFixed(2)} (${Math.abs(g).toFixed(2)}×)`,css('--ink-2')],
        [`изображение: ${k.text}`,k.real?css('--danger'):css('--second'),true]);
    } else out.push(['предмет ровно в фокусе — лучи после линзы параллельны, изображения нет',css('--ink-2'),true]);
    out.push([p.kind==='conv'
      ?`свет идёт ${p.side==='right'?'влево':'вправо'}: параллельный оси луч после линзы проходит через задний фокус F′`
      :`свет идёт ${p.side==='right'?'влево':'вправо'}: параллельный оси луч расходится так, будто вышел из переднего фокуса F`,css('--ink-3')]);
    return out;
  },
  fit(p,vp){
    const dp=this.dPrime(p);
    const span=clamp(Math.max(p.d,isFinite(dp)?Math.abs(dp):0,p.f*3)*2.3, 8, 26);
    const hy=Math.max(span*0.5, (Math.max(p.h, isFinite(this.H(p))?Math.min(Math.abs(this.H(p)),span*0.4):0)+0.8)*2);
    return fitСПояснением(vp,span,hy,0,0,this.пояснения(p));
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const F=this.F(p), af=Math.abs(F), dp=this.dPrime(p), g=this.gamma(p), H=this.H(p);
    const conv=p.kind==='conv';
    const span=Math.max(p.d,isFinite(dp)?Math.abs(dp):0,af*3)*1.35+1, строки=this.пояснения(p);
    v.занятьНиз(строки);

    // главная оптическая ось
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.moveTo(-span,0); ctx.lineTo(span,0); ctx.stroke();
    v.arrow(ctx,span-0.6,0,span,0,ink);

    // линза: вертикальный отрезок со стрелками (собирающая — наружу, рассеивающая — внутрь)
    const LH=Math.max(2.2, p.h*1.6);
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.6);
    ctx.beginPath(); ctx.moveTo(0,-LH); ctx.lineTo(0,LH); ctx.stroke();
    const tip=(y,dir)=>{ ctx.beginPath();
      ctx.moveTo(-0.22,y-dir*0.28); ctx.lineTo(0,y); ctx.lineTo(0.22,y-dir*0.28); ctx.stroke(); };
    if(conv){ tip(LH,1); tip(-LH,-1); } else { tip(LH,-1); tip(-LH,1); }
    v.label(ctx,conv?'собирающая линза':'рассеивающая линза',0,LH,-40,-16,acc);

    // отметки F, 2F, 3F по обе стороны
    if(p.marks){
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4);
      for(let n=1;n<=3;n++){
        for(const sgn of [-1,1]){
          const x=sgn*n*af;
          ctx.beginPath(); ctx.moveTo(x,-0.22); ctx.lineTo(x,0.22); ctx.stroke();
          // F — со стороны предмета, F′ — со стороны, куда уходит свет
          const заднийФ=(sgn>0)===(p.side!=='right');
          const lab=(n===1?'F':`${n}F`)+(заднийФ?'′':'');
          const active=(n===1)&&(заднийФ===conv);
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
      // фокус, через который пошёл (или из которого «вышел») луч 1
      { const fx=MX(conv?af:-af);
        ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(fx,0,v.lw(3.6),0,7); ctx.fill(); }

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
      /* у собирающей — луч через передний фокус F; у рассеивающей — луч,
         нацеленный в задний фокус за линзой: после линзы оба идут параллельно оси */
      const xt=conv?-af:af;
      if(p.ray3 && Math.abs(xt+p.d)>1e-6){
        const yAtLens = p.h + p.d*((0-p.h)/(xt+p.d));
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

    v.пояснение(ctx,строки);
  }
}
,

/* ================== ГЛ.21: ЭНЕРГИЯ И ИМПУЛЬС ИЗЛУЧЕНИЯ ================= */
radpressure:{
  title:'Импульс излучения и световое давление',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
    const out=[['мощность источника',p.P,'Вт'],
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
  graphs:[],
  presets:[
    {name:'Чёрная мишень: p = U/c',values:{surf:'black',P:1000,r:4,A:2}},
    {name:'Зеркало: импульс вдвое больше',values:{surf:'mirror',P:1000,r:4,A:2}},
    {name:'Радиометр Крукса',values:{surf:'radio',P:1000,r:3,A:2}},
    {name:'Ближе к источнику — сильнее давление',values:{surf:'mirror',P:1000,r:1.5,A:2}},
    {name:'Солнечный парус: большая площадь',values:{surf:'mirror',P:5000,r:3,A:20}}
  ],
  пояснения(p){
    const I=this.I(p), out=[[`I = P/4πr² = ${I.toFixed(2)} Вт/м² · давление ${(this.pressure(p)*1e6).toFixed(3)} мкПа`,css('--ink-2'),true]];
    if(p.surf==='radio') out.push(['по свету зеркальная лопасть получает вдвое больший импульс, чем чёрная',css('--second')],
      ['но настоящая вертушка Крукса крутится наоборот: остаточный газ толкает нагретую чёрную сторону сильнее света',css('--ink-3')]);
    else out.push([p.surf==='mirror'?'зеркало разворачивает импульс фотонов: p = 2I/c — вдвое больше, чем у чёрной мишени'
      :'чёрная мишень поглощает импульс фотонов: p = I/c',css('--ink-3')]);
    return out;
  },
  fit(p,vp){ const span=Math.max(p.r*1.9,8); return fitСПояснением(vp,span,span*0.62,p.r/2,0,this.пояснения(p),50); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const I=this.I(p), F=this.force(p), строки=this.пояснения(p);
    v.занятьНиз(строки);
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
    }
    // сила давления
    if(p.force){
      const fl=clamp(0.3+Math.log10(1+F*1e6)*0.5,0.3,2);
      v.arrow(ctx,p.r+0.2,0,p.r+0.2+fl,0,acc);
      v.label(ctx,`F = ${(F*1e6).toFixed(3)} мкН`,p.r+0.2+fl,0,6,-6,acc);
    }
    v.пояснение(ctx,строки);
  }
},

/* ================= ГЛ.21: ПОКАЗАТЕЛЬ ПРЕЛОМЛЕНИЯ ================= */
refraction:{
  title:'Показатель преломления и преломление света',
  /* Сцена — ход луча через границу: важны углы, а не расстояния. Поэтому ни
     осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
    {key:'norm',label:'Нормаль',type:'check',default:true},
    {key:'fronts',label:'Волновые фронты (почему луч ломается)',type:'check',default:true}
  ],
  c:2.99792458e8,
  /* Показатели при λ = 550 нм и дисперсия по Коши: n(λ) = n₀ + B·(1/λ² − 1/550²).
     До 3.5.0 длина волны меняла только «длину волны в среде», а угол
     преломления от неё не зависел — хотя именно от этого радуга и призма. */
  N:{air:1.0,water:1.333,glass:1.50,diamond:2.417},
  B:{air:0,water:2850,glass:4000,diamond:11900},       // нм²
  nOf(m,lam){ return this.N[m]+this.B[m]*(1/(lam*lam)-1/(550*550)); },
  n1(p){ return this.nOf(p.mat1,p.lam||550); },
  n2(p){ return this.nOf(p.mat2,p.lam||550); },
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
  /* доля отражённого света по Френелю (неполяризованный свет) */
  R(p){
    const t2=this.theta2(p); if(t2===null) return 1;
    const n1=this.n1(p), n2=this.n2(p), c1=Math.cos(p.ang*Math.PI/180), c2=Math.cos(t2*Math.PI/180);
    const rs=(n1*c1-n2*c2)/(n1*c1+n2*c2), rp=(n1*c2-n2*c1)/(n1*c2+n2*c1);
    return (rs*rs+rp*rp)/2;
  },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt*0.8; },
  dragPoints(p){
    const a=p.ang*Math.PI/180, R=3.2;
    return [{x:-R*Math.sin(a), y:R*Math.cos(a)}];
  },
  dragMove(p,idx,x,y){
    /* Луч падает из левой верхней четверти; угол отсчитывается от нормали.
       За пределами четверти угол мягко упирается в 0° или 89°. */
    const a=Math.atan2(-x, y)*180/Math.PI;      // левая верхняя четверть → 0…90°
    p.ang=clamp(Math.round(a*2)/2, 0, 89);      // шаг 0.5° — плавнее слайдера
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const n1=this.n1(p), n2=this.n2(p), t2=this.theta2(p), cr=this.critical(p), R=this.R(p);
    const out=[['показатель среды 1: n₁',n1,''],
      ['показатель среды 2: n₂',n2,''],
      ['скорость в среде 1: v = c/n',this.vIn(n1)/1e8,'·10⁸ м/с'],
      ['скорость в среде 2: v = c/n',this.vIn(n2)/1e8,'·10⁸ м/с'],
      ['угол падения θ₁',p.ang,'°']];
    if(t2===null){
      out.push(['угол преломления','полное внутреннее отражение',''],
        ['предельный угол θкр',cr!==null?cr:0,'°']);
    } else {
      out.push(['угол преломления θ₂',t2,'°'],
        ['проверка n₁·sinθ₁',n1*Math.sin(p.ang*Math.PI/180),''],
        ['n₂·sinθ₂',n2*Math.sin(t2*Math.PI/180),'']);
      if(cr!==null) out.push(['предельный угол θкр',cr,'°']);
    }
    out.push(['отражается (Френель)',R*100,'%'],['проходит',(1-R)*100,'%'],
      ['длина волны в вакууме',p.lam,'нм'],
      ['длина волны в среде 2: λ/n',p.lam/n2,'нм'],
      ['частота (не меняется)',this.c/(p.lam*1e-9)/1e12,'ТГц']);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Воздух → стекло: луч прижимается к нормали',values:{mat1:'air',mat2:'glass',ang:45}},
    {name:'Воздух → вода',values:{mat1:'air',mat2:'water',ang:50}},
    {name:'Стекло → воздух: луч отходит от нормали',values:{mat1:'glass',mat2:'air',ang:30}},
    {name:'Полное внутреннее отражение (стекло→воздух)',values:{mat1:'glass',mat2:'air',ang:60}},
    {name:'Алмаз: маленький предельный угол — игра света',values:{mat1:'diamond',mat2:'air',ang:30}},
    {name:'Дисперсия: фиолетовый ломается сильнее красного',values:{mat1:'air',mat2:'diamond',ang:60,lam:400}},
    {name:'Почти скользящее падение: отражается больше половины',values:{mat1:'air',mat2:'glass',ang:85}}
  ],
  пояснения(p){
    const n1=this.n1(p), n2=this.n2(p), a1=p.ang*Math.PI/180, t2=this.theta2(p), cr=this.critical(p), R=this.R(p);
    const ink='--ink-2', v=n=>(this.vIn(n)/1e8).toFixed(2);
    if(t2===null) return [
      ['ПОЛНОЕ ВНУТРЕННЕЕ ОТРАЖЕНИЕ: свет не выходит во вторую среду',css('--danger'),true],
      [`угол падения ${p.ang}° больше предельного ${cr.toFixed(1)}°: sinθ₂ = n₁sinθ₁/n₂ = ${(n1*Math.sin(a1)/n2).toFixed(3)} > 1`,css(ink)]];
    const ближе=t2<p.ang-1e-9;
    return [
      [`n₁·sinθ₁ = ${(n1*Math.sin(a1)).toFixed(3)} = n₂·sinθ₂`,css(ink),true],
      [p.ang<1e-9?'по нормали луч не отклоняется, хотя скорость меняется':(ближе
        ?`луч прижался к нормали: во второй среде свет медленнее (${v(n2)} против ${v(n1)}·10⁸ м/с)`
        :`луч отошёл от нормали: во второй среде свет быстрее (${v(n2)} против ${v(n1)}·10⁸ м/с)`),css(ink)],
      [`отражается ${(R*100).toFixed(1)} %, проходит ${((1-R)*100).toFixed(1)} % (формулы Френеля)${cr!==null?` · предельный угол ${cr.toFixed(1)}°`:''}`,css('--ink-3')]];
  },
  fit(p,vp){ return fitСПояснением(vp,10.4,8.4,0,0,this.пояснения(p)); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const n1=this.n1(p), n2=this.n2(p), a1=p.ang*Math.PI/180, t2=this.theta2(p), cr=this.critical(p), R=this.R(p);
    const L=3.6, S1=Math.sin(a1), C1=Math.cos(a1), строки=this.пояснения(p);
    v.занятьНиз(строки);
    // среды: чем больше n, тем гуще заливка
    const гуще=n=>clamp(0.04+(n-1)*0.16,0.04,0.3);
    ctx.fillStyle=sec; ctx.globalAlpha=гуще(n1); ctx.fillRect(-5,0,10,4); ctx.globalAlpha=гуще(n2); ctx.fillRect(-5,-4,10,4); ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke();
    const nm={air:'воздух',water:'вода',glass:'стекло',diamond:'алмаз'};
    v.text(ctx,`${nm[p.mat1]}, n₁ = ${n1.toFixed(3)}`,-4.85,3.72,ink3,10,'left',true);
    v.text(ctx,`${nm[p.mat2]}, n₂ = ${n2.toFixed(3)}`,-4.85,-3.72,ink3,10,'left',true);
    if(p.norm){
      КС.пунктир(ctx,v,0,-3.9,0,3.9,ink3,.6);
      v.text(ctx,'нормаль',0.1,3.75,ink3,9.5,'left');
    }
    // волновые фронты: цвет — цвет самой волны; в плотной среде они теснее (λ/n)
    if(p.fronts){
      const col=КС.цветλ(p.lam), Λ=0.8*p.lam/550, u=((s.ph%1)+1)%1, hw=0.3;
      const фронт=(dx,dy,d)=>{ const x=dx*d, y=dy*d; ctx.beginPath(); ctx.moveTo(x-dy*hw,y+dx*hw); ctx.lineTo(x+dy*hw,y-dx*hw); ctx.stroke(); };
      ctx.strokeStyle=col; ctx.lineWidth=v.lw(1.8); ctx.globalAlpha=.6;
      for(let d=Λ/n1*(1-u)+1e-6; d<L; d+=Λ/n1) фронт(-S1,C1,d);                 // к точке падения
      if(t2!==null){ const a2=t2*Math.PI/180; ctx.globalAlpha=.75*clamp(1-R,0.3,1);
        for(let d=Λ/n2*u; d<L; d+=Λ/n2) фронт(Math.sin(a2),-Math.cos(a2),d); }
      if(p.refl){ ctx.globalAlpha=.75*clamp(Math.sqrt(R),0.15,1);
        for(let d=Λ/n1*u; d<L; d+=Λ/n1) фронт(S1,C1,d); }
      ctx.globalAlpha=1;
    }
    // луч со стрелками по ходу света; толщина и яркость — доля энергии
    const луч=(dx,dy,from,to,col,w,al)=>{ ctx.save(); ctx.globalAlpha=al; ctx.strokeStyle=col; ctx.lineWidth=v.lw(w);
      ctx.beginPath(); ctx.moveTo(dx*from,dy*from); ctx.lineTo(dx*to,dy*to); ctx.stroke();
      const m=(from+to)/2; v.arrow(ctx,dx*(m-0.3*Math.sign(to-from)),dy*(m-0.3*Math.sign(to-from)),dx*(m+0.25*Math.sign(to-from)),dy*(m+0.25*Math.sign(to-from)),col); ctx.restore(); };
    луч(-S1,C1,L,0,dang,2.4,1);
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(-L*S1,L*C1,v.lw(5),0,7); ctx.fill();
    v.label(ctx,'падающий',-L*S1,L*C1,-30,-12,dang);
    if(p.refl){
      луч(S1,C1,0,L,meas,0.8+2.2*Math.sqrt(R),clamp(0.25+R,0.25,1));
      v.label(ctx,t2===null?'отражённый: весь свет':`отражённый: ${(R*100).toFixed(1)} %`,L*S1,L*C1,-20,-12,meas);
    }
    if(t2!==null){
      const a2=t2*Math.PI/180, tx=Math.sin(a2), ty=-Math.cos(a2);
      луч(tx,ty,0,L,acc,0.8+1.8*(1-R),1);
      v.label(ctx,`преломлённый: ${((1-R)*100).toFixed(1)} %`,L*tx,L*ty,-40,14,acc);
    }
    if(p.arcs){
      const arc=(ax,ay,bx,by,rad,col,txt)=>SIMS.tir.arcBetween(ctx,v,ax,ay,bx,by,rad,col,txt);
      arc(0,1,-S1,C1,1.0,dang,`θ₁ = ${p.ang}°`);
      if(p.refl) arc(0,1,S1,C1,1.35,meas,`θ₁′ = ${p.ang}°`);
      if(t2!==null){ const r2=t2*Math.PI/180; arc(0,-1,Math.sin(r2),-Math.cos(r2),1.0,acc,`θ₂ = ${t2.toFixed(1)}°`); }
      if(cr!==null){
        const cx2=-L*Math.sin(cr*Math.PI/180), cy2=L*Math.cos(cr*Math.PI/180);
        КС.пунктир(ctx,v,0,0,cx2,cy2,dang,.45);
        v.label(ctx,`предельный ${cr.toFixed(1)}°`,cx2,cy2,-30,-6,dang);
      }
    }
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(0,0,v.lw(3),0,7); ctx.fill();
    v.пояснение(ctx,строки);
  }
},

/* ================= ГЛ.21: ИЗЛУЧЕНИЕ В ИОНИЗОВАННОЙ СРЕДЕ ================= */
plasma:{
  title:'Радиоволны в ионосфере: плазменная частота',
  /* Сцена — схема: до ионосферы сотня километров, а нарисована она рядом.
     Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  timeless:true,
  params:[
    {key:'Ne',label:'Плотность электронов N',unit:'10¹¹ 1/м³',min:0.5,max:50,step:0.5,default:10},
    {key:'f', label:'Частота волны f',unit:'МГц',min:0.5,max:40,step:0.1,default:5},
    /* 3.5.0: угол выхода луча. Раньше рисовался наклонный луч, а решение
       «отразится или пройдёт» принималось как для вертикального. Слой —
       однородная плазма: наклонный луч отражается полностью, если n < cos β,
       отсюда закон секанса f < fp/sin β. */
    {key:'beta',label:'Угол луча над горизонтом β',unit:'°',min:15,max:90,step:1,default:50},

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
  β(p){ return (p.beta==null?90:p.beta)*Math.PI/180; },
  /* максимально применимая частота для этого угла: fp/sin β */
  muf(p){ return this.fp(p)/Math.sin(this.β(p)); },
  passes(p){ return p.f*1e6 > this.muf(p); },
  /* фазовая скорость c/n (> c) и групповая c·n (< c); их произведение = c² */
  vphase(p){ const n=this.n(p); return n>0? this.c/n : Infinity; },
  vgroup(p){ return this.c*this.n(p); },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt*1.8; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const fp=this.fp(p)/1e6, n=this.n(p), pass=this.passes(p);
    const out=[['плотность электронов',p.Ne,'·10¹¹ 1/м³'],
      ['плазменная частота fp',fp,'МГц'],
      ['частота волны f',p.f,'МГц'],
      ['угол луча над горизонтом β',p.beta==null?90:p.beta,'°'],
      ['наибольшая отражаемая частота fp/sin β',this.muf(p)/1e6,'МГц'],
      ['показатель преломления n',n,''],
      ['поведение',pass?'проходит сквозь ионосферу':'ОТРАЖАЕТСЯ от ионосферы','']];
    if(n>0){
      out.push(['фазовая скорость c/n',this.vphase(p)/1e8,'·10⁸ м/с (> c)'],
        ['групповая скорость c·n',this.vgroup(p)/1e8,'·10⁸ м/с (< c)'],
        ['произведение скоростей',this.vphase(p)*this.vgroup(p)/(this.c*this.c),'= c²']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Низкая частота — отражается (радиосвязь)',values:{Ne:10,f:2,beta:50}},
    {name:'Высокая частота — уходит в космос',values:{Ne:10,f:20,beta:50}},
    {name:'Вертикально: отражается всё ниже fp',values:{Ne:10,f:8.5,beta:90}},
    {name:'Та же частота полого — уже отражается (закон секанса)',values:{Ne:10,f:12,beta:25}},
    {name:'Плотная ионосфера днём',values:{Ne:40,f:5,beta:50}}
  ],
  пояснения(p){
    const fp=this.fp(p)/1e6, muf=this.muf(p)/1e6, n=this.n(p), pass=this.passes(p), b=p.beta==null?90:p.beta;
    return [[`f = ${p.f} МГц ${pass?'>':'<'} fp/sin β = ${fp.toFixed(2)}/sin ${b}° = ${muf.toFixed(2)} МГц — волна ${pass?'проходит':'отражается'}`,pass?css('--accent'):css('--measure'),true],
      [n>0?`в слое n = √(1 − (fp/f)²) = ${n.toFixed(3)}; ${pass?`n > cos β = ${Math.cos(this.β(p)).toFixed(3)}, луч преломляется и уходит`:`n < cos β = ${Math.cos(this.β(p)).toFixed(3)} — полное внутреннее отражение`}`
          :'f < fp: n² = 1 − (fp/f)² < 0, волна в плазме не распространяется вовсе',css('--ink-2')],
      ['чем положе луч, тем выше частота, которая ещё отражается: на этом держится дальняя КВ-связь',css('--ink-3')]];
  },
  geom(p){ const b=this.β(p), dx=2.6/Math.tan(b); return {b,dx}; },
  fit(p,vp){ const {dx}=this.geom(p); return fitСПояснением(vp,Math.max(12,2*dx+5),8.2,0,-0.2,this.пояснения(p)); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const fp=this.fp(p)/1e6, n=this.n(p), pass=this.passes(p), {b,dx}=this.geom(p), W=Math.max(6,dx+2.5), строки=this.пояснения(p);
    v.занятьНиз(строки);
    // Земля снизу
    ctx.fillStyle=ink3; ctx.globalAlpha=.25; ctx.fillRect(-W,-4,2*W,1.2); ctx.globalAlpha=1;
    v.text(ctx,'Земля',-W+0.2,-3.4,ink3,10,'left');
    // слой ионосферы
    if(p.layer){
      ctx.fillStyle=sec; ctx.globalAlpha=.13; ctx.fillRect(-W,1.2,2*W,1.6); ctx.globalAlpha=1;
      КС.пунктир(ctx,v,-W,1.2,W,1.2,sec,.8); КС.пунктир(ctx,v,-W,2.8,W,2.8,sec,.8);
      ctx.fillStyle=sec;
      for(let i=0;i<Math.round(2.4*W);i++){ const x=-W+0.3+(i*0.41)%(2*W-0.6), y=1.35+(i*0.37)%1.3;
        ctx.beginPath(); ctx.arc(x,y,v.lw(2),0,7); ctx.fill(); }
      v.text(ctx,`ионосфера: свободные электроны, fp = ${fp.toFixed(2)} МГц`,-W+0.2,3.1,sec,10,'left',true);
    }
    const антенна=(x,col)=>{ ctx.strokeStyle=col; ctx.lineWidth=v.lw(2.4);
      ctx.beginPath(); ctx.moveTo(x,-2.8); ctx.lineTo(x,-1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-0.3,-1.4); ctx.lineTo(x,-1.9); ctx.lineTo(x+0.3,-1.4); ctx.stroke(); };
    const TX=[-dx,-1.4], HIT=[0,1.2];
    антенна(TX[0],dang); v.text(ctx,'передатчик',TX[0],-3.0,dang,10,'center');
    // угол луча над горизонтом
    SIMS.tir.arcBetween(ctx,v,1,0,Math.cos(b),Math.sin(b),0.9,ink3,`β = ${p.beta==null?90:p.beta}°`,TX[0],TX[1]);
    if(p.wave){
      const snake=(pts,col,tailFade,arrow)=>{
        const seg=[]; let total=0;
        for(let i=1;i<pts.length;i++){ const L=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); seg.push(L); total+=L; }
        const at=d=>{ d=clamp(d,0,total);
          for(let i=0;i<seg.length;i++){ if(d<=seg[i]||i===seg.length-1){ const t=seg[i]>1e-9?d/seg[i]:0,
            x0=pts[i][0],y0=pts[i][1],x1=pts[i+1][0],y1=pts[i+1][1], ux=(x1-x0)/(seg[i]||1), uy=(y1-y0)/(seg[i]||1);
            return {x:x0+(x1-x0)*t,y:y0+(y1-y0)*t,nx:-uy,ny:ux}; } d-=seg[i]; }
          return {x:pts[0][0],y:pts[0][1],nx:0,ny:1}; };
        const A=0.18, k=2*Math.PI/1.1, N=260; let ex=0,ey=0,edx=0,edy=0;
        ctx.strokeStyle=col; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
        for(let i=0;i<=N;i++){ const u=i/N, d=u*total, q=at(d);
          const env=tailFade?Math.min(1,u*8)*(1-clamp((u-0.75)/0.25,0,1)):Math.min(1,u*8,(1-u)*8);
          const off=A*env*Math.sin(k*d-s.ph*3), x=q.x+q.nx*off, y=q.y+q.ny*off;
          if(i===N-1){ edx=x; edy=y; } if(i===N){ ex=x; ey=y; } i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
        ctx.stroke();
        if(arrow){ const L=Math.hypot(ex-edx,ey-edy)||1; v.arrow(ctx,ex-(ex-edx)/L*0.45,ey-(ey-edy)/L*0.45,ex,ey,col); } };
      if(pass){
        // в слое луч идёт круче к горизонту: sin θ_t = cos β / n (θ — от вертикали)
        const st=Math.cos(b)/Math.max(n,1e-6), tt=Math.asin(clamp(st,-1,1)), top=[HIT[0]+1.6*Math.tan(tt),2.8];
        const out=[top[0]+1.3/Math.tan(b),4.1];
        snake([TX,HIT,top,out],acc,true,true);
        v.text(ctx,'уходит в космос',out[0]-0.2,out[1]-0.2,acc,10,'right',true);
      } else {
        const turn=[0,n>0?1.2:1.35], RX=[dx,-1.4];
        snake([TX,turn,RX],meas,false,false);
        ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(turn[0],turn[1],v.lw(3.4),0,7); ctx.fill();
        v.label(ctx,'отражение',turn[0],turn[1],8,-10,meas);
        антенна(RX[0],meas); if(dx>1.2) v.text(ctx,'приёмник',RX[0],-3.0,meas,10,'center'); else v.text(ctx,'и приёмник',TX[0],-3.35,meas,10,'center');
      }
    }
    v.пояснение(ctx,строки);
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
  пояснения(p){
    return [[`n = ${p.n}: λ = 2L/n = ${this.lam(p).toFixed(2)} м, f = nv/2L = ${this.freq(p).toFixed(2)} Гц`,css('--ink-2'),true],
      [p.parts?'две встречные бегущие волны (тонкие линии) складываются в стоячую (толстая): узлы стоят на месте':'узлы стоят на месте — это результат сложения двух встречных волн',css('--ink-3')]];
  },
  fit(p,vp){ return fitСПояснением(vp,p.L+2,6.6,p.L/2,0.6,this.пояснения(p),50); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const L=p.L, lam=this.lam(p), строки=this.пояснения(p);
    v.занятьНиз(строки);
    // ось и закреплённые концы
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(L,0); ctx.stroke(); ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(0,-1.4); ctx.lineTo(0,1.4); ctx.moveTo(L,-1.4); ctx.lineTo(L,1.4); ctx.stroke();
    v.text(ctx,'закреплено',0,-1.62,ink3,10,'center');
    v.text(ctx,'закреплено',L,-1.62,ink3,10,'center');
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
      v.text(ctx,'— волна вправо',0,1.75+42/ppm(),acc,10,'left',true);
      v.text(ctx,'— волна влево',0,1.75+28/ppm(),meas,10,'left',true);
    }
    // стоячая волна (сумма)
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.6); ctx.beginPath();
    for(let i=0;i<=400;i++){ const x=L*i/400, y=this.y(p,x,s.t); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
    // узлы и пучности
    if(p.nodes){
      ctx.fillStyle=ink;
      for(const x of this.nodePos(p)){ ctx.beginPath(); ctx.arc(x,0,v.lw(4),0,7); ctx.fill(); }
      v.text(ctx,'● узлы — не колеблются',0,1.75+14/ppm(),ink,10,'left',true);
      for(const x of this.antinodePos(p)){
        ctx.strokeStyle=sec; ctx.globalAlpha=.6; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(x,-p.A*1.15); ctx.lineTo(x,p.A*1.15); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
      }
      v.text(ctx,'┆ пучности — наибольший размах',0,1.75,sec,10,'left',true);
      // разметка λ/2 между соседними узлами
      const n0=this.nodePos(p)[0], n1=this.nodePos(p)[1];
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(n0,-1.9); ctx.lineTo(n1,-1.9); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,`λ/2 = ${(lam/2).toFixed(2)} м`,(n0+n1)/2,-1.9,-26,16,ink3);
    }
    v.пояснение(ctx,строки);
  }
},

/* ================= ГЛ.22: ИНТЕРФЕРЕНЦИЯ ОТ ДВУХ ИСТОЧНИКОВ ================= */
interf2:{
  title:'Интерференция от двух источников (опыт Юнга)',
  /* Сцена — схема опыта Юнга: щели в долях миллиметра, экран в метрах.
     Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
    return [['расстояние между источниками d',p.d,'мм'],
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
  graphs:[],
  presets:[
    {name:'Опыт Юнга: светлые и тёмные полосы',values:{d:0.2,lam:550,Ls:2,ymm:5.5,coh:true}},
    {name:'Источники ближе — полосы шире',values:{d:0.1,lam:550,Ls:2,ymm:5.5,coh:true}},
    {name:'Красный свет — полосы шире синего',values:{d:0.2,lam:700,Ls:2,ymm:7,coh:true}},
    {name:'Синий свет',values:{d:0.2,lam:450,Ls:2,ymm:4.5,coh:true}},
    {name:'Некогерентные источники — картина пропадает',values:{d:0.2,lam:550,Ls:2,ymm:5.5,coh:false}}
  ],
  пояснения(p){
    const ym=p.ymm*1e-3, m=this.order(p,ym), near=Math.round(m);
    const txt = !p.coh ? 'некогерентные источники: интенсивности просто складываются, полос нет'
      : (Math.abs(m-near)<0.08 ? `разность хода — целое число длин волн ⇒ СВЕТЛАЯ полоса (m = ${near})`
      : (Math.abs(Math.abs(m-near)-0.5)<0.08 ? 'разность хода полуцелая ⇒ ТЁМНАЯ полоса'
      : 'разность хода нецелая — промежуточная яркость'));
    return [[`Δ = d·sinθ = ${(this.delta(p,ym)*1e9).toFixed(0)} нм = ${m.toFixed(2)}·λ`,css('--ink-2'),true],
      [txt,p.coh?css('--accent'):css('--ink-3')],
      [`ширина полосы Δy = λL/d = ${(this.spacing(p)*1e3).toFixed(2)} мм · волны на схеме увеличены: настоящая λ в тысячи раз меньше d`,css('--ink-3')]];
  },
  fit(p,vp){ return fitСПояснением(vp,11.4,7.2,1.1,0,this.пояснения(p)); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const S1={x:-3.4,y:0.55}, S2={x:-3.4,y:-0.55}, SCR=4.2, строки=this.пояснения(p), RGB=КС.rgbλ(p.lam), col=`rgb(${RGB})`;
    v.занятьНиз(строки);
    /* Волновое поле двух источников (3.5.0): мгновенная сумма двух круговых
       волн. Где гребень встречает гребень — ярко, где гребень впадину —
       темно; тёмные «лучи» между источниками и экраном — это узловые линии,
       они и приходят на экран тёмными полосами. У некогерентных источников
       фазы пляшут независимо, и узловые линии не стоят на месте. */
    if(p.field){
      const λs=0.55*p.lam/550, k=2*Math.PI/λs, w=s.ph*2.2, w2=p.coh?w:w*1.37+Math.sin(s.ph*3.1)*4;
      КС.поле(ctx,S1.x,-3,SCR-S1.x,6,150,118,(x,y)=>{
        const r1=Math.hypot(x-S1.x,y-S1.y), r2=Math.hypot(x-S2.x,y-S2.y);
        const e=Math.cos(k*r1-w)+Math.cos(k*r2-w2), I=e*e/4;
        return [RGB[0],RGB[1],RGB[2],0.72*I];
      });
    }
    // источники
    ctx.fillStyle=dang;
    for(const S of [S1,S2]){ ctx.beginPath(); ctx.arc(S.x,S.y,0.14,0,7); ctx.fill(); }
    v.text(ctx,'S₁',S1.x-0.25,S1.y,dang,11,'right',true);
    v.text(ctx,'S₂',S2.x-0.25,S2.y,dang,11,'right',true);
    v.text(ctx,`d = ${p.d} мм`,S1.x-0.25,-1.25,ink3,10,'center');
    // экран
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(SCR,-3); ctx.lineTo(SCR,3); ctx.stroke();
    v.text(ctx,`экран, L = ${p.Ls} м`,SCR,-3.3,ink3,10,'center');
    // картина на экране: цвет — цвет света, яркость — интенсивность
    const ys=3, N=180;
    for(let i=0;i<N;i++){
      const yy=-ys+2*ys*i/N, I=this.I(p,(yy/0.28)*1e-3)/4;
      ctx.globalAlpha=clamp(I,0,1); ctx.fillStyle=col;
      ctx.fillRect(SCR+0.06, yy, 0.34, 2*ys/N*1.2);
    }
    ctx.globalAlpha=1;
    if(p.plot){
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath();
      for(let i=0;i<=300;i++){
        const yy=-ys+2*ys*i/300, I=this.I(p,(yy/0.28)*1e-3), xx=SCR+0.55+I*0.42;
        i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);
      }
      ctx.stroke();
      v.text(ctx,'I(y)',SCR+1.55,ys+0.25,meas,10,'center',true);
    }
    // лучи к точке наблюдения
    const yObs=clamp(p.ymm*0.28,-ys,ys);
    ctx.strokeStyle=ink; ctx.globalAlpha=.8; ctx.lineWidth=v.lw(1.4);
    for(const S of [S1,S2]){ ctx.beginPath(); ctx.moveTo(S.x,S.y); ctx.lineTo(SCR,yObs); ctx.stroke(); }
    ctx.globalAlpha=1;
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(SCR,yObs,v.lw(4.5),0,7); ctx.fill();
    v.label(ctx,`y = ${p.ymm} мм`,SCR,yObs,-72,-10,meas);
    v.пояснение(ctx,строки);
  }
},

/* ================= ГЛ.22: РЕШЁТКА И ДИФРАКЦИЯ НА ЩЕЛИ ================= */
grating:{
  title:'Дифракционная решётка и дифракция на щели',
  /* Сцена — схема опыта: период решётки микронный, экран в метрах. Поэтому
     ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
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
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph=(s.ph||0)+dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    if(p.mode==='grating'){
      const ms=this.maxAngles(p);
      const out=[['число щелей N',p.N,''],['период d',p.d,'мкм'],['длина волны λ',p.lam,'нм'],
        ['главных максимумов',ms.length,''],
        ['условие максимума','','d·sinθ = mλ']];
      for(const q of ms.filter(q=>q.m>=0&&q.m<=3)) out.push([`максимум m = ${q.m}: угол`,q.th*180/Math.PI,'°']);
      out.push(['относительная ширина максимума ~1/N',1/p.N,''],
        ['яркость главного максимума ~N²',p.N*p.N,'I₀']);
      return out;
    }
    const mins=this.minAngles(p);
    const first=mins.find(q=>q.m===1);
    return [['ширина щели a',p.a,'мкм'],['длина волны λ',p.lam,'нм'],
      ['условие минимума','','a·sinθ = mλ'],
      ['первый минимум: угол',first?first.th*180/Math.PI:0,'°'],
      ['полуширина центрального максимума',first?first.th*180/Math.PI:0,'°'],
      ['минимумов всего',mins.length,''],
      ['чем уже щель',0,'тем шире центральный максимум']];
  },
  graphs:[],
  presets:[
    {name:'Две щели (как у Юнга)',values:{mode:'grating',N:2,d:3,lam:550}},
    {name:'Пять щелей — максимумы острее',values:{mode:'grating',N:5,d:3,lam:550}},
    {name:'Двадцать щелей — настоящая решётка',values:{mode:'grating',N:20,d:3,lam:550}},
    {name:'Красный свет отклоняется сильнее',values:{mode:'grating',N:20,d:3,lam:700}},
    {name:'Дифракция на широкой щели',values:{mode:'slit',a:6,lam:550}},
    {name:'Узкая щель — свет расходится широко',values:{mode:'slit',a:1.2,lam:550}}
  ],
  пояснения(p){
    const ink=css('--ink-2'), ink3=css('--ink-3');
    if(p.mode==='grating'){
      const ms=this.maxAngles(p), m1=ms.find(q=>q.m===1);
      return [[`d·sinθ = mλ — главные максимумы${m1?`; первый порядок под углом ${(m1.th*180/Math.PI).toFixed(1)}°`:''}`,ink,true],
        [`при N = ${p.N} они в ${p.N}² = ${p.N*p.N} раз ярче одной щели и в ${p.N} раз уже; между ними ${p.N-2} слабых побочных`,ink3],
        ['красный свет отклоняется сильнее синего — решётка раскладывает свет в спектр',ink3]];
    }
    const m1=this.minAngles(p).find(q=>q.m===1);
    return [[`a·sinθ = mλ — это условие МИНИМУМОВ${m1?`; первый под углом ${(m1.th*180/Math.PI).toFixed(1)}°`:': минимумов нет, свет расходится во все стороны'}`,ink,true],
      ['чем уже щель, тем шире центральный максимум: каждая точка щели — источник вторичной волны (Гюйгенс)',ink3]];
  },
  fit(p,vp){ return fitСПояснением(vp,12.4,7.4,0.1,0.1,this.пояснения(p)); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const X0=-5.6, XS=-2.6, XSCR=4.2, HH=3.2, строки=this.пояснения(p), RGB=КС.rgbλ(p.lam), col=`rgb(${RGB})`;
    v.занятьНиз(строки);
    // источники вторичных волн: щели решётки или точки внутри одной щели
    let src=[];
    if(p.mode==='grating'){ const N=p.N, span=Math.min(2.6,(N-1)*0.2)/1, step=N>1?(2*span)/(N-1):0;
      for(let i=0;i<N;i++) src.push(N>1?-span+i*step:0); }
    else { const half=clamp(p.a*0.16,0.15,1.4); for(let i=0;i<12;i++) src.push(-half+2*half*(i+0.5)/12); }
    // волновое поле за преградой (схема: λ увеличена) и плоская волна перед ней
    if(p.scheme){
      const λs=0.5*p.lam/550, k=2*Math.PI/λs, w=s.ph*4.4, n=src.length;
      КС.поле(ctx,XS,-HH,XSCR-XS,2*HH,140,130,(x,y)=>{
        let re=0, im=0; for(const ys of src){ const r=Math.hypot(x-XS,y-ys), f=k*r-w; re+=Math.cos(f); im+=Math.sin(f); }
        const e=re/n; return [RGB[0],RGB[1],RGB[2],0.8*e*e]; });
      КС.поле(ctx,X0,-HH,XS-X0,2*HH,40,8,(x,y)=>{ const e=Math.cos(2*Math.PI/λs*(x-XS)-w); return [RGB[0],RGB[1],RGB[2],0.7*e*e]; });
      v.arrow(ctx,X0+0.2,HH+0.25,X0+1.2,HH+0.25,dang);
      v.text(ctx,'плоская волна',X0+1.35,HH+0.25,dang,10,'left');
    }
    // преграда со щелями
    ctx.fillStyle=ink;
    if(p.mode==='grating'){
      let prev=-HH;
      for(const y of src){ ctx.fillRect(XS-0.07,prev,0.14,(y-0.06)-prev); prev=y+0.06; }
      ctx.fillRect(XS-0.07,prev,0.14,HH-prev);
      v.text(ctx,`${p.N} щелей, d = ${p.d} мкм`,XS,-HH-0.3,ink3,10,'center');
    } else {
      const half=clamp(p.a*0.16,0.15,1.4);
      ctx.fillRect(XS-0.07,-HH,0.14,HH-half); ctx.fillRect(XS-0.07,half,0.14,HH-half);
      v.text(ctx,`щель a = ${p.a} мкм`,XS,-HH-0.3,ink3,10,'center');
    }
    // экран и картина
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(XSCR,-HH); ctx.lineTo(XSCR,HH); ctx.stroke();
    const thMax=Math.atan(HH/2.6), yOf=th=>Math.tan(th)*2.6;
    for(let i=0;i<220;i++){
      const th=-thMax+2*thMax*i/220, y=yOf(th), I=this.I(p,th);
      ctx.globalAlpha=clamp(Math.sqrt(I),0,1); ctx.fillStyle=col;
      ctx.fillRect(XSCR+0.06,y-0.02,0.34,2*HH/220*1.3);
    }
    ctx.globalAlpha=1;
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath();
    for(let i=0;i<=500;i++){ const th=-thMax+2*thMax*i/500, y=yOf(th), xx=XSCR+0.55+this.I(p,th)*1.5; i?ctx.lineTo(xx,y):ctx.moveTo(xx,y); }
    ctx.stroke();
    v.text(ctx,'I(θ)',XSCR+1.3,HH+0.25,meas,10,'center',true);
    // отметки: максимумы решётки / минимумы щели; подписи — только пока не слипаются
    if(p.marks){
      const qs=p.mode==='grating'?this.maxAngles(p):this.minAngles(p), px=ppm();
      let последний=-1e9;
      for(const q of qs.slice().sort((a,b)=>yOf(a.th)-yOf(b.th))){
        const y=yOf(q.th); if(Math.abs(y)>HH) continue;
        if(p.mode==='grating'){ КС.пунктир(ctx,v,XS,0,XSCR,y,sec,.45); }
        ctx.fillStyle=p.mode==='grating'?sec:ink3; ctx.beginPath(); ctx.arc(XSCR,y,v.lw(2.6),0,7); ctx.fill();
        if((y-последний)*px>13 && Math.abs(q.m)<=6){ v.text(ctx,p.mode==='grating'?`m=${q.m}`:`мин ${q.m}`,XSCR-0.15,y,p.mode==='grating'?sec:ink3,9.5,'right'); последний=y; }
      }
    }
    v.пояснение(ctx,строки);
  }
}

,
/* ===================== ЭФФЕКТ ДОПЛЕРА ======================
   Орир, т.1 (волны). Источник и приёмник движутся вдоль одной прямой:
       f' = f · (v ± v_пр) / (v ∓ v_ист),
   верхние знаки — когда сближаются. Если v_ист ≥ v, фронты не успевают уйти
   вперёд и складываются в конус Маха с полууглом sinθ = v/v_ист.            */
doppler:{
  title:'Эффект Доплера: движется источник или приёмник',
  params:[
    {key:'f0',label:'Частота источника f',unit:'Гц',min:20,max:2000,step:5,default:440},
    {key:'c', label:'Скорость волны в среде v',unit:'м/с',min:20,max:400,step:1,default:340},
    {key:'vs',label:'Скорость источника (→ вправо)',unit:'м/с',min:-500,max:500,step:1,default:80},
    {key:'vo',label:'Скорость приёмника (→ вправо)',unit:'м/с',min:-200,max:200,step:1,default:0},
    {key:'xo',label:'Где стоит приёмник',unit:'м',min:-40,max:60,step:1,default:26},
    {type:'group',label:'Показывать'},
    {key:'fronts',label:'Фронты волн',type:'check',default:true},
    {key:'mach',  label:'Конус Маха при сверхзвуке',type:'check',default:true}
  ],
  /* Наблюдаемая частота. Ось x направлена вправо; сближение определяем по
     знаку проекций скоростей на направление «источник → приёмник». */
  fObs(p,xs,xo){
    const dir=Math.sign(xo-xs)||1;               // от источника к приёмнику
    const vs=p.vs*dir, vo=p.vo*dir;              // проекции на это направление
    const num=p.c-vo, den=p.c-vs;                // приёмник убегает → меньше; источник догоняет → больше
    if(Math.abs(den)<1e-9) return Infinity;
    const f=p.f0*num/den;
    return f>0? f : 0;
  },
  mach(p){ return Math.abs(p.vs)/p.c; },
  machAngle(p){ const M=this.mach(p); return M>1? Math.asin(1/M)*180/Math.PI : null; },
  init(p){
    return {t:0, xs:-30, xo:p.xo, fronts:[], nextEmit:0, event:null, __stop:null};
  },
  step(s,dt,p){
    s.t+=dt;
    s.xs+=p.vs*dt;
    s.xo+=p.vo*dt;
    // выпускаем фронты с равными промежутками (не каждый период — их было бы слишком много)
    const per=Math.max(0.05, 1/Math.max(p.f0,1)*20);
    if(s.t>=s.nextEmit){
      s.fronts.push({x:s.xs, t0:s.t});
      s.nextEmit=s.t+per;
      if(s.fronts.length>26) s.fronts.shift();
    }
    // источник ушёл далеко — возвращаем, чтобы картинка не убегала
    if(s.xs>90){ s.xs=-30; s.fronts=[]; }
    if(s.xs<-90){ s.xs=60; s.fronts=[]; }
  },
  readouts(s,p){
    const f=this.fObs(p,s.xs,s.xo);
    const M=this.mach(p), ma=this.machAngle(p);
    const approaching=(p.vs-p.vo)*Math.sign(s.xo-s.xs)>0;
    return [['t',s.t,'с'],
      ['частота источника f',p.f0,'Гц'],
      ['скорость волны v',p.c,'м/с'],
      ['скорость источника',p.vs,'м/с'],
      ['скорость приёмника',p.vo,'м/с'],
      ['положение источника',s.xs,'м'],
      ['положение приёмника',s.xo,'м'],
      ['слышимая частота f′',isFinite(f)?f:NaN, isFinite(f)?'Гц':'источник идёт со скоростью волны'],
      ['сдвиг Δf = f′ − f',isFinite(f)?f-p.f0:NaN,'Гц'],
      ['относительный сдвиг',isFinite(f)?100*(f-p.f0)/p.f0:NaN,'%'],
      ['сближаются?',0, approaching?'да — тон выше':'нет — тон ниже'],
      ['число Маха M = |vи|/v',M,''],
      ['угол конуса Маха',ma===null?NaN:ma, ma===null?'дозвук — конуса нет':'°']];
  },
  graphs:[
    {label:'Слышимая частота f′',unit:'Гц',series:["f'"],
     get(s,p){ const f=SIMS.doppler.fObs(p,s.xs,s.xo); return [isFinite(f)?f:0,null]; }},
    {label:'Расстояние источник–приёмник',unit:'м',series:['r'],
     get(s,p){ return [Math.abs(s.xo-s.xs),null]; }}
  ],
  presets:[
    {name:'Сирена приближается: тон выше',values:{f0:440,c:340,vs:80,vo:0,xo:40}},
    {name:'Сирена удаляется: тон ниже',values:{f0:440,c:340,vs:-80,vo:0,xo:40}},
    {name:'Движется приёмник, источник стоит',values:{f0:440,c:340,vs:0,vo:60,xo:20}},
    {name:'Звуковой барьер: M = 1',values:{f0:440,c:340,vs:340,vo:0,xo:40}},
    {name:'Сверхзвук: конус Маха',values:{f0:440,c:340,vs:500,vo:0,xo:40}}
  ],
  anchors(s,p){ return [{x:s.xs,y:0},{x:s.xo,y:0}]; },
  dragPoints(p){ return [{x:p.xo,y:0}]; },
  dragMove(p,idx,x,y){ p.xo=clamp(Math.round(x),-40,60); },
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const spanX=150, spanY=95;
    const scale=clamp(Math.min((W-70)/(spanX*PX_PER_M),(H-70)/(spanY*PX_PER_M)),1e-7,30);
    return {x:15,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    // ось движения
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(-90,0); ctx.lineTo(100,0); ctx.stroke(); ctx.globalAlpha=1;
    // фронты: радиус = v·(t − t₀), центр — где источник был в момент испускания
    if(p.fronts){
      ctx.lineWidth=v.lw(1.2);
      for(const fr of s.fronts){
        const R=p.c*(s.t-fr.t0);
        if(R<=0.01) continue;
        const near=Math.abs(s.xo-fr.x)<R;         // фронт уже накрыл приёмник
        ctx.strokeStyle=near?meas:sec;
        ctx.globalAlpha=near?.5:.32;
        ctx.beginPath(); ctx.arc(fr.x,0,R,0,7); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    // конус Маха
    const ma=this.machAngle(p);
    if(p.mach && ma!==null){
      const th=ma*Math.PI/180, dir=Math.sign(p.vs)||1, Lc=120;
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.8); ctx.globalAlpha=.8;
      ctx.beginPath();
      ctx.moveTo(s.xs,0); ctx.lineTo(s.xs-dir*Lc*Math.cos(th), Lc*Math.sin(th));
      ctx.moveTo(s.xs,0); ctx.lineTo(s.xs-dir*Lc*Math.cos(th),-Lc*Math.sin(th));
      ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,`конус Маха, θ = ${ma.toFixed(1)}°  (M = ${this.mach(p).toFixed(2)})`,
        s.xs-dir*40*Math.cos(th),40*Math.sin(th),0,-8,dang);
    }
    // источник
    ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(s.xs,0,v.lw(6),0,7); ctx.fill();
    v.label(ctx,`источник, f = ${p.f0} Гц`,s.xs,0,-30,-16,acc);
    if(Math.abs(p.vs)>1e-6){
      const k=28/Math.max(Math.abs(p.vs),1);
      v.arrow(ctx,s.xs,-6,s.xs+p.vs*k,-6,acc);
      v.label(ctx,`${p.vs} м/с`,s.xs+p.vs*k,-6,4,12,acc);
    }
    // приёмник
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(s.xo,0,v.lw(6),0,7); ctx.fill();
    const f=this.fObs(p,s.xs,s.xo);
    v.label(ctx,`приёмник`,s.xo,0,-24,16,meas);
    v.label(ctx,isFinite(f)?`слышит ${f.toFixed(1)} Гц`:'фронт не доходит',s.xo,0,-30,32,
      isFinite(f)&&f>p.f0?dang:(isFinite(f)?sec:ink3));
    if(Math.abs(p.vo)>1e-6){
      const k=28/Math.max(Math.abs(p.vo),1);
      v.arrow(ctx,s.xo,6,s.xo+p.vo*k,6,meas);
      v.label(ctx,`${p.vo} м/с`,s.xo+p.vo*k,6,4,-8,meas);
    }
    // вывод
    const dfp=isFinite(f)? 100*(f-p.f0)/p.f0 : NaN;
    v.label(ctx, isFinite(f)
      ? `f′ = f·(v − v_пр)/(v − v_ист) = ${f.toFixed(1)} Гц  (${dfp>0?'+':''}${dfp.toFixed(1)} %)`
      : 'источник движется со скоростью волны: фронты копятся в одной точке',
      -85,-38,0,0, isFinite(f)?ink3:dang);
    v.label(ctx, this.mach(p)>=1
      ? 'сверхзвук: источник обгоняет свои же волны, они складываются в ударную волну'
      : 'сгущение фронтов спереди — тон выше, разрежение сзади — тон ниже',
      -85,-38,0,16,ink3);
  }
}

});
