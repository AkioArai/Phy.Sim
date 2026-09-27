'use strict';
/* =============================================================================
   ЛАЗЕР (3.2.0)

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
   уходит в луч. На включении видны релаксационные пички — как у
   настоящего твердотельного лазера.
   Сцена показывает то же самое по атомам: накачка зажигает атомы,
   фотон вдоль оси размножается вынужденным излучением, выходное зеркало
   выпускает часть света наружу.
   ============================================================================= */
Object.assign(SIMS,{
laser:{
  title:'Лазер: инверсия, вынужденное излучение и порог',
  schema:true,
  hudAware:true,
  timeUnit:'τ',
  params:[
    {key:'med',label:'Активная среда',type:'select',default:'hene',
     options:[{v:'hene',t:'Гелий-неоновый, 632,8 нм'},{v:'ruby',t:'Рубин, 694,3 нм'},
              {v:'nd',t:'Nd:YAG, 1064 нм (инфракрасный)'},{v:'diode',t:'Полупроводниковый, 405 нм'}]},
    {key:'P',label:'Накачка P',unit:'1/τ',min:0,max:5,step:0.05,default:1.5},
    {key:'R',label:'Отражение выходного зеркала R',unit:'%',min:50,max:99.9,step:0.1,default:95},

    {type:'group',label:'Показывать'},
    {key:'levels',label:'Схема уровней и заселённости',type:'check',default:true},
    {key:'gauge', label:'Усиление за проход против потерь',type:'check',default:true}
  ],
  h:6.62607015e-34, c:2.99792458e8, e:1.602176634e-19, kB:1.380649e-23,
  λ:{hene:632.8,ruby:694.3,nd:1064,diode:405},
  имя:{hene:'гелий-неоновый',ruby:'рубин',nd:'Nd:YAG',diode:'полупроводниковый'},
  TAU0:0.02, BT0:1/3, BETA:1e-3, NA:32,               // BT0 = B·τ₀ — усиление за проход при N₂ = 1
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
    const s={t:0,N2:0,n:0,seed:1960,ат:[],фот:[],всп:[],накачка:[],__stop:null};
    for(let i=0;i<this.NA;i++) s.ат.push({x:-4.0+8.0*((i%16)+0.5)/16,y:(i<16?2.55:3.15),up:false});
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
    // ---- атомы на картинке следуют N₂
    const цель=Math.round(s.N2*this.NA), up=s.ат.filter(a=>a.up).length;
    if(up<цель){ const g=s.ат.filter(a=>!a.up); const a=g[Math.floor(КС.rnd(s)*g.length)]; if(a){ a.up=true; s.накачка.push({x:a.x,y:a.y,t:0}); } }
    else if(up>цель){ const g=s.ат.filter(a=>a.up); const a=g[Math.floor(КС.rnd(s)*g.length)];
      if(a){ a.up=false; const st=B*s.n*s.N2, доля=st/(st+s.N2+1e-9);
        if(КС.rnd(s)<доля) s.фот.push({x:a.x,y:a.y,d:КС.rnd(s)<0.5?1:-1,life:0});
        else { const ang=КС.rnd(s)*2*Math.PI; s.всп.push({x:a.x,y:a.y,a:ang,t:0}); } } }
    // фотоны вдоль оси: число держим пропорциональным n
    const нужно=Math.min(40,Math.round(s.n*6));
    while(s.фот.length<нужно && s.n>0.05) s.фот.push({x:-4+8*КС.rnd(s),y:2.4+0.9*КС.rnd(s),d:КС.rnd(s)<0.5?1:-1,life:0});
    while(s.фот.length>нужно+4) s.фот.shift();
    for(const f of s.фот){ f.x+=f.d*dt*6; if(f.x>5.1){ f.x=5.1; f.d=-1; } if(f.x<-5.1){ f.x=-5.1; f.d=1; } }
    for(const q of s.всп) q.t+=dt; s.всп=s.всп.filter(q=>q.t<0.6);
    for(const q of s.накачка) q.t+=dt; s.накачка=s.накачка.filter(q=>q.t<0.35);
    if(s.t>=60) s.__stop='Прошло 60 τ — режим давно установился';
  },
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
    {name:'Выше порога: луч есть, инверсия прилипла к порогу',values:{med:'hene',P:1.5,R:95}},
    {name:'Ниже порога: только спонтанное свечение',values:{med:'hene',P:0.15,R:95}},
    {name:'Прозрачное зеркало: генерации нет',values:{med:'ruby',P:3,R:60}},
    {name:'Почти глухое зеркало: низкий порог',values:{med:'nd',P:0.5,R:99.5}},
    {name:'Сильная накачка: пички при включении',values:{med:'ruby',P:4,R:90}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    const λ=this.λ[p.med], col=λ>750?'#c0392b':КС.цветλ(λ), N=this.Nth(p), out=s.n/this.tauC(p), outSS=Math.max(0.2,this.стац(p).out);
    // ---- резонатор
    КС.рамка(ctx,v,-6.25,0.9,12.5,4.05,`резонатор: ${this.имя[p.med]}, λ = ${λ} нм`);
    ctx.fillStyle=col; ctx.globalAlpha=.08; ctx.fillRect(-4.3,2.15,8.6,1.4); ctx.globalAlpha=1;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.strokeRect(-4.3,2.15,8.6,1.4);
    // зеркала
    ctx.fillStyle=ink; ctx.fillRect(-5.45,1.75,0.22,2.2);
    ctx.fillStyle=ink; ctx.globalAlpha=0.35+0.6*p.R/100; ctx.fillRect(5.23,1.75,0.12,2.2); ctx.globalAlpha=1;
    v.text(ctx,'100 %',-5.34,1.5,ink3,9); v.text(ctx,`R = ${p.R} %`,5.29,1.5,ink3,9);
    // накачка: вспышки снизу
    v.text(ctx,`накачка P = ${p.P}`,-5.9,1.2,ok,9,'left',true);
    for(const q of s.накачка){ ctx.strokeStyle=ok; ctx.globalAlpha=1-q.t/0.35; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(q.x,1.35); ctx.lineTo(q.x,q.y-0.15); ctx.stroke(); ctx.globalAlpha=1; }
    // атомы
    for(const a of s.ат){ if(a.up){ ctx.fillStyle=col; ctx.globalAlpha=.3; ctx.beginPath(); ctx.arc(a.x,a.y,0.2,0,7); ctx.fill(); ctx.globalAlpha=1; }
      КС.точка(ctx,v,a.x,a.y,a.up?5:4,a.up?dang:ink3); }
    // спонтанные фотоны — во все стороны
    for(const q of s.всп){ const d=0.2+q.t*3.5; ctx.strokeStyle=col; ctx.globalAlpha=1-q.t/0.6; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(q.x+(d-0.25)*Math.cos(q.a),q.y+(d-0.25)*Math.sin(q.a)); ctx.lineTo(q.x+d*Math.cos(q.a),q.y+d*Math.sin(q.a)); ctx.stroke(); ctx.globalAlpha=1; }
    // вынужденные фотоны — вдоль оси, в фазе
    for(const f of s.фот){ ctx.strokeStyle=col; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=12;i++){ const x=f.x-f.d*0.35*i/12, y=f.y+0.06*Math.sin(i*1.6+s.t*20); i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke(); }
    // выходной луч
    if(out>0.002){ const a=clamp(out/outSS,0.1,1); ctx.fillStyle=col; ctx.globalAlpha=0.25+0.6*a;
      ctx.fillRect(5.38,2.75-0.08-0.12*a,0.85,0.16+0.24*a); ctx.globalAlpha=1;
      v.text(ctx,'луч',5.8,3.3,col,10,'center',true); }
    v.text(ctx,'● возбуждён   ● в основном состоянии',-4.25,4.25,ink3,9,'left');
    КС.точка(ctx,v,-4.15,4.25,4,dang);
    // ---- схема уровней
    if(p.levels){
      const gx=-6.25, gy=-4.95, gw=6.1, gh=5.6;
      КС.рамка(ctx,v,gx,gy,gw,gh,'схема четырёх уровней');
      const Y={0:gy+0.6,1:gy+1.45,2:gy+3.4,3:gy+4.5}, x0=gx+0.4, x1=gx+2.6;
      for(const k of [0,1,2,3]){ ctx.strokeStyle=ink; ctx.lineWidth=v.lw(k===0?2.4:1.8); ctx.beginPath(); ctx.moveTo(x0,Y[k]); ctx.lineTo(x1,Y[k]); ctx.stroke(); }
      v.text(ctx,'E₃ полоса накачки',x1+0.1,Y[3],ink3,9,'left'); v.text(ctx,'E₂ верхний лазерный',x1+0.1,Y[2],ink,9,'left',true);
      v.text(ctx,'E₁ нижний лазерный',x1+0.1,Y[1],ink,9,'left',true); v.text(ctx,'E₀ основное',x1+0.1,Y[0],ink3,9,'left');
      v.arrow(ctx,x0+0.3,Y[0],x0+0.3,Y[3],ok); v.text(ctx,'накачка',x0+0.4,Y[0]+0.25,ok,9,'left');
      ctx.save(); ctx.setLineDash([v.lw(3),v.lw(3)]); v.arrow(ctx,x0+0.9,Y[3],x0+0.9,Y[2],ink3); v.arrow(ctx,x0+1.8,Y[1],x0+1.8,Y[0],ink3); ctx.restore();
      ctx.save(); ctx.lineWidth=v.lw(3); v.arrow(ctx,x0+1.35,Y[2],x0+1.35,Y[1],col); ctx.restore();
      v.text(ctx,'лазерный переход',x0+1.45,(Y[1]+Y[2])/2,col,9,'left',true);
      // заселённости полосками
      const bar=(k,f,c)=>{ ctx.fillStyle=c; ctx.globalAlpha=.55; ctx.fillRect(x0,Y[k]-0.09,Math.max(0.02,(x1-x0)*f),0.18); ctx.globalAlpha=1; };
      bar(2,s.N2,dang); bar(1,0,dang); bar(0,1-s.N2,ink3);
      v.text(ctx,`N₂ = ${s.N2.toFixed(2)} > N₁ ≈ 0: инверсия`,gx+gw/2,gy+0.2,s.N2>0.01?dang:ink3,10,'center',true);
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
      const порог=N<1;
      v.text(ctx,!порог?'потери больше любого усиления:':(G>=L*0.98?'усиление = потери:':'усиление < потерь:'),gx+gw/2,gy+2.45,G>=L*0.98&&порог?ok:dang,10,'center',true);
      v.text(ctx,!порог?'генерации не будет':(G>=L*0.98?'генерация идёт':'луча нет'),gx+gw/2,gy+2.1,G>=L*0.98&&порог?ok:dang,10,'center',true);
      v.text(ctx,'выше порога усиление держится ровно',gx+gw/2,gy+1.3,ink3,9,'center');
      v.text(ctx,'на уровне потерь, а лишняя накачка',gx+gw/2,gy+0.95,ink3,9,'center');
      v.text(ctx,'уходит в луч',gx+gw/2,gy+0.6,ink3,9,'center');
    }
  }
}
});
