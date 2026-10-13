/* ===================== ЗВУК, ВОЛНОВАЯ ОПТИКА, ЗЕРКАЛА, ТЕПЛОВОЕ ИЗЛУЧЕНИЕ (7.0.0, рисунок 8.0.0) =====================
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
       фотометр с двумя лампами: равенство I₁/r₁² = I₂/r₂².

   РИСУНОК 8.0. Отзыв к 7.0: сцены неподвижные, загромождённые, «палочки»
   в оптике не к месту. Теперь каждая сцена — одна запоминающаяся модель,
   и она движется: слои воздуха сгущаются и бегут, в трубе качается стоячая
   волна, зоны Френеля складываются по одной у вас на глазах, свет — это
   верёвка, проходящая сквозь щель поляроида, по лучам зеркала бегут
   световые импульсы, нагретое тело сыплет фотонами своего спектра, лампа
   засыпает стол светом — где гуще, там светлее. Подписей — по одной на
   смысловую часть; остальное — в показаниях. */
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
  цветВолны(l){ const c=this.цветСпектра(x=>Math.abs(x-l)<3?1:0).map(u=>Math.round(u*0.62+140*0.38)); return `rgb(${c[0]},${c[1]},${c[2]})`; },
  /* генератор с зерном: рисунок одинаков от кадра к кадру и от запуска к запуску */
  гсч(зерно){ let s=(зерно>>>0)||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; },
  _точки:{},
  /* n точек, равномерно рассыпанных по прямоугольнику, — один раз на ключ */
  точки(ключ,n,x0,x1,y0,y1){ const к=ключ+n+x0+x1+y0+y1; if(this._точки[к]) return this._точки[к];
    const г=this.гсч(n*7919+ключ.length), out=[]; for(let i=0;i<n;i++) out.push([x0+(x1-x0)*г(),y0+(y1-y0)*г()]);
    return this._точки[к]=out; },
  /* светящаяся точка: ореол и ядро; r — в пикселях */
  искра(ctx,v,x,y,r,цв,а){ ctx.fillStyle=цв; ctx.globalAlpha=(а==null?1:а)*0.22; ctx.beginPath(); ctx.arc(x,y,v.lw(r*2.6),0,7); ctx.fill();
    ctx.globalAlpha=а==null?1:а; ctx.beginPath(); ctx.arc(x,y,v.lw(r),0,7); ctx.fill(); ctx.globalAlpha=1; },
  /* плавная случайная величина 0…1 от времени (для хаоса естественного света) */
  шум(t,зерно){ const i=Math.floor(t), f=t-i, h=n=>{ const x=Math.sin((n+зерно*17.13)*127.1)*43758.5453; return x-Math.floor(x); };
    const u=f*f*(3-2*f); return h(i)*(1-u)+h(i+1)*u; },
  плавно(x){ x=clamp(x,0,1); return x*x*(3-2*x); }
};

