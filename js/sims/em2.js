/* ===================== КОНТУР, ДВИГАТЕЛЬ, ТРЁХФАЗНЫЙ ТОК (6.4.0) =====================
   lc — свободные колебания в контуре: заряженный конденсатор замыкают на
   катушку. q″ + (R/L)q′ + q/(LC) = 0, интегрируется RK4 мелкими шагами.
   Энергия перетекает из поля конденсатора в поле катушки и обратно,
   T = 2π√(LC) (формула Томсона); сопротивление гасит колебания.

   dcmotor — двигатель постоянного тока с постоянными магнитами. Вращаясь,
   якорь наводит противо-ЭДС E = kω, поэтому ток I = (U − kω)/R падает по
   мере разгона. J·dω/dt = kI − M — линейное уравнение, шаг точный:
   ω → ω∞ + (ω − ω∞)·e^(−dt/τ),  τ = JR/k²,  ω∞ = (U − RM/k)/k.

   threephase — три синусоиды со сдвигом 120°, звезда или треугольник,
   нагрузка по фазам. Три катушки статора, сдвинутые на 120°, создают поле
   постоянной величины 1,5·B_max, вращающееся с частотой сети, — на этом
   работает асинхронный двигатель. */
Object.assign(SIMS,{
lc:{
  title:'Колебательный контур: свободные колебания',
  timeUnit:'мс',
  schema:true,
  params:[
    {key:'C',label:'Ёмкость C',unit:'мкФ',min:1,max:1000,step:1,default:100},
    {key:'L',label:'Индуктивность L',unit:'мГн',min:10,max:2000,step:10,default:400},
    {key:'R',label:'Сопротивление R',unit:'Ом',min:0,max:200,step:0.5,default:2},
    {key:'U0',label:'Начальное напряжение на конденсаторе',unit:'В',min:1,max:100,step:1,default:20},
    {type:'group',label:'Показывать'},
    {key:'spring',label:'Механическая аналогия: груз на пружине',type:'check',default:true}
  ],
  T(p){ return 2*Math.PI*Math.sqrt(p.L/1000*p.C*1e-6)*1000; },        // мс
  init(p){ return {t:0,q:p.C*1e-6*p.U0,i:0,event:null,__stop:null}; },
  step(s,dt,p){
    const L=p.L/1000, C=p.C*1e-6, R=p.R, шаг=dt*this.T(p)/2.5/1000;   // период — за 2,5 секунды сцены
    const n=200, h=шаг/n, f=(q,i)=>[i,-(R*i+q/C)/L];
    for(let k=0;k<n;k++){
      const [a1,b1]=f(s.q,s.i), [a2,b2]=f(s.q+h*a1/2,s.i+h*b1/2), [a3,b3]=f(s.q+h*a2/2,s.i+h*b2/2), [a4,b4]=f(s.q+h*a3,s.i+h*b3);
      s.q+=h*(a1+2*a2+2*a3+a4)/6; s.i+=h*(b1+2*b2+2*b3+b4)/6;
    }
    s.t+=шаг*1000;
  },
  энергии(s,p){ const C=p.C*1e-6, L=p.L/1000; return {WC:s.q*s.q/(2*C),WL:L*s.i*s.i/2}; },
  readouts(s,p){
    const E=this.энергии(s,p), C=p.C*1e-6;
    return [['t',s.t,'мс'],['заряд q',s.q*1e6,'мкКл'],['напряжение на конденсаторе',s.q/C,'В'],['ток I',s.i*1000,'мА'],
      ['энергия поля конденсатора',E.WC*1000,'мДж'],['энергия поля катушки',E.WL*1000,'мДж'],['полная энергия',(E.WC+E.WL)*1000,'мДж']];
  },
  graphs:[
    {label:'q(t) — заряд конденсатора',unit:'мкКл',series:['q'],get:s=>[s.q*1e6,null]},
    {label:'Энергия: конденсатор и катушка',unit:'мДж',series:['W_C','W_L'],get(s,p){ const E=SIMS.lc.энергии(s,p); return [E.WC*1000,E.WL*1000]; }}
  ],
  presets:[
    {name:'Почти без потерь: энергия переливается',values:{R:0.5}},
    {name:'Заметное затухание',values:{R:20}},
    {name:'Критическое затухание: колебаний нет',values:{C:100,L:400,R:126.5}},
    {name:'Вчетверо большая ёмкость — период вдвое длиннее',values:{C:400,R:2}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(9*PX_PER_M),(H-20)/(5.6*PX_PER_M)),0.002,30);
    return {x:4.4,y:2.5,scale};
  },
  anchors(){ return [{x:0,y:0},{x:9,y:5}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const C=p.C*1e-6, q0=C*p.U0, x=s.q/q0, I0=q0/Math.sqrt(p.L/1000*C), y=s.i/I0, E=this.энергии(s,p), W0=q0*q0/(2*C);
    // схема: конденсатор слева, катушка справа
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.8);
    ctx.beginPath(); ctx.moveTo(1,4.2); ctx.lineTo(5,4.2); ctx.lineTo(5,3.3); ctx.moveTo(5,1.7); ctx.lineTo(5,0.8); ctx.lineTo(1,0.8); ctx.lineTo(1,2.2); ctx.moveTo(1,2.8); ctx.lineTo(1,4.2); ctx.stroke();
    ctx.lineWidth=v.lw(3); ctx.beginPath(); ctx.moveTo(0.4,2.8); ctx.lineTo(1.6,2.8); ctx.moveTo(0.4,2.2); ctx.lineTo(1.6,2.2); ctx.stroke();
    // заряды на обкладках
    const nq=Math.round(Math.abs(x)*6);
    for(let k=0;k<nq;k++){ const xx=0.5+k*0.18; v.label(ctx,x>0?'+':'−',xx,2.95,-3,0,x>0?dang:acc); v.label(ctx,x>0?'−':'+',xx,2.05,-3,0,x>0?acc:dang); }
    if(Math.abs(x)>0.05){ ctx.strokeStyle=meas; ctx.globalAlpha=Math.abs(x)*0.8; ctx.lineWidth=v.lw(1);
      for(let k=0;k<5;k++){ const xx=0.55+k*0.25; ctx.beginPath(); ctx.moveTo(xx,2.75); ctx.lineTo(xx,2.25); ctx.stroke(); } ctx.globalAlpha=1; }
    v.label(ctx,`C = ${p.C} мкФ`,0.4,2.5,-70,0,ink3);
    // катушка: витки и поле, пропорциональное току
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.8);
    for(let k=0;k<5;k++){ ctx.beginPath(); ctx.ellipse(5,1.85+k*0.32,0.35,0.16,0,0,Math.PI); ctx.stroke(); }
    if(Math.abs(y)>0.05){ ctx.strokeStyle=sec; ctx.globalAlpha=Math.abs(y)*0.7; ctx.lineWidth=v.lw(1.2);
      for(const r of [0.6,0.9]){ ctx.beginPath(); ctx.ellipse(5,2.5,r,1.1+r*0.3,0,0,7); ctx.stroke(); } ctx.globalAlpha=1; }
    v.label(ctx,`L = ${p.L} мГн`,5.4,2.5,8,0,ink3);
    if(p.R>0){ ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.5); ctx.fillStyle=v.c('--panel'); ctx.fillRect(2.6,0.68,0.8,0.24); ctx.strokeRect(2.6,0.68,0.8,0.24); v.label(ctx,`R = ${p.R} Ом`,2.6,0.68,0,14,ink3); }
    // ток по контуру
    if(Math.abs(y)>0.03){ const з=Math.sign(s.i); v.arrow(ctx,3-з*0.6,4.2,3+з*0.6,4.2,acc); v.label(ctx,`I = ${(s.i*1000).toFixed(0)} мА`,3,4.2,-30,-12,acc); }
    // столбики энергии
    const bx=6.4, bh=3.4, tot=Math.max(W0,1e-12);
    for(const [k,[W,имя,цв]] of [[E.WC,'конденсатор',meas],[E.WL,'катушка',sec]].entries()){
      const x0=bx+k*0.9; ctx.fillStyle=line; ctx.fillRect(x0,0.8,0.55,bh); ctx.fillStyle=цв; ctx.fillRect(x0,0.8,0.55,bh*W/tot);
      v.label(ctx,имя,x0,0.8,-6,14+k*12,цв); }
    v.label(ctx,'энергия',bx,0.8+bh,0,-10,ink3);
    // механическая аналогия: смещение груза ~ заряд, скорость ~ ток
    if(p.spring){ const gx=8.4+0*x, yy=2.5+x*1.3;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(gx,4.6);
      for(let k=0;k<=10;k++) ctx.lineTo(gx+(k%2?0.18:-0.18),4.6-(4.6-yy-0.25)*k/10); ctx.stroke();
      ctx.fillStyle=ink2; ctx.fillRect(gx-0.25,yy-0.25,0.5,0.5);
      v.label(ctx,'q ↔ x, I ↔ v',gx-0.4,0.8,0,14,ink3); }
  }
},

