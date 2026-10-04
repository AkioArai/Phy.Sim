/* ===================== РЕАЛЬНЫЙ ГАЗ И ЯВЛЕНИЯ ПЕРЕНОСА (6.3.0) =====================
   vdw — изотермы Ван-дер-Ваальса в приведённых переменных
       π = 8τ/(3φ − 1) − 3/φ²,   π = p/p_кр, φ = V/V_кр, τ = T/T_кр.
   Ниже критической температуры изотерма имеет петлю; настоящая изотерма
   идёт по горизонтали — давлению насыщенного пара π_н, которое находится
   правилом Максвелла: площади петли над и под горизонталью равны,
       ∫ π dφ (от φ_ж до φ_п) = π_н·(φ_п − φ_ж).
   Газ под поршнем медленно сжимают при постоянной температуре: точка идёт
   по изотерме, в куполе появляется жидкость, её доля — по правилу рычага.

   heat — теплопроводность стержня: ∂T/∂t = a·∂²T/∂x², a = λ/(ρc).
   Явная схема со стабильным шагом (r = a·dt/dx² ≤ 0,45). Синусоидальный
   профиль затухает точно как exp(−π²at/L²) — на этом стоит проверка.

   diffusion — броуновское движение. Каждая частица за шаг dt смещается по
   каждой оси на гауссову случайную величину с дисперсией 2D·dt, где
   D = kT/(6πηr) — формула Эйнштейна — Стокса. Генератор с зерном: одна и
   та же картина при одних и тех же настройках. */