Object.assign(SIMS,{
/* ------------------------------------------------------------------
   ЗВУК. Модель: воздух — россыпь частиц. Динамик толкает их, и по
   россыпи бегут сгущения (подсвечены) и разрежения; три красные частицы
   только качаются на месте — бежит волна, а не воздух. Выше частота —
   теснее полосы; громче — сильнее сгущения; в воде полосы длиннее.
   Два близких тона — биения: громкие и тихие участки бегут друг за другом. */
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
    {key:'osc',label:'Осциллограмма в точке',type:'check',default:false}
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
  /* Показ замедлен и сжат, но порядок сохранён: длина полос растёт с λ = v/f
     (как корень, чтобы и 20 Гц, и 20 кГц помещались в кадр), частота мелькания — с f. */
  ВИД(p){ const м=this.м(p); return {λ:clamp(4*Math.sqrt(м.v/p.f/0.78),1.2,9), f:clamp(0.55*Math.pow(p.f/440,0.3),0.22,1.3)}; },
  биения(p){ const Δ=Math.abs(p.f-p.f2); return p.two&&Δ>0&&Δ<=12&&Math.abs(p.f2/p.f-1)<0.08; },
  ξ(p,x,t){ const В=this.ВИД(p), k=2*Math.PI/В.λ, ω=2*Math.PI*В.f, ф=ω*t-k*x;
    if(!p.two) return Math.sin(ф);
    if(this.биения(p)){ const Δв=clamp(Math.abs(p.f-p.f2)*0.12,0.12,0.8);    // огибающая бежит вместе с волной
      return Math.cos(Math.PI*Δв*(t-x/(В.λ*В.f)))*Math.sin(ф); }
    const r=p.f2/p.f; return 0.5*(Math.sin(ф)+Math.sin(r*ф)); },
  пояснения(p){ const м=this.м(p);
    if(p.two){ const Δ=Math.abs(p.f-p.f2), и=this.интервал(p);
      return [[this.биения(p)?`биения: громкость пульсирует ${числоНаСцене(Δ,3)} раз в секунду`:`два тона: ${и.имя}, f₂/f₁ = ${числоНаСцене(p.f2/p.f,3)}`,css('--ink-2'),true]]; }
    return [[`${м.имя}: λ = v/f = ${числоНаСцене(м.v/p.f,3)} м · ${p.f<20?'инфразвук':p.f>20000?'ультразвук':this.громкость(p.L)}`,css('--ink-2'),true]]; },
  H:1.35, X:10,
  низ(p){ return (p.pres?1.5:0)+(p.osc?1.9:0); },
  fit(p,vp){ const н=this.низ(p), верх=this.H+0.9, низ=-this.H-н-0.2;
    return fitСПояснением(vp,12.4,верх-низ,4.7,(верх+низ)/2,this.пояснения(p),32); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const строки=this.пояснения(p); v.занятьНиз(строки);
    const X=this.X, H=this.H, В=this.ВИД(p), a=0.07+0.2*clamp(p.L/140,0,1), k=2*Math.PI/В.λ, t=s.t, d=0.02;
    // сгущения светятся: подсветка ∝ сжатию −∂ξ/∂x
    const полос=110, w=X/полос;
    ctx.fillStyle=acc;
    for(let i=0;i<полос;i++){ const x=(i+0.5)*w, сж=-(this.ξ(p,x+d,t)-this.ξ(p,x-d,t))/(2*d)/k;
      if(сж>0.05){ ctx.globalAlpha=0.26*Math.min(1,сж)*(0.4+0.6*a/0.27); ctx.fillRect(x-w/2,-H,w+0.002,2*H); } }
    ctx.globalAlpha=1;
    // частицы воздуха
    ctx.fillStyle=ink2;
    for(const [x0,y0] of ВОЛНЫ7.точки('snd',620,0,X,-H,H)){ const x=x0+a*this.ξ(p,x0,t); if(x<0||x>X) continue;
      ctx.beginPath(); ctx.arc(x,y0,v.lw(1.5),0,7); ctx.fill(); }
    // три помеченные частицы: качаются на месте
    for(const x0 of [2.2,5,7.8]) ВОЛНЫ7.искра(ctx,v,x0+a*this.ξ(p,x0,t),0.05,3.2,dang);
    // динамик: катушка и диффузор, ходит вместе с первым слоем
    const sx=-0.25+a*this.ξ(p,0,t);
    ctx.fillStyle=ink2; ctx.fillRect(-1.25,-0.32,0.38,0.64);
    ctx.globalAlpha=.55; ctx.beginPath(); ctx.moveTo(-0.87,-0.42); ctx.lineTo(sx,-1.05); ctx.lineTo(sx,1.05); ctx.lineTo(-0.87,0.42); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2.4); ctx.beginPath(); ctx.moveTo(sx,-1.05); ctx.lineTo(sx,1.05); ctx.stroke();
    // приёмник — перепонка: её качает приходящая волна
    const mx=X+0.4+a*this.ξ(p,X,t);
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(3); ctx.beginPath(); ctx.moveTo(mx,-0.75); ctx.quadraticCurveTo(mx+0.18,0,mx,0.75); ctx.stroke();
    // длина волны
    if(!p.two){ const ya=H+0.42, x1=1, x2=1+В.λ; ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.moveTo(x1,ya); ctx.lineTo(x2,ya); ctx.moveTo(x1,ya-0.1); ctx.lineTo(x1,ya+0.1); ctx.moveTo(x2,ya-0.1); ctx.lineTo(x2,ya+0.1); ctx.stroke();
      v.text(ctx,'λ',(x1+x2)/2,ya+0.25,meas,12,'center'); }
    // давление вдоль луча
    let yy=-H-0.25;
    if(p.pres){ const yb=yy-0.7, h=0.5;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(0,yb); ctx.lineTo(X,yb); ctx.stroke(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=300;i++){ const x=i*X/300, сж=-(this.ξ(p,x+d,t)-this.ξ(p,x-d,t))/(2*d)/k; const y=yb+h*clamp(сж,-1.3,1.3); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke(); v.text(ctx,'p',-0.3,yb,acc,11,'center'); yy=yb-h; }
    // осциллограмма давления у перепонки — в реальном времени
    if(p.osc){ const yo=yy-0.95, h=0.6, Tw=this.биения(p)?Math.min(0.6,2.2/Math.max(1e-9,Math.abs(p.f-p.f2))):p.two?6/Math.min(p.f,p.f2):5/p.f;
      ctx.strokeStyle=v.c('--second'); ctx.lineWidth=v.lw(1.3); ctx.beginPath();
      for(let i=0;i<=900;i++){ const τ=i/900*Tw, u=p.two?0.5*(Math.cos(2*Math.PI*p.f*τ)+Math.cos(2*Math.PI*p.f2*τ)):Math.cos(2*Math.PI*p.f*τ);
        const x=i/900*X; i?ctx.lineTo(x,yo+h*u):ctx.moveTo(x,yo+h*u); }
      ctx.stroke(); v.text(ctx,`${числоНаСцене(Tw*1000,3)} мс`,X,yo-h-0.22,ink3,9.5,'right'); }
    v.пояснение(ctx,строки);
  }
},

/* ------------------------------------------------------------------
   ТРУБА. Модель: стоячая волна — «скакалка» внутри трубы: в узлах воздух
   стоит, в пучностях ходит сильнее всего. У открытого конца всегда
   пучность (воздух свободен), у закрытого — узел (стенка не пускает).
   Из открытых концов расходится звук. Подсветка — сгущения воздуха:
   они там, где частицы не ходят, — в узлах смещения. */
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
    {key:'disp',label:'Стоячая волна смещения',type:'check',default:true},
    {key:'pres',label:'Сгущения воздуха',type:'check',default:true}
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
    return [[p.kind==='closed'?`закрытая: fₙ = (2n − 1)·v/4L = ${числоНаСцене(this.f(p),4)} Гц — только нечётные гармоники`:`открытая: fₙ = n·v/2L = ${числоНаСцене(this.f(p),4)} Гц`,css('--ink-2'),true]]; },
  fit(p,vp){ return fitСПояснением(vp,12.8,4.6,5,-0.15,this.пояснения(p),32); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure');
    const строки=this.пояснения(p); v.занятьНиз(строки);
    const X0=0, X1=10, W=X1-X0, h=1.05, q=this.q(p), ω=2*Math.PI*0.5*Math.sqrt(q), c=Math.cos(ω*s.t), закр=p.kind==='closed';
    // тело трубы
    ctx.fillStyle=ink3; ctx.globalAlpha=.07; ctx.fillRect(X0,-h,W,2*h); ctx.globalAlpha=1;
    // сгущения: −∂ξ/∂x, светятся там, где воздух сжат в этот миг
    if(p.pres){ const N=100, d=1e-3; ctx.fillStyle=acc;
      for(let i=0;i<N;i++){ const u=(i+0.5)/N, сж=-(this.смещ(p,u+d)-this.смещ(p,u-d))/(2*d)/(q*Math.PI/(закр?2:1))*c;
        if(сж>0.04){ ctx.globalAlpha=0.32*Math.min(1,сж); ctx.fillRect(X0+W*i/N,-h,W/N+0.002,2*h); } }
      ctx.globalAlpha=1; }
    // частицы воздуха
    ctx.fillStyle=ink2;
    for(const [x0,y0] of ВОЛНЫ7.точки('pipe',360,X0+0.05,X1-0.05,-h+0.12,h-0.12)){ const u=(x0-X0)/W;
      const x=clamp(x0+0.33*this.смещ(p,u)*c,X0+0.05,X1+0.3); ctx.beginPath(); ctx.arc(x,y0,v.lw(1.4),0,7); ctx.fill(); }
    // стоячая волна смещения: качается, узлы стоят
    if(p.disp){ const А=0.72*h;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(4)]);
      for(const sg of [1,-1]){ ctx.beginPath(); for(let i=0;i<=200;i++){ const u=i/200; const y=sg*А*this.смещ(p,u); i?ctx.lineTo(X0+u*W,y):ctx.moveTo(X0+u*W,y); } ctx.stroke(); }
      ctx.setLineDash([]); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.6); ctx.beginPath();
      for(let i=0;i<=240;i++){ const u=i/240, y=А*this.смещ(p,u)*c; i?ctx.lineTo(X0+u*W,y):ctx.moveTo(X0+u*W,y); }
      ctx.stroke();
      // узлы
      const У=закр?Array.from({length:q+1},(_,j)=>2*j/q).filter(u=>u<=1+1e-9):Array.from({length:q},(_,j)=>(j+0.5)/q);
      ctx.fillStyle=v.c('--canvas'); ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6);
      for(const u of У){ if(u<=1e-6) continue; ctx.beginPath(); ctx.arc(X0+u*W,0,v.lw(4),0,7); ctx.fill(); ctx.stroke(); }
      const пучн=закр?1/q:0, узел=У.find(u=>u>1e-6);
      if(узел!=null) v.text(ctx,'узел',X0+узел*W,-h-0.32,ink3,10,'center');
      v.text(ctx,'пучность',X0+Math.min(1,пучн)*W+(пучн===0?0.35:0),-h-0.32,ink3,10,пучн===0?'left':'center'); }
    // стенки и концы
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.moveTo(X0,h); ctx.lineTo(X1,h); ctx.moveTo(X0,-h); ctx.lineTo(X1,-h); ctx.stroke();
    if(закр){ ctx.lineWidth=v.lw(6); ctx.beginPath(); ctx.moveTo(X0,-h-0.02); ctx.lineTo(X0,h+0.02); ctx.stroke(); }
    // звук уходит из открытых концов
    const концы=закр?[[X1,1]]:[[X1,1],[X0,-1]];
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
    for(const [x,сторона] of концы) for(let k=0;k<3;k++){ const ф=((s.t*0.7*Math.sqrt(q))+k/3)%1, r=0.35+1.3*ф;
      ctx.globalAlpha=(1-ф)*0.6; ctx.beginPath(); сторона>0?ctx.arc(x,0,r,-0.9,0.9):ctx.arc(x,0,r,Math.PI-0.9,Math.PI+0.9); ctx.stroke(); }
    ctx.globalAlpha=1;
    v.text(ctx,`L = ${p.L} м · λ = ${числоНаСцене(this.λ(p),3)} м`,X0+W/2,h+0.38,ink3,10,'center');
    v.пояснение(ctx,строки);
  }
},

