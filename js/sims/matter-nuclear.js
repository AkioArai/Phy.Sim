'use strict';
Object.assign(SIMS,{
/* crystal и fermi — в matter-scenes.js (3.2.0) */

/* ================= ГЛ.28: ЗОННАЯ ТЕОРИЯ И ПОЛУПРОВОДНИКИ ================= */
bands:{
  hudAware:true,
  title:'Зонная теория: металл, полупроводник, диэлектрик',
  /* Сцена — зонная диаграмма: по вертикали энергия. Поэтому ни осей с
     числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'mat',label:'Материал',type:'select',default:'si',
     options:[{v:'metal',t:'Металл (медь)'},{v:'ge',t:'Германий, Eg = 0,67 эВ'},
              {v:'si',t:'Кремний, Eg = 1,12 эВ'},{v:'gaas',t:'Арсенид галлия, Eg = 1,42 эВ'},
              {v:'diamond',t:'Алмаз, Eg = 5,5 эВ'}]},
    {key:'dope',label:'Примесь',type:'select',default:'none',
     options:[{v:'none',t:'Чистый (собственный)'},{v:'n',t:'n-тип (донорная)'},{v:'p',t:'p-тип (акцепторная)'}]},
    {key:'T',label:'Температура T',unit:'К',min:50,max:800,step:10,default:300},

    {type:'group',label:'Показывать'},
    {key:'carriers',label:'Носители заряда',type:'check',default:true},
    {key:'curve',   label:'Зависимость проводимости от T',type:'check',default:true}
  ],
  kB:1.380649e-23, e:1.602176634e-19,
  gap:{metal:0, ge:0.67, si:1.12, gaas:1.42, diamond:5.5},
  ruName:{metal:'медь',ge:'германий',si:'кремний',gaas:'арсенид галлия',diamond:'алмаз'},
  Eg(p){ return this.gap[p.mat]; },
  kT(p){ return this.kB*p.T/this.e; },
  /* собственная концентрация носителей ∝ exp(−Eg/2kT) */
  ni(p){
    if(p.mat==='metal') return 1;
    return Math.exp(-this.Eg(p)/(2*this.kT(p)));
  },
  /* качественная проводимость: у металла падает с T, у полупроводника растёт */
  sigma(p){
    if(p.mat==='metal') return 300/p.T;
    let base=this.ni(p);
    if(p.dope!=='none') base+=1e-6;                 // примесные носители есть и при низкой T
    return base;
  },
  kind(p){
    if(p.mat==='metal') return 'проводник: зоны перекрываются, электроны свободны';
    if(this.Eg(p)>3) return 'диэлектрик: щель слишком широка, носителей нет';
    return 'полупроводник: щель узкая, тепло забрасывает электроны наверх';
  },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const out=[['материал',0,this.ruName[p.mat]],
      ['ширина запрещённой зоны Eg',this.Eg(p),'эВ'],
      ['температура T',p.T,'К'],
      ['тепловая энергия kT',this.kT(p),'эВ'],
      ['отношение Eg/kT',p.mat==='metal'?0:this.Eg(p)/this.kT(p),''],
      ['тип',0,this.kind(p)]];
    if(p.mat!=='metal'){
      out.push(['относительная концентрация носителей',this.ni(p),'~exp(−Eg/2kT)'],
        ['примесь',0,{none:'нет',n:'донорная: лишние электроны',p:'акцепторная: дырки'}[p.dope]],
        ['основные носители',0,p.dope==='n'?'электроны':(p.dope==='p'?'дырки':'поровну электронов и дырок')],
        ['проводимость при нагреве',0,'РАСТЁТ']);
    } else {
      out.push(['проводимость при нагреве',0,'ПАДАЕТ: мешают колебания решётки']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Кремний при комнатной температуре',values:{mat:'si',dope:'none',T:300}},
    {name:'Кремний нагретый — носителей больше',values:{mat:'si',dope:'none',T:600}},
    {name:'Кремний n-типа',values:{mat:'si',dope:'n',T:300}},
    {name:'Кремний p-типа',values:{mat:'si',dope:'p',T:300}},
    {name:'Германий: щель уже',values:{mat:'ge',dope:'none',T:300}},
    {name:'Алмаз: диэлектрик',values:{mat:'diamond',dope:'none',T:300}},
    {name:'Металл: зоны перекрыты',values:{mat:'metal',dope:'none',T:300}}
  ],
  /* 3.4.0: две панели — зоны и проводимость от температуры */
  fit(p,vp){ return КС.fitBox(vp,12.8,10,0,0); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const Eg=this.Eg(p), metal=(p.mat==='metal');
    // ---- 1. зонная схема
    {
      const px=-6.3, py=-4.9, pw=6.3, ph=9.8;
      КС.рамка(ctx,v,px,py,pw,ph,'энергетические зоны');
      const bx=px+0.35, bw=4.1, cy=py+4.9, BH=1.9;
      const gapH=metal? 0 : clamp(Eg*0.55,0.3,2.6);
      const vTop=cy-gapH/2, cBot=cy+gapH/2+(metal?-0.5:0);
      ctx.fillStyle=acc; ctx.globalAlpha=.3; ctx.fillRect(bx,vTop-BH,bw,BH); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.4); ctx.strokeRect(bx,vTop-BH,bw,BH);
      v.text(ctx,'валентная',bx+bw+0.12,vTop-BH/2+0.17,acc,10,'left',true);
      v.text(ctx,'(полна)',bx+bw+0.12,vTop-BH/2-0.17,acc,9.5,'left');
      ctx.fillStyle=meas; ctx.globalAlpha=.16; ctx.fillRect(bx,cBot,bw,BH); ctx.globalAlpha=1;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.4); ctx.strokeRect(bx,cBot,bw,BH);
      v.text(ctx,'зона',bx+bw+0.12,cBot+BH/2+0.34,meas,10,'left',true);
      v.text(ctx,'проводи-',bx+bw+0.12,cBot+BH/2,meas,10,'left',true);
      v.text(ctx,'мости',bx+bw+0.12,cBot+BH/2-0.34,meas,10,'left',true);
      if(!metal){
        ctx.fillStyle=ink3; ctx.globalAlpha=.1; ctx.fillRect(bx,vTop,bw,gapH); ctx.globalAlpha=1;
        v.arrow(ctx,bx+0.5,vTop,bx+0.5,cBot,dang);
        v.text(ctx,`Eg = ${Eg} эВ`,bx+0.7,cy,dang,10,'left',true);
        v.text(ctx,'щель',bx+bw+0.12,cy,ink3,9.5,'left');
      } else v.text(ctx,'зоны перекрываются — щели нет',bx+bw/2,cBot+0.25,dang,9.5,'center',true);
      // примесные уровни
      if(!metal && p.dope!=='none'){
        const y=(p.dope==='n')? cBot-0.25 : vTop+0.25;
        ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.6); ctx.setLineDash([v.lw(4),v.lw(3)]);
        for(let i=0;i<4;i++){ const x=bx+1.5+i*0.65; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+0.4,y); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      // носители
      if(p.carriers){
        const nrel=metal? 1 : this.ni(p);
        const nEl=metal? 10 : clamp(Math.round(nrel*4e6),0,9) + (p.dope==='n'?4:0);
        const nHole=metal? 0 : clamp(Math.round(nrel*4e6),0,9) + (p.dope==='p'?4:0);
        ctx.fillStyle=meas;
        for(let i=0;i<nEl;i++){ const x=bx+0.3+((i*0.44+s.ph*0.25)%(bw-0.6)), y=cBot+0.35+((i*0.31)%(BH-0.7));
          ctx.beginPath(); ctx.arc(x,y,v.lw(3),0,7); ctx.fill(); }
        ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.6);
        for(let i=0;i<nHole;i++){ const x=bx+0.3+((i*0.44+s.ph*0.18)%(bw-0.6)), y=vTop-0.35-((i*0.29)%(BH-0.7));
          ctx.beginPath(); ctx.arc(x,y,v.lw(3),0,7); ctx.stroke(); }
        v.text(ctx,`● электронов вверху: ${nEl}`,px+0.35,py+1.35,meas,10,'left',true);
        v.text(ctx,`○ дырок внизу: ${nHole}`,px+0.35,py+1.0,dang,10,'left',true);
      }
      if(!metal && p.dope!=='none')
        v.text(ctx,p.dope==='n'?'- - донорные уровни: под зоной проводимости':'- - акцепторные уровни: над валентной',px+0.35,py+0.6,sec,9.5,'left');
    }
    // ---- 2. проводимость от температуры
    if(p.curve){
      const px=0.2, py=-4.9, pw=6.1, ph=9.8;
      КС.рамка(ctx,v,px,py,pw,ph,'проводимость от температуры');
      const gx=px+0.5, gy=py+3.2, gw2=pw-0.9, gh=ph-4.2;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw2,gy); ctx.stroke(); ctx.globalAlpha=1;
      v.text(ctx,'σ',gx+0.12,gy+gh,ink3,10,'left',true);
      v.text(ctx,'T, К →',gx+gw2,gy-0.25,ink3,9.5,'right');
      for(const T of [300,600]) v.text(ctx,String(T),gx+gw2*(T-50)/750,gy-0.25,ink3,9,'center');
      const vals=[];
      for(let i=0;i<=100;i++){ const T=50+i*7.5; vals.push(this.sigma(Object.assign({}, p, {T}))); }
      const mx=Math.max(...vals)||1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2); ctx.beginPath();
      vals.forEach((val,i)=>{ const x=gx+gw2*i/100, y=gy+gh*0.9*(val/mx); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
      ctx.stroke();
      const idx=clamp(Math.round((p.T-50)/7.5),0,100);
      КС.точка(ctx,v,gx+gw2*idx/100, gy+gh*0.9*(vals[idx]/mx),3.6,meas);
      let y=КС.абзац(ctx,v,metal?'У металла проводимость ПАДАЕТ с нагревом: электроны рассеиваются на колебаниях решётки.'
        :'У полупроводника проводимость РАСТЁТ с нагревом: тепло забрасывает электроны через щель.',px+0.3,py+2.35,pw-0.6,metal?dang:acc,9.5);
      КС.абзац(ctx,v,this.kind(p),px+0.3,y-0.1,pw-0.6,ink3,9.5);
    }
  }
}
,