dcmotor:{
  title:'Двигатель постоянного тока: противо-ЭДС и КПД',
  schema:true,
  params:[
    {key:'U',label:'Напряжение питания U',unit:'В',min:1,max:48,step:0.5,default:12},
    {key:'R',label:'Сопротивление обмотки якоря R',unit:'Ом',min:0.1,max:10,step:0.1,default:1},
    {key:'k',label:'Постоянная двигателя k',unit:'В·с/рад',min:0.01,max:0.5,step:0.005,default:0.05},
    {key:'M',label:'Момент нагрузки M',unit:'Н·м',min:0,max:1,step:0.005,default:0.1},
    {key:'J',label:'Момент инерции якоря J',unit:'×10⁻⁴ кг·м²',min:0.5,max:50,step:0.5,default:5}
  ],
  τ(p){ return p.J*1e-4*p.R/(p.k*p.k); },
  ωуст(p){ return (p.U-p.R*p.M/p.k)/p.k; },
  init(p){ return {t:0,ω:0,φ:0,event:null,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    if(p.k*p.U/p.R<=p.M){ s.ω=0; if(!s.event){ s.event={type:'stall',t:s.t}; s.__stop='Пусковой момент меньше нагрузки: двигатель не трогается, вся мощность уходит в тепло'; } return; }
    const ωу=this.ωуст(p); s.ω=ωу+(s.ω-ωу)*Math.exp(-dt/this.τ(p));
    s.φ+=Math.min(s.ω,25)*dt;                                         // видимое вращение не быстрее 4 об/с
  },
  ток(s,p){ return (p.U-p.k*s.ω)/p.R; },
  readouts(s,p){
    const I=this.ток(s,p), Pin=p.U*I, Pm=p.M*s.ω, Pq=I*I*p.R;
    return [['t',s.t,'с'],['частота вращения',s.ω*60/(2*Math.PI),'об/мин'],['ток якоря I',I,'А'],['противо-ЭДС E = kω',p.k*s.ω,'В'],
      ['потребляемая мощность UI',Pin,'Вт'],['полезная мощность Mω',Pm,'Вт'],['тепло в обмотке I²R',Pq,'Вт'],['КПД',Pin>0?100*Pm/Pin:0,'%']];
  },
  graphs:[
    {label:'Частота вращения',unit:'об/мин',series:['n'],get:s=>[s.ω*60/(2*Math.PI),null]},
    {label:'Ток якоря: бросок при пуске',unit:'А',series:['I'],get(s,p){ return [SIMS.dcmotor.ток(s,p),null]; }}
  ],
  presets:[
    {name:'Пуск: ток сначала огромный',values:{U:12,R:1,k:0.05,M:0.1}},
    {name:'Холостой ход: почти без тока',values:{U:12,R:1,k:0.05,M:0}},
    {name:'Перегрузка: двигатель не трогается',values:{U:12,R:1,k:0.05,M:0.7}},
    {name:'Вдвое большее напряжение — вдвое быстрее',values:{U:24,R:1,k:0.05,M:0.1}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(9*PX_PER_M),(H-20)/(5.6*PX_PER_M)),0.002,30);
    return {x:4.3,y:2.5,scale};
  },
  anchors(){ return [{x:0,y:0},{x:9,y:5}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line'), ok=v.c('--ok');
    const cx=2.6, cy=2.6, I=this.ток(s,p);
    // статор: магниты N и S
    ctx.fillStyle=dang; ctx.globalAlpha=.75; ctx.fillRect(cx-2.4,cy-1.1,0.7,2.2); ctx.fillStyle=acc; ctx.fillRect(cx+1.7,cy-1.1,0.7,2.2); ctx.globalAlpha=1;
    v.label(ctx,'N',cx-2.1,cy,-4,0,'#fff'); v.label(ctx,'S',cx+2,cy,-4,0,'#fff');
    ctx.strokeStyle=line; ctx.lineWidth=v.lw(1); for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.moveTo(cx-1.7,cy+k*0.4); ctx.lineTo(cx+1.7,cy+k*0.4); ctx.stroke(); }
    // якорь — рамка, видимая сбоку: ширина проекции cos φ
    const c=Math.cos(s.φ), w=1.3*c;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2.4); ctx.beginPath(); ctx.moveTo(cx-w,cy+1.2); ctx.lineTo(cx-w,cy-1.2); ctx.moveTo(cx+w,cy+1.2); ctx.lineTo(cx+w,cy-1.2); ctx.stroke();
    ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(cx-w,cy+1.2); ctx.lineTo(cx+w,cy+1.2); ctx.moveTo(cx-w,cy-1.2); ctx.lineTo(cx+w,cy-1.2); ctx.stroke();
    // сила Ампера на стороны рамки
    if(Math.abs(I)>1e-3){ const L=clamp(Math.abs(I)/(p.U/p.R)*1.1,0.2,1.1)*Math.sign(I);
      v.arrow(ctx,cx-w,cy,cx-w,cy+L,ok); v.arrow(ctx,cx+w,cy,cx+w,cy-L,ok); }
    // коллектор и щётки
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(cx,cy-1.9,0.25,0,7); ctx.fill();
    ctx.fillStyle=ink3; ctx.fillRect(cx-0.55,cy-2.05,0.25,0.3); ctx.fillRect(cx+0.3,cy-2.05,0.25,0.3);
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(cx-0.55,cy-1.9); ctx.lineTo(cx-1.4,cy-1.9); ctx.lineTo(cx-1.4,cy-2.4);
    ctx.moveTo(cx+0.55,cy-1.9); ctx.lineTo(cx+1.4,cy-1.9); ctx.lineTo(cx+1.4,cy-2.4); ctx.stroke();
    v.label(ctx,`U = ${p.U} В`,cx-0.4,cy-2.4,0,10,ink2);
    // груз на барабане: нагрузка
    ctx.strokeStyle=ink3; ctx.beginPath(); ctx.arc(cx,cy+1.9,0.3,0,7); ctx.stroke();
    v.label(ctx,`нагрузка ${p.M} Н·м`,cx+0.4,cy+1.9,6,0,ink3);
    // баланс мощности
    const Pin=Math.max(1e-9,p.U*I), Pm=p.M*s.ω, Pq=I*I*p.R, bx=6, bw=2.6, by=4.2;
    v.label(ctx,'куда идёт мощность',bx,by,0,-12,ink2);
    ctx.fillStyle=line; ctx.fillRect(bx,by-0.5,bw,0.4);
    ctx.fillStyle=ok; ctx.fillRect(bx,by-0.5,bw*Math.max(0,Pm)/Pin,0.4);
    ctx.fillStyle=dang; ctx.fillRect(bx+bw*Math.max(0,Pm)/Pin,by-0.5,bw*Pq/Pin,0.4);
    v.label(ctx,`работа ${Pm.toFixed(1)} Вт`,bx,by-0.5,0,14,ok); v.label(ctx,`тепло ${Pq.toFixed(1)} Вт`,bx,by-0.5,0,28,dang);
    const n=s.ω*60/(2*Math.PI);
    v.label(ctx,`${n.toFixed(0)} об/мин`,bx,2.6,0,0,acc);
    v.label(ctx,`I = ${I.toFixed(2)} А, E = ${(p.k*s.ω).toFixed(2)} В`,bx,2.6,0,16,ink2);
  }
},