/* ------------------------------------------------------------------
   ЗОНЫ ФРЕНЕЛЯ. Модель: отверстие делится на кольца-зоны, соседние
   приходят в точку экрана в противофазе (два цвета). Зоны добавляются по
   одной, и одновременно растёт векторная сумма: каждая зона — пол-оборота
   спирали. Справа — пятно в центре экрана: его яркость — квадрат суммы.
   Одна зона — вчетверо ярче, чем без преграды; две — темнота. */
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
    if(this.узко(W,H)) return {x:0,y:0,scale:clamp(Math.min((W-20)/(6.2*PX_PER_M),(H-20)/(16*PX_PER_M)),1e-3,30)};
    return {x:0,y:0,scale:clamp(Math.min((W-30)/(14.6*PX_PER_M),(H-30)/(6.6*PX_PER_M)),1e-3,30)}; },
  /* сколько зон «уже сложено» в этот миг: цикл 7 с — набор, затем пауза на итоге */
  набор(s,p){ const m=this.m(p), τ=(s.t%7)/7, σ=ВОЛНЫ7.плавно(τ/0.72);
    return p.mode==='disk'?{от:m,до:m+5*σ,σ}:{от:0,до:m*σ,σ}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const m=this.m(p), цв=ВОЛНЫ7.цветВолны(p.lam), уз=typeof CW!=='undefined'&&this.узко(CW,CH), н=this.набор(s,p);
    const C1=уз?[0,5.2]:[-4.9,0.25], C2=уз?[0,-0.3]:[0,-0.95], C3=уз?[0,-5.6]:[4.9,0.25];
    // 1) отверстие анфас: кольца зон, соседние — разного цвета (противофаза)
    const R=2.3, всего=Math.ceil(p.mode==='disk'?m+5:Math.max(m,4)+0.5), rr=k=>R*Math.sqrt(Math.min(k,всего)/всего);
    const открыта=μ=>p.mode==='hole'?μ<m:p.mode==='disk'?μ>=m:(μ<m&&Math.floor(μ)%2===0);
    for(let k=всего;k>=1;k--){ const μ=k-0.5, отк=p.mode==='disk'?k>m:открыта(k-1)&&(k-1<m);
      const сложена=p.mode==='disk'?k-1<н.до:k-1<н.до;
      ctx.fillStyle=отк?((k-1)%2?meas:acc):ink3; ctx.globalAlpha=отк?(сложена?0.85:0.25):0.13;
      ctx.beginPath(); ctx.arc(C1[0],C1[1],rr(k),0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    if(p.mode==='hole'&&m<всего){ ctx.fillStyle=ink3; ctx.globalAlpha=.13; ctx.beginPath(); ctx.arc(C1[0],C1[1],R,0,2*Math.PI); ctx.moveTo(C1[0]+rr(m),C1[1]); ctx.arc(C1[0],C1[1],rr(m),0,2*Math.PI,true); ctx.fill(); ctx.globalAlpha=1; }
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.arc(C1[0],C1[1],rr(m),0,7); ctx.stroke();
    v.text(ctx,`открыто зон: ${числоНаСцене(m,3)}`,C1[0],C1[1]-R-0.42,ink2,10.5,'center');
    // 2) векторная сумма: каждый слой зон dμ — вектор, повёрнутый на πμ;
    // за зону он делает пол-оборота, и сумма бежит по окружности диаметром 2ρ
    const ρ=(p.mode==='plate'?1.15/Math.max(1,Math.ceil(m/2)):1.15), ox=C2[0], oy=C2[1];
    const точка=μ=>[ox+ρ*Math.sin(Math.PI*μ), oy+ρ*(1-Math.cos(Math.PI*μ))];
    ctx.strokeStyle=ink3; ctx.globalAlpha=.3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.arc(ox,oy+ρ,ρ,0,7); ctx.stroke(); ctx.globalAlpha=1;
    let нач, кон;
    if(p.mode==='disk'){
      const спираль=μ=>{ const q=Math.exp(-(μ-m)/1.6); return [ox+q*ρ*Math.sin(Math.PI*μ), oy+ρ-q*ρ*Math.cos(Math.PI*μ)]; };
      нач=точка(m); ctx.strokeStyle=цв; ctx.lineWidth=v.lw(2.4); ctx.beginPath();
      const шагов=Math.max(2,Math.ceil((н.до-m)*60)); for(let i=0;i<=шагов;i++){ const [x,y]=спираль(m+(н.до-m)*i/шагов); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke(); кон=спираль(н.до);
    } else {
      нач=[ox,oy]; let x=ox, y=oy; const шагов=Math.max(40,Math.ceil(н.до*90)); ctx.strokeStyle=цв; ctx.lineWidth=v.lw(2.4); ctx.beginPath(); ctx.moveTo(x,y);
      for(let i=0;i<шагов;i++){ const μ=н.до*(i+0.5)/шагов, d=Math.PI*ρ*н.до/шагов; if(открыта(μ)){ x+=d*Math.cos(Math.PI*μ); y+=d*Math.sin(Math.PI*μ); } ctx.lineTo(x,y); }
      ctx.stroke(); кон=[x,y];
    }
    if(Math.hypot(кон[0]-нач[0],кон[1]-нач[1])>1e-3){ v.arrow(ctx,нач[0],нач[1],кон[0],кон[1],dang); }
    v.text(ctx,'сумма вкладов зон',ox,oy-0.42,ink3,10,'center');
    // 3) центр экрана: яркость = квадрат суммы
    const Iтек=Math.pow(Math.hypot(кон[0]-нач[0],кон[1]-нач[1])/ρ,2), Iтог=this.I(p), норм=p.mode==='plate'?Math.max(4,Iтог):4;
    const [r0,g0,b0]=(цв.match(/\d+/g)||[200,200,200]).map(Number), яр=clamp(Iтек/норм,0,1);
    ctx.fillStyle=ink3; ctx.globalAlpha=.16; ctx.beginPath(); ctx.arc(C3[0],C3[1],1.9,0,7); ctx.fill(); ctx.globalAlpha=1;
    const гр=ctx.createRadialGradient(C3[0],C3[1],0,C3[0],C3[1],1.9);
    гр.addColorStop(0,`rgba(${r0},${g0},${b0},${(0.95*яр).toFixed(3)})`); гр.addColorStop(0.45,`rgba(${r0},${g0},${b0},${(0.5*яр).toFixed(3)})`); гр.addColorStop(1,`rgba(${r0},${g0},${b0},0)`);
    ctx.fillStyle=гр; ctx.beginPath(); ctx.arc(C3[0],C3[1],1.9,0,7); ctx.fill();
    v.text(ctx,н.σ>=1?`I = ${числоНаСцене(Iтог,3)} I₀`:`I ≈ ${числоНаСцене(Iтек,2)} I₀`,C3[0],C3[1]-2.3,meas,11,'center');
  }
},

/* ------------------------------------------------------------------
   ПОЛЯРИЗАЦИЯ. Модель: свет — верёвка, которую трясут поперёк. У
   естественного света плоскость тряски всё время скачет; поляроид — щель
   в заборе: проходит только тряска вдоль щели, и её размах падает как
   cos φ, а яркость — как cos²φ. Две скрещенные щели — верёвка стоит;
   третья щель между ними наискось — снова колышется.
   Брюстер: колебания в плоскости рисунка — линия, поперёк — точки; при
   θ = θ_Б в отражённом луче остаются одни точки. */
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
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    if(p.mode==='brewster') return {x:0,y:0,scale:clamp(Math.min((W-30)/(10*PX_PER_M),(H-30)/(7.4*PX_PER_M)),1e-3,30)};
    return {x:0.3,y:0.05,scale:clamp(Math.min((W-30)/(14.4*PX_PER_M),(H-30)/(5.6*PX_PER_M)),1e-3,30)}; },
  /* косоугольная проекция: x — вдоль луча, y — вверх, z — «к нам» */
  П(x,y,z){ return [x+0.42*z, y+0.24*z]; },
  draw(ctx,s,v,p){
    if(p.mode==='brewster') return this.рисоватьБрюстер(ctx,s,v,p);
    const acc=v.c('--accent'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), холст=v.c('--canvas');
    const ц=this.цепь(p), N=ц.length, X0=-6.4, X1=5.6, шаг=(X1-X0)/(N+1), Rd=1.45, А0=1.05, k=2*Math.PI/1.5, ω=2*Math.PI*0.8, t=s.t;
    const П=this.П.bind(this);
    // поляроид: тёмный диск и светлая щель вдоль оси пропускания
    const поляроид=(x,a)=>{ ctx.fillStyle=ink3; ctx.globalAlpha=.22; ctx.beginPath();
      for(let i=0;i<=48;i++){ const θ=i/48*2*Math.PI, [X,Y]=П(x,Rd*Math.cos(θ),Rd*Math.sin(θ)); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); } ctx.closePath(); ctx.fill();
      ctx.globalAlpha=.7; ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.stroke(); ctx.globalAlpha=1;
      const r=a*Math.PI/180, u=[Math.cos(r),Math.sin(r)], n=[-Math.sin(r),Math.cos(r)], L=Rd*0.9, w=0.22;
      const уг=[[L,w],[L,-w],[-L,-w],[-L,w]].map(([a1,b1])=>П(x,a1*u[0]+b1*n[0],a1*u[1]+b1*n[1]));
      ctx.fillStyle=холст; ctx.beginPath(); уг.forEach(([X,Y],i)=>i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1); ctx.stroke();
      const [tx,ty]=П(x,Rd+0.38,0); v.text(ctx,`${a}°`,tx,ty,ink2,10.5,'center'); };
    // кусок «верёвки»: синус в плоскости под углом φ к вертикали, с лентой до оси
    const кусок=(xa,xb,А,φ,цв)=>{ if(А<0.01){ ctx.strokeStyle=ink3; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(xa,0); ctx.lineTo(xb,0); ctx.stroke(); ctx.globalAlpha=1; return; }
      const cφ=Math.cos(φ), sφ=Math.sin(φ), т=[];
      for(let x=xa;x<=xb+1e-9;x+=0.04){ const u=А*Math.sin(k*x-ω*t); т.push(П(x,u*cφ,u*sφ)); }
      ctx.fillStyle=цв; ctx.globalAlpha=.12; ctx.beginPath(); т.forEach(([X,Y],i)=>i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)); ctx.lineTo(xb,0); ctx.lineTo(xa,0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1; ctx.strokeStyle=цв; ctx.lineWidth=v.lw(2.2); ctx.beginPath(); т.forEach(([X,Y],i)=>i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)); ctx.stroke(); };
    // ось луча
    ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(X0-0.3,0); ctx.lineTo(X1+0.6,0); ctx.stroke(); ctx.globalAlpha=1;
    const xs=ц.map((q,i)=>X0+шаг*(i+1));
    xs.forEach((x,i)=>поляроид(x,ц[i].a));
    // до поляризатора: естественный свет — плоскость скачет
    const φ0=p.nat?Math.PI*(2*ВОЛНЫ7.шум(t*2.2,3)-0.5):0;
    кусок(X0,xs[0],А0,φ0,acc);
    ц.forEach((q,i)=>кусок(xs[i],i+1<N?xs[i+1]:X1,А0*Math.sqrt(q.I),q.a*Math.PI/180,acc));
    // экран: яркость = I
    const I=ц[N-1].I, [m0,m1,m2]=[0,1,2].map(i=>parseInt((meas.match(/#?([0-9a-f]{6})/i)||[0,'e0a44a'])[1].substr(2*i,2),16));
    const угл=[[1.1,1.1],[1.1,-1.1],[-1.1,-1.1],[-1.1,1.1]].map(([y,z])=>П(X1+0.5,y,z));
    ctx.fillStyle=ink3; ctx.globalAlpha=.2; ctx.beginPath(); угл.forEach(([X,Y],i)=>i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=clamp(I*1.6,0,0.95); ctx.fillStyle=`rgb(${m0},${m1},${m2})`; ctx.fill(); ctx.globalAlpha=1;
    v.text(ctx,`I = ${числоНаСцене(I,3)} I₀`,X1+0.5,-1.75,meas,11,'center');
    v.text(ctx,p.nat?'естественный свет':'поляризованный свет',X0,-1.75,ink3,10,'left');
  },
  рисоватьБрюстер(ctx,s,v,p){
    const acc=v.c('--accent'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const ф=this.френель(p), θ=p.th*Math.PI/180, θt=ф.θt*Math.PI/180, L=3.6, t=s.t, k=2*Math.PI/0.9, ω=2*Math.PI*0.8;
    // стекло
    ctx.fillStyle=acc; ctx.globalAlpha=.07; ctx.fillRect(-4.6,-3.4,9.2,3.4); ctx.globalAlpha=1;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(-4.6,0); ctx.lineTo(4.6,0); ctx.stroke();
    ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(0,3.2); ctx.lineTo(0,-3.2); ctx.stroke(); ctx.setLineDash([]);
    v.text(ctx,`стекло, n = ${p.n}`,3.3,-2.9,ink3,10,'center');
    /* луч из (x1,y1) в (x2,y2): p-волна — синус в плоскости рисунка, s-волна — точки,
       их размер пульсирует (колебание к нам и от нас). ap, as — размахи 0…1. */
    const луч=(x1,y1,x2,y2,ap,as,сдвиг)=>{ const Lr=Math.hypot(x2-x1,y2-y1), ux=(x2-x1)/Lr, uy=(y2-y1)/Lr, nx=-uy, ny=ux, А=0.32;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.globalAlpha=1;
      if(ap>0.02){ ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2); ctx.beginPath();
        for(let i=0;i<=120;i++){ const l=Lr*i/120, u=А*ap*Math.sin(k*(l+сдвиг)-ω*t); const x=x1+ux*l+nx*u, y=y1+uy*l+ny*u; i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
        ctx.stroke(); }
      if(as>0.02){ ctx.fillStyle=meas; const шаг=0.9/2;
        for(let l=шаг/2;l<Lr;l+=шаг){ const r=v.lw(1+3.2*as*Math.abs(Math.sin(k*(l+сдвиг)-ω*t))); ctx.beginPath(); ctx.arc(x1+ux*l,y1+uy*l,r,0,7); ctx.fill(); } } };
    const ix=-L*Math.sin(θ), iy=L*Math.cos(θ), rx=L*Math.sin(θ), ry=iy, tx=L*Math.sin(θt), ty=-L*Math.cos(θt);
    const сr=Math.min(1,2.2*Math.sqrt(ф.Rs)), рr=Math.min(1,2.2*Math.sqrt(ф.Rp));     // отражённые — усилены для глаза
    луч(ix,iy,0,0,1,1,0);
    луч(0,0,rx,ry,рr,сr,L);
    луч(0,0,tx,ty,Math.sqrt(1-ф.Rp),Math.sqrt(1-ф.Rs),L);
    const близко=Math.abs(p.th-this.θБ(p))<0.6;
    if(близко){ const a1=Math.atan2(ry,rx), a2=Math.atan2(ty,tx), r=0.45; ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(r*Math.cos(a1),r*Math.sin(a1)); ctx.lineTo(r*Math.cos(a1)+r*Math.cos(a2),r*Math.sin(a1)+r*Math.sin(a2)); ctx.lineTo(r*Math.cos(a2),r*Math.sin(a2)); ctx.stroke(); }
    v.text(ctx,`θ = ${p.th}°`,-0.25,1.05,ink2,10.5,'right');
    v.text(ctx,близко?'θ = θ_Б: в отражённом — только точки':`θ_Б = ${числоНаСцене(this.θБ(p),3)}°`,rx,ry+0.42,близко?dang:ink3,10.5,'center');
    v.text(ctx,'линия — колебания в плоскости рисунка, точки — поперёк',0,3.35,ink3,10,'center');
  }
},

/* ------------------------------------------------------------------
   ЗЕРКАЛО. Модель: из верхушки предмета выходят световые импульсы по трём
   характерным лучам; отразившись, они сходятся в одной точке — там и
   изображение. Мнимое изображение — точка, где сходятся продолжения
   лучей за зеркалом: по ним бегут бледные «призраки». */
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
  пояснения(p){ const f=this.f(p), Γ=this.Γ(p);
    return [[!isFinite(f)?'предмет в фокусе: после отражения лучи параллельны — изображения нет'
      :`1/d + 1/f = 1/F: f = ${числоНаСцене(f,3)} см, Γ = ${числоНаСцене(Γ,3)} — ${f>0?'действительное':'мнимое'}`,css('--ink-2'),true]]; },
  рамка(p){ const f=this.f(p), Γ=this.Γ(p);
    const лев=-(Math.max(p.d,isFinite(f)&&f>0?f:0,2*p.F)+6), прав=Math.max(10,isFinite(f)&&f<0?-f+6:10);
    const Hm=Math.max(10,p.h*1.6,isFinite(Γ)?Math.min(40,Math.abs(Γ)*p.h)*1.15:0);
    return {лев,прав,Hm}; },
  fit(p,vp){ const р=this.рамка(p); return fitСПояснением(vp,р.прав-р.лев,2*р.Hm+4,(р.прав+р.лев)/2,0,this.пояснения(p),30); },
  anchors(s,p){ return [{x:0,y:0},{x:-p.d,y:p.h},{x:-this.Fs(p),y:0}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), ink=v.c('--ink'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const строки=this.пояснения(p); v.занятьНиз(строки);
    const F=this.Fs(p), R=2*F, f=this.f(p), Γ=this.Γ(p), d=p.d, h=p.h, {лев,прав,Hm}=this.рамка(p);
    // ось
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(лев,0); ctx.lineTo(прав,0); ctx.stroke(); ctx.globalAlpha=1;
    // зеркало: дуга с мягким отблеском, без штриховки
    const Ra=Math.abs(R), cxm=R>0?-Ra:Ra, a=Math.asin(Math.min(0.95,Hm/Ra));
    const дуга=()=>{ ctx.beginPath(); if(R>0) ctx.arc(cxm,0,Ra,-a,a); else ctx.arc(cxm,0,Ra,Math.PI-a,Math.PI+a); };
    ctx.strokeStyle=acc; ctx.globalAlpha=.18; ctx.lineWidth=v.lw(12); дуга(); ctx.stroke();
    ctx.globalAlpha=1; ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3); дуга(); ctx.stroke();
    for(const [x,t] of [[-F,'F'],[-R,'C']]){ ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(x,0,v.lw(3.2),0,7); ctx.fill(); v.text(ctx,t,x,-1.3,ink2,11,'center'); }
    // предмет — стрелка
    const стрелка=(x,y,цв,пунктир)=>{ if(Math.abs(y)<1e-6) return; if(пунктир) ctx.setLineDash([v.lw(4),v.lw(3)]);
      ctx.strokeStyle=цв; ctx.lineWidth=v.lw(3); ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,y); ctx.stroke(); ctx.setLineDash([]);
      const z=Math.sign(y), гл=Math.min(Math.abs(y)*0.35,1.4); ctx.fillStyle=цв; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-гл*0.45,y-z*гл); ctx.lineTo(x+гл*0.45,y-z*гл); ctx.closePath(); ctx.fill(); };
    стрелка(-d,h,acc,false);
    const xi=-f, yi=Γ*h, есть=isFinite(f)&&Math.abs(yi)<200;
    // лучи и бегущие по ним импульсы
    if(p.rays){
      const пути=[];
      const путь=(y0,kk)=>{ // из верхушки (−d, h) в точку зеркала (0, y0), затем с наклоном kk
        const x2=лев, y2=y0+kk*x2; const P=[[-d,h],[0,y0],[x2,y2]];
        const мним=isFinite(f)&&f<0? [[0,y0],[прав,y0+kk*прав]] : null; пути.push({P,мним}); };
      путь(h,h/F);
      if(Math.abs(d-F)>1e-6) путь(h*F/(F-d),0);
      путь(0,h/d);
      const длина=P=>{ let L=0; for(let i=1;i<P.length;i++) L+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); return L; };
      const где=(P,u)=>{ let L=длина(P)*u; for(let i=1;i<P.length;i++){ const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); if(L<=l){ const q=L/l; return [P[i-1][0]+(P[i][0]-P[i-1][0])*q,P[i-1][1]+(P[i][1]-P[i-1][1])*q]; } L-=l; } return P[P.length-1]; };
      for(const {P,мним} of пути){
        ctx.strokeStyle=meas; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1.3); ctx.beginPath(); P.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke();
        if(мним){ ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.globalAlpha=.3; ctx.beginPath(); ctx.moveTo(мним[0][0],мним[0][1]); ctx.lineTo(мним[1][0],мним[1][1]); ctx.stroke(); ctx.setLineDash([]); }
        ctx.globalAlpha=1;
        const Lp=длина(P), скор=18;                                       // см в секунду показа
        for(let j=0;j<3;j++){ const u=((s.t*скор/Lp)+j/3)%1; const [x,y]=где(P,u);
          ВОЛНЫ7.искра(ctx,v,x,y,2.6,meas,0.95);
          if(мним){ const L1=Math.hypot(P[1][0]-P[0][0],P[1][1]-P[0][1]), пройдено=u*Lp-L1;
            if(пройдено>0){ const k=пройдено/Math.hypot(мним[1][0]-мним[0][0],мним[1][1]-мним[0][1]);
              const gx=мним[0][0]+(мним[1][0]-мним[0][0])*k, gy=мним[0][1]+(мним[1][1]-мним[0][1])*k;
              if(gx<=прав) ВОЛНЫ7.искра(ctx,v,gx,gy,2,meas,0.3); } } }
      }
    }
    if(есть){ стрелка(xi,yi,dang,f<0); ctx.globalAlpha=1; }
    v.пояснение(ctx,строки);
  }
},

