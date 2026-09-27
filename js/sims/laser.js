'use strict';
/* =============================================================================
   ЛАЗЕР (3.2.0, сцена переделана в 3.3.0)

   Четырёхуровневая схема и уравнения скорости — та же модель, по которой
   считают настоящие лазеры, только в безразмерных единицах:
       dN₂/dt = P·(1 − N₂) − N₂/τ − B·n·N₂
       dn/dt  = B·n·N₂ − n/τр + β·N₂/τ
   N₂ — доля атомов на верхнем лазерном уровне (нижний опустошается быстро,
   поэтому N₁ ≈ 0 и вся заселённость N₂ — уже инверсия), n — фотоны в
   резонаторе, P — накачка, τ — время жизни верхнего уровня (единица
   времени сцены), τр = τ₀/(1 − R) — сколько фотон живёт между зеркалами.
   Генерация начинается, когда усиление догоняет потери: B·N₂ = 1/τр.
   Выше порога инверсия «прилипает» к пороговой, а весь избыток накачки
   уходит в луч.

   Сцена в 3.2.0 была непонятной: тридцать две точки, крошечные змейки и
   полоски заселённостей. Теперь два опыта:
     · «Лавина» — сама идея: фотон летит вдоль ряда возбуждённых атомов,
       и каждый атом отдаёт его точную копию; рядом тот же фотон летит через
       невозбуждённые атомы и просто поглощается. Инверсия — вся разница.
     · «Лазер целиком» — резонатор: атомы нарисованы лесенкой из двух
       уровней с электроном на одном из них, фотоны — волнами со стрелкой,
       справа — столбики «усиление против потерь».
   ============================================================================= */