/* ================== ГЛ.29: РАЗМЕРЫ И СТРОЕНИЕ ЯДЕР ================= */
nucleus:{
  title:'Ядро: размеры и состав',
  hudAware:true,
  /* Сцена — ядро в условном масштабе: настоящий радиус в фемтометрах.
     Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'A',label:'Массовое число A',min:1,max:238,step:1,default:56},
    {key:'Z',label:'Число протонов Z',min:1,max:92,step:1,default:26},

    {type:'group',label:'Показывать'},
    {key:'balls',label:'Нуклоны',type:'check',default:true},
    {key:'map',  label:'Карта стабильных ядер',type:'check',default:true}
  ],
  R0:1.2, u:1.66053907e-27,                     // фм и кг
  N(p){ return Math.max(0,p.A-p.Z); },
  /* радиус ядра: R = R₀·A^(1/3) */
  R(p){ return this.R0*Math.pow(p.A,1/3); },    // фм
  volume(p){ const R=this.R(p)*1e-15; return 4/3*Math.PI*R*R*R; },
  /* плотность ядерного вещества — одинакова у всех ядер */
  density(p){ return p.A*this.u/this.volume(p); },
  /* линия стабильности: у лёгких N≈Z, у тяжёлых нейтронов больше */
  stableZ(A){ return A/(1.98+0.0155*Math.pow(A,2/3)); },
  stable(p){ return Math.abs(p.Z-this.stableZ(p.A))<Math.max(1.2,p.A*0.022); },
  ratio(p){ return this.N(p)/Math.max(p.Z,1); },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    return [['массовое число A',p.A,''],
      ['протонов Z',Math.min(p.Z,p.A),''],
      ['нейтронов N = A − Z',this.N(p),''],
      ['отношение N/Z',this.ratio(p),''],
      ['радиус R = R₀·∛A',this.R(p),'фм'],
      ['R₀',this.R0,'фм'],
      ['объём',this.volume(p),'м³'],
      ['плотность ядерного вещества',this.density(p),'кг/м³'],
      ['плотность одинакова у всех ядер',1,'~2,3·10¹⁷ кг/м³'],
      ['ближе всего к стабильности Z ≈',this.stableZ(p.A),''],
      ['устойчиво ли',this.stable(p)?1:0,this.stable(p)?'да, вблизи линии стабильности':'нет — такое ядро распадётся']];
  },
  graphs:[],
  presets:[
    {name:'Гелий-4',values:{A:4,Z:2}},
    {name:'Железо-56 — самое прочное',values:{A:56,Z:26}},
    {name:'Свинец-208',values:{A:208,Z:82}},
    {name:'Уран-238',values:{A:238,Z:92}},
    {name:'Нестабильное ядро: слишком мало нейтронов',values:{A:238,Z:60}}
  ],
  /* 3.4.0: две панели — ядро и карта N–Z; подписи внутри панелей */
  fit(p,vp){ return КС.fitBox(vp,12.8,10,0,0); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const Z=Math.min(p.Z,p.A), N=this.N(p), уст=this.stable(p);
    // ---- 1. ядро
    {
      const bx=-6.3, by=-4.2, bw=6.1, bh=9.1, CX=bx+bw/2, CY=by+4.9;
      КС.рамка(ctx,v,bx,by,bw,bh,`ядро: A = ${p.A}`);
      const Rvis=0.52*Math.pow(p.A,1/3)*Math.min(1,2.75/(0.52*Math.pow(238,1/3)));
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.arc(CX,CY,Rvis,0,7); ctx.stroke(); ctx.globalAlpha=1;
      if(p.balls){
        /* спираль с золотым углом равномерно заполняет круг; протоны и
           нейтроны перемешаны, как в настоящем ядре (раньше протоны сидели
           в центре, а нейтроны — «шубой» снаружи) */
        const tot=Math.min(p.A,238);
        const rN=clamp(Rvis*Math.sqrt(0.5/Math.max(tot,1)), Rvis*0.028, Rvis*0.34);
        for(let i=0;i<tot;i++){
          const t=(i+0.5)/tot, rr=(Rvis-rN)*Math.sqrt(t), a=i*2.39996+s.ph*0.15;
          ctx.fillStyle=((i*61)%tot)<Z?dang:meas; ctx.globalAlpha=.92;
          ctx.beginPath(); ctx.arc(CX+rr*Math.cos(a),CY+rr*Math.sin(a),rN,0,7); ctx.fill();
        }
        ctx.globalAlpha=1;
      }
      v.text(ctx,`● протонов Z = ${Z}`,bx+0.3,by+2.05,dang,10,'left',true);
      v.text(ctx,`● нейтронов N = ${N}`,bx+0.3,by+1.7,meas,10,'left',true);
      v.text(ctx,`R = R₀·∛A = ${this.R(p).toFixed(2)} фм`,bx+0.3,by+1.3,ink,10,'left');
      КС.абзац(ctx,v,`плотность ${числоНаСцене(this.density(p),3)} кг/м³ — одна у всех ядер: нуклоны уложены плотно, как в капле`,bx+0.3,by+0.85,bw-0.6,ink3,9.5);
    }
    // ---- 2. карта стабильности N–Z
    if(p.map){
      const bx=0.1, by=-4.2, bw=6.2, bh=9.1;
      КС.рамка(ctx,v,bx,by,bw,bh,'где ядра устойчивы');
      const gx=bx+0.75, gy=by+1.9, gw=bw-1.1, gh=bh-2.75;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      const X=n=>gx+gw*clamp(n/175,0,1), Y=z=>gy+gh*clamp(z/100,0,1);
      v.text(ctx,'N →',gx+gw,gy-0.25,ink3,9.5,'right'); v.text(ctx,'Z ↑',gx+0.15,gy+gh+0.05,ink3,9.5,'left');
      for(const n of [50,100,150]) v.text(ctx,String(n),X(n),gy-0.25,ink3,9,'center');
      for(const z of [50]) v.text(ctx,String(z),gx-0.1,Y(z),ink3,9,'right');
      // линия N = Z
      КС.пунктир(ctx,v,X(0),Y(0),X(100),Y(100),ink3,.45);
      v.text(ctx,'N = Z',X(88),Y(96),ink3,9.5,'left');
      // долина стабильности — полоса, а не нить
      ctx.fillStyle=acc; ctx.globalAlpha=.14; ctx.beginPath();
      for(let A=2;A<=250;A+=4){ const z=this.stableZ(A), w=Math.max(1.2,A*0.022); A===2?ctx.moveTo(X(A-z-w),Y(z+w)):ctx.lineTo(X(A-z-w),Y(z+w)); }
      for(let A=250;A>=2;A-=4){ const z=this.stableZ(A), w=Math.max(1.2,A*0.022); ctx.lineTo(X(A-z+w),Y(z-w)); }
      ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let A=2;A<=250;A+=2){ const z=this.stableZ(A), x=X(A-z), y=Y(z); A===2?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      ctx.stroke();
      // знакомые ядра — ориентиры
      for(const [nm,A,z] of [['⁴He',4,2],['⁵⁶Fe',56,26],['²⁰⁸Pb',208,82],['²³⁸U',238,92]]){
        КС.точка(ctx,v,X(A-z),Y(z),2.4,ink3); v.text(ctx,nm,X(A-z)+0.1,Y(z)-0.2,ink3,9,'left'); }
      // текущее ядро
      КС.точка(ctx,v,X(N),Y(Z),5,уст?meas:dang);
      v.text(ctx,уст?'устойчиво':'распадётся',X(N)-0.15,Y(Z)+0.25,уст?meas:dang,10,'right',true);
      КС.абзац(ctx,v,'полоса вдоль кривой — устойчивые ядра; у тяжёлых нейтронов больше, чем протонов',bx+0.3,by+1.05,bw-0.6,ink3,9.5);
    }
  }
},

/* binding — в matter-scenes.js (3.2.0) */

/* ================= ГЛ.29: РАДИОАКТИВНЫЙ РАСПАД ================= */
decay:{
  title:'Радиоактивный распад: закон и виды',
  hudAware:true,
  /* Сцена — схема превращения и кривая распада. Поэтому ни осей с числами,
     ни надписи «сетка N м». */
  schema:true,
  params:[
    {key:'type',label:'Вид распада',type:'select',default:'alpha',
     options:[{v:'alpha',t:'Альфа-распад'},{v:'beta',t:'Бета-минус распад'},{v:'gamma',t:'Гамма-излучение'}]},
    {key:'A',label:'Массовое число A',min:4,max:238,step:1,default:238},
    {key:'Z',label:'Заряд Z',min:2,max:92,step:1,default:92},
    {key:'half',label:'Период полураспада T½',unit:'с',min:0.5,max:60,step:0.5,default:10},

    {type:'group',label:'Показывать'},
    {key:'curve',label:'Кривая распада',type:'check',default:true},
    {key:'atoms',label:'Ядра в образце',type:'check',default:true}
  ],
  /* постоянная распада: λ = ln2 / T½ */
  lam(p){ return Math.LN2/p.half; },
  /* закон радиоактивного распада: N = N₀·e^(−λt) */
  frac(p,t){ return Math.exp(-this.lam(p)*t); },
  halves(p,t){ return t/p.half; },
  /* среднее время жизни τ = 1/λ */
  tau(p){ return 1/this.lam(p); },
  /* что получается после распада */
  product(p){
    if(p.type==='alpha') return {A:p.A-4, Z:p.Z-2, emitted:'ядро гелия (α-частица)'};
    if(p.type==='beta')  return {A:p.A,   Z:p.Z+1, emitted:'электрон и антинейтрино'};
    return {A:p.A, Z:p.Z, emitted:'гамма-квант (состав не меняется)'};
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const f=this.frac(p,s.t), pr=this.product(p);
    return [['t',s.t,'с'],
      ['вид распада',0,{alpha:'альфа',beta:'бета-минус',gamma:'гамма'}[p.type]],
      ['исходное ядро',0,`A = ${p.A}, Z = ${p.Z}`],
      ['после распада',0,`A = ${pr.A}, Z = ${pr.Z}`],
      ['вылетает',0,pr.emitted],
      ['период полураспада T½',p.half,'с'],
      ['постоянная распада λ = ln2/T½',this.lam(p),'1/с'],
      ['среднее время жизни τ = 1/λ',this.tau(p),'с'],
      ['прошло периодов полураспада',this.halves(p,s.t),''],
      ['осталось ядер',f*100,'%'],
      ['распалось',(1-f)*100,'%'],
      ['через один период останется',50,'%'],
      ['через два периода',25,'%'],
      ['через три периода',12.5,'%']];
  },
  graphs:[
    {label:'Доля оставшихся ядер',unit:'%',series:['N/N₀'],get(s,p){ return [SIMS.decay.frac(p,s.t)*100,null]; }},
    {label:'Активность',unit:'отн.',series:['A'],get(s,p){ return [SIMS.decay.lam(p)*SIMS.decay.frac(p,s.t),null]; }}
  ],
  presets:[
    {name:'Альфа-распад урана-238',values:{type:'alpha',A:238,Z:92,half:10}},
    {name:'Бета-распад: нейтрон стал протоном',values:{type:'beta',A:14,Z:6,half:10}},
    {name:'Гамма-излучение: состав не меняется',values:{type:'gamma',A:60,Z:27,half:10}},
    {name:'Короткий период полураспада',values:{type:'alpha',A:238,Z:92,half:2}},
    {name:'Долгий период полураспада',values:{type:'alpha',A:238,Z:92,half:40}}
  ],
  /* 3.4.0: три панели в мировых координатах вместо подписей с пиксельными
     сдвигами (в узком окне они наезжали на кривую и на образец). Сверху —
     живое превращение ядра, слева — кривая, справа — образец, где
     только что распавшиеся ядра вспыхивают. */
  fit(p,vp){ return КС.fitBox(vp,12.8,10.4,0,0); },
  /* ядро — шарик из нуклонов (протоны — красные, нейтроны — серые) */
  ядро(ctx,v,x,y,A,Z,R){
    const n=clamp(Math.round(Math.sqrt(A)*2.2),4,36), rn=R/Math.sqrt(n)*0.95;
    for(let i=0;i<n;i++){ const r=R*Math.sqrt((i+0.5)/n)*0.92, a=i*2.39996;
      ctx.fillStyle=((i*37)%n)<n*Z/A?v.c('--danger'):v.c('--ink-3');
      ctx.beginPath(); ctx.arc(x+r*Math.cos(a),y+r*Math.sin(a),rn,0,7); ctx.fill(); }
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const f=this.frac(p,s.t), pr=this.product(p);
    // ---- 1. превращение ядра
    {
      const bx=-6.3, by=1.55, bw=12.6, bh=3.55, CY=by+1.85, x1=-4.6, x2=-1.2, R=0.62;
      КС.рамка(ctx,v,bx,by,bw,bh,'что происходит с ядром');
      this.ядро(ctx,v,x1,CY,p.A,p.Z,R);
      v.text(ctx,`A = ${p.A}, Z = ${p.Z}`,x1,CY-R-0.3,ink,10,'center',true);
      v.arrow(ctx,x1+R+0.2,CY,x2-R-0.2,CY,ink3);
      this.ядро(ctx,v,x2,CY,pr.A,pr.Z,R*Math.cbrt(pr.A/p.A));
      v.text(ctx,`A = ${pr.A}, Z = ${pr.Z}`,x2,CY-R-0.3,acc,10,'center',true);
      // вылетающая частица: каждые 2,4 с — новая
      const u=((s.t%2.4)+2.4)%2.4/2.4, d=0.7+u*1.5, dir=0.35, px=x2+d*Math.cos(dir), py=CY+d*Math.sin(dir)*0.6;
      if(p.type==='alpha'){
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([i,j],k)=>{ ctx.fillStyle=k%3?ink3:dang; ctx.beginPath(); ctx.arc(px+i*0.1,py+j*0.1,0.1,0,7); ctx.fill(); });
        v.text(ctx,'α',px+0.25,py+0.3,meas,11,'left',true);
      } else if(p.type==='beta'){
        КС.точка(ctx,v,px,py,4,meas); v.text(ctx,'e⁻',px+0.18,py+0.22,meas,10,'left',true);
        const nx=x2+d*Math.cos(-0.35)*0.9, ny=CY+d*Math.sin(-0.35)*0.6;
        ctx.globalAlpha=.55; КС.точка(ctx,v,nx,ny,3,ink3); ctx.globalAlpha=1; v.text(ctx,'ν̄',nx+0.18,ny-0.2,ink3,10,'left');
      } else {
        v.photon(ctx,px,py,dir*0.6,{len:1.3,lam:0.22,amp:0.1,phase:s.t*12,color:sec,lw:1.8});
        v.text(ctx,'γ',px+0.2,py+0.25,sec,11,'left',true);
      }
      const пояс={alpha:['α-распад: A уменьшается на 4, Z — на 2','ядро выбрасывает ядро гелия'],
        beta:['β⁻-распад: A тот же, Z больше на 1','нейтрон в ядре стал протоном и выпустил e⁻ и ν̄'],
        gamma:['γ-излучение: A и Z не меняются','ядро сбрасывает лишнюю энергию квантом']}[p.type];
      let y=КС.абзац(ctx,v,пояс[0],1.0,by+bh-0.75,5.1,ink,10,'left',true);
      КС.абзац(ctx,v,пояс[1],1.0,y-0.05,5.1,ink3,10);
      v.text(ctx,'N = N₀·e^(−λt)',1.0,by+0.75,acc,10,'left',true);
      v.text(ctx,`λ = ln2/T½ = ${this.lam(p).toFixed(4)} 1/с`,1.0,by+0.4,acc,10,'left',true);
    }
    // ---- 2. кривая распада
    if(p.curve){
      const bx=-6.3, by=-5.1, bw=6.2, bh=6.45;
      КС.рамка(ctx,v,bx,by,bw,bh,'сколько ядер осталось');
      const gx=bx+0.95, gy=by+0.85, gw=bw-1.3, gh=bh-1.85, Tmax=p.half*5;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      v.text(ctx,'N/N₀',gx+0.1,gy+gh+0.22,ink3,9.5,'left');
      v.text(ctx,'время →',gx+gw,gy-0.55,ink3,9.5,'right');
      const X=t=>gx+gw*clamp(t/Tmax,0,1), Y=fr=>gy+gh*fr;
      v.text(ctx,'100%',gx-0.1,Y(1),ink3,9,'right');
      for(let k=1;k<=4;k++){
        const t=k*p.half, fr=Math.pow(0.5,k);
        КС.пунктир(ctx,v,X(t),gy,X(t),Y(fr),ink3); КС.пунктир(ctx,v,gx,Y(fr),X(t),Y(fr),ink3);
        v.text(ctx,`${k}T½`,X(t),gy-0.25,ink3,9,'center');
        if(k<=3) v.text(ctx,`${fr*100}%`,gx-0.1,Y(fr),ink3,9,'right');
      }
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=200;i++){ const t=Tmax*i/200; i?ctx.lineTo(X(t),Y(this.frac(p,t))):ctx.moveTo(X(t),Y(this.frac(p,t))); }
      ctx.stroke();
      const tx=X(Math.min(s.t,Tmax));
      КС.точка(ctx,v,tx,Y(f),4.5,dang);
      v.text(ctx,`${(f*100).toFixed(1)} %`,tx+0.15,Y(f)+0.25,dang,10,'left',true);
      v.text(ctx,'каждый T½ — вдвое меньше',bx+bw-0.2,by+bh-0.75,ink3,9.5,'right');
    }
    // ---- 3. образец: 81 ядро, только что распавшиеся вспыхивают
    if(p.atoms){
      const bx=0.1, by=-5.1, bw=6.2, bh=6.45, cols=9, rows=9, stp=0.46, x0=bx+1.2, y0=by+1.55;
      КС.рамка(ctx,v,bx,by,bw,bh,'образец: 81 ядро');
      const fPrev=this.frac(p,Math.max(0,s.t-0.35));
      let живых=0;
      for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){
        const idx=i*rows+j, seed=((idx*2654435761)%81)/81, alive=seed<f;
        const x=x0+i*stp, y=y0+j*stp, r=v.lw(4);
        if(alive){ живых++; ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); }
        else {
          ctx.strokeStyle=ink3; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1.2);
          ctx.beginPath(); ctx.arc(x,y,r*0.85,0,7); ctx.stroke(); ctx.globalAlpha=1;
          if(seed<fPrev){ const q=(fPrev-seed)/Math.max(1e-6,fPrev-f);   // распалось только что
            ctx.strokeStyle=meas; ctx.globalAlpha=0.9*(1-q*0.5); ctx.lineWidth=v.lw(2);
            ctx.beginPath(); ctx.arc(x,y,r*(1.3+q),0,7); ctx.stroke(); ctx.globalAlpha=1; }
        }
      }
      v.text(ctx,`осталось ${живых} из ${cols*rows}`,bx+bw/2,by+0.95,dang,10,'center',true);
      v.text(ctx,'какое ядро — случай, доля — закон',bx+bw/2,by+0.55,ink3,9.5,'center');
    }
  }
}
,

