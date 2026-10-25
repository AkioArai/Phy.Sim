/* ===================== ГИДРОМЕХАНИКА (6.2.0) =====================
   Две сцены к теме «Гидромеханика».

   torricelli — истечение из сосуда. Из уравнения Бернулли для поверхности
   и отверстия скорость струи v = √(2gh / (1 − r²)), где h — напор над
   отверстием, r = a/A — отношение площадей отверстия и сосуда (при узком
   отверстии r → 0 и остаётся формула Торричелли v = √(2gh), скорость
   свободного падения с высоты h). Уровень падает со скоростью r·v, поэтому
   √h убывает линейно:  √h(t) = √h₀ − βt/2,  β = r·√(2g/(1 − r²)).
   Струя летит горизонтально и падает на пол на расстоянии L = v·√(2z/g),
   при r → 0  L = 2√(h·z): дальше всех бьёт отверстие посередине столба.

   drag — шарик в вязкой жидкости. Уравнение движения (ось вниз):
       m·dv/dt = (m − ρV)·g − F(v).
   Сопротивление на выбор: линейное по Стоксу 6πηrv, квадратичное
   ½·C·ρ·πr²·v² с C = 0,47 или полное с коэффициентом C(Re) по формуле
   Уайта: C = 24/Re + 6/(1 + √Re) + 0,4 — оно само переходит от Стокса
   к квадратичному закону с ростом числа Рейнольдса Re = 2ρvr/η.
   Время релаксации у малых шариков — доли миллисекунды, поэтому шаг
   сделан неявным: он устойчив при любом dt. */