const ЛАЗ={
  /* атом-лесенка: две ступеньки и электрон; f — положение электрона (0 внизу, 1 наверху) */
  атом(ctx,v,x,y,f,col,ink3){
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.moveTo(x-0.24,y-0.2); ctx.lineTo(x+0.24,y-0.2); ctx.moveTo(x-0.24,y+0.2); ctx.lineTo(x+0.24,y+0.2); ctx.stroke();
    if(f>0.5){ ctx.fillStyle=col; ctx.globalAlpha=.18*f; ctx.beginPath(); ctx.arc(x,y,0.42,0,7); ctx.fill(); ctx.globalAlpha=1; }
    КС.точка(ctx,v,x,y-0.2+0.4*f,4.5,f>0.5?col:ink3);
  }
};
Object.assign(SIMS,{
laser:{
  title:'Лазер: инверсия, вынужденное излучение и порог',
  schema:true,
  hudAware:true,
  timeUnit:'τ',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'avalanche',
     options:[{v:'avalanche',t:'Лавина фотонов: зачем нужна инверсия'},{v:'laser',t:'Лазер целиком: накачка, зеркала, порог'}]},
    {key:'med',label:'Активная среда',type:'select',default:'hene',
     options:[{v:'hene',t:'Гелий-неоновый, 632,8 нм'},{v:'ruby',t:'Рубин, 694,3 нм'},
              {v:'nd',t:'Nd:YAG, 1064 нм (инфракрасный)'},{v:'diode',t:'Полупроводниковый, 405 нм'}]},
    {key:'P',label:'Накачка P',unit:'1/τ',min:0,max:5,step:0.05,default:1.5},
    {key:'R',label:'Отражение выходного зеркала R',unit:'%',min:50,max:99.9,step:0.1,default:95},

    {type:'group',label:'Показывать',если:p=>p.mode==='laser'},
    {key:'levels',label:'Схема уровней с атомами на них',type:'check',default:true,если:p=>p.mode==='laser'},
    {key:'gauge', label:'Усиление за проход против потерь',type:'check',default:true,если:p=>p.mode==='laser'}
  ],
  h:6.62607015e-34, c:2.99792458e8, e:1.602176634e-19, kB:1.380649e-23,
  λ:{hene:632.8,ruby:694.3,nd:1064,diode:405},
  имя:{hene:'гелий-неоновый',ruby:'рубин',nd:'Nd:YAG',diode:'полупроводниковый'},
  TAU0:0.02, BT0:1/3, BETA:1e-3, NA:12,               // BT0 = B·τ₀ — усиление за проход при N₂ = 1
  B(){ return this.BT0/this.TAU0; },
  tauC(p){ return this.TAU0/(1-p.R/100); },
  Nth(p){ return 1/(this.B()*this.tauC(p)); },        // пороговая инверсия
  Pth(p){ const N=this.Nth(p); return N<1?N/(1-N):Infinity; },
  Eph(p){ return this.h*this.c/(this.λ[p.med]*1e-9)/this.e; },
  /* установившийся режим — для проверок и задач */
  стац(p){ const N=this.Nth(p);
    if(p.P<=this.Pth(p)) return {N2:p.P/(1+p.P),out:0};
    return {N2:N,out:p.P*(1-N)-N}; },
  init(p){
    const s={t:0,N2:0,n:0,seed:1960,ат:[],фот:[],выход:[],всп:[],накачка:[],__stop:null};
    for(let i=0;i<this.NA;i++) s.ат.push({x:-3.9+7.8*((i%6)+0.5)/6,y:(i<6?2.35:3.35),up:false,f:0});
    return s;
  },
  step(s,dt,p){
    s.t+=dt;
    const B=this.B(), tc=this.tauC(p), K=24, h=dt/K;
    for(let k=0;k<K;k++){
      const st=B*s.n*s.N2;
      const dN=p.P*(1-s.N2)-s.N2-st, dn=st-s.n/tc+this.BETA*s.N2;
      s.N2=clamp(s.N2+dN*h,0,1); s.n=Math.max(0,s.n+dn*h);
    }
    if(p.mode!=='laser') return this.шагЛавины(s,dt,p);
    // ---- атомы на картинке следуют N₂
    const цель=Math.round(s.N2*this.NA), up=s.ат.filter(a=>a.up).length;
    if(up<цель && КС.rnd(s)<dt*8){ const g=s.ат.filter(a=>!a.up); const a=g[Math.floor(КС.rnd(s)*g.length)]; if(a){ a.up=true; s.накачка.push({x:a.x,y:a.y,t:0}); } }
    else if(up>цель && КС.rnd(s)<dt*8){ const g=s.ат.filter(a=>a.up); const a=g[Math.floor(КС.rnd(s)*g.length)];
      if(a){ a.up=false; const st=B*s.n*s.N2, доля=st/(st+s.N2+1e-9);
        if(КС.rnd(s)<доля) s.фот.push({x:a.x,y:a.y,d:КС.rnd(s)<0.5?1:-1});
        else s.всп.push({x:a.x,y:a.y,a:КС.rnd(s)*2*Math.PI,t:0}); } }
    for(const a of s.ат) a.f+=clamp((a.up?1:0)-a.f,-dt*5,dt*5);
    // фотоны вдоль оси: их число держим пропорциональным n
    const нужно=Math.min(14,Math.round(s.n*3));
    while(s.фот.length<нужно && s.n>0.1) s.фот.push({x:-4+8*КС.rnd(s),y:КС.rnd(s)<0.5?2.35:3.35,d:КС.rnd(s)<0.5?1:-1});
    while(s.фот.length>нужно+2) s.фот.shift();
    const выпуск=Math.max(0.12,1-p.R/100);
    for(const f of s.фот){ f.x+=f.d*dt*3.2;
      if(f.x>5.05){ f.x=5.05; f.d=-1; if(КС.rnd(s)<выпуск) s.выход.push({x:5.4,y:f.y,t:0}); }
      if(f.x<-5.05){ f.x=-5.05; f.d=1; } }
    for(const q of s.выход){ q.t+=dt; q.x+=dt*3.2; } s.выход=s.выход.filter(q=>q.x<7.2);
    for(const q of s.всп) q.t+=dt; s.всп=s.всп.filter(q=>q.t<0.9);
    for(const q of s.накачка) q.t+=dt; s.накачка=s.накачка.filter(q=>q.t<0.4);
    if(s.t>=60) s.__stop='Прошло 60 τ — режим давно установился';
  },
  /* лавина: время цикла 8 с, фотон бежит со скоростью 1,4 */
  XA:[-3.6,-2.4,-1.2,0,1.2,2.4,3.6],
  шагЛавины(s,dt,p){ if(s.t>=60) s.__stop='Прошло 60 τ — посмотрите режим «Лазер целиком»'; },
  anchors(s,p){ return [{x:0,y:2.8}]; },
  readouts(s,p){
    const N=this.Nth(p), out=s.n/this.tauC(p);
    return [['среда',this.имя[p.med],''],
      ['длина волны λ',this.λ[p.med],'нм'],
      ['энергия фотона hc/λ',this.Eph(p),'эВ'],
      ['время жизни фотона в резонаторе τр',this.tauC(p),'τ'],
      ['пороговая инверсия N₂пор = 1/(Bτр)',N,'доля атомов'],
      ['пороговая накачка Pпор',this.Pth(p),'1/τ'],
      ['инверсия N₂ сейчас',s.N2,'доля атомов'],
      ['фотонов в резонаторе',s.n,'отн.'],
      ['выходная мощность',out,'отн.'],
      ['генерация',N>=1?'нет: зеркало пропускает слишком много':(p.P>this.Pth(p)?'идёт':'нет: накачка ниже порога'),'']];
  },
  graphs:[
    {label:'Инверсия N₂(t) и порог',unit:'доля',series:['N₂','порог'],get(s,p){ return [s.N2,Math.min(1,SIMS.laser.Nth(p))]; }},
    {label:'Выходная мощность',unit:'отн.',series:['мощность'],get(s,p){ return [s.n/SIMS.laser.tauC(p),null]; }}
  ],
  presets:[
    {name:'Лавина: фотон копируется возбуждёнными атомами',values:{mode:'avalanche'}},
    {name:'Лазер выше порога: луч есть, инверсия прилипла к порогу',values:{mode:'laser',med:'hene',P:1.5,R:95}},
    {name:'Ниже порога: только спонтанное свечение',values:{mode:'laser',med:'hene',P:0.15,R:95}},
    {name:'Прозрачное зеркало: генерации нет',values:{mode:'laser',med:'ruby',P:3,R:60}},
    {name:'Сильная накачка: пички при включении',values:{mode:'laser',med:'ruby',P:4,R:90}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0); },
  цвет(p){ const λ=this.λ[p.med]; return λ>750?'#c0392b':КС.цветλ(λ); },
  лавина(ctx,s,v,p){
    const ink=v.c('--ink-2'), ink3=v.c('--ink-3'), dang=v.c('--danger'), ok=v.c('--ok'), col=this.цвет(p);
    const T=8, t=s.t%T, V=1.4, фронт=-5.6+V*t, XA=this.XA, λs=0.34;
    // ---- ряд 1: инверсия
    КС.рамка(ctx,v,-6.25,0.2,12.5,4.75,'инверсия: атомы возбуждены — фотон размножается');
    const y1=2.7;
    let копий=0;
    v.text(ctx,'E₂',XA[0]-0.45,y1+1.15,ink3,9,'right'); v.text(ctx,'E₁',XA[0]-0.45,y1+0.75,ink3,9,'right');
    XA.forEach((x,i)=>{ const прошёл=фронт>x, f=прошёл?clamp(1-(фронт-x)/0.35,0,1):1;
      ЛАЗ.атом(ctx,v,x,y1+0.95,f,col,ink3); if(прошёл) копий++; });
    // фотоны идут стопкой: у всех одна фаза и одна голова — это копии
    const всего=1+копий;
    for(let k=0;k<всего;k++){ const y=y1-0.25*(всего-1)/2+0.25*k;
      if(фронт<6.1) v.photon(ctx,Math.min(фронт,6.1),y,0,{len:1.3,lam:λs,amp:0.08,phase:s.t*8,color:col,lw:1.8}); }
    v.text(ctx,`фотонов: ${всего}`,5.95,4.67,col,11,'right',true);
    v.text(ctx,'каждый возбуждённый атом отдаёт копию:',0,0.95,ink,10,'center',true);
    v.text(ctx,'та же длина волны, фаза и направление',0,0.55,ink,10,'center');
    // ---- ряд 2: без инверсии
    КС.рамка(ctx,v,-6.25,-4.95,12.5,4.75,'нет инверсии: атомы внизу — фотон поглощается');
    const y2=-2.5, x0=XA[0], погл=фронт>x0;
    v.text(ctx,'E₂',XA[0]-0.45,y2+1.15,ink3,9,'right'); v.text(ctx,'E₁',XA[0]-0.45,y2+0.75,ink3,9,'right');
    XA.forEach((x,i)=>{ const f=(i===0&&погл)?clamp((фронт-x0)/0.35,0,1)*(1-clamp((t-(x0+5.6)/V-2.2)/0.4,0,1)):0; ЛАЗ.атом(ctx,v,x,y2+0.95,f,col,ink3); });
    if(!погл) v.photon(ctx,фронт,y2,0,{len:1.3,lam:λs,amp:0.08,phase:s.t*8,color:col,lw:1.8});
    else { // поглощённый фотон потом испускается спонтанно — в случайную сторону
      const tt=t-(x0+5.6)/V-2.2, a=-2.4;
      if(tt>0 && tt<2.2) v.photon(ctx,x0+(0.4+1.4*tt)*Math.cos(a),y2+0.95+(0.4+1.4*tt)*Math.sin(a),a,{len:0.9,lam:λs,amp:0.07,phase:s.t*8,color:col,lw:1.6,alpha:1-tt/2.2});
      v.text(ctx,tt>0?'позже атом отдаёт энергию сам — в случайную сторону':'фотон поглотился: электрон ушёл наверх',0,-4.2,ink3,10,'center');
    }
    v.text(ctx,'свет усиливается, только если возбуждённых атомов',0,-3.4,dang,10,'center',true);
    v.text(ctx,'больше, чем невозбуждённых: это и есть инверсия',0,-3.75,dang,10,'center',true);
  },
  draw(ctx,s,v,p){
    if(p.mode!=='laser') return this.лавина(ctx,s,v,p);
    const meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    const λ=this.λ[p.med], col=this.цвет(p), N=this.Nth(p), out=s.n/this.tauC(p), outSS=Math.max(0.2,this.стац(p).out);
    // ---- резонатор
    КС.рамка(ctx,v,-6.25,0.9,12.5,4.05,`резонатор: ${this.имя[p.med]}, λ = ${λ} нм`);
    ctx.fillStyle=col; ctx.globalAlpha=.06; ctx.fillRect(-4.3,1.75,8.6,2.2); ctx.globalAlpha=1;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.strokeRect(-4.3,1.75,8.6,2.2);
    ctx.fillStyle=ink; ctx.fillRect(-5.45,1.6,0.22,2.5);
    ctx.fillStyle=ink; ctx.globalAlpha=0.35+0.6*p.R/100; ctx.fillRect(5.23,1.6,0.12,2.5); ctx.globalAlpha=1;
    v.text(ctx,'зеркало 100 %',-5.34,1.35,ink3,9); v.text(ctx,`выход R = ${p.R} %`,5.1,1.35,ink3,9);
    for(const q of s.накачка){ ctx.strokeStyle=ok; ctx.globalAlpha=1-q.t/0.4; ctx.lineWidth=v.lw(2.2);
      v.arrow(ctx,q.x,q.y-0.75,q.x,q.y-0.3,ok); ctx.globalAlpha=1; }
    for(const a of s.ат) ЛАЗ.атом(ctx,v,a.x,a.y,a.f,col,ink3);
    for(const q of s.всп){ const d=0.35+q.t*2.2; v.photon(ctx,q.x+d*Math.cos(q.a),q.y+d*Math.sin(q.a),q.a,{len:0.5,lam:0.2,amp:0.05,color:col,lw:1.3,alpha:1-q.t/0.9}); }
    for(const f of s.фот) v.photon(ctx,f.x,f.y+0.02,f.d>0?0:Math.PI,{len:0.9,lam:0.25,amp:0.07,phase:s.t*10,color:col,lw:1.8});
    for(const q of s.выход) v.photon(ctx,q.x,q.y,0,{len:0.9,lam:0.25,amp:0.07,phase:s.t*10,color:col,lw:1.8,alpha:clamp(1-(q.x-5.4)/1.8,0,1)});
    if(out>0.002) v.text(ctx,'луч →',5.85,4.35,col,11,'center',true);
    v.text(ctx,`накачка P = ${p.P}: зелёные стрелки поднимают электроны`,-4.3,4.35,ok,9,'left',true);
    // ---- схема уровней: атомы стоят на своих уровнях
    if(p.levels){
      const gx=-6.25, gy=-4.95, gw=6.1, gh=5.6;
      КС.рамка(ctx,v,gx,gy,gw,gh,'четыре уровня');
      const Y={0:gy+0.75,1:gy+1.6,2:gy+3.5,3:gy+4.55}, x0=gx+0.35, x1=gx+3.1;
      for(const k of [0,1,2,3]){ ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.8); ctx.beginPath(); ctx.moveTo(x0,Y[k]); ctx.lineTo(x1,Y[k]); ctx.stroke(); }
      v.text(ctx,'E₃ накачка',x1+0.1,Y[3],ink3,9,'left'); v.text(ctx,'E₂ верхний',x1+0.1,Y[2],ink,9,'left',true);
      v.text(ctx,'E₁ нижний',x1+0.1,Y[1],ink,9,'left',true); v.text(ctx,'E₀ основной',x1+0.1,Y[0],ink3,9,'left');
      const наверху=s.ат.filter(a=>a.up).length;
      for(let i=0;i<this.NA;i++){ const up=i<наверху, x=x0+0.2+i*0.21; КС.точка(ctx,v,x,(up?Y[2]:Y[0])+0.12,3.4,up?col:ink3); }
      v.arrow(ctx,x1-0.25,Y[0],x1-0.25,Y[3],ok);
      ctx.save(); ctx.setLineDash([v.lw(3),v.lw(3)]); v.arrow(ctx,x1-0.55,Y[3],x1-0.55,Y[2],ink3); v.arrow(ctx,x1-0.55,Y[1],x1-0.55,Y[0],ink3); ctx.restore();
      ctx.save(); ctx.lineWidth=v.lw(3); v.arrow(ctx,x1-0.95,Y[2],x1-0.95,Y[1],col); ctx.restore();
      v.text(ctx,`наверху ${наверху} из ${this.NA}, на E₁ — никого`,gx+gw/2,gy+2.5,ink,9,'center',true);
      v.text(ctx,'E₁ сразу пустеет — инверсия лёгкая',gx+gw/2,gy+0.25,ink3,9,'center');
    }
    // ---- усиление против потерь
    if(p.gauge){
      const gx=0.15, gy=-4.95, gw=6.1, gh=5.6;
      КС.рамка(ctx,v,gx,gy,gw,gh,'за проход: усиление и потери');
      const G=this.BT0*s.N2*100, L=100-p.R, M=Math.max(G,L,this.BT0*100)*1.05, W=gw-3.0, x0=gx+1.9;
      const бар=(y,val,c,txt)=>{ ctx.fillStyle=c; ctx.globalAlpha=.85; ctx.fillRect(x0,y-0.22,Math.max(0.03,W*val/M),0.44); ctx.globalAlpha=1;
        v.text(ctx,txt,gx+0.2,y,ink,10,'left',true); v.text(ctx,`${val.toFixed(1)} %`,x0+Math.max(0.03,W*val/M)+0.1,y,ink,9,'left'); };
      бар(gy+4.2,G,col,'усиление');
      бар(gy+3.3,L,ink3,'потери');
      const порог=N<1, идёт=порог&&G>=L*0.98;
      v.text(ctx,!порог?'потери больше любого усиления:':(идёт?'усиление = потери:':'усиление < потерь:'),gx+gw/2,gy+2.45,идёт?ok:dang,10,'center',true);
      v.text(ctx,!порог?'генерации не будет':(идёт?'генерация идёт':'луча нет'),gx+gw/2,gy+2.1,идёт?ok:dang,10,'center',true);
      v.text(ctx,'выше порога усиление держится ровно',gx+gw/2,gy+1.3,ink3,9,'center');
      v.text(ctx,'на уровне потерь, а лишняя накачка',gx+gw/2,gy+0.95,ink3,9,'center');
      v.text(ctx,'уходит в луч',gx+gw/2,gy+0.6,ink3,9,'center');
    }
  }
}
});
