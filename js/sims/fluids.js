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
     options:[{v:'one',t:'Одно отверстие на высоте z'},{v:'three',t:'Три отверстия: ¼, ½ и ¾ начального уровня'}]},
    {key:'Y0',label:'Начальный уровень воды Y₀',unit:'м',min:0.3,max:2,step:0.05,default:1.2},
    {key:'z', label:'Высота отверстия над полом z',unit:'м',min:0.02,max:1.9,step:0.01,default:0.4,если:p=>p.mode==='one'},
    {key:'d', label:'Диаметр отверстия d',unit:'мм',min:3,max:40,step:1,default:12},
    {key:'D', label:'Диаметр сосуда D',unit:'см',min:5,max:80,step:1,default:12},
    {key:'g', label:'Ускорение g',unit:'м/с²',min:1,max:25,step:0.1,default:9.8},
    {type:'group',label:'Показывать'},
    {key:'jets',label:'Струи и точки падения',type:'check',default:true},
    {key:'vec', label:'Скорость вытекания',type:'check',default:true}
  ],
  r(p){ return Math.pow(p.d/1000/(p.D/100),2); },
  дыры(p){ return p.mode==='three'?[p.Y0/4,p.Y0/2,3*p.Y0/4]:[Math.min(p.z,p.Y0)]; },
  /* скорости струй при уровне Y: Бернулли с учётом скорости опускания поверхности U */
  скорости(p,Y){
    const z=this.дыры(p), r=this.r(p);
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
    if(p.mode==='one'){ s.t+=dt; s.Y=this.уровень1(p,s.t); }
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
        ['скорость опускания уровня',r*v[0]*100,'см/с']);
    } else z.forEach((zz,i)=>out.push([`отверстие ${i+1} (z = ${zz.toFixed(2)} м): v`,v[i],'м/с'],[`отверстие ${i+1}: дальность L`,v[i]*Math.sqrt(2*zz/p.g),'м']));
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
    {name:'Широкое отверстие: сосуд пустеет на глазах',values:{mode:'one',Y0:1,z:0.2,d:40,D:12}},
    {name:'Бочка на Луне',values:{mode:'one',Y0:1.2,z:0.4,d:12,D:12,g:1.6}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, X=Math.max(1.2,p.Y0*1.15+0.3), Y=p.Y0+0.3;
    const scale=clamp(Math.min((W-30)/(X*PX_PER_M),(H-40)/(Y*PX_PER_M)),0.002,30);
    return {x:X/2-0.25,y:Y/2-0.08,scale};
  },
  anchors(s,p){ return this.дыры(p).map(z=>({x:p.D/200,y:z})); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const R=p.D/200, z=this.дыры(p), vs=this.скорости(p,s.Y), Hs=p.Y0+0.12;
    // пол
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(-R-0.3,0); ctx.lineTo(Math.max(1.2,p.Y0*1.15+0.1),0); ctx.stroke();
    // вода и сосуд
    ctx.fillStyle=sec; ctx.globalAlpha=.2; ctx.fillRect(-R,0,2*R,s.Y); ctx.globalAlpha=1;
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(-R,s.Y); ctx.lineTo(R,s.Y); ctx.stroke();
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2.2); ctx.beginPath(); ctx.moveTo(-R,Hs); ctx.lineTo(-R,0); ctx.lineTo(R,0); ctx.lineTo(R,Hs); ctx.stroke();
    // начальный уровень
    ctx.strokeStyle=line; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(-R-0.15,p.Y0); ctx.lineTo(-R,p.Y0); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`Y = ${s.Y.toFixed(2)} м`,-R,s.Y,-74,0,sec);
    z.forEach((zz,i)=>{
      const vv=vs[i];
      ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(R,zz,v.lw(3),0,7); ctx.fill();
      if(s.Y>zz){ // напор
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(2),v.lw(3)]);
        ctx.beginPath(); ctx.moveTo(R*0.6-i*0.02,zz); ctx.lineTo(R*0.6-i*0.02,s.Y); ctx.stroke(); ctx.setLineDash([]);
      }
      if(vv<=1e-6) return;
      const L=vv*Math.sqrt(2*zz/p.g);
      if(p.jets){
        ctx.strokeStyle=sec; ctx.lineWidth=v.lw(Math.max(1.5,3*p.d/12)); ctx.globalAlpha=.55; ctx.beginPath();
        for(let k=0;k<=60;k++){ const x=L*k/60, y=zz-p.g*x*x/(2*vv*vv); k?ctx.lineTo(R+x,y):ctx.moveTo(R+x,y); }
        ctx.stroke(); ctx.globalAlpha=1;
        // капли бегут по струе
        const T=Math.sqrt(2*zz/p.g);
        ctx.fillStyle=sec;
        for(let k=0;k<6;k++){ const τ=((s.фаза*0.9+k/6*T)%T), x=vv*τ, y=zz-p.g*τ*τ/2;
          ctx.beginPath(); ctx.arc(R+x,y,v.lw(2.2),0,7); ctx.fill(); }
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(R+L,-0.03); ctx.lineTo(R+L,0.03); ctx.stroke();
        v.label(ctx,`L${z.length>1?(i+1):''} = ${L.toFixed(2)} м`,R+L,0,-20,14+(z.length>1?i*13:0),meas);
      }
      if(p.vec){ const k=0.06; v.arrow(ctx,R,zz,R+vv*k,zz,acc);
        v.label(ctx,`v = ${vv.toFixed(2)} м/с`,R+vv*k,zz,6,-10,acc); }
    });
  }
},

