/* ===================== ЗВУК, ВОЛНОВАЯ ОПТИКА, ЗЕРКАЛА, ТЕПЛОВОЕ ИЗЛУЧЕНИЕ (7.0.0) =====================
   sound — продольная звуковая волна: слои воздуха смещаются вдоль луча
       ξ = ξ₀·sin(ωt − kx), давление опережает смещение на четверть волны.
       Уровень громкости L = 10·lg(I/I₀), I₀ = 10⁻¹² Вт/м²; амплитуда
       давления p₀ = √(2ρvI), смещения ξ₀ = p₀/(ρvω). Второй тон даёт
       биения с частотой |f₁ − f₂| и интервал f₂/f₁ (октава 2:1, квинта 3:2…).
   pipe — акустический резонанс в трубе. Открытая с двух концов:
       fₙ = n·v/(2L); закрытая с одного конца: fₙ = (2n − 1)·v/(4L).
       Скорость звука в воздухе v = 331,3·√(1 + t/273,15) м/с.
   fresnel — зоны Френеля для плоской волны: радиус m-й зоны rₘ = √(mλb),
       число открытых зон m = r²/(λb); на оси за круглым отверстием
       I/I₀ = 4·sin²(πm/2). За непрозрачным диском — пятно Пуассона, I ≈ I₀;
       зонная пластинка (открыты нечётные зоны) — I ≈ 4N²·I₀.
   polar — закон Малюса I = I₀·cos²φ для цепочки поляроидов и формулы
       Френеля для отражения от диэлектрика; tg θ_Б = n (угол Брюстера).
   mirror — сферическое зеркало: 1/d + 1/f = 1/F, F = R/2, Γ = −f/d.
   blackbody — спектр Планка, закон смещения Вина λ_max = b/T и закон
       Стефана — Больцмана M = εσT⁴; цвет тела посчитан по спектру.
   photometry — освещённость от точечного источника E = I·cos α / r²;
       фотометр с двумя лампами: равенство I₁/r₁² = I₂/r₂². */
const ВОЛНЫ7={
  /* аналитическая аппроксимация функций сложения цветов CIE 1931 (Wyman и др., 2013) */
  cie(l){ const g=(m,s1,s2)=>{ const t=(l-m)/(l<m?s1:s2); return Math.exp(-0.5*t*t); };
    return [1.056*g(599.8,37.9,31)+0.362*g(442,16,26.7)-0.065*g(501.1,20.4,26.2),
            0.821*g(568.8,46.9,40.5)+0.286*g(530.9,16.3,31.1),
            1.217*g(437,11.8,36)+0.681*g(459,26,13.8)]; },
  /* цвет спектра f(λ, нм) в sRGB 0…255 при нормировке по наибольшему каналу */
  цветСпектра(f){ let X=0,Y=0,Z=0; for(let l=380;l<=780;l+=5){ const w=f(l), c=this.cie(l); X+=w*c[0]; Y+=w*c[1]; Z+=w*c[2]; }
    let r=3.2406*X-1.5372*Y-0.4986*Z, g=-0.9689*X+1.8758*Y+0.0415*Z, b=0.0557*X-0.204*Y+1.057*Z;
    const m=Math.max(r,g,b,1e-30); r=Math.max(0,r/m); g=Math.max(0,g/m); b=Math.max(0,b/m);
    const гамма=u=>u<=0.0031308?12.92*u:1.055*Math.pow(u,1/2.4)-0.055;
    return [гамма(r),гамма(g),гамма(b)].map(u=>Math.round(255*clamp(u,0,1))); },
  цветВолны(l){ const c=this.цветСпектра(x=>Math.abs(x-l)<3?1:0).map(u=>Math.round(u*0.62+140*0.38)); return `rgb(${c[0]},${c[1]},${c[2]})`; }
};

