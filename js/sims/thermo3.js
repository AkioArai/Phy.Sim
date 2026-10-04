/* ===================== КАПИЛЛЯРЫ, ТВЁРДЫЕ ТЕЛА, ДВИГАТЕЛИ (6.4.0) =====================
   capillary — подъём жидкости в трёх трубках радиусов r, 2r, 4r:
       h = 2σ·cosθ / (ρ·g·r).
   Смачивающая жидкость (вода, спирт) поднимается, несмачивающая (ртуть,
   θ > 90°) опускается. Всё в миллиметрах.

   tensile — испытание стержня на растяжение. Деформацию задаёт машина:
   ε растёт равномерно, напряжение — по диаграмме материала: прямая Гука
   σ = Eε до предела текучести, затем упрочнение до предела прочности,
   шейка и разрыв. Хрупкий чугун рвётся почти без пластической части.
   Второй опыт — нагрев: свободный стержень удлиняется на Δl = αlΔT,
   зажатый между стенами получает напряжение σ = EαΔT.

   otto — циклы Отто (бензиновый) и Дизеля в pV-координатах: две адиабаты,
   изохора (у Дизеля — изобара подвода тепла) и изохора выпуска. КПД
       Отто:   η = 1 − ε^(1−γ),
       Дизель: η = 1 − (β^γ − 1) / (γ·ε^(γ−1)·(β − 1)), β — степень предварительного расширения.
   Работа и теплота считаются численно по участкам — так формула КПД
   проверяется, а не переписывается. */
