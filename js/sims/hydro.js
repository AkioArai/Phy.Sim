/* ===================== ГИДРОДИНАМИКА (9.4.0) =====================
   Сцены нового раздела «Гидродинамика» — те опыты, что разбирает задачник
   Иродова в главе о механике жидкостей.

   rotfluid — жидкость во вращающемся цилиндре. В системе сосуда на частицу
   действуют тяжесть и центробежная сила mω²r; поверхность перпендикулярна
   их сумме, отсюда параболоид z(r) = z₀ + ω²r²/2g. Объём жидкости не
   меняется: z₀ = H₀ − ω²R²/4g. Когда ω²R² > 4gH₀, дно в центре обнажается,
   и тогда z(r) = k(r² − r₀²) при r > r₀, k = ω²/2g, а сухое пятно
   r₀² = R² − R·√(2H₀/k). Жидкость раскручивается не сразу: ω(t) растёт
   к заданному значению за время τ (вязкость передаёт вращение от стенок).

   utube — U-образная трубка. «Две жидкости»: в правое колено доливают
   столб h₂ лёгкой жидкости; равенство давлений на уровне раздела даёт
   разность уровней свободных поверхностей Δ = h₂(1 − ρ₂/ρ₁), а вода в
   левом колене поднимается на h₂ρ₂/(2ρ₁). «Колебания»: столб длиной l,
   сдвинутый на x₀, колеблется с периодом T = 2π√(l/2g) — от жидкости он не
   зависит. Трение — по желанию, через коэффициент затухания γ.

   poiseuille — вязкое течение. В трубе радиуса R профиль скоростей —
   парабола v(r) = Δp(R² − r²)/(4ηL), расход Q = πR⁴Δp/(8ηL), средняя
   скорость — половина осевой. Второй опыт — сосуд сливается через
   горизонтальный капилляр: расход пропорционален напору, поэтому уровень
   убывает экспоненциально, h = h₀e^(−t/τ), τ = 8ηl·S/(πr⁴ρg).          */