Object.assign(SIMS,{
/* ------------------------------------------------------------------ */
sound:{
  title:'Звуковая волна: громкость, высота, биения',
  schema:true,
  params:[
    {key:'med',label:'Среда',type:'select',default:'air',
     options:[{v:'air',t:'воздух, 20 °C: v = 343 м/с'},{v:'water',t:'вода: v = 1482 м/с'},{v:'steel',t:'сталь: v = 5960 м/с'},{v:'he',t:'гелий: v = 1007 м/с'}]},
    {key:'f',label:'Частота f',unit:'Гц',min:20,max:20000,step:1,default:440},
    {key:'L',label:'Уровень громкости L',unit:'дБ',min:0,max:140,step:1,default:70},
    {key:'two',label:'Второй тон',type:'check',default:false},
    {key:'f2',label:'Частота второго тона f₂',unit:'Гц',min:20,max:20000,step:1,default:444,если:p=>p.two},
    {type:'group',label:'Показывать'},
    {key:'pres',label:'Кривая давления',type:'check',default:true},
    {key:'osc',label:'Осциллограмма в точке',type:'check',default:true}
  ],
  MED:{air:{v:343,ρ:1.204,имя:'воздух'},water:{v:1482,ρ:998,имя:'вода'},steel:{v:5960,ρ:7850,имя:'сталь'},he:{v:1007,ρ:0.166,имя:'гелий'}},
  I0:1e-12,
  м(p){ return this.MED[p.med]||this.MED.air; },
  I(p){ return this.I0*Math.pow(10,p.L/10); },
  pa(p){ const м=this.м(p); return Math.sqrt(2*м.ρ*м.v*this.I(p)); },
  ξa(p){ const м=this.м(p); return this.pa(p)/(м.ρ*м.v*2*Math.PI*p.f); },
  ИНТЕРВАЛЫ:[[1,'унисон'],[2,'октава'],[3/2,'квинта'],[4/3,'кварта'],[5/4,'большая терция'],[6/5,'малая терция'],[5/3,'большая секста'],[16/15,'малая секунда'],[45/32,'тритон']],
  интервал(p){
    const r=Math.max(p.f,p.f2)/Math.min(p.f,p.f2); let лучш=null;
    for(const [q,имя] of this.ИНТЕРВАЛЫ){ const d=Math.abs(1200*Math.log2(r/q)); if(!лучш||d<лучш.d) лучш={q,имя,d}; }
    return Object.assign({r},лучш);
  },
  громкость(L){ return L<10?'на пороге слышимости':L<30?'шёпот, шорох листвы':L<60?'обычный разговор':L<85?'шумная улица':L<110?'опасно для слуха при долгом действии':L<130?'рок-концерт, отбойный молоток':'болевой порог'; },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    const м=this.м(p), out=[['длина волны λ = v/f',м.v/p.f,'м'],['период T = 1/f',1000/p.f,'мс'],['скорость звука v',м.v,'м/с'],
      ['интенсивность I',this.I(p),'Вт/м²'],['амплитуда давления p₀',this.pa(p),'Па'],['амплитуда смещения ξ₀',this.ξa(p)*1e9,'нм'],
      ['на слух',p.f<20?'инфразвук — не слышен':p.f>20000?'ультразвук — не слышен':this.громкость(p.L),'']];
    if(p.two){ const и=this.интервал(p); out.push(['частота биений |f₁ − f₂|',Math.abs(p.f-p.f2),'Гц'],
      ['отношение частот f₂/f₁',p.f2/p.f,''],['ближайший интервал',`${и.имя} (${и.d<15?'чисто':'расстроено на '+и.d.toFixed(0)+' центов'})`,'']); }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Камертон «ля»: 440 Гц',values:{med:'air',f:440,L:70,two:false}},
    {name:'Биения: 440 и 444 Гц',values:{med:'air',f:440,L:70,two:true,f2:444}},
    {name:'Квинта: 440 и 660 Гц',values:{med:'air',f:440,L:70,two:true,f2:660}},
    {name:'Тот же звук в воде',values:{med:'water',f:440,L:70,two:false}},
    {name:'Порог слышимости',values:{med:'air',f:1000,L:0,two:false}}
  ],
  /* показ замедлен: волна на экране идёт с частотой 0,6 Гц и длиной 4 единицы */
  ВИД:{λ:4,f:0.6},
  ξ(p,x,t){ const В=this.ВИД, k=2*Math.PI/В.λ, ω=2*Math.PI*В.f;
    if(!p.two) return Math.sin(ω*t-k*x);
    const r=p.f2/p.f; return 0.5*(Math.sin(ω*t-k*x)+Math.sin(r*(ω*t-k*x))); },
  пояснения(p){ const м=this.м(p);
    return [[`${м.имя}: λ = v/f = ${числоНаСцене(м.v/p.f,3)} м, L = ${p.L} дБ ⇒ I = ${числоНаСцене(this.I(p),2)} Вт/м²`,css('--ink-2'),true],
      ['показ замедлен, смещения слоёв увеличены: на деле они — доли микрометра',css('--ink-3')]]; },
  fit(p,vp){ return fitСПояснением(vp,11.4,8.2,5,0.6,this.пояснения(p),36); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    v.занятьНиз(this.пояснения(p));
    const В=this.ВИД, X=10, a=0.06+0.2*clamp(p.L/140,0,1);
    // столб воздуха: слои-точки смещаются вдоль луча
    const рядов=7, y0=1.2, y1=4.2;
    ctx.fillStyle=ink2;
    for(let i=0;i<=110;i++){ const x0=i*X/110, x=x0+a*this.ξ(p,x0,s.t);
      for(let j=0;j<рядов;j++){ const y=y0+(y1-y0)*j/(рядов-1)+((i%2)?0.12:0);
        ctx.beginPath(); ctx.arc(x,y,v.lw(1.8),0,7); ctx.fill(); } }
    // источник — динамик слева
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(-0.15+a*this.ξ(p,0,s.t),y0-0.3); ctx.lineTo(-0.15+a*this.ξ(p,0,s.t),y1+0.3); ctx.stroke();
    v.text(ctx,'источник',-0.2,y1+0.6,ink3,10,'center');
    // длина волны — скобкой
    if(!p.two){ const ya=y1+0.55; ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.moveTo(2,ya); ctx.lineTo(2+В.λ,ya); ctx.moveTo(2,ya-0.12); ctx.lineTo(2,ya+0.12); ctx.moveTo(2+В.λ,ya-0.12); ctx.lineTo(2+В.λ,ya+0.12); ctx.stroke();
      v.text(ctx,`λ = ${числоНаСцене(this.м(p).v/p.f,3)} м`,2+В.λ/2,ya+0.32,meas,11,'center'); }
    // давление: опережает смещение на четверть периода (p ∝ −∂ξ/∂x)
    if(p.pres){ const yb=-0.4, h=0.75, d=1e-3;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(0,yb); ctx.lineTo(X,yb); ctx.stroke(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2); ctx.beginPath();
      for(let i=0;i<=300;i++){ const x=i*X/300, dp=-(this.ξ(p,x+d,s.t)-this.ξ(p,x-d,s.t))/(2*d)*В.λ/(2*Math.PI);
        const y=yb+h*dp; i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke(); v.text(ctx,'избыточное давление: сгущения — горбы, разрежения — впадины',X/2,yb-h-0.3,acc,10.5,'center'); }
    // осциллограмма давления в точке за реальное время
    if(p.osc){ const yo=-2.9, h=0.8, Tw=p.two?Math.min(0.5,Math.max(4/p.f,2.2/Math.max(1e-9,Math.abs(p.f-p.f2)))):5/p.f;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1); ctx.strokeRect(0,yo-h-0.15,X,2*h+0.3); ctx.globalAlpha=1;
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.4); ctx.beginPath();
      for(let i=0;i<=900;i++){ const τ=i/900*Tw, u=p.two?0.5*(Math.cos(2*Math.PI*p.f*τ)+Math.cos(2*Math.PI*p.f2*τ)):Math.cos(2*Math.PI*p.f*τ);
        const x=i/900*X, y=yo+h*u; i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      if(p.two){ ctx.strokeStyle=dang; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1);
        for(const sg of [1,-1]){ ctx.beginPath(); for(let i=0;i<=300;i++){ const τ=i/300*Tw, e=Math.abs(Math.cos(Math.PI*(p.f-p.f2)*τ));
          const x=i/300*X; i?ctx.lineTo(x,yo+sg*h*e):ctx.moveTo(x,yo+sg*h*e); } ctx.stroke(); }
        ctx.setLineDash([]); }
      v.text(ctx,`давление в одной точке за ${числоНаСцене(Tw*1000,3)} мс${p.two?' — огибающая биений':''}`,X/2,yo-h-0.45,ink2,10.5,'center'); }
    v.пояснение(ctx,this.пояснения(p));
  }
},