Object.assign(SIMS,{
capillary:{
  title:'Капилляры: подъём и опускание жидкости',
  timeless:true,
  gridUnit:'мм',
  params:[
    {key:'liq',label:'Жидкость',type:'select',default:'water',
     options:[{v:'water',t:'вода: σ = 73 мН/м, смачивает стекло'},{v:'spirit',t:'спирт: σ = 22 мН/м, смачивает'},
              {v:'merc',t:'ртуть: σ = 485 мН/м, не смачивает (θ = 140°)'}]},
    {key:'r',label:'Радиус самой узкой трубки r',unit:'мм',min:0.1,max:2,step:0.05,default:0.5},
    {key:'g',label:'Ускорение g',unit:'м/с²',min:0.5,max:25,step:0.1,default:9.8},
    {type:'group',label:'Показывать'},
    {key:'press',label:'Давление под мениском',type:'check',default:true}
  ],
  LIQ:{water:{σ:0.0728,ρ:1000,θ:0,имя:'вода'},spirit:{σ:0.0223,ρ:789,θ:0,имя:'спирт'},merc:{σ:0.485,ρ:13546,θ:140,имя:'ртуть'}},
  ж(p){ return this.LIQ[p.liq]||this.LIQ.water; },
  h(p,r){ const ж=this.ж(p); return 2*ж.σ*Math.cos(ж.θ*Math.PI/180)/(ж.ρ*p.g*r/1000)*1000; },   // мм, r в мм
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt){ s.t+=dt; },
  readouts(s,p){
    const ж=this.ж(p), out=[];
    [1,2,4].forEach((k,i)=>out.push([`трубка ${i+1} (r = ${(p.r*k).toFixed(2)} мм): высота h`,this.h(p,p.r*k),'мм']));
    out.push(['краевой угол θ',ж.θ,'°'],['поверхностное натяжение σ',ж.σ*1000,'мН/м']);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Вода в тонких трубках',values:{liq:'water',r:0.5}},
    {name:'Ртуть опускается',values:{liq:'merc',r:0.5}},
    {name:'Спирт: натяжение втрое слабее',values:{liq:'spirit',r:0.5}},
    {name:'Вода на Луне: поднимется в шесть раз выше',values:{liq:'water',r:0.5,g:1.6}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, hm=Math.min(400,Math.abs(this.h(p,p.r)));
    const sp=Math.max(40,hm*1.25+30), wx=Math.max(70,sp*0.9);
    const scale=clamp(Math.min((W-30)/(wx*PX_PER_M),(H-30)/(sp*PX_PER_M)),1e-4,30);
    return {x:wx*0.32,y:(this.h(p,p.r)>0?hm*0.45:-hm*0.3)+4,scale};
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  draw(ctx,s,v,p){
    const sec=v.c('--second'), meas=v.c('--measure'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), acc=v.c('--accent');
    const ж=this.ж(p), hm=Math.abs(this.h(p,p.r)), W=Math.max(70,(Math.min(400,hm)*1.25+30)*0.9);
    const цв=p.liq==='merc'?ink3:sec, a=p.liq==='merc'?.45:.2;
    // ванночка: уровень жидкости на y = 0
    const bx0=-W*0.1, bx1=W*0.78, дно=-Math.max(12,Math.min(400,hm)*0.45);
    ctx.fillStyle=цв; ctx.globalAlpha=a; ctx.fillRect(bx0,дно,bx1-bx0,-дно); ctx.globalAlpha=1;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(bx0,6); ctx.lineTo(bx0,дно); ctx.lineTo(bx1,дно); ctx.lineTo(bx1,6); ctx.stroke();
    ctx.strokeStyle=цв; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(bx0,0); ctx.lineTo(bx1,0); ctx.stroke();
    // трубки: рисуем шире настоящих, но в той же пропорции радиусов
    const xs=[W*0.12,W*0.34,W*0.58], вис=Math.max(2.4,Math.min(400,hm)*0.07);
    [1,2,4].forEach((k,i)=>{
      const r=p.r*k, h=this.h(p,r), hв=clamp(h,-400,400), w=вис*Math.sqrt(k)*0.6, x=xs[i];
      const верх=Math.max(hв,0)+Math.max(15,hm*0.25), низ=дно*0.7;
      ctx.fillStyle=цв; ctx.globalAlpha=a*1.4;
      ctx.fillRect(x-w,низ,2*w,hв-низ); ctx.globalAlpha=1;
      // мениск: вогнутый у смачивающей, выпуклый у ртути
      ctx.strokeStyle=цв; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(x-w,hв);
      ctx.quadraticCurveTo(x,hв+(ж.θ<90?-1:1)*w*0.9,x+w,hв); ctx.stroke();
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(x-w,верх); ctx.lineTo(x-w,низ); ctx.moveTo(x+w,верх); ctx.lineTo(x+w,низ); ctx.stroke();
      ctx.strokeStyle=meas; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.beginPath(); ctx.moveTo(x+w+1,0); ctx.lineTo(x+w+1,hв); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,`h = ${h.toFixed(h<10&&h>-10?1:0)} мм`,x+w,hв,6,h>=0?-10:12,meas);
      v.label(ctx,`r = ${r.toFixed(2)} мм`,x-w,низ,-4,14+i*12,ink3);
      if(p.press&&i===0){ const dp=2*ж.σ/(r/1000); v.label(ctx,`Δp = 2σ/r = ${dp.toFixed(0)} Па`,x,hв,-40,h>=0?-26:28,acc); }
    });
    v.label(ctx,`${ж.имя}: высота обратно пропорциональна радиусу`,bx0,дно,0,16,ink2);
  }
},

tensile:{
  title:'Растяжение и тепловое расширение стержня',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'stretch',
     options:[{v:'stretch',t:'Растяжение на разрывной машине'},{v:'thermal',t:'Нагрев: свободный и зажатый стержень'}]},
    {key:'mat',label:'Материал',type:'select',default:'steel',
     options:[{v:'steel',t:'малоуглеродистая сталь'},{v:'cu',t:'медь'},{v:'al',t:'алюминиевый сплав'},{v:'iron',t:'чугун (хрупкий)'}]},
    {key:'L',label:'Длина стержня l₀',unit:'м',min:0.1,max:3,step:0.05,default:1},
    {key:'d',label:'Диаметр d',unit:'мм',min:2,max:40,step:0.5,default:10},
    {key:'rate',label:'Скорость растяжения',unit:'%/с',min:0.1,max:10,step:0.1,default:2,если:p=>p.mode==='stretch'},
    {key:'dTr',label:'Скорость нагрева',unit:'°C/с',min:1,max:100,step:1,default:20,если:p=>p.mode==='thermal'},
    {key:'Tmax',label:'Нагреть на',unit:'°C',min:10,max:600,step:5,default:200,если:p=>p.mode==='thermal'},
    {type:'group',label:'Показывать'},
    {key:'diag',label:'Диаграмма σ(ε)',type:'check',default:true}
  ],
  /* E — модуль Юнга, sy/su — пределы текучести и прочности, eu — деформация
     при пределе прочности, ef — при разрыве, α — коэффициент расширения */
  MAT:{steel:{E:200e9,sy:250e6,su:420e6,eu:0.20,ef:0.30,α:12e-6,имя:'сталь'},
       cu:{E:110e9,sy:70e6,su:220e6,eu:0.35,ef:0.45,α:17e-6,имя:'медь'},
       al:{E:70e9,sy:275e6,su:310e6,eu:0.10,ef:0.13,α:23e-6,имя:'алюминиевый сплав'},
       iron:{E:100e9,sy:180e6,su:180e6,eu:0.0018,ef:0.0018,α:10e-6,имя:'чугун'}},
  м(p){ return this.MAT[p.mat]||this.MAT.steel; },
  S(p){ return Math.PI*Math.pow(p.d/2000,2); },
  /* напряжение по деформации */
  σ(p,ε){
    const м=this.м(p), εy=м.sy/м.E;
    if(ε<=εy) return м.E*ε;
    if(ε<=м.eu){ const u=(ε-εy)/Math.max(1e-9,м.eu-εy); return м.sy+(м.su-м.sy)*(1-(1-u)*(1-u)); }
    if(ε<м.ef){ const u=(ε-м.eu)/(м.ef-м.eu); return м.su*(1-0.25*u*u); }
    return 0;
  },
  стадия(p,ε){ const м=this.м(p), εy=м.sy/м.E;
    if(ε>=м.ef) return 'разрыв'; if(ε<=εy) return 'упругая деформация (закон Гука)';
    if(ε<=м.eu) return 'пластическая деформация, упрочнение'; return 'шейка: сечение сужается'; },
  init(p){ return {t:0,ε:0,ΔT:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    s.t+=dt;
    if(p.mode==='stretch'){
      const м=this.м(p), εy=м.sy/м.E;
      // на упругом участке идём медленнее — иначе он проскакивает за кадр
      const скор=s.ε<εy*1.05?Math.min(p.rate/100,εy/2):p.rate/100;   // упругий участок — около двух секунд
      s.ε+=скор*dt;
      if(s.ε>=м.ef){ s.ε=м.ef; s.event={type:'break',t:s.t}; s.__stop=`Стержень разорван при удлинении ${(м.ef*100).toFixed(м.ef<0.01?2:0)} %`; }
    } else {
      s.ΔT=Math.min(p.Tmax,s.ΔT+p.dTr*dt);
      if(s.ΔT>=p.Tmax){ s.event={type:'end',t:s.t}; s.__stop=`Нагрели на ${p.Tmax} °C`; }
    }
  },
  readouts(s,p){
    const м=this.м(p), S=this.S(p);
    if(p.mode==='thermal'){
      const σ=м.E*м.α*s.ΔT;
      return [['t',s.t,'с'],['нагрев ΔT',s.ΔT,'°C'],['свободный стержень: удлинение Δl',м.α*p.L*s.ΔT*1000,'мм'],
        ['зажатый стержень: напряжение σ',σ/1e6,'МПа'],['сила давления на стены',σ*S/1000,'кН'],
        ['предел текучести материала',м.sy/1e6,'МПа']];
    }
    const σ=this.σ(p,s.ε);
    return [['t',s.t,'с'],['деформация ε',s.ε*100,'%'],['удлинение Δl',s.ε*p.L*1000,'мм'],
      ['напряжение σ = F/S',σ/1e6,'МПа'],['сила F',σ*S/1000,'кН'],['стадия',this.стадия(p,s.ε),'']];
  },
  graphs:[
    {label:'σ(t) — напряжение в стержне',unit:'МПа',series:['σ'],get(s,p){ const T=SIMS.tensile, м=T.м(p);
      return [p.mode==='thermal'?м.E*м.α*s.ΔT/1e6:T.σ(p,s.ε)/1e6,null]; }}
  ],
  presets:[
    {name:'Сталь: площадка текучести и шейка',values:{mode:'stretch',mat:'steel'}},
    {name:'Чугун рвётся без предупреждения',values:{mode:'stretch',mat:'iron'}},
    {name:'Медь тянется почти вдвое',values:{mode:'stretch',mat:'cu'}},
    {name:'Рельс в жару: зажатый стержень',values:{mode:'thermal',mat:'steel',Tmax:50}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(9.6*PX_PER_M),(H-20)/(5.6*PX_PER_M)),0.002,30);
    return {x:4.5,y:2.4,scale};
  },
  anchors(){ return [{x:0,y:0},{x:9,y:5}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line'), ok=v.c('--ok');
    const м=this.м(p);
    if(p.mode==='thermal'){
      const Δ=м.α*s.ΔT, вид=Δ*600;                                   // удлинение — с увеличением
      v.label(ctx,'удлинение показано с увеличением в 600 раз',0,4.9,0,0,ink3);
      // свободный стержень
      ctx.fillStyle=this.цвет(s.ΔT,p.Tmax); ctx.fillRect(0.3,3.4,4*(1+вид),0.45);
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.2); ctx.strokeRect(0.3,3.4,4*(1+вид),0.45);
      ctx.strokeStyle=line; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(4.3,3.2); ctx.lineTo(4.3,4.05); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,`свободный: Δl = αl₀ΔT = ${(Δ*p.L*1000).toFixed(2)} мм`,0.3,3.4,0,-12,ink2);
      // зажатый
      ctx.fillStyle=ink3; ctx.fillRect(0,1.2,0.3,1.4); ctx.fillRect(4.3,1.2,0.3,1.4);
      ctx.fillStyle=this.цвет(s.ΔT,p.Tmax); ctx.fillRect(0.3,1.68,4,0.45);
      const σ=м.E*Δ, к=σ/м.sy;
      ctx.strokeStyle=к>1?dang:ink2; ctx.lineWidth=v.lw(1.2); ctx.strokeRect(0.3,1.68,4,0.45);
      const L=Math.min(1.4,0.25+0.9*к);
      v.arrow(ctx,0.3,1.9,0.3-L*0.4,1.9,dang); v.arrow(ctx,4.3,1.9,4.3+L*0.4,1.9,dang);
      v.label(ctx,`зажатый: σ = EαΔT = ${(σ/1e6).toFixed(0)} МПа${к>1?' — больше предела текучести!':''}`,0.3,1.2,0,14,к>1?dang:ink2);
      // шкала напряжения относительно предела текучести
      ctx.fillStyle=line; ctx.fillRect(5.6,0.6,0.35,3.8); ctx.fillStyle=к>1?dang:meas; ctx.fillRect(5.6,0.6,0.35,3.8*Math.min(1.2,к)/1.2);
      ctx.strokeStyle=dang; ctx.beginPath(); ctx.moveTo(5.5,0.6+3.8/1.2); ctx.lineTo(6.05,0.6+3.8/1.2); ctx.stroke();
      v.label(ctx,'предел текучести',6.05,0.6+3.8/1.2,6,0,dang);
      return;
    }
    // испытательная машина: стержень между захватами
    const ε=s.ε, εвид=Math.min(1,ε/Math.max(м.ef,0.002))*1.2, разрыв=s.event&&s.event.type==='break';
    const x0=0.6, y0=0.4, L0=3.2, Lвид=L0*(1+εвид*0.5), cx=x0+0.4;
    ctx.fillStyle=ink3; ctx.fillRect(cx-0.55,y0-0.3,1.1,0.3); ctx.fillRect(cx-0.55,y0+Lвид,1.1,0.3);
    const ш=this.стадия(p,ε).startsWith('шейка')||разрыв, rw=0.22;
    ctx.fillStyle=acc; ctx.globalAlpha=.25; ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); const m=y0+Lвид/2, суж=ш?rw*(1-0.55*Math.min(1,(ε-м.eu)/Math.max(1e-9,м.ef-м.eu))):rw*(1-0.25*Math.min(1,ε));
    ctx.moveTo(cx-rw,y0); ctx.lineTo(cx-rw,m-0.6); ctx.quadraticCurveTo(cx-суж,m,cx-rw,m+0.6); ctx.lineTo(cx-rw,y0+Lвид);
    ctx.lineTo(cx+rw,y0+Lвид); ctx.lineTo(cx+rw,m+0.6); ctx.quadraticCurveTo(cx+суж,m,cx+rw,m-0.6); ctx.lineTo(cx+rw,y0); ctx.closePath();
    ctx.fill(); ctx.globalAlpha=1; ctx.stroke();
    if(разрыв){ ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.4); ctx.beginPath(); ctx.moveTo(cx-rw-0.1,m-0.04); ctx.lineTo(cx-0.05,m+0.05); ctx.lineTo(cx+rw+0.1,m-0.03); ctx.stroke(); }
    const F=this.σ(p,ε)*this.S(p);
    v.arrow(ctx,cx,y0+Lвид+0.3,cx,y0+Lвид+0.3+Math.min(0.9,0.2+F/(м.su*this.S(p))*0.7),meas);
    v.label(ctx,`F = ${(F/1000).toFixed(1)} кН`,cx,y0+Lвид+0.5,12,0,meas);
    v.label(ctx,this.стадия(p,ε),x0-0.4,y0,0,16,разрыв?dang:ink2);
    // диаграмма растяжения
    if(p.diag){
      const gx=3.2, gy=0.5, gw=5.6, gh=3.8, εm=м.ef*1.08, σm=м.su*1.15;
      const X=e=>gx+e/εm*gw, Y=σ=>gy+σ/σm*gh;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(gx,gy+gh+0.2); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw+0.2,gy); ctx.stroke();
      v.label(ctx,'σ, МПа',gx,gy+gh+0.2,6,0,ink3); v.label(ctx,'ε',gx+gw+0.2,gy,-6,12,ink3);
      ctx.strokeStyle=line; ctx.lineWidth=v.lw(1); ctx.beginPath();
      for(let i=0;i<=300;i++){ const e=м.ef*i/300; i?ctx.lineTo(X(e),Y(this.σ(p,e))):ctx.moveTo(X(e),Y(0)); } ctx.stroke();
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=200;i++){ const e=Math.min(ε,м.ef*0.9999)*i/200; i?ctx.lineTo(X(e),Y(this.σ(p,e))):ctx.moveTo(X(e),Y(0)); } ctx.stroke();
      for(const [σ,имя,цв] of [[м.sy,'предел текучести',sec],[м.su,'предел прочности',dang]]){
        ctx.strokeStyle=цв; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(gx,Y(σ)); ctx.lineTo(gx+gw,Y(σ)); ctx.stroke(); ctx.setLineDash([]);
        if(м.sy!==м.su||цв===dang) v.label(ctx,`${имя} ${(σ/1e6).toFixed(0)}`,gx+gw,Y(σ),-140,-8,цв); }
      ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(X(ε),Y(this.σ(p,ε)),v.lw(4),0,7); ctx.fill();
    }
  },
  цвет(ΔT,Tm){ const k=clamp(ΔT/Math.max(1,Tm),0,1); return `rgb(${Math.round(120+135*k)},${Math.round(130-60*k)},${Math.round(160-120*k)})`; }
},