/* ------------------------------------------------------------------
   ТЕПЛОВОЕ ИЗЛУЧЕНИЕ. Модель: нагретое тело сыплет фотонами, и каждый
   фотон взят из спектра Планка. Холодное тело сыплет редко и почти одними
   невидимыми инфракрасными (тёмные кружки), горячее — густо и всё более
   синими. Справа — сам спектр: горб сдвигается влево (Вин), площадь под
   ним растёт как T⁴ (Стефан — Больцман). */
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
  /* таблица для выборки длины волны фотона: число фотонов ∝ M_λ·λ */
  таблица(T){ if(this._т&&this._т.T===T) return this._т; const L=[], F=[]; let s=0; const макс=this.λmax(T)*12, шаг=макс/400;
    for(let i=0;i<400;i++){ const l=(i+0.5)*шаг; s+=this.Mλ(T,l)*l; L.push(l); F.push(s); }
    return this._т={T,L,F:F.map(x=>x/s)}; },
  выбрать(T,u){ const т=this.таблица(T); let a=0,b=т.F.length-1; while(a<b){ const m=(a+b)>>1; if(т.F[m]<u) a=m+1; else b=m; } return т.L[a]; },
  init(p){ return {t:0,event:null,__stop:null,фот:[],след:0,г:ВОЛНЫ7.гсч(5800)}; },
  step(s,dt,p){ s.t+=dt; if(!s.фот) return;
    const частота=4+46*clamp(Math.log10(this.M(p)/400+1)/5.2,0,1);
    s.след+=dt*частота;
    while(s.след>=1){ s.след-=1; const a=s.г()*2*Math.PI; s.фот.push({x:Math.cos(a)*1.05,y:Math.sin(a)*1.05,ux:Math.cos(a),uy:Math.sin(a),λ:this.выбрать(p.T,s.г()),возр:0}); }
    for(const ф of s.фот){ ф.x+=ф.ux*2.4*dt; ф.y+=ф.uy*2.4*dt; ф.возр+=dt; }
    s.фот=s.фот.filter(ф=>ф.возр<1.6);
    if(s.фот.length>400) s.фот.splice(0,s.фот.length-400);
  },
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
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320; return {x:0.4,y:0,scale:clamp(Math.min((W-30)/(14*PX_PER_M),(H-30)/(7.4*PX_PER_M)),1e-3,30)}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    // тело и его фотоны
    const bx=-4.6, by=0, ц=this.цвет(p.T), яр=clamp(Math.log10(this.M(p)/1e3+1)/4.6,0.07,1);
    const цТ=`rgb(${Math.round(ц[0]*яр)},${Math.round(ц[1]*яр)},${Math.round(ц[2]*яр)})`;
    for(const ф of s.фот||[]){ const x=bx+ф.x, y=by+ф.y, а=Math.max(0,1-ф.возр/1.6);
      if(ф.λ>=380&&ф.λ<=780){ ВОЛНЫ7.искра(ctx,v,x,y,2.2,ВОЛНЫ7.цветВолны(ф.λ),а); }
      else { ctx.fillStyle=ink3; ctx.globalAlpha=а*0.35; ctx.beginPath(); ctx.arc(x,y,v.lw(1.4),0,7); ctx.fill(); ctx.globalAlpha=1; } }
    if(яр>0.12){ const г=ctx.createRadialGradient(bx,by,0.9,bx,by,2.4); г.addColorStop(0,`rgba(${ц[0]},${ц[1]},${ц[2]},${(0.35*яр).toFixed(3)})`); г.addColorStop(1,`rgba(${ц[0]},${ц[1]},${ц[2]},0)`);
      ctx.fillStyle=г; ctx.beginPath(); ctx.arc(bx,by,2.4,0,7); ctx.fill(); }
    ctx.fillStyle=цТ; ctx.beginPath(); ctx.arc(bx,by,1,0,7); ctx.fill();
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.stroke();
    v.text(ctx,`${p.T} К`,bx,by-2.75,ink2,11,'center');
    // спектр: видимая часть закрашена своими цветами
    const gx=-1.4, gy=-2.5, gw=7.6, gh=5;
    const Tмин=Math.min(p.T,p.cmp?p.T2:p.T), lмакс=clamp(this.λmax(Tмин)*4,1200,40000);
    const Y=Math.max(this.Mλ(p.T,this.λmax(p.T)),p.cmp?this.Mλ(p.T2,this.λmax(p.T2)):0)*p.eps*1.1;
    const кривая=(T,l)=>gy+gh*Math.min(1.05,p.eps*this.Mλ(T,l)/Y);
    ctx.fillStyle=ink3; ctx.globalAlpha=.16; ctx.beginPath(); ctx.moveTo(gx,gy);
    for(let i=1;i<=400;i++){ const l=lмакс*i/400; ctx.lineTo(gx+gw*l/lмакс,кривая(p.T,l)); } ctx.lineTo(gx+gw,gy); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
    for(let l=380;l<780&&l<lмакс;l+=4){ ctx.fillStyle=ВОЛНЫ7.цветВолны(l+2); ctx.globalAlpha=.9; const x=gx+gw*l/lмакс; ctx.fillRect(x,gy,gw*4/lмакс+0.004,кривая(p.T,l+2)-gy); }
    ctx.globalAlpha=1;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    if(p.cmp){ ctx.strokeStyle=ink2; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.4); ctx.beginPath();
      for(let i=1;i<=400;i++){ const l=lмакс*i/400; i>1?ctx.lineTo(gx+gw*l/lмакс,кривая(p.T2,l)):ctx.moveTo(gx+gw*l/lмакс,кривая(p.T2,l)); } ctx.stroke(); ctx.setLineDash([]);
      v.text(ctx,`${p.T2} К`,gx+gw*Math.min(0.92,this.λmax(p.T2)/lмакс),кривая(p.T2,this.λmax(p.T2))+0.3,ink2,10,'center'); }
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
    for(let i=1;i<=400;i++){ const l=lмакс*i/400; i>1?ctx.lineTo(gx+gw*l/lмакс,кривая(p.T,l)):ctx.moveTo(gx+gw*l/lмакс,кривая(p.T,l)); } ctx.stroke();
    if(p.rj){ ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); let нач=false;
      for(let i=1;i<=400;i++){ const l=lмакс*i/400, m=p.eps*this.Rj(p.T,l)/Y; if(m>1.05) continue; const x=gx+gw*l/lмакс, y=gy+gh*m; нач?ctx.lineTo(x,y):ctx.moveTo(x,y); нач=true; }
      ctx.stroke(); ctx.setLineDash([]); v.text(ctx,'классика: уходит в бесконечность',gx+gw*0.35,gy+gh*1.02,dang,10,'left'); }
    const xm=gx+gw*this.λmax(p.T)/lмакс;
    if(xm<gx+gw){ v.text(ctx,`λ_max = ${числоНаСцене(this.λmax(p.T),3)} нм`,xm,кривая(p.T,this.λmax(p.T))+0.32,meas,10.5,'center'); }
    v.text(ctx,`λ → ${числоНаСцене(lмакс,3)} нм`,gx+gw,gy-0.32,ink3,9.5,'right');
  }
},

