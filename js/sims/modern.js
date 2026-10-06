/* ===================== СТО, АТОМ, ЯДРО, ЧАСТИЦЫ (7.0.0) =====================
   relforce — частица в однородном поле, сила F = qE постоянна. Импульс растёт
       линейно, p = Ft, а скорость — нет: v = c·(Ft)/√((mc)² + (Ft)²) < c.
       Кинетическая энергия K = (γ − 1)mc² равна работе F·x. Рядом —
       классическая частица с v = Ft/m, которая обгоняет свет.
   rutherford — альфа-частицы на ядре. Отталкивание U = K·d/r, где
       d = 2Z·k e²/K — расстояние наибольшего сближения при лобовом ударе
       (k e² = 1,44 МэВ·фм). Угол рассеяния tg(θ/2) = d/(2b). Прицельные
       параметры распределены по площади пучка, поэтому доля частиц,
       рассеянных на угол больше θ₀, равна (b(θ₀)/b_max)².
   chain — цепная реакция в шаре топлива. Нейтрон летит до деления в
       среднем λ_f, до захвата без деления — λ_c; деление даёт 2 или 3
       нейтрона (в среднем 2,5) и 200 МэВ. Из маленького шара нейтроны
       утекают — так появляется критический размер; стержни поглощают.
   shield — ионизирующие излучения: пробег альфа-частиц, поглощение бета-
       частиц, ослабление гамма-лучей I = I₀·e^(−μd). Мощность дозы гамма-
       источника Ḣ = Γ·A/r²·e^(−μd).
   tracks — камера Вильсона в магнитном поле: радиус трека r = p/(qB),
       густота капель растёт к концу пробега как 1/β². */