otto:{
  title:'Циклы Отто и Дизеля: как работает двигатель',
  schema:true,
  params:[
    {key:'cyc',label:'Цикл',type:'select',default:'otto',
     options:[{v:'otto',t:'Отто: бензиновый двигатель'},{v:'diesel',t:'Дизель: воспламенение от сжатия'}]},
    {key:'eps',label:'Степень сжатия ε = V₁/V₂',min:3,max:24,step:0.5,default:9},
    {key:'rho',label:'Степень предварительного расширения β',min:1.1,max:4,step:0.1,default:2,если:p=>p.cyc==='diesel'},
    {key:'qin',label:'Тепло от сгорания на цикл',unit:'Дж',min:50,max:2000,step:10,default:600,если:p=>p.cyc==='otto'},
    {key:'gam',label:'Показатель адиабаты γ',min:1.2,max:1.67,step:0.01,default:1.4},
    {key:'T1',label:'Температура на впуске T₁',unit:'К',min:250,max:400,step:1,default:300},
    {key:'p1',label:'Давление на впуске p₁',unit:'кПа',min:50,max:200,step:1,default:100},
    {key:'V1',label:'Объём цилиндра V₁',unit:'л',min:0.1,max:2,step:0.05,default:0.5},
    {type:'group',label:'Показывать'},
    {key:'carnot',label:'КПД Карно для тех же температур',type:'check',default:true}
  ],
  /* четыре вершины цикла: 1 — впуск (низ), 2 — после сжатия, 3 — после
     сгорания, 4 — перед выпуском */
  точки(p){
    const g=p.gam, V1=p.V1/1000, p1=p.p1*1000, V2=V1/p.eps, ν=p1*V1/(8.314462618*p.T1), Cv=8.314462618/(g-1);
    const p2=p1*Math.pow(p.eps,g), T2=p.T1*Math.pow(p.eps,g-1);
    let p3,V3,T3;
    if(p.cyc==='otto'){ T3=T2+p.qin/(ν*Cv); V3=V2; p3=p2*T3/T2; }
    else { V3=V2*p.rho; p3=p2; T3=T2*p.rho; }
    const p4=p3*Math.pow(V3/V1,g), T4=T3*Math.pow(V3/V1,g-1);
    return {g,ν,Cv,P:[[V1,p1,p.T1],[V2,p2,T2],[V3,p3,T3],[V1,p4,T4]]};
  },
  /* путь по циклу: параметр u ∈ [0, 4) */
  на(p,u){
    const {g,P}=this.точки(p), k=Math.floor(u)%4, f=u-Math.floor(u), [a,b]=[P[k],P[(k+1)%4]];
    if(k===0||k===2){ const V=a[0]*Math.pow(b[0]/a[0],f), pp=a[1]*Math.pow(a[0]/V,g); return [V,pp]; }   // адиабаты
    if(k===1&&p.cyc==='diesel'){ const V=a[0]+(b[0]-a[0])*f; return [V,a[1]]; }                  // изобара
    return [a[0],a[1]+(b[1]-a[1])*f];                                                         // изохоры
  },
  /* работа и теплоты — численно по участкам */
  баланс(p){
    const {g,ν,Cv,P}=this.точки(p), R=8.314462618, n=4000;
    let A=0;
    for(let k=0;k<4;k++) for(let i=0;i<n;i++){ const [Va,pa]=this.на(p,k+i/n), [Vb,pb]=this.на(p,k+(i+1)/n); A+=(pa+pb)/2*(Vb-Va); }
    const Q1=p.cyc==='otto'?ν*Cv*(P[2][2]-P[1][2]):ν*(Cv+R)*(P[2][2]-P[1][2]);
    const Q2=ν*Cv*(P[3][2]-P[0][2]);
    return {A,Q1,Q2,η:A/Q1};
  },
  ηформула(p){ const g=p.gam, e=p.eps; if(p.cyc==='otto') return 1-Math.pow(e,1-g);
    const r=p.rho; return 1-(Math.pow(r,g)-1)/(g*Math.pow(e,g-1)*(r-1)); },
  init(p){ return {t:0,u:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.u=(s.u+dt*0.8)%4; },
  readouts(s,p){
    const {P}=this.точки(p), б=this.баланс(p);
    const out=[['t',s.t,'с'],['работа за цикл A',б.A,'Дж'],['получено тепла Q₁',б.Q1,'Дж'],['отдано тепла Q₂',б.Q2,'Дж'],
      ['КПД = A/Q₁',100*б.η,'%'],['наибольшая температура',P[2][2],'К'],['давление в конце сжатия',P[1][1]/1e5,'атм']];
    return out;
  },
  graphs:[
    {label:'Давление в цилиндре',unit:'атм',series:['p'],get(s,p){ return [SIMS.otto.на(p,s.u)[1]/1e5,null]; }}
  ],
  presets:[
    {name:'Бензиновый двигатель: ε = 9',values:{cyc:'otto',eps:9}},
    {name:'Дизель: ε = 18',values:{cyc:'diesel',eps:18,rho:2}},
    {name:'Слабое сжатие — низкий КПД',values:{cyc:'otto',eps:4}},
    {name:'Одноатомный газ вместо воздуха',values:{cyc:'otto',eps:9,gam:1.67}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(9.4*PX_PER_M),(H-20)/(5.4*PX_PER_M)),0.002,30);
    return {x:4.5,y:2.5,scale};
  },
  anchors(){ return [{x:0,y:0},{x:9,y:5}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const {P}=this.точки(p), Vm=P[0][0]*1.08, pm=Math.max(P[2][1],P[1][1])*1.1;
    const gx=0.4, gy=0.4, gw=5.4, gh=4;
    const X=V=>gx+V/Vm*gw, Y=pp=>gy+pp/pm*gh;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(gx,gy+gh+0.2); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw+0.2,gy); ctx.stroke();
    v.label(ctx,'p',gx,gy+gh+0.2,6,0,ink3); v.label(ctx,'V',gx+gw+0.2,gy,-8,12,ink3);
    // площадь цикла — работа
    ctx.fillStyle=acc; ctx.globalAlpha=.15; ctx.beginPath();
    for(let i=0;i<=400;i++){ const [V,pp]=this.на(p,i/100); i?ctx.lineTo(X(V),Y(pp)):ctx.moveTo(X(V),Y(pp)); }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
    const цв=[ink2,dang,acc,sec], имена=['сжатие (адиабата)',p.cyc==='otto'?'вспышка (изохора)':'сгорание (изобара)','рабочий ход (адиабата)','выпуск (изохора)'];
    for(let k=0;k<4;k++){ ctx.strokeStyle=цв[k]; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=80;i++){ const [V,pp]=this.на(p,k+i/80); i?ctx.lineTo(X(V),Y(pp)):ctx.moveTo(X(V),Y(pp)); } ctx.stroke(); }
    P.forEach((q,i)=>{ ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(X(q[0]),Y(q[1]),v.lw(3),0,7); ctx.fill(); v.label(ctx,String(i+1),X(q[0]),Y(q[1]),6,-8,ink2); });
    const [V,pp]=this.на(p,s.u), k=Math.floor(s.u);
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(X(V),Y(pp),v.lw(5),0,7); ctx.fill();
    v.label(ctx,имена[k],gx+gw*0.35,gy+gh,0,0,цв[k]);
    // цилиндр и поршень
    const cx0=6.6, cx1=8.4, низ=0.4, H=4.2, hV=0.4+3.4*V/Vm;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(cx0,низ+H); ctx.lineTo(cx0,низ); ctx.lineTo(cx1,низ); ctx.lineTo(cx1,низ+H); ctx.stroke();
    const T=pp*V/(this.точки(p).ν*8.314462618), гор=clamp((T-p.T1)/(P[2][2]-p.T1),0,1);
    ctx.fillStyle=`rgba(${Math.round(80+175*гор)},${Math.round(120-40*гор)},${Math.round(220-180*гор)},0.35)`; ctx.fillRect(cx0,низ,cx1-cx0,hV);
    if(k===1){ ctx.fillStyle=dang; ctx.globalAlpha=.5; ctx.beginPath(); ctx.arc((cx0+cx1)/2,низ+hV*0.5,0.25+0.15*Math.sin(s.t*30),0,7); ctx.fill(); ctx.globalAlpha=1; }
    ctx.fillStyle=ink3; ctx.fillRect(cx0+0.05,низ+hV,cx1-cx0-0.1,0.3);
    ctx.strokeStyle=ink2; ctx.beginPath(); ctx.moveTo((cx0+cx1)/2,низ+hV+0.3); ctx.lineTo((cx0+cx1)/2,низ+H+0.4); ctx.stroke();
    v.label(ctx,`T = ${T.toFixed(0)} К`,cx0,низ,0,14,ink2);
    const б=this.баланс(p);
    v.label(ctx,`КПД ${(100*б.η).toFixed(1)} %`,gx+gw*0.55,gy+gh*0.8,0,0,acc);
    if(p.carnot){ const ηк=1-p.T1/P[2][2]; v.label(ctx,`Карно между ${p.T1} и ${P[2][2].toFixed(0)} К: ${(100*ηк).toFixed(0)} %`,gx+gw*0.55,gy+gh*0.8,0,16,ink3); }
  }
}
});