drag:{
  title:'Шарик в вязкой жидкости: Стокс и число Рейнольдса',
  params:[
    {key:'liq',label:'Жидкость',type:'select',default:'glyc',
     options:[{v:'glyc',t:'глицерин: 1260 кг/м³, η = 1,41 Па·с'},{v:'castor',t:'касторовое масло: 960, 0,99'},
              {v:'honey',t:'мёд: 1420, 10'},{v:'oil',t:'подсолнечное масло: 920, 0,05'},{v:'water',t:'вода: 1000, 0,001'}]},
    {key:'rho',label:'Плотность шарика ρш',unit:'кг/м³',min:300,max:12000,step:10,default:7800},
    {key:'r',  label:'Радиус шарика r',unit:'мм',min:0.5,max:15,step:0.1,default:1.5},
    {key:'law',label:'Сопротивление',type:'select',default:'full',
     options:[{v:'full',t:'полное: C(Re) — от Стокса к квадратичному'},{v:'stokes',t:'только Стокс: 6πηrv'},{v:'quad',t:'только квадратичное: ½CρSv²'}]},
    {key:'L',  label:'Высота столба жидкости',unit:'м',min:0.2,max:1.5,step:0.05,default:0.6},
    {key:'g',  label:'Ускорение g',unit:'м/с²',min:1,max:25,step:0.1,default:9.8},
    {type:'group',label:'Показывать'},
    {key:'forces',label:'Силы на шарик',type:'check',default:true},
    {key:'marks', label:'Метки через 5 см',type:'check',default:true}
  ],
  LIQ:{glyc:{ρ:1260,η:1.41,имя:'глицерин'},castor:{ρ:960,η:0.99,имя:'касторовое масло'},honey:{ρ:1420,η:10,имя:'мёд'},
       oil:{ρ:920,η:0.05,имя:'подсолнечное масло'},water:{ρ:1000,η:0.001,имя:'вода'}},
  CQ:0.47,
  ж(p){ return this.LIQ[p.liq]||this.LIQ.glyc; },
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
  init(p){ const G=this.тяга(p); return {t:0,x:G<0?p.L-this.тело(p).r-0.005:0,v:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const {m}=this.тело(p), G=this.тяга(p);
    const F=u=>G-Math.sign(u)*this.сопр(p,Math.abs(u));
    // шаг неявный по линеаризованной силе; подшаги — по времени релаксации
    const dF=u=>{ const h=Math.max(1e-7,Math.abs(u)*1e-4); return (F(u+h)-F(u-h))/(2*h); };
    const τ=m/Math.max(1e-30,Math.abs(dF(s.v||1e-6))), n=Math.min(400,Math.max(1,Math.ceil(dt/(0.5*τ)))), h=dt/n;
    for(let i=0;i<n;i++){
      const k=dF(s.v), v1=s.v+h*F(s.v)/m/(1-h*k/m);
      s.x+=h*(s.v+v1)/2; s.v=v1;
    }
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
      ['сила сопротивления',this.сопр(p,u)*1000,'мН']];
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
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, Y=p.L+0.16, X=Math.max(0.5,Y*0.7);
    const scale=clamp(Math.min((W-30)/(X*PX_PER_M),(H-30)/(Y*PX_PER_M)),0.002,60);
    return {x:0.12,y:-p.L/2+0.02,scale};
  },
  anchors(s,p){ return [{x:0,y:-s.x}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const ж=this.ж(p), т=this.тело(p), W=0.07, L=p.L;
    const cg=v.c('--f-grav')||dang, cn=v.c('--f-norm')||acc;
    // цилиндр с жидкостью: ось y вверх, поверхность на y = 0
    ctx.fillStyle=sec; ctx.globalAlpha=p.liq==='honey'?.32:.18; ctx.fillRect(-W,-L,2*W,L); ctx.globalAlpha=1;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(-W,0.06); ctx.lineTo(-W,-L); ctx.lineTo(W,-L); ctx.lineTo(W,0.06); ctx.stroke();
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(-W,0); ctx.lineTo(W,0); ctx.stroke();
    if(p.marks) for(let y=0.05;y<L;y+=0.05){ ctx.strokeStyle=line; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(W-0.02,-y); ctx.lineTo(W,-y); ctx.stroke();
      if(Math.round(y*100)%10===0) v.label(ctx,`${Math.round(y*100)} см`,W,-y,6,0,ink3); }
    v.label(ctx,ж.имя,-W,0,0,-12,ink2);
    // шарик (рисуем не меньше 3 пикселей, чтобы было видно)
    const y=-s.x, rr=Math.max(т.r,v.lw(3));
    ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(0,y,rr,0,7); ctx.fill();
    if(p.forces){
      const G=т.m*p.g, A=ж.ρ*т.V*p.g, F=this.сопр(p,Math.abs(s.v)), M=Math.max(G,A,F,1e-30), k=0.16/M;
      v.arrow(ctx,0,y,0,y-G*k,cg); v.label(ctx,'mg',0,y-G*k,6,4,cg);
      v.arrow(ctx,-0.012,y,-0.012,y+A*k,cn); v.label(ctx,'F_A',-0.012,y+A*k,-30,-4,cn);
      if(F>M*1e-3){ const зн=s.v>=0?1:-1; v.arrow(ctx,0.012,y,0.012,y+зн*F*k,meas); v.label(ctx,'F_сопр',0.012,y+зн*F*k,6,-4,meas); }
    }
    const Re=2*ж.ρ*Math.abs(s.v)*т.r/ж.η;
    v.label(ctx,`v = ${(Math.abs(s.v)*100).toFixed(2)} см/с · Re = ${Re<0.01?Re.toExponential(1):Re.toFixed(Re<10?2:0)}`,W+0.04,y,40,0,ink2);
    v.label(ctx,Re<1?'Re < 1: вязкое течение, работает Стокс':Re<1000?'промежуточный режим: Стокс уже неточен':'Re > 1000: сопротивление квадратичное',W+0.04,y,40,14,ink3);
  }
}
});