Object.assign(SIMS,{
rotfluid:{
  title:'Жидкость во вращающемся сосуде: параболоид',
  gridUnit:'см',
  params:[
    {key:'R', label:'Радиус сосуда R',unit:'см',min:3,max:30,step:0.5,default:10},
    {key:'H0',label:'Уровень жидкости в покое H₀',unit:'см',min:2,max:40,step:0.5,default:14},
    {key:'Hv',label:'Высота сосуда',unit:'см',min:5,max:60,step:0.5,default:26},
    {key:'w', label:'Угловая скорость ω',unit:'рад/с',min:0,max:60,step:0.1,default:9},
    {key:'tau',label:'Время раскрутки жидкости τ',unit:'с',min:0.1,max:10,step:0.1,default:1.5},
    {key:'liq',label:'Жидкость',type:'select',default:'water',options:[{v:'water',t:'вода, 1000 кг/м³'},{v:'merc',t:'ртуть, 13 546 кг/м³'},{v:'oil',t:'масло, 900 кг/м³'}]},
    {key:'g', label:'Ускорение g',unit:'м/с²',min:1,max:25,step:0.1,default:9.8},
    {type:'group',label:'Показывать'},
    {key:'rings',label:'Линии равной высоты на поверхности',type:'check',default:true},
    {key:'dims', label:'Размеры z₀ и z у стенки',type:'check',default:true},
    {type:'group',label:'Остановка'},
    {key:'stopSpill',label:'Когда жидкость дошла до края',type:'check',default:true},
    {key:'stopDry',  label:'Когда обнажилось дно',type:'check',default:false},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  RHO:{water:1000,merc:13546,oil:900},
  тон(p){ return {water:'вода',merc:'ртуть',oil:'масло'}[p.liq]||'вода'; },
  ω(p,t){ return p.w*(1-Math.exp(-Math.max(0,t)/Math.max(p.tau,1e-6))); },
  /* поверхность при угловой скорости w: в метрах */
  поверхность(p,w){
    const R=p.R/100, H0=p.H0/100, k=w*w/(2*p.g);
    if(k*R*R<=2*H0) return {k,r0:0,z0:H0-k*R*R/2,zR:H0+k*R*R/2,z:r=>H0-k*R*R/2+k*r*r};
    const r0=Math.sqrt(Math.max(0,R*R-R*Math.sqrt(2*H0/k)));
    return {k,r0,z0:0,zR:k*(R*R-r0*r0),z:r=>r<r0?0:k*(r*r-r0*r0)};
  },
  init(p){ return {t:0,φ:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const t=p.tStop>0?Math.min(s.t+dt,p.tStop):s.t+dt;
    s.φ+=this.ω(p,(s.t+t)/2)*(t-s.t); s.t=t;
    const П=this.поверхность(p,this.ω(p,t));
    if(p.stopSpill&&П.zR>=p.Hv/100-1e-9){ s.event={type:'spill',t}; s.__stop=`Жидкость поднялась до края сосуда: ω = ${this.ω(p,t).toFixed(2)} рад/с`; return; }
    if(p.stopDry&&П.r0>1e-6){ s.event={type:'dry',t}; s.__stop=`Дно в центре обнажилось: ω = ${this.ω(p,t).toFixed(2)} рад/с`; return; }
    if(p.tStop>0&&t>=p.tStop){ s.event={type:'time',t}; s.__stop=`Остановка по времени: t = ${t.toFixed(2)} с`; }
  },
  readouts(s,p){
    const w=this.ω(p,s.t), П=this.поверхность(p,w), ρ=this.RHO[p.liq]||1000;
    const out=[['t',s.t,'с'],['угловая скорость ω',w,'рад/с'],['оборотов в секунду',w/(2*Math.PI),'об/с'],
      ['уровень на оси z₀',П.z0*100,'см'],['уровень у стенки',П.zR*100,'см'],
      ['избыточное давление в центре дна',ρ*p.g*П.z0/1000,'кПа']];
    if(П.r0>0) out.push(['радиус сухого пятна',П.r0*100,'см']);
    return out;
  },
  graphs:[{label:'Уровни у оси и у стенки',unit:'см',series:['z₀','у стенки'],get(s,p){ const S=SIMS.rotfluid, П=S.поверхность(p,S.ω(p,s.t)); return [П.z0*100,П.zR*100]; }}],
  presets:[
    {name:'Вода в стакане раскручивается',values:{R:10,H0:14,Hv:26,w:9,tau:1.5,liq:'water',stopSpill:true,stopDry:false}},
    {name:'Быстрее — до края',values:{R:10,H0:14,Hv:26,w:16,tau:2,liq:'water',stopSpill:true,stopDry:false}},
    {name:'Мелко налито: обнажается дно',values:{R:12,H0:4,Hv:30,w:14,tau:1.5,liq:'water',stopSpill:false,stopDry:true}},
    {name:'Ртуть: форма та же, давление в 13,5 раза выше',values:{R:10,H0:14,Hv:26,w:9,tau:1.5,liq:'merc',stopSpill:true,stopDry:false}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, X=2*p.R+22, Y=p.Hv+14;
    const scale=clamp(Math.min((W-30)/(X*PX_PER_M),(H-30)/(Y*PX_PER_M)),1e-4,60);
    return {x:5,y:p.Hv/2+1,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  /* 9.5.0: ручки — уровень в покое H₀ и высота сосуда (тяните у левой
     стенки), радиус (правая стенка) и угловая скорость (тяните вбок
     стрелку ω). Зонд — давление в любой точке жидкости и наклон
     поверхности над этой точкой. */
  tools(p){ const S=this;
    return [РУЧКИ({name:'Уровень, сосуд, ω',
      ручки(p){ return [
        {id:'H0',x:-p.R,y:p.H0,имя:p=>`H₀ = ${p.H0} см`,тянуть(т,wx,wy){ т.set('H0',wy); },клав:{ArrowUp:['H0',0.5],ArrowDown:['H0',-0.5]}},
        {id:'Hv',x:-p.R,y:p.Hv,имя:p=>`высота ${p.Hv} см`,тянуть(т,wx,wy){ т.set('Hv',wy); },клав:{ArrowUp:['Hv',0.5],ArrowDown:['Hv',-0.5]}},
        {id:'R',x:p.R,y:p.Hv*0.5,имя:p=>`R = ${p.R} см`,тянуть(т,wx){ т.set('R',Math.abs(wx)); },клав:{ArrowRight:['R',0.5],ArrowLeft:['R',-0.5]}},
        {id:'w',x:p.R*0.35+p.w*0.15,y:p.Hv+3.2,имя:p=>`ω = ${p.w} рад/с`,тянуть(т,wx){ т.set('w',(wx-т.p.R*0.35)/0.15); },клав:{ArrowRight:['w',0.1],ArrowLeft:['w',-0.1]}}]; }}),
      ЗОНД({hint:'щёлкните в жидкость — давление и наклон поверхности над этой точкой',
        замер(p,s,x,y){ const П=S.поверхность(p,S.ω(p,s.t)), r=Math.abs(x)/100, zs=П.z(r)*100; if(Math.abs(x)>p.R||y<0||y>zs) return null;
          const ρ=S.RHO[p.liq]||1000, w=S.ω(p,s.t);
          return [`под поверхностью ${(zs-y).toFixed(1)} см`,`p = ${(ρ*p.g*(zs-y)/100000).toFixed(3)} кПа`,`наклон поверхности ${(Math.atan(w*w*r/p.g)*180/Math.PI).toFixed(1)}°`]; }})]; },
  /* Строгий рисунок в разрезе: стенки — линии, жидкость — один тон, под
     профилем — разрез, над ним — дальняя половина поверхности, светлее.
     Тонкие кольца — линии равной высоты; точки на поверхности вращаются
     вместе с жидкостью. */
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), acc=v.c('--accent');
    const px=1/ppm(), R=p.R, Hv=p.Hv, w=this.ω(p,s.t), П=this.поверхность(p,w), z=x=>П.z(Math.abs(x)/100)*100;
    const e=R*0.3, тон=this.тон(p);
    // подставка: плоская плита и метки поворота
    ctx.fillStyle=АРТ.ц(АРТ.т('--ink-2'),0.82); ctx.fillRect(-R*1.1,-1.6,2.2*R,1.0);
    ctx.fillStyle=v.c('--canvas');
    for(let k=0;k<6;k++){ const a=(s.φ+k*Math.PI/3)%(2*Math.PI); if(Math.sin(a)<0) continue; ctx.fillRect(R*1.1*Math.cos(a)-0.15,-1.45,0.3,0.7); }
    // дальний край дна, разрез и поверхность
    ctx.strokeStyle=АРТ.ц(АРТ.т('--ink-3'),0.6); ctx.lineWidth=1*px; ctx.beginPath(); ctx.ellipse(0,0,R,e,0,0,Math.PI); ctx.stroke();
    АРТ.жидкость(ctx,-R,0,R,Math.max(П.zR*100,1e-3),{тон,верх:z});
    const N=80, верх=x=>П.zR*100+e*Math.sqrt(Math.max(0,1-x*x/(R*R)));
    ctx.fillStyle=АРТ.заливкаЖ(тон,0.6); ctx.beginPath();
    for(let i=0;i<=N;i++){ const x=-R+2*R*i/N; i?ctx.lineTo(x,z(x)):ctx.moveTo(x,z(x)); }
    for(let i=N;i>=0;i--){ const x=-R+2*R*i/N; ctx.lineTo(x,верх(x)); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle=АРТ.ц(АРТ.тон(тон),0.5); ctx.lineWidth=0.9*px; ctx.beginPath();
    for(let i=0;i<=N;i++){ const x=-R+2*R*i/N; i?ctx.lineTo(x,верх(x)):ctx.moveTo(x,верх(x)); } ctx.stroke();
    if(p.rings){ ctx.strokeStyle=АРТ.ц(АРТ.тон(тон),0.35); ctx.lineWidth=0.8*px;
      for(let k=1;k<=5;k++){ const r=R*k/5.5; if(r/100<П.r0) continue; const zz=П.z(r/100)*100;
        ctx.beginPath(); for(let i=0;i<=40;i++){ const θ=Math.PI*i/40, x=r*Math.cos(θ), y=zz+e*(r/R)*Math.sin(θ); i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke(); } }
    ctx.fillStyle=ink2;
    for(let k=0;k<9;k++){ const r=R*(0.25+0.68*((k*0.618)%1)), θ=(k*2.399+s.φ)%(2*Math.PI);
      if(Math.sin(θ)<0.05||r/100<П.r0) continue; const zz=П.z(r/100)*100;
      ctx.beginPath(); ctx.arc(r*Math.cos(θ),zz+e*(r/R)*Math.sin(θ),Math.max(1.8*px,R*0.015),0,7); ctx.fill(); }
    АРТ.стакан(ctx,-R,R,0,Hv);
    ctx.strokeStyle=АРТ.ц(АРТ.т('--ink-3'),0.6); ctx.lineWidth=1*px; ctx.beginPath(); ctx.ellipse(0,Hv,R,e,0,0,Math.PI); ctx.stroke();
    ctx.strokeStyle=ink3; ctx.lineWidth=0.9*px; ctx.setLineDash([5*px,4*px]); ctx.beginPath(); ctx.moveTo(0,-1.6); ctx.lineTo(0,Hv+5); ctx.stroke(); ctx.setLineDash([]);
    if(w>0.05){ const yr=Hv+3.2, rx=R*0.35, ry=e*0.35;
      ctx.strokeStyle=acc; ctx.fillStyle=acc; ctx.lineWidth=1.6*px; ctx.beginPath(); ctx.ellipse(0,yr,rx,ry,0,0.3,Math.PI*1.75); ctx.stroke();
      const a=Math.PI*1.75, hx=rx*Math.cos(a), hy=yr+ry*Math.sin(a);
      ctx.beginPath(); ctx.moveTo(hx+6*px,hy+1*px); ctx.lineTo(hx-2*px,hy+5*px); ctx.lineTo(hx-1*px,hy-4*px); ctx.closePath(); ctx.fill();
      v.label(ctx,`ω = ${w.toFixed(2)} рад/с`,rx,yr,8,-4,acc); }
    if(p.dims){
      АРТ.размер(ctx,R+1.6,0,П.zR*100,meas,0.9*px,2.5*px); v.label(ctx,`${(П.zR*100).toFixed(1)} см`,R+1.6,П.zR*50,6,0,meas);
      if(П.z0>0){ АРТ.размер(ctx,-R*0.12,0,П.z0*100,meas,0.9*px,2.5*px); v.label(ctx,`z₀ = ${(П.z0*100).toFixed(1)} см`,-R*0.12,П.z0*50,-80,0,meas); }
      ctx.strokeStyle=ink3; ctx.globalAlpha=0.6; ctx.setLineDash([3*px,3*px]); ctx.beginPath(); ctx.moveTo(-R-2,p.H0); ctx.lineTo(-R,p.H0); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'H₀',-R-2,p.H0,-18,0,ink3);
    }
    if(П.r0>0) v.label(ctx,`сухое пятно r₀ = ${(П.r0*100).toFixed(1)} см`,0,0,-60,14,ink2);
  }
},

utube:{
  title:'U-образная трубка: две жидкости и колебания столба',
  gridUnit:'см',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'two',options:[{v:'two',t:'долить лёгкую жидкость в правое колено'},{v:'osc',t:'колебания столба жидкости'}]},
    {key:'liq1',label:'Жидкость в трубке',type:'select',default:'water',options:[{v:'water',t:'вода, 1000 кг/м³'},{v:'merc',t:'ртуть, 13 546 кг/м³'},{v:'gly',t:'глицерин, 1260 кг/м³'}]},
    {key:'liq2',label:'Доливаемая жидкость',type:'select',default:'oil',options:[{v:'oil',t:'масло, 900 кг/м³'},{v:'ker',t:'керосин, 800 кг/м³'},{v:'water',t:'вода, 1000 кг/м³'},{v:'spirit',t:'спирт, 789 кг/м³'}],если:p=>p.mode==='two'},
    {key:'h2',label:'Высота доливаемого столба h₂',unit:'см',min:1,max:40,step:0.5,default:16,если:p=>p.mode==='two'},
    {key:'pour',label:'Доливать в течение',unit:'с',min:0.5,max:20,step:0.5,default:4,если:p=>p.mode==='two'},
    {key:'l',label:'Длина столба жидкости l',unit:'см',min:40,max:100,step:1,default:60},
    {key:'x0',label:'Начальный сдвиг уровня x₀',unit:'см',min:0.5,max:15,step:0.5,default:6,если:p=>p.mode==='osc'},
    {key:'gam',label:'Затухание γ',unit:'1/с',min:0,max:3,step:0.01,default:0,если:p=>p.mode==='osc'},
    {key:'g',label:'Ускорение g',unit:'м/с²',min:1,max:25,step:0.1,default:9.8},
    {type:'group',label:'Остановка'},
    {key:'periods',label:'Через N полных колебаний (0 — выкл)',min:0,max:50,step:0.5,default:0,если:p=>p.mode==='osc'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  RHO:{water:1000,merc:13546,gly:1260,oil:900,ker:800,spirit:789},
  ТОН:{water:'вода',merc:'ртуть',gly:'глицерин',oil:'масло',ker:'масло',spirit:'спирт'},
  B:12, ARM:44,                                  // расстояние между коленами и высота колен, см
  /* уровень в покое (столб l поровну в коленах) — над дном изгиба, см */
  покой(p){ return Math.max(0,(p.l-Math.PI*this.B/2)/2); },
  ω0(p){ return Math.sqrt(2*p.g/(p.l/100)); },
  /* сдвиг уровня x(t), см */
  сдвиг(p,t){
    if(p.mode==='two'){ const ρ1=this.RHO[p.liq1], ρ2=this.RHO[p.liq2], h=p.h2*Math.min(1,t/Math.max(p.pour,1e-6)); return h*ρ2/(2*ρ1); }
    const w0=this.ω0(p), γ=p.gam||0, wd=Math.sqrt(Math.max(w0*w0-γ*γ,1e-12));
    return p.x0*Math.exp(-γ*t)*(Math.cos(wd*t)+γ/wd*Math.sin(wd*t));
  },
  долито(p,t){ return p.mode==='two'?p.h2*Math.min(1,t/Math.max(p.pour,1e-6)):0; },
  T(p){ const w0=this.ω0(p), γ=p.gam||0; return 2*Math.PI/Math.sqrt(Math.max(w0*w0-γ*γ,1e-12)); },
  init(p){ return {t:0,periods:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    let t=s.t+dt;
    if(p.mode==='osc'&&p.periods>0){ const tN=p.periods*this.T(p); if(t>=tN&&s.t<tN){ s.t=tN; s.periods=p.periods; s.event={type:'periods',t:tN};
      s.__stop=`Пройдено ${p.periods} колебан.: t = ${tN.toFixed(3)} с`; return; } }
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={type:'time',t:p.tStop}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t; if(p.mode==='osc') s.periods=t/this.T(p);
  },
  readouts(s,p){
    const x=this.сдвиг(p,s.t), y0=this.покой(p), ρ1=this.RHO[p.liq1];
    if(p.mode==='two'){ const h=this.долито(p,s.t), ρ2=this.RHO[p.liq2];
      return [['t',s.t,'с'],['долито h₂',h,'см'],['уровень в левом колене',y0+x,'см'],['граница жидкостей в правом',y0-x,'см'],
        ['верх доливки в правом',y0-x+h,'см'],['плотность ρ₁',ρ1,'кг/м³'],['плотность ρ₂',ρ2,'кг/м³'],
        ['давление на уровне границы слева',ρ1*p.g*(2*x)/100,'Па'],['давление на уровне границы справа',ρ2*p.g*h/100,'Па']]; }
    const w0=this.ω0(p), γ=p.gam||0, wd=Math.sqrt(Math.max(w0*w0-γ*γ,1e-12));
    const v=p.x0*Math.exp(-γ*s.t)*(-(γ*γ/wd+wd)*Math.sin(wd*s.t));
    return [['t',s.t,'с'],['сдвиг уровня x',x,'см'],['скорость уровня',v,'см/с'],['уровень слева',y0+x,'см'],['уровень справа',y0-x,'см'],
      ['колебаний пройдено',s.periods,''],['плотность жидкости',ρ1,'кг/м³']];
  },
  graphs:[{label:'Сдвиг уровня',unit:'см',series:['x'],get(s,p){ return [SIMS.utube.сдвиг(p,s.t),null]; }}],
  presets:[
    {name:'Масло поверх воды',values:{mode:'two',liq1:'water',liq2:'oil',h2:16,pour:4,l:60}},
    {name:'Вода поверх ртути',values:{mode:'two',liq1:'merc',liq2:'water',h2:27,pour:4,l:60}},
    {name:'Колебания столба воды',values:{mode:'osc',liq1:'water',l:60,x0:6,gam:0,periods:0}},
    {name:'Ртуть колеблется с тем же периодом',values:{mode:'osc',liq1:'merc',l:60,x0:6,gam:0,periods:0}},
    {name:'Глицерин: колебания гаснут',values:{mode:'osc',liq1:'gly',l:60,x0:8,gam:0.6,periods:0}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, X=this.B+44, Y=this.ARM+this.B/2+12;
    const scale=clamp(Math.min((W-30)/(X*PX_PER_M),(H-30)/(Y*PX_PER_M)),1e-4,60);
    return {x:6,y:this.ARM/2-2,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  /* 9.5.0: ручки — в опыте с двумя жидкостями верх доливаемого столба
     (тяните — меняется h₂), в опыте с колебаниями — уровень в левом колене
     (начальный сдвиг x₀); длина столба — внизу изгиба. */
  tools(p){ const S=this;
    return [РУЧКИ({name:'Уровни и столб',
      ручки(p,s){ const y0=S.покой(p), h=[];
        if(p.mode==='two'){ const x=S.сдвиг(p,1e9); h.push({id:'h2',x:S.B/2,y:y0-x+p.h2,имя:p=>`h₂ = ${p.h2} см`,тянуть(т,wx,wy){ const ρ=S.RHO[т.p.liq2]/S.RHO[т.p.liq1]; т.set('h2',(wy-S.покой(т.p))/(1-ρ/2)); },клав:{ArrowUp:['h2',0.5],ArrowDown:['h2',-0.5]}}); }
        else h.push({id:'x0',x:-S.B/2,y:y0+p.x0,имя:p=>`x₀ = ${p.x0} см`,тянуть(т,wx,wy){ т.set('x0',wy-S.покой(т.p)); },клав:{ArrowUp:['x0',0.5],ArrowDown:['x0',-0.5]}});
        h.push({id:'l',x:0,y:-S.B/2,имя:p=>`l = ${p.l} см (тяните вбок)`,тянуть(т,wx){ т.set('l',60+wx*3); },клав:{ArrowRight:['l',1],ArrowLeft:['l',-1]}});
        return h; }})]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), cv=v.c('--canvas');
    const px=1/ppm(), B=this.B, ARM=this.ARM, xL=-B/2, xR=B/2, w=3.4;
    const y0=this.покой(p), x=this.сдвиг(p,s.t), h2=this.долито(p,s.t);
    const yL=Math.max(0,y0+x), yR=Math.max(0,y0-x);
    const путь=(a,b)=>{ ctx.beginPath(); ctx.moveTo(xL,a); ctx.lineTo(xL,0); ctx.arc(0,0,B/2,Math.PI,0,false); ctx.lineTo(xR,b); };
    const колено=(xx,a,b)=>{ ctx.beginPath(); ctx.moveTo(xx,a); ctx.lineTo(xx,b); };
    ctx.save(); ctx.lineCap='butt';
    // трубка: контур линией, внутри — фон
    путь(ARM,ARM); ctx.strokeStyle=ink2; ctx.lineWidth=w+3.6*px; ctx.stroke();
    путь(ARM,ARM); ctx.strokeStyle=cv; ctx.lineWidth=w; ctx.stroke();
    const т1=this.ТОН[p.liq1];
    путь(yL,yR); ctx.strokeStyle=АРТ.заливкаЖ(т1,2.2); ctx.lineWidth=w; ctx.stroke();
    if(p.mode==='two'&&h2>1e-6){ const т2=this.ТОН[p.liq2];
      колено(xR,yR,yR+h2); ctx.strokeStyle=АРТ.ц(АРТ.тон(т2),0.45); ctx.lineWidth=w; ctx.stroke();
      if(s.t<p.pour){ ctx.strokeStyle=АРТ.ц(АРТ.тон(т2),0.8); ctx.lineWidth=0.5; колено(xR+0.4,ARM+6,yR+h2); ctx.stroke(); } }
    ctx.restore();
    // зеркала — короткие линии цвета жидкости
    const зеркало=(xx,y,тон)=>{ ctx.strokeStyle=АРТ.линияЖ(тон); ctx.lineWidth=1.4*px; ctx.beginPath(); ctx.moveTo(xx-w/2,y); ctx.lineTo(xx+w/2,y); ctx.stroke(); };
    зеркало(xL,yL,т1); if(p.mode==='two'&&h2>1e-6){ зеркало(xR,yR,т1); зеркало(xR,yR+h2,this.ТОН[p.liq2]); } else зеркало(xR,yR,т1);
    ctx.strokeStyle=ink3; ctx.lineWidth=0.8*px; ctx.setLineDash([3*px,3*px]); ctx.beginPath();
    ctx.moveTo(xL-w,y0); ctx.lineTo(xR+w,y0); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,'уровень в покое',xR+w,y0,6,0,ink3);
    if(p.mode==='two'){
      if(h2>1e-6){ ctx.strokeStyle=meas; ctx.lineWidth=0.9*px; ctx.setLineDash([2*px,3*px]); ctx.beginPath(); ctx.moveTo(xL-w,yR); ctx.lineTo(xR+w,yR); ctx.stroke(); ctx.setLineDash([]);
        v.label(ctx,'граница: давления равны',xR+w,yR,6,12,meas);
        АРТ.размер(ctx,xR+w+3.5,yR,yR+h2,meas,0.9*px,2.5*px); v.label(ctx,'h₂',xR+w+3.5,yR+h2/2,5,0,meas);
        АРТ.размер(ctx,xL-w-3,yR,yL,ink2,0.9*px,2.5*px); v.label(ctx,'ρ₂h₂/ρ₁',xL-w-3,(yR+yL)/2,-56,0,ink2); }
    } else v.label(ctx,`x = ${x.toFixed(2)} см`,xL-w,yL,-70,0,meas);
  }
},

poiseuille:{
  title:'Вязкое течение: формула Пуазейля',
  schema:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'pipe',options:[{v:'pipe',t:'течение в трубе под перепадом давления'},{v:'drain',t:'сосуд сливается через капилляр'}]},
    {key:'liq',label:'Жидкость',type:'select',default:'water',options:[{v:'water',t:'вода: η = 1,0 мПа·с'},{v:'oil',t:'масло: η = 80 мПа·с'},{v:'gly',t:'глицерин: η = 1,41 Па·с'},{v:'blood',t:'кровь: η ≈ 4 мПа·с'}]},
    {key:'R',label:'Радиус трубы R',unit:'мм',min:0.1,max:10,step:0.05,default:1,если:p=>p.mode==='pipe'},
    {key:'L',label:'Длина трубы L',unit:'м',min:0.05,max:10,step:0.05,default:1,если:p=>p.mode==='pipe'},
    {key:'dp',label:'Перепад давления Δp',unit:'кПа',min:0.01,max:200,step:0.01,default:2,если:p=>p.mode==='pipe'},
    {key:'D',label:'Диаметр сосуда D',unit:'см',min:2,max:40,step:0.5,default:8,если:p=>p.mode==='drain'},
    {key:'h0',label:'Начальный уровень h₀',unit:'см',min:2,max:100,step:0.5,default:30,если:p=>p.mode==='drain'},
    {key:'rc',label:'Радиус капилляра r',unit:'мм',min:0.1,max:3,step:0.05,default:0.5,если:p=>p.mode==='drain'},
    {key:'lc',label:'Длина капилляра l',unit:'см',min:1,max:100,step:0.5,default:10,если:p=>p.mode==='drain'},
    {key:'g',label:'Ускорение g',unit:'м/с²',min:1,max:25,step:0.1,default:9.8,если:p=>p.mode==='drain'},
    {type:'group',label:'Остановка'},
    {key:'frac',label:'Когда уровень упал до доли h₀ (0 — выкл)',min:0,max:0.95,step:0.01,default:0,если:p=>p.mode==='drain'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:100000,step:0.1,default:0}
  ],
  LIQ:{water:{ρ:1000,η:1.0e-3},oil:{ρ:900,η:0.08},gly:{ρ:1260,η:1.41},blood:{ρ:1060,η:4e-3}},
  ТОН:{water:'вода',oil:'масло',gly:'глицерин',blood:'кровь'},
  ж(p){ return this.LIQ[p.liq]||this.LIQ.water; },
  /* труба: расход (м³/с), осевая и средняя скорость */
  труба(p){ const η=this.ж(p).η, R=p.R/1000, dp=p.dp*1000, L=p.L;
    const vmax=dp*R*R/(4*η*L), Q=Math.PI*Math.pow(R,4)*dp/(8*η*L); return {Q,vmax,vср:vmax/2,Re:this.ж(p).ρ*vmax/2*2*R/η}; },
  /* слив: постоянная времени, с */
  τ(p){ const ж=this.ж(p), S=Math.PI*Math.pow(p.D/200,2), r=p.rc/1000, l=p.lc/100;
    return 8*ж.η*l*S/(Math.PI*Math.pow(r,4)*ж.ρ*p.g); },
  уровень(p,t){ return p.h0*Math.exp(-t/this.τ(p)); },          // см
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    let t=s.t+dt;
    if(p.mode==='drain'&&p.frac>0){ const tf=-this.τ(p)*Math.log(p.frac); if(t>=tf&&s.t<tf){ s.t=tf; s.event={type:'frac',t:tf};
      s.__stop=`Уровень упал до ${Math.round(p.frac*100)} % от начального за ${tf.toFixed(1)} с`; return; } }
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={type:'time',t:p.tStop}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
  },
  readouts(s,p){
    const ж=this.ж(p);
    if(p.mode==='pipe'){ const T=this.труба(p);
      return [['t',s.t,'с'],['вязкость η',ж.η*1000,'мПа·с'],['расход Q',T.Q*1e6,'мл/с'],['скорость на оси',T.vmax*100,'см/с'],
        ['число Рейнольдса',T.Re,''],['мощность на преодоление вязкости',T.Q*p.dp*1000,'Вт']]; }
    const h=this.уровень(p,s.t), r=p.rc/1000, Q=Math.PI*Math.pow(r,4)*ж.ρ*p.g*(h/100)/(8*ж.η*p.lc/100);
    return [['t',s.t,'с'],['уровень h',h,'см'],['расход через капилляр',Q*1e6,'мл/с'],['вязкость η',ж.η*1000,'мПа·с'],
      ['вытекло',Math.PI*Math.pow(p.D/2,2)*(p.h0-h),'мл']];
  },
  graphs:[{label:'Уровень в сосуде',unit:'см',series:['h'],get(s,p){ return [p.mode==='drain'?SIMS.poiseuille.уровень(p,s.t):null,null]; }}],
  presets:[
    {name:'Вода в тонкой трубке',values:{mode:'pipe',liq:'water',R:1,L:1,dp:2}},
    {name:'Радиус вдвое больше — расход в 16 раз',values:{mode:'pipe',liq:'water',R:2,L:1,dp:2}},
    {name:'Глицерин: в тысячу раз медленнее',values:{mode:'pipe',liq:'gly',R:2,L:1,dp:20}},
    {name:'Слив воды через капилляр',values:{mode:'drain',liq:'water',D:8,h0:30,rc:0.5,lc:10,frac:0}},
    {name:'До половины уровня',values:{mode:'drain',liq:'water',D:8,h0:30,rc:0.5,lc:10,frac:0.5}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(16*PX_PER_M),(H-30)/(10.5*PX_PER_M)),1e-4,60); return {x:0,y:p.mode==='pipe'?2.1:0.2,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  /* 9.5.0: ручки — радиус трубы (верхняя стенка), перепад давления (верх
     первого пьезометра); в опыте со сливом — уровень, радиус капилляра и
     ширина сосуда. Зонд — скорость слоя в любой точке сечения трубы. */
  tools(p){ const S=this;
    return [РУЧКИ({name:'Труба и сосуд',
      ручки(p,s){ if(p.mode==='pipe') return [
          {id:'R',x:-3.5,y:1.6+0.19,имя:p=>`R = ${p.R} мм (тяните вверх и вниз)`,тянуть(т,wx,wy){ т.set('R',т.p.R*Math.pow(1.6/Math.max(0.2,1.6+0.19-(wy-1.79)),-1)); },клав:{ArrowUp:['R',0.05],ArrowDown:['R',-0.05]}},
          {id:'dp',x:-5,y:1.79+4,имя:p=>`Δp = ${p.dp} кПа`,тянуть(т,wx,wy){ т.set('dp',т.p.dp*Math.pow(2,(wy-5.79)/1.5)); },клав:{ArrowUp:['dp',0.1],ArrowDown:['dp',-0.1]}}];
        const Hs=Math.max(p.h0*1.15,10), k=7/Hs, Rw=Math.min(3.2,p.D*k/2+0.6), y0=-1.8;
        return [{id:'h0',x:-6-Rw,y:y0+p.h0*k,имя:p=>`h₀ = ${p.h0} см`,тянуть(т,wx,wy){ т.set('h0',(wy-y0)/k); },клав:{ArrowUp:['h0',0.5],ArrowDown:['h0',-0.5]}},
          {id:'rc',x:-6+Rw+3.5,y:y0+0.35+0.09,имя:p=>`r = ${p.rc} мм (тяните вбок)`,тянуть(т,wx){ т.set('rc',0.5*Math.pow(2,(wx-(-6+Rw+3.5))/1.5)); },клав:{ArrowRight:['rc',0.05],ArrowLeft:['rc',-0.05]}},
          {id:'D',x:-6+Rw,y:y0+Hs*k,имя:p=>`D = ${p.D} см`,тянуть(т,wx){ т.set('D',Math.max(2,(wx+6-0.6)*2/k)); },клав:{ArrowRight:['D',0.5],ArrowLeft:['D',-0.5]}}]; }}),
      ЗОНД({hint:'щёлкните в трубу — скорость слоя на этом расстоянии от оси',
        замер(p,s,x,y){ if(p.mode!=='pipe'||x<-6.5||x>6.5||Math.abs(y)>1.6) return null; const T=S.труба(p), f=Math.abs(y)/1.6;
          return [`r = ${(f*p.R).toFixed(2)} мм от оси`,`v = ${(T.vmax*(1-f*f)*100).toPrecision(3)} см/с`,`это ${(100*(1-f*f)).toFixed(0)} % скорости на оси`]; }})]; },
  /* Строгий рисунок: стенки — линии, жидкость — один тон, профиль скоростей
     — парабола со стрелками; штрихи частиц тем длиннее, чем ближе к оси. */
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), acc=v.c('--accent');
    const px=1/ppm(), тон=this.ТОН[p.liq]||'вода';
    if(p.mode==='pipe'){
      const X0=-6.5, X1=6.5, Rr=1.6, T=this.труба(p);
      АРТ.жидкость(ctx,X0,-Rr,X1,Rr,{тон,блик:false});
      ctx.strokeStyle=ink2; ctx.lineWidth=1.8*px; ctx.beginPath(); ctx.moveTo(X0,Rr); ctx.lineTo(X1,Rr); ctx.moveTo(X0,-Rr); ctx.lineTo(X1,-Rr); ctx.stroke();
      ctx.strokeStyle=АРТ.линияЖ(тон); ctx.lineCap='round'; ctx.lineWidth=1.4*px;
      for(let k=0;k<70;k++){ const q=((0.5+k*0.5698403)%1)*2-1, r=q*Rr*0.96, u=1-q*q;
        const x=X0+((((0.5+k*0.7548777)%1)+s.t*0.35*u)%1)*(X1-X0), дл=0.05+u*0.9;
        ctx.globalAlpha=0.6; ctx.beginPath(); ctx.moveTo(Math.max(X0,x-дл),r); ctx.lineTo(x,r); ctx.stroke(); }
      ctx.globalAlpha=1;
      const xp=2.2, kv=2.4;
      ctx.strokeStyle=acc; ctx.lineWidth=1.4*px; ctx.beginPath(); ctx.moveTo(xp,-Rr); ctx.lineTo(xp,Rr); ctx.stroke();
      ctx.beginPath(); for(let i=0;i<=40;i++){ const r=-Rr+2*Rr*i/40, u=1-(r/Rr)*(r/Rr); i?ctx.lineTo(xp+kv*u,r):ctx.moveTo(xp+kv*u,r); } ctx.stroke();
      for(let i=1;i<8;i++){ const r=-Rr+2*Rr*i/8, u=1-(r/Rr)*(r/Rr); if(u>0.05) v.arrow(ctx,xp,r,xp+kv*u,r,acc); }
      v.label(ctx,`на оси ${(T.vmax*100).toPrecision(3)} см/с`,xp+kv,0,10,-14,acc);
      v.label(ctx,'у стенки — ноль',xp,-Rr,6,12,ink3);
      [-5,-2,1,4.6].forEach(x=>{ const f=1-(x-X0)/(X1-X0), hgt=0.6+3.4*f, ш=0.16;
        АРТ.жидкость(ctx,x-ш,Rr,x+ш,Rr+hgt,{тон});
        АРТ.стакан(ctx,x-ш,x+ш,Rr,Rr+4.6,0,{дно:false,lw:1.3}); });
      ctx.strokeStyle=ink3; ctx.lineWidth=0.9*px; ctx.setLineDash([4*px,4*px]); ctx.beginPath(); ctx.moveTo(X0,Rr+4); ctx.lineTo(X1,Rr+0.6); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,`Δp = ${p.dp} кПа на длине ${p.L} м: давление падает линейно`,X0,Rr+4.9,0,-6,ink2);
      v.label(ctx,`Q = πR⁴Δp/8ηL = ${(T.Q*1e6).toPrecision(3)} мл/с`,X0,-Rr-0.3,0,14,ink2);
      return;
    }
    const h=this.уровень(p,s.t), Hs=Math.max(p.h0*1.15,10), k=7/Hs, Rw=Math.min(3.2,p.D*k/2+0.6);
    const y0=-1.8, yh=y0+h*k;
    АРТ.жидкость(ctx,-6-Rw,y0,-6+Rw,yh,{тон});
    АРТ.стакан(ctx,-6-Rw,-6+Rw,y0,y0+Hs*k);
    const cy=y0+0.35, cL=7.5, cr=0.09, xe=-6+Rw+cL;
    ctx.fillStyle=АРТ.заливкаЖ(тон,2.5); ctx.fillRect(-6+Rw,cy-cr,cL,2*cr);
    ctx.strokeStyle=ink2; ctx.lineWidth=1.4*px; ctx.beginPath(); ctx.moveTo(-6+Rw,cy+cr); ctx.lineTo(xe,cy+cr); ctx.moveTo(-6+Rw,cy-cr); ctx.lineTo(xe,cy-cr); ctx.stroke();
    const част=0.6+2.4*h/p.h0;
    for(let i=0;i<4;i++){ const ф=((s.t*част+i/4)%1), y=cy-ф*ф*1.4; АРТ.капля(ctx,xe+0.1,y,Math.max(2*px,0.06),тон,1-ф*0.6); }
    const mx=xe-0.4, мв=y0-0.9, вытек=Math.min(1,(p.h0-h)/p.h0);
    АРТ.жидкость(ctx,mx-0.6,мв-2.2,mx+0.9,мв-2.2+1.8*вытек+0.001,{тон});
    АРТ.стакан(ctx,mx-0.6,mx+0.9,мв-2.2,мв-0.2);
    АРТ.размер(ctx,-6-Rw-0.6,y0,yh,meas,0.9*px,2.5*px); v.label(ctx,`h = ${h.toFixed(2)} см`,-6-Rw-0.6,(y0+yh)/2,-74,0,meas);
    v.label(ctx,'расход ∝ напору — уровень убывает экспоненциально',-6-Rw,y0+Hs*k,0,-12,ink2);
  }
}
});