Object.assign(SIMS,{
torricelli:{
  title:'Истечение из сосуда: формула Торричелли',
  params:[
    {key:'mode',label:'Отверстия',type:'select',default:'one',
     options:[{v:'one',t:'одно отверстие на высоте z'},{v:'two',t:'два отверстия: z и z₂'},{v:'three',t:'три отверстия: ¼, ½ и ¾ начального уровня'}]},
    {key:'Y0',label:'Начальный уровень воды Y₀',unit:'м',min:0.3,max:2,step:0.01,default:1.2},
    {key:'z', label:'Высота отверстия над полом z',unit:'м',min:0.02,max:1.9,step:0.01,default:0.4,если:p=>p.mode!=='three'},
    {key:'z2',label:'Высота второго отверстия z₂',unit:'м',min:0.02,max:1.9,step:0.01,default:0.8,если:p=>p.mode==='two'},
    {key:'d', label:'Диаметр отверстия d',unit:'мм',min:3,max:40,step:1,default:12},
    {key:'D', label:'Диаметр сосуда D',unit:'см',min:5,max:80,step:1,default:30},
    {key:'fill',label:'Доливать: уровень держится постоянным',type:'check',default:false},
    {key:'g', label:'Ускорение g',unit:'м/с²',min:1,max:25,step:0.1,default:9.8},
    {type:'group',label:'Показывать'},
    {key:'jets',label:'Струи и точки падения',type:'check',default:true},
    {key:'vec', label:'Скорость вытекания',type:'check',default:true},
    {key:'flow',label:'Метки течения в сосуде',type:'check',default:true}
  ],
  r(p){ return Math.pow(p.d/1000/(p.D/100),2); },
  дыры(p){ if(p.mode==='three') return [p.Y0/4,p.Y0/2,3*p.Y0/4];
    if(p.mode==='two') return [Math.min(p.z,p.Y0),Math.min(p.z2==null?0.8:p.z2,p.Y0)];
    return [Math.min(p.z,p.Y0)]; },
  /* скорости струй при уровне Y: Бернулли с учётом скорости опускания поверхности U */
  скорости(p,Y){
    const z=this.дыры(p), r=p.fill?0:this.r(p);
    if(z.length===1){ const h=Math.max(0,Y-z[0]); return [Math.sqrt(2*p.g*h/(1-r*r))]; }
    let U=0, v=[];
    for(let k=0;k<30;k++){ v=z.map(zz=>Y>zz?Math.sqrt(2*p.g*(Y-zz)+U*U):0); U=r*v.reduce((a,b)=>a+b,0); }
    return v;
  },
  уровень1(p,t){ const z=this.дыры(p)[0], h0=Math.max(0,p.Y0-z), r=this.r(p), β=r*Math.sqrt(2*p.g/(1-r*r));
    const к=Math.sqrt(h0)-β*t/2; return z+(к>0?к*к:0); },
  init(p){ return {t:0,Y:p.Y0,event:null,__stop:null,фаза:0}; },
  step(s,dt,p){
    if(s.event) return;
    s.фаза=(s.фаза+dt)%10;
    const z=this.дыры(p), низ=Math.min(...z);
    if(p.fill){ s.t+=dt; s.Y=p.Y0; return; }
    if(z.length===1){ s.t+=dt; s.Y=this.уровень1(p,s.t); }
    else { // RK4 по уровню
      const f=Y=>-this.r(p)*this.скорости(p,Y).reduce((a,b)=>a+b,0);
      const n=4, h=dt/n;
      for(let i=0;i<n;i++){ const Y=s.Y, k1=f(Y), k2=f(Y+h*k1/2), k3=f(Y+h*k2/2), k4=f(Y+h*k3);
        s.Y=Math.max(низ,Y+h*(k1+2*k2+2*k3+k4)/6); }
      s.t+=dt;
    }
    if(s.Y<=низ+1e-9){ s.Y=низ; s.event={type:'empty',t:s.t};
      s.__stop=`Вода вытекла до ${z.length>1?'нижнего ':''}отверстия за ${s.t.toFixed(1)} с`; }
  },
  readouts(s,p){
    const z=this.дыры(p), v=this.скорости(p,s.Y), r=this.r(p), a=Math.PI*Math.pow(p.d/2000,2);
    const out=[['t',s.t,'с'],['уровень воды Y',s.Y,'м']];
    if(z.length===1){
      out.push(['напор h = Y − z',s.Y-z[0],'м'],['скорость струи v',v[0],'м/с'],
        ['дальность струи L',v[0]*Math.sqrt(2*z[0]/p.g),'м'],['расход Q = a·v',a*v[0]*1000,'л/с'],
        ['скорость опускания уровня',p.fill?0:r*v[0]*100,'см/с']);
    } else z.forEach((zz,i)=>out.push([`отверстие ${i+1} (z = ${zz.toFixed(2)} м): v`,v[i],'м/с'],[`отверстие ${i+1}: дальность L`,v[i]*Math.sqrt(2*zz/p.g),'м']));
    out.push(['отдача струй на сосуд ρav²',1000*a*v.reduce((q,x)=>q+x*x,0),'Н']);
    if(p.fill) out.push(['доливают',a*v.reduce((q,x)=>q+x,0)*1000,'л/с']);
    return out;
  },
  graphs:[
    {label:'Y(t) — уровень воды',unit:'м',series:['Y'],get:s=>[s.Y,null]},
    {label:'v(t) — скорость струи (нижнее отверстие)',unit:'м/с',series:['v'],get(s,p){ return [SIMS.torricelli.скорости(p,s.Y)[0],null]; }},
    {label:'√h(t) — убывает по прямой',unit:'√м',series:['√h'],get(s,p){ return [Math.sqrt(Math.max(0,s.Y-SIMS.torricelli.дыры(p)[0])),null]; }}
  ],
  presets:[
    {name:'Три струи: дальше всех бьёт средняя',values:{mode:'three',Y0:1.2,d:8,D:30}},
    {name:'Отверстие посередине: рекордная дальность',values:{mode:'one',Y0:1.2,z:0.6,d:10,D:20}},
    {name:'Две струи падают в одну точку',values:{mode:'two',Y0:1.2,z:0.3,z2:0.9,d:10,D:30}},
    {name:'Уровень держат постоянным',values:{mode:'one',Y0:1.2,z:0.4,d:12,D:30,fill:true}},
    {name:'Широкое отверстие: сосуд пустеет на глазах',values:{mode:'one',Y0:1,z:0.2,d:40,D:12}},
    {name:'Бочка на Луне',values:{mode:'one',Y0:1.2,z:0.4,d:12,D:12,g:1.6}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, X=Math.max(1.2,p.Y0*1.15+0.3), Y=p.Y0+0.3;
    const scale=clamp(Math.min((W-30)/(X*PX_PER_M),(H-40)/(Y*PX_PER_M)),0.002,30);
    return {x:X/2-0.25,y:Y/2-0.08,scale};
  },
  anchors(s,p){ return this.дыры(p).map(z=>({x:p.D/200,y:z})); },
  /* 9.5.0: инструменты на сцене. Ручки — уровень воды, высоты отверстий,
     ширина сосуда; зонд — давление в любой точке воды и скорость струи на
     любой высоте под отверстием. С ними одна сцена решает не только задачу
     о дальности, но и задачи о давлении на стенку, о двух струях в одну
     точку, о скорости удара струи о пол. */
  tools(p){ const S=this;
    return [РУЧКИ({name:'Уровень, отверстия, сосуд',
      ручки(p){ const R=p.D/200, h=[{id:'Y0',x:-R,y:p.Y0,имя:p=>`Y₀ = ${p.Y0} м`,тянуть(т,wx,wy){ т.set('Y0',wy); },клав:{ArrowUp:['Y0',0.01],ArrowDown:['Y0',-0.01]}},
          {id:'D',x:R,y:p.Y0+0.12,имя:p=>`D = ${p.D} см`,тянуть(т,wx){ т.set('D',Math.abs(wx)*200); },клав:{ArrowRight:['D',1],ArrowLeft:['D',-1]}}];
        if(p.mode!=='three') h.push({id:'z',x:R,y:Math.min(p.z,p.Y0),имя:p=>`z = ${p.z} м`,тянуть(т,wx,wy){ т.set('z',wy); },клав:{ArrowUp:['z',0.01],ArrowDown:['z',-0.01]}});
        if(p.mode==='two') h.push({id:'z2',x:R,y:Math.min(p.z2,p.Y0),имя:p=>`z₂ = ${p.z2} м`,тянуть(т,wx,wy){ т.set('z2',wy); },клав:{ArrowUp:['z2',0.01],ArrowDown:['z2',-0.01]}});
        return h; }}),
      ЗОНД({hint:'щёлкните в воду — глубина и давление; под отверстием — скорость струи на этой высоте',
        замер(p,s,x,y){ const R=p.D/200;
          if(Math.abs(x)<=R&&y>=0&&y<=s.Y){ const h=s.Y-y; return [`глубина ${h.toFixed(3)} м`,`избыточное давление ρgh = ${(1000*p.g*h/1000).toFixed(2)} кПа`]; }
          if(x>R&&y>=0){ const z=S.дыры(p), v=S.скорости(p,s.Y); let лучш=null;
            z.forEach((zz,i)=>{ if(v[i]>1e-6&&y<=zz){ const t=Math.sqrt(2*(zz-y)/p.g), xx=R+v[i]*t; if(Math.abs(xx-x)<0.08&&(!лучш||Math.abs(xx-x)<лучш.d)) лучш={i,d:Math.abs(xx-x),u:Math.hypot(v[i],p.g*t),t}; } });
            if(лучш) return [`струя ${z.length>1?лучш.i+1:''} на высоте ${y.toFixed(2)} м`,`скорость ${лучш.u.toFixed(2)} м/с`,`в полёте ${лучш.t.toFixed(3)} с`]; }
          return null; }})]; },
  /* Рисунок в строгом виде: сосуд — линия, вода — заливка одного тона.
     Метки течения считаются от времени по плоскому стоку r = r₀√(1 − τ)
     (поток через окружность вокруг дыры одинаков — жидкость несжимаема):
     видно, что вода стекается к отверстию со всего объёма и разгоняется
     только у самой дыры. Струя сужается по мере разгона (расход a·v в
     каждом сечении один), у пола — след: точка падения отступает к сосуду. */
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const px=1/ppm(), R=p.D/200, z=this.дыры(p), vs=this.скорости(p,s.Y), Hs=p.Y0+0.12, X1=Math.max(1.2,p.Y0*1.15+0.1);
    АРТ.пол(ctx,-R-0.3,X1+0.1,0,Math.max(8*px,0.03),ink3);
    // след на полу: от нынешней точки падения до самой дальней
    if(p.jets) z.forEach((zz,i)=>{
      const L0=this.скорости(p,p.Y0)[i]*Math.sqrt(2*zz/p.g), L=vs[i]*Math.sqrt(2*zz/p.g);
      if(L0-L>1e-3){ ctx.strokeStyle=АРТ.линияЖ('вода'); ctx.globalAlpha=0.5; ctx.lineWidth=3*px; ctx.beginPath(); ctx.moveTo(R+L,1.5*px); ctx.lineTo(R+L0,1.5*px); ctx.stroke(); ctx.globalAlpha=1; } });
    АРТ.жидкость(ctx,-R,0,R,s.Y,{тон:'вода'});
    // метки течения
    const откр=z.map((zz,i)=>s.Y>zz+1e-4&&vs[i]>1e-6);
    if(p.flow!==false&&откр.some(x=>x)){
      const N=56, idx=откр.map((o,i)=>o?i:-1).filter(i=>i>=0);
      ctx.strokeStyle=АРТ.линияЖ('вода'); ctx.lineCap='round'; ctx.lineWidth=1.2*px;
      const где=(i,x0,y0,τ)=>{ const q=Math.sqrt(Math.max(0,1-τ)); return [R+(x0-R)*q, z[i]+(y0-z[i])*q]; };
      for(let k=0;k<N;k++){
        const i=idx[k%idx.length], h1=(k*0.6180339887)%1, h2=(k*0.7548776662)%1, h3=(k*0.5698402910)%1;
        const τ=(s.t*(0.22+0.1*h3)+h1)%1, x0=-R*0.94+1.88*R*h2, y0=0.02+(s.Y-0.04)*h3;
        const [x,y]=где(i,x0,y0,τ), [xa,ya]=где(i,x0,y0,Math.max(0,τ-0.035));
        if(y>s.Y-2*px||ya>s.Y-2*px) continue;
        ctx.globalAlpha=0.45*Math.min(1,τ*8)*Math.min(1,(1-τ)*20);
        ctx.beginPath(); ctx.moveTo(xa,ya); ctx.lineTo(x,y); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    АРТ.стакан(ctx,-R,R,0,Hs);
    // доливная труба
    if(p.fill){ const xт=-R*0.55, a=Math.max(1.6*px,p.d/2000*1.2);
      ctx.strokeStyle=ink2; ctx.lineWidth=2*px; ctx.beginPath(); ctx.moveTo(-R-0.25,Hs+0.08); ctx.lineTo(xт,Hs+0.08); ctx.lineTo(xт,Hs+0.02); ctx.stroke();
      ctx.fillStyle=АРТ.ц(АРТ.тон('вода'),0.75); ctx.fillRect(xт-a,s.Y,2*a,Hs+0.02-s.Y);
      v.label(ctx,'доливают',-R-0.25,Hs+0.08,0,-10,ink3); }
    ctx.strokeStyle=line; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(-R-0.12,p.Y0); ctx.lineTo(-R,p.Y0); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`Y = ${s.Y.toFixed(2)} м`,-R,s.Y,-74,0,ink2);
    z.forEach((zz,i)=>{
      const vv=vs[i], hw0=Math.max(1.6*px,p.d/2000);
      ctx.fillStyle=v.c('--canvas'); ctx.fillRect(R-2*px,zz-hw0,4*px,2*hw0);
      if(s.Y>zz){ const xh=-R*0.45+i*R*0.25;
        АРТ.размер(ctx,xh,zz,s.Y,meas,0.9*px,2.5*px); v.label(ctx,`h${z.length>1?(i+1):''}`,xh,(zz+s.Y)/2,6,0,meas); }
      if(vv<=1e-6) return;
      const x0=R, T=Math.sqrt(2*zz/p.g), L=vv*T;
      if(p.jets){
        const τр=T*0.86, pts=[], hw=[];
        for(let k=0;k<=48;k++){ const τ=τр*k/48, sp=Math.hypot(vv,p.g*τ); pts.push([x0+vv*τ,zz-p.g*τ*τ/2]); hw.push(hw0*Math.sqrt(vv/sp)); }
        АРТ.струя(ctx,pts,hw,'вода');
        const rк=hw0*Math.sqrt(vv/Math.hypot(vv,p.g*T))*1.2;
        for(let k=0;k<4;k++){ const τ=τр+((s.фаза*1.7+k/4)%1)*(T-τр); АРТ.капля(ctx,x0+vv*τ,zz-p.g*τ*τ/2,rк,'вода'); }
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(x0+L,-0.03); ctx.lineTo(x0+L,0.03); ctx.stroke();
        v.label(ctx,`L${z.length>1?(i+1):''} = ${L.toFixed(2)} м`,x0+L,0,-20,16+(z.length>1?i*16:0),meas);
      }
      if(p.vec){ const k=0.06; v.arrow(ctx,x0,zz,x0+vv*k,zz,acc); v.label(ctx,`v = ${vv.toFixed(2)} м/с`,x0+vv*k,zz,6,-12,acc); }
    });
  }
},

drag:{
  title:'Шарик в вязкой жидкости: Стокс и число Рейнольдса',
  params:[
    {key:'liq',label:'Жидкость',type:'select',default:'glyc',
     options:[{v:'glyc',t:'глицерин: 1260 кг/м³, η = 1,41 Па·с'},{v:'castor',t:'касторовое масло: 960, 0,99'},
              {v:'honey',t:'мёд: 1420, 10'},{v:'oil',t:'подсолнечное масло: 920, 0,05'},{v:'water',t:'вода: 1000, 0,001'},
              {v:'custom',t:'своя: плотность и вязкость задаются'}]},
    {key:'rho',label:'Плотность шарика ρш',unit:'кг/м³',min:300,max:12000,step:10,default:7800},
    {key:'r',  label:'Радиус шарика r',unit:'мм',min:0.5,max:15,step:0.1,default:1.5},
    {key:'law',label:'Сопротивление',type:'select',default:'full',
     options:[{v:'full',t:'полное: C(Re) — от Стокса к квадратичному'},{v:'stokes',t:'только Стокс: 6πηrv'},{v:'quad',t:'только квадратичное: ½CρSv²'}]},
    {key:'rhoL',label:'Плотность своей жидкости',unit:'кг/м³',min:500,max:14000,step:10,default:1000,если:p=>p.liq==='custom'},
    {key:'eta',label:'Вязкость своей жидкости η',unit:'Па·с',min:0.0005,max:50,step:0.0005,default:0.5,если:p=>p.liq==='custom'},
    {key:'v0', label:'Начальная скорость (вниз +)',unit:'м/с',min:-3,max:3,step:0.01,default:0},
    {key:'L',  label:'Высота столба жидкости',unit:'м',min:0.2,max:1.5,step:0.05,default:0.6},
    {key:'g',  label:'Ускорение g',unit:'м/с²',min:1,max:25,step:0.1,default:9.8},
    {type:'group',label:'Метод Стокса: две метки'},
    {key:'m1', label:'Верхняя метка',unit:'см',min:1,max:150,step:1,default:10},
    {key:'m2', label:'Нижняя метка',unit:'см',min:1,max:150,step:1,default:50},
    {type:'group',label:'Показывать'},
    {key:'forces',label:'Силы на шарик',type:'check',default:true},
    {key:'marks', label:'Деления через 5 см',type:'check',default:true},
    {key:'lens',  label:'Лупа: обтекание шарика',type:'check',default:true}
  ],
  LIQ:{glyc:{ρ:1260,η:1.41,имя:'глицерин'},castor:{ρ:960,η:0.99,имя:'касторовое масло'},honey:{ρ:1420,η:10,имя:'мёд'},
       oil:{ρ:920,η:0.05,имя:'подсолнечное масло'},water:{ρ:1000,η:0.001,имя:'вода'}},
  CQ:0.47,
  ж(p){ return p.liq==='custom'?{ρ:p.rhoL||1000,η:p.eta||0.5,имя:'жидкость'}:(this.LIQ[p.liq]||this.LIQ.glyc); },
  тело(p){ const r=p.r/1000, V=4/3*Math.PI*r*r*r; return {r,V,m:p.rho*V}; },
  /* сила сопротивления при скорости u ≥ 0 */
  сопр(p,u){
    const ж=this.ж(p), {r}=this.тело(p), S=Math.PI*r*r;
    if(u<=0) return 0;
    if(p.law==='stokes') return 6*Math.PI*ж.η*r*u;
    if(p.law==='quad') return 0.5*this.CQ*ж.ρ*S*u*u;
    const Re=2*ж.ρ*u*r/ж.η, C=24/Re+6/(1+Math.sqrt(Re))+0.4;
    return 0.5*C*ж.ρ*S*u*u;
  },
  тяга(p){ const ж=this.ж(p), т=this.тело(p); return (т.m-ж.ρ*т.V)*p.g; },   // сила тяжести минус Архимед, ось вниз
  /* предельная скорость: сопротивление уравновешивает тягу */
  предел(p){
    const G=this.тяга(p), A=Math.abs(G); if(A<1e-15) return 0;
    let a=0,b=1; while(this.сопр(p,b)<A&&b<1e4) b*=2;
    for(let i=0;i<80;i++){ const c=(a+b)/2; if(this.сопр(p,c)<A) a=c; else b=c; }
    return Math.sign(G)*(a+b)/2;
  },
  init(p){ const G=this.тяга(p); return {t:0,x:G<0&&!(p.v0>0)?p.L-this.тело(p).r-0.005:0,v:p.v0||0,t1:null,t2:null,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const {m}=this.тело(p), G=this.тяга(p);
    const F=u=>G-Math.sign(u)*this.сопр(p,Math.abs(u));
    // шаг неявный по линеаризованной силе; подшаги — по времени релаксации
    const dF=u=>{ const h=Math.max(1e-7,Math.abs(u)*1e-4); return (F(u+h)-F(u-h))/(2*h); };
    const τ=m/Math.max(1e-30,Math.abs(dF(s.v||1e-6))), n=Math.min(400,Math.max(1,Math.ceil(dt/(0.5*τ)))), h=dt/n;
    const x0=s.x;
    for(let i=0;i<n;i++){
      const k=dF(s.v), v1=s.v+h*F(s.v)/m/(1-h*k/m);
      s.x+=h*(s.v+v1)/2; s.v=v1;
    }
    // метки метода Стокса: момент прохождения уточняем линейно внутри шага
    for(const [кл,м] of [['t1',p.m1],['t2',p.m2]]){ const y=(м||0)/100;
      if(s[кл]==null&&(x0-y)*(s.x-y)<=0&&s.x!==x0) s[кл]=s.t+dt*(y-x0)/(s.x-x0); }
    s.t+=dt;
    if(G>=0&&s.x>=p.L-this.тело(p).r){ s.x=p.L-this.тело(p).r; s.event={type:'bottom',t:s.t};
      s.__stop=`Шарик дошёл до дна за ${s.t.toFixed(2)} с`; }
    else if(G<0&&s.x<=this.тело(p).r){ s.x=this.тело(p).r; s.event={type:'top',t:s.t}; s.__stop=`Шарик всплыл за ${s.t.toFixed(2)} с`; }
  },
  readouts(s,p){
    const ж=this.ж(p), т=this.тело(p), u=Math.abs(s.v), Re=2*ж.ρ*u*т.r/ж.η;
    return [['t',s.t,'с'],['пройдено x',s.x,'м'],['скорость v',s.v,'м/с'],
      ['число Рейнольдса Re',Re,''],
      ['сила тяжести mg',т.m*p.g*1000,'мН'],['сила Архимеда',ж.ρ*т.V*p.g*1000,'мН'],
      ['сила сопротивления',this.сопр(p,u)*1000,'мН'],
      ['между метками',s.t1!=null&&s.t2!=null?Math.abs(s.t2-s.t1):NaN,s.t1!=null&&s.t2!=null?'с':'с — шарик ещё не прошёл обе']];
  },
  graphs:[
    {label:'v(t) — выход на предельную скорость',unit:'м/с',series:['v','v∞'],get(s,p){ return [s.v,SIMS.drag.предел(p)]; }},
    {label:'x(t) — путь: после разгона прямая',unit:'м',series:['x'],get:s=>[s.x,null]}
  ],
  presets:[
    {name:'Стальной шарик в глицерине: метод Стокса',values:{liq:'glyc',rho:7800,r:1.5,law:'full'}},
    {name:'Тот же шарик в воде: Стокс врёт в сотни раз',values:{liq:'water',rho:7800,r:1.5,law:'stokes'}},
    {name:'В воде — честное сопротивление',values:{liq:'water',rho:7800,r:1.5,law:'full'}},
    {name:'Пузырёк-пробка всплывает в масле',values:{liq:'castor',rho:300,r:5,law:'full'}},
    {name:'Свинцовая дробь в мёде',values:{liq:'honey',rho:11340,r:2,law:'full'}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, Y=p.L+0.16, X=Math.max(0.62,Y*0.75);
    const scale=clamp(Math.min((W-30)/(X*PX_PER_M),(H-30)/(Y*PX_PER_M)),0.002,60);
    return {x:0.12,y:-p.L/2+0.02,scale};
  },
  anchors(s,p){ return [{x:0,y:-s.x}]; },
  /* 9.5.0: инструменты. Ручки — радиус шарика (тяните вбок от шарика),
     высота столба и две метки метода Стокса; время между метками сцена
     засекает сама. Можно задать свою жидкость и начальную скорость: задачи
     о пузырьке, о брошенном в жидкость шарике и об измерении вязкости
     решаются в той же модели. */
  tools(p){
    return [РУЧКИ({name:'Шарик, метки, столб',
      ручки(p,s){ const y=-(s?s.x:0), r=Math.max(p.r/1000,0.004);
        return [{id:'r',x:r*1.8+0.01,y,имя:p=>`r = ${p.r} мм`,тянуть(т,wx){ т.set('r',Math.max(0,(wx-0.01)/1.8)*1000); },клав:{ArrowRight:['r',0.1],ArrowLeft:['r',-0.1]}},
          {id:'m1',x:-0.07,y:-p.m1/100,имя:p=>`метка ${p.m1} см`,тянуть(т,wx,wy){ т.set('m1',-wy*100); },клав:{ArrowUp:['m1',-1],ArrowDown:['m1',1]}},
          {id:'m2',x:-0.07,y:-p.m2/100,имя:p=>`метка ${p.m2} см`,тянуть(т,wx,wy){ т.set('m2',-wy*100); },клав:{ArrowUp:['m2',-1],ArrowDown:['m2',1]}},
          {id:'L',x:0.07,y:-p.L,имя:p=>`столб ${p.L} м`,тянуть(т,wx,wy){ т.set('L',-wy); },клав:{ArrowUp:['L',-0.05],ArrowDown:['L',0.05]}}]; }})]; },
  /* Строгий рисунок: цилиндр — линия, жидкость — один тон, шарик — плоский
     круг. Лупа сбоку — обтекание в системе шарика: при Re < 1 линии тока
     симметричны (решение Стокса), при больших Re за шариком след. */
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3');
    const ж=this.ж(p), т=this.тело(p), W=0.07, L=p.L, px=1/ppm();
    const cg=v.c('--f-grav')||dang, cn=v.c('--f-norm')||acc;
    const тон={glyc:'глицерин',castor:'касторка',honey:'мёд',oil:'масло',water:'вода'}[p.liq]||'масло';
    АРТ.жидкость(ctx,-W,-L,W,0,{тон});
    АРТ.стакан(ctx,-W,W,-L,0.06);
    if(p.marks){ ctx.strokeStyle=ink3; ctx.lineWidth=0.9*px;
      for(let y=0.05;y<L;y+=0.05){ const дл=Math.round(y*100)%10===0?0.022:0.012;
        ctx.beginPath(); ctx.moveTo(W-дл,-y); ctx.lineTo(W,-y); ctx.stroke();
        if(Math.round(y*100)%10===0) v.label(ctx,`${Math.round(y*100)} см`,W,-y,6,0,ink3); } }
    // метки метода Стокса
    ctx.strokeStyle=meas; ctx.lineWidth=1*px; ctx.setLineDash([4*px,3*px]);
    for(const м of [p.m1,p.m2]) if(м/100<L){ ctx.beginPath(); ctx.moveTo(-W-0.02,-м/100); ctx.lineTo(W,-м/100); ctx.stroke(); }
    ctx.setLineDash([]);
    if(s.t1!=null&&s.t2!=null) v.label(ctx,`между метками ${Math.abs(s.t2-s.t1).toFixed(2)} с`,-W-0.02,-Math.max(p.m1,p.m2)/100,-150,0,meas);
    v.label(ctx,ж.имя,-W,0,0,-12,ink2);
    const y=-s.x, rr=Math.max(т.r,4*px);
    const мат=p.rho<1000?[176,138,46]:АРТ.т('--ink-2');
    АРТ.шар(ctx,0,y,rr,мат);
    const Re=2*ж.ρ*Math.abs(s.v)*т.r/ж.η;
    if(p.lens!==false){
      const Rл=Math.min(0.12,L*0.2), xл=W+0.24, yл=clamp(y,-L+Rл+0.05,-Rл-0.08);
      ctx.save();
      ctx.strokeStyle=ink3; ctx.lineWidth=0.8*px; ctx.setLineDash([3*px,3*px]);
      ctx.beginPath(); ctx.moveTo(rr*1.6,y); ctx.lineTo(xл-Rл,yл); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(xл,yл,Rл,0,7); ctx.clip();
      АРТ.жидкость(ctx,xл-Rл,yл-Rл,xл+Rл,yл+Rл,{тон,блик:false});
      const a=Rл*0.28, вниз=s.v>=0?1:-1;
      const скор=(X,Y)=>{ const r=Math.hypot(X,Y); if(r<a*1.0001) return [0,0];
        const c=Y*вниз/r, sn=X/r, ur=c*(1-1.5*a/r+0.5*a*a*a/(r*r*r)), uθ=-sn*(1-0.75*a/r-0.25*a*a*a/(r*r*r));
        return [ur*sn+uθ*c, вниз*(ur*c-uθ*sn)]; };
      ctx.strokeStyle=АРТ.ц(АРТ.т('--ink-3'),0.75); ctx.lineWidth=1*px;
      const линии=[];
      for(let k=-6;k<=6;k++){ if(k===0) continue;
        let X=Math.sign(k)*(a*0.18+(Math.abs(k)-1)*Rл/6.2), Y=-вниз*Rл*1.3; const pts=[[X,Y]];
        for(let i=0;i<700;i++){ const [u1,v1]=скор(X,Y), n=Math.hypot(u1,v1)||1, h=Rл/110;
          const [u2,v2]=скор(X+u1/n*h/2,Y+v1/n*h/2), n2=Math.hypot(u2,v2)||1;
          X+=u2/n2*h; Y+=v2/n2*h; pts.push([X,Y]); if(Y*вниз>Rл*1.3) break; }
        линии.push(pts);
        ctx.beginPath(); pts.forEach((q,i)=>i?ctx.lineTo(xл+q[0],yл+q[1]):ctx.moveTo(xл+q[0],yл+q[1])); ctx.stroke(); }
      ctx.fillStyle=acc;
      линии.forEach((pts,j)=>{ for(let m=0;m<2;m++){ const i=Math.floor((((s.t*0.35+m/2+j*0.13)%1))*(pts.length-1));
        ctx.beginPath(); ctx.arc(xл+pts[i][0],yл+pts[i][1],1.6*px,0,7); ctx.fill(); } });
      if(Re>1){ const k=clamp(Math.log10(Re)/3,0,1);
        ctx.fillStyle=АРТ.ц(АРТ.тон(тон),0.25*k);
        ctx.beginPath(); ctx.ellipse(xл,yл-вниз*a*(1+1.6*k),a*(0.9+0.4*k),a*(1+1.6*k),0,0,7); ctx.fill();
        ctx.strokeStyle=АРТ.ц(АРТ.т('--ink-3'),0.7*k); ctx.lineWidth=1*px;
        for(const сд of [-1,1]){ const cx=xл+сд*a*0.55, cy=yл-вниз*a*1.7;
          ctx.beginPath(); ctx.arc(cx,cy,a*0.42,s.t*4*сд,s.t*4*сд+4.4); ctx.stroke(); } }
      АРТ.шар(ctx,xл,yл,a,мат);
      ctx.restore();
      ctx.strokeStyle=ink3; ctx.lineWidth=1*px; ctx.beginPath(); ctx.arc(xл,yл,Rл,0,7); ctx.stroke();
      v.label(ctx,Re<1?'лупа: обтекание по Стоксу, без следа':'лупа: за шариком — след',xл-Rл,yл-Rл,0,12,ink3);
    }
    if(p.forces){
      const G=т.m*p.g, A=ж.ρ*т.V*p.g, F=this.сопр(p,Math.abs(s.v)), M=Math.max(G,A,F,1e-30), k=0.16/M;
      v.arrow(ctx,0,y,0,y-G*k,cg); v.label(ctx,'mg',0,y-G*k,6,4,cg);
      v.arrow(ctx,-0.012,y,-0.012,y+A*k,cn); v.label(ctx,'F_A',-0.012,y+A*k,-30,-4,cn);
      if(F>M*1e-3){ const зн=s.v>=0?1:-1; v.arrow(ctx,0.012,y,0.012,y+зн*F*k,meas); v.label(ctx,'F_сопр',0.012,y+зн*F*k,6,-4,meas); }
    }
    v.label(ctx,`v = ${(Math.abs(s.v)*100).toFixed(2)} см/с · Re = ${Re<0.01?Re.toExponential(1):Re.toFixed(Re<10?2:0)}`,W+0.04,y,40,0,ink2);
    v.label(ctx,Re<1?'Re < 1: вязкое течение, работает Стокс':Re<1000?'промежуточный режим: Стокс уже неточен':'Re > 1000: сопротивление квадратичное',W+0.04,y,40,14,ink3);
  }
}
});