Object.assign(SIMS,{
vdw:{
  title:'Реальный газ: изотермы Ван-дер-Ваальса',
  schema:true,
  params:[
    {key:'sub',label:'Вещество',type:'select',default:'co2',
     options:[{v:'co2',t:'углекислый газ: T_кр = 304 К, p_кр = 7,38 МПа'},{v:'water',t:'вода: 647 К, 22,1 МПа'},
              {v:'n2',t:'азот: 126 К, 3,40 МПа'},{v:'he',t:'гелий: 5,2 К, 0,227 МПа'}]},
    {key:'tau',label:'Температура T / T_кр',min:0.75,max:1.3,step:0.01,default:0.9},
    {key:'phi0',label:'Начальный объём V / V_кр',min:1,max:5,step:0.1,default:4},
    {key:'phi1',label:'Конечный объём V / V_кр',min:0.45,max:3,step:0.01,default:0.5},
    {key:'dur',label:'Длительность сжатия',unit:'с',min:4,max:40,step:1,default:14},
    {type:'group',label:'Показывать'},
    {key:'loop',  label:'Петлю Ван-дер-Ваальса и равные площади',type:'check',default:true},
    {key:'dome',  label:'Область двух фаз (купол)',type:'check',default:true},
    {key:'family',label:'Другие изотермы',type:'check',default:true}
  ],
  SUB:{co2:{Tc:304.13,pc:7.377e6,имя:'CO₂'},water:{Tc:647.1,pc:22.064e6,имя:'H₂O'},
       n2:{Tc:126.19,pc:3.396e6,имя:'N₂'},he:{Tc:5.195,pc:0.2275e6,имя:'He'}},
  R:8.314462618,
  в(p){ return this.SUB[p.sub]||this.SUB.co2; },
  pv(τ,φ){ return 8*τ/(3*φ-1)-3/(φ*φ); },
  /* площадь под изотермой Ван-дер-Ваальса от a до b */
  инт(τ,a,b){ return 8*τ/3*Math.log((3*b-1)/(3*a-1))+3*(1/b-1/a); },
  /* корни уравнения π = π_vdW(φ) при φ > 1/3: 3πφ³ − (π + 8τ)φ² + 9φ − 3 = 0 */
  корни(τ,π){
    const f=φ=>3*π*φ*φ*φ-(π+8*τ)*φ*φ+9*φ-3, out=[];
    let a=0.3334, fa=f(a);
    for(let i=1;i<=3000;i++){
      const b=0.3334*Math.pow(60/0.3334,i/3000), fb=f(b);
      if(fa===0) out.push(a);
      else if(fa*fb<0){ let lo=a,hi=b,flo=fa; for(let k=0;k<70;k++){ const m=(lo+hi)/2, fm=f(m); if(flo*fm<=0) hi=m; else { lo=m; flo=fm; } } out.push((lo+hi)/2); }
      a=b; fa=fb;
    }
    return out;
  },
  _м:new Map(),
  /* правило Максвелла: {πн, φж, φп} или null выше критической температуры */
  максвелл(τ){
    if(!(τ<0.99999)) return null;
    const ключ=τ.toFixed(6); if(this._м.has(ключ)) return this._м.get(ключ);
    // экстремумы петли: 4τφ³ = (3φ − 1)²
    const g=φ=>4*τ*φ*φ*φ-(3*φ-1)*(3*φ-1), экс=[];
    let a=0.3334, ga=g(a);
    for(let i=1;i<=2000;i++){ const b=0.3334+i*0.0025, gb=g(b); if(ga*gb<0){ let lo=a,hi=b,glo=ga; for(let k=0;k<60;k++){ const m=(lo+hi)/2, gm=g(m); if(glo*gm<=0) hi=m; else { lo=m; glo=gm; } } экс.push((lo+hi)/2); } a=b; ga=gb; }
    if(экс.length<2){ this._м.set(ключ,null); return null; }
    let lo=Math.max(1e-9,this.pv(τ,экс[0])), hi=this.pv(τ,экс[1]), рез=null;
    for(let k=0;k<80;k++){
      const π=(lo+hi)/2, к=this.корни(τ,π);
      if(к.length<3){ break; }
      const φж=к[0], φп=к[к.length-1], разн=this.инт(τ,φж,φп)-π*(φп-φж);
      рез={πн:π,φж,φп};
      if(разн>0) lo=π; else hi=π;
    }
    this._м.set(ключ,рез); return рез;
  },
  /* настоящая изотерма: горизонталь в куполе */
  πр(τ,φ){ const м=this.максвелл(τ); if(м&&φ>м.φж&&φ<м.φп) return м.πн; return this.pv(τ,φ); },
  доляЖ(τ,φ){ const м=this.максвелл(τ); if(!м) return 0; if(φ<=м.φж) return 1; if(φ>=м.φп) return 0; return (м.φп-φ)/(м.φп-м.φж); },
  φ(p,t){ return p.phi0*Math.pow(p.phi1/p.phi0,clamp(t/p.dur,0,1)); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    s.t+=dt;
    if(s.t>=p.dur){ s.t=p.dur; s.event={type:'end',t:s.t};
      const x=this.доляЖ(p.tau,this.φ(p,s.t));
      s.__stop=p.tau>=1?'Выше критической температуры газ не сжижается: жидкость так и не появилась'
        :`Сжатие окончено: жидкости ${(100*x).toFixed(0)} % по массе`; }
  },
  readouts(s,p){
    const в=this.в(p), φ=this.φ(p,s.t), π=this.πр(p.tau,φ), м=this.максвелл(p.tau), x=this.доляЖ(p.tau,φ);
    const out=[['t',s.t,'с'],['объём V / V_кр',φ,''],['давление p / p_кр',π,''],['давление p',π*в.pc/1e6,'МПа'],
      ['температура T',p.tau*в.Tc,'К']];
    if(м) out.push(['давление насыщенного пара',м.πн*в.pc/1e6,'МПа'],['доля жидкости по массе',100*x,'%']);
    return out;
  },
  graphs:[
    {label:'p(t) — давление при сжатии: горизонталь — кипение наоборот',unit:'МПа',series:['p'],
     get(s,p){ const S=SIMS.vdw; return [S.πр(p.tau,S.φ(p,s.t))*S.в(p).pc/1e6,null]; }},
    {label:'Доля жидкости',unit:'%',series:['жидкость'],get(s,p){ const S=SIMS.vdw; return [100*S.доляЖ(p.tau,S.φ(p,s.t)),null]; }}
  ],
  presets:[
    {name:'Ниже критической: газ сжижается',values:{tau:0.9,phi0:4,phi1:0.5}},
    {name:'Почти критическая: купол сужается',values:{tau:0.98,phi0:3,phi1:0.6}},
    {name:'Выше критической: жидкости не будет',values:{tau:1.15,phi0:4,phi1:0.5}},
    {name:'Холодный пар: длинная горизонталь',values:{tau:0.8,phi0:5,phi1:0.48}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(9.4*PX_PER_M),(H-20)/(5.4*PX_PER_M)),0.002,30);
    return {x:4.5,y:2.45,scale};
  },
  anchors(s,p){ return [{x:0.4,y:0.3},{x:8.6,y:4.4}]; },
  X(φ){ return 0.4+5.6*Math.log(φ/0.36)/Math.log(5.6/0.36); },
  Y(π){ return 0.3+clamp(π,-0.5,3)/2*4; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const X=φ=>this.X(φ), Y=π=>this.Y(π), τ=p.tau, в=this.в(p);
    // оси
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.moveTo(0.4,4.5); ctx.lineTo(0.4,0.3); ctx.lineTo(6.1,0.3); ctx.stroke();
    v.label(ctx,'p / p_кр',0.4,4.5,6,0,ink3); v.label(ctx,'V / V_кр',6.1,0.3,-50,14,ink3);
    for(const φ of [0.5,1,2,4]){ ctx.strokeStyle=line; ctx.beginPath(); ctx.moveTo(X(φ),0.3); ctx.lineTo(X(φ),0.38); ctx.stroke(); v.label(ctx,String(φ).replace('.',','),X(φ),0.3,-6,12,ink3); }
    for(const π of [0.5,1,1.5,2]){ ctx.strokeStyle=line; ctx.beginPath(); ctx.moveTo(0.4,Y(π)); ctx.lineTo(0.48,Y(π)); ctx.stroke(); v.label(ctx,String(π).replace('.',','),0.4,Y(π),-26,0,ink3); }
    const кривая=(f,a,b,n=160)=>{ ctx.beginPath(); for(let i=0;i<=n;i++){ const φ=a*Math.pow(b/a,i/n), π=f(φ); if(!isFinite(π)) continue; i?ctx.lineTo(X(φ),Y(π)):ctx.moveTo(X(φ),Y(π)); } ctx.stroke(); };
    ctx.save(); ctx.beginPath(); ctx.rect(0.4,0.3,5.75,4.25); ctx.clip();
    // купол двух фаз
    if(p.dome){
      const лев=[],прав=[];
      for(let k=0;k<=40;k++){ const t=0.62+k*(0.999-0.62)/40, м=this.максвелл(t); if(м){ лев.push([м.φж,м.πн]); прав.push([м.φп,м.πн]); } }
      if(лев.length){
        ctx.fillStyle=sec; ctx.globalAlpha=.08; ctx.beginPath();
        лев.forEach(([φ,π],i)=>i?ctx.lineTo(X(φ),Y(π)):ctx.moveTo(X(φ),Y(π))); ctx.lineTo(X(1),Y(1));
        for(let i=прав.length-1;i>=0;i--) ctx.lineTo(X(прав[i][0]),Y(прав[i][1]));
        ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
        ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.beginPath();
        лев.forEach(([φ,π],i)=>i?ctx.lineTo(X(φ),Y(π)):ctx.moveTo(X(φ),Y(π))); ctx.lineTo(X(1),Y(1));
        for(let i=прав.length-1;i>=0;i--) ctx.lineTo(X(прав[i][0]),Y(прав[i][1])); ctx.stroke(); ctx.setLineDash([]);
        v.label(ctx,'жидкость + пар',X(1.4),Y(0.25),-40,0,sec);
      }
    }
    if(p.family){ ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(0.9); ctx.globalAlpha=.45;
      for(const t of [0.8,0.85,0.9,0.95,1,1.1,1.2,1.3]) if(Math.abs(t-τ)>0.004) кривая(φ=>this.πр(t,φ),0.37,5.6);
      ctx.globalAlpha=1; }
    // петля и равные площади
    const м=this.максвелл(τ);
    if(м&&p.loop){
      ctx.fillStyle=meas; ctx.globalAlpha=.16;
      const к=this.корни(τ,м.πн), φс=к[1];
      for(const [a,b] of [[м.φж,φс],[φс,м.φп]]){ ctx.beginPath(); ctx.moveTo(X(a),Y(м.πн));
        for(let i=0;i<=60;i++){ const φ=a+(b-a)*i/60; ctx.lineTo(X(φ),Y(this.pv(τ,φ))); } ctx.lineTo(X(b),Y(м.πн)); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha=1;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.3); ctx.setLineDash([v.lw(3),v.lw(3)]); кривая(φ=>this.pv(τ,φ),м.φж,м.φп,80); ctx.setLineDash([]);
      v.label(ctx,'площади равны',X(φс),Y(м.πн),-36,-14,meas);
    }
    // текущая изотерма
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.4); кривая(φ=>this.πр(τ,φ),0.37,5.6,240);
    v.label(ctx,`T = ${(τ*в.Tc).toFixed(τ*в.Tc<20?1:0)} К`,X(5.4),Y(this.πр(τ,5.4)),-60,-12,acc);
    ctx.restore();
    // критическая точка
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(X(1),Y(1),v.lw(3.5),0,7); ctx.fill();
    v.label(ctx,'К',X(1),Y(1),6,-10,dang);
    // состояние
    const φ=this.φ(p,s.t), π=this.πр(τ,φ);
    ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(X(φ),Y(π),v.lw(5),0,7); ctx.fill();
    // цилиндр с поршнем
    const cx0=6.7, cx1=8.5, низ=0.3, h=0.35+3.6*φ/Math.max(p.phi0,1), x=this.доляЖ(τ,φ);
    const долеОбъёма=м&&x>0?x*м.φж/φ:0, hж=h*долеОбъёма;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(cx0,4.4); ctx.lineTo(cx0,низ); ctx.lineTo(cx1,низ); ctx.lineTo(cx1,4.4); ctx.stroke();
    if(hж>0){ ctx.fillStyle=sec; ctx.globalAlpha=.45; ctx.fillRect(cx0,низ,cx1-cx0,hж); ctx.globalAlpha=1; }
    // молекулы пара: плотность ~ 1/φ_п (или 1/φ выше критической)
    const плотн=м&&x>0&&x<1?1/м.φп:1/φ, n=Math.round(clamp(60*плотн,6,90));
    ctx.fillStyle=ink3; let зерно=7;
    const rnd=()=>{ зерно=(зерно*16807)%2147483647; return зерно/2147483647; };
    for(let i=0;i<n;i++){ const xx=cx0+0.08+rnd()*(cx1-cx0-0.16), yy=низ+hж+0.08+rnd()*Math.max(0,h-hж-0.16);
      if(h-hж>0.16){ ctx.beginPath(); ctx.arc(xx+0.04*Math.sin(s.t*3+i),yy,v.lw(1.8),0,7); ctx.fill(); } }
    ctx.fillStyle=ink3; ctx.globalAlpha=.6; ctx.fillRect(cx0,низ+h,cx1-cx0,0.14); ctx.globalAlpha=1;
    ctx.strokeStyle=ink2; ctx.beginPath(); ctx.moveTo((cx0+cx1)/2,низ+h+0.14); ctx.lineTo((cx0+cx1)/2,4.6); ctx.stroke();
    v.label(ctx,τ>=1?'газ (флюид)':x>=1?'жидкость':x>0?'жидкость и насыщенный пар':'пар',cx0,низ,0,14,ink2);
  }
},