/* ------------------------------------------------------------------ */
pipe:{
  title:'Акустический резонанс: звучащая труба',
  schema:true,
  params:[
    {key:'kind',label:'Труба',type:'select',default:'open',
     options:[{v:'open',t:'открыта с обоих концов (флейта)'},{v:'closed',t:'закрыта с одного конца (кларнет, бутылка)'}]},
    {key:'L',label:'Длина трубы L',unit:'м',min:0.1,max:3,step:0.01,default:0.6},
    {key:'n',label:'Номер резонанса n',min:1,max:6,step:1,default:1},
    {key:'T',label:'Температура воздуха t',unit:'°C',min:-30,max:50,step:1,default:20},
    {type:'group',label:'Показывать'},
    {key:'disp',label:'Огибающая смещений',type:'check',default:true},
    {key:'pres',label:'Огибающая давления',type:'check',default:true}
  ],
  v(p){ return 331.3*Math.sqrt(1+p.T/273.15); },
  q(p){ return p.kind==='closed'?2*p.n-1:p.n; },                      // число четвертей/половин волны
  λ(p){ return p.kind==='closed'?4*p.L/this.q(p):2*p.L/this.q(p); },
  f(p){ return this.v(p)/this.λ(p); },
  f1(p){ return p.kind==='closed'?this.v(p)/(4*p.L):this.v(p)/(2*p.L); },
  /* огибающая смещения вдоль трубы, x от 0 до 1 (доля длины); закрытый конец — x = 0 */
  смещ(p,x){ return p.kind==='closed'?Math.sin(this.q(p)*Math.PI*x/2):Math.cos(this.q(p)*Math.PI*x); },
  давл(p,x){ return p.kind==='closed'?Math.cos(this.q(p)*Math.PI*x/2):Math.sin(this.q(p)*Math.PI*x); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    return [['скорость звука v',this.v(p),'м/с'],['частота резонанса fₙ',this.f(p),'Гц'],['длина волны λₙ',this.λ(p),'м'],
      ['основной тон f₁',this.f1(p),'Гц'],['fₙ/f₁ — номер обертона',this.f(p)/this.f1(p),''],
      ['узлов смещения внутри',p.kind==='closed'?p.n-1:p.n,'']];
  },
  graphs:[],
  presets:[
    {name:'Флейта: открытая, 0,6 м',values:{kind:'open',L:0.6,n:1,T:20}},
    {name:'Закрытая труба той же длины — на октаву ниже',values:{kind:'closed',L:0.6,n:1,T:20}},
    {name:'Закрытая: только нечётные гармоники',values:{kind:'closed',L:0.6,n:3,T:20}},
    {name:'Органная труба 2,4 м',values:{kind:'open',L:2.4,n:1,T:20}},
    {name:'Мороз: звук ниже',values:{kind:'open',L:0.6,n:1,T:-30}}
  ],
  пояснения(p){
    return [[p.kind==='closed'?`закрытая: fₙ = (2n − 1)·v/4L = ${числоНаСцене(this.f(p),4)} Гц — только нечётные гармоники`:`открытая: fₙ = n·v/2L = ${числоНаСцене(this.f(p),4)} Гц`,css('--ink-2'),true],
      ['у открытого конца — пучность смещения и узел давления, у закрытого — наоборот',css('--ink-3')]]; },
  fit(p,vp){ return fitСПояснением(vp,11,6.4,5,0.4,this.пояснения(p),36); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure');
    v.занятьНиз(this.пояснения(p));
    const X0=0.5, X1=9.5, W=X1-X0, h=1.1, ω=2*Math.PI*0.7, c=Math.cos(ω*s.t);
    // стенки
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.moveTo(X0,h); ctx.lineTo(X1,h); ctx.moveTo(X0,-h); ctx.lineTo(X1,-h); ctx.stroke();
    if(p.kind==='closed'){ ctx.lineWidth=v.lw(4); ctx.beginPath(); ctx.moveTo(X0,-h); ctx.lineTo(X0,h); ctx.stroke(); }
    // частицы воздуха
    ctx.fillStyle=ink2;
    for(let i=0;i<=70;i++){ const u=i/70, x=X0+u*W+0.28*this.смещ(p,u)*c;
      for(let j=0;j<5;j++){ const y=-h+0.25+(2*h-0.5)*j/4+((i%2)?0.1:0); ctx.beginPath(); ctx.arc(clamp(x,X0+0.03,X1+0.4),y,v.lw(1.7),0,7); ctx.fill(); } }
    const кр=(f,y0,амп,цв,подп)=>{ ctx.strokeStyle=цв; ctx.lineWidth=v.lw(1.6);
      for(const sg of [1,-1]){ ctx.beginPath(); for(let i=0;i<=200;i++){ const u=i/200, x=X0+u*W, y=y0+sg*амп*f(u); i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke(); }
      v.text(ctx,подп,X1+0.2,y0,цв,10,'left'); };
    if(p.disp) кр(u=>Math.abs(this.смещ(p,u)),h+1.1,0.6,sec,'смещение');
    if(p.pres) кр(u=>Math.abs(this.давл(p,u)),-h-1.1,0.6,acc,'давление');
    // длина трубы
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(X0,-h-2.1); ctx.lineTo(X1,-h-2.1); ctx.stroke();
    v.text(ctx,`L = ${p.L} м,  λ = ${числоНаСцене(this.λ(p),3)} м`,(X0+X1)/2,-h-2.4,meas,11,'center');
    v.пояснение(ctx,this.пояснения(p));
  }
},

/* ------------------------------------------------------------------ */
fresnel:{
  title:'Зоны Френеля: светлое или тёмное пятно',
  timeless:true, schema:true,
  params:[
    {key:'mode',label:'Преграда',type:'select',default:'hole',
     options:[{v:'hole',t:'круглое отверстие'},{v:'disk',t:'непрозрачный диск (пятно Пуассона)'},{v:'plate',t:'зонная пластинка: открыты нечётные зоны'}]},
    {key:'lam',label:'Длина волны λ',unit:'нм',min:400,max:700,step:1,default:550},
    {key:'r',label:'Радиус отверстия (диска) r',unit:'мм',min:0.1,max:3,step:0.01,default:1},
    {key:'b',label:'Расстояние до экрана b',unit:'м',min:0.1,max:5,step:0.01,default:1}
  ],
  m(p){ return (p.r*1e-3)*(p.r*1e-3)/(p.lam*1e-9*p.b); },
  r1(p){ return Math.sqrt(p.lam*1e-9*p.b)*1e3; },                      // мм
  /* комплексная амплитуда на оси: каждая открытая полоса зон от m₁ до m₂
     даёт E₀·(e^{−iπm₁} − e^{−iπm₂}); бесконечно далёкие зоны гасит наклон */
  амплитуда(p,mm){
    const m=mm==null?this.m(p):mm, полосы=[];
    if(p.mode==='hole') полосы.push([0,m]);
    else if(p.mode==='disk') полосы.push([m,Infinity]);
    else for(let k=0;k<m;k+=2) полосы.push([k,Math.min(k+1,m)]);
    let re=0,im=0;
    for(const [a,b] of полосы){ re+=Math.cos(Math.PI*a); im-=Math.sin(Math.PI*a); if(isFinite(b)){ re-=Math.cos(Math.PI*b); im+=Math.sin(Math.PI*b); } }
    return [re,im];
  },
  I(p,mm){ const [a,b]=this.амплитуда(p,mm); return a*a+b*b; },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    const I=this.I(p);
    return [['число открытых зон m = r²/λb',this.m(p),''],['радиус первой зоны r₁ = √(λb)',this.r1(p),'мм'],
      ['интенсивность на оси I/I₀',I,''],['центр картины',I>1.2?'светлое пятно':I<0.4?'тёмное пятно':'полутень','']];
  },
  graphs:[],
  presets:[
    {name:'Одна зона: вчетверо ярче, чем без преграды',values:{mode:'hole',lam:550,r:0.742,b:1}},
    {name:'Две зоны: в центре темно',values:{mode:'hole',lam:550,r:1.049,b:1}},
    {name:'Пятно Пуассона за диском',values:{mode:'disk',lam:550,r:1,b:1}},
    {name:'Зонная пластинка: линза без стекла',values:{mode:'plate',lam:550,r:1.66,b:1}}
  ],
  /* на узком экране (телефон) три части стоят друг под другом, а не в ряд */
  узко(W,H){ return (W||460)<1.05*(H||320); },
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    if(this.узко(W,H)) return {x:0,y:-1.4,scale:clamp(Math.min((W-20)/(7.2*PX_PER_M),(H-20)/(15*PX_PER_M)),1e-3,30)};
    return {x:0,y:0,scale:clamp(Math.min((W-30)/(13*PX_PER_M),(H-30)/(8.6*PX_PER_M)),1e-3,30)}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink=v.c('--ink'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const m=this.m(p), цв=ВОЛНЫ7.цветВолны(p.lam), уз=typeof CW!=='undefined'&&this.узко(CW,CH);
    // слева: преграда анфас, зоны — кольца
    const cx=уз?0:-3.6, cy=уз?3.6:0.6, R=уз?2.2:2.6, rвид=R*clamp(Math.sqrt(m)/Math.sqrt(Math.max(m,6)+0.5),0.25,1), nz=Math.ceil(Math.max(m,6)+0.5);
    const rz=k=>rвид*Math.sqrt(k/Math.max(m,1e-9));
    for(let k=nz;k>=1;k--){ const r=Math.min(rz(k),R);
      const открыта = p.mode==='hole'? k-1<m : p.mode==='disk'? k-1>=m : (k-1<m&&(k-1)%2===0);
      ctx.fillStyle=открыта?цв:ink3; ctx.globalAlpha=открыта?(k%2?0.85:0.55):0.18;
      ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.8); ctx.beginPath(); ctx.arc(cx,cy,rвид,0,7); ctx.stroke();
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.stroke();
    v.text(ctx,p.mode==='disk'?'край диска':'край отверстия',cx,cy-rвид-0.3,dang,10,'center');
    v.text(ctx,`зоны Френеля: rₖ = √(kλb), открыто m = ${числоНаСцене(m,3)}`,cx,cy-R-0.45,ink2,10.5,'center');
    // справа вверху: векторная диаграмма. Вклад слоя зон dμ — вектор длины πρ·dμ,
    // повёрнутый на угол πμ: за одну зону он поворачивается на 180°, и конец
    // суммы бежит по окружности диаметром 2ρ (ρ соответствует E₀).
    const ox=уз?0:3.4, oy=уз?-1.9:0.7, ρ=p.mode==='plate'?1.05/Math.max(1,Math.ceil(m/2)):1.05;
    ctx.strokeStyle=ink3; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.arc(ox,oy+ρ,ρ,0,7); ctx.stroke(); ctx.globalAlpha=1;
    const откр=μ=>p.mode==='hole'?μ<m:p.mode==='disk'?μ>=m:(μ<m&&Math.floor(μ)%2===0);
    ctx.strokeStyle=цв; ctx.lineWidth=v.lw(2.6);
    if(p.mode==='disk'){
      // от края диска до бесконечности: из-за наклона зон спираль сходится к центру окружности
      const x0=ox+ρ*Math.sin(Math.PI*m), y0=oy+ρ*(1-Math.cos(Math.PI*m));
      ctx.beginPath(); for(let i=0;i<=400;i++){ const μ=m+i/40, q=Math.exp(-(μ-m)/3);
        const x=ox+q*ρ*Math.sin(Math.PI*μ), y=oy+ρ-q*ρ*Math.cos(Math.PI*μ); i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
      v.arrow(ctx,x0,y0,ox,oy+ρ,dang);
    } else {
      let x=ox, y=oy, шагов=Math.max(60,Math.ceil(m*80)); ctx.beginPath(); ctx.moveTo(x,y);
      for(let i=0;i<шагов;i++){ const μ=m*(i+0.5)/шагов; if(!откр(μ)) continue; const d=Math.PI*ρ*m/шагов;
        x+=d*Math.cos(Math.PI*μ); y+=d*Math.sin(Math.PI*μ); ctx.lineTo(x,y); }
      ctx.stroke();
      if(Math.hypot(x-ox,y-oy)>1e-3) v.arrow(ctx,ox,oy,x,y,dang);
    }
    v.text(ctx,'векторная диаграмма: вклады зон и их сумма',ox,oy-0.45,ink2,10,'center');
    v.text(ctx,'один круг = две зоны',ox,oy+2*ρ+0.35,ink3,9.5,'center');
    // справа внизу: I/I₀ на оси в зависимости от b
    const gx=уз?-2.6:1.2, gy=уз?-7.4:-3.6, gw=уз?5.2:4.6, gh=уз?2.2:2.4, bmax=5, Imax=p.mode==='plate'?Math.max(4,this.I(p)*1.15,4*Math.pow(Math.ceil(m/2),2)):4.4;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.6); ctx.beginPath();
    for(let i=0;i<=400;i++){ const b=0.05+(bmax-0.05)*i/400, mm=(p.r*1e-3)**2/(p.lam*1e-9*b), I=this.I(p,mm);
      const x=gx+gw*(b/bmax), y=gy+gh*clamp(I/Imax,0,1); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
    const xb=gx+gw*(p.b/bmax), yb=gy+gh*clamp(this.I(p)/Imax,0,1);
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(xb,yb,v.lw(4),0,7); ctx.fill();
    ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(gx,gy+gh/Imax); ctx.lineTo(gx+gw,gy+gh/Imax); ctx.stroke(); ctx.setLineDash([]);
    v.text(ctx,'I/I₀ на оси при разных b',gx+gw/2,gy+gh+0.35,ink2,10.5,'center');
    v.text(ctx,'без преграды',gx+gw+0.1,gy+gh/Imax,ink3,9.5,'left');
    v.text(ctx,`b, до ${bmax} м`,gx+gw,gy-0.3,ink3,9.5,'right');
    v.label(ctx,`I/I₀ = ${числоНаСцене(this.I(p),3)}`,xb,yb,8,-10,dang);
  }
},

/* ------------------------------------------------------------------ */
polar:{
  title:'Поляризация: закон Малюса и угол Брюстера',
  timeless:true, schema:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'malus',
     options:[{v:'malus',t:'поляроиды: закон Малюса'},{v:'brewster',t:'отражение от стекла: угол Брюстера'}]},
    {key:'nat',label:'Падает естественный (неполяризованный) свет',type:'check',default:true,если:p=>p.mode==='malus'},
    {key:'a1',label:'Ось поляризатора',unit:'°',min:0,max:180,step:1,default:0,если:p=>p.mode==='malus'},
    {key:'mid',label:'Третий поляроид посередине',type:'check',default:false,если:p=>p.mode==='malus'},
    {key:'a3',label:'Ось среднего поляроида',unit:'°',min:0,max:180,step:1,default:45,если:p=>p.mode==='malus'&&p.mid},
    {key:'a2',label:'Ось анализатора',unit:'°',min:0,max:180,step:1,default:60,если:p=>p.mode==='malus'},
    {key:'n',label:'Показатель преломления стекла n',min:1.2,max:2.5,step:0.01,default:1.5,если:p=>p.mode==='brewster'},
    {key:'th',label:'Угол падения θ',unit:'°',min:0,max:89,step:0.5,default:45,если:p=>p.mode==='brewster'}
  ],
  цепь(p){ // интенсивности после каждого поляроида, I₀ = 1
    const оси=[p.a1].concat(p.mid?[p.a3]:[]).concat([p.a2]);
    let I=1, out=[], прежн=p.nat?null:0;
    for(const a of оси){ I=прежн===null?I/2:I*Math.pow(Math.cos((a-прежн)*Math.PI/180),2); out.push({a,I}); прежн=a; }
    return out;
  },
  френель(p,thd){ const th=(thd==null?p.th:thd)*Math.PI/180, n=p.n, s=Math.sin(th)/n, ct=Math.sqrt(Math.max(0,1-s*s)), c=Math.cos(th);
    const rs=(c-n*ct)/(c+n*ct), rp=(n*c-ct)/(n*c+ct); return {Rs:rs*rs,Rp:rp*rp,θt:Math.asin(s)*180/Math.PI}; },
  θБ(p){ return Math.atan(p.n)*180/Math.PI; },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    if(p.mode==='brewster'){ const ф=this.френель(p);
      return [['угол Брюстера θ_Б = arctg n',this.θБ(p),'°'],['отражается s-волны (поперёк плоскости) R_s',100*ф.Rs,'%'],
        ['отражается p-волны (в плоскости) R_p',100*ф.Rp,'%'],['степень поляризации отражённого',(ф.Rs+ф.Rp)>0?100*(ф.Rs-ф.Rp)/(ф.Rs+ф.Rp):0,'%'],
        ['угол преломления',ф.θt,'°'],['угол между отражённым и преломлённым',180-p.th-ф.θt,'°']]; }
    const ц=this.цепь(p), out=[];
    ц.forEach((q,i)=>out.push([i===0?'после поляризатора I₁/I₀':i===ц.length-1?'после анализатора I/I₀':'после среднего поляроида',q.I,'']));
    out.push(['угол между поляризатором и анализатором',Math.abs(p.a2-p.a1)%180,'°']);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Малюс: 60° — четверть от поляризованного',values:{mode:'malus',nat:true,a1:0,a2:60,mid:false}},
    {name:'Скрещенные поляроиды — темнота',values:{mode:'malus',nat:true,a1:0,a2:90,mid:false}},
    {name:'Третий поляроид посередине возвращает свет',values:{mode:'malus',nat:true,a1:0,a2:90,mid:true,a3:45}},
    {name:'Брюстер для стекла: 56,3°',values:{mode:'brewster',n:1.5,th:56.3}},
    {name:'Вода: блики на воде',values:{mode:'brewster',n:1.33,th:53.1}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320; return {x:0,y:0.2,scale:clamp(Math.min((W-30)/(13*PX_PER_M),(H-30)/(8*PX_PER_M)),1e-3,30)}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    if(p.mode==='brewster') return this.рисоватьБрюстер(ctx,v,p);
    const ц=this.цепь(p), N=ц.length, X0=-5, X1=5.6, шаг=(X1-X0)/(N+1);
    // луч
    ctx.strokeStyle=sec; ctx.globalAlpha=.25; ctx.lineWidth=v.lw(14); ctx.beginPath(); ctx.moveTo(X0-0.4,0); ctx.lineTo(X1+0.4,0); ctx.stroke(); ctx.globalAlpha=1;
    const вектор=(x,угол,амп,нат)=>{ const L=1.3*Math.sqrt(амп);
      if(нат){ for(let k=0;k<6;k++){ const a=k*Math.PI/6; ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.4);
          ctx.beginPath(); ctx.moveTo(x-0.28*L*Math.cos(a),-L*Math.sin(a)*0.9-0); ctx.lineTo(x+0.28*L*Math.cos(a),L*Math.sin(a)*0.9); ctx.stroke(); } return; }
      const a=угол*Math.PI/180, dx=0.3*L*Math.sin(a), dy=L*Math.cos(a);
      if(L<0.02){ v.text(ctx,'темно',x,0.35,ink3,10,'center'); return; }
      v.arrow(ctx,x,0,x+dx,dy,acc); v.arrow(ctx,x,0,x-dx,-dy,acc); };
    // источник
    v.text(ctx,p.nat?'естественный свет':'поляризованный (0°)',X0-0.4,-1.9,ink2,10.5,'left');
    вектор(X0,0,1,p.nat);
    ц.forEach((q,i)=>{ const x=X0+шаг*(i+1)-шаг*0.15;
      // поляроид — диск в перспективе с осью пропускания
      ctx.fillStyle=ink3; ctx.globalAlpha=.18; ctx.beginPath(); ctx.ellipse(x,0,0.32,1.75,0,0,7); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.ellipse(x,0,0.32,1.75,0,0,7); ctx.stroke();
      const a=q.a*Math.PI/180; ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.2);
      ctx.beginPath(); ctx.moveTo(x-0.3*Math.sin(a),-1.6*Math.cos(a)); ctx.lineTo(x+0.3*Math.sin(a),1.6*Math.cos(a)); ctx.stroke();
      v.text(ctx,`${q.a}°`,x,-2.15,dang,10.5,'center');
      v.text(ctx,i===0?'поляризатор':i===N-1?'анализатор':'средний',x,2.2,ink3,10,'center');
      вектор(x+шаг*0.55,q.a,q.I,false);
      v.text(ctx,`I = ${числоНаСцене(q.I,3)} I₀`,x+шаг*0.55,-2.6,meas,10.5,'center');
    });
    v.text(ctx,'стрелка — колебания вектора E; квадрат её длины — интенсивность',0,-3.3,ink3,10,'center');
  },
  рисоватьБрюстер(ctx,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const ф=this.френель(p), θ=p.th*Math.PI/180, θt=ф.θt*Math.PI/180, L=3.2, ox=-2.2, oy=0.3;
    // стекло
    ctx.fillStyle=sec; ctx.globalAlpha=.12; ctx.fillRect(ox-3.6,oy-3,7.2,3); ctx.globalAlpha=1;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(ox-3.6,oy); ctx.lineTo(ox+3.6,oy); ctx.stroke();
    ctx.setLineDash([v.lw(4),v.lw(4)]); ctx.strokeStyle=ink3; ctx.beginPath(); ctx.moveTo(ox,oy+3); ctx.lineTo(ox,oy-3); ctx.stroke(); ctx.setLineDash([]);
    v.text(ctx,`стекло, n = ${p.n}`,ox+2.4,oy-2.6,ink3,10,'center');
    const луч=(x1,y1,x2,y2,w,цв,стрелка)=>{ ctx.strokeStyle=цв; ctx.lineWidth=v.lw(w); ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      if(стрелка) v.arrow(ctx,(x1+x2)/2-(x2-x1)*0.05,(y1+y2)/2-(y2-y1)*0.05,(x1+x2)/2+(x2-x1)*0.05,(y1+y2)/2+(y2-y1)*0.05,цв); };
    const ix=ox-L*Math.sin(θ), iy=oy+L*Math.cos(θ), rx=ox+L*Math.sin(θ), ry=iy, tx=ox+L*Math.sin(θt), ty=oy-L*Math.cos(θt);
    луч(ix,iy,ox,oy,3,acc,true);
    луч(ox,oy,rx,ry,Math.max(0.6,12*(ф.Rs+ф.Rp)/2),dang,true);
    луч(ox,oy,tx,ty,Math.max(0.8,3*(1-(ф.Rs+ф.Rp)/2)),acc,true);
    // поляризация: точки — s, чёрточки — p
    const метки=(x,y,ns,np,ang)=>{ for(let k=0;k<ns;k++){ ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(x+(k-1)*0.3*Math.cos(ang),y+(k-1)*0.3*Math.sin(ang),v.lw(3),0,7); ctx.fill(); }
      for(let k=0;k<np;k++){ const cx=x+(k-0.5)*0.42*Math.cos(ang)+0.2*Math.sin(ang), cy=y+(k-0.5)*0.42*Math.sin(ang)-0.2*Math.cos(ang);
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(cx-0.18*Math.sin(ang),cy+0.18*Math.cos(ang)); ctx.lineTo(cx+0.18*Math.sin(ang),cy-0.18*Math.cos(ang)); ctx.stroke(); } };
    метки((ix+ox)/2,(iy+oy)/2,3,2,-Math.PI/2+θ);
    const доляP=ф.Rs+ф.Rp>0?ф.Rp/(ф.Rs+ф.Rp):0;
    метки((rx+ox)/2,(ry+oy)/2,3,Math.round(2*доляP*2)>0?Math.min(2,Math.round(4*доляP)):0,Math.PI/2-θ);
    v.text(ctx,`θ = ${p.th}°`,ox-0.6,oy+1.1,ink2,10.5,'center');
    v.label(ctx,`отражено ${числоНаСцене(100*(ф.Rs+ф.Rp)/2,3)} %`,rx,ry,6,-6,dang);
    if(Math.abs(p.th-this.θБ(p))<0.6) v.text(ctx,'θ = θ_Б: отражённый свет поляризован полностью, отражённый ⊥ преломлённому',ox,oy+3.6,dang,10.5,'center');
    // справа: R_s(θ) и R_p(θ)
    const gx=2.4, gy=-2.4, gw=3.4, gh=4.4;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    for(const [k,цв,имя] of [['Rs',meas,'R_s'],['Rp',acc,'R_p']]){ ctx.strokeStyle=цв; ctx.lineWidth=v.lw(1.7); ctx.beginPath();
      for(let i=0;i<=180;i++){ const t=89.5*i/180, R=this.френель(p,t)[k], x=gx+gw*t/90, y=gy+gh*R; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
      v.text(ctx,имя,gx+gw+0.05,gy+gh*this.френель(p,85)[k],цв,10,'left'); }
    const xb=gx+gw*this.θБ(p)/90; ctx.strokeStyle=dang; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(xb,gy); ctx.lineTo(xb,gy+gh*0.5); ctx.stroke(); ctx.setLineDash([]);
    v.text(ctx,`θ_Б = ${числоНаСцене(this.θБ(p),3)}°`,xb,gy-0.3,dang,10,'center');
    const xt=gx+gw*p.th/90; ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(xt,gy,v.lw(4),0,7); ctx.fill();
    v.text(ctx,'доля отражённого света от угла падения',gx+gw/2,gy+gh+0.35,ink2,10,'center');
  }
},