const МОД7={
  c:299792458, e:1.602176634e-19,
  /* генератор с зерном: опыт повторяется, а проверки воспроизводимы */
  гсч(зерно){ let s=(зерно>>>0)||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
};

Object.assign(SIMS,{
/* ------------------------------------------------------------------ */
relforce:{
  title:'Разгон постоянной силой: скорость упирается в c',
  schema:true, timeUnit:'нс',
  params:[
    {key:'part',label:'Частица',type:'select',default:'e',
     options:[{v:'e',t:'электрон: mc² = 0,511 МэВ'},{v:'p',t:'протон: mc² = 938 МэВ'}]},
    {key:'E',label:'Напряжённость поля E',unit:'МВ/м',min:0.1,max:20,step:0.1,default:1},
    {key:'cls',label:'Показать классическую частицу (v = Ft/m)',type:'check',default:true}
  ],
  M:{e:{m:9.1093837015e-31,mc2:0.51099895,имя:'электрон'},p:{m:1.67262192e-27,mc2:938.27208816,имя:'протон'}},
  ч(p){ return this.M[p.part]||this.M.e; },
  F(p){ return МОД7.e*p.E*1e6; },
  τ(p){ return this.ч(p).m*МОД7.c/this.F(p); },                       // с: время, за которое Ft = mc
  L0(p){ return this.ч(p).m*МОД7.c*МОД7.c/this.F(p); },                // м: путь, на котором работа = mc²
  u(p,tn){ return this.F(p)*tn*1e-9/(this.ч(p).m*МОД7.c); },         // Ft/mc
  γ(p,tn){ const u=this.u(p,tn); return Math.sqrt(1+u*u); },
  β(p,tn){ const u=this.u(p,tn); return u/Math.sqrt(1+u*u); },
  x(p,tn){ return this.L0(p)*(this.γ(p,tn)-1); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt*this.τ(p)*1e9/2;                              // две секунды сцены — одно τ
    if(this.x(p,s.t)>6*this.L0(p)&&!s.event){ s.event={type:'far',t:s.t}; s.__stop='Частица ушла за край: скорость почти c, а энергия всё растёт'; } },
  readouts(s,p){
    const ч=this.ч(p), u=this.u(p,s.t), γ=this.γ(p,s.t);
    return [['t',s.t,'нс'],['импульс p = Ft',u*ч.mc2,'МэВ/c'],['скорость v/c',this.β(p,s.t),''],['классическая оценка Ft/(mc)',u,''],
      ['лоренц-фактор γ',γ,''],['кинетическая энергия K = (γ − 1)mc²',(γ-1)*ч.mc2,'МэВ'],['работа поля F·x',this.F(p)*this.x(p,s.t)/МОД7.e/1e6,'МэВ'],
      ['пройденный путь x',this.x(p,s.t),'м']];
  },
  graphs:[
    {label:'Скорость: теория относительности и классика',unit:'v/c',series:['СТО','классика'],
     get(s,p){ const S=SIMS.relforce; return [S.β(p,s.t),p.cls?S.u(p,s.t):null]; }},
    {label:'Лоренц-фактор',unit:'γ',series:['γ'],get(s,p){ return [SIMS.relforce.γ(p,s.t),null]; }}
  ],
  presets:[
    {name:'Электрон, 1 МВ/м',values:{part:'e',E:1,cls:true}},
    {name:'Протон в том же поле: в 1836 раз медленнее разгон',values:{part:'p',E:1,cls:true}},
    {name:'Сильное поле ускорителя: 20 МВ/м',values:{part:'e',E:20,cls:true}}
  ],
  пояснения(p,s){ const β=this.β(p,s?s.t:0);
    return [[`импульс растёт как Ft, а скорость — нет: v/c = ${числоНаСцене(β,4)}`,css('--ink-2'),true],
      [p.cls?'пунктир — классическая частица: она «обгоняет свет», чего не бывает':'энергия растёт без предела, скорость — до c',css('--ink-3')]]; },
  fit(p,vp){ return fitСПояснением(vp,11.5,6,5,0.3,this.пояснения(p),36); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const строки=this.пояснения(p,s); v.занятьНиз(строки);
    const X0=-0.4, Wd=10, Lm=6, k=Wd/Lm;                              // экран: шесть путей L₀
    const ряд=(y,x,подп,цв,пунктир)=>{ ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(X0,y); ctx.lineTo(X0+Wd,y); ctx.stroke();
      const xx=X0+Math.min(x,Lm*1.05)*k; if(пунктир){ ctx.setLineDash([v.lw(3),v.lw(3)]); }
      ctx.strokeStyle=цв; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(xx,y,0.22,0,7); ctx.stroke(); ctx.setLineDash([]);
      if(!пунктир){ ctx.fillStyle=цв; ctx.beginPath(); ctx.arc(xx,y,0.16,0,7); ctx.fill(); }
      v.text(ctx,подп,X0,y+0.5,цв,10.5,'left'); };
    const u=this.u(p,s.t), xr=this.x(p,s.t)/this.L0(p), xc=u*u/2;
    ряд(1.4,xr,`${this.ч(p).имя}: v = ${числоНаСцене(this.β(p,s.t),4)}c, γ = ${числоНаСцене(this.γ(p,s.t),3)}`,acc,false);
    if(p.cls) ряд(-0.4,xc,`классика: v = ${числоНаСцене(u,3)}c${u>1?' — быстрее света!':''}`,u>1?dang:ink2,true);
    // поле: стрелки сверху
    for(let i=0;i<6;i++) v.arrow(ctx,X0+0.6+i*1.7,2.7,X0+1.3+i*1.7,2.7,sec);
    v.text(ctx,`E = ${p.E} МВ/м — сила F = eE постоянна`,X0+Wd/2,3.2,sec,10.5,'center');
    // шкала путей в L₀ = mc²/F
    for(let i=0;i<=Lm;i++){ const x=X0+i*k; ctx.strokeStyle=ink3; ctx.beginPath(); ctx.moveTo(x,-1.3); ctx.lineTo(x,-1.15); ctx.stroke();
      v.text(ctx,`${числоНаСцене(i*this.L0(p),2)} м`,x,-1.55,ink3,9,'center'); }
    v.пояснение(ctx,строки);
  }
},

/* ------------------------------------------------------------------ */
rutherford:{
  title:'Опыт Резерфорда: рассеяние альфа-частиц на ядре',
  schema:true,
  params:[
    {key:'K',label:'Энергия альфа-частиц K',unit:'МэВ',min:1,max:10,step:0.1,default:5},
    {key:'Z',label:'Мишень',type:'select',default:'79',
     options:[{v:'79',t:'золото, Z = 79'},{v:'47',t:'серебро, Z = 47'},{v:'29',t:'медь, Z = 29'},{v:'13',t:'алюминий, Z = 13'}]},
    {key:'bmax',label:'Полуширина пучка b_max',unit:'фм',min:50,max:600,step:5,default:250},
    {key:'rate',label:'Частиц в секунду',min:2,max:60,step:1,default:20},
    {type:'group',label:'Показывать'},
    {key:'hist',label:'Счётчик по углам и формула Резерфорда',type:'check',default:true}
  ],
  ke2:1.439964,                                                        // МэВ·фм
  d(p){ return 2*(+p.Z)*this.ke2/p.K; },                               // фм
  b90(p){ return this.d(p)/2; },
  θ(p,b){ return 2*Math.atan(this.d(p)/(2*Math.abs(b))); },
  ОКНО:900,                                                            // фм от ядра до края
  init(p){ return {t:0,event:null,__stop:null,ч:[],бины:new Array(18).fill(0),всего:0,назад:0,след:0,г:МОД7.гсч(20240917)}; },
  step(s,dt,p){
    s.t+=dt;
    const V=520, d=this.d(p), W=this.ОКНО;
    // новые частицы: прицельный параметр равномерно по площади круга b ≤ b_max
    s.след+=dt*p.rate;
    // на краю окна частица уже чуть заторможена полем: полная энергия — K, как у прилетевшей из бесконечности
    // и момент импульса тот же, что на бесконечности: y₀·v₀ = b·V — прицельный параметр задан «издалека»
    while(s.след>=1){ s.след-=1; const b=p.bmax*Math.sqrt(s.г())*(s.г()<0.5?-1:1); s.ч.push(this.старт(b,V,d,W)); }
    // ускорение a = V²·d/(2r²) от ядра (отталкивание); шаг — скоростной Верле с шагом по расстоянию
    const ax=(x,y)=>{ const r2=x*x+y*y, r=Math.sqrt(r2), a=V*V*d/(2*r2); return [a*x/r,a*y/r]; };
    const шаг=(q,h)=>{ const [a1,b1]=ax(q.x,q.y); q.vx+=a1*h/2; q.vy+=b1*h/2; q.x+=q.vx*h; q.y+=q.vy*h;
      const [a2,b2]=ax(q.x,q.y); q.vx+=a2*h/2; q.vy+=b2*h/2; };
    for(const q of s.ч){ if(!q.жив) continue;
      let ост=dt;
      while(ост>0){ const r=Math.hypot(q.x,q.y), h=Math.min(ост,0.04*Math.max(r,d*0.3)/V); шаг(q,h); ост-=h; }
      const last=q.путь[q.путь.length-1]; if(Math.hypot(q.x-last[0],q.y-last[1])>8) q.путь.push([q.x,q.y]);
      if(Math.hypot(q.x,q.y)>W*1.02&&q.x*q.vx+q.y*q.vy>0){ q.жив=false;            // вылетела из круга наружу
        // счётчик стоит «на бесконечности»: невидимо доводим копию траектории до 60 окон
        const к={x:q.x,y:q.y,vx:q.vx,vy:q.vy}; for(let i=0;i<4000&&Math.hypot(к.x,к.y)<60*W;i++) шаг(к,0.1*Math.hypot(к.x,к.y)/V);
        const θ=Math.atan2(Math.abs(к.vy),к.vx); q.θ=θ; const i=Math.min(17,Math.floor(θ*180/Math.PI/10));
        s.бины[i]++; s.всего++; if(θ>Math.PI/2) s.назад++; q.t=s.t; } }
    s.ч=s.ч.filter(q=>q.жив||s.t-q.t<1.2);
    if(s.ч.length>240) s.ч.splice(0,s.ч.length-240);
  },
  /* доля частиц с углом больше θ₀: (b(θ₀)/b_max)², b(θ₀) = (d/2)·ctg(θ₀/2) */
  старт(b,V,d,W){ let y=b, v0=V;
    for(let i=0;i<4;i++){ v0=V*Math.sqrt(Math.max(0,1-d/Math.hypot(W,y))); y=b*V/Math.max(v0,1e-9); }
    return {x:-W,y,vx:v0,vy:0,путь:[[-W,y]],жив:true}; },
  доля(p,θ0){ const b=this.d(p)/2/Math.tan(θ0/2); return Math.min(1,b*b/(p.bmax*p.bmax)); },
  readouts(s,p){
    return [['t',s.t,'с'],['наименьшее расстояние при лобовом ударе d',this.d(p),'фм'],['прицельный параметр для θ = 90°',this.b90(p),'фм'],
      ['ожидаемая доля отражённых назад',100*this.доля(p,Math.PI/2),'%'],['сосчитано частиц',s.всего,''],
      ['отражено назад (θ > 90°)',s.всего?100*s.назад/s.всего:0,'%']];
  },
  graphs:[],
  presets:[
    {name:'Золото, 5 МэВ — как у Гейгера и Марсдена',values:{K:5,Z:'79',bmax:250}},
    {name:'Узкий пучок у самого ядра: много отражений',values:{K:5,Z:'79',bmax:80}},
    {name:'Алюминий: ядро слабее',values:{K:5,Z:'13',bmax:120}},
    {name:'Быстрые частицы: отражений меньше',values:{K:10,Z:'79',bmax:250}}
  ],
  /* на телефоне счётчик по углам стоит под кругом, а не справа */
  узко(W,H){ return (W||460)<1.05*(H||320); },
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    if(this.узко(W,H)) return {x:0,y:p.hist?-650:0,scale:clamp(Math.min((W-16)/(1900*PX_PER_M),(H-20)/((p.hist?3200:1850)*PX_PER_M)),1e-6,30)};
    return {x:p.hist?260:0,y:0,scale:clamp(Math.min((W-20)/((p.hist?2500:1850)*PX_PER_M),(H-20)/(1850*PX_PER_M)),1e-6,30)}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink=v.c('--ink'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const W=this.ОКНО, d=this.d(p);
    ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.arc(0,0,W,0,7); ctx.stroke(); ctx.globalAlpha=1;
    // ядро и окрестность d
    ctx.strokeStyle=meas; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.arc(0,0,d,0,7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(0,0,Math.max(v.lw(4),7),0,7); ctx.fill();
    v.label(ctx,`ядро Z = ${p.Z}; пунктир — d = ${числоНаСцене(d,3)} фм`,0,0,10,-14,dang);
    // траектории
    for(const q of s.ч){ const возраст=q.жив?0:s.t-q.t, θ=q.θ!=null?q.θ:Math.atan2(Math.abs(q.vy),q.vx);
      ctx.strokeStyle=θ>Math.PI/2?dang:acc; ctx.globalAlpha=(q.жив?0.75:0.75*(1-возраст/1.2))*(θ>Math.PI/2?1:0.7); ctx.lineWidth=v.lw(1.1);
      ctx.beginPath(); q.путь.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.lineTo(q.x,q.y); ctx.stroke();
      if(q.жив){ ctx.globalAlpha=1; ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(q.x,q.y,v.lw(2.5),0,7); ctx.fill(); } }
    ctx.globalAlpha=1;
    v.text(ctx,'пучок альфа-частиц →',-W,W*0.62,ink2,10.5,'left');
    if(!p.hist) return;
    // счётчик по углам: столбики — опыт, точки — формула Резерфорда
    const уз=typeof CW!=='undefined'&&this.узко(CW,CH);
    const gx=уз?-W*0.95:W*1.12, gy=уз?-W*2.35:-W*0.75, gw=уз?W*1.9:W*0.95, gh=уз?W*1.05:W*1.5, N=Math.max(1,s.всего);
    const ожид=i=>{ const a=this.доля(p,Math.max(1e-6,i*Math.PI/18)), b=i===17?0:this.доля(p,(i+1)*Math.PI/18); return N*(a-b); };
    const мах=Math.max(5,...s.бины.map(x=>x),...[1,2,3].map(ожид)), лог=x=>Math.log10(1+x)/Math.log10(1+мах);
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(gx,gy+gh); ctx.lineTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    for(let i=0;i<18;i++){ const x=gx+gw*i/18, w=gw/18*0.8;
      ctx.fillStyle=i>=9?dang:acc; ctx.globalAlpha=.75; ctx.fillRect(x,gy,w,gh*лог(s.бины[i])); ctx.globalAlpha=1;
      if(i>0){ ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(x+w/2,gy+gh*лог(ожид(i)),v.lw(2.6),0,7); ctx.fill(); } }
    v.text(ctx,'угол рассеяния θ: 0° … 180°',gx+gw/2,gy-W*0.09,ink3,9.5,'center');
    v.text(ctx,'число частиц (логарифм.)',gx,gy+gh+W*0.07,ink2,10,'left');
    v.text(ctx,'• формула Резерфорда',gx+gw,gy+gh+W*0.07,ink,9.5,'right');
  }
},

/* ------------------------------------------------------------------ */
chain:{
  title:'Цепная реакция: критический размер и стержни',
  schema:true,
  params:[
    {key:'R',label:'Радиус шара топлива R',unit:'см',min:2,max:20,step:0.5,default:7},
    {key:'rods',label:'Стержни введены на',unit:'%',min:0,max:100,step:1,default:0},
    {key:'lf',label:'Пробег нейтрона до деления λ_f',unit:'см',min:3,max:12,step:0.1,default:6},
    {key:'lc',label:'Пробег до захвата без деления λ_c',unit:'см',min:3,max:80,step:0.5,default:30},
    {key:'n0',label:'Нейтронов в начале',min:1,max:40,step:1,default:12}
  ],
  ν:2.5, V:6, МАКС:2600, E:200,
  /* бесконечная среда: на одно поглощение приходится доля делений λ_c/(λ_f + λ_c) */
  kинф(p){ return this.ν*p.lc/(p.lf+p.lc); },
  init(p){ const г=МОД7.гсч(1234567+Math.round(p.R*10)+p.rods*31), n=[];
    for(let i=0;i<p.n0;i++){ const a=г()*2*Math.PI, ρ=p.R*0.3*Math.sqrt(г()), b=г()*2*Math.PI;   // источник — облачко в середине шара
      n.push({x:ρ*Math.cos(b),y:ρ*Math.sin(b),ux:Math.cos(a),uy:Math.sin(a),ост:-Math.log(1-г())*this.путь(p),пок:0}); }
    return {t:0,event:null,__stop:null,г,n,делений:0,утекло:0,поглощено:0,вспышки:[],пок:new Array(60).fill(0),k:null}; },
  путь(p){ return 1/(1/p.lf+1/p.lc); },                               // средний пробег до любого поглощения
  вСтержне(p,x,y){ if(p.rods<=0) return false;
    const низ=p.R-2*p.R*p.rods/100;                                    // стержни входят сверху
    for(const xr of [-p.R*0.5,0,p.R*0.5]) if(Math.abs(x-xr)<p.R*0.035&&y>низ) return true;
    return false; },
  step(s,dt,p){
    s.t+=dt; const г=s.г, нов=[];
    for(const q of s.n){
      let ход=this.V*dt;
      while(ход>0&&q){ const шаг=Math.min(ход,q.ост,0.5);
        q.x+=q.ux*шаг; q.y+=q.uy*шаг; q.ост-=шаг; ход-=шаг;
        if(q.x*q.x+q.y*q.y>p.R*p.R){ s.утекло++; q.мёртв=true; break; }
        if(this.вСтержне(p,q.x,q.y)){ s.поглощено++; q.мёртв=true; break; }
        if(q.ост<=1e-9){
          if(г()<p.lc/(p.lf+p.lc)){                                    // деление
            s.делений++; s.вспышки.push({x:q.x,y:q.y,t:s.t}); if(q.пок<60) s.пок[q.пок]++;
            const m=г()<0.5?2:3;
            for(let i=0;i<m;i++){ const a=г()*2*Math.PI; нов.push({x:q.x,y:q.y,ux:Math.cos(a),uy:Math.sin(a),ост:-Math.log(1-г())*this.путь(p),пок:q.пок+1}); }
          } else s.поглощено++;
          q.мёртв=true; break; } }
    }
    s.n=s.n.filter(q=>!q.мёртв).concat(нов);
    s.вспышки=s.вспышки.filter(f=>s.t-f.t<0.5);
    // k по поколениям: отношение делений соседних поколений, где счёт уже закрыт
    let сум=0,раз=0; const тек=Math.min(...s.n.map(q=>q.пок),60);
    for(let g=0;g+1<тек&&g<58;g++) if(s.пок[g]>=8){ сум+=s.пок[g+1]/s.пок[g]; раз++; }
    s.k=раз?сум/раз:null;
    if(s.n.length>this.МАКС&&!s.event){ s.event={type:'boom',t:s.t}; s.__stop='Надкритично: нейтронов стало в сотни раз больше — мощность растёт лавиной'; }
    if(!s.n.length&&!s.event){ s.event={type:'out',t:s.t}; s.__stop='Реакция затухла: все нейтроны утекли или поглощены'; }
  },
  режим(s,p){ if(s.k==null) return 'идёт счёт поколений…'; return s.k<0.95?'подкритический: реакция гаснет':s.k>1.05?'надкритический: лавина':'около критического'; },
  readouts(s,p){
    return [['t',s.t,'с'],['нейтронов сейчас',s.n.length,''],['делений',s.делений,''],['выделилось энергии',s.делений*this.E*1.602176634e-13,'Дж'],
      ['утекло через поверхность',s.утекло,''],['поглощено без деления',s.поглощено,''],
      ['k в бесконечной среде = ν·λ_c/(λ_f + λ_c)',this.kинф(p),''],['k по поколениям (опыт)',s.k==null?'—':s.k,''],['режим',this.режим(s,p),'']];
  },
  graphs:[
    {label:'Нейтронов в шаре',unit:'шт',series:['n'],get(s){ return [s.n.length,null]; }}
  ],
  presets:[
    {name:'Маленький шар: нейтроны утекают',values:{R:3,rods:0,lf:6,lc:30,n0:30}},
    {name:'Около критического размера',values:{R:4.5,rods:0,lf:6,lc:30,n0:30}},
    {name:'Шар побольше: лавина',values:{R:7,rods:0,lf:6,lc:30,n0:12}},
    {name:'Тот же шар, стержни введены',values:{R:7,rods:85,lf:6,lc:30,n0:30}},
    {name:'Сильный поглотитель: k∞ < 1 при любом размере',values:{R:20,rods:0,lf:6,lc:3.5,n0:30}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320; return {x:0,y:0,scale:clamp(Math.min((W-40)/((2*p.R+8)*PX_PER_M),(H-40)/((2*p.R+8)*PX_PER_M)),1e-4,30)}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    ctx.fillStyle=sec; ctx.globalAlpha=.1; ctx.beginPath(); ctx.arc(0,0,p.R,0,7); ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.arc(0,0,p.R,0,7); ctx.stroke();
    // стержни
    if(p.rods>0){ const низ=p.R-2*p.R*p.rods/100; ctx.fillStyle=ink2;
      for(const xr of [-p.R*0.5,0,p.R*0.5]){ const w=p.R*0.07; ctx.fillRect(xr-w/2,низ,w,p.R+3-низ); } }
    const рв=p.R*0.05;
    for(const f of s.вспышки){ const a=1-(s.t-f.t)/0.5; ctx.strokeStyle=dang; ctx.globalAlpha=a*0.8; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.arc(f.x,f.y,рв*(0.4+1.6*(1-a)),0,7); ctx.stroke(); }
    ctx.globalAlpha=1; ctx.fillStyle=acc;
    for(const q of s.n){ ctx.beginPath(); ctx.arc(q.x,q.y,v.lw(2.1),0,7); ctx.fill(); }
    v.text(ctx,`R = ${p.R} см · k∞ = ${числоНаСцене(this.kинф(p),3)} · ${this.режим(s,p)}`,0,-p.R-1.6,ink2,10.5,'center');
    v.text(ctx,'точки — нейтроны, вспышки — деления ядер',0,p.R+1.3,ink3,10,'center');
  }
},

/* ------------------------------------------------------------------ */
shield:{
  title:'Ионизирующие излучения: пробег, поглощение, доза',
  schema:true,
  params:[
    {key:'src',label:'Источник',type:'select',default:'cs',
     options:[{v:'a',t:'альфа: ²⁴¹Am, 5,5 МэВ'},{v:'b',t:'бета: ⁹⁰Sr/⁹⁰Y, до 2,3 МэВ'},{v:'cs',t:'гамма: ¹³⁷Cs, 0,662 МэВ'},{v:'co',t:'гамма: ⁶⁰Co, 1,25 МэВ'}]},
    {key:'A',label:'Активность A',unit:'МБк',min:0.1,max:1000,step:0.1,default:100},
    {key:'r',label:'Расстояние до счётчика r',unit:'м',min:0.02,max:5,step:0.01,default:1},
    {key:'mat',label:'Экран',type:'select',default:'pb',
     options:[{v:'none',t:'без экрана'},{v:'paper',t:'бумага'},{v:'water',t:'вода'},{v:'al',t:'алюминий'},{v:'conc',t:'бетон'},{v:'pb',t:'свинец'}]},
    {key:'d',label:'Толщина экрана d',unit:'мм',min:0,max:200,step:0.5,default:10}
  ],
  ρ:{none:0,paper:0.8,water:1,al:2.7,conc:2.35,pb:11.35},
  /* массовые коэффициенты ослабления гамма-лучей, см²/г */
  μm:{cs:{paper:0.0775,water:0.0857,al:0.0748,conc:0.0774,pb:0.114},co:{paper:0.0563,water:0.0632,al:0.055,conc:0.0566,pb:0.0588}},
  Γ:{cs:0.092,co:0.35},                                                // мкЗв·м²/(ч·МБк)
  μ(p){ if(p.mat==='none'||p.src==='a'||p.src==='b') return 0; return this.μm[p.src][p.mat]*this.ρ[p.mat]; },   // 1/см
  /* доля частиц, прошедших экран и воздух */
  T(p){ const ρd=this.ρ[p.mat]*p.d/10;                                   // г/см²
    if(p.src==='a'){ const воздух=p.r*1000>40; return воздух||(p.mat!=='none'&&p.d>=0.02)?0:1; }
    if(p.src==='b'){ const R=1.1, μ=6.6, ρв=0.0012*p.r*100, всё=ρd+ρв; return всё>=R?0:Math.exp(-μ*всё); }
    return Math.exp(-this.μ(p)*p.d/10); },
  половина(p){ if(p.src==='a') return null; if(p.src==='b') return p.mat==='none'?null:Math.log(2)/(6.6*this.ρ[p.mat])*10;
    return this.μ(p)>0?Math.log(2)/this.μ(p)*10:null; },
  счёт(p){ const eff={a:1,b:0.3,cs:0.01,co:0.01}[p.src]; return p.A*1e6*10/(4*Math.PI*Math.pow(p.r*100,2))*this.T(p)*eff; },  // окно счётчика 10 см²
  доза(p){ return p.src==='cs'||p.src==='co'?this.Γ[p.src]*p.A/(p.r*p.r)*this.T(p):0; },
  init(p){ return {t:0,event:null,__stop:null,г:МОД7.гсч(777),ч:[],щелчки:[],след:0}; },
  step(s,dt,p){
    s.t+=dt; const г=s.г, X=6, Т=this.T(p);
    s.след+=dt*14;
    while(s.след>=1){ s.след-=1; const a=(г()-0.5)*0.5; s.ч.push({x:0,y:0,ux:Math.cos(a),uy:Math.sin(a),пройдёт:г()<Т,стоп:null}); }
    const ex=X*0.5, ew=Math.max(0.06,Math.min(1.6,p.d/40));
    for(const q of s.ч){ if(q.стоп!=null) continue; const v=p.src==='a'?3:p.src==='b'?5:7; q.x+=q.ux*v*dt; q.y+=q.uy*v*dt;
      if(!q.пройдёт){ const грань=p.mat==='none'||p.d<=0?(p.src==='a'?Math.min(X,X*0.04/Math.max(p.r,0.04)):X):ex-ew/2+г()*ew; if(q.x>=грань){ q.стоп=s.t; } }
      if(q.x>=X&&q.стоп==null){ q.стоп=s.t; if(Math.abs(q.y)<0.6) s.щелчки.push(s.t); } }
    s.ч=s.ч.filter(q=>q.стоп==null||s.t-q.стоп<0.6);
    s.щелчки=s.щелчки.filter(t=>s.t-t<0.25);
  },
  readouts(s,p){
    const h=this.половина(p);
    return [['прошло через экран и воздух',100*this.T(p),'%'],['слой половинного ослабления',h==null?'—':h,'мм'],
      ['скорость счёта (окно 10 см²)',this.счёт(p),'имп/с'],['мощность дозы гамма-излучения',this.доза(p),'мкЗв/ч'],
      ['природный фон для сравнения',0.15,'мкЗв/ч']];
  },
  graphs:[],
  presets:[
    {name:'Альфа: остановит лист бумаги',values:{src:'a',A:10,r:0.02,mat:'paper',d:0.1}},
    {name:'Бета: хватит нескольких мм алюминия',values:{src:'b',A:10,r:0.2,mat:'al',d:5}},
    {name:'Гамма Cs-137: 1 см свинца',values:{src:'cs',A:100,r:1,mat:'pb',d:10}},
    {name:'Без защиты: только расстояние',values:{src:'cs',A:100,r:2,mat:'none',d:0}},
    {name:'Кобальт: нужно больше свинца',values:{src:'co',A:100,r:1,mat:'pb',d:50}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320; return {x:3,y:0.2,scale:clamp(Math.min((W-30)/(8.6*PX_PER_M),(H-30)/(5.2*PX_PER_M)),1e-3,30)}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const X=6, ex=X*0.5, ew=Math.max(0.06,Math.min(1.6,p.d/40)), цв=p.src==='a'?dang:p.src==='b'?acc:sec;
    // источник
    ctx.fillStyle=ink2; ctx.fillRect(-0.45,-0.35,0.45,0.7); v.text(ctx,{a:'α',b:'β',cs:'γ ¹³⁷Cs',co:'γ ⁶⁰Co'}[p.src],-0.22,0.7,ink2,11,'center');
    // экран
    if(p.mat!=='none'&&p.d>0){ ctx.fillStyle=ink3; ctx.globalAlpha=p.mat==='pb'?.55:.3; ctx.fillRect(ex-ew/2,-1.6,ew,3.2); ctx.globalAlpha=1;
      v.text(ctx,`${{paper:'бумага',water:'вода',al:'алюминий',conc:'бетон',pb:'свинец'}[p.mat]}, ${p.d} мм`,ex,1.95,ink2,10.5,'center'); }
    // счётчик Гейгера
    const яр=s.щелчки.length>0;
    ctx.fillStyle=яр?dang:ink2; ctx.globalAlpha=яр?.9:.6; ctx.fillRect(X,-0.6,0.5,1.2); ctx.globalAlpha=1;
    v.text(ctx,'счётчик',X+0.25,-0.95,ink2,10,'center');
    // частицы
    for(const q of s.ч){ const a=q.стоп==null?1:1-(s.t-q.стоп)/0.6; ctx.globalAlpha=a;
      if(p.src==='cs'||p.src==='co'){ ctx.strokeStyle=цв; ctx.lineWidth=v.lw(1.2); ctx.beginPath();
        for(let i=0;i<=8;i++){ const t=-0.35*i/8, x=q.x+q.ux*t-q.uy*0.06*Math.sin(i*2), y=q.y+q.uy*t+q.ux*0.06*Math.sin(i*2); i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke(); }
      else { ctx.fillStyle=цв; ctx.beginPath(); ctx.arc(q.x,q.y,v.lw(p.src==='a'?3.4:2),0,7); ctx.fill(); } }
    ctx.globalAlpha=1;
    v.text(ctx,`r = ${p.r} м`,X/2,-1.95,meas,10.5,'center');
    v.text(ctx,`прошло ${числоНаСцене(100*this.T(p),3)} %${p.src==='cs'||p.src==='co'?` · доза ${числоНаСцене(this.доза(p),3)} мкЗв/ч`:''}`,X/2,-2.4,ink2,10.5,'center');
  }
},

/* ------------------------------------------------------------------ */
tracks:{
  title:'Камера Вильсона: треки частиц в магнитном поле',
  gridUnit:'см',
  params:[
    {key:'part',label:'Частица',type:'select',default:'p',
     options:[{v:'e',t:'электрон e⁻'},{v:'pos',t:'позитрон e⁺'},{v:'mu',t:'мюон μ⁻'},{v:'p',t:'протон p'},{v:'a',t:'альфа-частица'}]},
    {key:'P',label:'Импульс p',unit:'МэВ/c',min:1,max:1000,step:1,default:150},
    {key:'B',label:'Индукция поля B (от нас)',unit:'Тл',min:0.05,max:3,step:0.05,default:1},
    {key:'loss',label:'Потеря энергии на ионизацию (спираль)',type:'check',default:false}
  ],
  M:{e:{m:0.51099895,z:-1,имя:'электрон'},pos:{m:0.51099895,z:1,имя:'позитрон'},mu:{m:105.6583755,z:-1,имя:'мюон'},p:{m:938.27208816,z:1,имя:'протон'},a:{m:3727.3794066,z:2,имя:'альфа-частица'}},
  ч(p){ return this.M[p.part]||this.M.p; },
  r(p,P){ return (P==null?p.P:P)/(299.792458*Math.abs(this.ч(p).z)*p.B)*100; },   // см
  β(p,P){ const m=this.ч(p).m, q=P==null?p.P:P; return q/Math.sqrt(q*q+m*m); },
  K(p){ const m=this.ч(p).m; return Math.sqrt(p.P*p.P+m*m)-m; },
  init(p){ return {t:0,event:null,__stop:null,x:-20,y:0,φ:0,P:p.P,след:[],старые:[],г:МОД7.гсч(99)}; },
  step(s,dt,p){
    s.t+=dt; const ч=this.ч(p);
    // путь за кадр: трек проходит камеру примерно за 2 с
    let ход=24*dt;
    while(ход>0){ const h=Math.min(ход,0.1), r=this.r(p,s.P);
      s.φ+=Math.sign(ч.z)*h/r;                                          // B от нас: положительный заряд заворачивает влево (против часовой)
      s.x+=Math.cos(s.φ)*h; s.y+=Math.sin(s.φ)*h; ход-=h;
      // капли: тем гуще, чем медленнее частица (ионизация ∝ 1/β²)
      const β=this.β(p,s.P); if(s.г()<h*3/(β*β)/3) s.след.push([s.x+(s.г()-0.5)*0.12,s.y+(s.г()-0.5)*0.12]);
      if(p.loss) s.P=Math.max(1,s.P*(1-h*0.012/(β*β)));
      if(Math.abs(s.x)>21||Math.abs(s.y)>14||s.P<=1.5){
        s.старые.push(s.след); if(s.старые.length>3) s.старые.shift();
        s.след=[]; s.x=-20; s.y=(s.г()-0.5)*6; s.φ=(s.г()-0.5)*0.3; s.P=p.P; break; } }
  },
  readouts(s,p){
    const ч=this.ч(p);
    return [['радиус трека r = p/(qB)',this.r(p),'см'],['скорость v/c',this.β(p),''],['кинетическая энергия K',this.K(p),'МэВ'],
      ['заряд',ч.z>0?`+${ч.z}e — заворачивает против часовой`:`${ч.z}e — заворачивает по часовой`,''],
      ['ионизация относительно быстрой частицы ≈ 1/β²',1/Math.pow(this.β(p),2),'']];
  },
  graphs:[],
  presets:[
    {name:'Протон 150 МэВ/c',values:{part:'p',P:150,B:1,loss:false}},
    {name:'Электрон и позитрон: одинаковые круги в разные стороны',values:{part:'pos',P:20,B:1,loss:false}},
    {name:'Электрон теряет энергию — спираль',values:{part:'e',P:20,B:1,loss:true}},
    {name:'Альфа-частица: толстый короткий трек',values:{part:'a',P:200,B:2,loss:true}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320; return {x:0,y:0,scale:clamp(Math.min((W-30)/(44*PX_PER_M),(H-30)/(30*PX_PER_M)),1e-4,30)}; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure');
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.strokeRect(-21,-14,42,28);
    // B от нас — крестики
    ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1);
    for(let x=-18;x<=18;x+=6) for(let y=-11;y<=11;y+=5.5){ ctx.beginPath(); ctx.moveTo(x-0.4,y-0.4); ctx.lineTo(x+0.4,y+0.4); ctx.moveTo(x-0.4,y+0.4); ctx.lineTo(x+0.4,y-0.4); ctx.stroke(); }
    ctx.globalAlpha=1;
    const капли=(arr,a)=>{ ctx.fillStyle=ink2; ctx.globalAlpha=a; for(const [x,y] of arr){ ctx.beginPath(); ctx.arc(x,y,v.lw(1.5),0,7); ctx.fill(); } };
    s.старые.forEach((tr,i)=>капли(tr,0.18+0.15*i));
    капли(s.след,0.9); ctx.globalAlpha=1;
    ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(s.x,s.y,v.lw(3),0,7); ctx.fill();
    v.text(ctx,`B = ${p.B} Тл, от нас: ${this.ч(p).имя}, r = ${числоНаСцене(this.r(p),3)} см`,0,15,ink2,10.5,'center');
  }
}
});
