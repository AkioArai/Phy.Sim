'use strict';
Object.assign(SIMS,{
/* ================== ГЛ.24: ФОТОЭФФЕКТ (3.1.0) =================
   Опыт Столетова так, как его ставят: вакуумная трубка, свет на катод,
   анод под напряжением U от батареи, амперметр в цепи. Электроны вылетают
   с энергиями от нуля до Eмакс = hf − W₀ и летят к аноду в однородном поле.
   При U < 0 поле их тормозит: долетают только те, у кого E > e|U|, и при
   U = −Eмакс/e ток обрывается — это задерживающее напряжение. Рядом —
   вольт-амперная характеристика с точкой, где стоит ползунок, и «лестница
   энергий»: энергия фотона складывается из работы выхода и энергии электрона.

   До 3.1.0 сцена была россыпью фотонов, подписей и графика без связи между
   ними, и понять из неё ход опыта было трудно. */
photoeffect:{
  title:'Фотоэффект: опыт Столетова',
  schema:true,
  timeless:true,
  hudAware:true,
  params:[
    {key:'metal',label:'Металл катода (работа выхода)',type:'select',default:'na',
     options:[{v:'cs',t:'Цезий — 2,14 эВ'},{v:'na',t:'Натрий — 2,28 эВ'},
              {v:'zn',t:'Цинк — 4,3 эВ'},{v:'pt',t:'Платина — 5,65 эВ'}]},
    {key:'lam', label:'Длина волны света λ',unit:'нм',min:150,max:900,step:5,default:400},
    {key:'inten',label:'Интенсивность света',unit:'%',min:0,max:100,step:5,default:60},
    {key:'U',label:'Напряжение на аноде U (минус — тормозит)',unit:'В',min:-5,max:5,step:0.05,default:1},

    {type:'group',label:'Показывать'},
    {key:'graph',label:'Вольт-амперная характеристика I(U)',type:'check',default:true},
    {key:'ladder',label:'Лестница энергий hf = W₀ + Eмакс',type:'check',default:true}
  ],
  h:6.62607015e-34, e:1.602176634e-19, c:2.99792458e8,
  W:{cs:2.14,na:2.28,zn:4.3,pt:5.65},                    // работа выхода, эВ
  W0(p){ return this.W[p.metal]; },
  freq(p){ return this.c/(p.lam*1e-9); },
  /* энергия фотона E = hf = hc/λ (в эВ) */
  Ephot(p){ return this.h*this.freq(p)/this.e; },
  /* уравнение Эйнштейна: Eмакс = hf − W₀ */
  Emax(p){ return this.Ephot(p)-this.W0(p); },
  lam0(p){ return this.h*this.c/(this.W0(p)*this.e)*1e9; },
  freq0(p){ return this.W0(p)*this.e/this.h; },
  works(p){ return this.Emax(p)>0; },
  Ustop(p){ return Math.max(0,this.Emax(p)); },
  /* Ток в долях тока насыщения. Энергии вылетевших электронов считаем
     распределёнными равномерно от 0 до Eмакс (простая модель: в опыте край
     размыт тепловым движением). При U ≥ 0 долетают все — насыщение; при
     тормозящем — доля с E > e|U|. */
  frac(p,U){ U=U===undefined?p.U:U; const Em=this.Emax(p);
    if(!(Em>0)) return 0; if(U>=0) return 1; return clamp(1+U/Em,0,1); },
  Isat(p){ return this.works(p)? p.inten/100 : 0; },           // в условных единицах
  /* цвет света по длине волны */
  цвет(lam,v){ return lam<380? v.c('--second') : lam<440? '#6d5bd0' : lam<490? '#3b82f6' : lam<560? '#16a34a' :
                  lam<590? '#ca8a04' : lam<630? '#ea580c' : lam<750? '#dc2626' : '#7f1d1d'; },
  /* геометрия трубки: катод слева, анод справа, зазор D */
  K:-2.2, A:2.2, KV:2.6,                                 // KV — скорость (усл./с) электрона с энергией 1 эВ
  init(p){ return {t:0,ph:0,els:[],seed:12345,изл:0,__stop:null}; },
  rnd(s){ s.seed=(s.seed*16807)%2147483647; return s.seed/2147483647; },
  step(s,dt,p){
    s.t+=dt; s.ph+=dt;
    const Em=this.Emax(p), D=this.A-this.K;
    if(Em>0){
      s.изл+=dt*14*p.inten/100;                          // электронов в секунду при 100 %
      while(s.изл>=1){ s.изл-=1;
        const E=Em*this.rnd(s);                          // энергия вылета, эВ
        s.els.push({x:this.K+0.12, y:-1+2*this.rnd(s), E, v:this.KV*Math.sqrt(E)});
      }
    }
    // однородное поле: v² = KV²·(E + U·(x − K)/D)
    const out=[];
    for(const e of s.els){
      const Ek=e.E+p.U*(e.x-this.K)/D;
      const a=this.KV*this.KV*p.U/(2*D);                 // ускорение вдоль x
      e.v+=a*dt; e.x+=e.v*dt;
      if(e.x>=this.A || e.x<=this.K+0.05 || Ek<-0.5) continue;
      out.push(e);
    }
    s.els=out.length>300?out.slice(-300):out;
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const E=this.Ephot(p), W0=this.W0(p), Em=this.Emax(p), ok=Em>0;
    const out=[['длина волны λ',p.lam,'нм'],
      ['частота f = c/λ',this.freq(p)/1e14,'·10¹⁴ Гц'],
      ['энергия фотона E = hf',E,'эВ'],
      ['работа выхода W₀',W0,'эВ'],
      ['красная граница λ₀ = hc/W₀',this.lam0(p),'нм'],
      ['есть ли фотоэффект',ok?1:0, ok?'да: hf > W₀':'нет: фотон слабее работы выхода']];
    if(ok) out.push(['максимальная энергия Eмакс = hf − W₀',Em,'эВ'],
        ['задерживающее напряжение U = Eмакс/e',this.Ustop(p),'В'],
        ['скорость электрона √(2Eмакс/m)',Math.sqrt(2*Em*this.e/9.1093837e-31)/1e6,'·10⁶ м/с']);
    out.push(['напряжение на аноде',p.U,'В'],
      ['ток, доля от насыщения',this.frac(p)*100, ok?'%':'% — электронов нет']);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Натрий, фиолетовый свет — ток есть',values:{metal:'na',lam:400,inten:60,U:1}},
    {name:'Запирание: U = −Eмакс/e',values:{metal:'na',lam:400,inten:60,U:-0.82}},
    {name:'Красный свет — эффекта нет',values:{metal:'na',lam:700,inten:100,U:1}},
    {name:'Ярче — больше ток, запирание то же',values:{metal:'na',lam:400,inten:100,U:-0.5}},
    {name:'Цинк: нужен ультрафиолет',values:{metal:'zn',lam:250,inten:60,U:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-16)/(10.6*PX_PER_M),(H-16)/(10.2*PX_PER_M)),0.002,30);
    return {x:-0.1,y:-0.1,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line'), ok=v.c('--ok');
    const W0=this.W0(p), E=this.Ephot(p), Em=this.Emax(p), works=Em>0, свет=this.цвет(p.lam,v);
    const K=this.K, A=this.A, D=A-K, TY=1.4;             // трубка поднята: под ней цепь и графики
    ctx.save(); ctx.translate(0,TY);
    /* подписи рисуются в экранных координатах мимо ctx.translate — им сдвиг добавляем сами */
    const L=(t,x,y,dx,dy,c)=>v.label(ctx,t,x,y+TY,dx,dy,c);

    /* ---- трубка ---- */
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath();
    { const x=K-0.9, y=-1.7, w=D+1.8, h=3.4, r=0.8;       // скруглённый прямоугольник вручную: roundRect есть не везде
      ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
    ctx.stroke();
    L('вакуум',0,1.7,-20,-8,ink3);
    // катод и анод
    ctx.fillStyle=ink; ctx.fillRect(K-0.18,-1.15,0.18,2.3); ctx.fillRect(A,-1.15,0.18,2.3);
    L(`катод: ${({cs:'цезий',na:'натрий',zn:'цинк',pt:'платина'})[p.metal]}, W₀ = ${W0} эВ`,K,-1.15,-60,16,ink);
    L('анод',A,-1.15,-8,16,ink);

    /* ---- свет: пучок и бегущие фотоны ---- */
    const sx=-4.4, sy=2.9;                               // лампа (в системе трубки)
    ctx.fillStyle=свет; ctx.globalAlpha=p.inten>0?0.16+0.3*p.inten/100:0.05;
    ctx.beginPath(); ctx.moveTo(sx,sy+0.35); ctx.lineTo(K-0.18,0.9); ctx.lineTo(K-0.18,-0.9); ctx.lineTo(sx,sy-0.35); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle=ink3; ctx.beginPath(); ctx.arc(sx,sy,0.35,0,7); ctx.fill();
    L(`λ = ${p.lam} нм, hf = ${E.toFixed(2)} эВ`,sx,sy,-20,-24,свет);
    const nf=Math.round(2+6*p.inten/100);
    if(p.inten>0) for(let i=0;i<nf;i++){
      const u=((s.ph*0.7+i/nf)%1+1)%1, yy=-0.8+1.6*((i*0.37)%1);
      const x=sx+(K-0.2-sx)*u, y=sy+(yy-sy)*u;
      v.photon(ctx,x,y,Math.atan2(yy-sy,K-0.2-sx),{len:0.9,lam:0.28,amp:0.09,phase:s.ph*12,color:свет,lw:1.8});
    }

    /* ---- электроны ---- */
    for(const e of s.els){
      ctx.fillStyle=e.v>=0?meas:dang;
      ctx.beginPath(); ctx.arc(e.x,e.y,v.lw(3.2),0,7); ctx.fill();
    }
    if(!works) L('электроны не вылетают: hf < W₀',0,0.2,-80,0,dang);
    else if(p.U<0) L(`поле тормозит: долетают только E > ${(-p.U).toFixed(2)} эВ`,0,-0.2,-100,0,p.U<=-Em?dang:ink);
    // поле между пластинами
    if(Math.abs(p.U)>0.02){
      ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(3),v.lw(4)]);
      for(const y of [-0.8,0.8]){ v.arrow(ctx,p.U>0?A-0.3:K+0.3,y,p.U>0?K+0.3:A-0.3,y,ink3); }
      ctx.setLineDash(EMPTY_DASH); ctx.globalAlpha=1;
      L('E поля',0,0.8,-18,-10,ink3);
    }

    /* ---- внешняя цепь: батарея и амперметр ---- */
    const yw=-2.6;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.moveTo(K-0.09,-1.15); ctx.lineTo(K-0.09,yw); ctx.lineTo(-0.35,yw);
    ctx.moveTo(0.35,yw); ctx.lineTo(1.1,yw); ctx.moveTo(1.9,yw); ctx.lineTo(A+0.09,yw); ctx.lineTo(A+0.09,-1.15); ctx.stroke();
    // батарея: длинная пластина — плюс
    const плюсСправа=p.U>=0;
    ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.moveTo(плюсСправа?0.35:-0.35,yw-0.45); ctx.lineTo(плюсСправа?0.35:-0.35,yw+0.45);
    ctx.moveTo(плюсСправа?-0.35:0.35,yw-0.22); ctx.lineTo(плюсСправа?-0.35:0.35,yw+0.22); ctx.stroke();
    L(`U = ${p.U>0?'+':''}${p.U.toFixed(2)} В`,0,yw,-34,-22,p.U<0?dang:ok);
    // амперметр
    const I=this.Isat(p)*this.frac(p);
    ctx.fillStyle=v.c('--canvas'); ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.arc(1.5,yw,0.4,0,7); ctx.fill(); ctx.stroke();
    const ang=Math.PI*(0.8-0.6*I);
    ctx.strokeStyle=dang; ctx.beginPath(); ctx.moveTo(1.5,yw-0.15); ctx.lineTo(1.5+0.32*Math.cos(ang),yw-0.15+0.32*Math.sin(ang)); ctx.stroke();
    L(`I = ${(I*100).toFixed(0)} % от насыщения при 100 %`,1.5,yw,-60,26,ink);

    ctx.restore();

    /* ---- лестница энергий: hf = W₀ + Eмакс ---- */
    if(p.ladder){
      const x0=-4.8, y0=-2.2, k=4.2/Math.max(6,E,W0+0.5);
      ctx.fillStyle=свет; ctx.globalAlpha=.85; ctx.fillRect(x0,y0,E*k,0.38); ctx.globalAlpha=1;
      v.label(ctx,`фотон: hf = ${E.toFixed(2)} эВ`,x0,y0+0.38,0,-10,свет);
      ctx.fillStyle=ink3; ctx.globalAlpha=.55; ctx.fillRect(x0,y0-0.6,Math.min(W0,E)*k,0.38); ctx.globalAlpha=1;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.strokeRect(x0,y0-0.6,W0*k,0.38);
      if(works){ ctx.fillStyle=meas; ctx.fillRect(x0+W0*k,y0-0.6,Em*k,0.38); }
      v.label(ctx,`W₀ = ${W0}`,x0,y0-0.6,2,24,ink3);
      v.label(ctx,works?`Eмакс = ${Em.toFixed(2)} эВ`:'фотону не хватает энергии',x0+W0*k,y0-0.6,works?4:-40,24,works?meas:dang);
    }

    /* ---- вольт-амперная характеристика ---- */
    if(p.graph){
      const gx=0.6, gy=-4.7, gw=4.3, gh=2.7, Umin=-5, Umax=5;
      const X=U=>gx+gw*(U-Umin)/(Umax-Umin), Y=I=>gy+gh*I;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.moveTo(X(0),gy); ctx.lineTo(X(0),gy+gh*1.08); ctx.stroke();
      // кривая при 100 % — бледно, при текущей яркости — ярко
      for(const [ярк,alpha,wd] of [[1,0.3,1.2],[p.inten/100,1,2]]){
        ctx.strokeStyle=acc; ctx.globalAlpha=alpha; ctx.lineWidth=v.lw(wd); ctx.beginPath();
        for(let i=0;i<=200;i++){ const U=Umin+(Umax-Umin)*i/200, Ii=(works?ярк:0)*this.frac(p,U);
          i?ctx.lineTo(X(U),Y(Ii)):ctx.moveTo(X(U),Y(Ii)); }
        ctx.stroke();
      }
      ctx.globalAlpha=1;
      if(works && -Em>=Umin){
        ctx.strokeStyle=dang; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(X(-Em),gy); ctx.lineTo(X(-Em),gy+gh*0.6); ctx.stroke(); ctx.setLineDash(EMPTY_DASH);
        v.label(ctx,`−U₃ = −${Em.toFixed(2)} В`,X(-Em),gy,-40,14,dang);
      }
      ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(X(p.U),Y(I),v.lw(4.5),0,7); ctx.fill();
      v.label(ctx,'I',X(0),gy+gh*1.08,4,0,ink3);
      v.label(ctx,'U, В',gx+gw,gy,-30,14,ink3);
      v.label(ctx,'насыщение — растёт с яркостью',X(0.4),Y(1),0,-10,ink3);
    }
  }
},

/* compton и debroglie — в quantum-scenes.js (3.2.0) */

/* uncertainty и box — в quantum-scenes.js (3.2.0) */

/* ================= ГЛ.25: ТУННЕЛЬНЫЙ ЭФФЕКТ ================= */
tunnel:{
  title:'Туннельный эффект: сквозь барьер',
  /* Сцена — график барьера и волновой функции. Поэтому ни осей с числами, ни
     надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'E',label:'Энергия частицы E',unit:'эВ',min:0.1,max:10,step:0.1,default:2},
    {key:'V',label:'Высота барьера V',unit:'эВ',min:0.1,max:10,step:0.1,default:5},
    {key:'a',label:'Ширина барьера a',unit:'нм',min:0.05,max:2,step:0.01,default:0.3},

    {type:'group',label:'Показывать'},
    {key:'wave',label:'Волновая функция',type:'check',default:true},
    {key:'auto',label:'Волна движется',type:'check',default:true}
  ],
  hbar:1.054571817e-34, e:1.602176634e-19, me:9.1093837015e-31,
  /* коэффициент затухания под барьером: κ = √(2m(V−E))/ħ */
  kappa(p){
    if(p.E>=p.V) return 0;
    return Math.sqrt(2*this.me*(p.V-p.E)*this.e)/this.hbar;
  },
  /* точная прозрачность прямоугольного барьера */
  T(p){
    const E=p.E, V=p.V, a=p.a*1e-9;
    if(Math.abs(E-V)<1e-9) {
      const k=Math.sqrt(2*this.me*E*this.e)/this.hbar;
      return 1/(1+(k*a)*(k*a)/4);
    }
    if(E<V){
      const K=this.kappa(p), sh=Math.sinh(K*a);
      return 1/(1+ V*V*sh*sh/(4*E*(V-E)));
    }
    const k2=Math.sqrt(2*this.me*(E-V)*this.e)/this.hbar, sn=Math.sin(k2*a);
    return 1/(1+ V*V*sn*sn/(4*E*(E-V)));
  },
  R(p){ return 1-this.T(p); },
  /* волновое число снаружи */
  k1(p){ return Math.sqrt(2*this.me*p.E*this.e)/this.hbar; },
  lamOut(p){ return 2*Math.PI/this.k1(p)*1e9; },              // нм
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ if(p.auto) s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const T=this.T(p), K=this.kappa(p);
    const out=[['энергия частицы E',p.E,'эВ'],
      ['высота барьера V',p.V,'эВ'],
      ['ширина барьера a',p.a,'нм'],
      ['классически',0, p.E<p.V?'частица НЕ должна пройти':'частица проходит всегда'],
      ['прозрачность T',T,''],
      ['вероятность прохождения',T*100,'%'],
      ['вероятность отражения',this.R(p)*100,'%'],
      ['длина волны снаружи',this.lamOut(p),'нм']];
    if(p.E<p.V){
      out.push(['коэффициент затухания κ',K/1e9,'1/нм'],
        ['глубина проникновения 1/κ',1/K*1e9,'нм'],
        ['оценка exp(−2κa)',Math.exp(-2*K*p.a*1e-9),'']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Тонкий барьер — заметное туннелирование',values:{E:2,V:5,a:0.15}},
    {name:'Шире барьер — прохождение падает резко',values:{E:2,V:5,a:0.6}},
    {name:'Выше барьер — прохождение падает',values:{E:2,V:9,a:0.3}},
    {name:'Энергии почти хватает',values:{E:4.5,V:5,a:0.3}},
    {name:'Энергии хватает — но есть отражение',values:{E:7,V:5,a:0.3}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(10.6*PX_PER_M),(H-30)/(7.4*PX_PER_M)),0.002,30);
    return {x:0,y:2.1,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const T=this.T(p), K=this.kappa(p);
    const AW=clamp(p.a*2.2,0.3,3.2);              // ширина барьера на экране
    const x1=-AW/2, x2=AW/2, SY=clamp(4.2/Math.max(p.V,p.E,1),0.3,1.2);   // энергия в единицы сцены: выше барьер — мельче шкала, но картина во всю высоту
    // ось
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke(); ctx.globalAlpha=1;
    // барьер
    ctx.fillStyle=ink; ctx.globalAlpha=.18; ctx.fillRect(x1,0,AW,p.V*SY); ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(x1,0); ctx.lineTo(x1,p.V*SY); ctx.lineTo(x2,p.V*SY); ctx.lineTo(x2,0); ctx.stroke();
    v.label(ctx,`барьер V = ${p.V} эВ`,x2,p.V*SY,6,-6,ink);
    v.label(ctx,`a = ${p.a} нм`,(x1+x2)/2,0,-22,20,ink3);
    // уровень энергии
    ctx.strokeStyle=dang; ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.lineWidth=v.lw(1.8);
    ctx.beginPath(); ctx.moveTo(-5,p.E*SY); ctx.lineTo(5,p.E*SY); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`E = ${p.E} эВ`,-5,p.E*SY,4,-32,dang);

    // волновая функция
    if(p.wave){
      const A=1.0, base=p.E*SY;
      const kk=clamp(12/Math.max(this.lamOut(p),0.05),3,40);
      const ph=s.t*3;
      /* ВАЖНО: все три участка отсчитывают фазу от общей точки, поэтому волна
         переходит через барьер непрерывно — прошедшая часть выходит ровно в такт
         с той, что вошла. Раньше участки жили по своим часам и не сходились. */
      const rR=Math.sqrt(Math.max(0,1-T)), sT=Math.sqrt(Math.max(T,0));
      const NORM=1/(1+rR);
      const evan=p.E<p.V;
      // волновое число внутри барьера: под барьером волна не бежит, только затухает
      const kIn = evan ? 0 : clamp(12/Math.max(2*Math.PI/(Math.sqrt(2*this.me*(p.E-p.V)*this.e)/this.hbar)*1e9,0.05),3,40);
      const ampIn = x => evan ? Math.pow(Math.max(sT,1e-6),(x-x1)/AW)
                              : 1+(sT-1)*(x-x1)/AW;
      // падающая + отражённая слева
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=240;i++){ const x=-5+(x1+5)*i/240;
        const inc=Math.cos(kk*(x-x1)-ph);
        const ref=rR*Math.cos(kk*(x1-x)-ph);
        const y=base+0.75*A*NORM*(inc+ref);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      v.label(ctx,'падающая + отражённая',-4.9,base+1.3,0,0,meas);
      // под барьером — затухание без бега
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=200;i++){
        const x=x1+AW*i/200;
        const y=base+0.75*A*ampIn(x)*Math.cos(kIn*(x-x1)-ph);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.stroke();
      // огибающая затухания — тонким пунктиром, чтобы читалось, что амплитуда падает
      if(evan){
        ctx.strokeStyle=sec; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
        for(const sgn of [1,-1]){
          ctx.beginPath();
          for(let i=0;i<=60;i++){ const x=x1+AW*i/60;
            const y=base+sgn*0.75*A*ampIn(x); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
          ctx.stroke();
        }
        ctx.setLineDash([]); ctx.globalAlpha=1;
      }
      // прошедшая справа — продолжает фазу, накопленную в барьере
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=240;i++){ const x=x2+(5-x2)*i/240;
        const y=base+0.75*A*sT*Math.cos(kk*(x-x2)+kIn*AW-ph);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      v.label(ctx,`прошедшая: T = ${(T*100).toFixed(T<0.01?3:1)}%`,5,base+1.0,-104,0,acc);
    }
    // вывод
    const txt = p.E<p.V
      ? `классически частица отскочила бы, но T = ${(T*100).toFixed(T<0.01?3:1)}% — она проходит сквозь барьер`
      : `энергии хватает, но часть волны всё равно отражается: T = ${(T*100).toFixed(1)}%`;
    v.label(ctx,txt,0,-0.6,-Math.round(txt.length*3),0,p.E<p.V?dang:ink3);
    if(p.E<p.V) v.label(ctx,'прозрачность падает экспоненциально с шириной и высотой барьера',0,-0.6,-142,16,ink3);
    v.label(ctx,'на этом работают туннельный микроскоп и альфа-распад',0,-0.6,-118,32,ink3);
  }
},

/* ================= ГЛ.26: БОРОВСКАЯ МОДЕЛЬ АТОМА ВОДОРОДА ================= */
bohr:{
  title:'Атом водорода: модель Бора',
  /* Сцена — орбиты в своём масштабе: радиус Бора — десятые доли нанометра.
     Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'n',label:'Номер орбиты n',min:1,max:6,step:1,default:1},

    {type:'group',label:'Показывать'},
    {key:'wave', label:'Волна де Бройля на орбите',type:'check',default:true},
    {key:'levels',label:'Лестница уровней',type:'check',default:true},
    {key:'anim',  label:'Движение электрона',type:'check',default:true}
  ],
  E1:-13.605693, a0:0.052917721,                    // эВ и нм
  h:6.62607015e-34, hbar:1.054571817e-34, me:9.1093837015e-31, e:1.602176634e-19,
  /* уровни энергии: E_n = −13,6 эВ / n² */
  E(n){ return this.E1/(n*n); },
  /* радиусы орбит: r_n = n²·a₀ */
  r(n){ return n*n*this.a0; },
  /* скорость на орбите из условия квантования m·v·r = n·ħ */
  vOrb(n){ return n*this.hbar/(this.me*this.r(n)*1e-9); },
  /* длина волны де Бройля электрона на этой орбите */
  lamDB(n){ return this.h/(this.me*this.vOrb(n))*1e9; },       // нм
  /* сколько длин волн укладывается на орбите: должно быть ровно n */
  wavesOnOrbit(n){ return 2*Math.PI*this.r(n)/this.lamDB(n); },
  ionization(n){ return -this.E(n); },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; if(p.anim) s.ph+=dt*1.6/Math.pow(p.n,1.5); },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const n=p.n;
    return [['номер орбиты n',n,''],
      ['энергия Eₙ = −13,6/n²',this.E(n),'эВ'],
      ['радиус rₙ = n²·a₀',this.r(n),'нм'],
      ['боровский радиус a₀',this.a0,'нм'],
      ['скорость электрона',this.vOrb(n)/1e6,'·10⁶ м/с'],
      ['доля от скорости света',this.vOrb(n)/2.99792458e8,''],
      ['длина волны де Бройля',this.lamDB(n),'нм'],
      ['длин волн на орбите',this.wavesOnOrbit(n),'(должно быть n)'],
      ['энергия ионизации с этого уровня',this.ionization(n),'эВ'],
      ['следующий уровень Eₙ₊₁',this.E(n+1),'эВ'],
      ['разность до следующего',this.E(n+1)-this.E(n),'эВ']];
  },
  graphs:[],
  presets:[
    {name:'Основное состояние n = 1',values:{n:1}},
    {name:'Первое возбуждённое n = 2',values:{n:2}},
    {name:'n = 3: три волны на орбите',values:{n:3}},
    {name:'Далёкая орбита n = 6',values:{n:6}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(11*PX_PER_M),(H-30)/(8*PX_PER_M)),0.002,30);
    return {x:0.3,y:-0.2,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const CX=-2.2, n=p.n;
    /* Радиусы орбит растут как n²: от первой до шестой — в 36 раз. В одном
       масштабе первая орбита сливается с ядром (так и было до 3.1.0: электрон
       на n = 1 был не виден). Поэтому масштаб берётся по ТЕКУЩЕЙ орбите — она
       всегда радиусом 2,2, — а соседние рисуются в том же масштабе, пока
       помещаются. Отношение радиусов при этом честное. */
    const SC=2.2/this.r(n);
    // ядро
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(CX,0,v.lw(5),0,7); ctx.fill();
    v.label(ctx,'протон',CX,0,-18,18,dang);
    // орбиты: текущая и соседние, если помещаются
    for(let k=1;k<=6;k++){
      const R=this.r(k)*SC, on=(k===n);
      if(!on && (R<0.25 || R>3.3)) continue;
      ctx.strokeStyle=on?acc:ink3; ctx.globalAlpha=on?1:.35; ctx.lineWidth=v.lw(on?1.8:1);
      if(!on){ ctx.setLineDash([v.lw(3),v.lw(4)]); }
      ctx.beginPath(); ctx.arc(CX,0,R,0,7); ctx.stroke();
      ctx.setLineDash(EMPTY_DASH); ctx.globalAlpha=1;
      v.label(ctx,`n = ${k}`,CX+R*0.71,R*0.71,4,-4,on?acc:ink3);
    }
    const R=this.r(n)*SC;
    v.label(ctx,`масштаб: r = ${n}²·a₀ = ${this.r(n).toFixed(3)} нм`,CX,-R,-70,26,ink3);
    // волна де Бройля вдоль орбиты: ровно n длин волн
    if(p.wave){
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=400;i++){
        const a=i/400*2*Math.PI;
        const rr=R+0.18*Math.sin(n*a - (p.anim? s.ph*3:0));
        const x=CX+rr*Math.cos(a), y=rr*Math.sin(a);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.stroke();
      v.label(ctx,`ровно ${n} ${n===1?'длина волны':(n<5?'длины волн':'длин волн')} — волна замыкается`,CX,R,-110,-14,sec);
    }
    // электрон
    const ea=s.ph;
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(CX+R*Math.cos(ea),R*Math.sin(ea),0.13,0,7); ctx.fill();
    v.label(ctx,'e⁻',CX+R*Math.cos(ea),R*Math.sin(ea),-4,-12,meas);

    // лестница уровней
    if(p.levels){
      const gx=1.5, gy=-2.6, gh=4.6;
      // энергии от −13.6 до 0
      const Y=E=>gy+gh*(1-(E/this.E1));
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,'E, эВ',gx,gy+gh,-44,4,ink3);
      // уровень ионизации
      ctx.strokeStyle=dang; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(gx,Y(0)); ctx.lineTo(gx+1.4,Y(0)); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'0 эВ — электрон свободен',gx+1.5,Y(0),2,-14,dang);
      /* Уровни n ≥ 4 лежат в полосе шириной меньше эВ: подписать каждый нельзя —
         раскладчик разводил подписи, и они уезжали к чужим линиям («n = 6»
         оказывалась под n = 2). Подписываем первые три и выбранный уровень. */
      for(let k=1;k<=8;k++){
        const E=this.E(k), y=Y(E), on=(k===n);
        ctx.strokeStyle=on?acc:ink3; ctx.globalAlpha=on?1:.55; ctx.lineWidth=v.lw(on?2.4:1.2);
        ctx.beginPath(); ctx.moveTo(gx,y); ctx.lineTo(gx+(on?1.4:1.1),y); ctx.stroke(); ctx.globalAlpha=1;
        if(k<=3 || on) v.label(ctx,`n = ${k}:  ${E.toFixed(2)} эВ`,gx+1.5,y,2,0,on?acc:ink3);
      }
      if(n<4) v.label(ctx,'n = 4, 5, 6 … — всё теснее',gx+1.5,Y(this.E(5)),2,-12,ink3);
      v.label(ctx,'уровни сгущаются к нулю',gx,gy,0,20,ink3);
    }
    v.label(ctx,`E_${n} = ${this.E(n).toFixed(3)} эВ,  r_${n} = ${this.r(n).toFixed(4)} нм`,CX,-3.4,-84,0,ink3);
    v.label(ctx,'орбита устойчива, если на ней укладывается целое число волн де Бройля',CX,-3.4,-160,16,ink3);
  }
},

