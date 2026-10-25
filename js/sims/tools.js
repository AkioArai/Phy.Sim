/* ===================== ИНСТРУМЕНТЫ МОДЕЛЕЙ ДЛЯ СТАРЫХ СЦЕН (9.5.0) =====================
   Сцены, написанные до 9.5, получают здесь свои ручки и зонды — не трогая
   их физику. Каждая ручка привязана к тому, что уже нарисовано: поршень,
   конец стержня, вершина цикла, точка на изотерме. Зонд отвечает на вопрос
   «а что здесь?» в любой точке графика или тела — так одна и та же модель
   решает не только задачу, под которую её писали.

   Файл грузится после всех сцен; если какой-то сцены нет (тесты грузят
   файлы по одному), её инструменты просто не ставятся.                     */
(function(){
  const ставить=(id,f)=>{ if(typeof SIMS!=='undefined'&&SIMS[id]&&!SIMS[id].tools) SIMS[id].tools=f; };
  const найтиОбр=(f,a,b,y)=>{ let lo=a,hi=b; const up=f(b)>f(a); for(let i=0;i<60;i++){ const m=(lo+hi)/2; if((f(m)<y)===up) lo=m; else hi=m; } return (lo+hi)/2; };

  /* ---------- газ в ящике ---------- */
  ставить('gas',function(p){ const S=this;
    return [РУЧКИ({name:'Поршень и температура',
      ручки(p){ return [{id:'piston',x:p.Lx*(p.piston?p.pistonX:1),y:p.Ly/2,имя:p=>`поршень: ${Math.round((p.piston?p.pistonX:1)*100)} % ширины`,
          тянуть(т,wx){ т.set('piston',true); т.p.piston=true; т.set('pistonX',wx/т.p.Lx); },клав:{ArrowLeft:['pistonX',-0.05],ArrowRight:['pistonX',0.05]}},
        {id:'T',x:p.Lx+0.5,y:p.Ly*clamp(p.T/1200,0,1),имя:p=>`T = ${p.T} K`,тянуть(т,wx,wy){ т.set('T',wy/т.p.Ly*1200); },клав:{ArrowUp:['T',10],ArrowDown:['T',-10]}}]; }})]; });

  /* ---------- микросостояния ---------- */
  ставить('micro',function(p){ const S=this;
    return [РУЧКИ({name:'Дырка в перегородке',
      ручки(p){ return [{id:'rate',x:S.Lx/2,y:S.Ly/2,имя:p=>`${p.rate} переходов в секунду (тяните вверх-вниз)`,
        тянуть(т,wx,wy,ст){ т.set('rate',ст.p.rate*Math.pow(2,(wy-ст.wy)/1.2)); },клав:{ArrowUp:['rate',5],ArrowDown:['rate',-5]}}]; }})]; });

  /* ---------- калориметрия: зонд по графику T(Q) ---------- */
  ставить('calorimetry',function(p){ const S=this;
    const рамка=p=>{ const Sb=S.S(p), x0=-5.2, x1=5.2, y0=-1.6, y1=3.2, Tmin=Math.min(p.T0,Sb.Tm)-20, Tmax=Sb.Tb+230; return {x0,x1,y0,y1,Tmin,Tmax,Qt:S.Qtotal(p)}; };
    return [РУЧКИ({name:'Начальная температура',
        ручки(p){ const Р=рамка(p); return [{id:'T0',x:Р.x0,y:Р.y0+(Р.y1-Р.y0)*clamp((p.T0-Р.Tmin)/(Р.Tmax-Р.Tmin),0,1),имя:p=>`t₀ = ${p.T0} °C`,
          тянуть(т,wx,wy,ст){ const Р0=рамка(ст.p); т.set('T0',Р0.Tmin+(wy-Р0.y0)/(Р0.y1-Р0.y0)*(Р0.Tmax-Р0.Tmin)); },клав:{ArrowUp:['T0',1],ArrowDown:['T0',-1]}}]; }}),
      ЗОНД({hint:'щёлкните по графику — сколько теплоты подведено к этой точке и что с веществом',
        замер(p,s,x,y){ const Р=рамка(p); if(x<Р.x0||x>Р.x1) return null; const Q=(x-Р.x0)/(Р.x1-Р.x0)*Р.Qt, st=S.stateAtQ(p,Q);
          return [`Q = ${(Q/1000).toFixed(1)} кДж`,`t = ${st.T.toFixed(1)} °C`,`время нагрева ${(Q/p.P).toFixed(0)} с`]; }})]; });

  /* ---------- цикл Карно: температуры резервуаров на шкале ---------- */
  ставить('carnot',function(p){ const S=this;
    const xT=-0.7+1.3+0.35, y=T=>-3+6*clamp(T/1200,0,1);
    return [РУЧКИ({name:'Температуры нагревателя и холодильника',
      ручки(p){ return [{id:'T1',x:xT,y:y(p.T1),имя:p=>`T₁ = ${p.T1} K`,тянуть(т,wx,wy){ т.set('T1',(wy+3)/6*1200); },клав:{ArrowUp:['T1',10],ArrowDown:['T1',-10]}},
        {id:'T2',x:xT,y:y(p.T2),имя:p=>`T₂ = ${p.T2} K`,тянуть(т,wx,wy){ т.set('T2',(wy+3)/6*1200); },клав:{ArrowUp:['T2',10],ArrowDown:['T2',-10]}}]; }})]; });

  /* ---------- Ван-дер-Ваальс: изотерма и объём ---------- */
  ставить('vdw',function(p){ const S=this, π=(φ,τ)=>8*τ/(3*φ-1)-3/(φ*φ);
    const Xi=x=>найтиОбр(f=>S.X(f),0.36,5.6,x), Yi=y=>(y-0.3)/4*2;
    return [РУЧКИ({name:'Изотерма и объёмы',
        ручки(p){ return [{id:'tau',x:S.X(3),y:S.Y(π(3,p.tau)),имя:p=>`T = ${p.tau} T_кр (тяните вверх-вниз)`,тянуть(т,wx,wy){ const φ=3, пп=Yi(wy); т.set('tau',(пп+3/(φ*φ))*(3*φ-1)/8); },клав:{ArrowUp:['tau',0.01],ArrowDown:['tau',-0.01]}},
          {id:'phi0',x:S.X(p.phi0),y:0.3,имя:p=>`начало V = ${p.phi0} V_кр`,тянуть(т,wx){ т.set('phi0',Xi(wx)); },клав:{ArrowRight:['phi0',0.1],ArrowLeft:['phi0',-0.1]}},
          {id:'phi1',x:S.X(p.phi1),y:0.3,имя:p=>`конец V = ${p.phi1} V_кр`,тянуть(т,wx){ т.set('phi1',Xi(wx)); },клав:{ArrowRight:['phi1',0.01],ArrowLeft:['phi1',-0.01]}}]; }}),
      ЗОНД({hint:'щёлкните по диаграмме — объём и давление в приведённых и обычных единицах',
        замер(p,s,x,y){ if(x<0.4||x>6.1||y<0.3||y>4.5) return null; const φ=Xi(x), пп=Yi(y), в=S.в(p);
          return [`V = ${φ.toFixed(2)} V_кр`,`p = ${пп.toFixed(2)} p_кр = ${(пп*в.pc/1e6).toFixed(2)} МПа`,`на изотерме здесь p = ${π(φ,p.tau).toFixed(2)} p_кр`]; }})]; });

  /* ---------- теплопроводность ---------- */
  ставить('heat',function(p){ const S=this, Ws=6, g0=1.2, gh=2.8;
    const шкала=p=>{ const вс=[p.T0,p.T1,p.T2,p.T0+(p.init==='step'?0:p.dT),p.init==='sin'?Math.max(p.T1,p.T2)+p.dT:-1e9].filter(x=>x>-1e8);
      const лo=Math.min(...вс), хi=Math.max(...вс,лo+1); return {Y:T=>g0+(T-лo)/(хi-лo)*gh,Yi:y=>лo+(y-g0)/gh*(хi-лo)}; };
    return [РУЧКИ({name:'Температуры концов',
        ручки(p){ if(p.init==='spot') return []; const Ш=шкала(p);
          return [{id:'T1',x:0,y:Ш.Y(p.T1),имя:p=>`T₁ = ${p.T1} °C`,тянуть(т,wx,wy,ст){ т.set('T1',шкала(ст.p).Yi(wy)); },клав:{ArrowUp:['T1',1],ArrowDown:['T1',-1]}},
            {id:'T2',x:Ws,y:Ш.Y(p.T2),имя:p=>`T₂ = ${p.T2} °C`,тянуть(т,wx,wy,ст){ т.set('T2',шкала(ст.p).Yi(wy)); },клав:{ArrowUp:['T2',1],ArrowDown:['T2',-1]}}]; }}),
      ЗОНД({hint:'щёлкните по стержню или графику — температура и поток тепла в этом сечении',
        замер(p,s,x,y){ if(x<0||x>Ws) return null; const N=S.N, f=x/Ws*(N-1), i=Math.min(N-2,Math.floor(f)), T=s.T[i]+(s.T[i+1]-s.T[i])*(f-i);
          return [`x = ${(x/Ws*p.L*100).toFixed(1)} см`,`T = ${T.toFixed(1)} °C`,`поток q = ${(S.поток(s,p,Math.round(f))/1000).toFixed(2)} кВт/м²`]; }})]; });

  /* ---------- броуновское движение: доля частиц внутри круга ---------- */
  ставить('diffusion',function(p){ const S=this;
    return [ЗОНД({hint:'щёлкните на расстоянии r от центра — какая доля частиц ближе r, и что даёт теория',
      замер(p,s,x,y){ const r=Math.hypot(x,y); let n=0; for(let i=0;i<s.n;i++) if(Math.hypot(s.xy[2*i],s.xy[2*i+1])<r) n++;
        const D=S.D(p)*1e12, теор=s.t>0?1-Math.exp(-r*r/(4*D*s.t)):1;
        return [`r = ${r.toFixed(2)} мкм`,`ближе r: ${(100*n/s.n).toFixed(1)} % частиц`,`теория 1 − e^(−r²/4Dt): ${(100*теор).toFixed(1)} %`]; }})]; });

  /* ---------- капилляры ---------- */
  ставить('capillary',function(p){ const S=this;
    const геом=p=>{ const hm=Math.abs(S.h(p,p.r)), W=Math.max(70,(Math.min(400,hm)*1.25+30)*0.9), вис=Math.max(2.4,Math.min(400,hm)*0.07); return {W,вис,hm}; };
    return [РУЧКИ({name:'Радиус трубки',
      ручки(p){ const g=геом(p), w=g.вис*0.6, x=g.W*0.12; return [{id:'r',x:x+w,y:Math.max(0,clamp(S.h(p,p.r),-400,400))+4,имя:p=>`r = ${p.r} мм (тяните вбок)`,
        тянуть(т,wx,wy,ст){ т.set('r',ст.p.r*Math.pow(2,(wx-ст.wx)/(геом(ст.p).W*0.08))); },клав:{ArrowRight:['r',0.05],ArrowLeft:['r',-0.05]}}]; }})]; });

  /* ---------- растяжение: зонд по диаграмме ---------- */
  ставить('tensile',function(p){ const S=this;
    return [ЗОНД({hint:'щёлкните по диаграмме σ(ε) — напряжение и сила при этом удлинении',
      замер(p,s,x,y){ if(p.mode!=='stretch'||!p.diag) return null; const м=S.м(p), gx=3.2, gy=0.5, gw=5.6, gh=3.8, εm=м.ef*1.08;
        if(x<gx||x>gx+gw||y<gy-0.3||y>gy+gh) return null; const ε=(x-gx)/gw*εm, σ=S.σ(p,Math.min(ε,м.ef));
        return [`ε = ${(ε*100).toFixed(2)} %`,`σ = ${(σ/1e6).toFixed(0)} МПа`,`сила ${(σ*S.S(p)/1000).toFixed(2)} кН`,`удлинение ${(ε*p.L*1000).toFixed(1)} мм`]; }})]; });

  /* ---------- циклы Отто и Дизеля ---------- */
  ставить('otto',function(p){ const S=this;
    const рамка=p=>{ const {P}=S.точки(p), Vm=P[0][0]*1.08, pm=Math.max(P[2][1],P[1][1])*1.1, gx=0.4, gy=0.4, gw=5.4, gh=4;
      return {P,X:V=>gx+V/Vm*gw,Y:pp=>gy+pp/pm*gh,Vi:x=>(x-gx)/gw*Vm,Pi:y=>(y-gy)/gh*pm,gx,gy,gw,gh}; };
    return [РУЧКИ({name:'Сжатие и подвод теплоты',
        ручки(p){ const Р=рамка(p), h=[{id:'eps',x:Р.X(Р.P[1][0]),y:Р.Y(Р.P[1][1]),имя:p=>`ε = ${p.eps} (тяните вбок)`,тянуть(т,wx,wy,ст){ const Р0=рамка(ст.p); т.set('eps',ст.p.V1/1000/Math.max(1e-6,Р0.Vi(wx))); },клав:{ArrowLeft:['eps',0.5],ArrowRight:['eps',-0.5]}}];
          if(p.cyc==='diesel') h.push({id:'rho',x:Р.X(Р.P[2][0]),y:Р.Y(Р.P[2][1]),имя:p=>`β = ${p.rho} (тяните вбок)`,тянуть(т,wx,wy,ст){ const Р0=рамка(ст.p); т.set('rho',Р0.Vi(wx)/Р0.P[1][0]); },клав:{ArrowRight:['rho',0.1],ArrowLeft:['rho',-0.1]}});
          else h.push({id:'qin',x:Р.X(Р.P[2][0]),y:Р.Y(Р.P[2][1]),имя:p=>`теплота сгорания ${p.qin} Дж (тяните вверх)`,тянуть(т,wx,wy,ст){ т.set('qin',ст.p.qin*Math.pow(2,(wy-ст.wy)/1.2)); },клав:{ArrowUp:['qin',10],ArrowDown:['qin',-10]}});
          return h; }}),
      ЗОНД({hint:'щёлкните по pV-диаграмме — объём, давление и температура в этой точке',
        замер(p,s,x,y){ const Р=рамка(p); if(x<Р.gx||x>Р.gx+Р.gw||y<Р.gy||y>Р.gy+Р.gh) return null; const V=Р.Vi(x), P=Р.Pi(y), ν=S.точки(p).ν;
          return [`V = ${(V*1000).toFixed(3)} л`,`p = ${(P/1000).toFixed(0)} кПа`,`T = ${(P*V/(ν*8.314462618)).toFixed(0)} К`]; }})]; });
  /* ===================== МЕХАНИКА ===================== */
  const град=r=>r*180/Math.PI;
  ставить('circular',function(p){ return [РУЧКИ_П({name:'Радиус и скорость',ручки:[
    {key:'R',где:p=>[p.R,0],имя:p=>`R = ${p.R} м`,set(т,wx,wy){ т.set('R',Math.hypot(wx,wy)); },шаг:0.1},
    {key:'v',где:p=>[0,p.R],ось:'x',k:0.5,имя:p=>`v = ${p.v} м/с (тяните вбок)`,шаг:0.1,если:p=>p.mode!=='acc'},
    {key:'v0',где:p=>[0,p.R],ось:'x',k:0.5,имя:p=>`v₀ = ${p.v0} м/с (тяните вбок)`,шаг:0.1,если:p=>p.mode==='acc'},
    {key:'at',где:p=>[-p.R,0],ось:'y',k:0.5,имя:p=>`aτ = ${p.at} м/с² (вверх-вниз)`,шаг:0.1,если:p=>p.mode==='acc'}]})]; });
  ставить('river',function(p){ return [РУЧКИ_П({name:'Река и лодка',ручки:[
    {key:'d',где:p=>[0,p.d],имя:p=>`d = ${p.d} м`,set(т,wx,wy){ т.set('d',wy); },ось:'y',шаг:1},
    {key:'u',где:p=>[-p.d*0.3,p.d/2],ось:'x',k:0.05,имя:p=>`u = ${p.u} м/с (тяните вбок)`,шаг:0.1},
    {key:'ang',где:p=>[Math.cos(p.ang*Math.PI/180)*p.vb*p.d*0.04,Math.sin(p.ang*Math.PI/180)*p.vb*p.d*0.04],имя:p=>`нос под ${p.ang}°, v = ${p.vb} м/с`,
      set(т,wx,wy){ т.set('ang',(град(Math.atan2(wy,wx))+360)%360); т.set('vb',Math.hypot(wx,wy)/(т.p.d*0.04)); },шаг:1}]})]; });
  ставить('incline',function(p){ const S=this; return [РУЧКИ_П({name:'Угол и длина плоскости',ручки:[
    {key:'th',где:(p,s)=>{ const G=S.geom(s||S.init(p),p); return [0,G.H]; },имя:p=>`θ = ${p.th}°`,ось:'y',шаг:1,
      set(т,wx,wy){ if(т.p.baseFix) т.set('th',град(Math.atan2(Math.max(0,wy),т.p.b))); else т.set('th',град(Math.asin(clamp(wy/т.p.L,0,0.996)))); }},
    {key:'L',где:(p,s)=>{ const G=S.geom(s||S.init(p),p); return [G.X,0]; },имя:p=>p.baseFix?`b = ${p.b} м`:`L = ${p.L} м`,ось:'x',шаг:0.5,
      set(т,wx){ if(т.p.baseFix) т.set('b',wx); else т.set('L',wx/Math.cos(т.p.th*Math.PI/180)); }}]})]; });
  ставить('lift',function(p){ return [РУЧКИ_П({name:'Разгон и путь',ручки:[
    {key:'a',где:()=>[5.4,4],ось:'y',k:0.5,имя:p=>`a = ${p.a} м/с² (вверх-вниз)`,шаг:0.1},
    {key:'H',где:()=>[7,8.6],ось:'y',лог:1.5,имя:p=>`путь ${p.H} м (вверх-вниз)`,шаг:1}]})]; });
  ставить('newton2',function(p){ return [РУЧКИ_П({name:'Тела и сила',ручки:[1,2,3].map(i=>({key:'x'+i,где:p=>[p['x'+i],0.15],имя:p=>`x${'₁₂₃'[i-1]} = ${p['x'+i]} м`,ось:'x',шаг:0.1,
      set(т,wx){ т.set('x'+i,wx); },если:p=>i<=p.n})).concat([
    {key:'F',где:p=>[p['x'+(p.applyTo||1)]+1.2,1.2],ось:'x',k:2,имя:p=>`F = ${p.F} Н (тяните вбок)`,шаг:1,если:p=>p.Flaw!=='ramp'},
    {key:'Fa',где:p=>[p['x'+(p.applyTo||1)]+1.2,1.2],ось:'x',k:1,имя:p=>`α = ${p.Fa} Н/с (тяните вбок)`,шаг:0.1,если:p=>p.Flaw==='ramp'}])})]; });
  ставить('conical',function(p){ return [РУЧКИ_П({name:'Нить',ручки:[
    {key:'th',где:p=>[p.L*Math.sin(p.th*Math.PI/180),-p.L*Math.cos(p.th*Math.PI/180)],имя:p=>`L = ${p.L} м, угол ${p.th}°`,шаг:1,
      set(т,wx,wy){ т.set('L',Math.hypot(wx,wy)); т.set('th',град(Math.atan2(Math.abs(wx),Math.max(1e-6,-wy)))); }}]})]; });
  ставить('orbit',function(p){ const S=this; return [РУЧКИ_П({name:'Старт спутника',ручки:[
    {key:'r0',где:p=>[p.r0,0],имя:p=>`r₀ = ${p.r0}·10⁶ м`,ось:'x',шаг:1,set(т,wx,wy){ т.set('r0',Math.hypot(wx,wy)); }},
    {key:'v0',где:p=>[p.r0,p.r0*0.25],ось:'y',k:0.02,имя:p=>`v₀ = ${p.v0} км/с (вверх-вниз)`,шаг:0.1}]}),
    ЗОНД({hint:'щёлкните в любую точку — поле тяготения, круговая и вторая космическая скорости на этом расстоянии',
      замер(p,s,x,y){ const r=Math.hypot(x,y)*1e6, mu=S.si(p).mu; if(r<p.Rc*1e6) return ['внутри планеты'];
        return [`r = ${(r/1e6).toFixed(2)}·10⁶ м`,`g = ${(mu/(r*r)).toPrecision(3)} м/с²`,`v₁ = ${(Math.sqrt(mu/r)/1000).toFixed(2)} км/с`,`v₂ = ${(Math.sqrt(2*mu/r)/1000).toFixed(2)} км/с`]; }})]; });
  ставить('energy',function(p){ const S=this; return [РУЧКИ_П({name:'Высота, сжатие, горка',ручки:[
    {key:'h0',где:p=>[0,p.h0],имя:p=>`h₀ = ${p.h0} м`,ось:'y',шаг:0.1,set(т,wx,wy){ т.set('h0',wy); },если:p=>p.mode==='hill'},
    {key:'x0',где:p=>[p.x0,0.3],имя:p=>`x₀ = ${p.x0} м`,ось:'x',шаг:0.05,set(т,wx){ т.set('x0',wx); },если:p=>p.mode==='spring'},
    {key:'v0f',где:()=>[0,0.6],ось:'x',k:1,имя:p=>`v₀ = ${p.v0f} м/с (тяните вбок)`,шаг:0.1,если:p=>p.mode==='fric'},
    {key:'hs',где:p=>[0,p.hs],имя:p=>`h = ${p.hs} м`,ось:'y',шаг:0.1,set(т,wx,wy){ т.set('hs',wy); },если:p=>p.mode==='slope'},
    {key:'alS',где:p=>[p.hs/Math.tan(p.alS*Math.PI/180),0],имя:p=>`α = ${p.alS}°`,ось:'x',шаг:1,set(т,wx){ т.set('alS',град(Math.atan2(т.p.hs,Math.max(0.01,wx)))); },если:p=>p.mode==='slope'}]})]; });
  ставить('econs',function(p){ return [РУЧКИ_П({name:'Начальные условия',ручки:[
    {key:'x0',где:p=>[p.x0,0.5],имя:p=>`x₀ = ${p.x0} м`,ось:'x',шаг:0.1,set(т,wx){ т.set('x0',wx); },если:p=>p.exp==='spring'},
    {key:'u1',где:()=>[-4,1.2],ось:'x',k:1,имя:p=>`u₁ = ${p.u1} м/с (тяните вбок)`,шаг:0.1,если:p=>p.exp==='collide'},
    {key:'u2',где:()=>[4,1.2],ось:'x',k:1,имя:p=>`u₂ = ${p.u2} м/с (тяните вбок)`,шаг:0.1,если:p=>p.exp==='collide'},
    {key:'r0',где:p=>[p.r0,0],имя:p=>`r₀ = ${p.r0}·10⁶ м`,ось:'x',шаг:1,set(т,wx,wy){ т.set('r0',Math.hypot(wx,wy)); },если:p=>p.exp==='orbit'}]})]; });
  ставить('cmass',function(p){ const S=this; return [РУЧКИ_П({name:'Лодка, выстрел, маятник',ручки:[
    {key:'Lb',где:p=>[p.Lb,p.Lb*0.12],имя:p=>`L = ${p.Lb} м`,ось:'x',шаг:0.1,set(т,wx){ т.set('Lb',wx); },если:p=>p.mode==='boat'},
    {key:'mh',где:p=>[0,p.Lb*0.5],ось:'y',лог:1,имя:p=>`m = ${p.mh} кг (вверх-вниз)`,шаг:1,если:p=>p.mode==='boat'},
    {key:'th',где:p=>{ const k=0.6; return [p.v0*k*Math.cos(p.th*Math.PI/180),p.v0*k*Math.sin(p.th*Math.PI/180)]; },имя:p=>`v₀ = ${p.v0} м/с, θ = ${p.th}°`,шаг:1,
      set(т,wx,wy){ т.set('th',град(Math.atan2(Math.max(0,wy),Math.max(1e-6,wx)))); т.set('v0',Math.hypot(wx,wy)/0.6); },если:p=>p.mode==='shell'},
    {key:'vb',где:()=>[-1,0],ось:'x',лог:1,имя:p=>`v пули = ${p.vb} м/с (тяните вбок)`,шаг:1,если:p=>p.mode==='pend'}]})]; });
  ставить('impact',function(p){ return [РУЧКИ_П({name:'Скорость и упругость',ручки:[
    {key:'v0',где:()=>[0,1.4],ось:'y',лог:1,имя:p=>`v₀ = ${p.v0} м/с (вверх-вниз)`,шаг:0.1},
    {key:'e',где:()=>[1.4,1.4],ось:'x',k:0.2,имя:p=>`e = ${p.e} (тяните вбок)`,шаг:0.01}]})]; });
  ставить('momentum',function(p){ return [РУЧКИ_П({name:'Удар и выстрел',ручки:[
    {key:'b',где:p=>[0,p.b],имя:p=>`b = ${p.b} м`,ось:'y',шаг:0.01,set(т,wx,wy){ т.set('b',wy); },если:p=>p.mode==='hit'},
    {key:'v1',где:()=>[-4,-2.5],ось:'x',k:0.5,имя:p=>`v₁ = ${p.v1} м/с (тяните вбок)`,шаг:0.1,если:p=>p.mode==='hit'},
    {key:'vs',где:()=>[2,1],ось:'x',лог:1.5,имя:p=>`скорость снаряда ${p.vs} м/с (тяните вбок)`,шаг:1,если:p=>p.mode==='recoil'}]})]; });
  ставить('rocket',function(p){ return [РУЧКИ_П({name:'Топливо и истечение',ручки:[
    {key:'mf',где:()=>[0,0.2],ось:'y',лог:1,имя:p=>`топливо ${p.mf} кг (вверх-вниз)`,шаг:100},
    {key:'u',где:()=>[0.8,0.2],ось:'x',лог:1.5,имя:p=>`u = ${p.u} м/с (тяните вбок)`,шаг:50}]})]; });
  ставить('rotor',function(p){ return [РУЧКИ_П({name:'Блок и грузы',ручки:[
    {key:'R',где:p=>[p.R,0],имя:p=>`R = ${p.R} м`,ось:'x',шаг:0.01,set(т,wx,wy){ т.set('R',Math.hypot(wx,wy)); }},
    {key:'m1',где:p=>[p.R,-p.h-3*p.R],ось:'y',лог:-0.6,имя:p=>`m₁ = ${p.m1} кг (вверх-вниз)`,шаг:0.1,если:p=>p.mode!=='maxwell'},
    {key:'m2',где:p=>[-p.R,-p.h-3*p.R],ось:'y',лог:-0.6,имя:p=>`m₂ = ${p.m2} кг (вверх-вниз)`,шаг:0.1,если:p=>p.mode==='atwood'},
    {key:'m0',где:()=>[0,0],ось:'y',лог:0.6,имя:p=>`m₀ = ${p.m0} кг (вверх-вниз)`,шаг:0.1}]})]; });
  ставить('spin',function(p){ return [РУЧКИ_П({name:'Радиусы',ручки:[
    {key:'ra',где:p=>[p.ra,0],имя:p=>`начальный r = ${p.ra} м`,ось:'x',шаг:0.1,set(т,wx,wy){ т.set('ra',Math.hypot(wx,wy)); },если:p=>p.mode==='platform'},
    {key:'rb',где:p=>[-p.rb,0],имя:p=>`конечный r = ${p.rb} м`,ось:'x',шаг:0.1,set(т,wx,wy){ т.set('rb',Math.hypot(wx,wy)); },если:p=>p.mode==='platform'},
    {key:'Rd',где:p=>[0,p.Rd],имя:p=>`R = ${p.Rd} м`,ось:'y',шаг:0.1,set(т,wx,wy){ т.set('Rd',Math.hypot(wx,wy)); },если:p=>p.mode==='platform'},
    {key:'r0',где:p=>[p.r0,0],имя:p=>`r₀ = ${p.r0} м`,ось:'x',шаг:0.01,set(т,wx,wy){ т.set('r0',Math.hypot(wx,wy)); },если:p=>p.mode==='puck'},
    {key:'r1',где:p=>[-p.r1,0],имя:p=>`r₁ = ${p.r1} м`,ось:'x',шаг:0.01,set(т,wx,wy){ т.set('r1',Math.hypot(wx,wy)); },если:p=>p.mode==='puck'}]})]; });
  ставить('statics',function(p){ return [РУЧКИ_П({name:'Опора и грузы',ручки:[
    {key:'piv',где:p=>[p.piv,-0.62],имя:p=>`опора в ${p.piv} м`,ось:'x',шаг:0.05,set(т,wx){ т.set('piv',wx); },если:p=>p.sys==='lever'},
    {key:'m1',где:()=>[0,0.6],ось:'y',лог:0.8,имя:p=>`m₁ = ${p.m1} кг (вверх-вниз)`,шаг:0.5,если:p=>p.sys==='lever'},
    {key:'m2',где:p=>[p.L,0.6],ось:'y',лог:0.8,имя:p=>`m₂ = ${p.m2} кг (вверх-вниз)`,шаг:0.5,если:p=>p.sys==='lever'},
    {key:'lpos',где:p=>[p.lpos,0.5],имя:p=>`груз в ${p.lpos} м`,ось:'x',шаг:0.05,set(т,wx){ т.set('lpos',wx); },если:p=>p.sys==='beam'},
    {key:'ang',где:p=>[p.Ll*Math.cos(p.ang*Math.PI/180),p.Ll*Math.sin(p.ang*Math.PI/180)],имя:p=>`θ = ${p.ang}°`,шаг:1,set(т,wx,wy){ т.set('ang',град(Math.atan2(wy,Math.abs(wx)))); },если:p=>p.sys==='ladder'},
    {key:'braceA',где:()=>[1,-1],ось:'y',k:-15,имя:p=>`растяжка под ${p.braceA}° (вверх-вниз)`,шаг:1,если:p=>p.sys==='bracket'}]})]; });
  ставить('stability',function(p){ return [РУЧКИ_П({name:'Наклон плоскости',ручки:[
    {key:'ang',где:p=>[2.6*Math.cos(p.ang*Math.PI/180),-2.6*Math.sin(p.ang*Math.PI/180)],имя:p=>`наклон ${p.ang}°`,шаг:1,set(т,wx,wy){ т.set('ang',град(Math.atan2(-wy,Math.max(1e-6,wx)))); }}]})]; });
  ставить('rolling',function(p){ return [РУЧКИ_П({name:'Склон',ручки:[
    {key:'ang',где:p=>[p.L*Math.cos(p.ang*Math.PI/180),-p.L*Math.sin(p.ang*Math.PI/180)],имя:p=>`α = ${p.ang}°, длина ${p.L} м`,шаг:1,
      set(т,wx,wy){ т.set('ang',град(Math.atan2(-wy,Math.max(1e-6,wx)))); т.set('L',Math.hypot(wx,wy)); }}]})]; });
  ставить('rigid3d',function(p){ return [РУЧКИ_П({name:'Угловая скорость',ручки:[
    {key:'w0',где:()=>[1.4,-1.2],ось:'x',k:0.5,имя:p=>`ω₀ = ${p.w0} рад/с (тяните вбок)`,шаг:0.1},
    {key:'eps',где:()=>[1.4,-1.6],ось:'x',k:0.2,имя:p=>`ε = ${p.eps} рад/с² (тяните вбок)`,шаг:0.05}]})]; });
  ставить('lissajous',function(p){ return [РУЧКИ_П({name:'Амплитуды и сдвиг фаз',ручки:[
    {key:'A1',где:p=>[p.A1,0],имя:p=>`A₁ = ${p.A1} м`,ось:'x',шаг:0.1,set(т,wx){ т.set('A1',Math.abs(wx)); },если:p=>p.mode==='perp'},
    {key:'A2',где:p=>[0,p.A2],имя:p=>`A₂ = ${p.A2} м`,ось:'y',шаг:0.1,set(т,wx,wy){ т.set('A2',Math.abs(wy)); },если:p=>p.mode==='perp'},
    {key:'phi',где:p=>[p.A1*0.7,-p.A2-0.4],ось:'x',k:30,имя:p=>`φ = ${p.phi}° (тяните вбок)`,шаг:1,если:p=>p.mode==='perp'}]})]; });
  ставить('spring',function(p){ return [РУЧКИ_П({name:'Отклонение и жёсткость',ручки:[
    {key:'A',где:p=>[p.A,0.5],имя:p=>`x₀ = ${p.A} м`,ось:'x',шаг:0.1,set(т,wx){ т.set('A',Math.abs(wx)); },если:p=>!p.vert},
    {key:'k',где:p=>[-2,1.3],ось:'x',лог:1,имя:p=>`k = ${p.k} Н/м (тяните вбок)`,шаг:1,если:p=>!p.vert},
    {key:'m',где:p=>[p.A,1.3],ось:'y',лог:0.8,имя:p=>`m = ${p.m} кг (вверх-вниз)`,шаг:0.1,если:p=>!p.vert}]})]; });
  ставить('pendulum',function(p){ return [РУЧКИ_П({name:'Нить и начальный угол',ручки:[
    {key:'th0',где:p=>[p.L*Math.sin(p.th0*Math.PI/180),-p.L*Math.cos(p.th0*Math.PI/180)],имя:p=>`L = ${p.L} м, θ₀ = ${p.th0}°`,шаг:1,
      set(т,wx,wy){ т.set('L',Math.hypot(wx,wy)); т.set('th0',град(Math.atan2(Math.abs(wx),Math.max(1e-6,-wy)))); }}]})]; });
  ставить('damped',function(p){ return [РУЧКИ_П({name:'Отклонение и трение',ручки:[
    {key:'x0',где:p=>[p.x0,0],имя:p=>`x₀ = ${p.x0} м`,ось:'x',шаг:0.05,set(т,wx){ т.set('x0',wx); },если:p=>p.mode!=='forced'},
    {key:'b',где:()=>[0,1.2],ось:'x',k:0.3,имя:p=>`b = ${p.b} кг/с (тяните вбок)`,шаг:0.05},
    {key:'w',где:()=>[0,1.7],ось:'x',k:1,имя:p=>`ω силы = ${p.w} рад/с (тяните вбок)`,шаг:0.05,если:p=>p.mode==='forced'}]})]; });
  ставить('physpend',function(p){ return [РУЧКИ_П({name:'Начальный угол и ось',ручки:[
    {key:'thR',где:p=>{ const d=p.pivot==='any'?Math.min(p.xo,p.Lr/2):p.Lr/2, a=p.thR*Math.PI/180; return [d*Math.sin(a),-d*Math.cos(a)]; },имя:p=>`θ₀ = ${p.thR}°`+(p.pivot==='any'?`, x = ${p.xo} м`:''),шаг:1,
      set(т,wx,wy){ т.set('thR',град(Math.atan2(Math.abs(wx),Math.max(1e-6,-wy)))); if(т.p.pivot==='any') т.set('xo',Math.hypot(wx,wy)); }}]})]; });
  ставить('sound',function(p){ return [РУЧКИ_П({name:'Частота и громкость',ручки:[
    {key:'f',где:()=>[1,1.2],ось:'x',лог:1.5,имя:p=>`f = ${p.f} Гц (тяните вбок)`,шаг:1},
    {key:'L',где:()=>[1,-1.2],ось:'y',k:20,имя:p=>`L = ${p.L} дБ (вверх-вниз)`,шаг:1}]})]; });
  ставить('pipe',function(p){ return [РУЧКИ_П({name:'Длина трубы и резонанс',ручки:[
    {key:'L',где:()=>[10,0],ось:'x',лог:4,имя:p=>`L = ${p.L} м (тяните вбок)`,шаг:0.01},
    {key:'n',где:()=>[5,1.3],ось:'y',k:1,имя:p=>`резонанс n = ${p.n} (вверх-вниз)`,шаг:1}]})]; });
  ставить('atwood',function(p){ return [РУЧКИ_П({name:'Новый груз',ручки:[
    {key:'mnew',где:()=>[0,1.6],ось:'y',лог:1,имя:p=>`масса нового груза ${p.mnew} кг (вверх-вниз)`,шаг:1}]})]; });
})();