/* ------------------------------------------------------------------ */
mirror:{
  title:'Сферическое зеркало: построение изображения',
  timeless:true, gridUnit:'см',
  params:[
    {key:'kind',label:'Зеркало',type:'select',default:'concave',
     options:[{v:'concave',t:'вогнутое (собирающее)'},{v:'convex',t:'выпуклое (рассеивающее)'}]},
    {key:'F',label:'Фокусное расстояние |F|',unit:'см',min:5,max:40,step:0.5,default:15},
    {key:'d',label:'Расстояние до предмета d',unit:'см',min:2,max:90,step:0.5,default:40},
    {key:'h',label:'Высота предмета h',unit:'см',min:1,max:12,step:0.5,default:5},
    {type:'group',label:'Показывать'},
    {key:'rays',label:'Три характерных луча',type:'check',default:true}
  ],
  Fs(p){ return p.kind==='convex'?-p.F:p.F; },
  f(p){ const F=this.Fs(p); const q=1/F-1/p.d; return Math.abs(q)<1e-9?Infinity:1/q; },
  Γ(p){ const f=this.f(p); return isFinite(f)?-f/p.d:Infinity; },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    const f=this.f(p), Γ=this.Γ(p);
    const вид=!isFinite(f)?'изображения нет: лучи идут параллельно':`${f>0?'действительное':'мнимое'}, ${Γ<0?'перевёрнутое':'прямое'}, ${Math.abs(Γ)>1?'увеличенное':'уменьшенное'}`;
    return [['фокусное расстояние F',this.Fs(p),'см'],['радиус кривизны R = 2F',2*this.Fs(p),'см'],['расстояние до изображения f',f,'см'],
      ['увеличение Γ = −f/d',Γ,''],['высота изображения H',isFinite(Γ)?Math.abs(Γ)*p.h:Infinity,'см'],['изображение',вид,'']];
  },
  graphs:[],
  presets:[
    {name:'За центром кривизны: уменьшенное перевёрнутое',values:{kind:'concave',F:15,d:40,h:5}},
    {name:'Между F и C: увеличенное (проектор)',values:{kind:'concave',F:15,d:22,h:4}},
    {name:'Ближе фокуса: мнимое увеличенное (зеркало для бритья)',values:{kind:'concave',F:15,d:9,h:4}},
    {name:'Выпуклое: всегда мнимое уменьшенное (зеркало заднего вида)',values:{kind:'convex',F:15,d:30,h:6}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, f=this.f(p);
    const лев=Math.max(p.d,isFinite(f)&&f>0?f:0,2*p.F)+8, прав=Math.max(12,isFinite(f)&&f<0?-f+8:12);
    const выс=Math.max(p.h,isFinite(this.Γ(p))?Math.min(40,Math.abs(this.Γ(p))*p.h):p.h)*2+14;
    const scale=clamp(Math.min((W-30)/((лев+прав)*PX_PER_M),(H-30)/(выс*PX_PER_M)),1e-3,30);
    return {x:(прав-лев)/2,y:0,scale}; },
  anchors(s,p){ return [{x:0,y:0},{x:-p.d,y:p.h},{x:-this.Fs(p),y:0}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink=v.c('--ink'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const F=this.Fs(p), R=2*F, f=this.f(p), Γ=this.Γ(p), d=p.d, h=p.h;
    const Hm=Math.max(10,h*1.6,isFinite(Γ)?Math.min(40,Math.abs(Γ)*h)*1.15:0), лев=-(Math.max(d,isFinite(f)&&f>0?f:0,Math.abs(R))+6), прав=Math.max(12,isFinite(f)&&f<0?-f+6:12);
    // главная оптическая ось
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(лев,0); ctx.lineTo(прав,0); ctx.stroke();
    // зеркало: дуга окружности радиуса |R| (вогнутое — центр слева)
    const Ra=Math.abs(R), cxm=R>0?-Ra:Ra, a=Math.asin(Math.min(0.95,Hm/Ra));
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3); ctx.beginPath();
    if(R>0) ctx.arc(cxm,0,Ra,-a,a); else ctx.arc(cxm,0,Ra,Math.PI-a,Math.PI+a);
    ctx.stroke();
    // штриховка с тыльной стороны
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
    for(let y=-Hm*0.9;y<=Hm*0.9;y+=Hm/7){ const xs=cxm+(R>0?1:-1)*Math.sqrt(Ra*Ra-y*y); ctx.beginPath(); ctx.moveTo(xs,y); ctx.lineTo(xs+1.2,y-1.2); ctx.stroke(); }
    // фокус и центр кривизны
    for(const [x,t] of [[-F,'F'],[-R,'C']]){ ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(x,0,v.lw(3.5),0,7); ctx.fill(); v.text(ctx,t,x,-1.6,meas,11,'center'); }
    // предмет
    v.arrow(ctx,-d,0,-d,h,acc); v.text(ctx,'предмет',-d,h+1.4,acc,10,'center');
    if(!isFinite(f)){ v.text(ctx,'предмет в фокусе: лучи после отражения параллельны — изображения нет',(лев+прав)/2,-Hm-2,dang,10.5,'center'); }
    const xi=-f, yi=Γ*h;                                                // изображение: x = −f
    // лучи (параксиальное приближение: отражение на плоскости x = 0)
    if(p.rays){
      const луч=(y0,k,цв)=>{ // из вершины предмета (−d, h) в точку зеркала (0, y0), затем отражённый с наклоном k
        ctx.strokeStyle=цв; ctx.lineWidth=v.lw(1.5); ctx.beginPath(); ctx.moveTo(-d,h); ctx.lineTo(0,y0); ctx.stroke();
        const xe=лев; ctx.beginPath(); ctx.moveTo(0,y0); ctx.lineTo(xe,y0+k*xe); ctx.stroke();
        if(isFinite(f)&&f<0){ ctx.setLineDash([v.lw(4),v.lw(4)]); ctx.globalAlpha=.6; ctx.beginPath(); ctx.moveTo(0,y0); ctx.lineTo(прав,y0+k*прав); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; } };
      // 1) параллельно оси → через фокус (или от мнимого фокуса)
      луч(h, h/F, sec);
      // 2) через фокус (или в направлении мнимого фокуса) → параллельно оси
      if(Math.abs(d-F)>1e-6){ const y0=h*F/(F-d); луч(y0,0,dang); }
      // 3) в вершину зеркала → симметрично оси
      луч(0,h/d,meas);
    }
    if(isFinite(f)&&Math.abs(yi)<200){
      if(f>0){ v.arrow(ctx,xi,0,xi,yi,dang); v.text(ctx,'действительное',xi,yi+(yi>0?1.4:-1.4),dang,10,'center'); }
      else { ctx.setLineDash([v.lw(4),v.lw(3)]); v.arrow(ctx,xi,0,xi,yi,dang); ctx.setLineDash([]); v.text(ctx,'мнимое',xi,yi+(yi>0?1.4:-1.4),dang,10,'center'); }
    }
    v.text(ctx,`1/d + 1/f = 1/F:  d = ${d} см, f = ${isFinite(f)?числоНаСцене(f,3):'∞'} см, Γ = ${isFinite(Γ)?числоНаСцене(Γ,3):'∞'}`,(лев+прав)/2,-Hm-4,ink2,10.5,'center');
  }
},

/* ------------------------------------------------------------------ */
blackbody:{
  title:'Тепловое излучение: спектр Планка',
  timeless:true, schema:true,
  params:[
    {key:'T',label:'Температура тела T',unit:'К',min:300,max:15000,step:10,default:5800},
    {key:'eps',label:'Степень черноты ε',min:0.05,max:1,step:0.01,default:1},
    {key:'S',label:'Площадь поверхности S',unit:'см²',min:0.01,max:10000,step:0.01,default:100},
    {key:'cmp',label:'Сравнить со вторым телом',type:'check',default:false},
    {key:'T2',label:'Температура второго тела',unit:'К',min:300,max:15000,step:10,default:3000,если:p=>p.cmp},
    {type:'group',label:'Показывать'},
    {key:'rj',label:'Закон Рэлея — Джинса (классика)',type:'check',default:false}
  ],
  h:6.62607015e-34, c:299792458, k:1.380649e-23, σ:5.670374419e-8, b:2.897771955e-3,
  /* спектральная плотность энергетической светимости M_λ, Вт/(м²·м) */
  Mλ(T,l){ const L=l*1e-9; return 2*Math.PI*this.h*this.c*this.c/Math.pow(L,5)/(Math.exp(this.h*this.c/(L*this.k*T))-1); },
  Rj(T,l){ const L=l*1e-9; return 2*Math.PI*this.c*this.k*T/Math.pow(L,4); },
  λmax(T){ return this.b/T*1e9; },
  M(p,T){ return p.eps*this.σ*Math.pow(T==null?p.T:T,4); },
  видимая(T){ let a=0,всё=0; const шаг=Math.max(1,this.λmax(T)/200);
    for(let l=шаг/2;l<this.λmax(T)*40;l+=шаг){ const m=this.Mλ(T,l); всё+=m; if(l>=380&&l<=780) a+=m; }
    return всё>0?a/всё:0; },
  цвет(T){ return ВОЛНЫ7.цветСпектра(l=>this.Mλ(T,l)); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    const out=[['максимум спектра λ_max = b/T',this.λmax(p.T),'нм'],['энергетическая светимость M = εσT⁴',this.M(p),'Вт/м²'],
      ['мощность излучения P = MS',this.M(p)*p.S*1e-4,'Вт'],['доля видимого света (380–780 нм)',100*this.видимая(p.T),'%']];
    if(p.cmp) out.push(['M₁/M₂ = (T₁/T₂)⁴',Math.pow(p.T/p.T2,4),''],['λ_max второго',this.λmax(p.T2),'нм']);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Солнце: 5800 К',values:{T:5800,eps:1,cmp:false}},
    {name:'Лампа накаливания: 2800 К — почти всё в инфракрасном',values:{T:2800,eps:0.35,S:0.5,cmp:false}},
    {name:'Человек: 310 К',values:{T:310,eps:0.98,S:18000,cmp:false}},
    {name:'Вдвое горячее — в 16 раз ярче',values:{T:6000,eps:1,cmp:true,T2:3000}},
    {name:'Ультрафиолетовая катастрофа',values:{T:5800,eps:1,cmp:false,rj:true}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320; return {x:0.6,y:0,scale:clamp(Math.min((W-30)/(13*PX_PER_M),(H-30)/(8*PX_PER_M)),1e-3,30)}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink=v.c('--ink'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const gx=-4.6, gy=-3, gw=9, gh=5.8;
    const Tмакс=Math.max(p.T,p.cmp?p.T2:0), Tмин=Math.min(p.T,p.cmp?p.T2:p.T);
    const lмакс=clamp(this.λmax(Tмин)*4,1200,40000), Y=Math.max(this.Mλ(p.T,this.λmax(p.T))*p.eps,p.cmp?this.Mλ(p.T2,this.λmax(p.T2))*p.eps:0)*1.12;
    // видимая полоса
    for(let l=380;l<780;l+=4){ if(l>lмакс) break; ctx.fillStyle=ВОЛНЫ7.цветВолны(l); ctx.globalAlpha=.22; ctx.fillRect(gx+gw*l/lмакс,gy,gw*4/lмакс+0.01,gh); }
    ctx.globalAlpha=1;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    const кривая=(T,цв,w,eps)=>{ ctx.strokeStyle=цв; ctx.lineWidth=v.lw(w); ctx.beginPath();
      for(let i=1;i<=500;i++){ const l=lмакс*i/500, y=gy+gh*Math.min(1.05,eps*this.Mλ(T,l)/Y); i>1?ctx.lineTo(gx+gw*l/lмакс,y):ctx.moveTo(gx+gw*l/lмакс,y); } ctx.stroke(); };
    if(p.rj){ ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); let нач=false;
      for(let i=1;i<=500;i++){ const l=lмакс*i/500, m=p.eps*this.Rj(p.T,l)/Y; if(m>1.05) continue; const x=gx+gw*l/lмакс, y=gy+gh*m; нач?ctx.lineTo(x,y):ctx.moveTo(x,y); нач=true; }
      ctx.stroke(); ctx.setLineDash([]); v.text(ctx,'Рэлей — Джинс: ∝ T/λ⁴ — уходит в бесконечность',gx+gw*0.55,gy+gh*0.95,dang,10,'left'); }
    if(p.cmp) кривая(p.T2,ink2,1.6,p.eps);
    кривая(p.T,acc,2.4,p.eps);
    // максимум
    const xm=gx+gw*this.λmax(p.T)/lмакс;
    if(xm<gx+gw){ ctx.strokeStyle=meas; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(xm,gy); ctx.lineTo(xm,gy+gh*p.eps*this.Mλ(p.T,this.λmax(p.T))/Y); ctx.stroke(); ctx.setLineDash([]);
      v.text(ctx,`λ_max = ${числоНаСцене(this.λmax(p.T),3)} нм`,xm,gy-0.35,meas,10.5,'center'); }
    v.text(ctx,`λ, нм → до ${числоНаСцене(lмакс,3)}`,gx+gw,gy-0.35,ink3,10,'right');
    v.text(ctx,'видимый свет',gx+gw*580/lмакс,gy-0.75,ink3,9.5,'center');
    v.text(ctx,'спектральная светимость M_λ',gx,gy+gh+0.4,ink2,10.5,'left');
    // цвет тела
    const ц=this.цвет(p.T), яр=clamp(Math.log10(this.M(p)/1e5+1)/1.4,0.06,1);
    ctx.fillStyle=`rgb(${Math.round(ц[0]*яр)},${Math.round(ц[1]*яр)},${Math.round(ц[2]*яр)})`;
    ctx.beginPath(); ctx.arc(gx+gw+1.4,gy+gh-0.6,0.75,0,7); ctx.fill();
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.stroke();
    v.text(ctx,`${p.T} К`,gx+gw+1.4,gy+gh-1.65,ink2,10,'center');
    v.text(ctx,'так оно светится',gx+gw+1.4,gy+gh+0.4,ink3,9.5,'center');
  }
},

/* ------------------------------------------------------------------ */
photometry:{
  title:'Освещённость: лампа над столом и фотометр',
  timeless:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'lamp',
     options:[{v:'lamp',t:'лампа над столом: E = I·cos α / r²'},{v:'two',t:'фотометр: две лампы на скамье'}]},
    {key:'I',label:'Сила света лампы I₁',unit:'кд',min:10,max:2000,step:1,default:120},
    {key:'h',label:'Высота лампы над столом h',unit:'м',min:0.3,max:3,step:0.01,default:1.2,если:p=>p.mode==='lamp'},
    {key:'x',label:'Точка на столе: отступ от места под лампой x',unit:'м',min:0,max:3,step:0.01,default:0.9,если:p=>p.mode==='lamp'},
    {key:'I2',label:'Сила света второй лампы I₂',unit:'кд',min:10,max:2000,step:1,default:30,если:p=>p.mode==='two'},
    {key:'D',label:'Расстояние между лампами D',unit:'м',min:0.5,max:4,step:0.01,default:2,если:p=>p.mode==='two'},
    {key:'xs',label:'Экран фотометра: расстояние от первой лампы',unit:'м',min:0.05,max:3.95,step:0.01,default:1,если:p=>p.mode==='two'}
  ],
  E(p,x){ const xx=x==null?p.x:x; return p.I*p.h/Math.pow(p.h*p.h+xx*xx,1.5); },
  E0(p){ return p.I/(p.h*p.h); },
  баланс(p){ return p.D/(1+Math.sqrt(p.I2/p.I)); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    if(p.mode==='two'){ const xs=Math.min(p.xs,p.D-0.05), E1=p.I/(xs*xs), E2=p.I2/((p.D-xs)*(p.D-xs));
      return [['освещённость от первой E₁ = I₁/r₁²',E1,'лк'],['освещённость от второй E₂ = I₂/r₂²',E2,'лк'],
        ['отношение E₁/E₂',E1/E2,''],['поля сравняются при r₁',this.баланс(p),'м']]; }
    const r=Math.hypot(p.h,p.x);
    return [['расстояние до точки r',r,'м'],['угол падения α',Math.atan2(p.x,p.h)*180/Math.PI,'°'],['освещённость в точке E',this.E(p),'лк'],
      ['под самой лампой E₀ = I/h²',this.E0(p),'лк'],['световой поток лампы Φ = 4πI',4*Math.PI*p.I,'лм']];
  },
  graphs:[],
  presets:[
    {name:'Настольная лампа 120 кд',values:{mode:'lamp',I:120,h:1.2,x:0.9}},
    {name:'Лампа вдвое выше — под ней вчетверо темнее',values:{mode:'lamp',I:120,h:2.4,x:0}},
    {name:'Фотометр: 120 и 30 кд',values:{mode:'two',I:120,I2:30,D:2,xs:1}},
    {name:'Фотометр на равновесии',values:{mode:'two',I:120,I2:30,D:2,xs:1.333}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    if(p.mode==='two') return {x:p.D/2,y:0.3,scale:clamp(Math.min((W-40)/((p.D+1.2)*PX_PER_M),(H-40)/(2.6*PX_PER_M)),1e-3,30)};
    const wx=Math.max(3.4,p.x+1)*2, hy=p.h+1.6; return {x:0,y:p.h/2-0.1,scale:clamp(Math.min((W-40)/(wx*PX_PER_M),(H-40)/(hy*PX_PER_M)),1e-3,30)}; },
  anchors(s,p){ return p.mode==='two'?[{x:0,y:0},{x:p.D,y:0}]:[{x:0,y:p.h},{x:p.x,y:0}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink=v.c('--ink'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger'), warn=v.c('--measure');
    const лампа=(x,y,I)=>{ const r=0.08+0.05*Math.log10(I);
      const g=ctx.createRadialGradient(x,y,0,x,y,r*6); g.addColorStop(0,'rgba(255,200,60,.55)'); g.addColorStop(1,'rgba(255,200,60,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*6,0,7); ctx.fill();
      ctx.fillStyle='#f5b400'; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1); ctx.stroke(); };
    if(p.mode==='two'){
      const xs=Math.min(p.xs,p.D-0.05), E1=p.I/(xs*xs), E2=p.I2/((p.D-xs)*(p.D-xs)), b=this.баланс(p);
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(-0.3,-0.25); ctx.lineTo(p.D+0.3,-0.25); ctx.stroke();
      лампа(0,0,p.I); лампа(p.D,0,p.I2);
      v.text(ctx,`I₁ = ${p.I} кд`,0,0.55,ink2,10.5,'center'); v.text(ctx,`I₂ = ${p.I2} кд`,p.D,0.55,ink2,10.5,'center');
      // экран: левая половина освещена первой лампой, правая — второй
      const яр=E=>clamp(Math.log10(E+1)/3.2,0.05,1), c1=Math.round(255*яр(E1)), c2=Math.round(255*яр(E2));
      ctx.fillStyle=`rgb(${c1},${c1},${Math.round(c1*0.85)})`; ctx.fillRect(xs-0.07,-0.2,0.07,0.6);
      ctx.fillStyle=`rgb(${c2},${c2},${Math.round(c2*0.85)})`; ctx.fillRect(xs,-0.2,0.07,0.6);
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1); ctx.strokeRect(xs-0.07,-0.2,0.14,0.6);
      v.label(ctx,Math.abs(E1/E2-1)<0.02?'поля одинаковы — равновесие':E1>E2?'левая сторона ярче':'правая сторона ярче',xs,0.4,0,-14,Math.abs(E1/E2-1)<0.02?sec:dang);
      ctx.strokeStyle=meas; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(b,-0.5); ctx.lineTo(b,-0.3); ctx.stroke(); ctx.setLineDash([]);
      v.text(ctx,`равновесие: r₁ = ${числоНаСцене(b,3)} м`,b,-0.68,meas,10,'center');
      return;
    }
    const W=Math.max(3.4,p.x+1);
    // стол и световое пятно
    for(let i=0;i<120;i++){ const x0=-W+2*W*i/120, x1=x0+2*W/120, E=this.E(p,Math.abs((x0+x1)/2));
      const a=clamp(E/this.E0(p),0,1); ctx.fillStyle=`rgba(255,196,60,${(0.12+0.6*a).toFixed(3)})`; ctx.fillRect(x0,-0.12,x1-x0,0.12); }
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(-W,0); ctx.lineTo(W,0); ctx.stroke();
    // лампа и лучи
    лампа(0,p.h,p.I);
    ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(4),v.lw(4)]); ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(0,p.h); ctx.lineTo(0,0); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(0,p.h); ctx.lineTo(p.x,0); ctx.stroke();
    v.text(ctx,`h = ${p.h} м`,-0.12,p.h/2,ink2,10,'right');
    v.label(ctx,`r = ${числоНаСцене(Math.hypot(p.h,p.x),3)} м`,p.x/2,p.h/2,8,0,acc);
    // нормаль и угол α в точке
    ctx.strokeStyle=ink3; ctx.beginPath(); ctx.moveTo(p.x,0); ctx.lineTo(p.x,0.5); ctx.stroke();
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(p.x,0,v.lw(4),0,7); ctx.fill();
    v.label(ctx,`E = ${числоНаСцене(this.E(p),3)} лк`,p.x,0,6,18,dang);
    // график E(x) над столом
    const gy=p.h+0.35, gh=0.9;
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.5); ctx.beginPath();
    for(let i=0;i<=240;i++){ const x=-W+2*W*i/240, y=gy+gh*this.E(p,Math.abs(x))/this.E0(p); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke(); v.text(ctx,'E(x): спадает как cos³α — и от расстояния, и от наклона',W*0.98,gy+gh+0.2,sec,10,'right');
  }
}
});
