'use strict';
Object.assign(SIMS,{
/* ================== КИНЕТИЧЕСКАЯ ТЕОРИЯ: ГАЗ В ЯЩИКЕ ================= */
gas:{
  title:'Газ: молекулы, давление, температура',
  /* Сцена — сосуд в условном масштабе: молекулы во столько же раз крупнее.
     Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  params:[
    {key:'N',   label:'Число молекул N',min:5,max:400,step:5,default:120},
    {key:'T',   label:'Температура T',unit:'K',min:20,max:1200,step:10,default:300},
    {key:'Lx',  label:'Ширина сосуда',unit:'усл.ед.',min:4,max:20,step:0.5,default:12},
    {key:'Ly',  label:'Высота сосуда',unit:'усл.ед.',min:4,max:20,step:0.5,default:9},
    {key:'mMol',label:'Относит. масса молекул',min:0.2,max:8,step:0.1,default:1},

    {type:'group',label:'Показывать'},
    {key:'trails',label:'Следы молекул',type:'check',default:false},
    {key:'histo', label:'Гистограмма скоростей (Максвелл)',type:'check',default:true},
    {key:'fast',  label:'Подсветить быстрые молекулы',type:'check',default:true},

    {type:'group',label:'Нагреватель / охладитель'},
    {key:'heater',label:'Включить',type:'check',default:false},
    {key:'Tset', label:'Довести температуру до',unit:'K',min:20,max:1200,step:10,default:600},
    {key:'theat',label:'За время',unit:'с',min:0.5,max:30,step:0.5,default:5},

    {type:'group',label:'Поршень (демонстрация закона Бойля)'},
    {key:'piston',label:'Сжимать поршнем',type:'check',default:false},
    {key:'pistonX',label:'Положение поршня (доля ширины)',min:0.3,max:1,step:0.05,default:1},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  kB:1.0,                                        // условная постоянная Больцмана (модельные единицы)
  /* среднеквадратичная скорость из T: ½m⟨v²⟩ = (в 2D) kT → v_rms = √(2kT/m) */
  vrms(p){ return Math.sqrt(2*this.kB*p.T/p.mMol)*0.02; },   // масштаб под сцену
  init(p){
    const mol=[], v=this.vrms(p), wx=p.Lx*(p.piston?p.pistonX:1);
    for(let i=0;i<p.N;i++){
      const ang=Math.random()*2*Math.PI;
      /* Скорости раздаём по РАСПРЕДЕЛЕНИЮ МАКСВЕЛЛА. В двух измерениях его
         плотность p(v) ∝ v·exp(−mv²/2kT) (распределение Рэлея), и разыгрывается
         она в одну строку: v = v_ср.кв·√(−ln ξ) при ξ равномерном на (0,1].
         Тогда ⟨v²⟩ = v_ср.кв² РОВНО, и измеренная температура совпадает с
         заданной. Раньше стояло v·(0,5 + ξ) — равномерная полоса от 0,5v до
         1,5v: у неё ⟨v²⟩ = 13/12·v², то есть газ был на 8 % горячее, чем
         показывал ползунок, а «гистограмма Максвелла» изображала бы ровную
         полку вместо горба. */
      const speed=v*Math.sqrt(-Math.log(1-Math.random()));
      mol.push({x:0.3+Math.random()*(wx-0.6), y:0.3+Math.random()*(p.Ly-0.6),
                vx:speed*Math.cos(ang), vy:speed*Math.sin(ang),
                trail:[]});
    }
    return {t:0, mol, wallHits:0, impulse:0, pressAcc:0, pressN:0, Pema:null,
            Tstart:p.T, Tnow:p.T, event:null, __stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
    const wx=p.Lx*(p.piston?p.pistonX:1), r=0.12*Math.sqrt(p.mMol);
    let imp=0;                                    // импульс, переданный стенкам за шаг
    const sub=3, h=dt/sub;
    for(let k=0;k<sub;k++){
      for(const m of s.mol){
        m.x+=m.vx*h*60; m.y+=m.vy*h*60;
        if(m.x<r){ m.x=r; m.vx=Math.abs(m.vx); imp+=2*p.mMol*Math.abs(m.vx); }
        if(m.x>wx-r){ m.x=wx-r; m.vx=-Math.abs(m.vx); imp+=2*p.mMol*Math.abs(m.vx); }
        if(m.y<r){ m.y=r; m.vy=Math.abs(m.vy); imp+=2*p.mMol*Math.abs(m.vy); }
        if(m.y>p.Ly-r){ m.y=p.Ly-r; m.vy=-Math.abs(m.vy); imp+=2*p.mMol*Math.abs(m.vy); }
      }
    }
    // давление ≈ импульс на стенки / (периметр · время)
    const perim=2*(wx+p.Ly);
    const Pinst=imp/(perim*dt);
    s.pressAcc+=Pinst; s.pressN++;
    /* скользящее среднее с постоянной времени ~0,4 с: давление успевает
       откликнуться и на сдвиг поршня, и на работу нагревателя, но не дрожит */
    const alpha=clamp(dt/0.4,0,1);
    s.Pema = (s.Pema==null) ? Pinst : s.Pema + (Pinst - s.Pema)*alpha;
    if(p.trails){ for(const m of s.mol){ m.trail.push([m.x,m.y]); if(m.trail.length>25) m.trail.shift(); } }
    s.wallHits++;
    /* НАГРЕВАТЕЛЬ / ОХЛАДИТЕЛЬ.
       Физику не ломаем: это внешний тепловой резервуар. Он плавно подводит (или отводит)
       энергию, равномерно масштабируя скорости всех молекул. Форма максвелловского
       распределения при таком масштабировании сохраняется, а давление меняется само
       собой — просто потому, что молекулы начинают бить по стенкам сильнее. */
    if(p.heater){
      const frac=clamp(s.t/Math.max(p.theat,1e-6),0,1);
      const Twant=(s.Tstart!=null?s.Tstart:p.T)+(p.Tset-(s.Tstart!=null?s.Tstart:p.T))*frac;
      const M=this.measure(s,p), Tnow=M.Tkin;
      s.Tnow=Tnow; s.Twant=Twant;
      if(Tnow>1e-9){
        // за один шаг подтягиваем не более чем на несколько процентов — иначе рывок
        const lamFull=Math.sqrt(Twant/Tnow);
        const lam=clamp(lamFull,1-6*dt,1+6*dt);
        for(const m of s.mol){ m.vx*=lam; m.vy*=lam; }
      }
    } else { s.Tnow=this.measure(s,p).Tkin; s.Twant=null; }
  },
  /* измеренные величины */
  measure(s,p){
    let sumV2=0; for(const m of s.mol) sumV2+=m.vx*m.vx+m.vy*m.vy;
    const meanV2=sumV2/Math.max(s.mol.length,1);
    const vrms=Math.sqrt(meanV2);
    const wx=p.Lx*(p.piston?p.pistonX:1), V=wx*p.Ly;
    const P=(s.Pema!=null)?s.Pema:(s.pressN>0?s.pressAcc/s.pressN:0);
    // кинетическая температура: ½m⟨v²⟩ = kT (2D) → T = m⟨v²⟩/2k, обратный масштаб
    const Tkin=p.mMol*meanV2/(2*this.kB)/(0.02*0.02);
    return {vrms,meanV2,V,P,Tkin,wx,PV:P*V};
  },
  anchors(s,p){ return [{x:0,y:0},{x:p.Lx,y:p.Ly}]; },
  /* поршень можно двигать левой кнопкой мыши */
  dragPoints(p){
    if(!p.piston) return [];
    return [{x:p.Lx*p.pistonX, y:p.Ly/2}];
  },
  dragMove(p,idx,x,y){
    const f=clamp(x/Math.max(p.Lx,1e-6),0.3,1);
    p.pistonX=Math.round(f*100)/100;
  },
  readouts(s,p){
    const M=this.measure(s,p);
    return [['t',s.t,'с'],['число молекул N',p.N,''],['температура T',p.T,'K'],
            ['объём V',M.V,'усл.ед.²'],['давление P',M.P,'усл.ед.'],
            ['P·V',M.PV,'усл.ед.'],['P·V / N',M.PV/p.N,'≈ kT'],
            ['средне-квадр. скорость',M.vrms,'усл.ед.'],
            ['⟨v²⟩',M.meanV2,'усл.ед.²'],['ударов о стенки',s.wallHits,''],
            ['измеренная температура газа',M.Tkin,'K'],
            ...(p.heater?[
              ['нагреватель',0,p.Tset>(s.Tstart||p.T)?'нагревает':'охлаждает'],
              ['цель',p.Tset,'K'],
              ['время выхода',p.theat,'с'],
              ['прогресс',clamp(s.t/Math.max(p.theat,1e-6),0,1)*100,'%'],
              ['сейчас требуется',s.Twant!=null?s.Twant:p.T,'K'],
              ['расхождение с целью',Math.abs(M.Tkin-(s.Twant!=null?s.Twant:p.T)),'K']
            ]:[])];
  },
  graphs:[
    {label:'Давление во времени',unit:'усл.ед.',series:['P'],
     get(s,p){ const M=SIMS.gas.measure(s,p); return [M.P,null]; }},
    {label:'P·V (закон Бойля: постоянно при T=const)',unit:'усл.ед.',series:['PV'],
     get(s,p){ return [SIMS.gas.measure(s,p).PV,null]; }}
  ],
  presets:[
    {name:'Комнатная температура',values:{N:120,T:300,Lx:12,Ly:9,mMol:1,piston:false,tStop:0}},
    {name:'Нагрев: молекулы быстрее',values:{N:120,T:900,Lx:12,Ly:9,mMol:1,piston:false,tStop:0}},
    {name:'Охлаждение: молекулы медленнее',values:{N:120,T:80,Lx:12,Ly:9,mMol:1,piston:false,tStop:0}},
    {name:'Мало молекул — виден хаос',values:{N:20,T:300,Lx:12,Ly:9,mMol:1,piston:false,tStop:0}},
    {name:'Тяжёлые молекулы медленнее лёгких',values:{N:120,T:300,Lx:12,Ly:9,mMol:6,piston:false,tStop:0}},
    {name:'Закон Бойля: сжатие поршнем',values:{N:120,T:300,Lx:12,Ly:9,mMol:1,piston:true,pistonX:0.55,tStop:0}},
    {name:'Нагреватель: 300 → 900 K за 5 с',values:{N:120,T:300,Lx:12,Ly:9,mMol:1,heater:true,Tset:900,theat:5,piston:false,tStop:0}},
    {name:'Охладитель: 600 → 100 K за 8 с',values:{N:120,T:600,Lx:12,Ly:9,mMol:1,heater:true,Tset:100,theat:8,piston:false,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const spanX=p.Lx*1.15, spanY=p.Ly*1.35;
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:p.Lx/2,y:p.Ly/2,scale};
  },
  draw(ctx,s,v,p){
    const wx=p.Lx*(p.piston?p.pistonX:1), r=0.12*Math.sqrt(p.mMol);
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2');
    // сосуд
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.5);
    ctx.strokeRect(0,0,wx,p.Ly);
    // поршень
    if(p.piston && p.pistonX<1){
      ctx.fillStyle=v.c('--second'); ctx.globalAlpha=.5;
      ctx.fillRect(wx,0,p.Lx-wx,p.Ly); ctx.globalAlpha=1;
      ctx.strokeStyle=v.c('--second'); ctx.lineWidth=v.lw(4);
      ctx.beginPath(); ctx.moveTo(wx,0); ctx.lineTo(wx,p.Ly); ctx.stroke();
      // рукоятка: за неё поршень тянут мышью
      ctx.fillStyle=v.c('--second');
      ctx.beginPath(); ctx.arc(wx,p.Ly/2,0.28,0,7); ctx.fill();
      ctx.strokeStyle=v.c('--panel'); ctx.lineWidth=v.lw(1.6);
      ctx.beginPath(); ctx.moveTo(wx-0.1,p.Ly/2-0.1); ctx.lineTo(wx-0.1,p.Ly/2+0.1);
      ctx.moveTo(wx+0.1,p.Ly/2-0.1); ctx.lineTo(wx+0.1,p.Ly/2+0.1); ctx.stroke();
      v.label(ctx,'поршень — тяните мышью',wx,p.Ly/2,12,0,v.c('--second'));
    }
    // средняя скорость для подсветки быстрых
    const M=this.measure(s,p), vr=M.vrms;
    // следы
    if(p.trails&&v.quality!=='low'){
      ctx.strokeStyle=acc; ctx.globalAlpha=.2; ctx.lineWidth=v.lw(1);
      for(const m of s.mol){ if(m.trail.length>1){ ctx.beginPath();
        m.trail.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke(); } }
      ctx.globalAlpha=1;
    }
    // молекулы
    for(const m of s.mol){
      const sp=Math.hypot(m.vx,m.vy);
      ctx.fillStyle = (p.fast && sp>vr*1.3) ? dang : acc;
      ctx.beginPath(); ctx.arc(m.x,m.y,r,0,7); ctx.fill();
    }

        v.label(ctx,`T = ${p.T} K   v_ср.кв = ${vr.toFixed(3)}`,0,-0.3,0,0,v.c('--ink-3'));
    // шкала температуры справа (0…1200 K): за неё тянет ручка «T»
    const px=1/ppm(), xT=p.Lx+0.5, T=s.Tnow!=null?s.Tnow:p.T;
    ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=1*px; ctx.beginPath(); ctx.moveTo(xT,0); ctx.lineTo(xT,p.Ly); ctx.stroke();
    ctx.fillStyle=АРТ.ц(АРТ.цветT(T),0.9); ctx.fillRect(xT-0.06,0,0.12,p.Ly*clamp(T/1200,0,1));
  }
}
,

/* ========== КИНЕТИЧЕСКАЯ ТЕОРИЯ: МИКРО- И МАКРОСОСТОЯНИЯ ==========
   Модель урны Эренфестов. В ящике N пронумерованных молекул; в перегородке
   есть дырка, и время от времени случайно выбранная молекула переходит на
   другую сторону. МИКРОсостояние — полный список «кто где». МАКРОсостояние —
   только число молекул слева n: их не различают. Число микросостояний в
   макросостоянии — статистический вес W = C(N,n), а S = k·lnW.

   Вся суть главы про необратимость видна на одном ползунке N: при N = 4
   система то и дело сама возвращается в «все слева», а при N = 200 среднее
   время возврата больше возраста Вселенной, хотя ни один закон механики
   этого не запрещает. */
micro:{
  title:'Микро- и макросостояния: откуда берётся необратимость',
  hudAware:true,
  /* Сцена — ящик с ячейками, метров на ней нет. Поэтому ни осей с числами,
     ни надписи «сетка N м». */
  schema:true,
  params:[
    {key:'N',    label:'Число молекул N',min:2,max:200,step:1,default:60},
    {key:'rate', label:'Переходов через дырку в секунду',unit:'1/с',min:1,max:400,step:1,default:60},
    {key:'left', label:'Начать со всех молекул слева',type:'check',default:true},

    {type:'group',label:'Показывать'},
    {key:'bars', label:'Веса макросостояний W(n)',type:'check',default:true},
    {key:'obs',  label:'Наблюдённую частоту (поверх W)',type:'check',default:true},
    {key:'nums', label:'Номера молекул (при N ≤ 20)',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  Lx:12, Ly:8,                                    // размеры ящика (усл. ед.)
  /* ln n! — таблицей, чтобы факториалы не переполняли double */
  lnFact(n){ const T=this._lf||(this._lf=[0]);
    for(let i=T.length;i<=n;i++) T[i]=T[i-1]+Math.log(i);
    return T[n]; },
  /* статистический вес макросостояния: сколько микросостояний ему отвечает */
  lnW(N,n){ return this.lnFact(N)-this.lnFact(n)-this.lnFact(N-n); },
  W(N,n){ return Math.exp(this.lnW(N,n)); },
  /* Ячейка молекулы №i. Ячейка закреплена ЗА МОЛЕКУЛОЙ, а не за порядковым
     номером среди «тех, кто сейчас слева»: иначе один переход перетасовывал бы
     всю картинку, и глазом было бы не поймать, кто именно перескочил. */
  slot(i,leftSide,N){
    const cols=Math.max(2,Math.ceil(Math.sqrt(N))), rows=Math.ceil(N/cols);
    const row=Math.floor(i/cols), col=i%cols;
    const w=this.Lx/2-1.2, h=this.Ly-1.6;
    const x=0.6+(col+0.5)*w/cols + (leftSide?0:this.Lx/2+0.1);
    const y=0.8+(row+0.5)*h/rows;
    return [x,y];
  },
  init(p){
    const side=[];                                 // true — молекула слева
    for(let i=0;i<p.N;i++) side.push(p.left?true:Math.random()<0.5);
    const cnt=new Array(p.N+1).fill(0);
    const n=side.filter(Boolean).length;
    cnt[n]=1;
    return {t:0, side, n, acc:0, moves:0, cnt, samples:1,
            returns:0, tRet:null, flash:0, last:-1, event:null, __stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
    if(s.side.length!==p.N){ Object.assign(s,this.init(p)); s.t=t; return; }
    s.flash=Math.max(0,s.flash-dt*4);
    /* число переходов за шаг накапливаем: при rate·dt < 1 переход случается
       не каждый кадр, и это честнее, чем «двигать по чуть-чуть» */
    s.acc+=p.rate*dt;
    while(s.acc>=1){
      s.acc-=1;
      const i=Math.floor(Math.random()*p.N);
      s.side[i]=!s.side[i];
      s.n+=s.side[i]?1:-1;
      s.last=i; s.flash=1; s.moves++;
      s.cnt[s.n]++; s.samples++;
      /* возврат в исходное «всё слева» — то самое событие, которое в
         макросистеме не наступает никогда */
      if(s.n===p.N && s.last!==-1){ s.returns++; s.tRet=s.t; }
    }
  },
  /* среднее время возврата в состояние «все слева»: обратная вероятность,
     делённая на частоту переходов. Для N = 200 это 10⁵² лет. */
  tReturn(p){ return Math.pow(2,p.N)/Math.max(p.rate,1e-9); },
  anchors(s,p){ return [{x:this.Lx/2,y:this.Ly/2}]; },
  readouts(s,p){
    const N=p.N, n=s.n, W=this.W(N,n), Wmax=this.W(N,Math.round(N/2));
    const tr=this.tReturn(p);
    return [['t',s.t,'с'],
      ['молекул N',N,''],
      ['макросостояние: слева n',n,''],
      ['справа N − n',N-n,''],
      ['всего микросостояний 2^N',Math.pow(2,N),''],
      ['вес макросостояния W = C(N,n)',W,'микросостояний'],
      ['ln W',this.lnW(N,n),''],
      ['энтропия S = k·lnW  →  S/k',this.lnW(N,n),''],
      ['доля от самого вероятного W/W_max',W/Wmax,''],
      ['вероятность этого макросостояния',W/Math.pow(2,N),''],
      ['вероятность «все слева» 2^−N',Math.pow(2,-N),''],
      ['среднее время возврата «все слева»',tr,'с'],
      ['оно же в годах',tr/3.156e7,'лет'],
      ['переходов через дырку',s.moves,''],
      ['возвратов в «все слева» наблюдалось',s.returns,'']];
  },
  graphs:[
    {label:'Молекул слева n(t)',unit:'шт',series:['n','N/2'],
     get(s,p){ return [s.n,p.N/2]; }},
    {label:'Энтропия S/k = ln W',unit:'',series:['S/k','max'],
     get(s,p){ return [SIMS.micro.lnW(p.N,s.n),SIMS.micro.lnW(p.N,Math.round(p.N/2))]; }}
  ],
  presets:[
    {name:'Микросистема N = 4: возвраты видны глазом',values:{N:4,rate:6,left:true,nums:true,tStop:0}},
    {name:'N = 10: возврат раз в сотню переходов',values:{N:10,rate:20,left:true,nums:true,tStop:0}},
    {name:'N = 30: возврата можно не дождаться',values:{N:30,rate:60,left:true,nums:false,tStop:0}},
    {name:'Макросистема N = 200: необратимость',values:{N:200,rate:400,left:true,nums:false,tStop:0}},
    {name:'Старт из случайного состояния',values:{N:60,rate:60,left:false,nums:false,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-60)/(this.Lx*1.15*PX_PER_M),(H-160)/(12.8*PX_PER_M)),0.002,30);
    return {x:this.Lx/2,y:1.2,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'),
          ink=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    const Lx=this.Lx, Ly=this.Ly, N=p.N, n=s.n;
    if(s.side.length!==N) return;

    // ---- ящик и перегородка с дыркой
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.5); ctx.strokeRect(0,0,Lx,Ly);
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2); ctx.beginPath();
    ctx.moveTo(Lx/2,0);      ctx.lineTo(Lx/2,Ly/2-0.7);
    ctx.moveTo(Lx/2,Ly/2+0.7); ctx.lineTo(Lx/2,Ly);
    ctx.stroke();
    /* подпись дырки — ПОД ящиком: внутри она неизбежно легла бы на молекулы,
       которые заполняют обе половины вплотную к перегородке */
    /* подписи раскладываются по строкам в ПИКСЕЛЯХ (st — высота строки в
       единицах сцены): при любом масштабе строки не наезжают друг на друга */
    const st=14*(v.textK||1)/ppm();
    v.text(ctx,'↑ дырка в перегородке',Lx/2,-st*0.8,ink3,10,'center');

    // ---- молекулы: каждая в своей ячейке, номера — только у микросистемы
    const r=clamp(2.2/Math.sqrt(N),0.10,0.34);
    for(let i=0;i<N;i++){
      const L=s.side[i];
      const [x,y]=this.slot(i,L,N);
      ctx.fillStyle = (i===s.last&&s.flash>0) ? meas : (L?acc:sec);
      ctx.globalAlpha = (i===s.last&&s.flash>0) ? 1 : .9;
      ctx.beginPath(); ctx.arc(x,y,r*(i===s.last?1+0.6*s.flash:1),0,7); ctx.fill();
      ctx.globalAlpha=1;
      if(p.nums&&N<=20) v.label(ctx,String(i+1),x,y,-3,-1,v.c('--panel'));
    }

    // ---- макросостояние крупно над ящиком
    v.text(ctx,`макросостояние: слева ${n}, справа ${N-n}`,Lx/2,Ly+st*1.9,ink,11,'center',true);
    v.text(ctx,`микросостояний у него W = C(${N},${n}) = ${числоНаСцене(this.W(N,n),4)}`,Lx/2,Ly+st*0.8,ink3,10,'center');
    if(n===N) v.text(ctx,'✔ все слева — исходное состояние вернулось!',Lx/2,Ly+st*3,ok,11,'center',true);

    // ---- гистограмма весов W(n): «гора» с острым пиком у макросистемы
    if(p.bars){
      const gh=2.6, gx=0, gy=-st*4.2-gh, gw=Lx;
      const lnMax=this.lnW(N,Math.round(N/2));
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      const bw=gw/(N+1);
      for(let k=0;k<=N;k++){
        const h=gh*Math.exp(this.lnW(N,k)-lnMax);     // W(k)/W_max — от 0 до 1
        if(h<gh*0.004 && k!==n) continue;
        ctx.fillStyle = (k===n)?meas:acc; ctx.globalAlpha=(k===n)?1:.45;
        ctx.fillRect(gx+k*bw, gy, Math.max(bw*0.85, v.lw(1)/PX_PER_M), Math.max(h,k===n?gh*0.02:0));
        ctx.globalAlpha=1;
      }
      /* наблюдённая частота: сколько времени система реально провела в каждом
         макросостоянии. Она ложится на кривую W(n) — это и есть смысл
         «равновероятны микросостояния, а не макросостояния». */
      if(p.obs&&s.samples>20){
        const mx=Math.max(...s.cnt);
        if(mx>0){
          ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
          for(let k=0;k<=N;k++){
            const x=gx+(k+0.42)*bw, y=gy+gh*s.cnt[k]/mx;
            k?ctx.lineTo(x,y):ctx.moveTo(x,y);
          }
          ctx.stroke();
          v.text(ctx,'— как часто наблюдалось',gx,gy+gh+st*1.9,sec,10,'left',true);
        }
      }
      /* Одна строка вместо трёх: подпись оси и пояснение к столбикам. Три
         отдельные подписи толкались друг с другом под ящиком. */
      v.text(ctx,'▇ W(n): микросостояний',gx,gy+gh+st*0.8,acc,10,'left',true);
      v.text(ctx,'n = 0',gx,gy-st*0.8,ink3,9.5,'left'); v.text(ctx,`n = ${N}`,gx+gw,gy-st*0.8,ink3,9.5,'right');
      v.text(ctx,'слева молекул n →',gx+gw/2,gy-st*0.8,ink3,9.5,'center');
    }

    // ---- вывод главы: одна строка, ради которой всё и затевалось
    const tr=this.tReturn(p), yr=tr/3.156e7;
    const when = yr>1e6 ? `${числоНаСцене(yr)} лет` : (tr>90? `${(tr/60).toFixed(1)} мин` : `${tr.toFixed(1)} с`);
    const y=КС.абзац(ctx,v,`вероятность «все слева» = 2^−${N}; среднее время возврата ≈ ${when}`,-0.4,(p.bars?-st*5.8-2.6:-st*2.5),Lx+0.8,ink3,10,'center');
    КС.абзац(ctx,v, N<=12 ? 'микросистема: возвраты случаются — необратимости нет'
                       : 'макросистема: возврат не запрещён, но не наступит никогда — это и есть II начало',-0.4,y,Lx+0.8,N<=12?ok:meas,10,'center',true);
  }
}
,

/* ================== ТЕРМОДИНАМИКА: PV-ДИАГРАММА И ПРОЦЕССЫ ================= */
thermo:{
  title:'Термодинамика: газ, поршень, процессы',
  /* Сцена — цилиндр и PV-диаграмма: по осям давление и объём. Поэтому ни
     осей с числами, ни надписи «сетка N м». */
  schema:true,
  params:[
    {key:'proc',label:'Процесс',type:'select',default:'iso',
     options:[{v:'iso', t:'Изотермический (T = const)'},
              {v:'isobar',t:'Изобарический (P = const)'},
              {v:'isochor',t:'Изохорический (V = const)'},
              {v:'adiab',t:'Адиабатический (Q = 0)'},
              {v:'line',t:'По прямой на pV-диаграмме'},
              {v:'poly',t:'Политропический (pVⁿ = const)'}]},
    {key:'n',  label:'Количество вещества ν',unit:'моль',min:0.1,max:5,step:0.1,default:1},
    {key:'T0', label:'Начальная температура T₀',unit:'K',min:100,max:1000,step:10,default:300},
    {key:'V0', label:'Начальный объём V₀',unit:'л',min:1,max:40,step:0.5,default:10},
    {key:'Vend',label:'Конечный объём V',unit:'л',min:1,max:40,step:0.5,default:25},
    {key:'gamma',label:'Показатель адиабаты γ',min:1.1,max:1.67,step:0.01,default:1.5},
    {key:'Pend',label:'Конечное давление p',unit:'кПа',min:5,max:2000,step:1,default:100,если:p=>p.proc==='line'},
    {key:'npoly',label:'Показатель политропы n',min:-3,max:3,step:0.05,default:1.2,если:p=>p.proc==='poly'},

    {type:'group',label:'Нагреватель / охладитель (для изохоры)'},
    {key:'Tend',label:'Конечная температура T',unit:'K',min:100,max:1200,step:10,default:600},

    {type:'group',label:'Второй участок процесса'},
    {key:'proc2',label:'Затем',type:'select',default:'none',
     options:[{v:'none',t:'— нет, процесс один'},{v:'iso',t:'изотерма'},{v:'isobar',t:'изобара'},{v:'isochor',t:'изохора'},{v:'adiab',t:'адиабата'}]},
    {key:'V2',label:'Объём в конце второго участка',unit:'л',min:1,max:40,step:0.5,default:20,если:p=>p.proc2&&p.proc2!=='none'&&p.proc2!=='isochor'},
    {key:'T2',label:'Температура в конце второго участка',unit:'K',min:100,max:1200,step:10,default:400,если:p=>p.proc2==='isochor'},

    {type:'group',label:'Показывать'},
    {key:'showWork',label:'Площадь работы под кривой',type:'check',default:true},
    {key:'showMol', label:'Молекулы в цилиндре',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  R:8.314,
  /* Один участок процесса из состояния (V₀ л, P₀ Па, T₀) по прогрессу u ∈ [0, 1].
     ц — цель участка: объём V, давление P (для прямой), показатель n
     (для политропы), температура T (для изохоры). */
  участок(p,тип,V0л,P0,T0,ц,u){
    const R=this.R, ν=p.n;
    if(тип==='isochor'){ const Vm=V0л/1000, T=T0+(ц.T-T0)*u; return {V:V0л,Vm,P:ν*R*T/Vm,T}; }
    const V=V0л+(ц.V-V0л)*u, Vm=V/1000, V0=V0л/1000;
    let P;
    if(тип==='iso') P=P0*V0/Vm;
    else if(тип==='isobar') P=P0;
    else if(тип==='line') P=P0+(ц.P-P0)*u;
    else if(тип==='poly') P=P0*Math.pow(V0/Vm,ц.n);
    else P=P0*Math.pow(V0/Vm,p.gamma);
    return {V,Vm,P,T:P*Vm/(ν*R)};
  },
  /* 9.5.0: процесс может состоять из двух участков подряд (proc2): газ,
     скажем, сначала изобарно расширяют, затем изохорно охлаждают. Тогда
     u ∈ [0, ½] — первый участок, u ∈ [½, 1] — второй. Почти все задачи
     вида «газ перевели из состояния 1 в состояние 3 через 2» решаются
     здесь без бумаги: теплота, работа и ΔU считаются по всему пути. */
  цепь(p){ return p.proc2&&p.proc2!=='none'; },
  stateAt(p,u){
    const V0=p.V0/1000, P0=p.n*this.R*p.T0/V0;
    const ц1={V:p.Vend,P:(p.Pend||100)*1000,n:p.npoly==null?1.2:p.npoly,T:p.Tend};
    const к=st=>Object.assign(st,{P0,V0});
    if(!this.цепь(p)) return к(this.участок(p,p.proc,p.V0,P0,p.T0,ц1,u));
    if(u<=0.5) return к(this.участок(p,p.proc,p.V0,P0,p.T0,ц1,u*2));
    const b=this.участок(p,p.proc,p.V0,P0,p.T0,ц1,1);
    return к(this.участок(p,p.proc2,b.V,b.P,b.T,{V:p.V2==null?20:p.V2,T:p.T2==null?400:p.T2},(u-0.5)*2));
  },
  /* Работа газа = ∫P dV, по Симпсону; у цепочки — по каждому участку
     отдельно, чтобы излом в точке ½ не портил точность. */
  workTo(p,u){
    const инт=(a,b)=>{ if(b<=a) return 0; const N=60, h=(b-a)/N; let W=0;
      for(let i=0;i<N;i+=2){ const x=this.stateAt(p,a+i*h), m=this.stateAt(p,a+(i+1)*h), y=this.stateAt(p,a+(i+2)*h);
        W+=(y.Vm-x.Vm)/6*(x.P+4*m.P+y.P); } return W; };
    if(!this.цепь(p)) return p.proc==='isochor'?0:инт(0,u);
    return инт(0,Math.min(u,0.5))+(u>0.5?инт(0.5,u):0);
  },
  init(p){
    const mol=[];
    for(let i=0;i<40;i++) mol.push({x:Math.random(),y:Math.random(),vx:(Math.random()-0.5),vy:(Math.random()-0.5)});
    return {t:0,u:0,dir:1,mol,event:null,__stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
    // прогресс процесса туда-обратно
    s.u+=s.dir*dt*0.25;
    if(s.u>=1){ s.u=1; s.dir=-1; } if(s.u<=0){ s.u=0; s.dir=1; }
    // молекулы движутся (для наглядности), скорость растёт с температурой
    const st=this.stateAt(p,s.u), vsc=Math.sqrt(st.T/p.T0)*0.6;
    for(const m of s.mol){
      m.x+=m.vx*vsc*dt*2; m.y+=m.vy*vsc*dt*2;
      if(m.x<0){m.x=0;m.vx=Math.abs(m.vx);} if(m.x>1){m.x=1;m.vx=-Math.abs(m.vx);}
      if(m.y<0){m.y=0;m.vy=Math.abs(m.vy);} if(m.y>1){m.y=1;m.vy=-Math.abs(m.vy);}
    }
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  /* Молярная теплоёмкость при постоянном объёме. У газа с показателем адиабаты γ
     она равна R/(γ−1): это прямое следствие Cp − Cv = R и γ = Cp/Cv, а не
     отдельное допущение. Раньше здесь стояло 3/2·R («одноатомный»), хотя γ —
     параметр со значением по умолчанию 1,5. Из-за этого на адиабате получалось
     Q ≠ 0, то есть панель противоречила и названию процесса, и задачам, где
     работа адиабаты считается как νR(T₀−T)/(γ−1). */
  Cv(p){ return this.R/Math.max(p.gamma-1,1e-6); },
  readouts(s,p){
    const st=this.stateAt(p,s.u), W=this.workTo(p,s.u);
    const dU=(p.proc==='iso'&&!this.цепь(p))?0 : p.n*this.Cv(p)*(st.T-p.T0);
    const Q=dU+W;                                                // первый закон: Q=ΔU+W
    const ИМ={iso:'изотерма',isobar:'изобара',isochor:'изохора',adiab:'адиабата',line:'прямая на pV',poly:'политропа'};
    const out=[['t',s.t,'с'],['процесс',0,this.цепь(p)?`${ИМ[p.proc]} → ${ИМ[p.proc2]}, сейчас участок ${s.u<=0.5?1:2}`:ИМ[p.proc]],
            ['объём V',st.V,'л'],['давление P',st.P/1000,'кПа'],['температура T',st.T,'K'],
            ['работа газа W',W,'Дж'],['ΔU внутр. энергия',dU,'Дж'],['теплота Q = ΔU + W',Q,'Дж'],
            ['Cv = R/(γ−1)',this.Cv(p),'Дж/(моль·К)'],
            ['Cp = Cv + R',this.Cv(p)+this.R,'Дж/(моль·К)'],
            ['P·V',st.P*st.Vm,'Дж'],['νRT',p.n*this.R*st.T,'Дж']];
    if(p.proc==='isochor'){
      out.push(['нагреватель: от T₀ до T',p.Tend,'K'],
        ['работа при V = const',0,'газ не двигает поршень'],
        ['вся теплота идёт в ΔU',dU,'Дж'],
        ['P/T постоянно (закон Шарля)',st.P/st.T,'Па/К']);
    }
    return out;
  },
  graphs:[
    {label:'P(t) — давление',unit:'кПа',series:['P'],get(s,p){ return [SIMS.thermo.stateAt(p,s.u).P/1000,null]; }},
    {label:'T(t) — температура',unit:'K',series:['T'],get(s,p){ return [SIMS.thermo.stateAt(p,s.u).T,null]; }}
  ],
  presets:[
    {name:'Изотермическое расширение (закон Бойля)',values:{proc:'iso',n:1,T0:300,V0:10,Vend:25,tStop:0}},
    {name:'Изобарическое нагревание',values:{proc:'isobar',n:1,T0:300,V0:10,Vend:25,tStop:0}},
    {name:'Изохорический нагрев: 300 → 600 K',values:{proc:'isochor',n:1,T0:300,Tend:600,V0:15,Vend:15,tStop:0}},
    {name:'Изохорическое охлаждение: 600 → 200 K',values:{proc:'isochor',n:1,T0:600,Tend:200,V0:15,Vend:15,tStop:0}},
    {name:'Адиабатическое расширение (Q = 0)',values:{proc:'adiab',n:1,T0:600,V0:8,Vend:25,gamma:1.4,tStop:0}},
    {name:'Адиабата одноатомного газа γ=1.67',values:{proc:'adiab',n:1,T0:600,V0:8,Vend:25,gamma:1.67,tStop:0}},
    {name:'По прямой: давление падает, пока объём растёт',values:{proc:'line',n:1,T0:300,V0:10,Vend:30,Pend:40,gamma:1.4,tStop:0}},
    {name:'Политропа n = 1,2',values:{proc:'poly',n:1,T0:400,V0:8,Vend:24,npoly:1.2,gamma:1.4,tStop:0}},
    {name:'Два участка: изобара, затем изохора',values:{proc:'isobar',n:1,T0:300,V0:10,Vend:20,gamma:1.4,proc2:'isochor',T2:300,tStop:0}},
    {name:'Два участка: адиабата, затем изотерма',values:{proc:'adiab',n:1,T0:500,V0:8,Vend:20,gamma:1.4,proc2:'iso',V2:8,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    // цилиндр (−2,8…1,4) с подписями справа и снизу; поля — узкие, чтобы
    // рисунок помещался и в свободный угол между панелями (3.4.0)
    const scale=clamp(Math.min((W-36)/(6.4*PX_PER_M),(H-36)/(9.2*PX_PER_M)),0.002,30);
    return {x:0,y:-0.2,scale};
  },
  /* куда сейчас идёт теплота: знак dQ на следующем шаге процесса */
  тепло(p,s){
    if(p.proc==='adiab'&&!this.цепь(p)) return 'изол';
    const Q=u=>{ const st=this.stateAt(p,u); return ((p.proc==='iso'&&!this.цепь(p))?0:p.n*this.Cv(p)*(st.T-p.T0))+this.workTo(p,u); };
    if(this.цепь(p)&&((s.u<=0.5?p.proc:p.proc2)==='adiab')) return 'изол';
    const u2=clamp(s.u+0.004*(s.dir||1),0,1), d=(Q(u2)-Q(s.u))*Math.sign(u2-s.u||1);
    return Math.abs(d)<1e-9?null:(d>0?'нагрев':'холод');
  },
  /* 9.5.0: ручки на сцене. Высота поршня — объём по постоянной шкале
     (полная высота цилиндра — 42 л), поэтому начальный и конечный объёмы
     задаются прямо на цилиндре: штриховые отметки V₀, V и V₂ тянутся
     вверх-вниз. Справа — шкала температуры 0…1200 К: на ней T₀ и, для
     изохоры, конечная температура. */
  ШКАЛА_V:42, ШКАЛА_T:1200,
  геом(){ return {cx:-0.7,низ:-3,H:6,ш:2.6}; },
  tools(p){ const S=this;
    return [РУЧКИ({name:'Объёмы и температуры',
      ручки(p){ const g=S.геом(), y=V=>g.низ+g.H*clamp(V/S.ШКАЛА_V,0.04,0.98), xT=g.cx+g.ш/2+0.35, yT=T=>g.низ+g.H*clamp(T/S.ШКАЛА_T,0,1);
        const из=V=>(т,wx,wy)=>т.set(V,(wy-g.низ)/g.H*S.ШКАЛА_V), изT=k=>(т,wx,wy)=>т.set(k,(wy-g.низ)/g.H*S.ШКАЛА_T);
        const h=[{id:'V0',x:g.cx-g.ш/2,y:y(p.V0),имя:p=>`V₀ = ${p.V0} л`,тянуть:из('V0'),клав:{ArrowUp:['V0',0.5],ArrowDown:['V0',-0.5]}},
          {id:'T0',x:xT,y:yT(p.T0),имя:p=>`T₀ = ${p.T0} K`,тянуть:изT('T0'),клав:{ArrowUp:['T0',10],ArrowDown:['T0',-10]}}];
        if(p.proc==='isochor') h.push({id:'Tend',x:xT,y:yT(p.Tend),имя:p=>`T = ${p.Tend} K`,тянуть:изT('Tend'),клав:{ArrowUp:['Tend',10],ArrowDown:['Tend',-10]}});
        else h.push({id:'Vend',x:g.cx+g.ш/2,y:y(p.Vend),имя:p=>`V = ${p.Vend} л`,тянуть:из('Vend'),клав:{ArrowUp:['Vend',0.5],ArrowDown:['Vend',-0.5]}});
        if(S.цепь(p)){ if(p.proc2==='isochor') h.push({id:'T2',x:xT,y:yT(p.T2),имя:p=>`T₂ = ${p.T2} K`,тянуть:изT('T2'),клав:{ArrowUp:['T2',10],ArrowDown:['T2',-10]}});
          else h.push({id:'V2',x:g.cx+g.ш/2,y:y(p.V2),имя:p=>`V₂ = ${p.V2} л`,тянуть:из('V2'),клав:{ArrowUp:['V2',0.5],ArrowDown:['V2',-0.5]}}); }
        return h; }})]; },
  /* Цилиндр дном вниз, поршень сверху. Газ окрашен по температуре; плита
     под дном красная, когда газ получает теплоту, синяя — когда отдаёт;
     на адиабате стенки заштрихованы — теплоизоляция. */
  draw(ctx,s,v,p){
    const ink=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), px=1/ppm();
    const st=this.stateAt(p,s.u), g=this.геом(), y=V=>g.низ+g.H*clamp(V/this.ШКАЛА_V,0.04,0.98);
    const тепло=this.тепло(p,s);
    АРТ.цилиндр(ctx,{x:g.cx,низ:g.низ,ш:g.ш,H:g.H,верхГаза:y(st.V),T:st.T,мол:p.showMol?s.mol:null,тепло,плотн:Math.sqrt(p.V0/st.V)},v);
    // отметки объёмов на стенке
    ctx.strokeStyle=meas; ctx.lineWidth=1*px; ctx.setLineDash([3*px,3*px]);
    const отм=[[p.V0,'V₀']]; if(p.proc!=='isochor') отм.push([p.Vend,this.цепь(p)?'V₁':'V']); if(this.цепь(p)&&p.proc2!=='isochor') отм.push([p.V2,'V₂']);
    for(const [V,н] of отм){ ctx.beginPath(); ctx.moveTo(g.cx-g.ш/2-0.15,y(V)); ctx.lineTo(g.cx+g.ш/2+0.15,y(V)); ctx.stroke(); }
    ctx.setLineDash([]);
    отм.forEach(([V,н])=>v.label(ctx,н,g.cx-g.ш/2-0.15,y(V),-22,0,meas));
    // шкала температуры
    const xT=g.cx+g.ш/2+0.35, yT=T=>g.низ+g.H*clamp(T/this.ШКАЛА_T,0,1);
    ctx.strokeStyle=ink3; ctx.lineWidth=1*px; ctx.beginPath(); ctx.moveTo(xT,g.низ); ctx.lineTo(xT,g.низ+g.H);
    for(let T=0;T<=this.ШКАЛА_T;T+=100){ ctx.moveTo(xT,yT(T)); ctx.lineTo(xT+(T%500?0.06:0.12),yT(T)); } ctx.stroke();
    ctx.fillStyle=АРТ.ц(АРТ.цветT(st.T),0.9); ctx.fillRect(xT-0.04,g.низ,0.08,yT(st.T)-g.низ);
    const st2=14/ppm(), xr=xT+0.35, yt=g.низ+g.H;
    v.text(ctx,`V = ${st.V.toFixed(1)} л`,xr,yt-st2*0.5,ink,10,'left',true);
    v.text(ctx,`P = ${(st.P/1000).toFixed(0)} кПа`,xr,yt-st2*1.5,ink,10,'left',true);
    v.text(ctx,`T = ${st.T.toFixed(0)} K`,xr,yt-st2*2.5,ink,10,'left',true);
    const подп={нагрев:'газ получает теплоту',холод:'газ отдаёт теплоту',изол:'теплоизоляция: Q = 0'}[тепло]||'теплообмена нет';
    v.text(ctx,подп,xr,yt-st2*3.7,тепло==='нагрев'?v.c('--danger'):тепло==='холод'?v.c('--accent'):ink3,10,'left');
    const nm={iso:'изотермический',isobar:'изобарический',isochor:'изохорический',adiab:'адиабатический',line:'линейный',poly:'политропический'};
    v.text(ctx,this.цепь(p)?`${nm[p.proc]}, затем ${nm[p.proc2]}`:nm[p.proc]+' процесс',g.cx,g.низ+g.H+g.ш*0.3+st2,ink3,10,'center');
  }
}
,

/* ================== ВТОРОЙ ЗАКОН: ЦИКЛ КАРНО ================= */
carnot:{
  title:'Второй закон: цикл Карно и энтропия',
  /* Сцена — PV-диаграмма цикла. Поэтому ни осей с числами, ни надписи «сетка
     N м». */
  schema:true,
  params:[
    {key:'T1', label:'Температура нагревателя T₁',unit:'K',min:300,max:1200,step:10,default:500},
    {key:'T2', label:'Температура холодильника T₂',unit:'K',min:100,max:500,step:10,default:350},
    {key:'n',  label:'Количество вещества ν',unit:'моль',min:0.1,max:3,step:0.1,default:1},
    {key:'Va', label:'Объём в начале (точка A)',unit:'л',min:2,max:20,step:0.5,default:6},
    {key:'ratio',label:'Степень изотермического расширения (Vᴮ/Vᴬ)',min:1.2,max:3,step:0.1,default:1.6},
    {key:'gamma',label:'Показатель адиабаты γ',min:1.1,max:1.67,step:0.01,default:1.5},

    {type:'group',label:'Показывать'},
    {key:'showArea',label:'Площадь цикла = работа',type:'check',default:true},
    {key:'showRes', label:'Резервуары (нагреватель/холодильник)',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'cycles',label:'Через N циклов (0 — выкл)',min:0,max:20,step:0.5,default:0},
    {key:'tStop', label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  R:8.314,
  /* Четыре точки цикла Карно:
     A→B изотерма при T₁ (расширение), B→C адиабата (T₁→T₂),
     C→D изотерма при T₂ (сжатие),   D→A адиабата (T₂→T₁).            */
  points(p){
    const R=this.R, VA=p.Va/1000, VB=VA*p.ratio;
    const PA=p.n*R*p.T1/VA, PB=p.n*R*p.T1/VB;
    // адиабата B→C: T₁ VB^(γ-1) = T₂ VC^(γ-1)
    const VC=VB*Math.pow(p.T1/p.T2, 1/(p.gamma-1));
    const PC=p.n*R*p.T2/VC;
    // адиабата D→A: T₂ VD^(γ-1) = T₁ VA^(γ-1)
    const VD=VA*Math.pow(p.T1/p.T2, 1/(p.gamma-1));
    const PD=p.n*R*p.T2/VD;
    return {VA,VB,VC,VD,PA,PB,PC,PD};
  },
  /* состояние на цикле по фазе f∈[0,4): 0-1 A→B, 1-2 B→C, 2-3 C→D, 3-4 D→A */
  stateAt(p,f){
    const R=this.R, pt=this.points(p);
    f=((f%4)+4)%4; const seg=Math.floor(f), u=f-seg;
    let V,P,T;
    if(seg===0){ T=p.T1; V=pt.VA+(pt.VB-pt.VA)*u; P=p.n*R*T/V; }
    else if(seg===1){ V=pt.VB+(pt.VC-pt.VB)*u; P=pt.PB*Math.pow(pt.VB/V,p.gamma); T=P*V/(p.n*R); }
    else if(seg===2){ T=p.T2; V=pt.VC+(pt.VD-pt.VC)*u; P=p.n*R*T/V; }
    else { V=pt.VD+(pt.VA-pt.VD)*u; P=pt.PD*Math.pow(pt.VD/V,p.gamma); T=P*V/(p.n*R); }
    return {V:V*1000, Vm:V, P, T};
  },
  /* КПД и теплоты */
  perf(p){
    const R=this.R, pt=this.points(p);
    const Q1=p.n*R*p.T1*Math.log(pt.VB/pt.VA);      // тепло от нагревателя (изотерма A→B)
    const Q2=p.n*R*p.T2*Math.log(pt.VC/pt.VD);      // тепло холодильнику (изотерма C→D)
    const W=Q1-Q2;                                   // работа за цикл
    const eff=1-p.T2/p.T1;                           // КПД Карно
    return {Q1,Q2,W,eff,effReal:W/Q1};
  },
  init(p){ return {t:0,f:0,cycles:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
    s.f+=dt*0.8; s.cycles=s.f/4;
    if(p.cycles>0 && s.cycles>=p.cycles && !(s.done&&s.done.cyc)){
      s.event={t:s.t,type:'cycles'};
      s.__stop=`Пройдено ${p.cycles} цикл(ов): совершена работа ${(this.perf(p).W*p.cycles).toFixed(0)} Дж`;
    }
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const pf=this.perf(p), st=this.stateAt(p,s.f);
    const seg=Math.floor(((s.f%4)+4)%4);
    const phase=['A→B: изотерм. расширение (T₁)','B→C: адиабат. расширение','C→D: изотерм. сжатие (T₂)','D→A: адиабат. сжатие'][seg];
    return [['t',s.t,'с'],['фаза',0,phase],
            ['объём V',st.V,'л'],['давление P',st.P/1000,'кПа'],['температура T',st.T,'K'],
            ['Q₁ от нагревателя',pf.Q1,'Дж'],['Q₂ холодильнику',pf.Q2,'Дж'],
            ['работа за цикл W',pf.W,'Дж'],
            ['КПД Карно = 1−T₂/T₁',pf.eff*100,'%'],
            ['проверка W/Q₁',pf.effReal*100,'%'],
            ['циклов пройдено',s.cycles,'']];
  },
  graphs:[
    {label:'Температура во времени',unit:'K',series:['T'],get(s,p){ return [SIMS.carnot.stateAt(p,s.f).T,null]; }},
    {label:'Давление во времени',unit:'кПа',series:['P'],get(s,p){ return [SIMS.carnot.stateAt(p,s.f).P/1000,null]; }}
  ],
  presets:[
    {name:'Карно T₁=500, T₂=350 (КПД 30%)',values:{T1:500,T2:350,n:1,Va:8,ratio:1.6,gamma:1.5,cycles:0,tStop:0}},
    {name:'Высокий КПД: T₁=600, T₂=300',values:{T1:600,T2:300,n:1,Va:8,ratio:1.5,gamma:1.5,cycles:0,tStop:0}},
    {name:'Низкий КПД: T₁=400, T₂=360',values:{T1:400,T2:360,n:1,Va:8,ratio:1.6,gamma:1.5,cycles:0,tStop:0}},
    {name:'Один полный цикл',values:{T1:500,T2:350,n:1,Va:8,ratio:1.6,gamma:1.5,cycles:1,tStop:0}}
  ],
  /* До 3.4.0 масштаб был постоянным (1) — в узком окне холодильник уходил
     за нижний край. Теперь вписываем цилиндр с резервуарами целиком. */
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-36)/(6.4*PX_PER_M),(H-36)/(9.6*PX_PER_M)),0.002,30);
    return {x:0,y:-0.4,scale};
  },
  /* 9.4.0: тот же цилиндр, что в «Термодинамике». На изотерме T₁ под ним
     горит нагреватель, на изотерме T₂ стоит холодильник, на адиабатах
     цилиндр одет в теплоизоляцию; газ меняет цвет вместе с температурой. */
  draw(ctx,s,v,p){
    const dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const st=this.stateAt(p,s.f), seg=Math.floor(((s.f%4)+4)%4), pt=this.points(p);
    const Vmin=Math.min(pt.VA,pt.VB,pt.VC,pt.VD)*1000, Vmax=Math.max(pt.VA,pt.VB,pt.VC,pt.VD)*1000;
    const uV=(st.V-Vmin)/(Vmax-Vmin+1e-9);
    const cx=-0.7, низ=-3, H=6, ш=2.6, верх=низ+H*clamp(0.12+0.8*uV,0.1,0.92);
    const тепло=p.showRes?['нагрев','изол','холод','изол'][seg]:(seg%2?'изол':null);
    АРТ.цилиндр(ctx,{x:cx,низ,ш,H,верхГаза:верх,T:st.T,тепло,t:s.t,сила:0.9},v);
    // шкала температуры 0…1200 K: газ, T₁ и T₂
    const px=1/ppm(), xT=cx+ш/2+0.35, yT=T=>низ+H*clamp(T/1200,0,1);
    ctx.strokeStyle=ink3; ctx.lineWidth=1*px; ctx.beginPath(); ctx.moveTo(xT,низ); ctx.lineTo(xT,низ+H); ctx.stroke();
    ctx.fillStyle=АРТ.ц(АРТ.цветT(st.T),0.9); ctx.fillRect(xT-0.04,низ,0.08,yT(st.T)-низ);
    for(const [T,c] of [[p.T1,dang],[p.T2,sec]]){ ctx.strokeStyle=c; ctx.lineWidth=1.4*px; ctx.beginPath(); ctx.moveTo(xT-0.12,yT(T)); ctx.lineTo(xT+0.12,yT(T)); ctx.stroke(); }
    const st2=14/ppm(), xr=cx+ш/2+0.75;
    const phase=['A→B изотерм. расширение','B→C адиабат. расширение','C→D изотерм. сжатие','D→A адиабат. сжатие'][seg];
    v.text(ctx,phase,xr,низ+H-st2*0.5,ink,10,'left',true);
    v.text(ctx,`T = ${st.T.toFixed(0)} K`,xr,низ+H-st2*1.5,ink,10,'left');
    if(p.showRes){
      v.text(ctx,`нагреватель T₁ = ${p.T1} K`,xr,низ+H-st2*3,seg===0?dang:ink3,10,'left',seg===0);
      v.text(ctx,`холодильник T₂ = ${p.T2} K`,xr,низ+H-st2*4,seg===2?sec:ink3,10,'left',seg===2);
    }
  }
}

,
/* ============ ТЕПЛОТА: НАГРЕВ, ПЛАВЛЕНИЕ, КИПЕНИЕ ============
   Орир, т.1. Пока вещество в одной фазе, теплота идёт на нагрев:
       Q = c·m·ΔT   (температура растёт),
   а на фазовом переходе — на перестройку связей при ПОСТОЯННОЙ температуре:
       Q = λ·m (плавление),  Q = r·m (парообразование).
   Отсюда ступенчатый график T(t): наклонные участки чередуются с полками. */
calorimetry:{
  title:'Нагрев, плавление и кипение: график с полками',
  /* Сцена — график T(Q) с полками плавления и кипения. Поэтому ни осей с
     числами, ни надписи «сетка N м». */
  schema:true,
  params:[
    {key:'subst',label:'Вещество',type:'select',default:'water',
     options:[{v:'water',t:'Вода (лёд → вода → пар)'},
              {v:'lead', t:'Свинец'},
              {v:'alu',  t:'Алюминий'}]},
    {key:'m',  label:'Масса',unit:'кг',min:0.05,max:5,step:0.05,default:0.5},
    {key:'T0', label:'Начальная температура',unit:'°C',min:-80,max:200,step:1,default:-30},
    {key:'P',  label:'Мощность нагревателя',unit:'Вт',min:50,max:5000,step:10,default:800},
    {type:'group',label:'Показывать'},
    {key:'bar',  label:'Полоса подведённой теплоты',type:'check',default:true},
    {key:'parts',label:'Разбивка по этапам',type:'check',default:true}
  ],
  /* c — удельные теплоёмкости фаз, Дж/(кг·К); λ, r — теплоты переходов, Дж/кг */
  SUB:{
    water:{name:'вода', Tm:0,   Tb:100,  cS:2100, cL:4200, cG:2000, lam:334000, r:2260000},
    lead: {name:'свинец',Tm:327, Tb:1749, cS:130,  cL:140,  cG:140,  lam:24500,  r:871000},
    alu:  {name:'алюминий',Tm:660,Tb:2519,cS:900,  cL:1080, cG:1080, lam:397000, r:10900000}
  },
  S(p){ return this.SUB[p.subst]; },
  /* Границы этапов в единицах подведённой теплоты Q (Дж) */
  stages(p){
    const S=this.S(p), m=p.m, T0=clamp(p.T0,-273,1e5);
    const out=[];
    let T=T0, Q=0;
    if(T<S.Tm){ const q=S.cS*m*(S.Tm-T); out.push({kind:'нагрев твёрдого',Q0:Q,Q1:Q+q,T0:T,T1:S.Tm}); Q+=q; T=S.Tm; }
    if(T0<=S.Tm){ const q=S.lam*m; out.push({kind:'плавление',Q0:Q,Q1:Q+q,T0:S.Tm,T1:S.Tm}); Q+=q; }
    if(T<S.Tb){ const q=S.cL*m*(S.Tb-Math.max(T,S.Tm)); out.push({kind:'нагрев жидкости',Q0:Q,Q1:Q+q,T0:Math.max(T,S.Tm),T1:S.Tb}); Q+=q; T=S.Tb; }
    { const q=S.r*m; out.push({kind:'кипение',Q0:Q,Q1:Q+q,T0:S.Tb,T1:S.Tb}); Q+=q; }
    out.push({kind:'нагрев пара',Q0:Q,Q1:Q+S.cG*m*200,T0:S.Tb,T1:S.Tb+200});
    return out;
  },
  /* Температура и фаза при подведённой теплоте Q */
  stateAtQ(p,Q){
    const st=this.stages(p);
    for(const g of st){
      if(Q<=g.Q1+1e-9){
        const u=(g.Q1-g.Q0)>1e-9? (Q-g.Q0)/(g.Q1-g.Q0) : 1;
        return {T:g.T0+(g.T1-g.T0)*clamp(u,0,1), kind:g.kind, frac:clamp(u,0,1)};
      }
    }
    const last=st[st.length-1];
    return {T:last.T1, kind:last.kind, frac:1};
  },
  Qtotal(p){ const st=this.stages(p); return st[st.length-1].Q1; },
  init(p){ return {t:0,Q:0,event:null,__stop:null,marks:{}}; },
  step(s,dt,p){
    s.t+=dt; s.Q+=p.P*dt;
    const st=this.stages(p);
    // отмечаем начало каждого фазового перехода
    for(const g of st){
      if((g.kind==='плавление'||g.kind==='кипение') && !s.marks[g.kind] && s.Q>=g.Q0){
        s.marks[g.kind]=s.t;
        s.event={type:g.kind,t:s.t};
        s.__stop=`Начало: ${g.kind} при ${g.T0} °C — температура стоит, пока идёт перестройка`;
      }
    }
    if(s.Q>this.Qtotal(p)) s.Q=this.Qtotal(p);
  },
  readouts(s,p){
    const S=this.S(p), st=this.stateAtQ(p,s.Q);
    const stg=this.stages(p);
    const out=[['t',s.t,'с'],
      ['подведено теплоты Q',s.Q/1000,'кДж'],
      ['мощность',p.P,'Вт'],
      ['температура',st.T,'°C'],
      ['что происходит',0,st.kind],
      ['температура плавления',S.Tm,'°C'],
      ['температура кипения',S.Tb,'°C'],
      ['удельная теплота плавления λ',S.lam/1000,'кДж/кг'],
      ['удельная теплота парообразования r',S.r/1000,'кДж/кг']];
    if(p.parts) for(const g of stg)
      out.push([`${g.kind}: нужно`, (g.Q1-g.Q0)/1000, `кДж (${((g.Q1-g.Q0)/p.P).toFixed(0)} с)`]);
    return out;
  },
  graphs:[
    {label:'T(t) — температура',unit:'°C',series:['T'],
     get(s,p){ return [SIMS.calorimetry.stateAtQ(p,s.Q).T,null]; }},
    {label:'Подведённая теплота',unit:'кДж',series:['Q'],get(s,p){ return [s.Q/1000,null]; }}
  ],
  presets:[
    {name:'Лёд −30 °C → пар: все четыре этапа',values:{subst:'water',m:0.5,T0:-30,P:800}},
    {name:'Вода 20 °C: только нагрев и кипение',values:{subst:'water',m:0.5,T0:20,P:800}},
    {name:'Кипение — самый долгий этап',values:{subst:'water',m:1,T0:90,P:1000}},
    {name:'Свинец: плавится легко',values:{subst:'lead',m:1,T0:20,P:2000}},
    {name:'Алюминий: тугоплавкий',values:{subst:'alu',m:0.5,T0:20,P:3000}}
  ],
  anchors(s,p){ return [{x:0,y:0}]; },
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-50)/(11.2*PX_PER_M),(H-50)/(8.8*PX_PER_M)),1e-7,30);
    return {x:0,y:-0.4,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const S=this.S(p), stg=this.stages(p), Qt=this.Qtotal(p);
    const cur=this.stateAtQ(p,s.Q);
    // ---- график T(Q) ----
    const x0=-5.2, x1=5.2, y0=-1.6, y1=3.2;
    const Tmin=Math.min(p.T0,S.Tm)-20, Tmax=S.Tb+230;
    const X=Q=>x0+(x1-x0)*clamp(Q/Qt,0,1);
    const Y=T=>y0+(y1-y0)*clamp((T-Tmin)/(Tmax-Tmin),0,1);
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.globalAlpha=.85;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y0); ctx.moveTo(x0,y0); ctx.lineTo(x0,y1); ctx.stroke();
    ctx.globalAlpha=1;
    v.label(ctx,'T, °C',x0,y1,-4,-8,ink3);
    v.text(ctx,'Q →',x1,y0-10/ppm(),ink3,10,'right');
    // опорные температуры
    for(const [T,lab,col] of [[S.Tm,`плавление ${S.Tm} °C`,sec],[S.Tb,`кипение ${S.Tb} °C`,dang]]){
      ctx.strokeStyle=col; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(x0,Y(T)); ctx.lineTo(x1,Y(T)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.text(ctx,lab,x1,Y(T)+10/ppm(),col,10,'right',true);
    }
    // сама ломаная: наклон — нагрев, полка — переход
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
    ctx.moveTo(X(0),Y(stg[0].T0));
    for(const g of stg){ ctx.lineTo(X(g.Q0),Y(g.T0)); ctx.lineTo(X(g.Q1),Y(g.T1)); }
    ctx.stroke();
    // подписи этапов
    for(const g of stg){
      const xm=(X(g.Q0)+X(g.Q1))/2, flat=Math.abs(g.T1-g.T0)<1e-9;
      // полки уже подписаны у пунктиров «плавление/кипение» — подписываем только наклоны
      if(flat || X(g.Q1)-X(g.Q0)<0.5) continue;
      v.label(ctx,g.kind,xm,Y((g.T0+g.T1)/2),6,12,ink3);
    }
    // текущая точка
    const cx=X(s.Q), cy=Y(cur.T);
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(3),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(cx,y0); ctx.lineTo(cx,cy); ctx.moveTo(x0,cy); ctx.lineTo(cx,cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(cx,cy,v.lw(4.5),0,7); ctx.fill();
    v.label(ctx,`${cur.T.toFixed(1)} °C`,cx,cy,8,-8,dang);
    // ---- полоса подведённой теплоты ----
    let низ=y0-14/ppm();
    if(p.bar){
      const by=-2.5-10/ppm(), bh=0.42;
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.2);
      ctx.strokeRect(x0,by,x1-x0,bh);
      const cols=[sec,meas,acc,dang,ink3];
      stg.forEach((g,i)=>{
        const a=X(g.Q0), b=X(g.Q1);
        ctx.fillStyle=cols[i%cols.length]; ctx.globalAlpha=.28;
        ctx.fillRect(a,by,b-a,bh); ctx.globalAlpha=1;
      });
      ctx.fillStyle=dang; ctx.globalAlpha=.55;
      ctx.fillRect(x0,by,cx-x0,bh); ctx.globalAlpha=1;
      const k=1/ppm();
      низ=КС.абзац(ctx,v,`подведено Q = ${(s.Q/1000).toFixed(1)} из ${(Qt/1000).toFixed(1)} кДж; ширина участка — сколько теплоты он «съедает»`,x0,by-11*k,x1-x0,ink3,9.5);
    }
    // вывод — строками в пикселях под полосой: при любом масштабе не наезжают
    { const k=1/ppm(), yb=низ-6*k;
      v.text(ctx,`${S.name}, ${p.m} кг: сейчас — ${cur.kind}`,x0,yb,acc,10,'left',true);
      КС.абзац(ctx,v,'на полке вся теплота идёт на разрыв связей, а не на нагрев — термометр стоит',x0,yb-15*k,x1-x0,ink3,10); }
  }
}
,

/* ============ ТЕЧЕНИЕ ЖИДКОСТИ: УРАВНЕНИЕ БЕРНУЛЛИ ============
   Орир, т.1, глава о жидкостях. Два закона на одну картинку.

   1) НЕРАЗРЫВНОСТЬ. Жидкость несжимаема, значит через любое сечение за
      секунду проходит один и тот же объём:
          Q = A₁v₁ = A₂v₂        ⇒   где у́же, там быстрее.

   2) БЕРНУЛЛИ — это закон сохранения энергии для струйки жидкости. Разделив
      энергию единицы объёма, получаем: вдоль линии тока постоянна сумма
          p + ρv²/2 + ρgy = const.
      Отсюда главный и совершенно неинтуитивный вывод: в узком месте, где
      жидкость РАЗОГНАЛАСЬ, давление МЕНЬШЕ, а не больше. Именно поэтому
      работают пульверизатор, карбюратор, крыло самолёта и расходомер Вентури.

   Давления показываем избыточные, в метрах столба жидкости (напор H = p/ρg):
   так их видно прямо на картинке — высотой воды в манометрических трубках. */
bernoulli:{
  title:'Течение жидкости: уравнение Бернулли и трубка Вентури',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'Q',  label:'Расход Q',unit:'л/с',min:1,max:300,step:1,default:60},
    {key:'A1', label:'Сечение широкой части A₁',unit:'см²',min:20,max:400,step:5,default:200},
    {key:'A2', label:'Сечение узкой части A₂',unit:'см²',min:5,max:400,step:5,default:80},
    {key:'H1', label:'Напор на входе H₁ = p₁/ρg',unit:'м',min:0.5,max:20,step:0.1,default:8},
    {key:'dy', label:'Подъём узкой части',unit:'м',min:-2,max:2,step:0.1,default:0},
    {key:'liq',label:'Жидкость',type:'select',default:'water',
     options:[{v:'water',t:'Вода (1000 кг/м³)'},
              {v:'oil',  t:'Масло (900 кг/м³)'},
              {v:'gly',  t:'Глицерин (1260 кг/м³)'},
              {v:'merc', t:'Ртуть (13600 кг/м³)'}]},
    {key:'g',  label:'Ускорение свободного падения g',unit:'м/с²',min:1,max:20,step:0.1,default:9.8},

    {type:'group',label:'Показывать'},
    {key:'mano', label:'Манометрические трубки',type:'check',default:true},
    {key:'lines',label:'Линии тока и частицы',type:'check',default:true},
    {key:'plot', label:'Эпюру давления вдоль трубы',type:'check',default:true},
    {key:'reyn', label:'Число Рейнольдса (проверка идеальности)',type:'check',default:true},

  ],
  LIQ:{water:{rho:1000,mu:1.0e-3,name:'вода'}, oil:{rho:900,mu:8.0e-2,name:'масло'},
       gly:{rho:1260,mu:1.4,name:'глицерин'},  merc:{rho:13600,mu:1.53e-3,name:'ртуть'}},
  liq(p){ return this.LIQ[p.liq]||this.LIQ.water; },
  /* геометрия трубы: x от −6 до 6, сечение задано кусочно и плавно сшито */
  X0:-6, X1:6, XN0:-1.4, XN1:1.4,
  areaAt(p,x){                                   // м²
    const a1=p.A1*1e-4, a2=p.A2*1e-4;
    const t=(u)=>u*u*(3-2*u);                    // сглаживание, чтобы труба не имела изломов
    if(x<=-2.6) return a1;
    if(x< this.XN0) return a1+(a2-a1)*t((x+2.6)/(this.XN0+2.6));
    if(x<=this.XN1) return a2;
    if(x< 2.6)      return a2+(a1-a2)*t((x-this.XN1)/(2.6-this.XN1));
    return a1;
  },
  yAt(p,x){                                      // подъём оси трубы, м
    const t=(u)=>u*u*(3-2*u);
    if(x<=-2.6) return 0;
    if(x< this.XN0) return p.dy*t((x+2.6)/(this.XN0+2.6));
    if(x<=this.XN1) return p.dy;
    if(x< 2.6)      return p.dy*(1-t((x-this.XN1)/(2.6-this.XN1)));
    return 0;
  },
  vAt(p,x){ return (p.Q/1000)/Math.max(this.areaAt(p,x),1e-9); },   // м/с
  /* напор (избыточное давление в метрах столба) из уравнения Бернулли:
     H(x) = H₁ + (v₁² − v²)/2g − (y − y₁) */
  headAt(p,x){
    const v1=this.vAt(p,this.X0), v=this.vAt(p,x);
    return p.H1 + (v1*v1-v*v)/(2*Math.max(p.g,1e-9)) - (this.yAt(p,x)-this.yAt(p,this.X0));
  },
  pAt(p,x){ return this.liq(p).rho*p.g*this.headAt(p,x); },          // Па, избыточное
  /* Число Рейнольдса: идеальная жидкость — приближение, и полезно видеть,
     когда оно перестаёт работать (Re ≳ 2300 — течение становится турбулентным). */
  Re(p,x){
    const L=this.liq(p), A=this.areaAt(p,x);
    const D=2*Math.sqrt(A/Math.PI);              // эквивалентный диаметр круглой трубы
    return L.rho*this.vAt(p,x)*D/L.mu;
  },
  init(p){
    const parts=[];
    for(let i=0;i<90;i++) parts.push({x:this.X0+Math.random()*(this.X1-this.X0),
                                      s:Math.random()*2-1});
    return {t:0,parts,event:null,__stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    s.t=t;
    /* Частицы двигаются со СВОЕЙ местной скоростью: в горловине они заметно
       ускоряются — это и есть уравнение неразрывности, видимое глазом. */
    const k=0.5/Math.max(this.vAt(p,this.X0),1e-6);   // общий масштаб «в кадре»
    for(const q of s.parts){
      q.x+=this.vAt(p,q.x)*k*dt*3;
      if(q.x>this.X1){ q.x=this.X0; q.s=Math.random()*2-1; }
    }
  },
  anchors(s,p){ return [{x:0,y:p.dy}]; },
  warn(p,s){
    if(this.headAt(p,0)<0)
      return 'Напор в горловине отрицательный: реальная жидкость здесь вскипела бы (кавитация). Уменьшите расход или расширьте узкую часть.';
    if(p.reyn&&this.Re(p,0)>2300)
      return `Re = ${Math.round(this.Re(p,0))} > 2300: настоящее течение стало бы турбулентным, и уравнение Бернулли для струйки перестаёт быть точным.`;
    return null;
  },
  readouts(s,p){
    const L=this.liq(p), v1=this.vAt(p,this.X0), v2=this.vAt(p,0);
    const p1=this.pAt(p,this.X0), p2=this.pAt(p,0);
    const rho=L.rho;
    const e1=p1+rho*v1*v1/2+rho*p.g*this.yAt(p,this.X0);
    const e2=p2+rho*v2*v2/2+rho*p.g*this.yAt(p,0);
    return [['жидкость: плотность ρ',rho,'кг/м³'],
      ['расход Q',p.Q,'л/с'],
      ['сечение широкой части A₁',p.A1,'см²'],
      ['сечение узкой части A₂',p.A2,'см²'],
      ['скорость в широкой v₁ = Q/A₁',v1,'м/с'],
      ['скорость в узкой v₂ = Q/A₂',v2,'м/с'],
      ['проверка неразрывности A₁v₁',p.A1*1e-4*v1*1000,'л/с'],
      ['проверка неразрывности A₂v₂',p.A2*1e-4*v2*1000,'л/с'],
      ['напор в широкой H₁',p.H1,'м'],
      ['напор в узкой H₂',this.headAt(p,0),'м'],
      ['избыточное давление p₁',p1/1000,'кПа'],
      ['избыточное давление p₂',p2/1000,'кПа'],
      ['перепад Δp = p₁ − p₂',(p1-p2)/1000,'кПа'],
      ['скоростной напор ρv₂²/2',rho*v2*v2/2000,'кПа'],
      ['сумма Бернулли в широкой',e1/1000,'кПа'],
      ['сумма Бернулли в узкой',e2/1000,'кПа'],
      ['расхождение сумм (должно быть 0)',(e1-e2)/1000,'кПа'],
      ...(p.reyn?[['число Рейнольдса в узкой части',this.Re(p,0),'']]:[])];
  },
  graphs:[],
  presets:[
    {name:'Трубка Вентури: узко — быстро — давление ниже',
     values:{Q:60,A1:200,A2:80,H1:8,dy:0,liq:'water'}},
    {name:'Сильнее сужение — глубже провал давления',
     values:{Q:60,A1:200,A2:45,H1:12,dy:0,liq:'water'}},
    {name:'Без сужения: давление одинаково всюду',
     values:{Q:60,A1:200,A2:200,H1:8,dy:0,liq:'water'}},
    {name:'Труба поднимается: работает слагаемое ρgy',
     values:{Q:40,A1:200,A2:120,H1:8,dy:2,liq:'water'}},
    {name:'Кавитация: расход слишком велик',
     values:{Q:150,A1:200,A2:25,H1:4,dy:0,liq:'water'}},
    {name:'Ртуть: та же геометрия, другая плотность',
     values:{Q:40,A1:200,A2:60,H1:5,dy:0,liq:'merc'}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-60)/(14*PX_PER_M),(H-60)/(15*PX_PER_M)),0.002,30);
    return {x:0,y:1.6,scale};
  },
  /* Радиус трубы на картинке: ∝ √A, как у круглого сечения. */
  rAt(p,x){ return 0.66*Math.sqrt(this.areaAt(p,x)/1e-2); },
  /* 9.5.0: ручки — сечения широкой и узкой части (тяните стенку), подъём
     горловины, напор на входе (верх первого пьезометра) и расход (стрелка
     у входа); зонд — скорость, давление и напор в любой точке трубы. */
  tools(p){ const S=this, A=r=>Math.pow(r/0.66,2)*100;
    return [РУЧКИ({name:'Сечения, подъём, напор, расход',
      ручки(p){ return [
        {id:'A1',x:-5.2,y:S.yAt(p,-5.2)+S.rAt(p,-5.2),имя:p=>`A₁ = ${p.A1} см²`,тянуть(т,wx,wy){ т.set('A1',A(Math.max(0.05,wy-S.yAt(т.p,-5.2)))); },клав:{ArrowUp:['A1',5],ArrowDown:['A1',-5]}},
        {id:'A2',x:0.6,y:S.yAt(p,0.6)+S.rAt(p,0.6),имя:p=>`A₂ = ${p.A2} см²`,тянуть(т,wx,wy){ т.set('A2',A(Math.max(0.05,wy-т.p.dy))); },клав:{ArrowUp:['A2',5],ArrowDown:['A2',-5]}},
        {id:'dy',x:0,y:p.dy,имя:p=>`подъём ${p.dy} м`,тянуть(т,wx,wy){ т.set('dy',wy); },клав:{ArrowUp:['dy',0.1],ArrowDown:['dy',-0.1]}},
        {id:'H1',x:-4.2,y:S.yAt(p,-4.2)+S.rAt(p,-4.2)+p.H1*0.42,имя:p=>`H₁ = ${p.H1} м`,тянуть(т,wx,wy){ т.set('H1',(wy-S.yAt(т.p,-4.2)-S.rAt(т.p,-4.2))/0.42); },клав:{ArrowUp:['H1',0.1],ArrowDown:['H1',-0.1]}},
        {id:'Q',x:S.X0-0.3,y:S.yAt(p,S.X0)-S.rAt(p,S.X0)-0.35-p.Q*0.008,имя:p=>`Q = ${p.Q} л/с (тяните вниз)`,тянуть(т,wx,wy){ т.set('Q',(S.yAt(т.p,S.X0)-S.rAt(т.p,S.X0)-0.35-wy)/0.008); },клав:{ArrowUp:['Q',-1],ArrowDown:['Q',1]}}]; }}),
      ЗОНД({hint:'щёлкните внутрь трубы — местные скорость, давление и напор',
        замер(p,s,x,y){ if(x<S.X0||x>S.X1||Math.abs(y-S.yAt(p,x))>S.rAt(p,x)) return null;
          return [`v = ${S.vAt(p,x).toFixed(2)} м/с`,`p = ${(S.pAt(p,x)/1000).toFixed(2)} кПа (избыточное)`,`напор H = ${S.headAt(p,x).toFixed(2)} м`,`Re = ${Math.round(S.Re(p,x))}`]; }})]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'),
          dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const L=this.liq(p), X0=this.X0, X1=this.X1;
    const N=120, xs=[];
    for(let i=0;i<=N;i++) xs.push(X0+(X1-X0)*i/N);

    /* Строгий рисунок: стенки трубы — линии, жидкость — один тон. Линии
       тока сходятся в горловине, частицы оставляют штрих тем длиннее, чем
       быстрее идут: неразрывность видна без подписей. */
    const px=1/ppm(), тон={water:'вода',oil:'масло',gly:'глицерин',merc:'ртуть'}[p.liq]||'вода';
    const top=xs.map(x=>[x,this.yAt(p,x)+this.rAt(p,x)]);
    const bot=xs.map(x=>[x,this.yAt(p,x)-this.rAt(p,x)]);
    ctx.fillStyle=АРТ.заливкаЖ(тон); ctx.beginPath();
    top.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); for(let i=bot.length-1;i>=0;i--) ctx.lineTo(bot[i][0],bot[i][1]);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle=ink; ctx.lineWidth=1.8*px;
    for(const A of [top,bot]){ ctx.beginPath(); A.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke(); }
    if(p.lines){
      ctx.strokeStyle=АРТ.ц(АРТ.тон(тон),0.35); ctx.lineWidth=0.8*px;
      for(const f of [-0.66,-0.33,0,0.33,0.66]){ ctx.beginPath();
        xs.forEach((x,i)=>{ const y=this.yAt(p,x)+f*this.rAt(p,x); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }); ctx.stroke(); }
      const k=0.5/Math.max(this.vAt(p,this.X0),1e-6);
      ctx.strokeStyle=АРТ.линияЖ(тон); ctx.lineCap='round'; ctx.lineWidth=1.6*px;
      for(const q of s.parts){
        const r=this.rAt(p,q.x), y=this.yAt(p,q.x)+q.s*r*0.78;
        const дл=clamp(this.vAt(p,q.x)*k*0.35,0.04,1.2), xa=Math.max(this.X0,q.x-дл), ya=this.yAt(p,xa)+q.s*this.rAt(p,xa)*0.78;
        ctx.beginPath(); ctx.moveTo(xa,ya); ctx.lineTo(q.x,y); ctx.stroke();
      }
    }
    // ---- пьезометры: столб = напор H(x)
    if(p.mano){
      const HS=0.42, Hmax=Math.max(p.H1,...[-4.2,0,4.2].map(x=>this.headAt(p,x)));
      for(const x of [-4.2,0,4.2]){
        const yTop=this.yAt(p,x)+this.rAt(p,x), H=this.headAt(p,x), col=Math.max(0,H)*HS, верхТр=yTop+Math.max(Hmax*HS+0.5,0.8), ш=0.13;
        if(H>0) АРТ.жидкость(ctx,x-ш,yTop,x+ш,yTop+col,{тон});
        АРТ.стакан(ctx,x-ш,x+ш,yTop,верхТр,0,{дно:false,lw:1.4});
        if(H<=0){ ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.8); ctx.beginPath(); ctx.moveTo(x-ш,yTop); ctx.lineTo(x+ш,yTop); ctx.stroke(); }
        v.label(ctx,`H = ${H.toFixed(2)} м`,x+ш,yTop+col,6,0,H>0?ink:dang);
      }
      const y0=this.yAt(p,X0)+this.rAt(p,X0)+p.H1*0.42;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(X0,y0); ctx.lineTo(X1,y0); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'напор на входе',X1,y0,-84,-8,ink3);
    }

    // ---- скорости в трёх сечениях
    for(const x of [-4.2,0,4.2]){
      const vv=this.vAt(p,x), y=this.yAt(p,x);
      v.arrow(ctx,x-0.55,y,x-0.55+clamp(vv/Math.max(this.vAt(p,0),1e-6),0.15,1)*1.1,y,meas);
      // подпись уводим ПОД трубу, иначе она ложится прямо на стенку
      const t=`v = ${vv.toFixed(2)} м/с`;
      v.label(ctx,t,x,y-this.rAt(p,x),-Math.round(t.length*3.05),16,meas);
    }

    // ---- эпюра давления вдоль трубы
    if(p.plot){
      const gy=-4.4, gh=1.7;
      const hs=xs.map(x=>this.headAt(p,x));
      const hi=Math.max(...hs,0.001), lo=Math.min(...hs,0);
      const Y=h=>gy+(h-lo)/Math.max(hi-lo,1e-6)*gh;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(X0,Y(0)); ctx.lineTo(X1,Y(0)); ctx.stroke(); ctx.globalAlpha=1;
      ctx.fillStyle=АРТ.ц(АРТ.rgb(acc)||[40,80,200],0.08); ctx.beginPath(); ctx.moveTo(X0,Y(0));
      xs.forEach((x,i)=>ctx.lineTo(x,Y(hs[i]))); ctx.lineTo(X1,Y(0)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
      ctx.beginPath();
      xs.forEach((x,i)=>{ const y=Y(hs[i]); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
      ctx.stroke();
      v.label(ctx,'давление вдоль трубы: в горловине — провал',X0,gy+gh,2,-6,ink3);
      v.label(ctx,'0',X0,Y(0),-14,0,ink3);
    }

    // ---- вывод
    const v1=this.vAt(p,X0), v2=this.vAt(p,0);
    v.label(ctx,`A₁v₁ = A₂v₂ = Q:  ${v1.toFixed(2)}·${p.A1} = ${v2.toFixed(2)}·${p.A2} см²·м/с`,
      0,-5.1,-160,0,ink3);
    v.label(ctx,`p + ρv²/2 + ρgy = const  —  где быстрее, там давление МЕНЬШЕ (${L.name})`,
      0,-5.1,-160,14,acc);
  }
}

});