/* hspectrum — в quantum-scenes.js (3.2.0) */

/* ================= ГЛ.26: ОРБИТАЛИ ВОДОРОДА В ОБЪЁМЕ (3.1.0) =================
   Облако вероятности |ψ_nlm|² строится по точной волновой функции атома
   водорода, а не по картинке из учебника:

       ψ = R_nl(r)·Y_lm(θ, φ),
       R_nl ∝ ρ^l·e^(−ρ/2)·L_(n−l−1)^(2l+1)(ρ),   ρ = 2r/(n·a₀),

   L — обобщённые многочлены Лагерра, Y — сферические функции (действительные
   для «химических» орбиталей px, dxy… или комплексные с определённым m).
   Плотность распадается на произведение радиальной и угловой частей, поэтому
   точки облака разыгрываются точно: радиус — по r²R², направление — по |Y|².
   Никакой подгонки: где у функции узел, там точек нет вовсе.

   Сцену вращают протягиванием (rotate3d). Разрез плоскостью показывает, что
   внутри: у 3s — три слоя, у 3p — узловая сфера и узловая плоскость.

   До 3.1.0 здесь было плоское пятно для трёх состояний — 1s, 2s и 2p. */
orbital:{
  title:'Орбитали водорода: s, p, d, f, g в объёме',
  schema:true,
  timeless:true,
  rotate3d:true,
  hudAware:true,
  params:[
    {key:'n',label:'Главное квантовое число n',min:1,max:6,step:1,default:3},
    {key:'l',label:'Орбитальное l (0 … n − 1): s, p, d, f, g, h',min:0,max:5,step:1,default:2},
    {key:'m',label:'Магнитное m (−l … l)',min:-5,max:5,step:1,default:0},
    {key:'kind',label:'Вид орбиталей',type:'select',default:'real',
     options:[{v:'real',t:'Химические (px, dxy …): действительные'},
              {v:'complex',t:'С определённым m: |ψ|² симметрична вокруг z'}]},

    {type:'group',label:'Показывать'},
    {key:'pts',label:'Точек в облаке',min:1000,max:30000,step:1000,default:9000},
    {key:'phase',label:'Знак ψ цветом (+ и −)',type:'check',default:true},
    {key:'slice',label:'Разрез: только тонкий слой',type:'check',default:false},
    {key:'axes',label:'Оси x, y, z',type:'check',default:true},
    {key:'radial',label:'Радиальное распределение P(r)',type:'check',default:true},
    {key:'spin',label:'Медленно вращать',type:'check',default:true}
  ],
  a0:0.052917721,                                     // нм
  SPD:'spdfgh',
  /* допустимые числа: l ≤ n − 1, |m| ≤ l — ползунки независимы, поэтому
     лишнее обрезаем здесь и честно пишем об этом на панели */
  q(p){ const n=Math.max(1,Math.round(p.n)), l=Math.max(0,Math.min(Math.round(p.l),n-1));
    const m=Math.max(-l,Math.min(Math.round(p.m),l)); return {n,l,m}; },
  имя(p){
    const {n,l,m}=this.q(p), L=this.SPD[l];
    if(p.kind==='complex') return `${n}${L}, m = ${m>0?'+':''}${m}`;
    const T={1:{0:'z',1:'x','-1':'y'},
             2:{0:'z²',1:'xz','-1':'yz',2:'x²−y²','-2':'xy'},
             3:{0:'z³',1:'xz²','-1':'yz²',2:'z(x²−y²)','-2':'xyz',3:'x(x²−3y²)','-3':'y(3x²−y²)'}};
    return `${n}${L}`+(l===0?'':(T[l]?T[l][m]:`, m = ${m>0?'+':''}${m}`));
  },
  /* обобщённый многочлен Лагерра L_k^α(x) — по рекуррентной формуле */
  laguerre(k,a,x){
    if(k===0) return 1;
    let L0=1, L1=1+a-x;
    for(let j=1;j<k;j++){ const L2=((2*j+1+a-x)*L1-(j+a)*L0)/(j+1); L0=L1; L1=L2; }
    return L1;
  },
  /* присоединённая функция Лежандра P_l^m(x), m ≥ 0 */
  legendre(l,m,x){
    let pmm=1; const s=Math.sqrt(Math.max(0,1-x*x));
    for(let i=1;i<=m;i++) pmm*=-(2*i-1)*s;
    if(l===m) return pmm;
    let pm1=x*(2*m+1)*pmm; if(l===m+1) return pm1;
    let pl=0;
    for(let k=m+2;k<=l;k++){ pl=((2*k-1)*x*pm1-(k+m-1)*pmm)/(k-m); pmm=pm1; pm1=pl; }
    return pl;
  },
  R(n,l,r){ const ρ=2*r/n; return Math.pow(ρ,l)*Math.exp(-ρ/2)*this.laguerre(n-l-1,2*l+1,ρ); },
  Y(l,m,kind,ct,φ){
    const P=this.legendre(l,Math.abs(m),ct);
    if(kind==='complex' || m===0) return P;
    return m>0 ? P*Math.cos(m*φ) : P*Math.sin(-m*φ);
  },
  /* Радиальная таблица: P(r) = r²R² на сетке (в единицах a₀), нормированная,
     её накопленная сумма — для розыгрыша радиуса, и сводка: максимум, среднее,
     граница 99 %, радиальные узлы. Кэшируется по (n, l). */
  _rad:{},
  rad(n,l){
    const key=n+','+l; if(this._rad[key]) return this._rad[key];
    const Rmax=n*(2*n+12), N=6000, dr=Rmax/N, r=new Float64Array(N+1), P=new Float64Array(N+1), C=new Float64Array(N+1);
    let s=0;
    for(let i=0;i<=N;i++){ const x=i*dr, R=this.R(n,l,x); r[i]=x; P[i]=x*x*R*R; }
    for(let i=1;i<=N;i++){ s+=(P[i]+P[i-1])/2*dr; C[i]=s; }
    for(let i=0;i<=N;i++){ P[i]/=s; C[i]/=s; }
    let im=0; for(let i=1;i<=N;i++) if(P[i]>P[im]) im=i;
    let mean=0; for(let i=1;i<=N;i++) mean+=(r[i]*P[i]+r[i-1]*P[i-1])/2*dr;
    let i99=0; while(i99<N && C[i99]<0.99) i99++;
    const узлы=[]; for(let i=2;i<N;i++){ const a=this.R(n,l,r[i-1]), b=this.R(n,l,r[i]); if((a>0&&b<=0)||(a<0&&b>=0)) узлы.push(r[i]); }
    return (this._rad[key]={r,P,C,dr,N,rMax:r[im],mean,r99:r[i99],узлы,norm:s});
  },
  /* облако точек: радиус по таблице, направление — отбором по |Y|² */
  _cloud:{},
  cloud(p){
    const {n,l,m}=this.q(p);
    // в разрезе остаётся примерно пятая часть точек — их и разыгрываем впятеро больше
    const N=Math.min(60000,(Math.round(p.pts)||9000)*(p.slice?5:1)), key=[n,l,m,p.kind,N].join(',');
    if(this._cloud[key]) return this._cloud[key];
    let z=0x9e3779b9^(n*131+l*17+(m+7)*3+(p.kind==='real'?1:2));
    const rnd=()=>{ z|=0; z=z+0x6D2B79F5|0; let t=Math.imul(z^z>>>15,1|z); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
    const T=this.rad(n,l);
    let ymax=0;
    for(let i=0;i<=120;i++) for(let j=0;j<=60;j++){ const y=this.Y(l,m,p.kind,-1+2*i/120,j*Math.PI/30); if(y*y>ymax) ymax=y*y; }
    const xs=new Float32Array(N), ys=new Float32Array(N), zs=new Float32Array(N), sg=new Int8Array(N);
    for(let k=0;k<N;k++){
      // радиус: обратная функция распределения, двоичный поиск
      const u=rnd(); let lo=0, hi=T.N; while(hi-lo>1){ const md=(lo+hi)>>1; if(T.C[md]<u) lo=md; else hi=md; }
      const r=T.r[lo]+(T.r[hi]-T.r[lo])*((u-T.C[lo])/Math.max(1e-12,T.C[hi]-T.C[lo]));
      let ct, φ, y, охрана=0;
      do{ ct=-1+2*rnd(); φ=2*Math.PI*rnd(); y=this.Y(l,m,p.kind,ct,φ); } while(y*y<rnd()*ymax && ++охрана<5000);
      const st=Math.sqrt(1-ct*ct);
      xs[k]=r*st*Math.cos(φ); ys[k]=r*st*Math.sin(φ); zs[k]=r*ct;
      sg[k]=(this.R(n,l,r)*y)>=0?1:-1;
    }
    // держим в кэше немного облаков: переключаться туда-обратно — мгновенно
    const ks=Object.keys(this._cloud); if(ks.length>12) delete this._cloud[ks[0]];
    return (this._cloud[key]={xs,ys,zs,sg,N});
  },
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const {n,l,m}=this.q(p), T=this.rad(n,l);
    const обрезано=(n!==p.n||l!==p.l||m!==p.m);
    const out=[['орбиталь',this.имя(p),''],
      ['квантовые числа n, l, m',`${n}, ${l}, ${m}`, обрезано?'— подправлено: l ≤ n − 1, |m| ≤ l':''],
      ['энергия E = −13,6 эВ/n²',-13.605693/(n*n),'эВ'],
      ['радиальных узлов n − l − 1',n-l-1,''],
      ['угловых узлов l',l,''],
      ['момент |L| = √(l(l+1))·ħ',Math.sqrt(l*(l+1)),'ħ'],
      ['проекция Lz',p.kind==='complex'||m===0 ? m : NaN,
        p.kind==='complex'||m===0 ? 'ħ' : 'ħ — не определена: орбиталь — смесь +m и −m'],
      ['наиболее вероятный r',T.rMax,'a₀'],
      ['среднее ⟨r⟩',T.mean,'a₀'],
      ['⟨r⟩ в нанометрах',T.mean*this.a0,'нм'],
      ['99 % вероятности внутри r',T.r99,'a₀'],
      ['нормировка ∫P(r)dr',T.C[T.N],'']];
    return out;
  },
  graphs:[],
  presets:[
    {name:'1s — основное состояние',values:{n:1,l:0,m:0,kind:'real',slice:false}},
    {name:'2p_z — «гантель»',values:{n:2,l:1,m:0,kind:'real',slice:false}},
    {name:'3s в разрезе: три слоя',values:{n:3,l:0,m:0,kind:'real',slice:true}},
    {name:'3d_z² — гантель с кольцом',values:{n:3,l:2,m:0,kind:'real',slice:false}},
    {name:'3d_xy — четыре лепестка',values:{n:3,l:2,m:-2,kind:'real',slice:false}},
    {name:'4f_xyz — восемь лепестков',values:{n:4,l:3,m:-2,kind:'real',slice:false}},
    {name:'5g, m = 0',values:{n:5,l:4,m:0,kind:'real',slice:false}},
    {name:'2p, m = +1 — бублик вокруг z',values:{n:2,l:1,m:1,kind:'complex',slice:false}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, {n,l}=this.q(p), R=this.rad(n,l).r99;
    const w=p.radial?3.6*R:2.3*R, h=2.35*R;
    const scale=clamp(Math.min((W-20)/(w*PX_PER_M),(H-20)/(h*PX_PER_M)),0.0005,40);
    return {x:p.radial?0.65*R:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), dang=v.c('--danger'), meas=v.c('--measure'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const {n,l,m}=this.q(p), T=this.rad(n,l), R=T.r99, C=this.cloud(p);
    const пр=v.p3(null, p.spin ? s.t*0.25 : 0);
    // оси
    if(p.axes){
      const L=R*1.08;
      for(const [ax,ay,az,им] of [[1,0,0,'x'],[0,1,0,'y'],[0,0,1,'z']]){
        const a=пр(-L*ax,-L*ay,-L*az), b=пр(L*ax,L*ay,L*az);
        ctx.strokeStyle=line; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
        v.label(ctx,им,b[0],b[1],4,-4,ink3);
      }
    }
    // облако: дальние точки бледнее и мельче — объём читается без освещения
    const cp=p.phase && p.kind==='real' ? [acc,dang] : [acc,acc];
    const w=v.lw(1.9), толщина=R*0.09;
    const ц=[[],[]];
    for(let k=0;k<C.N;k++){
      const q=пр(C.xs[k],C.ys[k],C.zs[k]);
      if(p.slice && Math.abs(q[2])>толщина) continue;
      ц[C.sg[k]>0?0:1].push(q);
    }
    for(let c=0;c<2;c++){
      ctx.fillStyle=cp[c];
      for(const q of ц[c]){
        const d=q[2]/R;                                  // −1 … 1, к зрителю — больше
        ctx.globalAlpha=p.slice?0.7:clamp(0.32+0.28*d,0.1,0.65);
        const r=w*(p.slice?1:(0.9+0.35*d));
        ctx.fillRect(q[0]-r/2,q[1]-r/2,r,r);
      }
    }
    ctx.globalAlpha=1;
    // ядро
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(0,0,v.lw(2.5),0,7); ctx.fill();
    v.label(ctx,this.имя(p),-R,R,0,4,acc);
    if(p.phase && p.kind==='real' && l>0) v.label(ctx,'цвет — знак ψ: соседние лепестки противоположны',-R,R,0,22,ink3);
    else if(p.kind==='complex' && m!==0) v.label(ctx,'|ψ|² не зависит от угла φ: облако — тело вращения вокруг z',-R,R,0,22,ink3);
    v.label(ctx,'протяните по сцене, чтобы повернуть',-R,-R,0,-2,ink3);

    // радиальное распределение P(r) со всеми узлами
    if(p.radial){
      const gx=R*1.25, gy=-R*0.55, gw=R*1.05, gh=R*1.0;
      let Pm=0; for(let i=0;i<=T.N;i++) if(T.P[i]>Pm) Pm=T.P[i];
      const X=r=>gx+gw*Math.min(1,r/R), Y=P=>gy+gh*P/Pm;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy+gh*1.05); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      ctx.fillStyle=acc; ctx.globalAlpha=.14; ctx.beginPath(); ctx.moveTo(gx,gy);
      for(let i=0;i<=T.N;i+=4){ if(T.r[i]>R) break; ctx.lineTo(X(T.r[i]),Y(T.P[i])); }
      ctx.lineTo(X(R),gy); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=T.N;i+=4){ if(T.r[i]>R) break; i?ctx.lineTo(X(T.r[i]),Y(T.P[i])):ctx.moveTo(X(T.r[i]),Y(T.P[i])); }
      ctx.stroke();
      for(const r0 of T.узлы){ if(r0>R) continue;
        ctx.strokeStyle=dang; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(X(r0),gy); ctx.lineTo(X(r0),gy+gh*0.6); ctx.stroke(); ctx.setLineDash(EMPTY_DASH); }
      ctx.strokeStyle=meas; ctx.beginPath(); ctx.moveTo(X(T.mean),gy); ctx.lineTo(X(T.mean),gy+gh*0.95); ctx.stroke();
      v.label(ctx,'P(r) = r²R²',gx,gy+gh,4,-10,ink3);
      v.label(ctx,`r, a₀ → ${R.toFixed(0)}`,gx+gw,gy,-50,12,ink3);
      v.label(ctx,`⟨r⟩ = ${T.mean.toFixed(1)} a₀`,X(T.mean),gy+gh*0.95,4,-6,meas);
      if(T.узлы.length) v.label(ctx,`узлов: ${T.узлы.length} (пунктир)`,gx,gy,0,26,dang);
    }
  }
}
,