/* ================== ГЛ.31: ЧЕТЫРЕ ФУНДАМЕНТАЛЬНЫХ ВЗАИМОДЕЙСТВИЯ ================= */
forces:{
  title:'Четыре взаимодействия и слабый распад',
  hudAware:true,
  /* Сцена — схема взаимодействий и график, а не пространство. Поэтому ни
     осей с числами, ни надписи «сетка N м». */
  schema:true,
  params:[
    {key:'mode',label:'Что показываем',type:'select',default:'decay',
     options:[{v:'decay',t:'Слабый распад: живой ансамбль нейтронов'},
              {v:'compare',t:'Четыре силы: кто побеждает на каком расстоянии'}]},

    {type:'group',label:'Распад нейтрона'},
    {key:'N',    label:'Сколько нейтронов в начале',min:20,max:2000,step:20,default:400},
    {key:'boost',label:'Ускорение времени распада',unit:'×',min:1,max:600,step:1,default:120},
    {key:'spec', label:'Спектр энергий электрона',type:'check',default:true},
    {key:'curve',label:'Кривая N(t) и теория',type:'check',default:true},
    {key:'vec',  label:'Импульсы разлёта в последнем распаде',type:'check',default:true},

    {type:'group',label:'Сравнение сил'},
    {key:'logr', label:'Расстояние между двумя протонами: показатель степени',
     unit:'(r = 10^x м)',min:-19,max:0,step:0.1,default:-18},
    {key:'names',label:'Подписи кривых',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],

  /* ---------- СЛАБЫЙ РАСПАД: n → p + e⁻ + ν̄ₑ ----------
     Массы покоя в МэВ. Разность масс нейтрона и протона уходит на массу
     электрона и на кинетическую энергию, которую делят между собой электрон и
     антинейтрино. */
  mn:939.56542, mp:938.27209, me:0.51099895,
  halfLife:611,                                   // период полураспада свободного нейтрона, с
  Q(){ return this.mn-this.mp-this.me; },         // 0.782 МэВ — вся доступная кинетическая энергия
  /* Форма бета-спектра (Ферми, без кулоновской поправки):
         S(T) ∝ p·E·(Q−T)²,   E = T + mₑ,  p = √(T² + 2Tmₑ).
     Именно ЭТА непрерывность и заставила Паули в 1930 году придумать
     нейтрино: в распаде на две частицы энергия электрона была бы одна и та
     же, а опыт давал размазанный спектр. */
  spec(T){
    const Q=this.Q(); if(T<=0||T>=Q) return 0;
    const E=T+this.me, pc=Math.sqrt(T*(T+2*this.me));
    return pc*E*(Q-T)*(Q-T);
  },
  specMax(){
    if(this._sm) return this._sm;
    let m=0; const Q=this.Q();
    for(let i=1;i<400;i++) m=Math.max(m,this.spec(Q*i/400));
    return this._sm=m;
  },
  /* Разыгрываем энергию электрона по спектру методом отбора. */
  drawT(){
    const Q=this.Q(), M=this.specMax();
    for(let i=0;i<200;i++){
      const T=Math.random()*Q;
      if(Math.random()*M<=this.spec(T)) return T;
    }
    return Q/3;
  },

  /* ---------- ЧЕТЫРЕ СИЛЫ между двумя протонами ----------
     Считаем настоящие силы в ньютонах, а не «условные единицы».
       электромагнитная  F = k e²/r²                     — дальнодействующая;
       гравитационная    F = G mₚ²/r²                    — дальнодействующая;
       сильная (Юкава)   F ≈ A e^(−r/r₀)/r², r₀ ≈ 1.4 фм — обрывается за ядром;
       слабая            F ≈ B e^(−r/r_w)/r², r_w ≈ 0.0025 фм — обрывается сразу.
     Экспоненты — это и есть «конечный радиус действия»: переносчик массивный,
     поэтому за своим комптоновским размером сила гаснет как e^(−r/r₀). */
  KE2:2.307e-28,                                  // k·e², Н·м²
  GM2:1.867e-64,                                  // G·mₚ², Н·м²
  R0:1.4e-15, RW:2.5e-18,
  A(){ return 100*this.KE2; },                    // сильное ≈ в 100 раз сильнее кулона на 1 фм
  B(){ return 1e-6*this.A(); },                   // слабое ≈ 10⁻⁶ от сильного
  F(kind,r){
    if(!(r>0)) return NaN;
    switch(kind){
      case 'em':     return this.KE2/(r*r);
      case 'grav':   return this.GM2/(r*r);
      case 'strong': return this.A()*Math.exp(-r/this.R0)/(r*r);
      case 'weak':   return this.B()*Math.exp(-r/this.RW)/(r*r);
    }
    return NaN;
  },
  /* Десятичный логарифм той же силы. Нужен там, где сама сила не помещается
     в double: exp(−r/R₀) при r ≫ R₀ обнуляется, а lg остаётся конечным. */
  lgF(kind,r){
    if(!(r>0)) return NaN;
    const L=Math.LN10, lr2=2*Math.log10(r);
    switch(kind){
      case 'em':     return Math.log10(this.KE2)-lr2;
      case 'grav':   return Math.log10(this.GM2)-lr2;
      case 'strong': return Math.log10(this.A())-r/this.R0/L-lr2;
      case 'weak':   return Math.log10(this.B())-r/this.RW/L-lr2;
    }
    return NaN;
  },
  KINDS:['strong','em','weak','grav'],
  INFO:{
    strong:{name:'сильное',        range:'≈10⁻¹⁵ м — размер ядра', carrier:'глюоны',
            acts:'кварки и нуклоны',        role:'держит ядро от развала'},
    em:    {name:'электромагнитное',range:'бесконечный',           carrier:'фотон',
            acts:'все заряженные частицы',  role:'держит атомы и молекулы'},
    weak:  {name:'слабое',          range:'≈10⁻¹⁸ м',              carrier:'W- и Z-бозоны',
            acts:'все частицы, включая нейтрино', role:'отвечает за бета-распад'},
    grav:  {name:'гравитационное',  range:'бесконечный',           carrier:'не обнаружен',
            acts:'всё, что имеет энергию',  role:'правит звёздами и галактиками'}
  },

  init(p){
    const nu=[];
    for(let i=0;i<p.N;i++) nu.push({x:Math.random(),y:Math.random(),alive:true,tp:0});
    return {t:0, nu, left:p.N, decayed:0, hist:new Array(40).fill(0),
            sumT:0, last:null, flash:0, trace:[[0,p.N]], event:null, __stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
    if(p.mode!=='decay') return;
    if(s.nu.length!==p.N){ Object.assign(s,this.init(p)); s.t=t; return; }
    s.flash=Math.max(0,s.flash-dt*2.5);
    /* Радиоактивный распад: за время dt каждый уцелевший нейтрон распадается с
       вероятностью λ·dt, λ = ln2/T½. Никакого «расписания» — только случай,
       и всё равно получается ровная экспонента. */
    const lam=Math.LN2/this.halfLife*p.boost;
    const pd=1-Math.exp(-lam*dt);
    const Q=this.Q(), nb=s.hist.length;
    for(const q of s.nu){
      if(!q.alive||Math.random()>pd) continue;
      q.alive=false; q.tp=s.t;
      s.left--; s.decayed++;
      const T=this.drawT();                       // кинетическая энергия электрона
      s.sumT+=T;
      s.hist[Math.min(nb-1,Math.floor(T/Q*nb))]++;
      /* Импульсы. Отдачей протона (меньше килоэлектронвольта) пренебрегаем:
         электрон и антинейтрино делят импульс, а протон забирает остаток. */
      const pe=Math.sqrt(T*(T+2*this.me));         // МэВ/c
      const pv=Q-T;                                // нейтрино безмассово: p = E
      const ang=Math.random()*2*Math.PI, rel=Math.random()*2*Math.PI;
      s.last={T,pe,pv,ang,rel,x:q.x,y:q.y,t:s.t};
      s.flash=1;
    }
    /* След для кривой N(t): раньше рисовалась прямая от начала к текущей
       точке, то есть вообще не кривая. Пишем реальные отсчёты. */
    const tr=s.trace;
    if(!tr.length || s.t-tr[tr.length-1][0]>0.03){
      tr.push([s.t,s.left]);
      if(tr.length>400) tr.splice(0,tr.length-400);
    }
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    if(p.mode==='compare'){
      const r=Math.pow(10,p.logr);
      const out=[['t',s.t,'с'],['расстояние между протонами r',r,'м'],
                 ['оно же в фемтометрах',r*1e15,'фм']];
      for(const k of this.KINDS){
        const F=this.F(k,r);
        out.push([this.INFO[k].name+': сила',F,'Н']);
        /* Отношение Fем/F считаем в логарифмах, а не делением. Прямое деление
           на атомных расстояниях уходило в бесконечность: exp(−r/R₀) при
           r = 10⁻¹⁰ м обнуляется в double, и в панели вместо ответа стоял
           прочерк. Порядок 10^N здесь и нагляднее: он и есть та самая
           пропасть между взаимодействиями, ради которой сцена сделана. */
        out.push(['      слабее кулоновской, 10^N раз',this.lgF('em',r)-this.lgF(k,r),'']);
      }
      return out;
    }
    const Q=this.Q(), tot=s.decayed||1;
    const theory=p.N*Math.exp(-Math.LN2*s.t*p.boost/this.halfLife);
    return [['t (модельное)',s.t,'с'],
      ['прошло времени в опыте',s.t*p.boost,'с'],
      ['ускорение показа',p.boost,'×'],
      ['нейтронов осталось',s.left,''],
      ['распалось',s.decayed,''],
      ['теория N₀·2^(−t/T½)',theory,''],
      ['расхождение с теорией',s.left-theory,''],
      ['период полураспада нейтрона',this.halfLife,'с'],
      // NaN здесь намеренно: fmt() печатает для него прочерк, и строка
      // работает разделителем разделов панели, а не показанием
      ['— энергия —',NaN,'n → p + e⁻ + ν̄ₑ'],
      ['разность масс m_n − m_p',this.mn-this.mp,'МэВ'],
      ['масса покоя электрона',this.me,'МэВ'],
      ['доступная энергия Q',Q,'МэВ'],
      ['средняя энергия электрона',s.decayed?s.sumT/tot:NaN,'МэВ'],
      ['она же в долях Q',s.decayed?s.sumT/tot/Q:NaN,''],
      ['энергия последнего электрона',s.last?s.last.T:NaN,'МэВ'],
      ['осталось антинейтрино',s.last?Q-s.last.T:NaN,'МэВ']];
  },
  graphs:[
    {label:'Осталось нейтронов',unit:'шт',series:['опыт','теория'],
     get(s,p){ if(p.mode!=='decay') return [null,null];
       return [s.left, p.N*Math.exp(-Math.LN2*s.t*p.boost/SIMS.forces.halfLife)]; }},
    {label:'Средняя энергия электрона',unit:'МэВ',series:['⟨T⟩','Q'],
     get(s,p){ if(p.mode!=='decay'||!s.decayed) return [null,null];
       return [s.sumT/s.decayed, SIMS.forces.Q()]; }}
  ],
  presets:[
    {name:'Распад: 400 нейтронов, показ ×120',values:{mode:'decay',N:400,boost:120,tStop:0}},
    {name:'Мало нейтронов — виден чистый случай',values:{mode:'decay',N:40,boost:120,tStop:0}},
    {name:'Много нейтронов — идеальная экспонента',values:{mode:'decay',N:2000,boost:200,tStop:0}},
    {name:'Медленно: видно каждый распад',values:{mode:'decay',N:200,boost:20,tStop:0}},
    {name:'Учебный порядок сил (r = 10⁻¹⁸ м)',values:{mode:'compare',logr:-18}},
    {name:'Силы внутри ядра (r = 1 фм): слабое уже вымерло',values:{mode:'compare',logr:-15}},
    {name:'Силы в атоме (r = 10⁻¹⁰ м): осталось два',values:{mode:'compare',logr:-10}},
    {name:'Силы в быту (r = 1 м)',values:{mode:'compare',logr:0}}
  ],
  /* 3.4.0: обе картинки — панели в единицах сцены, вписанные целиком */
  fit(p,vp){ return p.mode==='compare'?КС.fitBox(vp,12.8,11.4,0,0):КС.fitBox(vp,12.8,11,0,0); },

  draw(ctx,s,v,p){
    if(p.mode==='compare') return this.drawCompare(ctx,s,v,p);
    return this.drawDecay(ctx,s,v,p);
  },

  /* ============ РЕЖИМ 1: ЖИВОЙ АНСАМБЛЬ НЕЙТРОНОВ ============
     Четыре панели (3.4.0): ансамбль, кривая N(t), импульсы последнего
     распада, спектр. Все подписи — внутри своих панелей. */
  drawDecay(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    const Q=this.Q();

    // ---------- ансамбль: нейтроны гаснут, протоны остаются ----------
    {
      const px=-6.4, py=0.55, pw=6.3, ph=4.95;
      КС.рамка(ctx,v,px,py,pw,ph,'n → p + e⁻ + ν̄: ансамбль');
      const bx=px+0.2, by=py+0.95, bw=pw-0.4, bh=ph-1.75;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.strokeRect(bx,by,bw,bh);
      const r=clamp(1.5/Math.sqrt(p.N),0.035,0.12);
      for(const q of s.nu){
        const x=bx+0.12+q.x*(bw-0.24), y=by+0.12+q.y*(bh-0.24);
        ctx.fillStyle=q.alive?meas:dang; ctx.globalAlpha=q.alive?.95:.45;
        ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
        if(!q.alive && s.t-q.tp<0.35){                 // вспышка в момент распада
          ctx.globalAlpha=1; ctx.strokeStyle=ok; ctx.lineWidth=v.lw(1.6);
          ctx.beginPath(); ctx.arc(x,y,r+0.12+(s.t-q.tp)*0.9,0,7); ctx.stroke();
        }
      }
      ctx.globalAlpha=1;
      v.text(ctx,`● нейтронов ${s.left}`,bx,py+0.62,meas,10,'left',true);
      v.text(ctx,`● протонов ${s.decayed}`,bx+bw,py+0.62,dang,10,'right',true);
      v.text(ctx,`×${p.boost}: в опыте прошло ${(s.t*p.boost/60).toFixed(1)} мин`,px+pw/2,py+0.27,ink3,9.5,'center');
    }

    // ---------- кривая N(t): опыт против теории ----------
    if(p.curve){
      const px=0.1, py=2.75, pw=6.3, ph=2.75;
      КС.рамка(ctx,v,px,py,pw,ph,'N(t): опыт — и теория - -');
      const gx=px+0.55, gy=py+0.4, gw=pw-0.8, gh=ph-1.05;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      const Tmax=Math.max(s.t,this.halfLife/p.boost*2.4);
      const X=t=>gx+gw*clamp(t/Tmax,0,1), Y=n=>gy+gh*clamp(n/p.N,0,1);
      ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.3);
      ctx.beginPath();
      for(let i=0;i<=60;i++){ const t=Tmax*i/60, n=p.N*Math.exp(-Math.LN2*t*p.boost/this.halfLife);
        i?ctx.lineTo(X(t),Y(n)):ctx.moveTo(X(t),Y(n)); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2); ctx.beginPath();
      s.trace.forEach((q,i)=>{ const x=X(q[0]),y=Y(q[1]); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
      ctx.stroke();
      КС.точка(ctx,v,X(s.t),Y(s.left),3.2,meas);
      const th=this.halfLife/p.boost;
      if(th<=Tmax){
        КС.пунктир(ctx,v,X(th),gy,X(th),Y(p.N/2),ok,.7); КС.пунктир(ctx,v,gx,Y(p.N/2),X(th),Y(p.N/2),ok,.7);
        v.text(ctx,'T½',X(th),gy-0.2,ok,9.5,'center',true);
        v.text(ctx,'½',gx-0.12,Y(p.N/2),ok,9.5,'right',true);
      }
    }

    // ---------- последний распад: сумма импульсов равна нулю ----------
    if(p.vec){
      const px=0.1, py=0.55, pw=6.3, ph=2.0;
      КС.рамка(ctx,v,px,py,pw,ph,'последний распад: Σp⃗ = 0');
      if(s.last){
        const cx=px+2.0, cy=py+0.85, K=0.7/Math.max(Q,1e-6);
        const a1=s.last.ang, a2=s.last.ang+s.last.rel;
        const ex=Math.cos(a1)*s.last.pe*K, ey=Math.sin(a1)*s.last.pe*K*0.8;
        const vx=Math.cos(a2)*s.last.pv*K, vy=Math.sin(a2)*s.last.pv*K*0.8;
        const qx=-(ex+vx), qy=-(ey+vy);
        ctx.globalAlpha=.45+0.55*s.flash;
        v.arrow(ctx,cx,cy,cx+ex,cy+ey,acc); v.arrow(ctx,cx,cy,cx+vx,cy+vy,ink3); v.arrow(ctx,cx,cy,cx+qx,cy+qy,dang);
        ctx.globalAlpha=1;
        КС.точка(ctx,v,cx,cy,2.6,ink);
        v.text(ctx,`e⁻: ${s.last.T.toFixed(3)} МэВ`,px+3.35,py+1.2,acc,9.5,'left',true);
        v.text(ctx,`ν̄: ${(Q-s.last.T).toFixed(3)} МэВ`,px+3.35,py+0.85,ink3,9.5,'left',true);
        v.text(ctx,'p: отдача ≈ 0',px+3.35,py+0.5,dang,9.5,'left',true);
      } else v.text(ctx,'ждём первого распада…',px+pw/2,py+0.8,ink3,10,'center');
    }

    // ---------- спектр: главное доказательство существования нейтрино ----------
    if(p.spec){
      const px=-6.4, py=-5.5, pw=12.8, ph=5.85;
      КС.рамка(ctx,v,px,py,pw,ph,'спектр энергий электрона: сплошной, а не одна линия');
      const gx=px+0.4, gy=py+1.85, gw=pw-0.8, gh=ph-2.75, nb=s.hist.length;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      const mx=Math.max(1,...s.hist), bwid=gw/nb;
      ctx.fillStyle=acc; ctx.globalAlpha=.45;
      for(let i=0;i<nb;i++){ const h=gh*s.hist[i]/mx; if(h>0) ctx.fillRect(gx+i*bwid,gy,bwid*0.86,h); }
      ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2); ctx.beginPath();
      const M=this.specMax();
      for(let i=0;i<=120;i++){ const T=Q*i/120, y=gy+gh*this.spec(T)/M; i?ctx.lineTo(gx+gw*i/120,y):ctx.moveTo(gx+gw*i/120,y); }
      ctx.stroke();
      // где была бы единственная линия, если бы нейтрино не существовало
      ctx.strokeStyle=dang; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.8);
      ctx.beginPath(); ctx.moveTo(gx+gw,gy); ctx.lineTo(gx+gw,gy+gh); ctx.stroke(); ctx.setLineDash([]);
      v.text(ctx,'0',gx,gy-0.22,ink3,9.5,'left');
      v.text(ctx,`Q = ${Q.toFixed(3)} МэВ`,gx+gw,gy-0.22,dang,9.5,'right',true);
      v.text(ctx,'энергия электрона T →',gx+gw/2,gy-0.22,ink3,9.5,'center');
      if(s.decayed>4){
        const av=s.sumT/s.decayed, ax=gx+gw*av/Q;
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
        ctx.beginPath(); ctx.moveTo(ax,gy); ctx.lineTo(ax,gy+gh*0.7); ctx.stroke();
        v.text(ctx,`среднее ⟨T⟩ = ${av.toFixed(3)}`,ax+0.12,gy+gh*0.7+0.18,meas,9.5,'left',true);
      }
      const yy=КС.абзац(ctx,v,`красная черта: будь продуктов распада только два (p и e⁻), электрон всегда уносил бы ровно ${Q.toFixed(3)} МэВ.`,px+0.25,py+1.2,pw-0.5,dang,9.5);
      КС.абзац(ctx,v,'Сплошной спектр — след третьей, невидимой частицы. Так Паули в 1930 году предсказал нейтрино.',px+0.25,yy,pw-0.5,ink3,9.5);
    }
  },

  /* ============ РЕЖИМ 2: КТО ПОБЕЖДАЕТ НА КАКОМ РАССТОЯНИИ ============ */
  drawCompare(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'),
          dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const COL={strong:dang, em:acc, weak:sec, grav:ink3};
    const gx=-5.3, gy=-0.9, gw=11.6, gh=6.2;
    const LR0=-19, LR1=0;                          // показатель степени расстояния, м
    const LF0=-40, LF1=12;                         // показатель степени силы, Н
    const X=lr=>gx+gw*(lr-LR0)/(LR1-LR0);
    const Y=lf=>gy+gh*clamp((lf-LF0)/(LF1-LF0),0,1);

    // сетка по десятичным порядкам
    ctx.strokeStyle=ink3; ctx.globalAlpha=.16; ctx.lineWidth=v.lw(1);
    for(let lr=LR0+1;lr<=LR1;lr+=3){ ctx.beginPath(); ctx.moveTo(X(lr),gy); ctx.lineTo(X(lr),gy+gh); ctx.stroke(); }
    for(let lf=LF0;lf<=LF1;lf+=10){ ctx.beginPath(); ctx.moveTo(gx,Y(lf)); ctx.lineTo(gx+gw,Y(lf)); ctx.stroke(); }
    ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.stroke();
    for(let lr=LR0+1;lr<=LR1;lr+=3) v.text(ctx,`10${this.sup(lr)}`,X(lr),gy-0.25,ink3,9.5,'center');
    v.text(ctx,'расстояние между двумя протонами r, м',gx+gw/2,gy-0.6,ink3,9.5,'center');
    for(let lf=LF0;lf<=LF1;lf+=20) v.text(ctx,`10${this.sup(lf)} Н`,gx-0.1,Y(lf),ink3,9.5,'right');

    /* Кривые сил. Подпись ставим у ПРАВОГО конца каждой кривой: у кулона и
       тяготения это правый край кадра, у сильного и слабого — их обрыв, и
       подписи расходятся сами собой. Раньше все четыре лепились слева. */
    for(const k of this.KINDS){
      ctx.strokeStyle=COL[k]; ctx.lineWidth=v.lw(2.2);
      ctx.beginPath();
      let started=false, lastX=null, lastY=null;
      for(let i=0;i<=240;i++){
        const lr=LR0+(LR1-LR0)*i/240, F=this.F(k,Math.pow(10,lr));
        if(!(F>0)){ started=false; continue; }
        const lf=Math.log10(F);
        if(lf<LF0||lf>LF1){ started=false; continue; }
        const x=X(lr), y=Y(lf);
        started?ctx.lineTo(x,y):ctx.moveTo(x,y); started=true; lastX=x; lastY=y;
      }
      ctx.stroke();
      if(p.names&&lastX!=null){
        const nm=this.INFO[k].name;
        const right = lastX > gx+gw-1.5;
        v.text(ctx,nm,right?lastX-0.1:lastX+0.12,lastY+0.22,COL[k],10,right?'right':'left',true);
      }
    }

    // текущее расстояние
    const lr=p.logr, r=Math.pow(10,lr);
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.setLineDash([v.lw(4),v.lw(4)]);
    ctx.beginPath(); ctx.moveTo(X(lr),gy); ctx.lineTo(X(lr),gy+gh); ctx.stroke(); ctx.setLineDash([]);
    for(const k of this.KINDS){
      const F=this.F(k,r); if(!(F>0)) continue;
      const lf=Math.log10(F); if(lf<LF0||lf>LF1) continue;
      ctx.fillStyle=COL[k]; ctx.beginPath(); ctx.arc(X(lr),Y(lf),v.lw(4),0,7); ctx.fill();
    }
    const rt = r<1e-12 ? `${(r*1e15).toPrecision(3)} фм` : `${числоНаСцене(r)} м`;
    v.text(ctx,`r = ${rt}`,X(lr),gy+gh+0.22,meas,10,'center',true);

    /* Расстановка сил — в ПРАВОМ ВЕРХНЕМ углу самого графика: кривые падают
       слева направо, поэтому там всегда пусто, а под графиком места нет. */
    const rows=this.KINDS.map(k=>({k,F:this.F(k,r)})).sort((a,b)=>b.F-a.F);
    const lx=gx+gw-0.15, ly=gy+gh-0.35;
    v.text(ctx,'здесь по убыванию:',lx,ly,ink3,9.5,'right');
    rows.forEach((q,i)=>{
      const t=`${i+1}. ${this.INFO[q.k].name} ${q.F>1e-99?числоНаСцене(q.F):'≈ 0'} Н`;
      v.text(ctx,t,lx,ly-0.34*(i+1),COL[q.k],9.5,'right',true);
    });

    // ---- вывод: абзацы с переносом — в узком окне строки не вылезают
    let y=gy-1.05; const W=12.6, x0=-6.3;
    y=КС.абзац(ctx,v,'У сильного и слабого радиус конечный: за ним сила гаснет как e^(−r/r₀) — на графике это обрыв.',x0,y,W,ink3,9.5);
    y=КС.абзац(ctx,v,'Привычный порядок «сильное > ЭМ > слабое > тяготение» верен на 10⁻¹⁸ м; на 1 фм слабое уже вымерло.',x0,y-0.08,W,ink3,9.5);
    КС.абзац(ctx,v,'ЭМ в 10³⁶ раз сильнее тяготения, но заряды двух знаков гасят друг друга, а масса — одного знака: поэтому звёздами и галактиками правит самая слабая из четырёх сил.',x0,y-0.08,W,ink,9.5);
  },
  sup(e){
    const m={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
    return String(e).split('').map(c=>m[c]||c).join('');
  }
},

/* antimatter — в matter-scenes.js (3.2.0) */

/* ================= ГЛ.31: АДРОНЫ И КВАРКИ ================= */
quarks:{
  title:'Адроны и кварки: из чего сложены частицы',
  hudAware:true,
  /* Сцена — схема состава адронов. Поэтому ни осей с числами, ни надписи
     «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'part',label:'Частица',type:'select',default:'p',
     options:[{v:'p',t:'Протон'},{v:'n',t:'Нейтрон'},{v:'pi+',t:'Пион π⁺'},
              {v:'pi-',t:'Пион π⁻'},{v:'lam',t:'Лямбда-гиперон Λ⁰'},{v:'e',t:'Электрон (лептон)'}]},

    {type:'group',label:'Показывать'},
    {key:'sum',  label:'Сложение зарядов',type:'check',default:true},
    {key:'table',label:'Таблица кварков и лептонов',type:'check',default:true}
  ],
  /* заряды кварков в единицах заряда электрона */
  q:{u:2/3, d:-1/3, s:-1/3, ub:-2/3, db:1/3, sb:1/3},
  qName:{u:'u',d:'d',s:'s',ub:'ū',db:'d̄',sb:'s̄'},
  /* состав частиц */
  comp:{
    p:   {name:'протон',    quarks:['u','u','d'], type:'барион', mass:938.27,  life:'стабилен'},
    n:   {name:'нейтрон',   quarks:['u','d','d'], type:'барион', mass:939.57,  life:'≈10 мин (свободный)'},
    'pi+':{name:'пион π⁺',  quarks:['u','db'],    type:'мезон',  mass:139.57,  life:'2,6·10⁻⁸ с'},
    'pi-':{name:'пион π⁻',  quarks:['ub','d'],    type:'мезон',  mass:139.57,  life:'2,6·10⁻⁸ с'},
    lam: {name:'Λ⁰-гиперон',quarks:['u','d','s'], type:'барион', mass:1115.68, life:'2,6·10⁻¹⁰ с'},
    e:   {name:'электрон',  quarks:null,          type:'лептон', mass:0.511,   life:'стабилен'}
  },
  charge(p){
    const c=this.comp[p.part];
    if(!c.quarks) return -1;
    return c.quarks.reduce((a,k)=>a+this.q[k],0);
  },
  /* барионное число: у каждого кварка 1/3 */
  baryon(p){
    const c=this.comp[p.part];
    if(!c.quarks) return 0;
    return c.quarks.reduce((a,k)=>a+(k.length>1?-1/3:1/3),0);
  },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const c=this.comp[p.part];
    const out=[['частица',0,c.name],
      ['класс',0,c.type],
      ['масса',c.mass,'МэВ'],
      ['время жизни',0,c.life]];
    if(c.quarks){
      out.push(['состав',0,c.quarks.map(k=>this.qName[k]).join(' ')],
        ['сумма зарядов кварков',this.charge(p),'e'],
        ['барионное число',this.baryon(p),'']);
      c.quarks.forEach((k,i)=>out.push([`  кварк ${this.qName[k]}: заряд`,this.q[k],'e']));
    } else {
      out.push(['состав',0,'неделим — лептоны не состоят из кварков'],
        ['заряд',-1,'e'],['барионное число',0,'']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Протон: uud, заряд +1',values:{part:'p'}},
    {name:'Нейтрон: udd, заряд 0',values:{part:'n'}},
    {name:'Пион π⁺: кварк и антикварк',values:{part:'pi+'}},
    {name:'Лямбда: есть странный кварк',values:{part:'lam'}},
    {name:'Электрон: лептон, не делится',values:{part:'e'}}
  ],
  /* 3.4.0: сцена разложена на четыре панели в мировых координатах. Раньше
     подписи стояли пиксельными сдвигами от одной точки и в узком окне
     наезжали друг на друга. Теперь: частица, сложение зарядов на числовой
     оси, таблица «кирпичиков» и живая картинка конфайнмента. */
  fit(p,vp){ return КС.fitBox(vp,12.8,10.4,0,0); },
  /* заряд дробью: 2/3 → «+2/3» */
  дробь(q){ const t=Math.round(Math.abs(q)*3); return (q<-1e-9?'−':'+')+(t%3===0?String(t/3):t+'/3'); },
  /* глюон — пружинка между кварками */
  глюон(ctx,v,x0,y0,x1,y1,color,фаза,alpha){
    const L=Math.hypot(x1-x0,y1-y0); if(L<1e-6) return;
    const ux=(x1-x0)/L, uy=(y1-y0)/L, N=Math.max(6,Math.round(L/0.09)), A=0.07;
    ctx.save(); ctx.strokeStyle=color; ctx.globalAlpha=alpha==null?.8:alpha; ctx.lineWidth=v.lw(1.5); ctx.beginPath();
    for(let i=0;i<=N*4;i++){ const t=i/(N*4), w=A*Math.sin(t*N*2*Math.PI+фаза)*Math.sin(Math.PI*t);
      const x=x0+ux*L*t-uy*w, y=y0+uy*L*t+ux*w; i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke(); ctx.restore();
  },
  кварк(ctx,v,x,y,k,r){
    const anti=k.length>1;
    ctx.fillStyle=anti?v.c('--danger'):v.c('--accent'); ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    v.text(ctx,this.qName[k],x,y,'#fff',11,'center',true);
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const c=this.comp[p.part], t=s.ph||0;
    // ---- 1. частица
    {
      const bx=-6.3, by=0.2, bw=6.1, bh=4.9, CX=bx+bw/2, CY=by+2.35, RC=1.45;
      КС.рамка(ctx,v,bx,by,bw,bh,c.quarks?`${c.name}: из чего состоит`:`${c.name}: не делится`);
      if(c.quarks){
        ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1.4);
        ctx.beginPath(); ctx.arc(CX,CY,RC,0,7); ctx.stroke(); ctx.globalAlpha=1;
        const n=c.quarks.length, RQ=n===2?0.62:0.72;
        const pos=c.quarks.map((k,i)=>{ const a=i/n*2*Math.PI+Math.PI/2+t*0.35, d=RQ*(1+0.05*Math.sin(t*3+i*2));
          return [CX+d*Math.cos(a),CY+d*Math.sin(a),a]; });
        for(let i=0;i<n;i++){ const q0=pos[i], q1=pos[(i+1)%n]; if(n===2&&i===1) break;
          this.глюон(ctx,v,q0[0],q0[1],q1[0],q1[1],sec,t*6); }
        c.quarks.forEach((k,i)=>{ const [x,y,a]=pos[i];
          this.кварк(ctx,v,x,y,k,0.3);
          v.text(ctx,this.дробь(this.q[k]),CX+(RQ+0.58)*Math.cos(a),CY+(RQ+0.58)*Math.sin(a),ink3,10,'center',true); });
        v.text(ctx,'пружинки — глюоны, они держат кварки',CX,by+0.72,sec,10,'center');
      } else {
        ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(CX,CY,0.34,0,7); ctx.fill();
        v.text(ctx,'e⁻',CX,CY,'#fff',11,'center',true);
        v.text(ctx,'точечная частица:',CX,by+1.0,ink3,10,'center');
        v.text(ctx,'внутренней структуры не найдено',CX,by+0.66,ink3,10,'center');
      }
      v.text(ctx,`${c.type} · ${String(c.mass).replace('.',',')} МэВ`,CX,by+bh-0.72,ink,10,'center',true);
    }
    // ---- 2. заряд — сумма зарядов кварков: стрелки на числовой оси
    if(p.sum){
      const bx=0.1, by=0.2, bw=6.2, bh=4.9, X=q=>bx+3.1+q*1.9, yA=by+1.35;
      КС.рамка(ctx,v,bx,by,bw,bh,'заряд = сумма зарядов кварков');
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(X(-1.4),yA); ctx.lineTo(X(1.4),yA); ctx.stroke();
      for(let k=-4;k<=4;k++){ const q=k/3, big=k%3===0;
        ctx.beginPath(); ctx.moveTo(X(q),yA-(big?0.12:0.06)); ctx.lineTo(X(q),yA+(big?0.12:0.06)); ctx.stroke();
        if(big) v.text(ctx,k===0?'0':(k>0?'+':'−')+Math.abs(k/3),X(q),yA-0.3,ink3,10,'center'); }
      if(c.quarks){
        let сумма=0;
        c.quarks.forEach((k,i)=>{ const q=this.q[k], y=by+bh-0.95-i*0.52;
          ctx.save(); ctx.globalAlpha=.3; ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
          ctx.beginPath(); ctx.moveTo(X(сумма+q),y); ctx.lineTo(X(сумма+q),yA); ctx.stroke(); ctx.restore();
          v.arrow(ctx,X(сумма),y,X(сумма+q),y,k.length>1?dang:acc);
          const справа=Math.max(X(сумма),X(сумма+q)), слева=Math.min(X(сумма),X(сумма+q));
          // подпись — с той стороны стрелки, где есть место в панели
          if(справа<bx+bw-1.5) v.text(ctx,`${this.qName[k]}: ${this.дробь(q)}`,справа+0.12,y,k.length>1?dang:acc,10,'left',true);
          else v.text(ctx,`${this.qName[k]}: ${this.дробь(q)}`,слева-0.12,y,k.length>1?dang:acc,10,'right',true);
          сумма+=q; });
        const ch=Math.round(сумма);
        v.arrow(ctx,X(0),yA+0.02,X(ch),yA+0.02,meas);
        КС.точка(ctx,v,X(ch),yA,4,meas);
        v.text(ctx,`итог: ${ch>0?'+':ch<0?'−':''}${Math.abs(ch)} — заряд целый`,bx+bw/2,by+0.62,meas,10,'center',true);
        const B=this.baryon(p);
        v.text(ctx,`барионное число ${c.quarks.map(k=>k.length>1?'−⅓':'⅓').join(' + ').replace('+ −','− ')} = ${Math.round(B)}`,bx+bw/2,by+0.28,ink3,9.5,'center');
      } else {
        v.arrow(ctx,X(0),yA+0.02,X(-1),yA+0.02,meas); КС.точка(ctx,v,X(-1),yA,4,meas);
        v.text(ctx,'у электрона заряд −1 — он свой,',bx+bw/2,by+3.3,ink,10,'center');
        v.text(ctx,'а не сумма долей: кварков нет',bx+bw/2,by+2.95,ink,10,'center');
        v.text(ctx,'барионное число 0',bx+bw/2,by+0.4,ink3,10,'center');
      }
    }
    // ---- 3. кирпичики: кварки и лептоны
    if(p.table){
      const bx=-6.3, by=-5.1, bw=6.1, bh=5.0, есть=new Set((c.quarks||[]).map(k=>k[0]));
      КС.рамка(ctx,v,bx,by,bw,bh,'кирпичики вещества');
      v.text(ctx,'кварки',bx+1.45,by+bh-0.8,dang,10,'center',true);
      v.text(ctx,'лептоны',bx+4.5,by+bh-0.8,acc,10,'center',true);
      const qs=[['u','верхний','+2/3'],['d','нижний','−1/3'],['s','странный','−1/3']];
      qs.forEach((r,i)=>{ const y=by+bh-1.4-i*0.72, on=есть.has(r[0]);
        if(on){ ctx.fillStyle=acc; ctx.globalAlpha=.12; ctx.fillRect(bx+0.15,y-0.3,2.85,0.6); ctx.globalAlpha=1; }
        this.кварк(ctx,v,bx+0.5,y,r[0],0.22);
        v.text(ctx,r[1],bx+0.85,y+0.1,on?ink:ink3,9.5,'left',on);
        v.text(ctx,`заряд ${r[2]}`,bx+0.85,y-0.17,ink3,9,'left'); });
      const ls=[['e⁻','электрон','−1'],['νₑ','нейтрино','0'],['μ⁻','мюон','−1']];
      ls.forEach((r,i)=>{ const y=by+bh-1.4-i*0.72, on=(p.part==='e'&&i===0);
        if(on){ ctx.fillStyle=acc; ctx.globalAlpha=.12; ctx.fillRect(bx+3.15,y-0.3,2.8,0.6); ctx.globalAlpha=1; }
        ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(bx+3.5,y,0.2,0,7); ctx.fill();
        v.text(ctx,r[0],bx+3.5,y,'#fff',9,'center',true);
        v.text(ctx,r[1],bx+3.82,y+0.1,on?ink:ink3,9.5,'left',on);
        v.text(ctx,`заряд ${r[2]}`,bx+3.82,y-0.17,ink3,9,'left'); });
      v.text(ctx,'адроны (протон, нейтрон, пион)',bx+bw/2,by+0.95,ink3,9.5,'center');
      v.text(ctx,'сложены из кварков; лептоны — нет',bx+bw/2,by+0.6,ink3,9.5,'center');
    }
    // ---- 4. конфайнмент: кварк тянут — трубка рвётся — рождается пара
    {
      const bx=0.1, by=-5.1, bw=6.2, bh=5.0, T=6, ф=((t%T)+T)%T/T, y0=by+2.55, xL=bx+0.8;
      КС.рамка(ctx,v,bx,by,bw,bh,'почему кварк не выбить');
      const d=ф<0.55?0.7+ф/0.55*3.6:4.3, xR=xL+d;
      if(ф<0.55){
        // трубка глюонного поля: ширина постоянна, энергия растёт с длиной
        ctx.fillStyle=sec; ctx.globalAlpha=.16+0.2*ф; ctx.fillRect(xL,y0-0.2,d,0.4); ctx.globalAlpha=1;
        this.глюон(ctx,v,xL,y0,xR,y0,sec,t*8,.9);
        this.кварк(ctx,v,xL,y0,'u',0.26); this.кварк(ctx,v,xR,y0,'db',0.26);
        const E=Math.round(ф/0.55*100);
        ctx.fillStyle=dang; ctx.globalAlpha=.8; ctx.fillRect(bx+0.4,by+1.25,(bw-0.8)*E/100,0.2); ctx.globalAlpha=1;
        ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.strokeRect(bx+0.4,by+1.25,bw-0.8,0.2);
        v.text(ctx,'энергия трубки растёт с длиной',bx+bw/2,by+1.72,dang,9.5,'center');
        v.text(ctx,'тянем кварк →',xR,y0+0.6,ink3,9.5,'center');
      } else {
        // трубка порвалась: энергии хватило на новую пару кварк–антикварк
        const g=(ф-0.55)/0.45, mid=xL+2.15, разлёт=g*0.9;
        if(g<0.12){ ctx.fillStyle=v.c('--warn')||meas; ctx.globalAlpha=1-g/0.12; ctx.beginPath(); ctx.arc(mid,y0,0.35+g*3,0,7); ctx.fill(); ctx.globalAlpha=1; }
        const aL=xL-разлёт, bL=mid-0.35-разлёт, aR=mid+0.35+разлёт, bR=xL+4.3+разлёт;
        this.глюон(ctx,v,aL,y0,bL,y0,sec,t*8,.9); this.глюон(ctx,v,aR,y0,bR,y0,sec,t*8,.9);
        this.кварк(ctx,v,aL,y0,'u',0.26); this.кварк(ctx,v,bL,y0,'ub',0.26);
        this.кварк(ctx,v,aR,y0,'u',0.26); this.кварк(ctx,v,bR,y0,'db',0.26);
        v.text(ctx,'родилась новая пара u ū',bx+bw/2,by+1.72,meas,9.5,'center',true);
        v.text(ctx,'мезон',(aL+bL)/2,y0+0.55,ink3,9.5,'center'); v.text(ctx,'мезон',(aR+bR)/2,y0+0.55,ink3,9.5,'center');
      }
      v.text(ctx,'вместо одного кварка вылетают',bx+bw/2,by+0.85,ink,9.5,'center');
      v.text(ctx,'новые адроны: одиночных кварков нет',bx+bw/2,by+0.5,ink,9.5,'center');
    }
  }
}

,

/* ================== КОНСТРУКТОР МАШИН АТВУДА ================= */
atwood:{
  title:'Конструктор машин Атвуда',
  /* Сцена — схема машины: блоки и грузы стоят по клеткам, а не по метрам.
     Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'g',label:'Ускорение свободного падения g',unit:'м/с²',min:1,max:25,step:0.1,default:10},
    {key:'mnew',label:'Масса нового груза',unit:'кг',min:1,max:100,step:1,default:10},

    {type:'group',label:'Показывать'},
    {key:'tens', label:'Натяжения нитей',type:'check',default:true},
    {key:'accel',label:'Ускорения грузов',type:'check',default:true},
    {key:'anim', label:'Анимация движения',type:'check',default:true}
  ],
  /* ---- ХРАНИЛИЩЕ КОНСТРУКЦИИ ---- */
  db(p){
    if(!p._atw){
      p._atw={ blocks:[], items:{}, seq:1 };
      // стартовая заготовка: один неподвижный блок с двумя грузами и креплением к потолку
      const id='P1';
      p._atw.blocks.push({id,kind:'fixed',x:0,y:1.6});
      p._atw.items[id+':top']={type:'fixed'};
      p._atw.items[id+':l']={type:'mass',m:10};
      p._atw.items[id+':r']={type:'mass',m:20};
      p._atw.tool='mass';
    }
    return p._atw;
  },
  /* порты блока в порядке [несущий, левый, правый] с координатными смещениями */
  R:0.5,                                   // радиус колеса = половина клетки
  ports(b){
    /* Крепления отстоят от центра ровно на КЛЕТКУ по вертикали, а нить сходит
       с обода по касательной (±R по горизонтали). Ось Y направлена ВВЕРХ.
       Неподвижный: опора сверху, две ветви нити вниз.
       Подвижный: две ветви нити вверх (те самые боковые линии), груз снизу на оси. */
    const R=this.R;
    return b.kind==='fixed'
      ? {top:{dx:0,dy:1,carrier:true}, l:{dx:-R,dy:-1}, r:{dx:R,dy:-1}}
      : {l:{dx:-R,dy:1}, r:{dx:R,dy:1}, bot:{dx:0,dy:-1,carrier:true}};
  },
  /* Куда встанет новый блок, если подвесить его на крепление (b,port).
     Подвижный цепляется КОНЦОМ НИТИ: справа от родителя работает его левая точка
     (блок уходит на +1 клетку), слева — правая точка (−1 клетка).
     Неподвижный цепляется осью — своим верхним креплением. */
  attachPlan(b,port,kind){
    const R=this.R, pp=this.portXY(b,port);
    if(kind==='movable'){
      const useLeft = (port!=='l');                 // от правого (и центрального) — левой точкой
      const cport = useLeft?'l':'r';
      return {x: pp.x + (useLeft? R : -R), y: pp.y-1, childPort:cport};
    }
    return {x: pp.x, y: pp.y-1, childPort:'top'};    // неподвижный висит за верх
  },
  /* На какие крепления можно вешать груз.
     Верх неподвижного держит всю систему, а верхние ветви подвижного идут к опорам
     или к другим блокам — груз там не имеет смысла и ломает построение. */
  allowsMass(b,port){
    return b.kind==='fixed' ? (port==='l'||port==='r') : (port==='bot');
  },
  carrier(b){ return b.kind==='fixed'?'top':'bot'; },
  portList(b){ return b.kind==='fixed'?['top','l','r']:['l','r','bot']; },
  portXY(b,port){ const pt=this.ports(b)[port]; return {x:b.x+pt.dx, y:b.y+pt.dy}; },

  /* ---- РЕШАТЕЛЬ ---- */
  solveLinear(A,b){
    const n=A.length, m=A[0]?A[0].length:0;
    if(!n||!m) return null;
    const M=A.map((r,i)=>[...r,b[i]]);
    let row=0; const pivCol=[];
    for(let col=0; col<m && row<n; col++){
      let piv=row; for(let r=row+1;r<n;r++) if(Math.abs(M[r][col])>Math.abs(M[piv][col])) piv=r;
      if(Math.abs(M[piv][col])<1e-10) continue;
      [M[row],M[piv]]=[M[piv],M[row]];
      const d=M[row][col]; for(let c=col;c<=m;c++) M[row][c]/=d;
      for(let r=0;r<n;r++) if(r!==row){ const f=M[r][col]; if(Math.abs(f)>1e-15) for(let c=col;c<=m;c++) M[r][c]-=f*M[row][c]; }
      pivCol.push(col); row++;
    }
    for(let r=row;r<n;r++) if(Math.abs(M[r][m])>1e-7) return null;   // несовместна
    if(row<m) return {under:true};                                   // недоопределена
    const x=new Array(m).fill(0);
    for(let i=0;i<pivCol.length;i++) x[pivCol[i]]=M[i][m];
    return x;
  },
  solve(p){
    const d=this.db(p), g=p.g, blocks=d.blocks, items=d.items;
    if(!blocks.length) return {status:'empty'};
    const byId={}; for(const b of blocks) byId[b.id]=b;
    const vi={}; let nv=0;
    const V=(name)=>{ if(!(name in vi)) vi[name]=nv++; return vi[name]; };
    for(const b of blocks){ V('T:'+b.id); V('aax:'+b.id); V('a:'+b.id+':l'); V('a:'+b.id+':r');
      if(b.kind==='movable') V('Tbot:'+b.id); }
    const eqs=[]; const push=(coef,rhs)=>eqs.push([coef,rhs]);
    for(const b of blocks){
      // связь через блок: a_l + a_r = 2 a_axis
      push({['a:'+b.id+':l']:1, ['a:'+b.id+':r']:1, ['aax:'+b.id]:-2}, 0);
      const cp=this.carrier(b), cItem=items[b.id+':'+cp];
      // 'hung' — ось держит нить родителя, уравнение для неё даёт родительский блок
      if(!cItem || cItem.type==='fixed') push({['aax:'+b.id]:1}, 0);      // ось закреплена
      if(b.kind==='movable') push({['Tbot:'+b.id]:1, ['T:'+b.id]:-2}, 0); // невесомость: Tbot = 2T
    }
    // концы l/r
    for(const b of blocks){
      for(const port of ['l','r']){
        const it=items[b.id+':'+port], aVar='a:'+b.id+':'+port, Tend='T:'+b.id;
        if(!it){ push({[Tend]:1},0); continue; }
        if(it.type==='fixed') push({[aVar]:1},0);
        else if(it.type==='mass') push({[aVar]:it.m, [Tend]:1}, it.m*g);
        else if(it.type==='block'){
          const sub=byId[it.blockId]; if(!sub){ push({[Tend]:1},0); continue; }
          if(sub.kind==='fixed'){
            /* Неподвижный блок подвешен ЗА ОСЬ: ось движется вместе с концом нити,
               а невесомое колесо держат две ветви его собственной нити. */
            push({['aax:'+sub.id]:1, [aVar]:-1}, 0);
            push({[Tend]:1, ['T:'+sub.id]:-2}, 0);
          } else {
            /* Подвижный блок привязан КОНЦОМ НИТИ (узлом): это продолжение той же
               нити, поэтому натяжение общее, а ускорения в узле совпадают. */
            const cp=it.childPort||'l';
            push({['a:'+sub.id+':'+cp]:1, [aVar]:-1}, 0);
            push({[Tend]:1, ['T:'+sub.id]:-1}, 0);
          }
        }
      }
    }
    // несущий порт подвижного блока (bot)
    for(const b of blocks){
      if(b.kind!=='movable') continue;
      const it=items[b.id+':bot'], aVar='aax:'+b.id, Tbot='Tbot:'+b.id;
      if(!it){ push({[Tbot]:1},0); continue; }
      if(it.type==='fixed') push({[aVar]:1},0);
      else if(it.type==='mass') push({[aVar]:it.m, [Tbot]:1}, it.m*g);
      else if(it.type==='block'){
        const sub=byId[it.blockId]; if(!sub){ push({[Tbot]:1},0); continue; }
        if(sub.kind==='fixed'){
          push({['aax:'+sub.id]:1, [aVar]:-1}, 0);
          push({[Tbot]:1, ['T:'+sub.id]:-2}, 0);
        } else {
          const cp=it.childPort||'l';
          push({['a:'+sub.id+':'+cp]:1, [aVar]:-1}, 0);
          push({[Tbot]:1, ['T:'+sub.id]:-1}, 0);
        }
      }
    }
    const W0=nv;
    const A=eqs.map(([coef])=>{ const row=new Array(W0).fill(0);
      for(const [k,val] of Object.entries(coef)){ if(!(k in vi)){ vi[k]=nv++; } row[vi[k]]=val; } return row; });
    const W=nv; for(const row of A) while(row.length<W) row.push(0);
    const bb=eqs.map(([,rhs])=>rhs);
    const sol=this.solveLinear(A,bb);
    if(sol===null) return {status:'bad'};
    if(sol.under) return {status:'under'};
    const vars={}; for(const [k,idx] of Object.entries(vi)) vars[k]=sol[idx];
    return {status:'ok', vars};
  },
  /* проверка правильности сборки */
  validate(p){
    const d=this.db(p), blocks=d.blocks, items=d.items, prob=[];
    if(!blocks.length) return {ok:false,prob:['Сетка пуста — добавьте блок (ПКМ → инструмент)']};
    for(const b of blocks) for(const port of this.portList(b))
      if(!items[b.id+':'+port]) prob.push(`Блок «${b.id}»: свободный конец «${this.portName(b,port)}» — прикрепите груз, фиксатор или блок`);
    // блок, подвешенный на нити, опирается через родителя — это тоже опора
    for(const b of blocks) if(items[b.id+':'+this.carrier(b)] && items[b.id+':'+this.carrier(b)].type==='hung') { /* ок */ }
    let grounded=false;
    for(const b of blocks) for(const port of this.portList(b)){
      const x=items[b.id+':'+port]; if(x&&x.type==='fixed') grounded=true;
    }
    if(!grounded) prob.push('Система ни на чём не держится — прикрепите фиксатор (плоскость)');
    if(!prob.length){
      // связи могут противоречить друг другу: например, блок и подвешен на нити, и прибит фиксатором
      const r=this.solve(p);
      if(r.status==='bad')
        prob.push('Связи противоречат друг другу: какой-то блок закреплён и одновременно висит на нити. Уберите лишний фиксатор.');
      else if(r.status==='under')
        prob.push('Связей не хватает: часть системы может двигаться как угодно. Прикрепите ещё один конец.');
    }
    return {ok:prob.length===0, prob};
  },
  portName(b,port){
    if(b.kind==='fixed') return {top:'верх (к опоре)',l:'левый',r:'правый'}[port];
    return {l:'левый верхний',r:'правый верхний',bot:'низ (ось)'}[port];
  },

  /* ---- ИНСТРУМЕНТЫ (ПКМ-меню) ---- */
  ctxTools(p){
    const d=this.db(p), m=t=>(d.tool===t?'● ':'○ ');
    return [
      {label:m('fixblock')+'Неподвижный блок (на сетку или на крепление)', on:q=>{ SIMS.atwood.db(q).tool='fixblock'; }},
      {label:m('movblock')+'Подвижный блок (на сетку или на крепление)',   on:q=>{ SIMS.atwood.db(q).tool='movblock'; }},
      {label:m('mass')+`Груз ${p.mnew} кг`,                on:q=>{ SIMS.atwood.db(q).tool='mass'; }},
      {label:m('fixed')+'Опора (плоскость)',               on:q=>{ SIMS.atwood.db(q).tool='fixed'; }},
      {label:m('erase')+'Убрать элемент или блок',         on:q=>{ SIMS.atwood.db(q).tool='erase'; }},
      {label:'Очистить сетку',                            on:q=>{ q._atw=null; SIMS.atwood.db(q).blocks.length=0; }}
    ];
  },
  /* клик по сетке: ставим блок на свободное место или элемент на ближайший порт */
  clickAt(p,wx,wy){
    const d=this.db(p), tool=d.tool||'mass';

    if(tool==='fixblock'||tool==='movblock'){
      const kind = tool==='fixblock'?'fixed':'movable';
      /* Если рядом есть СВОБОДНОЕ крепление — подвешиваем новый блок прямо на него.
         Блок становится полноценным элементом: крепление родителя перестаёт быть
         пустым, а несущий порт нового блока занимает эта же нить. */
      const free=this.nearestPort(p,wx,wy,true);
      if(free){
        const id='P'+(d.seq++);
        const plan=this.attachPlan(free.b, free.port, kind);
        const nb={id, kind, x:plan.x, y:plan.y};
        d.blocks.push(nb);
        d.items[free.b.id+':'+free.port]={type:'block', blockId:id, childPort:plan.childPort};
        d.items[id+':'+plan.childPort]={type:'hung', parent:free.b.id+':'+free.port};
        d.warn=null;
        return;
      }
      // иначе — свободная установка в узел сетки
      const gx=Math.round(wx*2)/2, gy=Math.round(wy*2)/2;
      if(d.blocks.some(b=>Math.hypot(b.x-gx,b.y-gy)<0.9)) return;
      const id='P'+(d.seq++);
      d.blocks.push({id, kind, x:gx, y:gy});
      return;
    }

    // ластиком можно снять и элемент, и целый блок
    if(tool==='erase'){
      const hit=d.blocks.find(b=>Math.hypot(b.x-wx,b.y-wy)<0.5);
      if(hit){ this.removeBlock(p,hit.id); return; }
      const nr=this.nearestPort(p,wx,wy);
      if(nr) this.detach(p, nr.b.id+':'+nr.port);
      return;
    }

    const near=this.nearestPort(p,wx,wy);
    if(!near) return;
    const key=near.b.id+':'+near.port;
    const cur=d.items[key];
    if(cur && (cur.type==='block'||cur.type==='hung')) return;   // сначала снимите блок
    if(tool==='fixed'){ d.items[key]={type:'fixed'}; d.warn=null; return; }
    if(tool==='mass'){
      if(!this.allowsMass(near.b,near.port)){
        d.warn = near.b.kind==='fixed'
          ? 'На верхнее крепление неподвижного блока груз вешать нельзя — только опору или другой блок'
          : 'На верхние ветви подвижного блока груз вешать нельзя — они идут к опоре или к другому блоку. Груз цепляется снизу, к оси';
        return;
      }
      d.items[key]={type:'mass',m:p.mnew}; d.warn=null; return;
    }
  },
  /* снять элемент с крепления; если это связь блоков — разорвать её с обеих сторон */
  detach(p,key){
    const d=this.db(p), it=d.items[key];
    if(!it) return;
    if(it.type==='block'){
      const sub=it.blockId;
      for(const k of Object.keys(d.items))
        if(k.startsWith(sub+':') && d.items[k].type==='hung') delete d.items[k];
    } else if(it.type==='hung' && it.parent){
      delete d.items[it.parent];
    }
    delete d.items[key];
  },
  /* удалить блок вместе со всеми его связями */
  removeBlock(p,id){
    const d=this.db(p);
    for(const k of Object.keys(d.items)){
      const it=d.items[k];
      if(k.startsWith(id+':')){ this.detach(p,k); continue; }
      if(it && it.type==='block' && it.blockId===id) this.detach(p,k);
    }
    for(const k of Object.keys(d.items)) if(k.startsWith(id+':')) delete d.items[k];
    d.blocks=d.blocks.filter(b=>b.id!==id);
  },
  nearestPort(p,wx,wy,freeOnly){
    /* Крепления соседних блоков могут совпасть по координатам, поэтому ищем в два
       прохода: сначала среди СВОБОДНЫХ, и лишь если рядом таких нет — среди занятых.
       Так клик всегда попадает в то крепление, которое ещё можно заполнить. */
    const free=this.scanPorts(p,wx,wy,true);
    if(free || freeOnly) return free;
    return this.scanPorts(p,wx,wy,false);
  },
  scanPorts(p,wx,wy,freeOnly){
    const d=this.db(p); let best=null, bd=0.5;
    for(const b of d.blocks) for(const port of this.portList(b)){
      if(freeOnly && d.items[b.id+':'+port]) continue;
      const pos=this.portXY(b,port), dd=Math.hypot(pos.x-wx,pos.y-wy);
      if(dd<bd){ bd=dd; best={b,port,pos}; }
    }
    return best;
  },
  undoAction(p){
    const d=this.db(p);
    // убираем последний добавленный элемент, затем блоки
    const keys=Object.keys(d.items);
    if(keys.length>3){ delete d.items[keys[keys.length-1]]; return true; }  // не трогаем стартовые 3
    if(d.blocks.length>1){ const b=d.blocks.pop();
      for(const k of Object.keys(d.items)) if(k.startsWith(b.id+':')) delete d.items[k];
      return true; }
    return false;
  },

  init(p){ this.db(p); return {t:0, pos:{}, event:null, __stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    if(!p.anim) return;
    const val=this.validate(p); if(!val.ok) return;
    const sol=this.solve(p); if(sol.status!=='ok') return;
    // интегрируем «смещения» грузов для мягкой анимации, ограничивая амплитуду
    const d=this.db(p);
    for(const b of d.blocks) for(const port of this.portList(b)){
      const it=d.items[b.id+':'+port]; if(!it||it.type!=='mass') continue;
      const key=b.id+':'+port;
      const a = (port==='bot') ? sol.vars['aax:'+b.id] : sol.vars['a:'+b.id+':'+port];
      if(!s.pos[key]) s.pos[key]={x:0,v:0};
      const st=s.pos[key];
      st.v += (a||0)*dt; st.x += st.v*dt;
      // ограничение: грузы не «улетают» — при достижении предела мягко тормозим и разворачиваем
      const LIM=1.1;
      if(st.x> LIM){ st.x= LIM; st.v=-Math.abs(st.v)*0.3; }
      if(st.x<-LIM){ st.x=-LIM; st.v= Math.abs(st.v)*0.3; }
    }
  },
  anchors(s,p){ const d=this.db(p); return d.blocks.map(b=>({x:b.x,y:b.y})); },
  readouts(s,p){
    const val=this.validate(p);
    const out=[['g',p.g,'м/с²']];
    const d=this.db(p);
    out.push(['блоков в системе',d.blocks.length,''],
      ['неподвижных',d.blocks.filter(b=>b.kind==='fixed').length,''],
      ['подвижных',d.blocks.filter(b=>b.kind==='movable').length,'']);
    if(!val.ok){
      out.push(['статус',0,'система собрана неверно']);
      val.prob.slice(0,4).forEach((t,i)=>out.push([`  → что исправить ${i+1}`,0,t]));
      return out;
    }
    const sol=this.solve(p);
    if(sol.status!=='ok'){ out.push(['статус',0,'не удаётся решить: проверьте связи']); return out; }
    out.push(['статус',0,'система собрана верно']);
    // перечисляем грузы с их ускорениями
    let idx=1;
    for(const b of d.blocks) for(const port of this.portList(b)){
      const it=d.items[b.id+':'+port]; if(!it||it.type!=='mass') continue;
      const a=(port==='bot')? sol.vars['aax:'+b.id] : sol.vars['a:'+b.id+':'+port];
      out.push([`груз ${idx} (${it.m} кг): ускорение`, a, 'м/с² ('+(a>0.01?'вниз':a<-0.01?'вверх':'покой')+')']);
      idx++;
    }
    if(p.tens){
      for(const b of d.blocks){
        out.push([`натяжение нити блока ${b.id}`, sol.vars['T:'+b.id], 'Н']);
        if(b.kind==='movable') out.push([`  нить снизу (ось) ${b.id}`, sol.vars['Tbot:'+b.id], 'Н (= 2T)']);
      }
    }
    return out;
  },
  presets:[
    {name:'Классическая машина Атвуда',values:{__preset:'classic',g:10,mnew:10}},
    {name:'Равные массы: равновесие',values:{__preset:'equal',g:10,mnew:15}},
    {name:'Подвижный блок: выигрыш в силе',values:{__preset:'movable',g:10,mnew:20}},
    {name:'Каскад: блок под блоком',values:{__preset:'cascade',g:10,mnew:10}},
    {name:'Пустая сетка — собрать самому',values:{__preset:'empty',g:10,mnew:10}}
  ],
  applyPreset(p,name){
    p._atw={blocks:[],items:{},seq:1,tool:'mass'};
    const d=p._atw;
    const F=(id,x,y)=>d.blocks.push({id,kind:'fixed',x,y});
    const M=(id,x,y)=>d.blocks.push({id,kind:'movable',x,y});
    if(name==='classic'){
      F('P1',0,1.6);
      d.items['P1:top']={type:'fixed'}; d.items['P1:l']={type:'mass',m:10}; d.items['P1:r']={type:'mass',m:20};
    } else if(name==='equal'){
      F('P1',0,1.6);
      d.items['P1:top']={type:'fixed'}; d.items['P1:l']={type:'mass',m:15}; d.items['P1:r']={type:'mass',m:15};
    } else if(name==='movable'){
      /* Канонический выигрыш в силе: нить идёт с неподвижного блока вниз,
         привязывается к левой точке подвижного, обходит его и уходит к опоре. */
      F('P1',0,2); M('M1',1,0);
      d.items['P1:top']={type:'fixed'};
      d.items['P1:l']={type:'mass',m:30};
      d.items['P1:r']={type:'block',blockId:'M1',childPort:'l'};
      d.items['M1:l']={type:'hung',parent:'P1:r'};
      d.items['M1:r']={type:'fixed'};
      d.items['M1:bot']={type:'mass',m:20};
    } else if(name==='cascade'){
      /* Верхний блок закреплён к потолку. Слева на нём груз, а справа за
         верхнее крепление подвешен ВТОРОЙ блок — у него своя нить и свои два груза.
         Ось второго блока свободна, поэтому он движется вместе с концом нити. */
      F('P1',0,2.5); F('P2',0.5,0.5);
      d.items['P1:top']={type:'fixed'};
      d.items['P1:l']={type:'mass',m:30};
      d.items['P1:r']={type:'block',blockId:'P2',childPort:'top'};
      d.items['P2:top']={type:'hung', parent:'P1:r'};
      d.items['P2:l']={type:'mass',m:10};
      d.items['P2:r']={type:'mass',m:20};
    } else {
      d.tool='fixblock';   // пустая сетка
    }
    d.seq=d.blocks.length+1;
  },
  fit(p,vp){
    const d=this.db(p);
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    let minx=-3,maxx=3,miny=-3,maxy=3;
    for(const b of d.blocks){ minx=Math.min(minx,b.x-1); maxx=Math.max(maxx,b.x+1);
      miny=Math.min(miny,b.y-2); maxy=Math.max(maxy,b.y+1); }
    const spanX=Math.max(maxx-minx,6), spanY=Math.max(maxy-miny,6);
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:(minx+maxx)/2, y:(miny+maxy)/2, scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'),
          ink=v.c('--ink-2'), ink3=v.c('--ink-3'), panel=v.c('--panel');
    const d=this.db(p), val=this.validate(p);
    const sol=val.ok?this.solve(p):null;
    const okSol = sol && sol.status==='ok';
    const R=0.5;                                  // радиус колеса
    /* Ось Y направлена ВВЕРХ: «выше» = больший y, груз висит в сторону минуса. */

    // подложка-сетка
    ctx.strokeStyle=ink3; ctx.globalAlpha=.08; ctx.lineWidth=v.lw(1);
    for(let gx=-7;gx<=7;gx+=0.5){ ctx.beginPath(); ctx.moveTo(gx,-6); ctx.lineTo(gx,6); ctx.stroke(); }
    for(let gy=-6;gy<=6;gy+=0.5){ ctx.beginPath(); ctx.moveTo(-7,gy); ctx.lineTo(7,gy); ctx.stroke(); }
    ctx.globalAlpha=1;

    const disp=(key)=> (p.anim && s.pos[key])? s.pos[key].x*0.28 : 0;
    const ropeX=(b,side)=> b.x + (side==='l'?-R:R);

    /* Рисуем то, что закреплено на конце нити.
       yEnd — точка конца нити, dir = +1 если элемент выше блока, −1 если ниже. */
    const drawItem=(px,yEnd,it,key,accelA,dir)=>{
      if(!it) return;
      if(it.type==='fixed'){
        // опорная площадка со штриховкой в сторону от блока
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.6);
        ctx.beginPath(); ctx.moveTo(px-0.5,yEnd); ctx.lineTo(px+0.5,yEnd); ctx.stroke();
        ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4);
        for(let i=0;i<6;i++){ const xx=px-0.45+i*0.18;
          ctx.beginPath(); ctx.moveTo(xx,yEnd); ctx.lineTo(xx-0.16,yEnd+dir*0.18); ctx.stroke(); }
        v.label(ctx,'опора',px,yEnd,-16,dir>0?-14:24,ink3);
      } else if(it.type==='mass'){
        // груз ВСЕГДА висит вниз от своей точки крепления
        const dy=disp(key);
        const cy=yEnd - 0.45 - dy;               // центр бруска ниже конца нити
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6);
        ctx.beginPath(); ctx.moveTo(px,yEnd); ctx.lineTo(px,cy+0.16); ctx.stroke();
        const w=0.36, h=0.30+0.05*Math.cbrt(it.m/10);
        ctx.fillStyle=acc; ctx.fillRect(px-w/2, cy-h/2, w, h);
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.4); ctx.strokeRect(px-w/2, cy-h/2, w, h);
        ctx.strokeStyle=panel; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(px-w/2+0.06,cy-h/2+0.06); ctx.lineTo(px-w/2+0.06,cy+h/2-0.06); ctx.stroke();
        ctx.globalAlpha=1;
        v.label(ctx,`${it.m} кг`,px,cy,-14,4,'#fff');
        if(p.accel && okSol && accelA!=null){
          if(Math.abs(accelA)>0.02){
            const L=clamp(Math.abs(accelA)*0.05,0.22,0.8)*Math.sign(accelA);
            // ускорение вниз положительно → стрелка вниз, значит по y в минус
            v.arrow(ctx, px+w/2+0.3, cy+L/2, px+w/2+0.3, cy-L/2, dang);
            v.label(ctx,`a = ${accelA.toFixed(2)} м/с²`,px+w/2+0.3,cy,10,4,dang);
          } else v.label(ctx,'a = 0',px+w/2+0.3,cy,10,4,ink3);
        }
      } else if(it.type==='block'||it.type==='hung'){
        v.label(ctx,'к блоку',px,yEnd,-18,dir>0?-12:20,ink3);
      }
    };

    for(const b of d.blocks){
      const isFix=b.kind==='fixed';
      const lx=ropeX(b,'l'), rx=ropeX(b,'r');
      // куда уходят концы нити: у неподвижного вниз, у подвижного вверх
      const dirEnds = isFix ? -1 : +1;
      const yEnds   = b.y + dirEnds*1;          // ровно клетка
      // несущий конец: у неподвижного вверх к опоре, у подвижного вниз к грузу
      const dirCar  = isFix ? +1 : -1;
      const yCar    = b.y + dirCar*1;

      // ── нить на ободе: полудуга со стороны, куда уходят концы ──
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.4);
      ctx.beginPath();
      if(isFix) ctx.arc(b.x,b.y,R, Math.PI, 0);        // верхняя половина обода
      else      ctx.arc(b.x,b.y,R, 0, Math.PI);        // нижняя половина обода
      ctx.stroke();

      // ── ветви нити к концам ──
      // у подвижного блока обе боковые линии показываем всегда: это его точки подвеса
      for(const side of ['l','r']){
        const px=ropeX(b,side), filled=!!d.items[b.id+':'+side];
        if(!filled && isFix) continue;
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(filled?1.7:1.1);
        ctx.globalAlpha=filled?1:.35;
        ctx.beginPath(); ctx.moveTo(px,b.y); ctx.lineTo(px,yEnds); ctx.stroke();
        ctx.globalAlpha=1;
        if(!filled && !isFix){        // отмечаем свободную точку подвеса
          ctx.fillStyle=meas; ctx.globalAlpha=.5;
          ctx.beginPath(); ctx.arc(px,yEnds,v.lw(2.4),0,7); ctx.fill(); ctx.globalAlpha=1;
        }
      }
      // ── несущая нить ──
      const carPort=this.carrier(b);
      if(d.items[b.id+':'+carPort]){
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.9);
        ctx.beginPath(); ctx.moveTo(b.x, b.y+dirCar*R); ctx.lineTo(b.x, yCar); ctx.stroke();
      }

      // ── колесо поверх нитей ──
      ctx.fillStyle=isFix?sec:meas; ctx.globalAlpha=.18;
      ctx.beginPath(); ctx.arc(b.x,b.y,R,0,7); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=isFix?sec:meas; ctx.lineWidth=v.lw(2.6);
      ctx.beginPath(); ctx.arc(b.x,b.y,R,0,7); ctx.stroke();
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.arc(b.x,b.y,R*0.64,0,7); ctx.stroke(); ctx.globalAlpha=1;
      ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(b.x,b.y,v.lw(3),0,7); ctx.fill();

      // ── элементы на концах ──
      for(const side of ['l','r']){
        const it=d.items[b.id+':'+side]; if(!it) continue;
        const a=okSol? sol.vars['a:'+b.id+':'+side] : null;
        drawItem(ropeX(b,side), yEnds, it, b.id+':'+side, a, dirEnds);
      }
      {
        const it=d.items[b.id+':'+carPort];
        const a=(!isFix&&okSol)? sol.vars['aax:'+b.id] : null;
        drawItem(b.x, yCar, it, b.id+':'+carPort, a, dirCar);
      }

      // ── подписи ──
      v.label(ctx, isFix?'неподвижный':'подвижный', b.x, b.y, -28, isFix?-4:-4, isFix?sec:meas);
      if(p.tens && okSol){
        v.label(ctx,`T = ${sol.vars['T:'+b.id].toFixed(1)} Н`, b.x+R+0.12, b.y, 6, -8, ink3);
        if(!isFix) v.label(ctx,`нить снизу 2T = ${sol.vars['Tbot:'+b.id].toFixed(1)} Н`, b.x+R+0.12, b.y, 6, 8, ink3);
      }

      // мигающая подсветка свободных концов
      if(!val.ok){
        for(const port of this.portList(b)){
          if(!d.items[b.id+':'+port]){
            const pp=this.portXY(b,port);
            ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.2); ctx.globalAlpha=.45+0.4*Math.sin(s.t*5);
            ctx.beginPath(); ctx.arc(pp.x,pp.y,0.22,0,7); ctx.stroke(); ctx.globalAlpha=1;
            v.label(ctx,'?',pp.x,pp.y,-3,5,dang);
          }
        }
      }
    }

    // ── статус ──
    if(!d.blocks.length){
      v.label(ctx,'Пустая сетка',0,0.5,-32,0,ink);
      v.label(ctx,'ПКМ → выберите инструмент, затем щёлкните левой кнопкой по сетке',0,0,-190,0,ink3);
      v.label(ctx,'Начните с неподвижного или подвижного блока',0,-0.5,-130,0,ink3);
    } else if(!val.ok){
      v.label(ctx,'СИСТЕМА СОБРАНА НЕВЕРНО',-6.2,3.6,0,0,dang);
      val.prob.slice(0,3).forEach((t,i)=> v.label(ctx,'• '+t,-6.2,3.6,0,18+i*15,ink3));
      v.label(ctx,'красным мигают концы, которые нужно закрыть',-6.2,3.6,0,18+Math.min(val.prob.length,3)*15,dang);
    } else if(okSol){
      v.label(ctx,'Система собрана верно: ускорения и натяжения найдены',-6.2,3.6,0,0,acc);
    }
    if(d.warn){
      v.label(ctx,'✗ '+d.warn,-6.2,-3.5,0,0,dang);
    }
    v.label(ctx,'ПКМ — инструменты · ЛКМ по сетке — новый блок · ЛКМ по креплению — груз, опора или ещё один блок',-6.2,-4,0,0,ink3);
    if(d.blocks.length && !val.ok)
      v.label(ctx,'блок, поставленный на свободное крепление, подвешивается к нему и закрывает его',-6.2,-4,0,16,ink3);
  }
}
});