/* ------------------------------------------------------------------
   ОСВЕЩЁННОСТЬ. Модель: лампа сыплет на стол свет-«песок». Где точек
   гуще, там светлее: под лампой густо, к краям реже — и от расстояния
   (1/r²), и от наклона (cos α). Каждая точка — равная доля потока, поэтому
   густота точек и есть освещённость. Фотометр: каждая лампа засыпает свою
   сторону экрана; равновесие — когда стороны засыпаны одинаково. */
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
  init(p){ return {t:0,event:null,__stop:null,лучи:[],метки:[],след:0,г:ВОЛНЫ7.гсч(4242)}; },
  /* точка удара по столу выбирается с плотностью ∝ E(x) ∝ (1 + u²)^(−3/2), u = x/h:
     обратная функция u = s/√(1 − s²) при равномерном s ∈ (−1, 1) */
  step(s,dt,p){ s.t+=dt; if(!s.лучи) return; const г=s.г;
    if(p.mode==='two'){ const xs=Math.min(p.xs,p.D-0.05), E1=p.I/(xs*xs), E2=p.I2/((p.D-xs)*(p.D-xs)), к=34/Math.max(E1,E2);
      s.след+=dt; const n1=Math.min(40,E1*к*dt+г()), n2=Math.min(40,E2*к*dt+г());
      for(let i=0;i<Math.floor(n1);i++){ const y=(г()-0.5)*0.5; s.лучи.push({x0:0,y0:0,x1:xs-0.04,y1:y,u:0,v:1/xs*1.6,сторона:-1}); }
      for(let i=0;i<Math.floor(n2);i++){ const y=(г()-0.5)*0.5; s.лучи.push({x0:p.D,y0:0,x1:xs+0.04,y1:y,u:0,v:1/(p.D-xs)*1.6,сторона:1}); }
    } else {
      const n=Math.min(80,(40+160*clamp(Math.log10(p.I)/3.3,0,1))*dt+г());
      for(let i=0;i<Math.floor(n);i++){ const sг=(г()*2-1)*0.985, x=p.h*sг/Math.sqrt(1-sг*sг);
        s.лучи.push({x0:0,y0:p.h,x1:x,y1:0,u:0,v:2.2/Math.hypot(x,p.h)}); }
    }
    for(const л of s.лучи){ л.u+=л.v*dt; if(л.u>=1&&!л.готов){ л.готов=true; s.метки.push({x:л.x1,y:л.y1,t:s.t,с:л.сторона,г:г()}); } }
    s.лучи=s.лучи.filter(л=>!л.готов);
    s.метки=s.метки.filter(м=>s.t-м.t<4);
    if(s.метки.length>2400) s.метки.splice(0,s.метки.length-2400);
  },
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
    if(p.mode==='two') return {x:p.D/2,y:0.1,scale:clamp(Math.min((W-40)/((p.D+1.2)*PX_PER_M),(H-40)/(2*PX_PER_M)),1e-3,30)};
    const wx=Math.max(3.4,p.x+1)*2, hy=p.h+1.1; return {x:0,y:p.h/2+0.05,scale:clamp(Math.min((W-40)/(wx*PX_PER_M),(H-40)/(hy*PX_PER_M)),1e-3,30)}; },
  anchors(s,p){ return p.mode==='two'?[{x:0,y:0},{x:p.D,y:0}]:[{x:0,y:p.h},{x:p.x,y:0}]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second');
    const лампа=(x,y,I)=>{ const r=(0.07+0.04*Math.log10(I))*(p.mode==='two'?0.55:1);
      const g=ctx.createRadialGradient(x,y,0,x,y,r*5); g.addColorStop(0,'rgba(255,200,60,.5)'); g.addColorStop(1,'rgba(255,200,60,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*5,0,7); ctx.fill();
      ctx.fillStyle='#f5b400'; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); };
    const полёт=л=>{ const x=л.x0+(л.x1-л.x0)*л.u, y=л.y0+(л.y1-л.y0)*л.u; ctx.beginPath(); ctx.arc(x,y,v.lw(1.6),0,7); ctx.fill(); };
    if(p.mode==='two'){
      const xs=Math.min(p.xs,p.D-0.05), E1=p.I/(xs*xs), E2=p.I2/((p.D-xs)*(p.D-xs)), равно=Math.abs(E1/E2-1)<0.03;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(-0.3,-0.4); ctx.lineTo(p.D+0.3,-0.4); ctx.stroke();
      ctx.fillStyle=meas; ctx.globalAlpha=.8; for(const л of s.лучи||[]) полёт(л); ctx.globalAlpha=1;
      // экран: две стороны, засыпанные каждая своей лампой
      ctx.fillStyle=ink3; ctx.globalAlpha=.25; ctx.fillRect(xs-0.035,-0.3,0.07,0.6); ctx.globalAlpha=1;
      ctx.fillStyle=meas; for(const м of s.метки||[]){ ctx.globalAlpha=Math.max(0,1-(s.t-м.t)/4); ctx.beginPath(); ctx.arc(м.x+(м.с<0?-0.045-0.04*(м.г||0):0.045+0.04*(м.г||0)),м.y,v.lw(1.2),0,7); ctx.fill(); } ctx.globalAlpha=1;
      лампа(0,0,p.I); лампа(p.D,0,p.I2);
      v.text(ctx,`${p.I} кд`,0,-0.62,ink2,10.5,'center'); v.text(ctx,`${p.I2} кд`,p.D,-0.62,ink2,10.5,'center');
      v.text(ctx,равно?'стороны одинаковы — равновесие':E1>E2?'левая сторона ярче':'правая сторона ярче',xs,0.55,равно?sec:dang,10.5,'center');
      return;
    }
    const W=Math.max(3.4,p.x+1);
    // стол
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(-W,0); ctx.lineTo(W,0); ctx.stroke();
    // летящий свет и следы на столе
    ctx.fillStyle=meas; ctx.globalAlpha=.75; for(const л of s.лучи||[]) полёт(л); ctx.globalAlpha=1;
    for(const м of s.метки||[]){ if(Math.abs(м.x)>W) continue; ctx.globalAlpha=Math.max(0,1-(s.t-м.t)/4)*0.85; ctx.beginPath(); ctx.arc(м.x,-0.03-0.1*(м.г||0),v.lw(1.3),0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    лампа(0,p.h,p.I);
    // точка измерения
    ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(0,p.h); ctx.lineTo(p.x,0); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(p.x,0,v.lw(4),0,7); ctx.fill();
    v.text(ctx,`E = ${числоНаСцене(this.E(p),3)} лк`,p.x,-0.28,dang,11,'center');
  }
}
});