/* ================== ГЛ.27: ПРИНЦИП ПАУЛИ И ЗАПОЛНЕНИЕ ОБОЛОЧЕК ================= */
pauli:{
  title:'Принцип Паули: как заполняются оболочки',
  /* Сцена — схема заполнения оболочек. Поэтому ни осей с числами, ни надписи
     «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'Z',label:'Номер элемента Z',min:1,max:36,step:1,default:6},

    {type:'group',label:'Показывать'},
    {key:'boxes',label:'Клетки состояний со стрелками спина',type:'check',default:true},
    {key:'shells',label:'Ёмкость оболочек 2n²',type:'check',default:true}
  ],
  /* порядок заполнения подоболочек (правило Клечковского) */
  order:[[1,0],[2,0],[2,1],[3,0],[3,1],[4,0],[3,2],[4,1],[5,0],[4,2],[5,1]],
  lName:['s','p','d','f'],
  names:['','H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
         'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr'],
  ruName:['','водород','гелий','литий','бериллий','бор','углерод','азот','кислород','фтор','неон',
    'натрий','магний','алюминий','кремний','фосфор','сера','хлор','аргон','калий','кальций','скандий',
    'титан','ванадий','хром','марганец','железо','кобальт','никель','медь','цинк','галлий','германий',
    'мышьяк','селен','бром','криптон'],
  /* известные отклонения от простого порядка заполнения */
  exceptions:{24:'[Ar] 3d⁵ 4s¹',29:'[Ar] 3d¹⁰ 4s¹'},
  /* ёмкость подоболочки: 2(2l+1) — учитывает 2l+1 значений m и два направления спина */
  cap(l){ return 2*(2*l+1); },
  shellCap(n){ return 2*n*n; },
  /* заполнение подоболочек по порядку */
  fill(p){
    let left=p.Z; const out=[];
    for(const [n,l] of this.order){
      if(left<=0) break;
      const c=Math.min(this.cap(l),left);
      out.push({n,l,e:c}); left-=c;
    }
    return out;
  },
  config(p){
    return this.fill(p).map(q=>`${q.n}${this.lName[q.l]}${q.e>1?this.sup(q.e):''}`).join(' ');
  },
  sup(k){ const m={0:'⁰',1:'¹',2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷',8:'⁸',9:'⁹'};
    return String(k).split('').map(d=>m[d]).join(''); },
  /* электроны на каждой оболочке n */
  byShell(p){
    const sh={};
    for(const q of this.fill(p)) sh[q.n]=(sh[q.n]||0)+q.e;
    return sh;
  },
  /* валентные электроны — на внешней оболочке */
  valence(p){
    const sh=this.byShell(p), ns=Object.keys(sh).map(Number);
    const nmax=Math.max(...ns);
    return sh[nmax];
  },
  isNoble(p){ return [2,10,18,36].includes(p.Z); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const f=this.fill(p), sh=this.byShell(p);
    const out=[['номер элемента Z',p.Z,''],
      ['элемент',0,`${this.names[p.Z]} — ${this.ruName[p.Z]}`],
      ['электронов всего',p.Z,''],
      ['конфигурация',0,this.config(p)]];
    for(const n of Object.keys(sh)) out.push([`оболочка n=${n}: электронов`,sh[n],`из ${this.shellCap(+n)}`]);
    out.push(['валентных электронов',this.valence(p),''],
      ['благородный газ',this.isNoble(p)?1:0,this.isNoble(p)?'да — оболочка замкнута':'нет']);
    if(this.exceptions[p.Z]) out.push(['внимание',0,`у этого элемента порядок нарушен: ${this.exceptions[p.Z]}`]);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Водород: один электрон',values:{Z:1}},
    {name:'Гелий: первая оболочка замкнута',values:{Z:2}},
    {name:'Углерод: основа органики',values:{Z:6}},
    {name:'Неон: замкнутая вторая оболочка',values:{Z:10}},
    {name:'Натрий: один электрон сверх неона',values:{Z:11}},
    {name:'Железо: заполняется 3d',values:{Z:26}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const f=this.fill(p);
    // заголовок
    v.label(ctx,`${this.names[p.Z]} (Z = ${p.Z}) — ${this.ruName[p.Z]}`,-5.2,3.3,0,0,acc);
    v.label(ctx,`конфигурация: ${this.config(p)}`,-5.2,3.3,0,18,ink3);

    // клетки состояний
    if(p.boxes){
      let y=2.3;
      for(const q of f){
        const cells=2*q.l+1;                       // число значений m
        v.label(ctx,`${q.n}${this.lName[q.l]}`,-5.2,y,0,4,ink);
        let placed=0;
        for(let c=0;c<cells;c++){
          const x=-4.3+c*0.62;
          ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2);
          ctx.strokeRect(x,y-0.2,0.5,0.4);
          /* Правило Хунда: сначала по одному электрону «спином вверх» в каждую
             клетку, и только потом — вторые, со спином вниз. До 3.1.0 клетки
             заполнялись парами подряд, и у углерода оба 2p-электрона сидели
             в одной клетке — так в атоме не бывает. */
          for(let sp=0;sp<2;sp++){
            const idx=sp*cells+c;
            if(idx>=q.e) continue;
            const ex=x+0.15+sp*0.2;
            ctx.strokeStyle=sp?meas:dang; ctx.lineWidth=v.lw(1.6);
            ctx.beginPath();
            if(sp===0){ ctx.moveTo(ex,y-0.14); ctx.lineTo(ex,y+0.14); ctx.moveTo(ex-0.05,y+0.08); ctx.lineTo(ex,y+0.14); ctx.lineTo(ex+0.05,y+0.08); }
            else { ctx.moveTo(ex,y+0.14); ctx.lineTo(ex,y-0.14); ctx.moveTo(ex-0.05,y-0.08); ctx.lineTo(ex,y-0.14); ctx.lineTo(ex+0.05,y-0.08); }
            ctx.stroke();
            placed++;
          }
        }
        v.label(ctx,`${q.e} из ${this.cap(q.l)}`,-4.3+cells*0.62,y,6,4,ink3);
        y-=0.62;
      }
      v.label(ctx,'в клетке не больше двух электронов, и спины у них разные',-5.2,-3.2,0,0,ink3);
      v.label(ctx,'клетки подоболочки заселяются сначала по одному (правило Хунда)',-5.2,-3.2,0,16,ink3);
    }

    // оболочки
    if(p.shells){
      const sh=this.byShell(p);
      const CX=3.2;
      ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(CX,0.4,0.18,0,7); ctx.fill();
      v.label(ctx,`+${p.Z}`,CX,0.4,-7,4,'#fff');
      let k=0;
      for(const n of Object.keys(sh).map(Number).sort((a,b)=>a-b)){
        const R=0.55+n*0.42, full=(sh[n]===this.shellCap(n));
        ctx.strokeStyle=full?acc:ink3; ctx.globalAlpha=full?1:.6; ctx.lineWidth=v.lw(full?1.8:1.2);
        ctx.beginPath(); ctx.arc(CX,0.4,R,0,7); ctx.stroke(); ctx.globalAlpha=1;
        /* Электроны обращаются вокруг ядра. Скорость падает с номером оболочки,
           как и должно быть: у Бора v ∝ 1/n, поэтому внутренние идут заметно быстрее. */
        const cnt=sh[n], spin=s.t*1.5/n;
        for(let i=0;i<cnt;i++){
          const a=i/cnt*2*Math.PI - Math.PI/2 + spin;
          const ex=CX+R*Math.cos(a), ey=0.4+R*Math.sin(a);
          // короткий след по ходу движения
          ctx.strokeStyle=full?acc:meas; ctx.globalAlpha=.28; ctx.lineWidth=v.lw(1.6);
          ctx.beginPath();
          for(let q=0;q<=6;q++){ const aa=a-q*0.055;
            const xx=CX+R*Math.cos(aa), yy=0.4+R*Math.sin(aa);
            q?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); }
          ctx.stroke(); ctx.globalAlpha=1;
          ctx.fillStyle=full?acc:meas;
          ctx.beginPath(); ctx.arc(ex,ey,v.lw(2.6),0,7); ctx.fill();
        }
        // подписи оболочек разносим по вертикали, иначе они ложатся друг на друга
        v.label(ctx,`n=${n}: ${cnt}/${this.shellCap(n)}`,CX,0.4+R,10,-6-k*0,full?acc:ink3);
        k++;
      }
      if(this.isNoble(p)) v.label(ctx,'все оболочки замкнуты — благородный газ',CX,-2.4,-84,0,acc);
      else v.label(ctx,`валентных электронов: ${this.valence(p)}`,CX,-2.4,-52,0,ink3);
    }
    if(this.exceptions[p.Z])
      v.label(ctx,`у этого элемента порядок заполнения нарушен: ${this.exceptions[p.Z]}`,-5.2,-3.4,0,0,dang);
  }
},