heat:{
  title:'Теплопроводность: стержень остывает и прогревается',
  params:[
    {key:'mat',label:'Материал',type:'select',default:'cu',
     options:[{v:'cu',t:'медь: λ = 401 Вт/(м·К)'},{v:'al',t:'алюминий: λ = 237'},{v:'steel',t:'сталь: λ = 50'},{v:'glass',t:'стекло: λ = 1,0'}]},
    {key:'L',label:'Длина стержня L',unit:'м',min:0.05,max:1,step:0.01,default:0.3},
    {key:'init',label:'Опыт',type:'select',default:'step',
     options:[{v:'step',t:'стержень при T₀, концы держат T₁ и T₂'},{v:'sin',t:'синусоида: середина горячее на ΔT'},{v:'spot',t:'нагрели середину, концы теплоизолированы'}]},
    {key:'T0',label:'Начальная температура T₀',unit:'°C',min:-50,max:500,step:1,default:20},
    {key:'T1',label:'Левый конец T₁',unit:'°C',min:-50,max:500,step:1,default:100,если:p=>p.init!=='spot'},
    {key:'T2',label:'Правый конец T₂',unit:'°C',min:-50,max:500,step:1,default:0,если:p=>p.init!=='spot'},
    {key:'dT',label:'Нагрев ΔT',unit:'°C',min:1,max:500,step:1,default:80,если:p=>p.init!=='step'},
    {type:'group',label:'Показывать'},
    {key:'flux',label:'Поток тепла стрелками',type:'check',default:true}
  ],
  MAT:{cu:{λ:401,ρ:8960,c:385,имя:'медь'},al:{λ:237,ρ:2700,c:897,имя:'алюминий'},
       steel:{λ:50,ρ:7850,c:490,имя:'сталь'},glass:{λ:1.0,ρ:2500,c:840,имя:'стекло'}},
  N:101,
  м(p){ return this.MAT[p.mat]||this.MAT.cu; },
  a(p){ const м=this.м(p); return м.λ/(м.ρ*м.c); },
  τ(p){ return p.L*p.L/(Math.PI*Math.PI*this.a(p)); },          // время затухания основной гармоники
  init(p){
    const N=this.N, T=new Float64Array(N);
    for(let i=0;i<N;i++){ const x=i/(N-1);
      if(p.init==='step') T[i]=p.T0;
      else if(p.init==='sin') T[i]=p.T1+(p.T2-p.T1)*x+p.dT*Math.sin(Math.PI*x);
      else T[i]=p.T0+p.dT*Math.exp(-Math.pow((x-0.5)/0.05,2)); }
    if(p.init!=='spot'){ T[0]=p.T1; T[N-1]=p.T2; }
    return {t:0,T,event:null,__stop:null};
  },
  step(s,dt,p){
    const N=this.N, a=this.a(p), dx=p.L/(N-1), шаг=dt*this.τ(p)/3;      // секунда сцены — треть времени затухания
    const n=Math.max(1,Math.ceil(шаг/(0.45*dx*dx/a))), h=шаг/n, r=a*h/(dx*dx);
    const T=s.T, нов=new Float64Array(N);
    for(let k=0;k<n;k++){
      for(let i=1;i<N-1;i++) нов[i]=T[i]+r*(T[i+1]-2*T[i]+T[i-1]);
      if(p.init==='spot'){ нов[0]=T[0]+2*r*(T[1]-T[0]); нов[N-1]=T[N-1]+2*r*(T[N-2]-T[N-1]); }
      else { нов[0]=p.T1; нов[N-1]=p.T2; }
      T.set(нов);
    }
    s.t+=шаг;
  },
  поток(s,p,i){ const N=this.N, dx=p.L/(N-1), j=clamp(i,0,N-2); return -this.м(p).λ*(s.T[j+1]-s.T[j])/dx; },
  readouts(s,p){
    const N=this.N, м=this.м(p);
    let ср=0; for(let i=0;i<N;i++) ср+=s.T[i]*((i===0||i===N-1)?0.5:1); ср/=(N-1);
    return [['t',s.t,'с'],['температура посередине',s.T[(N-1)/2],'°C'],['средняя температура',ср,'°C'],
      ['поток тепла у левого конца q',this.поток(s,p,0)/1000,'кВт/м²'],
      ['температуропроводность a = λ/ρc',this.a(p)*1e6,'мм²/с'],['время затухания τ = L²/π²a',this.τ(p),'с']];
  },
  graphs:[
    {label:'T(t) посередине стержня',unit:'°C',series:['T середины'],get:s=>[s.T[(SIMS.heat.N-1)/2],null]},
    {label:'Поток тепла у левого конца',unit:'кВт/м²',series:['q'],get(s,p){ return [SIMS.heat.поток(s,p,0)/1000,null]; }}
  ],
  presets:[
    {name:'Медь между кипятком и льдом',values:{mat:'cu',init:'step',L:0.3,T0:20,T1:100,T2:0}},
    {name:'Стекло: то же, но в тысячу раз медленнее',values:{mat:'glass',init:'step',L:0.3,T0:20,T1:100,T2:0}},
    {name:'Синусоида гаснет по экспоненте',values:{mat:'al',init:'sin',L:0.2,T1:20,T2:20,dT:80}},
    {name:'Нагретая середина расплывается',values:{mat:'steel',init:'spot',L:0.2,T0:20,dT:300}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-30)/(7.2*PX_PER_M),(H-30)/(5*PX_PER_M)),0.002,30);
    return {x:3,y:2.1,scale};
  },
  anchors(){ return [{x:0,y:0},{x:6,y:4}]; },
  цвет(T,лo,хi){ const k=clamp((T-лo)/Math.max(1e-9,хi-лo),0,1);
    const c=[[40,90,220],[120,90,210],[230,110,60],[220,40,40]], i=Math.min(2,Math.floor(k*3)), f=k*3-i;
    return `rgb(${c[i].map((v,j)=>Math.round(v+(c[i+1][j]-v)*f)).join(',')})`; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line'), meas=v.c('--measure'), acc=v.c('--accent');
    const N=this.N, Ws=6, T=s.T;
    const вс=[p.T0,p.T1,p.T2,p.T0+(p.init==='step'?0:p.dT),p.init==='sin'?Math.max(p.T1,p.T2)+p.dT:-1e9].filter(x=>x>-1e8);
    const лo=Math.min(...вс), хi=Math.max(...вс,лo+1);
    // стержень цветом температуры
    const y0=0.2, hh=0.5;
    for(let i=0;i<N-1;i++){ ctx.fillStyle=this.цвет((T[i]+T[i+1])/2,лo,хi); ctx.fillRect(i/(N-1)*Ws,y0,Ws/(N-1)+0.01,hh); }
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.4); ctx.strokeRect(0,y0,Ws,hh);
    if(p.init!=='spot'){ v.label(ctx,`T₁ = ${p.T1} °C`,0,y0,0,14,ink2); v.label(ctx,`T₂ = ${p.T2} °C`,Ws,y0,-70,14,ink2); }
    else { ctx.fillStyle=ink3; ctx.fillRect(-0.12,y0-0.1,0.12,hh+0.2); ctx.fillRect(Ws,y0-0.1,0.12,hh+0.2); v.label(ctx,'теплоизоляция на концах',0,y0,0,14,ink3); }
    v.label(ctx,`${this.м(p).имя}, L = ${p.L} м`,Ws/2,y0,-50,14,ink3);
    // график T(x)
    const g0=1.2, gh=2.8, Y=Tt=>g0+(Tt-лo)/(хi-лo)*gh;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(0,g0+gh+0.15); ctx.lineTo(0,g0); ctx.lineTo(Ws,g0); ctx.stroke();
    v.label(ctx,'T(x)',0,g0+gh+0.15,6,0,ink3);
    v.label(ctx,`${Math.round(хi)} °C`,0,Y(хi),-46,0,ink3); v.label(ctx,`${Math.round(лo)} °C`,0,Y(лo),-46,0,ink3);
    if(p.init!=='spot'){ // стационарный профиль — прямая
      ctx.strokeStyle=line; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.beginPath(); ctx.moveTo(0,Y(p.T1)); ctx.lineTo(Ws,Y(p.T2)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
    for(let i=0;i<N;i++){ const x=i/(N-1)*Ws; i?ctx.lineTo(x,Y(T[i])):ctx.moveTo(x,Y(T[i])); } ctx.stroke();
    if(p.flux){ // стрелки потока: q = −λ dT/dx
      const qs=[]; for(let k=1;k<8;k++){ const i=Math.round(k/8*(N-1)); qs.push([i,this.поток(s,p,i)]); }
      const М=Math.max(...qs.map(q=>Math.abs(q[1])),1e-9);
      for(const [i,q] of qs){ const x=i/(N-1)*Ws, L=0.55*q/М; if(Math.abs(L)<0.04) continue;
        v.arrow(ctx,x-L/2,y0+hh+0.18,x+L/2,y0+hh+0.18,meas); }
      v.label(ctx,'тепло течёт от горячего к холодному',Ws/2,y0+hh+0.18,-100,-12,meas);
    }
  }
},

