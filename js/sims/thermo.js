'use strict';
Object.assign(SIMS,{
/* ================== КИНЕТИЧЕСКАЯ ТЕОРИЯ: ГАЗ В ЯЩИКЕ ================= */
gas:{
  title:'Газ: молекулы, давление, температура',
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
      // распределение скоростей: разброс вокруг v_rms
      const speed=v*(0.5+Math.random());
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
  }
}
,

/* ================== ТЕРМОДИНАМИКА: PV-ДИАГРАММА И ПРОЦЕССЫ ================= */
thermo:{
  title:'Термодинамика: газ, поршень, процессы',
  params:[
    {key:'proc',label:'Процесс',type:'select',default:'iso',
     options:[{v:'iso', t:'Изотермический (T = const)'},
              {v:'isobar',t:'Изобарический (P = const)'},
              {v:'isochor',t:'Изохорический (V = const)'},
              {v:'adiab',t:'Адиабатический (Q = 0)'}]},
    {key:'n',  label:'Количество вещества ν',unit:'моль',min:0.1,max:5,step:0.1,default:1},
    {key:'T0', label:'Начальная температура T₀',unit:'K',min:100,max:1000,step:10,default:300},
    {key:'V0', label:'Начальный объём V₀',unit:'л',min:1,max:40,step:0.5,default:10},
    {key:'Vend',label:'Конечный объём V',unit:'л',min:1,max:40,step:0.5,default:25},
    {key:'gamma',label:'Показатель адиабаты γ',min:1.1,max:1.67,step:0.01,default:1.5},

    {type:'group',label:'Нагреватель / охладитель (для изохоры)'},
    {key:'Tend',label:'Конечная температура T',unit:'K',min:100,max:1200,step:10,default:600},

    {type:'group',label:'Показывать'},
    {key:'showWork',label:'Площадь работы под кривой',type:'check',default:true},
    {key:'showMol', label:'Молекулы в цилиндре',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  R:8.314,
  /* состояние газа как функция прогресса u∈[0,1] от V0 к Vend */
  stateAt(p,u){
    const V=p.V0+(p.Vend-p.V0)*u;                 // объём линейно (л)
    const V0=p.V0/1000, Vm=V/1000;                // в м³
    const P0=p.n*this.R*p.T0/V0;                  // начальное давление (Па)
    let P,T;
    if(p.proc==='iso'){ P=P0*V0/Vm; T=p.T0; }
    else if(p.proc==='isobar'){ P=P0; T=p.T0*Vm/V0; }
    else if(p.proc==='isochor'){
      // объём заперт: греем газ нагревателем от T₀ до T. Тогда P = νRT/V (закон Шарля)
      const Vfix=p.V0/1000;
      T=p.T0+(p.Tend-p.T0)*u;
      P=p.n*this.R*T/Vfix;
      return {V:p.V0, Vm:Vfix, P, T, P0, V0};
    }
    else { P=P0*Math.pow(V0/Vm,p.gamma); T=p.T0*Math.pow(V0/Vm,p.gamma-1); }
    return {V, Vm, P, T, P0, V0};
  },
  /* работа газа = ∫P dV от V0 до текущего V */
  workTo(p,u){
    if(p.proc==='isochor') return 0;
    const N=60; let W=0, du=u/N;
    for(let i=0;i<N;i++){ const a=this.stateAt(p,i*du), b=this.stateAt(p,(i+1)*du);
      W+=(a.P+b.P)/2*(b.Vm-a.Vm); }
    return W;
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
  readouts(s,p){
    const st=this.stateAt(p,s.u), W=this.workTo(p,s.u);
    const dU=p.proc==='iso'?0 : (3/2)*p.n*this.R*(st.T-p.T0);   // для одноатомного ≈; берём Cv=3/2R
    const Q=dU+W;                                                // первый закон: Q=ΔU+W
    const out=[['t',s.t,'с'],['процесс',0,{iso:'изотерма',isobar:'изобара',isochor:'изохора',adiab:'адиабата'}[p.proc]],
            ['объём V',st.V,'л'],['давление P',st.P/1000,'кПа'],['температура T',st.T,'K'],
            ['работа газа W',W,'Дж'],['ΔU внутр. энергия',dU,'Дж'],['теплота Q = ΔU + W',Q,'Дж'],
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
    {name:'Адиабата одноатомного газа γ=1.67',values:{proc:'adiab',n:1,T0:600,V0:8,Vend:25,gamma:1.67,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-80)/(6*PX_PER_M),(H-80)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const st=this.stateAt(p,s.u);
    // диапазон объёма для положения поршня
    let Vmin=1e18,Vmax=-1e18;
    for(let u=0;u<=1;u+=0.05){ const q=this.stateAt(p,u); Vmin=Math.min(Vmin,q.V);Vmax=Math.max(Vmax,q.V); }
    if(p.proc==='isochor'){ Vmin=p.V0-2; Vmax=p.V0+2; }
    const uV=(st.V-Vmin)/(Vmax-Vmin+1e-9);
    // цилиндр по центру сцены
    const cx=-1.4, cyTop=-3, cyH=6, cw=2.8;
    const pistonY=cyTop+cyH*(1-clamp(uV,0.08,0.95));
    // стенки
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.5);
    ctx.beginPath(); ctx.moveTo(cx,cyTop); ctx.lineTo(cx,cyTop+cyH); ctx.lineTo(cx+cw,cyTop+cyH); ctx.lineTo(cx+cw,cyTop); ctx.stroke();
    // газ
    ctx.fillStyle=acc; ctx.globalAlpha=.12; ctx.fillRect(cx,pistonY,cw,cyTop+cyH-pistonY); ctx.globalAlpha=1;
    // молекулы
    if(p.showMol){
      ctx.fillStyle=acc;
      for(const m of s.mol){ const mx=cx+0.15+m.x*(cw-0.3), my=pistonY+0.15+m.y*(cyTop+cyH-pistonY-0.3);
        ctx.beginPath(); ctx.arc(mx,my,v.lw(3),0,7); ctx.fill(); }
    }
    // поршень + шток
    ctx.fillStyle=sec; ctx.fillRect(cx,pistonY-0.22,cw,0.22);
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2.5); ctx.beginPath(); ctx.moveTo(cx+cw/2,pistonY-0.22); ctx.lineTo(cx+cw/2,cyTop-1); ctx.stroke();
    v.label(ctx,'поршень',cx+cw,pistonY,8,0,sec);
    // подписи состояния
    v.label(ctx,`V = ${st.V.toFixed(1)} л`,cx+cw/2,cyTop+cyH,-16,20,ink3);
    v.label(ctx,`P = ${(st.P/1000).toFixed(0)} кПа`,cx+cw/2,cyTop+cyH,-16,34,ink3);
    v.label(ctx,`T = ${st.T.toFixed(0)} K`,cx+cw/2,cyTop+cyH,-16,48,ink3);
    const nm={iso:'изотермический',isobar:'изобарический',isochor:'изохорический',adiab:'адиабатический'}[p.proc];
    v.label(ctx,nm+' процесс',cx+cw/2,cyTop,-40,-10,ink3);
    v.label(ctx,'PV-диаграмма — на панели справа →',cx+cw/2,cyTop,-70,-26,ink3);
  }
}
,

/* ================== ВТОРОЙ ЗАКОН: ЦИКЛ КАРНО ================= */
carnot:{
  title:'Второй закон: цикл Карно и энтропия',
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
  fit(p,vp){ return {x:0,y:0,scale:1}; },       // сцена рисует резервуары; PV — в панели
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const st=this.stateAt(p,s.f), seg=Math.floor(((s.f%4)+4)%4);
    // цилиндр по центру
    const cx=-1.4, cyTop=-3, cyH=6, cw=2.8;
    const pt=this.points(p);
    const Vmin=Math.min(pt.VA,pt.VB,pt.VC,pt.VD)*1000, Vmax=Math.max(pt.VA,pt.VB,pt.VC,pt.VD)*1000;
    const uV=(st.V-Vmin)/(Vmax-Vmin+1e-9);
    const pistonY=cyTop+cyH*(1-clamp(uV,0.08,0.95));
    // резервуары
    if(p.showRes){
      // нагреватель снизу (красный), когда контакт на изотерме T1 (seg 0)
      ctx.fillStyle=dang; ctx.globalAlpha=seg===0?0.5:0.15;
      ctx.fillRect(cx-0.3,cyTop+cyH+0.15,cw+0.6,0.5); ctx.globalAlpha=1;
      v.label(ctx,`нагреватель T₁ = ${p.T1} K`,cx+cw/2,cyTop+cyH+0.65,-50,10,seg===0?dang:ink3);
      // холодильник сверху (синий), контакт на изотерме T2 (seg 2)
      ctx.fillStyle=sec; ctx.globalAlpha=seg===2?0.5:0.15;
      ctx.fillRect(cx-0.3,cyTop-0.9,cw+0.6,0.5); ctx.globalAlpha=1;
      v.label(ctx,`холодильник T₂ = ${p.T2} K`,cx+cw/2,cyTop-0.9,-50,-4,seg===2?sec:ink3);
    }
    // цилиндр
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.5);
    ctx.beginPath(); ctx.moveTo(cx,cyTop); ctx.lineTo(cx,cyTop+cyH); ctx.lineTo(cx+cw,cyTop+cyH); ctx.lineTo(cx+cw,cyTop); ctx.stroke();
    ctx.fillStyle=acc; ctx.globalAlpha=.12; ctx.fillRect(cx,pistonY,cw,cyTop+cyH-pistonY); ctx.globalAlpha=1;
    ctx.fillStyle=sec; ctx.fillRect(cx,pistonY-0.22,cw,0.22);
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2.5); ctx.beginPath(); ctx.moveTo(cx+cw/2,pistonY-0.22); ctx.lineTo(cx+cw/2,cyTop-1.4); ctx.stroke();
    const phase=['A→B изотерм. расширение','B→C адиабат. расширение','C→D изотерм. сжатие','D→A адиабат. сжатие'][seg];
    v.label(ctx,phase,cx+cw/2,cyTop,-46,-30,ink3);
    v.label(ctx,`T = ${st.T.toFixed(0)} K`,cx+cw/2,pistonY,cw*20+6,0,ink3);
    v.label(ctx,'цикл Карно — на панели справа →',cx+cw/2,cyTop+cyH,-64,26,ink3);
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
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),1e-7,30);
    return {x:0,y:0.2,scale};
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
    v.label(ctx,'подведённая теплота Q',x1,y0,-90,16,ink3);
    // опорные температуры
    for(const [T,lab,col] of [[S.Tm,`плавление ${S.Tm} °C`,sec],[S.Tb,`кипение ${S.Tb} °C`,dang]]){
      ctx.strokeStyle=col; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(x0,Y(T)); ctx.lineTo(x1,Y(T)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,lab,x0,Y(T),4,-6,col);
    }
    // сама ломаная: наклон — нагрев, полка — переход
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
    ctx.moveTo(X(0),Y(stg[0].T0));
    for(const g of stg){ ctx.lineTo(X(g.Q0),Y(g.T0)); ctx.lineTo(X(g.Q1),Y(g.T1)); }
    ctx.stroke();
    // подписи этапов
    for(const g of stg){
      const xm=(X(g.Q0)+X(g.Q1))/2, flat=Math.abs(g.T1-g.T0)<1e-9;
      if(X(g.Q1)-X(g.Q0)<0.5) continue;
      v.label(ctx,g.kind,xm,Y((g.T0+g.T1)/2),-24,flat?-10:14,flat?meas:ink3);
    }
    // текущая точка
    const cx=X(s.Q), cy=Y(cur.T);
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(3),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(cx,y0); ctx.lineTo(cx,cy); ctx.moveTo(x0,cy); ctx.lineTo(cx,cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(cx,cy,v.lw(4.5),0,7); ctx.fill();
    v.label(ctx,`${cur.T.toFixed(1)} °C`,cx,cy,8,-8,dang);
    // ---- полоса подведённой теплоты ----
    if(p.bar){
      const by=-2.5, bh=0.42;
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
      v.label(ctx,`подведено ${(s.Q/1000).toFixed(1)} кДж из ${(Qt/1000).toFixed(1)} кДж`,x0,by,0,-8,ink3);
      v.label(ctx,`ширина участка = сколько теплоты он «съедает»`,x0,by,0,bh*20+14,ink3);
    }
    // вывод
    v.label(ctx,`${S.name}, ${p.m} кг: сейчас — ${cur.kind}`,x0,-3.4,0,0,acc);
    v.label(ctx,'на полке вся теплота идёт на разрыв связей, а не на нагрев — термометр стоит',
      x0,-3.4,0,16,ink3);
  }
}

});