/* ================= ГЛ.27: ПЕРИОДИЧЕСКАЯ СИСТЕМА ================= */
periodic:{
  title:'Периодическая система: откуда берётся периодичность',
  /* Сцена — таблица, а не пространство. Поэтому ни осей с числами, ни
     надписи «сетка N м». */
  schema:true,
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'Z',label:'Элемент Z',min:1,max:36,step:1,default:11},

    {type:'group',label:'Показывать'},
    {key:'graph',label:'График энергии ионизации',type:'check',default:true},
    {key:'table',label:'Таблица элементов',type:'check',default:true}
  ],
  names:['','H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
         'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr'],
  /* измеренные первые энергии ионизации, эВ */
  ion:[0,13.598,24.587,5.392,9.323,8.298,11.260,14.534,13.618,17.423,21.565,
       5.139,7.646,5.986,8.152,10.487,10.360,12.968,15.760,4.341,6.113,6.561,
       6.828,6.746,6.767,7.434,7.902,7.881,7.640,7.726,9.394,5.999,7.900,9.789,
       9.752,11.814,14.000],
  nobles:[2,10,18,36], alkali:[3,11,19],
  E(p){ return this.ion[p.Z]; },
  period(p){
    const Z=p.Z;
    if(Z<=2) return 1; if(Z<=10) return 2; if(Z<=18) return 3; return 4;
  },
  kind(p){
    if(this.nobles.includes(p.Z)) return 'благородный газ: оболочка замкнута';
    if(this.alkali.includes(p.Z)) return 'щелочной металл: один электрон сверху';
    if([9,17,35].includes(p.Z)) return 'галоген: не хватает одного электрона';
    return 'обычный элемент';
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    return [['элемент',0,`${this.names[p.Z]} (Z = ${p.Z})`],
      ['период',this.period(p),''],
      ['энергия ионизации',this.E(p),'эВ'],
      ['тип',0,this.kind(p)],
      ['максимум периода — благородный газ',0,'He 24,6 · Ne 21,6 · Ar 15,8 · Kr 14,0'],
      ['минимум периода — щелочной металл',0,'Li 5,4 · Na 5,1 · K 4,3']];
  },
  graphs:[],
  presets:[
    {name:'Натрий: минимум ионизации',values:{Z:11}},
    {name:'Неон: пик — замкнутая оболочка',values:{Z:10}},
    {name:'Аргон: следующий пик',values:{Z:18}},
    {name:'Калий: снова провал',values:{Z:19}},
    {name:'Хлор: галоген',values:{Z:17}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(13*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    /* Раскладка: таблица занимает верх сцены, график — низ, между ними зазор.
       Раньше они делили одну область и налезали друг на друга. */
    // график энергии ионизации
    if(p.graph){
      const gx=-5.6, gy=-3.0, gw=11.2, gh=2.9, Emax=26;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      ctx.globalAlpha=1;
      v.label(ctx,'энергия ионизации, эВ',gx+gw,gy+gh,-150,-4,ink3);
      v.label(ctx,'Z',gx+gw,gy,8,4,ink3);
      const X=Z=>gx+gw*(Z/36), Y=E=>gy+gh*(E/Emax);
      // кривая
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let Z=1;Z<=36;Z++){ const x=X(Z), y=Y(this.ion[Z]); Z===1?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      ctx.stroke();
      // точки: благородные газы и щелочные металлы
      for(let Z=1;Z<=36;Z++){
        const noble=this.nobles.includes(Z), alk=this.alkali.includes(Z);
        if(!noble&&!alk) continue;
        ctx.fillStyle=noble?dang:sec;
        ctx.beginPath(); ctx.arc(X(Z),Y(this.ion[Z]),v.lw(3),0,7); ctx.fill();
        v.label(ctx,this.names[Z],X(Z),Y(this.ion[Z]),-5,noble?-13:19,noble?dang:sec);
      }
      // текущий элемент
      ctx.strokeStyle=meas; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(X(p.Z),gy); ctx.lineTo(X(p.Z),Y(this.E(p))); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(X(p.Z),Y(this.E(p)),v.lw(4),0,7); ctx.fill();
      // подпись текущего элемента уводим в сторону, чтобы не легла на кривую
      v.label(ctx,`${this.names[p.Z]}: ${this.E(p).toFixed(2)} эВ`,
        X(p.Z), Y(this.E(p)), X(p.Z)>gx+gw*0.72? -96 : 10, -8, meas);
      v.label(ctx,'пики — благородные газы, провалы — щелочные металлы',gx,gy,2,22,ink3);
    }
    /* Таблица — в настоящей раскладке: 18 столбцов, s-элементы слева,
       p-элементы справа, d-элементы с 4-го периода. Символы рисуются без
       раскладки подписей (v.text): до 3.1.0 раскладчик разводил их, и символы
       съезжали в соседние клетки, а «период N» — к чужим строкам. */
    if(p.table){
      const c=0.62, x0=-5.58, y0=3.45;
      const место=Z=>{ if(Z===1) return [0,0]; if(Z===2) return [17,0];
        if(Z<=10) return [Z<=4?Z-3:Z-10+17,1]; if(Z<=18) return [Z<=12?Z-11:Z-18+17,2]; return [Z-19,3]; };
      for(let Z=1;Z<=36;Z++){
        const [col,row]=место(Z), x=x0+col*c, y=y0-row*c;
        const on=(Z===p.Z), noble=this.nobles.includes(Z), alk=this.alkali.includes(Z), d=Z>=21&&Z<=30;
        ctx.fillStyle= on? acc : (noble? dang : (alk? sec : ink3));
        ctx.globalAlpha= on?1:(noble||alk?.35:(d?.12:.2));
        ctx.fillRect(x+0.03,y-c/2+0.03,c-0.06,c-0.06);
        ctx.globalAlpha=1;
        v.text(ctx,this.names[Z],x+c/2,y,on?'#fff':ink,10,'center',on);
      }
      for(let r=0;r<4;r++) v.text(ctx,`${r+1}`,x0-0.12,y0-r*c,ink3,10,'right');
      v.text(ctx,'период',x0-0.12,y0+c*0.85,ink3,9,'right');
      v.text(ctx,'s',x0+c,y0+c*0.8,ink3,9); v.text(ctx,'d (с 4-го периода)',x0+c*6.5,y0-c*2,ink3,9); v.text(ctx,'p',x0+c*15,y0+c*0.8,ink3,9);
      v.label(ctx,'каждый период кончается благородным газом — замкнутой оболочкой',x0,y0-3.5*c,0,4,ink3);
    }
    // итоговая подпись — под графиком, в свободной полосе
    v.label(ctx,`${this.names[p.Z]} — ${this.kind(p)}`,0,-3.5,
      -Math.round((this.names[p.Z].length+this.kind(p).length+3)*3),0,acc);
  }
},

/* xray — в quantum-scenes.js (3.2.0) */
});