diffusion:{
  title:'Броуновское движение и диффузия',
  gridUnit:'мкм',
  params:[
    {key:'liq',label:'Жидкость',type:'select',default:'water',
     options:[{v:'water',t:'вода, η = 1,0 мПа·с'},{v:'mix',t:'вода с глицерином, η = 6 мПа·с'},{v:'glyc',t:'глицерин, η = 1410 мПа·с'}]},
    {key:'T',label:'Температура T',unit:'К',min:273,max:373,step:1,default:293},
    {key:'r',label:'Радиус частицы r',unit:'мкм',min:0.1,max:3,step:0.05,default:0.5},
    {key:'N',label:'Число частиц',min:50,max:2000,step:50,default:600},
    {type:'group',label:'Показывать'},
    {key:'tracks',label:'Путь пяти частиц',type:'check',default:true},
    {key:'ring',label:'Круг радиуса √⟨r²⟩',type:'check',default:true}
  ],
  ETA:{water:1.0e-3,mix:6e-3,glyc:1.41},
  kB:1.380649e-23,
  D(p){ return this.kB*p.T/(6*Math.PI*this.ETA[p.liq]*p.r*1e-6); },     // м²/с
  init(p){ const n=Math.round(p.N); return {t:0,n,xy:new Float64Array(2*n),зерно:20260412,следы:[[],[],[],[],[]],event:null,__stop:null}; },
  гаусс(s){ // Бокс — Мюллер на генераторе с зерном
    const r=()=>{ s.зерно=(s.зерно*48271)%2147483647; return s.зерно/2147483647; };
    let u=0; while(u<1e-12) u=r(); const w=r();
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w);
  },
  step(s,dt,p){
    const σ=Math.sqrt(2*this.D(p)*dt)*1e6;                               // мкм
    for(let i=0;i<2*s.n;i++) s.xy[i]+=σ*this.гаусс(s);
    s.t+=dt;
    if(p.tracks){ for(let k=0;k<5;k++){ s.следы[k].push([s.xy[2*k],s.xy[2*k+1]]); if(s.следы[k].length>1500) s.следы[k].shift(); } }
  },
  ср(s){ let x2=0,r2=0; for(let i=0;i<s.n;i++){ const x=s.xy[2*i], y=s.xy[2*i+1]; x2+=x*x; r2+=x*x+y*y; } return {x2:x2/s.n,r2:r2/s.n}; },
  readouts(s,p){
    const с=this.ср(s);
    return [['t',s.t,'с'],['⟨x²⟩',с.x2,'мкм²'],['⟨r²⟩',с.r2,'мкм²'],
      ['измеренный D = ⟨r²⟩/4t',s.t>0?с.r2/(4*s.t):0,'мкм²/с'],
      ['формула Эйнштейна D = kT/6πηr',this.D(p)*1e12,'мкм²/с']];
  },
  graphs:[
    {label:'⟨r²⟩(t) — растёт линейно',unit:'мкм²',series:['⟨r²⟩','4Dt'],get(s,p){ return [SIMS.diffusion.ср(s).r2,4*SIMS.diffusion.D(p)*1e12*s.t]; }}
  ],
  presets:[
    {name:'Частица 1 мкм в воде (опыт Перрена)',values:{liq:'water',T:293,r:0.5}},
    {name:'Горячая вода: блуждание быстрее',values:{liq:'water',T:360,r:0.5}},
    {name:'Крупная частица почти стоит',values:{liq:'water',T:293,r:3}},
    {name:'В глицерине — в тысячу раз медленнее',values:{liq:'glyc',T:293,r:0.5}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, R=Math.max(2,1.7*Math.sqrt(4*this.D(p)*1e12*20));
    const scale=clamp(Math.min((W-30)/(2*R*PX_PER_M),(H-30)/(2*R*PX_PER_M)),1e-4,300);
    return {x:0,y:0,scale};
  },
  anchors(){ return [{x:0,y:0}]; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3');
    const с=this.ср(s), Rт=Math.sqrt(4*this.D(p)*1e12*s.t);
    ctx.fillStyle=ink3; ctx.globalAlpha=.55;
    for(let i=0;i<s.n;i++){ ctx.beginPath(); ctx.arc(s.xy[2*i],s.xy[2*i+1],v.lw(1.8),0,7); ctx.fill(); }
    ctx.globalAlpha=1;
    if(p.tracks){ ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.2);
      for(const tr of s.следы){ if(tr.length<2) continue; ctx.beginPath(); tr.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke(); } }
    if(p.ring&&s.t>0){
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.beginPath(); ctx.arc(0,0,Math.sqrt(с.r2),0,7); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.arc(0,0,Rт,0,7); ctx.stroke();
      v.label(ctx,`√⟨r²⟩ = ${Math.sqrt(с.r2).toFixed(2)} мкм`,Math.sqrt(с.r2)*0.71,Math.sqrt(с.r2)*0.71,6,-6,meas);
      v.label(ctx,`√(4Dt) по Эйнштейну`,-Rт*0.71,-Rт*0.71,-130,10,sec);
    }
    const Rв=Math.max(2,1.7*Math.sqrt(4*this.D(p)*1e12*20));
    v.label(ctx,`${s.n} частиц радиусом ${p.r} мкм — все стартовали из центра`,-Rв*0.95,Rв*0.9,0,0,ink2);
  }
}
});