threephase:{
  title:'Трёхфазный ток и вращающееся магнитное поле',
  timeUnit:'мс',
  schema:true,
  params:[
    {key:'Uf',label:'Фазное напряжение U_ф (действующее)',unit:'В',min:50,max:400,step:1,default:220},
    {key:'f',label:'Частота сети f',unit:'Гц',min:10,max:100,step:1,default:50},
    {key:'conn',label:'Соединение нагрузки',type:'select',default:'star',
     options:[{v:'star',t:'звезда с нейтральным проводом'},{v:'delta',t:'треугольник'}]},
    {key:'Ra',label:'Нагрузка фазы A',unit:'Ом',min:10,max:500,step:1,default:100},
    {key:'Rb',label:'Нагрузка фазы B',unit:'Ом',min:10,max:500,step:1,default:100},
    {key:'Rc',label:'Нагрузка фазы C',unit:'Ом',min:10,max:500,step:1,default:100},
    {type:'group',label:'Показывать'},
    {key:'field',label:'Вращающееся поле статора',type:'check',default:true}
  ],
  ф:[0,-2*Math.PI/3,2*Math.PI/3],
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt*(1000/p.f)/3; },                               // период — за 3 секунды сцены
  u(p,t,k){ return Math.SQRT2*p.Uf*Math.sin(2*Math.PI*p.f*t/1000+this.ф[k]); },
  R(p){ return [p.Ra,p.Rb,p.Rc]; },
  /* мгновенные токи в линиях */
  токи(p,t){
    const R=this.R(p), u=[0,1,2].map(k=>this.u(p,t,k));
    if(p.conn==='star') return u.map((x,k)=>x/R[k]);
    const iab=(u[0]-u[1])/R[0], ibc=(u[1]-u[2])/R[1], ica=(u[2]-u[0])/R[2];
    return [iab-ica,ibc-iab,ica-ibc];
  },
  /* действующие значения через комплексные амплитуды */
  комплекс(p){
    const R=this.R(p), U=[0,1,2].map(k=>[p.Uf*Math.cos(this.ф[k]),p.Uf*Math.sin(this.ф[k])]);
    const div=(z,r)=>[z[0]/r,z[1]/r], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mod=z=>Math.hypot(z[0],z[1]);
    if(p.conn==='star'){ const I=U.map((z,k)=>div(z,R[k])); return {I:I.map(mod),IN:mod(I.reduce(add)),P:U.reduce((a,z,k)=>a+p.Uf*p.Uf/R[k],0)}; }
    const Ul=[sub(U[0],U[1]),sub(U[1],U[2]),sub(U[2],U[0])], If=Ul.map((z,k)=>div(z,R[k]));
    const Il=[sub(If[0],If[2]),sub(If[1],If[0]),sub(If[2],If[1])];
    return {I:Il.map(mod),IN:0,P:Ul.reduce((a,z,k)=>a+mod(z)*mod(z)/R[k],0),If:If.map(mod)};
  },
  поле(p,t){ // три катушки под 120°, поле каждой ∝ своему току
    const i=this.токи(p,t), R=this.R(p), Imax=Math.SQRT2*p.Uf/Math.min(...R)*(p.conn==='delta'?3:1);
    let bx=0,by=0; for(let k=0;k<3;k++){ const b=i[k]/Imax; bx+=b*Math.cos(k*2*Math.PI/3); by+=b*Math.sin(k*2*Math.PI/3); }
    return [bx,by];
  },
  readouts(s,p){
    const к=this.комплекс(p), [bx,by]=this.поле(p,s.t);
    const out=[['t',s.t,'мс'],['линейное напряжение U_л',Math.sqrt(3)*p.Uf,'В'],['ток в линии A',к.I[0],'А'],
      ['потребляемая мощность',к.P/1000,'кВт']];
    if(p.conn==='star') out.push(['ток в нейтральном проводе',к.IN,'А']);
    else out.push(['ток в нагрузке AB',к.If[0],'А']);
    out.push(['поле статора |B| (в долях одной катушки)',Math.hypot(bx,by),'']);
    return out;
  },
  graphs:[
    {label:'Напряжения фаз',unit:'В',series:['u_A','u_B'],get(s,p){ return [SIMS.threephase.u(p,s.t,0),SIMS.threephase.u(p,s.t,1)]; }},
    {label:'Ток в нейтрали (звезда)',unit:'А',series:['i_N'],get(s,p){ const i=SIMS.threephase.токи(p,s.t); return [p.conn==='star'?i[0]+i[1]+i[2]:0,null]; }}
  ],
  presets:[
    {name:'Симметричная нагрузка: ток в нейтрали — ноль',values:{conn:'star',Ra:100,Rb:100,Rc:100}},
    {name:'Несимметричная: нейтраль нужна',values:{conn:'star',Ra:50,Rb:100,Rc:300}},
    {name:'Треугольник: ток в линии в √3 раз больше',values:{conn:'delta',Ra:100,Rb:100,Rc:100}},
    {name:'Медленная сеть 10 Гц',values:{f:10}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(9.4*PX_PER_M),(H-20)/(5.6*PX_PER_M)),0.002,30);
    return {x:4.5,y:2.4,scale};
  },
  anchors(){ return [{x:0,y:0},{x:9,y:5}]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line'), meas=v.c('--measure');
    const цв=[v.c('--danger'),v.c('--ok'),v.c('--accent')], имя=['A','B','C'];
    // синусоиды за период и курсор времени
    const gx=0.2, gy=2.4, gw=4.4, gh=1.6, T=1000/p.f, Um=Math.SQRT2*p.Uf, τ=(s.t%T)/T;
    ctx.strokeStyle=line; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    for(let k=0;k<3;k++){ ctx.strokeStyle=цв[k]; ctx.lineWidth=v.lw(2); ctx.beginPath();
      for(let i=0;i<=120;i++){ const t=s.t-T*τ+T*i/120, x=gx+gw*i/120, y=gy+gh*this.u(p,t,k)/Um; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
      v.label(ctx,`u_${имя[k]}`,gx+gw,gy+gh*this.u(p,s.t-T*τ+T,k)/Um,6,0,цв[k]); }
    ctx.strokeStyle=meas; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(gx+gw*τ,gy-gh-0.1); ctx.lineTo(gx+gw*τ,gy+gh+0.1); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,'три фазы, сдвиг 120°',gx,gy+gh+0.1,0,-4,ink3);
    // статор: три катушки, сдвинутые на 120°, и результирующее поле
    const cx=7, cy=2.4, R=1.9;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.stroke();
    const i=this.токи(p,s.t), Imax=Math.SQRT2*p.Uf/Math.min(...this.R(p))*(p.conn==='delta'?3:1);
    for(let k=0;k<3;k++){ const a=k*2*Math.PI/3, ex=Math.cos(a), ey=Math.sin(a);
      for(const з of [1,-1]){ ctx.fillStyle=цв[k]; ctx.globalAlpha=0.25+0.6*Math.abs(i[k])/Imax; ctx.beginPath(); ctx.arc(cx+з*ex*R,cy+з*ey*R,0.22,0,7); ctx.fill(); ctx.globalAlpha=1; }
      v.label(ctx,имя[k],cx+ex*(R+0.45),cy+ey*(R+0.45),-4,0,цв[k]);
      if(p.field){ const b=i[k]/Imax; if(Math.abs(b)>0.03) v.arrow(ctx,cx,cy,cx+ex*b*1.1,cy+ey*b*1.1,цв[k]); } }
    if(p.field){ const [bx,by]=this.поле(p,s.t); v.arrow(ctx,cx,cy,cx+bx*1.1,cy+by*1.1,ink2);
      v.label(ctx,`|B| = ${Math.hypot(bx,by).toFixed(2)} — вращается с частотой сети`,cx-R,cy-R,-20,16,ink2);
      // ротор асинхронного двигателя отстаёт от поля на несколько процентов (скольжение)
      const ар=Math.atan2(by,bx)-0.05*2*Math.PI*p.f*s.t/1000;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(3); ctx.beginPath(); ctx.moveTo(cx-Math.cos(ар)*0.5,cy-Math.sin(ар)*0.5); ctx.lineTo(cx+Math.cos(ар)*0.5,cy+Math.sin(ар)*0.5); ctx.stroke(); }
    const к=this.комплекс(p);
    v.label(ctx,p.conn==='star'?`звезда: I_N = ${к.IN.toFixed(2)} А`:`треугольник: I_л = ${к.I[0].toFixed(2)} А`,gx,0.2,0,0,ink2);
  }
}
});
