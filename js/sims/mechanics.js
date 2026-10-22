'use strict';
/* ====================== СИМУЛЯЦИЯ: ОДНОМЕРНОЕ ДВИЖЕНИЕ ================== */
/* ТЕЛО ОДНОМЕРНОГО ДВИЖЕНИЯ (9.1.0). Закон движения — один из трёх:
     'a'      — равноускоренное: x = x₀ + v₀τ + aτ²/2;
     'jerk'   — ускорение меняется равномерно (рывок j): x = x₀ + v₀τ + aτ²/2 + jτ³/6;
     'stages' — по участкам: разгон (aᵣ, Tᵣ), равномерно (Tₙ), торможение (aₜ, Tₜ),
                дальше — без ускорения. На каждом участке ускорение постоянно,
                поэтому решение точное, а скорость — ломаная.
   Все три решаются в замкнутом виде — ни шагов интегрирования, ни накопления ошибки. */
const mkBody=(x0,v0,a,t0,law,j,st,al,kp)=>({x0,v0,a,t0,law:law||'a',j:j||0,st:st||null,al:al||0,kp:kp==null?1:kp,таб:null,x:x0,v:0,acc:0,path:0,started:false,landed:false});
/* 9.2.0: закон с сопротивлением a(v) = a₀ − α·|v|ᵏ·sign v. В замкнутом виде не
   решается, поэтому таблица x(τ), v(τ) строится Рунге — Куттой с шагом 2 мс по
   мере надобности и хранится в теле. Без постоянного a₀ сопротивление не может
   развернуть тело: скорость дошла до нуля — тело стоит (при k &lt; 1 это
   случается за конечное время, при k ≥ 1 — только асимптотически). */
const ШАГ_СОПР=0.002;
function ускСопр(b,v){ return b.a-b.al*Math.pow(Math.abs(v),b.kp)*Math.sign(v); }
function кинСопр(b,τ){
  if(!b.таб) b.таб={x:[b.x0],v:[b.v0],стоп:false};
  const T=b.таб, h=ШАГ_СОПР, n=Math.min(Math.ceil(τ/h)+1,600000);
  while(T.x.length<=n){ const i=T.x.length-1, x=T.x[i], v=T.v[i];
    if(T.стоп){ T.x.push(x); T.v.push(0); continue; }
    const k1=ускСопр(b,v), k2=ускСопр(b,v+h/2*k1), k3=ускСопр(b,v+h/2*k2), k4=ускСопр(b,v+h*k3);
    let v1=v+h/6*(k1+2*k2+2*k3+k4), x1=x+h/6*(v+2*(v+h/2*k1)+2*(v+h/2*k2)+(v+h*k3));
    if(b.a===0&&v!==0&&Math.sign(v1)!==Math.sign(v)){ const f=v/(v-v1); x1=x+v*h*f/2; v1=0; T.стоп=true; }
    else if(b.a===0&&Math.abs(v1)<1e-6*Math.max(1,Math.abs(b.v0))){ v1=0; T.стоп=true; }   // докатилось до нуля по касательной
    T.x.push(x1); T.v.push(v1); }
  const i=Math.min(Math.floor(τ/h),T.x.length-2), f=clamp(τ/h-i,0,1);
  const v=T.v[i]+(T.v[i+1]-T.v[i])*f;
  return {x:T.x[i]+(T.x[i+1]-T.x[i])*f, v, a:T.стоп&&i+1>=T.x.length-1&&v===0?0:(v===0&&b.a===0?0:ускСопр(b,v)), уч:-1};
}
function кин1(b,τ){
  if(b.law==='drag') return кинСопр(b,τ);
  if(b.law==='jerk') return {x:b.x0+b.v0*τ+b.a*τ*τ/2+b.j*τ*τ*τ/6, v:b.v0+b.a*τ+b.j*τ*τ/2, a:b.a+b.j*τ, уч:-1};
  if(b.law==='stages'&&b.st){
    let x=b.x0, v=b.v0, ост=τ;
    for(let k=0;k<b.st.length;k++){ const [T,A]=b.st[k], d=Math.min(ост,T);
      if(ост<=T) return {x:x+v*d+A*d*d/2, v:v+A*d, a:A, уч:k};
      x+=v*T+A*T*T/2; v+=A*T; ост-=T; }
    return {x:x+v*ост, v, a:0, уч:b.st.length};
  }
  return {x:b.x0+b.v0*τ+0.5*b.a*τ*τ, v:b.v0+b.a*τ, a:b.a, уч:-1};
}
const УЧАСТКИ1=['разгон','равномерно','торможение','без ускорения'];
/* тело i (0, 1) по параметрам: законы и участки у каждого свои */
function телоКин(p,i){
  const k=i+1, law=p['law'+k]||'a';
  const st=law==='stages'?[[+p['T'+k+'1']||0,+p['A'+k+'1']||0],[+p['T'+k+'2']||0,0],[+p['T'+k+'3']||0,+p['A'+k+'3']||0]]:null;
  return i? mkBody(p.x02,p.v02,p.a2,p.delay,law,p.j2,st,p.al2,p.k2) : mkBody(p.x01,p.v01,p.a1,0,law,p.j1,st,p.al1,p.k1);
}
/* первый момент τ > 0, когда f(τ) меняет знак: шагом и делением пополам */
function первыйКорень(f,τmax,шаг){
  let τ0=1e-6, f0=f(τ0);
  for(let τ=шаг;τ<=τmax+1e-9;τ+=шаг){ const f1=f(τ);
    if(f0===0) return τ0;
    if(Math.sign(f1)!==Math.sign(f0)){ let lo=τ0,hi=τ; for(let i=0;i<60;i++){ const m=(lo+hi)/2; if(Math.sign(f(m))===Math.sign(f0)) lo=m; else hi=m; } return hi; }
    τ0=τ; f0=f1; }
  return NaN;
}

/* наименьший положительный корень y0 + v0τ + aτ²/2 = 0 (время падения на уровень y = 0) */
function fallTime(y0,v0,a){
  if(y0<=0 && v0<=0) return 0;
  if(Math.abs(a)<1e-12) return v0<0 ? -y0/v0 : Infinity;
  const D=v0*v0-2*a*y0; if(D<0) return Infinity;
  const q=Math.sqrt(D);
  const r=[(-v0+q)/a,(-v0-q)/a].filter(t=>t>1e-9).sort((x,y)=>x-y);
  return r.length?r[0]:Infinity;
}

/* точное время касания плоскости x = G: x0 + v0τ + aτ²/2 = G.
   Важно: тело, стартующее прямо С плоскости вверх, не должно «приземляться» в момент старта,
   поэтому нулевой корень отбрасывается — берём первый строго положительный.            */
function groundTau(b,G){
  if(b.law&&b.law!=='a'){                           // закон не квадратичный — ищем корень численно
    if(b.x0<=G+1e-9 && b.v0<=0) return 0;
    return первыйКорень(τ=>кин1(b,τ).x-G,120,0.02); }
  if(b.x0<=G+1e-9 && b.v0<=0) return 0;            // уже лежит и никуда не летит
  const A=0.5*b.a, B=b.v0, C=b.x0-G;
  if(Math.abs(A)<1e-12){ const t=Math.abs(B)<1e-12?NaN:-C/B; return (t>1e-6)?t:NaN; }
  const D=B*B-4*A*C; if(D<0) return NaN;
  const q=Math.sqrt(D);
  const r=[(-B+q)/(2*A),(-B-q)/(2*A)].filter(x=>x>1e-6).sort((x,y)=>x-y);
  return r.length?r[0]:NaN;
}

function bodyAt(b,t){                   // точное решение по закону движения тела
  const tau=t-b.t0;
  if(tau<0) return {x:b.x0, v:0, acc:0, уч:-1, started:false};
  const r=кин1(b,tau);
  return {x:r.x, v:r.v, acc:r.a, уч:r.уч, started:true};
}
/* аналитическое время встречи двух тел (нужно и симуляции, и задачам) */
function meetTime(p){
  const A=0.5*(p.a1-p.a2);
  const d=p.delay;
  // x1(t) = x01 + v01 t + a1 t²/2 ; x2(t) = x02 + v02 (t−d) + a2 (t−d)²/2 , t ≥ d
  const B=p.v01-p.v02+p.a2*d;
  const C=p.x01-p.x02+p.v02*d-0.5*p.a2*d*d;
  const roots=[];
  if(Math.abs(A)<1e-12){ if(Math.abs(B)>1e-12) roots.push(-C/B); }
  else{
    const D=B*B-4*A*C;
    if(D>=0){ const q=Math.sqrt(D); roots.push((-B+q)/(2*A),(-B-q)/(2*A)); }
  }
  const good=roots.filter(t=>t>=Math.max(d,0)-1e-9).sort((a,b)=>a-b);
  return good.length?good[0]:NaN;
}


Object.assign(SIMS,{
kin1d:{
  title:'Одномерное движение',
  params:[
    {key:'bodies',label:'Система',type:'select',default:'1',
     options:[{v:'1',t:'Одно тело'},{v:'2',t:'Два тела'}]},
    {key:'axis',label:'Ось движения',type:'select',default:'x',
     options:[{v:'x',t:'Горизонтальная (x)'},{v:'y',t:'Вертикальная (вверх)'}]},

    {type:'group',label:'Тело 1'},
    {key:'law1',label:'Закон движения',type:'select',default:'a',
     options:[{v:'a',t:'равноускоренно (a = const)'},{v:'stages',t:'по участкам: разгон, равномерно, торможение'},{v:'jerk',t:'ускорение растёт равномерно (рывок)'},{v:'drag',t:'с сопротивлением: a = a₀ − α·vᵏ'}]},
    {key:'x01',label:'Начальная координата x₀',unit:'м',   min:-500,max:500,step:0.5,default:0},
    {key:'v01',label:'Начальная скорость v₀',  unit:'м/с', min:-100,max:100,step:0.5,default:20},
    {key:'a1', label:'Ускорение a (при сопротивлении — постоянная часть a₀)',unit:'м/с²',min:-50, max:50, step:0.1,default:-9.8,если:p=>p.law1!=='stages'},
    {key:'j1', label:'Рывок j = Δa/Δt',        unit:'м/с³',min:-20, max:20, step:0.1,default:1,если:p=>p.law1==='jerk'},
    {key:'al1',label:'Сопротивление α (в a = a₀ − α·vᵏ)',unit:'СИ',min:0,max:50,step:0.001,default:0.5,если:p=>p.law1==='drag'},
    {key:'k1', label:'Показатель k',min:0,max:3,step:0.5,default:1,если:p=>p.law1==='drag'},
    {key:'T11',label:'Разгон: длительность',unit:'с',min:0,max:60,step:0.1,default:4,если:p=>true&&p.law1==='stages'},
    {key:'A11',label:'Разгон: ускорение',unit:'м/с²',min:-50,max:50,step:0.1,default:3,если:p=>true&&p.law1==='stages'},
    {key:'T12',label:'Равномерно: длительность',unit:'с',min:0,max:60,step:0.1,default:3,если:p=>true&&p.law1==='stages'},
    {key:'T13',label:'Торможение: длительность',unit:'с',min:0,max:60,step:0.1,default:3,если:p=>true&&p.law1==='stages'},
    {key:'A13',label:'Торможение: ускорение',unit:'м/с²',min:-50,max:50,step:0.1,default:-4,если:p=>true&&p.law1==='stages'},

    {type:'group',label:'Тело 2',если:p=>p.bodies==='2'},
    {key:'law2',label:'Закон движения',type:'select',default:'a',если:p=>p.bodies==='2',
     options:[{v:'a',t:'равноускоренно (a = const)'},{v:'stages',t:'по участкам: разгон, равномерно, торможение'},{v:'jerk',t:'ускорение растёт равномерно (рывок)'},{v:'drag',t:'с сопротивлением: a = a₀ − α·vᵏ'}]},
    {key:'x02',  label:'Начальная координата x₀',unit:'м',   min:-500,max:500,step:0.5,default:0},
    {key:'v02',  label:'Начальная скорость v₀',  unit:'м/с', min:-100,max:100,step:0.5,default:20},
    {key:'a2',   label:'Ускорение a (при сопротивлении — постоянная часть a₀)',unit:'м/с²',min:-50, max:50, step:0.1,default:-9.8,если:p=>p.law2!=='stages'},
    {key:'j2',   label:'Рывок j = Δa/Δt',        unit:'м/с³',min:-20, max:20, step:0.1,default:1,если:p=>p.bodies==='2'&&p.law2==='jerk'},
    {key:'al2',label:'Сопротивление α (в a = a₀ − α·vᵏ)',unit:'СИ',min:0,max:50,step:0.001,default:0.5,если:p=>p.bodies==='2'&&p.law2==='drag'},
    {key:'k2', label:'Показатель k',min:0,max:3,step:0.5,default:1,если:p=>p.bodies==='2'&&p.law2==='drag'},
    {key:'T21',label:'Разгон: длительность',unit:'с',min:0,max:60,step:0.1,default:4,если:p=>p.bodies==='2'&&p.law2==='stages'},
    {key:'A21',label:'Разгон: ускорение',unit:'м/с²',min:-50,max:50,step:0.1,default:3,если:p=>p.bodies==='2'&&p.law2==='stages'},
    {key:'T22',label:'Равномерно: длительность',unit:'с',min:0,max:60,step:0.1,default:3,если:p=>p.bodies==='2'&&p.law2==='stages'},
    {key:'T23',label:'Торможение: длительность',unit:'с',min:0,max:60,step:0.1,default:3,если:p=>p.bodies==='2'&&p.law2==='stages'},
    {key:'A23',label:'Торможение: ускорение',unit:'м/с²',min:-50,max:50,step:0.1,default:-4,если:p=>p.bodies==='2'&&p.law2==='stages'},
    {key:'delay',label:'Задержка старта Δt',     unit:'с',   min:0,   max:60, step:0.1,default:1},

    {type:'group',label:'Плоскость (опора)'},
    {key:'ground',    label:'Добавить плоскость',type:'check',default:false},
    {key:'gx',        label:'Координата плоскости',unit:'м',min:-500,max:500,step:0.5,default:0},
    {key:'rest',      label:'Коэффициент восстановления e (0 — тело остаётся)',min:0,max:1,step:0.05,default:0},
    {key:'stopGround',label:'Останавливать при касании плоскости',type:'check',default:false},

    {type:'group',label:'Показывать'},
    {key:'tape',  label:'Ленту: положения через равные промежутки времени',type:'check',default:true},
    {key:'tapeDt',label:'Шаг ленты',unit:'с',min:0.1,max:2,step:0.05,default:0.5,если:p=>!!p.tape},
    {key:'arrows',label:'Стрелки скорости и ускорения',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',   label:'Остановить в момент t (0 — не останавливать)',unit:'с',min:0,max:600,step:0.1,default:0},
    {key:'stopMeet',label:'Останавливать при встрече тел (пересечение x(t))',type:'check',default:true}
  ],
  init(p){
    return {t:0, prevD:null, event:null, __stop:null, b:[телоКин(p,0),телоКин(p,1)], лента:[[],[]], следМетка:0};
  },
  step(s,dt,p){
    if(s.event) return;
    const n=(p.bodies==='2')?2:1;
    const t=s.t+dt;

    // событие: заданное время
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ this.setT(s,p,p.tStop,n);
      s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }

    this.setT(s,p,t,n,dt);

    // плоскость: посадка / отскок
    if(p.ground){
      const G=p.gx;
      for(let i=0;i<n;i++){
        const b=s.b[i];
        if(!b.started||b.landed||b.x>=G-1e-9) continue;
        const tau=groundTau(b,G);                 // точное время касания
        const tl=isFinite(tau)?b.t0+tau:t;
        const kh=isFinite(tau)?кин1(b,tau):{v:b.v,a:b.acc}, vHit=kh.v;
        b.x=G; b.v=vHit;
        if(p.rest>0 && Math.abs(vHit)>0.2){       // отскок: тело «перезапускается» от плоскости
          // после отскока закон — равноускоренный с тем ускорением, что было в миг удара
          if(b.law==='drag'){ b.x0=G; b.v0=-p.rest*vHit; b.t0=tl; b.v=b.v0; b.таб=null; }   // сопротивление остаётся
          else { b.x0=G; b.v0=-p.rest*vHit; b.t0=tl; b.v=b.v0; b.a=kh.a; b.law='a'; }
        } else { b.landed=true; b.v=0; }
        if(p.stopGround && !s.event){
          s.t=tl; s.event={t:tl,type:'ground',x:G};
          s.__stop=`Касание плоскости телом ${i+1}: t = ${tl.toFixed(3)} с, v = ${vHit.toFixed(2)} м/с`;
          return;
        }
      }
    }

    // событие: встреча тел (пересечение графиков x(t))
    if(n===2 && p.stopMeet){
      const D=s.b[0].x-s.b[1].x;
      /* Точное равенство нулю у чисел с плавающей точкой практически недостижимо,
         поэтому «встреча» ловится по зазору EPS и по смене знака разности. */
      const EPS=1e-9;
      if(s.prevD!==null && t>p.delay && (Math.abs(D)<EPS || Math.sign(D)!==Math.sign(s.prevD))){
        const квадр=(p.law1||'a')==='a'&&(p.law2||'a')==='a';
        let tm=квадр?meetTime(p):NaN;
        if(!isFinite(tm)||tm<t-dt-1e-6||tm>t+1e-6){
          // закон не квадратичный (или корень вне шага) — делим шаг пополам по разности координат
          const b1=телоКин(p,0), b2=телоКин(p,1), d=τ=>bodyAt(b1,τ).x-bodyAt(b2,τ).x;
          let lo=t-dt, hi=t; const s0=Math.sign(d(lo));
          for(let k=0;k<60;k++){ const m=(lo+hi)/2; if(Math.sign(d(m))===s0) lo=m; else hi=m; }
          tm=hi;
        }
        this.setT(s,p,tm,n);
        const x=s.b[0].x;
        s.event={t:tm,type:'meet',x};
        s.__stop=`Встреча тел: t = ${tm.toFixed(3)} с, координата ${x.toFixed(2)} м`;
        return;
      }
      s.prevD=D;
    }
  },
  setT(s,p,t,n,dt){
    for(let i=0;i<2;i++){
      const b=s.b[i];
      if(b.landed){ b.v=0; b.acc=0; continue; }
      const r=bodyAt(b,t);
      if(i<n && r.started && dt) b.path += Math.abs(r.v)*dt;   // пройденный путь
      b.x=r.x; b.v=r.v; b.acc=r.started?r.acc:0; b.уч=r.уч; b.started=r.started;
    }
    // лента: положение каждые tapeDt секунд (точно на метках времени)
    const Δ=Math.max(0.05,+p.tapeDt||0.5);
    while(s.следМетка<=t+1e-9){ const tk=s.следМетка;
      for(let i=0;i<n;i++){ const b=s.b[i]; if(tk<b.t0-1e-9) continue;
        const r=b.landed?{x:b.x}:bodyAt(b,tk); s.лента[i].push(r.x); if(s.лента[i].length>400) s.лента[i].shift(); }
      s.следМетка=+(tk+Δ).toFixed(6); }
    s.t=t;
  },
  anchors(s,p){
    const n=(p.bodies==='2')?2:1, out=[{x:0,y:0}];
    const P=(x)=>p.axis==='y'?{x:0,y:x}:{x,y:0};
    for(let i=0;i<n;i++){ out.push(P(s.b[i].x)); out.push(P(s.b[i].x0)); }
    if(s.event&&s.event.type==='meet') out.push(P(s.event.x));
    return out;
  },
  readouts(s,p){
    const n=(p.bodies==='2')?2:1, r=[['t',s.t,'с']];
    for(let i=0;i<n;i++){
      const b=s.b[i], tag=n===2?` ${i+1}`:'';
      r.push([`x${tag}`,b.x,'м'],[`v${tag}`,b.v,'м/с'],[`a${tag}`,b.started?b.acc:0,'м/с²'],
             [`путь${tag}`,b.path,'м'],[`перемещение${tag}`,b.x-b.x0,'м']);
      if(b.law==='stages'&&b.started&&!b.landed) r.push([`участок${tag}`,УЧАСТКИ1[Math.max(0,b.уч)],'']);
    }
    return r;
  },
  graphs:[
    {label:'x(t) — координата', unit:'м',
     get:(s,p)=>[s.b[0].x, p.bodies==='2'?s.b[1].x:null]},
    {label:'v(t) — скорость (наклон x(t))', unit:'м/с', наклон:0,
     get:(s,p)=>[s.b[0].v, p.bodies==='2'?s.b[1].v:null]},
    {label:'a(t) — ускорение (наклон v(t))', unit:'м/с²', наклон:1,
     get:(s,p)=>[s.b[0].started?s.b[0].acc:0, p.bodies==='2'?(s.b[1].started?s.b[1].acc:0):null]}
  ],
  presets:[
    {name:'Свободное падение с высоты 20 м',
     values:{bodies:'1',axis:'y',law1:'a',x01:20,v01:0,a1:-9.8,ground:true,gx:0,rest:0,stopGround:true,tStop:0}},
    {name:'Два мяча вверх с интервалом 1 с',
     values:{bodies:'2',axis:'y',law1:'a',law2:'a',x01:0,v01:20,a1:-9.8,x02:0,v02:20,a2:-9.8,delay:1,
             stopMeet:true,ground:false,tStop:0}},
    {name:'Торможение: v₀ = 20 м/с, a = −4 м/с²',
     values:{bodies:'1',axis:'x',law1:'a',x01:0,v01:20,a1:-4,ground:false,tStop:0,stopMeet:false}},
    {name:'Мяч прыгает: e = 0,7',
     values:{bodies:'1',axis:'y',law1:'a',x01:10,v01:0,a1:-9.8,ground:true,gx:0,rest:0.7,stopGround:false,tStop:12}},
    {name:'Поездка: разгон 4 с, 6 с равномерно, торможение',
     values:{bodies:'1',axis:'x',law1:'stages',x01:0,v01:0,T11:4,A11:3,T12:6,T13:4,A13:-3,ground:false,tStop:14,stopMeet:false}},
    {name:'Догонялки: автобус равномерно, машина разгоняется с места',
     values:{bodies:'2',axis:'x',law1:'a',x01:40,v01:12,a1:0,law2:'stages',x02:0,v02:0,T21:8,A21:3,T22:30,T23:0,A23:0,delay:0,stopMeet:true,ground:false,tStop:0}},
    {name:'Рывок: ускорение нарастает от нуля',
     values:{bodies:'1',axis:'x',law1:'jerk',x01:0,v01:0,a1:0,j1:1.5,ground:false,tStop:8,stopMeet:false}},
    {name:'Торможение, при котором ускорение равно α√v',
     values:{bodies:'1',axis:'x',law1:'drag',x01:0,v01:25,a1:0,al1:0.5,k1:0.5,ground:false,tStop:0,stopMeet:false}},
    {name:'Падение с сопротивлением воздуха ∝ v²',
     values:{bodies:'2',axis:'y',law1:'drag',x01:150,v01:0,a1:-9.8,al1:0.05,k1:2,law2:'a',x02:150,v02:0,a2:-9.8,delay:0,ground:true,gx:0,rest:0,stopGround:false,stopMeet:false,tStop:8}},
    {name:'Встречные: разгон против торможения',
     values:{bodies:'2',axis:'x',law1:'stages',x01:0,v01:0,T11:5,A11:2,T12:20,T13:0,A13:0,law2:'a',x02:150,v02:-18,a2:1.5,delay:0,stopMeet:true,ground:false,tStop:0}}
  ],
  /* вписываем весь «прогон»: считаем координаты обоих тел до события/до 12 с */
  fit(p,vp){
    const n=(p.bodies==='2')?2:1;
    const bodies=[телоКин(p,0),телоКин(p,1)];
    let T = p.tStop>0 ? p.tStop : 12;
    const квадр=(p.law1||'a')==='a'&&(p.law2||'a')==='a';
    if(n===2 && p.stopMeet){ const tm=квадр?meetTime(p):первыйКорень(τ=>bodyAt(bodies[0],τ).x-bodyAt(bodies[1],τ).x,60,0.05);
      if(isFinite(tm)&&tm>0) T=Math.min(T,tm*1.15); }
    if(p.ground){ for(let i=0;i<n;i++){ const tg=groundTau(bodies[i],p.gx);
      if(isFinite(tg)&&tg>0) T=Math.min(T,bodies[i].t0+tg*1.1); } }
    T=clamp(T,0.5,60);
    let lo=Infinity, hi=-Infinity;
    for(let i=0;i<n;i++){
      for(let k=0;k<=80;k++){
        const x=bodyAt(bodies[i],T*k/80).x;
        if(p.ground&&x<p.gx) continue;
        lo=Math.min(lo,x); hi=Math.max(hi,x);
      }
    }
    if(p.ground){ lo=Math.min(lo,p.gx); hi=Math.max(hi,p.gx); }
    if(!isFinite(lo)){ lo=-10; hi=10; }
    let span=Math.max(hi-lo,2)*1.3, c=(lo+hi)/2;
    const W=(vp&&vp.W)||460, H=(vp&&vp.H)||320;
    const px=(p.axis==='y'?H:W)-60;
    const scale=clamp(px/(span*PX_PER_M),0.002,30);
    return p.axis==='y' ? {x:0,y:c,scale} : {x:c,y:0,scale};
  },
  /* масштаб стрелок: столько пикселей на 1 м/с и на 1 м/с² */
  СТР:{v:3, a:9},
  /* дорожка тела i: смещение от оси в пикселях, поперёк оси */
  дорожка(p,i){ return (p.bodies==='2')?(i?-22:22):0; },
  draw(ctx,s,v,p){
    const vert=p.axis==='y', n=(p.bodies==='2')?2:1;
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger');
    const пк=1/ppm();                                     // метров на пиксель
    // точка на оси x со сдвигом поперёк оси на d пикселей
    const P=(x,d)=>vert?[d*пк,x]:[x,d*пк];
    const L=1e4;
    // ось движения
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.5);
    ctx.beginPath();
    if(vert){ ctx.moveTo(0,-L); ctx.lineTo(0,L); } else { ctx.moveTo(-L,0); ctx.lineTo(L,0); }
    ctx.stroke();
    v.label(ctx,vert?'x, м (вверх)':'x, м',...P(0,0),vert?8:-16,vert?-14:16,ink3);

    // плоскость (опора)
    if(p.ground){
      const G=p.gx, w=40*пк;
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2.5);
      ctx.beginPath();
      if(vert){ ctx.moveTo(-w,G); ctx.lineTo(w,G); } else { ctx.moveTo(G,-w); ctx.lineTo(G,w); }
      ctx.stroke();
      v.label(ctx,'плоскость',...(vert?[w,G]:[G,w]),vert?-64:6,vert?14:-6,ink3);
    }

    const cols=[v.c('--accent'),v.c('--second')];
    for(let i=0;i<n;i++){
      const b=s.b[i], d=this.дорожка(p,i), c=cols[i];
      // дорожка тела
      if(n===2){ ctx.strokeStyle=c; ctx.globalAlpha=.18; ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(...P(-L,d)); ctx.lineTo(...P(L,d)); ctx.stroke(); ctx.globalAlpha=1; }
      // лента: где тело было через равные промежутки — густо, значит медленно
      if(p.tape){ ctx.fillStyle=c;
        s.лента[i].forEach((x,k,м)=>{ ctx.globalAlpha=0.25+0.55*(k+1)/м.length; const [qx,qy]=P(x,d);
          ctx.beginPath(); ctx.arc(qx,qy,v.lw(2.2),0,7); ctx.fill(); });
        ctx.globalAlpha=1; }
      // начальная точка
      const [sx,sy]=P(b.x0,d);
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.moveTo(...P(b.x0,d-9)); ctx.lineTo(...P(b.x0,d+9)); ctx.stroke();
      // перемещение (от x0 до x)
      ctx.strokeStyle=c; ctx.globalAlpha=.3; ctx.lineWidth=v.lw(4);
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(...P(b.x,d)); ctx.stroke(); ctx.globalAlpha=1;
      // тело
      const [cx,cy]=P(b.x,d);
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(cx,cy,v.lw(7),0,7); ctx.fill();
      // стрелки: скорость (над телом) и ускорение (под ним)
      if(p.arrows&&b.started&&!b.landed){
        const ось=(x,dd)=>P(x,dd);
        if(Math.abs(b.v)>0.02){ const e=ось(b.x+b.v*this.СТР.v*пк,d); v.arrow(ctx,cx,cy,e[0],e[1],meas); }
        if(Math.abs(b.acc)>0.02){ const [ax,ay]=ось(b.x,d+(i?-12:12)), e=ось(b.x+b.acc*this.СТР.a*пк,d+(i?-12:12));
          ctx.globalAlpha=.85; v.arrow(ctx,ax,ay,e[0],e[1],dang); ctx.globalAlpha=1; }
      }
      v.label(ctx,n===2?`тело ${i+1}`:'тело',cx,cy,10,i?14:-14,c);
      if(!b.started&&b.t0>s.t+1e-9) v.label(ctx,`старт через ${(b.t0-s.t).toFixed(1)} с`,cx,cy,10,i?28:-28,ink3);
      else if(b.law==='stages'&&!b.landed) v.label(ctx,УЧАСТКИ1[Math.max(0,b.уч)],cx,cy,10,i?28:-28,ink3);
    }
    // точка встречи
    if(s.event&&s.event.type==='meet'){
      const [ex,ey]=P(s.event.x,0);
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
      ctx.beginPath(); ctx.arc(ex,ey,v.lw(14),0,7); ctx.stroke();
      v.label(ctx,`встреча: t=${s.event.t.toFixed(2)} с, x=${s.event.x.toFixed(2)} м`,ex,ey,16,-18,meas);
    }
  },
  /* ---- инструменты модели: тело берут прямо на сцене ----
     «Положение» — выделить тело и вести его вдоль оси (или стрелками клавиатуры),
     «Скорость» и «Ускорение» — тянуть стрелку от тела: её длина и есть величина. */
  tools(p){ const S1=this;
    const ось=p=>p.axis==='y';
    const наОси=(т)=>ось(т.p)?т.wy:т.wx;                       // координата указателя вдоль оси
    const экранТела=(т,i)=>{ const b=т.s.b[i], d=S1.дорожка(т.p,i);
      return т.toScreen(...(ось(т.p)?[d/т.ppm,b.x]:[b.x,d/т.ppm])); };
    const экранСтарта=(т,i)=>{ const d=S1.дорожка(т.p,i), x=т.p[i?'x02':'x01'];
      return т.toScreen(...(ось(т.p)?[d/т.ppm,x]:[x,d/т.ppm])); };
    const ближайшее=(т)=>{ const n=т.p.bodies==='2'?2:1; let луч=-1, мин=26;
      for(let i=0;i<n;i++) for(const q of [экранТела(т,i),экранСтарта(т,i)]){ const d=Math.hypot(q[0]-т.px,q[1]-т.py); if(d<мин){ мин=d; луч=i; } }
      return луч; };
    const ключA=(p,i)=>{ const k=i+1, law=p['law'+k]||'a'; return law==='stages'?'A'+k+'1':(i?'a2':'a1'); };
    const кольцо=(o,т,i,цв,толщ)=>{ const [x,y]=экранТела(т,i); const [wx,wy]=toWorld(x,y);
      o.strokeStyle=цв; o.lineWidth=VIEW.lw(толщ); o.beginPath(); o.arc(wx,wy,VIEW.lw(13),0,7); o.stroke(); };
    const стрелкаИнстр=(т,i,кл,масшт,dd)=>({
      down(т){ const i=ближайшее(т); if(i<0) return false; т.выбор.i=i; т.выбор.кл=кл(т.p,i); return true; },
      move(т){ const i=т.выбор.i, b=т.s.b[i], [ex,ey]=экранТела(т,i), сдвиг=ось(т.p)?(ey-т.py):(т.px-ex);
        т.set(т.выбор.кл, сдвиг/масшт); },
      key(k,т){ const i=т.выбор.i; if(i==null) return false; const ключ=кл(т.p,i), шаг=т.shift?5:0.5, зн={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[k];
        if(!зн) return false; т.set(ключ,(+т.p[ключ]||0)+зн*шаг); return true; } });
    const скор=стрелкаИнстр(null,0,(p,i)=>i?'v02':'v01',this.СТР.v);
    const уск=стрелкаИнстр(null,0,ключA,this.СТР.a);
    const рис=(т,o,какой)=>{ const n=т.p.bodies==='2'?2:1, под=т.px!=null?ближайшее(т):-1;
      for(let i=0;i<n;i++){ if(i===т.выбор.i) кольцо(o,т,i,css('--accent'),2); else if(i===под) кольцо(o,т,i,css('--ink-3'),1.2); }
      const i=т.выбор.i; if(i==null||i>=n) return;
      const [x,y]=экранТела(т,i), [wx,wy]=toWorld(x,y);
      const подпись=какой==='x'?`x₀ = ${т.p[i?'x02':'x01']} м`:какой==='v'?`v₀ = ${т.p[i?'v02':'v01']} м/с`:`a = ${т.p[ключA(т.p,i)]} м/с²`;
      VIEW.label(o,подпись,wx,wy,16,i?30:-30,css('--accent')); };
    return [
      {id:'pos', name:'Положение тела', cursor:'ew-resize',
       icon:'<circle cx="12" cy="12" r="3.2"/><path d="M3 12h4.5M16.5 12H21M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5"/>',
       hint:'щёлкните тело и ведите вдоль оси; стрелки клавиатуры сдвигают выделенное (с Shift — крупнее)',
       down(т){ const i=ближайшее(т); if(i<0){ т.выбор.i=null; return false; } т.выбор.i=i; return true; },
       move(т){ const i=т.выбор.i; т.set(i?'x02':'x01',наОси(т)); },
       key(k,т){ const i=т.выбор.i; if(i==null) return false; const кл=i?'x02':'x01', шаг=т.shift?5:0.5;
         const зн=ось(т.p)?{ArrowUp:1,ArrowDown:-1}[k]:{ArrowRight:1,ArrowLeft:-1}[k]; if(!зн) return false;
         т.set(кл,(+т.p[кл]||0)+зн*шаг); return true; },
       overlay(o,т){ рис(т,o,'x'); }},
      Object.assign({id:'vel', name:'Скорость стрелкой', cursor:'crosshair',
       icon:'<circle cx="5" cy="12" r="2.4"/><path d="M8 12h12M16.5 8.5 20 12l-3.5 3.5"/>',
       hint:'потяните от тела: длина стрелки — начальная скорость; влево — отрицательная',
       overlay(o,т){ рис(т,o,'v'); }},скор),
      Object.assign({id:'acc', name:'Ускорение стрелкой', cursor:'crosshair',
       icon:'<circle cx="5" cy="12" r="2.4"/><path d="M8 12h12M16.5 8.5 20 12l-3.5 3.5M12 9v6M15 9v6"/>',
       hint:'потяните от тела: длина стрелки — ускорение (при участках — ускорение разгона)',
       overlay(o,т){ рис(т,o,'a'); }},уск)
    ];
  }
},

/* ---------------- ДВУМЕРНОЕ ДВИЖЕНИЕ: движение снаряда ---------------- */
proj2d:{
  title:'Баллистика: движение снаряда',
  params:[
    {key:'bodies',label:'Система',type:'select',default:'1',
     options:[{v:'1',t:'Одно тело'},{v:'2',t:'Два тела'},{v:'3',t:'Три тела'}]},

    {type:'group',label:'Тело 1'},
    {key:'x01',label:'Начальная координата x₀',unit:'м',  min:-20000,max:20000,step:0.5,default:0},
    {key:'y01',label:'Начальная высота y₀',    unit:'м',  min:0,    max:1000,step:0.5,default:0},
    {key:'v01',label:'Начальная скорость v₀',  unit:'м/с',min:0,    max:400, step:0.5,default:25},
    {key:'a01',label:'Угол броска θ',          unit:'°',  min:0,    max:360, step:1,  default:45},

    {type:'group',label:'Тело 2',если:p=>p.bodies!=='1'},
    {key:'x02',  label:'Начальная координата x₀',unit:'м',  min:-20000,max:20000,step:0.5,default:40},
    {key:'y02',  label:'Начальная высота y₀',    unit:'м',  min:0,    max:1000,step:0.5,default:25},
    {key:'v02',  label:'Начальная скорость v₀',  unit:'м/с',min:0,    max:400, step:0.5,default:0},
    {key:'a02',  label:'Угол броска θ',          unit:'°',  min:0,    max:360, step:1,  default:0},
    {key:'delay',label:'Задержка старта Δt',     unit:'с',  min:0,    max:60,  step:0.1,default:0},

    {type:'group',label:'Тело 3',если:p=>p.bodies==='3'},
    {key:'x03',   label:'Начальная координата x₀',unit:'м',  min:-20000,max:20000,step:0.5,default:0},
    {key:'y03',   label:'Начальная высота y₀',    unit:'м',  min:0,    max:1000,step:0.5,default:0},
    {key:'v03',   label:'Начальная скорость v₀',  unit:'м/с',min:0,    max:400, step:0.5,default:25},
    {key:'a03',   label:'Угол броска θ',          unit:'°',  min:0,    max:360, step:1,  default:60},
    {key:'delay3',label:'Задержка старта Δt',     unit:'с',  min:0,    max:60,  step:0.1,default:0},

    /* Третья ось (3.2.0). Бросок — плоское движение, пока ничто не толкает
       тело вбок. Азимут поворачивает плоскость броска, боковой ветер даёт
       ускорение вдоль z — и видно, что три проекции движутся независимо:
       x и z равномерно (или равноускоренно под ветром), y — как всегда. */
    {type:'group',label:'Третья ось z'},
    {key:'d3',  label:'Показать в пространстве (оси x, y, z)',type:'check',default:false},
    {key:'az1', label:'Азимут броска φ (от оси x к оси z)',unit:'°',min:-90,max:90,step:1,default:30,если:p=>!!p.d3},
    {key:'az2', label:'Азимут тела 2',unit:'°',min:-90,max:90,step:1,default:0,если:p=>!!p.d3&&p.bodies!=='1'},
    {key:'az3', label:'Азимут тела 3',unit:'°',min:-90,max:90,step:1,default:-30,если:p=>!!p.d3&&p.bodies==='3'},
    {key:'wind',label:'Боковой ветер: ускорение вдоль z',unit:'м/с²',min:-10,max:10,step:0.1,default:0,если:p=>!!p.d3},

    {type:'group',label:'Общее'},
    {key:'ay',  label:'Ускорение вдоль оси y (равно −g)',unit:'м/с²',min:-50,max:50,step:0.1,default:-9.8},
    {key:'comp',  label:'Проекции скорости vx и vy',type:'check',default:true},
    {key:'guides',label:'Высшая точка и дальность (тело 1)',type:'check',default:true},
    {key:'tape2', label:'Положения через равные промежутки времени',type:'check',default:false},
    {key:'trail', label:'Траектории',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',   label:'Остановить в момент t (0 — не останавливать)',unit:'с',min:0,max:600,step:0.1,default:0},
    {key:'stopLand',label:'Останавливать при падении на землю',type:'check',default:true},
    {key:'stopHit', label:'Останавливать при встрече любых двух тел (попадание)',type:'check',default:true},
    {key:'stopTop', label:'Останавливать в высшей точке тела 1',type:'check',default:false},
    {key:'stopPerp',label:'Останавливать, когда скорости тел 1 и 2 перпендикулярны',type:'check',default:false,если:p=>p.bodies!=='1'},
    {key:'hitR',    label:'Радиус попадания',unit:'м',min:0.1,max:20,step:0.1,default:0.6}
  ],

  presets:[
    {name:'Классический бросок: v₀ = 25, θ = 45°',
     values:{bodies:'1',x01:0,y01:0,v01:25,a01:45,ay:-9.8,stopLand:true,tStop:0}},
    {name:'Два угла — одна дальность (30° и 60°)',
     values:{bodies:'2',x01:0,y01:0,v01:25,a01:30,x02:0,y02:0,v02:25,a02:60,delay:0,
             ay:-9.8,stopLand:false,stopHit:false,tStop:0}},
    {name:'«Попади в обезьяну» (цель 40 м, 25 м)',
     values:{bodies:'2',x01:0,y01:0,v01:35,a01:32,x02:40,y02:25,v02:0,a02:0,delay:0,
             ay:-9.8,stopHit:true,hitR:0.6,stopLand:true,tStop:0}},
    {name:'Три угла при одной скорости: 30°, 45° и 60°',
     values:{bodies:'3',x01:0,y01:0,v01:25,a01:30,x02:0,y02:0,v02:25,a02:45,delay:0,x03:0,y03:0,v03:25,a03:60,delay3:0,
             ay:-9.8,stopLand:false,stopHit:false,tStop:0,tape2:true,comp:false}},
    {name:'Три тела: бросок, падение и горизонтальный полёт',
     values:{bodies:'3',x01:0,y01:0,v01:30,a01:50,x02:30,y02:40,v02:0,a02:0,delay:0,x03:0,y03:40,v03:12,a03:0,delay3:0,
             ay:-9.8,stopLand:false,stopHit:true,hitR:0.8,tStop:0,tape2:true,comp:false}},
    {name:'Горизонтальный бросок с высоты 45 м',
     values:{bodies:'1',x01:0,y01:45,v01:15,a01:0,ay:-9.8,stopLand:true,tStop:0}},
    {name:'Без тяготения: ускорение по y = 0',
     values:{bodies:'1',x01:0,y01:0,v01:25,a01:45,ay:0,stopLand:false,tStop:8}},
    {name:'В пространстве: бросок под азимутом 30°',
     values:{bodies:'1',x01:0,y01:0,v01:25,a01:45,d3:true,az1:30,wind:0,ay:-9.8,stopLand:true,tStop:0}},
    {name:'В пространстве: боковой ветер сносит мяч',
     values:{bodies:'1',x01:0,y01:0,v01:25,a01:45,d3:true,az1:0,wind:3,ay:-9.8,stopLand:true,tStop:0}}
  ],
  /* параметры тела i (0/1) */
  /* число тел и параметры тела i (0, 1, 2) */
  n(p){ return Math.max(1,Math.min(3,+p.bodies||1)); },
  bodyP(p,i){ const az=p.d3?([p.az1,p.az2,p.az3][i])||0:0;
    if(i===2) return {x0:p.x03,y0:p.y03,v0:p.v03,ang:p.a03,t0:p.delay3||0,az};
    return i? {x0:p.x02,y0:p.y02,v0:p.v02,ang:p.a02,t0:p.delay,az}
            : {x0:p.x01,y0:p.y01,v0:p.v01,ang:p.a01,t0:0,az}; },
  /* ключи параметров тела i — для инструментов */
  ключи(i){ return [['x01','y01','v01','a01'],['x02','y02','v02','a02'],['x03','y03','v03','a03']][i]; },
  rotate3d(p){ return !!p.d3; },
  rot0:{yaw:-0.75,pitch:0.4},
  /* точное положение тела i в момент t (с посадкой на землю y = 0) */
  posOf(p,i,t){
    const b=this.bodyP(p,i), tau=t-b.t0, a=p.ay, aw=p.d3?(p.wind||0):0;
    /* горизонтальная скорость v₀cosθ раскладывается по азимуту на x и z;
       без третьей оси азимут равен нулю и всё как в плоском броске */
    const th=b.ang*Math.PI/180, ф=b.az*Math.PI/180, vh=b.v0*Math.cos(th);
    const vx=vh*Math.cos(ф), vz0=vh*Math.sin(ф), vy0=b.v0*Math.sin(th);
    const tf=fallTime(b.y0,vy0,a);                       // время до земли (может быть ∞)
    if(tau<=0) return {x:b.x0,y:b.y0,z:0,vx:0,vy:0,vz:0,started:false,landed:false,tf,tLand:b.t0+tf};
    const tt=Math.min(tau,tf);
    const landed=tau>=tf;
    return {x:b.x0+vx*tt, y:Math.max(0,b.y0+vy0*tt+0.5*a*tt*tt), z:vz0*tt+0.5*aw*tt*tt,
            vx:landed?0:vx, vy:landed?0:(vy0+a*tt), vz:landed?0:(vz0+aw*tt),
            started:true, landed, tf, tLand:b.t0+tf};
  },
  /* касательное и нормальное ускорение, радиус кривизны траектории тела i:
     aτ = (a·v)/v, aₙ = |a × v|/v, R = v²/aₙ */
  кривизна(p,i,t){ const r=this.posOf(p,i,t), a=[0,p.ay,p.d3?(p.wind||0):0], v=[r.vx,r.vy,r.vz], vm=Math.hypot(v[0],v[1],v[2]);
    if(!r.started||r.landed||vm<1e-9) return {at:0,an:0,R:Infinity};
    const at=(a[0]*v[0]+a[1]*v[1]+a[2]*v[2])/vm, am=Math.hypot(a[0],a[1],a[2]), an=Math.sqrt(Math.max(0,am*am-at*at));
    return {at,an,R:an>1e-12?vm*vm/an:Infinity}; },
  dist(p,t,i,j){ i=i||0; j=j==null?1:j; const A=this.posOf(p,i,t), B=this.posOf(p,j,t); return Math.hypot(A.x-B.x,A.y-B.y,A.z-B.z); },
  пары(p){ const n=this.n(p); return n===3?[[0,1],[0,2],[1,2]]:n===2?[[0,1]]:[]; },

  init(p){
    const R=[0,1,2].map(i=>this.posOf(p,i,0));
    return {t:0, trails:R.map(r=>[[r.x,r.y,0]]), hmax:R.map(r=>r.y),
            landed:[false,false,false], event:null, __stop:null, лента:[[],[],[]], следМетка:0};
  },
  put(s,p,t,n){
    s.t=t;
    for(let i=0;i<n;i++){
      const r=this.posOf(p,i,t);
      if(r.y>s.hmax[i]) s.hmax[i]=r.y;
      const tr=s.trails[i], l=tr[tr.length-1];
      if(r.started && (!l || Math.hypot(r.x-l[0],r.y-l[1],r.z-(l[2]||0))>0.02)) tr.push([r.x,r.y,r.z]);
      if(tr.length>6000) tr.shift();
    }
    // положения через равные промежутки (по 0,5 с) — видно, что по x шаги равные
    while(s.следМетка<=t+1e-9){ const tk=s.следМетка;
      for(let i=0;i<n;i++){ const b=this.bodyP(p,i); if(tk<b.t0-1e-9) continue; const r=this.posOf(p,i,tk); s.лента[i].push([r.x,r.y,r.z]); if(s.лента[i].length>300) s.лента[i].shift(); }
      s.следМетка=+(tk+0.5).toFixed(6); }
  },
  step(s,dt,p){
    if(s.event) return;
    const n=this.n(p), t=s.t+dt;

    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ this.put(s,p,p.tStop,n);
      s.event={t:p.tStop,type:'time'}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }

    // встреча (попадание) любых двух тел: |rᵢ − rⱼ| ≤ радиуса попадания
    if(n>=2 && p.stopHit){
      let лучш=null;
      for(const [i,j] of this.пары(p)){
        const d0=this.dist(p,s.t,i,j), d1=this.dist(p,t,i,j);
        if(d1<=p.hitR && d0>p.hitR){
          let lo=s.t, hi=t;
          for(let k=0;k<50;k++){ const m=(lo+hi)/2; if(this.dist(p,m,i,j)<=p.hitR) hi=m; else lo=m; }
          if(!лучш||hi<лучш.t) лучш={t:hi,i,j};
        }
      }
      if(лучш){
        this.put(s,p,лучш.t,n);
        const A=this.posOf(p,лучш.i,лучш.t);
        s.event={t:лучш.t,type:'hit',x:A.x,y:A.y,i:лучш.i,j:лучш.j};
        s.__stop=`Встреча тел ${лучш.i+1} и ${лучш.j+1}: t = ${лучш.t.toFixed(3)} с, точка (${A.x.toFixed(2)}; ${A.y.toFixed(2)}) м`;
        return;
      }
    }

    // высшая точка тела 1: vy меняет знак с плюса на минус
    if(p.stopTop){ const a=this.posOf(p,0,s.t), b=this.posOf(p,0,t);
      if(a.started&&b.started&&!b.landed&&a.vy>0&&b.vy<=0){ let lo=s.t, hi=t;
        for(let k=0;k<50;k++){ const m=(lo+hi)/2; if(this.posOf(p,0,m).vy>0) lo=m; else hi=m; }
        this.put(s,p,hi,n); const r=this.posOf(p,0,hi); s.event={t:hi,type:'top',x:r.x,y:r.y};
        s.__stop=`Тело 1 в высшей точке: t = ${hi.toFixed(3)} с, H = ${r.y.toFixed(2)} м, радиус кривизны ${this.кривизна(p,0,hi).R.toFixed(2)} м`; return; } }
    // скорости тел 1 и 2 становятся перпендикулярными: скалярное произведение меняет знак
    if(n>=2&&p.stopPerp){ const пр=τ=>{ const A=this.posOf(p,0,τ), B=this.posOf(p,1,τ); return (A.started&&B.started&&!A.landed&&!B.landed)?A.vx*B.vx+A.vy*B.vy+A.vz*B.vz:NaN; };
      const f0=пр(s.t), f1=пр(t);
      if(isFinite(f0)&&isFinite(f1)&&f0!==0&&Math.sign(f0)!==Math.sign(f1)){ let lo=s.t, hi=t;
        for(let k=0;k<50;k++){ const m=(lo+hi)/2; if(Math.sign(пр(m))===Math.sign(f0)) lo=m; else hi=m; }
        this.put(s,p,hi,n); s.event={t:hi,type:'perp'};
        s.__stop=`Скорости тел 1 и 2 перпендикулярны: t = ${hi.toFixed(3)} с, расстояние ${this.dist(p,hi).toFixed(2)} м`; return; } }

    // падение на землю
    for(let i=0;i<n;i++){
      const r=this.posOf(p,i,t);
      if(r.started && r.landed && !s.landed[i]){
        s.landed[i]=true;
        if(!(r.tf>1e-9)) continue;                   // лежит на земле с самого начала (мишень) — это не падение
        const tl=r.tLand;
        this.put(s,p,Math.min(t,tl),n);
        if(p.stopLand){
          const L=this.posOf(p,i,tl);
          s.event={t:tl,type:'land',x:L.x,y:0,i};
          s.__stop=`Тело ${i+1} упало: t = ${tl.toFixed(3)} с, x = ${L.x.toFixed(2)} м`;
          return;
        }
      }
    }
    this.put(s,p,t,n);
  },

  anchors(s,p){
    const n=this.n(p), out=[{x:0,y:0}];
    for(let i=0;i<n;i++){
      const b=this.bodyP(p,i), r=this.posOf(p,i,s.t);
      const th=b.ang*Math.PI/180, vx=b.v0*Math.cos(th), vy0=b.v0*Math.sin(th);
      out.push({x:b.x0,y:b.y0},{x:r.x,y:r.y});
      if(vy0>0&&p.ay<0) out.push({x:b.x0-vx*vy0/p.ay, y:b.y0-vy0*vy0/(2*p.ay)});   // высшая точка
      out.push({x:this.posOf(p,i,r.tLand).x, y:0});                       // точка падения
    }
    if(s.event&&s.event.type==='hit') out.push({x:s.event.x,y:s.event.y});
    return out;
  },
  readouts(s,p){
    const n=this.n(p), out=[['t',s.t,'с']];
    for(let i=0;i<n;i++){
      const r=this.posOf(p,i,s.t), tag=n>=2?` ${i+1}`:'';
      const v=Math.hypot(r.vx,r.vy,r.vz);
      const ang=v>1e-6?(Math.atan2(r.vy,Math.hypot(r.vx,r.vz))*180/Math.PI+360)%360:0;
      out.push([`x${tag}`,r.x,'м'],[`y${tag}`,r.y,'м']);
      if(p.d3) out.push([`z${tag}`,r.z,'м']);
      out.push([`v${tag}`,v,'м/с'],[`vx${tag}`,r.vx,'м/с'],[`vy${tag}`,r.vy,'м/с']);
      if(p.d3) out.push([`vz${tag}`,r.vz,'м/с']);
      out.push([`угол v${tag}`,ang,'°'],
               [`H max${tag}`,s.hmax[i],'м'],
               [`t полёта${tag}`,r.tLand,
                 isFinite(r.tLand)?'с':'не приземлится: ускорение направлено вверх']);
    }
    { const К=this.кривизна(p,0,s.t), tag=n>=2?' 1':'';
      out.push([`aτ${tag} (вдоль скорости)`,К.at,'м/с²'],[`aₙ${tag} (поперёк скорости)`,К.an,'м/с²'],
        [`радиус кривизны${tag}`,isFinite(К.R)?К.R:NaN,'м']); }
    if(n===2) out.push(['расстояние',this.dist(p,s.t),'м']);
    if(n===3) for(const [i,j] of this.пары(p)) out.push([`расстояние ${i+1}–${j+1}`,this.dist(p,s.t,i,j),'м']);
    return out;
  },
  graphs:[
    {label:'y(t) — высота', unit:'м', get(s,p){ const t=s.t;
      const S=SIMS.proj2d, n=S.n(p); return [S.posOf(p,0,t).y, n>1?S.posOf(p,1,t).y:null, n>2?S.posOf(p,2,t).y:null]; }},
    {label:'x(t) — дальность', unit:'м', get(s,p){ const t=s.t;
      const S=SIMS.proj2d, n=S.n(p); return [S.posOf(p,0,t).x, n>1?S.posOf(p,1,t).x:null, n>2?S.posOf(p,2,t).x:null]; }},
    {label:'v<sub>x</sub>(t) — горизонтальная проекция', unit:'м/с', наклон:1, get(s,p){ const t=s.t;
      const S=SIMS.proj2d, n=S.n(p); return [S.posOf(p,0,t).vx, n>1?S.posOf(p,1,t).vx:null, n>2?S.posOf(p,2,t).vx:null]; }},
    {label:'v<sub>y</sub>(t) — вертикальная проекция', unit:'м/с', наклон:0, get(s,p){ const t=s.t;
      const S=SIMS.proj2d, n=S.n(p); return [S.posOf(p,0,t).vy, n>1?S.posOf(p,1,t).vy:null, n>2?S.posOf(p,2,t).vy:null]; }}
  ],
  /* ---- инструменты модели ----
     «Старт» — взять тело за точку старта и перенести; «Бросок» — потянуть от
     точки старта: длина стрелки — скорость, направление — угол (как рогатка),
     и сразу виден пунктир будущей траектории. Стрелки клавиатуры: ←/→ — угол,
     ↑/↓ — скорость выделенного тела. */
  ПИКС:3,                                                       // пикселей стрелки на 1 м/с
  tools(p){ if(p.d3) return []; const S1=this;
    const экран=(т,i)=>{ const b=S1.bodyP(т.p,i); return т.toScreen(b.x0,b.y0); };
    const ближ=(т)=>{ let луч=-1, мин=28; for(let i=0;i<S1.n(т.p);i++){
      for(const q of [экран(т,i), (r=>т.toScreen(r.x,r.y))(S1.posOf(т.p,i,т.s.t))]){ const d=Math.hypot(q[0]-т.px,q[1]-т.py); if(d<мин){ мин=d; луч=i; } } }
      return луч; };
    const кольца=(o,т)=>{ const под=т.px!=null?ближ(т):-1;
      for(let i=0;i<S1.n(т.p);i++){ const b=S1.bodyP(т.p,i);
        if(i===т.выбор.i||i===под){ o.strokeStyle=i===т.выбор.i?css('--accent'):css('--ink-3'); o.lineWidth=VIEW.lw(i===т.выбор.i?2:1.2);
          o.beginPath(); o.arc(b.x0,b.y0,VIEW.lw(12),0,7); o.stroke(); } } };
    // пунктир будущей траектории тела i по текущим параметрам
    const пунктир=(o,т,i)=>{ const b=S1.bodyP(т.p,i); const tl=S1.posOf(т.p,i,0).tLand, T=isFinite(tl)?tl:8;
      o.strokeStyle=css('--accent'); o.globalAlpha=.55; o.lineWidth=VIEW.lw(1.4); o.setLineDash([VIEW.lw(5),VIEW.lw(4)]); o.beginPath();
      for(let k=0;k<=80;k++){ const r=S1.posOf(т.p,i,b.t0+T*k/80); k?o.lineTo(r.x,r.y):o.moveTo(r.x,r.y); }
      o.stroke(); o.setLineDash([]); o.globalAlpha=1; };
    return [
      {id:'start', name:'Старт тела', cursor:'move',
       icon:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21"/>',
       hint:'возьмите тело за точку старта и перенесите; высота не опустится ниже земли',
       down(т){ const i=ближ(т); т.выбор.i=i<0?null:i; return i>=0; },
       move(т){ const к=S1.ключи(т.выбор.i); т.set(к[0],т.wx); т.set(к[1],Math.max(0,т.wy)); },
       key(k,т){ const i=т.выбор.i; if(i==null) return false; const к=S1.ключи(i), ш=т.shift?5:0.5;
         const d={ArrowLeft:[-ш,0],ArrowRight:[ш,0],ArrowUp:[0,ш],ArrowDown:[0,-ш]}[k]; if(!d) return false;
         т.set(к[0],т.p[к[0]]+d[0]); т.set(к[1],Math.max(0,т.p[к[1]]+d[1])); return true; },
       overlay(o,т){ кольца(o,т); const i=т.выбор.i; if(i==null||i>=S1.n(т.p)) return; const b=S1.bodyP(т.p,i);
         VIEW.label(o,`x₀ = ${b.x0} м, y₀ = ${b.y0} м`,b.x0,b.y0,14,-18,css('--accent')); }},
      {id:'aim', name:'Бросок стрелкой', cursor:'crosshair',
       icon:'<circle cx="5" cy="19" r="2.4"/><path d="M7 17 19 5M13 5h6v6"/>',
       hint:'потяните от точки старта: длина — скорость, направление — угол; ←/→ меняют угол, ↑/↓ — скорость',
       down(т){ const i=ближ(т); т.выбор.i=i<0?null:i; return i>=0; },
       move(т){ const i=т.выбор.i, [sx,sy]=экран(т,i), dx=т.px-sx, dy=sy-т.py, к=S1.ключи(i);
         т.set(к[2],Math.hypot(dx,dy)/S1.ПИКС); т.set(к[3],((Math.atan2(dy,dx)*180/Math.PI)+360)%360); },
       key(k,т){ const i=т.выбор.i; if(i==null) return false; const к=S1.ключи(i), ш=т.shift?5:1;
         if(k==='ArrowLeft'||k==='ArrowRight'){ т.set(к[3],(т.p[к[3]]+(k==='ArrowRight'?-ш:ш)+360)%360); return true; }
         if(k==='ArrowUp'||k==='ArrowDown'){ т.set(к[2],Math.max(0,т.p[к[2]]+(k==='ArrowUp'?ш*0.5:-ш*0.5))); return true; }
         return false; },
       overlay(o,т){ кольца(o,т); const i=т.выбор.i; if(i==null||i>=S1.n(т.p)) return; const b=S1.bodyP(т.p,i);
         const th=b.ang*Math.PI/180, L=b.v0*S1.ПИКС/т.ppm;
         VIEW.arrow(o,b.x0,b.y0,b.x0+L*Math.cos(th),b.y0+L*Math.sin(th),css('--accent'));
         пунктир(o,т,i);
         VIEW.label(o,`v₀ = ${b.v0} м/с, θ = ${b.ang}°`,b.x0+L*Math.cos(th),b.y0+L*Math.sin(th),10,-12,css('--accent')); }}
    ];
  },
  fit(p,vp){
    if(p.d3) return this.fit3(p,vp);
    const n=this.n(p);
    let T=p.tStop>0?p.tStop:0;
    for(let i=0;i<n;i++){ const tl=this.posOf(p,i,0).tLand; if(isFinite(tl)) T=Math.max(T,tl); }
    T=clamp(T||8,0.5,120);
    let x0=0,x1=0,y1=1;
    for(let i=0;i<n;i++) for(let k=0;k<=80;k++){
      const r=this.posOf(p,i,T*k/80);
      x0=Math.min(x0,r.x); x1=Math.max(x1,r.x); y1=Math.max(y1,r.y);
    }
    const spanX=Math.max(x1-x0,2)*1.2, spanY=Math.max(y1,2)*1.35;
    const W=(vp&&vp.W)||460, H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-50)/(spanY*PX_PER_M)),0.002,30);
    /* Высокий узкий кадр (телефон стоя): по ширине влезает впритык, а по
       высоте остаётся много места — земля оказывалась посередине, и низ
       экрана пустовал. Прижимаем землю к нижнему краю с полями в 44 px. */
    const k=PX_PER_M*scale, hM=H/k;
    return {x:(x0+x1)/2, y:Math.max(y1*0.42, hM/2-44/k), scale};
  },
  /* ---------- бросок в пространстве ---------- */
  охват(p){
    const n=this.n(p);
    let T=p.tStop>0?p.tStop:0;
    for(let i=0;i<n;i++){ const tl=this.posOf(p,i,0).tLand; if(isFinite(tl)) T=Math.max(T,tl); }
    T=clamp(T||8,0.5,120);
    let R=2;
    for(let i=0;i<n;i++) for(let k=0;k<=80;k++){ const r=this.posOf(p,i,T*k/80); R=Math.max(R,Math.abs(r.x),r.y,Math.abs(r.z)); }
    return {T,R};
  },
  fit3(p,vp){
    const W=(vp&&vp.W)||460, H=(vp&&vp.H)||320, {R}=this.охват(p);
    const scale=clamp(Math.min(W,H)/(2.5*R*PX_PER_M),0.002,30);
    return {x:0,y:R*0.25,scale};
  },
  draw3(ctx,s,v,p){
    const n=this.n(p), cols=[v.c('--accent'),v.c('--second'),v.c('--third')||v.c('--danger')];
    const ink3=v.c('--ink-3'), line=v.c('--line'), meas=v.c('--measure');
    const {R}=this.охват(p), пр=v.p3();
    const P=(x,y,z)=>{ const q=пр(x,-z,y); return [q[0],q[1]]; };   // мир: y вверх; проекция: z вверх
    const L=R*1.1;
    // земля — сетка на плоскости x–z
    ctx.strokeStyle=line; ctx.lineWidth=v.lw(1); ctx.globalAlpha=.6;
    const шаг=Math.pow(10,Math.floor(Math.log10(L/2)))*(L/Math.pow(10,Math.floor(Math.log10(L/2)))>10?5:1);
    for(let k=-L;k<=L+1e-9;k+=шаг){
      let a=P(k,0,-L), b=P(k,0,L); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
      a=P(-L,0,k); b=P(L,0,k); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
    }
    ctx.globalAlpha=1;
    // оси
    for(const [x,y,z,им] of [[L,0,0,'x, м'],[0,L,0,'y, м'],[0,0,L,'z, м']]){
      const o=P(0,0,0), e=P(x,y,z); v.arrow(ctx,o[0],o[1],e[0],e[1],ink3); v.label(ctx,им,e[0],e[1],6,-6,ink3);
    }
    for(let i=0;i<n;i++){
      const r=this.posOf(p,i,s.t), tr=s.trails[i];
      if(p.trail&&tr.length>1){
        // тень траектории на земле: видно, что сверху движение — прямая (без ветра)
        ctx.strokeStyle=cols[i]; ctx.globalAlpha=.3; ctx.lineWidth=v.lw(1.4); ctx.setLineDash([v.lw(4),v.lw(3)]);
        ctx.beginPath(); tr.forEach((q,k)=>{ const a=P(q[0],0,q[2]||0); k?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]); }); ctx.stroke();
        ctx.setLineDash(EMPTY_DASH); ctx.globalAlpha=1;
        ctx.lineWidth=v.lw(2); ctx.beginPath(); tr.forEach((q,k)=>{ const a=P(q[0],q[1],q[2]||0); k?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]); }); ctx.stroke();
      }
      const B=P(r.x,r.y,r.z), G=P(r.x,0,r.z);
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(2),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(B[0],B[1]); ctx.lineTo(G[0],G[1]); ctx.stroke(); ctx.setLineDash(EMPTY_DASH); ctx.globalAlpha=1;
      if(r.started&&!r.landed){
        const k=R*0.18/Math.max(1,Math.hypot(r.vx,r.vy,r.vz));
        const E=P(r.x+r.vx*k,r.y+r.vy*k,r.z+r.vz*k);
        v.arrow(ctx,B[0],B[1],E[0],E[1],meas);
        if(p.comp){
          for(const [dx,dy,dz,им,зн] of [[r.vx,0,0,'vx',r.vx],[0,r.vy,0,'vy',r.vy],[0,0,r.vz,'vz',r.vz]]){
            if(Math.abs(зн)<0.05) continue;
            const e=P(r.x+dx*k,r.y+dy*k,r.z+dz*k); v.arrow(ctx,B[0],B[1],e[0],e[1],cols[i]);
            v.label(ctx,`${им} = ${зн.toFixed(1)}`,e[0],e[1],4,-6,cols[i]);
          }
        }
      }
      ctx.fillStyle=cols[i]; ctx.beginPath(); ctx.arc(B[0],B[1],v.lw(6),0,7); ctx.fill();
      ctx.fillStyle=ink3; ctx.globalAlpha=.5; ctx.beginPath(); ctx.arc(G[0],G[1],v.lw(3.5),0,7); ctx.fill(); ctx.globalAlpha=1;
      if(r.landed) v.label(ctx,`упал: x = ${r.x.toFixed(1)} м, z = ${r.z.toFixed(1)} м`,B[0],B[1],10,-12,cols[i]);
    }
    const o=P(-L,0,-L);
    v.label(ctx,'протяните по сцене, чтобы повернуть · пунктир на земле — тень траектории',o[0],o[1],0,18,ink3);
  },
  draw(ctx,s,v,p){
    if(p.d3) return this.draw3(ctx,s,v,p);
    const n=this.n(p);
    const cols=[v.c('--accent'),v.c('--second'),v.c('--third')||v.c('--danger')];
    let T=0; for(let i=0;i<n;i++){ const tl=this.posOf(p,i,0).tLand; if(isFinite(tl)) T=Math.max(T,tl); }
    if(!T) T=Math.max(s.t,8);
    const span=Math.max(Math.abs(this.posOf(p,0,T).x-p.x01),20);

    // земля и оси координат
    ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(-span*0.35,0); ctx.lineTo(span*1.35,0); ctx.stroke();
    ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1);
    for(let k=-span*0.35;k<span*1.35;k+=Math.max(span/45,0.4)){
      const d=Math.max(span/80,0.25);
      ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k-d,-d); ctx.stroke();
    }
    const H=Math.max(...s.hmax.slice(0,n),span*0.3);
    v.arrow(ctx,0,0,span*1.3,0,v.c('--ink-3'));          // ось X
    v.arrow(ctx,0,0,0,H*1.25,v.c('--ink-3'));            // ось Y
    v.label(ctx,'x, м',span*1.3,0,6,14,v.c('--ink-3'));
    v.label(ctx,'y, м',0,H*1.25,8,-6,v.c('--ink-3'));

    for(let i=0;i<n;i++){
      const b=this.bodyP(p,i), r=this.posOf(p,i,s.t);
      const th=b.ang*Math.PI/180, vx0=b.v0*Math.cos(th), vy0=b.v0*Math.sin(th);
      // траектория
      if(p.trail&&v.quality!=='low'&&s.trails[i].length>1){
        ctx.strokeStyle=cols[i]; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
        s.trails[i].forEach((q,k)=>k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke();
      }
      // старт: высота и угол
      if(b.y0>0){
        ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(4)]);
        ctx.beginPath(); ctx.moveTo(b.x0,0); ctx.lineTo(b.x0,b.y0); ctx.stroke(); ctx.setLineDash([]);
        v.label(ctx,`y₀ = ${b.y0} м`,b.x0,b.y0/2,6,0,v.c('--ink-3'));
      }
      if(b.v0>0){
        const rr=Math.max(span*0.07,0.8);
        ctx.strokeStyle=cols[i]; ctx.lineWidth=v.lw(1.3); ctx.globalAlpha=.8;
        ctx.beginPath(); ctx.arc(b.x0,b.y0,rr,0,th,th<0); ctx.stroke(); ctx.globalAlpha=1;
        v.label(ctx,`θ${n>=2?(i+1):''} = ${b.ang}°`,
          b.x0+rr*1.1*Math.cos(th/2), b.y0+rr*1.1*Math.sin(th/2), 6,-4, cols[i]);
      }
      // высшая точка и дальность (для тела 1)
      if(p.guides&&i===0&&vy0>0&&p.ay<0){
        const ax=b.x0-vx0*vy0/p.ay, ay=b.y0-vy0*vy0/(2*p.ay), lx=this.posOf(p,0,r.tLand).x;
        ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(4)]);
        ctx.beginPath(); ctx.moveTo(ax,0); ctx.lineTo(ax,ay); ctx.moveTo(0,ay); ctx.lineTo(ax,ay); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=v.c('--measure'); ctx.beginPath(); ctx.arc(ax,ay,v.lw(3.5),0,7); ctx.fill();
        v.label(ctx,`H = ${ay.toFixed(2)} м`,ax,ay,8,-10,v.c('--measure'));
        const yy=-Math.max(H*0.1,0.6);
        v.arrow(ctx,b.x0,yy,lx,yy,v.c('--measure'));
        v.label(ctx,`L = ${(lx-b.x0).toFixed(2)} м`,(b.x0+lx)/2,yy,-24,14,v.c('--measure'));
      }
      // векторы скорости
      const k=Math.max(span/(Math.max(b.v0,1)*6),0.04);
      if(r.started&&!r.landed){
        if(p.comp&&(Math.abs(r.vx)+Math.abs(r.vy))>0.05){
          v.arrow(ctx,r.x,r.y,r.x+r.vx*k,r.y,cols[i]);
          v.arrow(ctx,r.x,r.y,r.x,r.y+r.vy*k,cols[i]);
          ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
          ctx.beginPath(); ctx.moveTo(r.x+r.vx*k,r.y); ctx.lineTo(r.x+r.vx*k,r.y+r.vy*k);
          ctx.lineTo(r.x,r.y+r.vy*k); ctx.stroke(); ctx.setLineDash([]);
          v.label(ctx,`vx = ${r.vx.toFixed(1)}`,r.x+r.vx*k,r.y,4,14,cols[i]);
          v.label(ctx,`vy = ${r.vy.toFixed(1)}`,r.x,r.y+r.vy*k,8,-4,cols[i]);
        }
        v.arrow(ctx,r.x,r.y,r.x+r.vx*k,r.y+r.vy*k,v.c('--measure'));
        v.label(ctx,`v = ${Math.hypot(r.vx,r.vy).toFixed(1)} м/с`,r.x+r.vx*k,r.y+r.vy*k,8,-10,v.c('--measure'));
      }
      if(p.tape2&&s.лента){ ctx.fillStyle=cols[i]; ctx.globalAlpha=.55;
        for(const q of s.лента[i]){ ctx.beginPath(); ctx.arc(q[0],q[1],v.lw(2.4),0,7); ctx.fill(); } ctx.globalAlpha=1; }
      ctx.fillStyle=cols[i]; ctx.beginPath(); ctx.arc(r.x,r.y,v.lw(6),0,7); ctx.fill();
      if(n>=2) v.label(ctx,`тело ${i+1}`,r.x,r.y,10,-12,cols[i]);
    }
    // событие
    if(s.event&&(s.event.type==='hit'||s.event.type==='land')){
      ctx.strokeStyle=v.c('--measure'); ctx.lineWidth=v.lw(1.8);
      ctx.beginPath(); ctx.arc(s.event.x,s.event.y||0,v.lw(11),0,7); ctx.stroke();
      if(s.event.type==='hit')
        v.label(ctx,`попадание: t = ${s.event.t.toFixed(2)} с`,s.event.x,s.event.y,14,-16,v.c('--measure'));
    }
  }
}
,

/* ---------------- МЕТОД РАЗМЕРНОСТЕЙ: МАЯТНИК (9.1.0) ----------------
   Догадка T = k·Lᵃ·mᵇ·gᶜ проверяется двумя способами сразу. Справа —
   весы размерностей: показатели при метре, килограмме и секунде у левой
   и правой частей; совпасть они должны все три. Слева — настоящий маятник
   (sin θ без упрощений), его период мерится по прохождению нижней точки.
   При верной догадке k = T/(LᵃmᵇGᶜ) остаётся одним и тем же, как ни крути
   длину, массу и g; при неверной — плывёт. */
dims:{
  title:'Метод размерностей: период маятника',
  params:[
    {type:'group',label:'Маятник'},
    {key:'L',  label:'Длина нити L',unit:'м',min:0.1,max:4,step:0.05,default:1},
    {key:'m',  label:'Масса груза m',unit:'кг',min:0.05,max:5,step:0.05,default:0.5},
    {key:'g',  label:'Ускорение свободного падения g',unit:'м/с²',min:1,max:25,step:0.1,default:9.8},
    {key:'th0',label:'Начальный угол θ₀',unit:'°',min:2,max:60,step:1,default:8},
    {type:'group',label:'Догадка T = k · Lᵃ · mᵇ · gᶜ'},
    {key:'a',label:'Показатель при длине a',unit:'',min:-2,max:2,step:0.5,default:1},
    {key:'b',label:'Показатель при массе b',unit:'',min:-2,max:2,step:0.5,default:0},
    {key:'c',label:'Показатель при g, c',unit:'',min:-2,max:2,step:0.5,default:0}
  ],
  /* показатели размерности правой части при метре, килограмме, секунде;
     [g] = м·с⁻², поэтому g даёт и метры, и секунды */
  степени(p){ return {м:p.a+p.c, кг:p.b, с:-2*p.c}; },
  сходится(p){ const d=this.степени(p); return Math.abs(d.м)<1e-9&&Math.abs(d.кг)<1e-9&&Math.abs(d.с-1)<1e-9; },
  догадка(p){ return Math.pow(p.L,p.a)*Math.pow(p.m,p.b)*Math.pow(p.g,p.c); },
  ед(p){ const d=this.степени(p), ч=x=>String(x).replace('.',',').replace('-','−'), out=[];
    for(const [k,v] of [['м',d.м],['кг',d.кг],['с',d.с]]) if(Math.abs(v)>1e-9) out.push(v===1?k:`${k}^${ч(v)}`);
    return out.join('·')||'безразмерно'; },
  init(p){ return {t:0,th:p.th0*Math.PI/180,w:0,пересечения:[],T:NaN,event:null}; },
  step(s,dt,p){ const n=4, h=dt/n, k=p.g/p.L;
    for(let i=0;i<n;i++){ const f=(th,w)=>[w,-k*Math.sin(th)];
      const a1=f(s.th,s.w), a2=f(s.th+h/2*a1[0],s.w+h/2*a1[1]), a3=f(s.th+h/2*a2[0],s.w+h/2*a2[1]), a4=f(s.th+h*a3[0],s.w+h*a3[1]);
      const th1=s.th+h/6*(a1[0]+2*a2[0]+2*a3[0]+a4[0]), w1=s.w+h/6*(a1[1]+2*a2[1]+2*a3[1]+a4[1]);
      // прохождение нижней точки (в любую сторону) — полпериода между соседними
      if((s.th<0)!==(th1<0)&&th1!==s.th){ const tc=s.t+h*(-s.th)/(th1-s.th); s.пересечения.push(tc);
        if(s.пересечения.length>1) s.T=2*(tc-s.пересечения[s.пересечения.length-2]);
        if(s.пересечения.length>6) s.пересечения.shift(); }
      s.th=th1; s.w=w1; s.t+=h; } },
  readouts(s,p){ const X=this.догадка(p), ok=this.сходится(p);
    return [['t',s.t,'с'],['угол θ',s.th*180/Math.PI,'°'],['период T (измерен)',s.T,'с'],
      ['Lᵃ·mᵇ·gᶜ',X,this.ед(p)],['k = T / (Lᵃ·mᵇ·gᶜ)',ok?s.T/X:NaN,''],
      ['размерности',ok?'сходятся':'не сходятся','']]; },
  graphs:[{label:'θ(t) — угол',unit:'°',series:['θ'],get(s){ return [s.th*180/Math.PI,null]; }}],
  presets:[
    {name:'Догадка «T ∝ L» — размерности не сходятся',values:{L:1,m:0.5,g:9.8,th0:8,a:1,b:0,c:0}},
    {name:'Верная догадка a = ½, b = 0, c = −½',values:{L:1,m:0.5,g:9.8,th0:8,a:0.5,b:0,c:-0.5}},
    {name:'Та же догадка на Луне (g = 1,6)',values:{L:1,m:0.5,g:1.6,th0:8,a:0.5,b:0,c:-0.5}},
    {name:'Большой размах: k уже не 2π',values:{L:1,m:0.5,g:9.8,th0:60,a:0.5,b:0,c:-0.5}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, h=p.L*1.15+0.4, w=Math.max(p.L*1.1,0.8)+h*1.25;
    const scale=clamp(Math.min((W-40)/(w*PX_PER_M),(H-40)/(h*PX_PER_M)),0.05,30);
    return {x:(-Math.max(p.L*1.1,0.8)/2+h*0.6), y:-h/2+0.25, scale}; },
  anchors(s,p){ return [{x:0,y:0},{x:p.L*Math.sin(s.th),y:-p.L*Math.cos(s.th)}]; },
  draw(ctx,s,v,p){
    const пк=1/ppm(), acc=v.c('--accent'), ink=v.c('--ink'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok'), dang=v.c('--danger');
    const y0=0, bx=p.L*Math.sin(s.th), by=y0-p.L*Math.cos(s.th), r=Math.max(0.035,0.06*Math.cbrt(p.m))*Math.min(1,p.L)+3*пк;
    // подвес
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(-0.25*Math.max(1,p.L*0.4),y0); ctx.lineTo(0.25*Math.max(1,p.L*0.4),y0); ctx.stroke();
    ctx.lineWidth=v.lw(1); for(let k=-4;k<=4;k++){ const x=k*0.06*Math.max(1,p.L*0.4); ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x+0.04,y0+0.05); ctx.stroke(); }
    // вертикаль и дуга размаха
    ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.beginPath(); ctx.moveTo(0,y0); ctx.lineTo(0,y0-p.L-0.08); ctx.stroke();
    const A=p.th0*Math.PI/180; ctx.beginPath(); ctx.arc(0,y0,p.L,-Math.PI/2-A,-Math.PI/2+A); ctx.stroke(); ctx.setLineDash([]);
    // нить и груз
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(0,y0); ctx.lineTo(bx,by); ctx.stroke();
    ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(bx,by,r,0,7); ctx.fill();
    v.label(ctx,`L = ${p.L} м`,bx/2,y0-p.L/2,12,0,ink3);
    v.label(ctx,`m = ${p.m} кг`,bx,by,14,14,ink3);
    // весы размерностей
    const ш=22*пк, X0=Math.max(p.L*1.1,0.8)*0.55+0.25, Y0=y0-1.4*ш, д=this.степени(p), ок=this.сходится(p);
    const txt=(t,x,y,col,px,al,b)=>v.text(ctx,t,x,y,col,px,al,b);
    txt('Размерности',X0,Y0,ink2,12,'left',true);
    txt('[T]',X0+7*ш,Y0-ш*1.1,ink2,12,'center',true); txt('[Lᵃ mᵇ gᶜ]',X0+11*ш,Y0-ш*1.1,ink2,12,'center',true);
    const ч=x=>(Math.abs(x)<1e-9?'0':String(x).replace('.',',').replace('-','−'));
    [['метр, м',0,д.м],['килограмм, кг',0,д.кг],['секунда, с',1,д.с]].forEach(([имя,л,пр],i)=>{
      const y=Y0-ш*(2.2+i*1.15), равно=Math.abs(л-пр)<1e-9;
      txt(имя,X0,y,ink2,12,'left'); txt(ч(л),X0+7*ш,y,ink,13,'center',true);
      txt(равно?'=':'≠',X0+9*ш,y,равно?ok:dang,14,'center',true); txt(ч(пр),X0+11*ш,y,равно?ok:dang,13,'center',true); });
    const yК=Y0-ш*6;
    txt(`a + c = ${ч(д.м)},   b = ${ч(д.кг)},   −2c = ${ч(д.с)}`,X0,yК,ink3,11,'left');
    if(ок){ txt(Number.isFinite(s.T)?`k = T / (Lᵃmᵇgᶜ) = ${(s.T/this.догадка(p)).toFixed(3)}`:'k — после второго прохода нижней точки',X0,yК-ш*1.3,ok,13,'left',true);
      txt('меняйте L, m и g — k останется прежним',X0,yК-ш*2.4,ink3,11,'left'); }
    else txt('догадка неверна: подберите a, b, c',X0,yК-ш*1.3,dang,13,'left',true);
  },
  /* ---- инструмент модели: «Груз» — тяните груз: вниз-вверх длина нити, вбок — начальный угол ---- */
  tools(p){ const S1=this;
    return [{id:'bob', name:'Груз', cursor:'grab',
      icon:'<path d="M12 3v11"/><circle cx="12" cy="17" r="4"/><path d="M8 3h8"/>',
      hint:'потяните груз: вниз и вверх — длина нити, в сторону — начальный угол; ↑/↓ — длина, ←/→ — угол',
      down(т){ const y0=0, d=Math.hypot(т.wx,т.wy-y0); return d>0.05; },
      move(т){ const y0=0, dx=т.wx, dy=y0-т.wy; т.set('L',Math.hypot(dx,dy)); т.set('th0',Math.abs(Math.atan2(dx,Math.max(dy,1e-6)))*180/Math.PI); },
      key(k,т){ if(k==='ArrowUp'||k==='ArrowDown'){ т.set('L',т.p.L+(k==='ArrowDown'?1:-1)*(т.shift?0.5:0.05)); return true; }
        if(k==='ArrowLeft'||k==='ArrowRight'){ т.set('th0',т.p.th0+(k==='ArrowRight'?1:-1)*(т.shift?10:1)); return true; } return false; },
      overlay(o,т){ const y0=0, A=т.p.th0*Math.PI/180, x=т.p.L*Math.sin(A), y=y0-т.p.L*Math.cos(A);
        o.strokeStyle=css('--accent'); o.lineWidth=1/т.ppm; o.setLineDash([4/т.ppm,4/т.ppm]); o.beginPath(); o.moveTo(0,y0); o.lineTo(x,y); o.stroke(); o.setLineDash([]);
        VIEW.label(o,`L = ${т.p.L} м, θ₀ = ${т.p.th0}°`,x,y,12,-14,css('--accent')); }}];
  }
},

/* ---------------- СБЛИЖЕНИЕ ДВУХ ТЕЛ В ПОТОКЕ (9.2.0) ----------------
   Два тела движутся по плоскости с постоянными скоростями. Скорость каждого
   задаётся относительно среды (воды, воздуха) или относительно земли; среда
   сама течёт со скоростью u. Столкнутся ли тела, решает только их
   относительная скорость w = v₂ − v₁: в системе тела 1 тело 2 идёт по прямой,
   и наименьшее расстояние — перпендикуляр от тела 1 на эту прямую. Отсюда
   условие встречи: (r₁ − r₂)/|r₁ − r₂| = w/|w|. Течение, одинаково сносящее
   оба тела, на встречу не влияет. Тело 1 может развернуться через τ (задача
   о лодке и плоте). Движение кусочно-равномерное, поэтому всё считается точно:
   столкновение — корень квадратного уравнения, сближение — вершина параболы. */
meet2d:{
  title:'Сближение двух тел в потоке',
  params:[
    {type:'group',label:'Течение (среда)'},
    {key:'u',   label:'Скорость течения u',unit:'м/с',min:0,max:50,step:0.01,default:0},
    {key:'uAng',label:'Направление течения (от оси x)',unit:'°',min:-180,max:180,step:1,default:0},
    {type:'group',label:'Тело 1'},
    {key:'x1',  label:'Начальная координата x',unit:'м',min:-20000,max:20000,step:1,default:0},
    {key:'y1',  label:'Начальная координата y',unit:'м',min:-20000,max:20000,step:1,default:0},
    {key:'v1',  label:'Скорость v₁',unit:'м/с',min:0,max:500,step:0.01,default:5},
    {key:'a1',  label:'Направление скорости (от оси x)',unit:'°',min:-180,max:180,step:0.1,default:60},
    {key:'rel1',label:'Скорость задана',type:'select',default:'med',options:[{v:'med',t:'относительно среды'},{v:'gnd',t:'относительно земли'}]},
    {key:'turn1',label:'Развернуться назад через τ (0 — не разворачиваться)',unit:'с',min:0,max:20000,step:1,default:0},
    {type:'group',label:'Тело 2'},
    {key:'x2',  label:'Начальная координата x',unit:'м',min:-20000,max:20000,step:1,default:100},
    {key:'y2',  label:'Начальная координата y',unit:'м',min:-20000,max:20000,step:1,default:0},
    {key:'v2',  label:'Скорость v₂',unit:'м/с',min:0,max:500,step:0.01,default:4},
    {key:'a2',  label:'Направление скорости (от оси x)',unit:'°',min:-180,max:180,step:0.1,default:130},
    {key:'rel2',label:'Скорость задана',type:'select',default:'med',options:[{v:'med',t:'относительно среды'},{v:'gnd',t:'относительно земли'}]},
    {type:'group',label:'Смотреть и останавливать'},
    {key:'frame',label:'Система отсчёта',type:'select',default:'gnd',options:[{v:'gnd',t:'земля (берег)'},{v:'med',t:'среда (вода, воздух)'},{v:'b1',t:'тело 1'}]},
    {key:'Rh',  label:'Тела сталкиваются на расстоянии',unit:'м',min:0.1,max:200,step:0.1,default:3},
    {key:'relv',label:'Относительная скорость и прямая сближения',type:'check',default:true},
    {key:'stopHit',label:'Остановить при столкновении',type:'check',default:true},
    {key:'stopMin',label:'Остановить в момент наибольшего сближения',type:'check',default:false},
    {key:'tStop',label:'Остановить в момент t (0 — выкл)',unit:'с',min:0,max:50000,step:0.1,default:0}
  ],
  U(p){ const f=p.uAng*Math.PI/180; return [p.u*Math.cos(f),p.u*Math.sin(f)]; },
  /* собственная скорость тела i (относительно среды или земли) в момент t */
  своя(p,i,t){ const v=i?p.v2:p.v1, a=(i?p.a2:p.a1)*Math.PI/180; let w=[v*Math.cos(a),v*Math.sin(a)];
    if(!i&&p.turn1>0&&t>p.turn1+1e-12) w=[-w[0],-w[1]]; return w; },
  V(p,i,t){ const w=this.своя(p,i,t), rel=i?p.rel2:p.rel1;
    if(rel==='gnd') return w; const U=this.U(p); return [w[0]+U[0],w[1]+U[1]]; },
  pos(p,i,t){ const x0=i?p.x2:p.x1, y0=i?p.y2:p.y1;
    if(!i&&p.turn1>0&&t>p.turn1){ const A=this.V(p,0,0), B=this.V(p,0,t), T=p.turn1;
      return [x0+A[0]*T+B[0]*(t-T), y0+A[1]*T+B[1]*(t-T)]; }
    const V=this.V(p,i,0); return [x0+V[0]*t,y0+V[1]*t]; },
  /* скорость и смещение выбранной системы отсчёта */
  Vf(p,t){ return p.frame==='med'?this.U(p):p.frame==='b1'?this.V(p,0,t):[0,0]; },
  сдвиг(p,t){ if(p.frame==='med'){ const U=this.U(p); return [U[0]*t,U[1]*t]; }
    if(p.frame==='b1'){ const r=this.pos(p,0,t); return [r[0]-p.x1,r[1]-p.y1]; } return [0,0]; },
  вСистеме(p,i,t){ const r=this.pos(p,i,t), d=this.сдвиг(p,t); return [r[0]-d[0],r[1]-d[1]]; },
  D(p,t){ const a=this.pos(p,0,t), b=this.pos(p,1,t); return [b[0]-a[0],b[1]-a[1]]; },
  W(p,t){ const a=this.V(p,0,t), b=this.V(p,1,t); return [b[0]-a[0],b[1]-a[1]]; },
  /* разбор участка [ta, tb] с постоянной относительной скоростью:
     первое вхождение в зону столкновения и вершина сближения */
  участок(p,ta,tb){ const D=this.D(p,ta), W=this.W(p,(ta+tb)/2), A=W[0]*W[0]+W[1]*W[1], B=D[0]*W[0]+D[1]*W[1], C=D[0]*D[0]+D[1]*D[1];
    const out={удар:NaN,мин:NaN}, Δ=tb-ta;
    if(A>1e-18){
      if(C>p.Rh*p.Rh){ const disc=B*B-A*(C-p.Rh*p.Rh); if(disc>=0){ const τ=(-B-Math.sqrt(disc))/A; if(τ>=0&&τ<=Δ) out.удар=ta+τ; } }
      if(B<0){ const τ=-B/A; if(τ<=Δ) out.мин=ta+τ; } }
    return out; },
  /* весь путь: первое столкновение и первое наибольшее сближение (до горизонта) */
  разбор(p,T){ const точки=[0]; if(p.turn1>0&&p.turn1<T) точки.push(p.turn1); точки.push(T);
    let удар=NaN, мин=NaN;
    for(let k=0;k<точки.length-1;k++){ const r=this.участок(p,точки[k],точки[k+1]);
      if(!isFinite(удар)&&isFinite(r.удар)) удар=r.удар;
      if(!isFinite(мин)){ if(isFinite(r.мин)) мин=r.мин;
        else if(k<точки.length-2){ const D=this.D(p,точки[k+1]), W0=this.W(p,точки[k+1]-1e-9), W1=this.W(p,точки[k+1]+1e-9);
          if(D[0]*W0[0]+D[1]*W0[1]<0&&D[0]*W1[0]+D[1]*W1[1]>=0) мин=точки[k+1]; } } }
    return {удар,мин}; },
  горизонт(p){ const D=this.D(p,0), W=this.W(p,0), A=W[0]*W[0]+W[1]*W[1];
    let T=A>1e-18?Math.max(0,-(D[0]*W[0]+D[1]*W[1])/A)*1.6:0;
    if(p.turn1>0) T=Math.max(T,p.turn1*2.2);
    const r=this.разбор(p,Math.max(T,1)); if(isFinite(r.удар)) T=Math.max(T,r.удар*1.25);
    return clamp(T||20,10,1e5); },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ if(s.event) return; let t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop){ t=p.tStop; }
    const т=[s.t]; if(p.turn1>0&&p.turn1>s.t&&p.turn1<t) т.push(p.turn1); т.push(t);
    for(let k=0;k<т.length-1;k++){ const r=this.участок(p,т[k],т[k+1]);
      if(p.stopHit&&isFinite(r.удар)){ s.t=r.удар; const a=this.pos(p,0,s.t); s.event={type:'hit',t:s.t,x:a[0],y:a[1]};
        s.__stop=`Столкновение: t = ${s.t.toFixed(2)} с, точка (${a[0].toFixed(1)}; ${a[1].toFixed(1)}) м`; return; }
      let tm=r.мин;
      if(!isFinite(tm)&&k<т.length-2){ const D=this.D(p,т[k+1]), W0=this.W(p,т[k+1]-1e-9), W1=this.W(p,т[k+1]+1e-9);
        if(D[0]*W0[0]+D[1]*W0[1]<0&&D[0]*W1[0]+D[1]*W1[1]>=0) tm=т[k+1]; }
      if(p.stopMin&&isFinite(tm)&&tm>s.t+1e-9){ s.t=tm; const D=this.D(p,tm), d=Math.hypot(D[0],D[1]); s.event={type:'min',t:tm,d};
        s.__stop=`Наибольшее сближение: t = ${tm.toFixed(2)} с, расстояние ${d.toFixed(2)} м`; return; } }
    s.t=t;
    if(p.tStop>0&&t>=p.tStop){ s.event={type:'time',t}; s.__stop=`Остановка по времени: t = ${t.toFixed(2)} с`; } },
  readouts(s,p){ const D=this.D(p,s.t), W=this.W(p,s.t), V1=this.V(p,0,s.t), V2=this.V(p,1,s.t), U=this.U(p);
    const out=[['t',s.t,'с'],['расстояние между телами',Math.hypot(D[0],D[1]),'м'],
      ['скорость тела 1 относительно земли',Math.hypot(V1[0],V1[1]),'м/с'],['скорость тела 2 относительно земли',Math.hypot(V2[0],V2[1]),'м/с'],
      ['скорость тела 2 относительно тела 1',Math.hypot(W[0],W[1]),'м/с']];
    if(p.u>0) out.push(['течение относительно тела 1',Math.hypot(U[0]-V1[0],U[1]-V1[1]),'м/с']);
    out.push(['сейчас тела',s.event&&s.event.type==='hit'?'столкнулись':(D[0]*W[0]+D[1]*W[1]<0?'сближаются':'удаляются'),'']);
    return out; },
  graphs:[{label:'Расстояние между телами',unit:'м',series:['расстояние'],get(s,p){ const D=SIMS.meet2d.D(p,s.t); return [Math.hypot(D[0],D[1]),null]; }}],
  presets:[
    {name:'Встречные курсы: тела столкнутся',values:{u:0,uAng:0,x1:0,y1:0,v1:5,a1:60,rel1:'med',turn1:0,x2:100,y2:0,v2:5,a2:120,rel2:'med',frame:'gnd',Rh:3,stopHit:true,stopMin:false,tStop:0}},
    {name:'То же в течении: встреча не сорвалась',values:{u:3,uAng:-90,x1:0,y1:0,v1:5,a1:60,rel1:'med',turn1:0,x2:100,y2:0,v2:5,a2:120,rel2:'med',frame:'gnd',Rh:3,stopHit:true,stopMin:false,tStop:0}},
    {name:'Перпендикулярные курсы: наибольшее сближение',values:{u:0,x1:-300,y1:0,v1:10,a1:0,rel1:'gnd',turn1:0,x2:0,y2:-400,v2:8,a2:90,rel2:'gnd',frame:'b1',Rh:3,stopHit:true,stopMin:true,tStop:0}},
    {name:'Лодка и плот: разворот через 10 минут',values:{u:0.5,uAng:0,x1:0,y1:0,v1:3,a1:180,rel1:'med',turn1:600,x2:0,y2:0,v2:0,a2:0,rel2:'med',frame:'gnd',Rh:5,stopHit:true,stopMin:false,tStop:0}},
    {name:'Корабль и ветер: какой ветер чувствует палуба',values:{u:4.17,uAng:120,x1:0,y1:0,v1:8.33,a1:0,rel1:'gnd',turn1:0,x2:600,y2:250,v2:0,a2:0,rel2:'gnd',frame:'b1',Rh:3,stopHit:false,stopMin:false,tStop:60}},
    {name:'В системе тела 1: прямая сближения',values:{u:2,uAng:30,x1:0,y1:0,v1:6,a1:20,rel1:'med',turn1:0,x2:400,y2:-150,v2:7,a2:150,rel2:'med',frame:'b1',Rh:3,stopHit:true,stopMin:true,tStop:0}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460, H=(vp&&vp.H)||320, T=this.горизонт(p);
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    for(let i=0;i<2;i++) for(let k=0;k<=60;k++){ const r=this.вСистеме(p,i,T*k/60); x0=Math.min(x0,r[0]); x1=Math.max(x1,r[0]); y0=Math.min(y0,r[1]); y1=Math.max(y1,r[1]); }
    const sx=Math.max(x1-x0,20)*1.25, sy=Math.max(y1-y0,20)*1.35;
    const scale=clamp(Math.min((W-60)/(sx*PX_PER_M),(H-60)/(sy*PX_PER_M)),1e-5,30);
    return {x:(x0+x1)/2,y:(y0+y1)/2,scale}; },
  anchors(s,p){ return [0,1].map(i=>{ const r=this.вСистеме(p,i,s.t); return {x:r[0],y:r[1]}; }); },
  draw(ctx,s,v,p){
    const пк=1/ppm(), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), sec=v.c('--second'), cols=[v.c('--accent'),v.c('--third')||v.c('--danger')];
    const T=this.горизонт(p), U=this.U(p), Vf=this.Vf(p,s.t);
    // поток: стрелки движутся со скоростью среды в выбранной системе
    if(p.u>0){ const cv=ctx.canvas, a=toWorld(0,0), b=toWorld(cv.clientWidth||cv.width,cv.clientHeight||cv.height);
      const шаг=80*пк, w=[U[0]-Vf[0],U[1]-Vf[1]], m=Math.hypot(w[0],w[1]);
      const ox=((w[0]*s.t)%шаг+шаг)%шаг, oy=((w[1]*s.t)%шаг+шаг)%шаг;
      ctx.strokeStyle=sec; ctx.fillStyle=sec; ctx.globalAlpha=.22; ctx.lineWidth=v.lw(1.1);
      const xa=Math.min(a[0],b[0]), xb=Math.max(a[0],b[0]), ya=Math.min(a[1],b[1]), yb=Math.max(a[1],b[1]);
      const ex=m>1e-9?w[0]/m:0, ey=m>1e-9?w[1]/m:0, L=16*пк;
      for(let x=Math.floor(xa/шаг)*шаг-шаг;x<xb+шаг;x+=шаг) for(let y=Math.floor(ya/шаг)*шаг-шаг;y<yb+шаг;y+=шаг){
        const cx=x+ox, cy=y+oy;
        if(m<1e-9){ ctx.beginPath(); ctx.arc(cx,cy,v.lw(1.4),0,7); ctx.fill(); continue; }
        ctx.beginPath(); ctx.moveTo(cx-ex*L,cy-ey*L); ctx.lineTo(cx+ex*L,cy+ey*L); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+ex*L,cy+ey*L); ctx.lineTo(cx+ex*L*0.4-ey*L*0.4,cy+ey*L*0.4+ex*L*0.4); ctx.lineTo(cx+ex*L*0.4+ey*L*0.4,cy+ey*L*0.4-ex*L*0.4); ctx.closePath(); ctx.fill(); }
      ctx.globalAlpha=1; }
    // будущие пути (бледно) и пройденные (ярко) — в выбранной системе
    for(let i=0;i<2;i++){ const c=cols[i];
      const рис=(t0,t1)=>{ const n=80, pts=[]; const ts=[]; for(let k=0;k<=n;k++) ts.push(t0+(t1-t0)*k/n);
        if(p.turn1>0&&p.turn1>t0&&p.turn1<t1) ts.push(p.turn1); ts.sort((a,b)=>a-b);
        ctx.beginPath(); ts.forEach((t,k)=>{ const r=this.вСистеме(p,i,t); k?ctx.lineTo(r[0],r[1]):ctx.moveTo(r[0],r[1]); }); ctx.stroke(); };
      if(!s.event){ ctx.strokeStyle=c; ctx.globalAlpha=.3; ctx.lineWidth=v.lw(1.3); ctx.setLineDash([v.lw(5),v.lw(5)]); рис(s.t,Math.max(T,s.t+1)); ctx.setLineDash([]); }
      ctx.globalAlpha=1; ctx.strokeStyle=c; ctx.lineWidth=v.lw(2); if(s.t>0) рис(0,s.t);
      const r0=this.вСистеме(p,i,0); ctx.fillStyle=c; ctx.globalAlpha=.45; ctx.beginPath(); ctx.arc(r0[0],r0[1],v.lw(3),0,7); ctx.fill(); ctx.globalAlpha=1; }
    // прямая сближения в системе тела 1 и перпендикуляр — наименьшее расстояние
    const r1=this.вСистеме(p,0,s.t), r2=this.вСистеме(p,1,s.t), W=this.W(p,s.t), Wm=Math.hypot(W[0],W[1]);
    if(p.relv&&Wm>1e-9&&!(s.event&&(s.event.type==='hit'||s.event.type==='min'))){
      if(p.frame==='b1'){ const e=[W[0]/Wm,W[1]/Wm], L=1e6;
        ctx.strokeStyle=meas; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(3),v.lw(4)]);
        ctx.beginPath(); ctx.moveTo(r2[0],r2[1]); ctx.lineTo(r2[0]+e[0]*L,r2[1]+e[1]*L); ctx.stroke(); ctx.setLineDash([]);
        const τ=(r1[0]-r2[0])*e[0]+(r1[1]-r2[1])*e[1];
        if(τ>0){ const f=[r2[0]+e[0]*τ,r2[1]+e[1]*τ], d=Math.hypot(r1[0]-f[0],r1[1]-f[1]);
          ctx.globalAlpha=1; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(r1[0],r1[1]); ctx.lineTo(f[0],f[1]); ctx.stroke();
          ctx.beginPath(); ctx.arc(f[0],f[1],v.lw(3),0,7); ctx.fillStyle=meas; ctx.fill();
          v.label(ctx,d<=p.Rh?'прямая проходит через тело 1 — столкнутся':`наименьшее расстояние ${d.toFixed(1)} м`,(r1[0]+f[0])/2,(r1[1]+f[1])/2,10,-12,meas); }
        else v.label(ctx,'тело 2 уже удаляется',r2[0],r2[1],12,24,meas);
        ctx.globalAlpha=1; }
      else { const k=Math.min(6,70/Math.max(Wm,1e-9))*пк; v.arrow(ctx,r2[0],r2[1],r2[0]+W[0]*k,r2[1]+W[1]*k,meas);
        v.label(ctx,'v₂ − v₁',r2[0]+W[0]*k,r2[1]+W[1]*k,8,-10,meas); } }
    // скорости тел в выбранной системе
    const скор=[0,1].map(i=>{ const V=this.V(p,i,s.t); return [V[0]-Vf[0],V[1]-Vf[1]]; });
    const vmax=Math.max(1e-9,...скор.map(q=>Math.hypot(q[0],q[1])),Math.hypot(U[0]-Vf[0],U[1]-Vf[1]));
    const kv=Math.min(8,60/vmax)*пк;
    [r1,r2].forEach((r,i)=>{ const q=скор[i], c=cols[i];
      if(!s.event&&Math.hypot(q[0],q[1])>1e-6) v.arrow(ctx,r[0],r[1],r[0]+q[0]*kv,r[1]+q[1]*kv,c);
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(r[0],r[1],Math.max(p.Rh/2,v.lw(6)),0,7); ctx.fill();
      v.label(ctx,`тело ${i+1}`,r[0],r[1],12,i?16:-16,c); });
    if(s.event&&s.event.type==='hit'){ ctx.strokeStyle=v.c('--danger'); ctx.lineWidth=v.lw(2);
      for(let k=0;k<10;k++){ const a=k*Math.PI/5, a1=9*пк, a2=(k%2?16:22)*пк; ctx.beginPath(); ctx.moveTo(r1[0]+a1*Math.cos(a),r1[1]+a1*Math.sin(a)); ctx.lineTo(r1[0]+a2*Math.cos(a),r1[1]+a2*Math.sin(a)); ctx.stroke(); } }
    if(s.event&&s.event.type==='min'){ ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(r1[0],r1[1]); ctx.lineTo(r2[0],r2[1]); ctx.stroke();
      v.label(ctx,`d = ${s.event.d.toFixed(2)} м`,(r1[0]+r2[0])/2,(r1[1]+r2[1])/2,10,-12,meas); }
    const имя={gnd:'земли',med:'среды',b1:'тела 1'}[p.frame]||'земли';
    { const cv=ctx.canvas, q=toWorld(14,(cv.clientHeight||cv.height)-18);
      v.text(ctx,`система отсчёта ${имя}${p.u>0?(p.frame==='med'?' · среда покоится':' · стрелки — течение'):''}`,q[0],q[1],ink3,11,'left'); }
  },
  /* ---- инструменты модели ----
     «Положение» — перенести тело; «Скорость» — вытянуть её стрелку от тела;
     «Течение» — провести стрелку течения в любом месте сцены. */
  ПИКС:6,
  tools(p){ const S1=this;
    const экран=(т,i)=>{ const r=S1.вСистеме(т.p,i,т.s.t); return т.toScreen(r[0],r[1]); };
    const ближ=т=>{ let луч=-1, мин=28; for(let i=0;i<2;i++){ const q=экран(т,i), d=Math.hypot(q[0]-т.px,q[1]-т.py); if(d<мин){ мин=d; луч=i; } } return луч; };
    const кольцо=(o,т)=>{ const i=т.выбор.i; if(i==null) return; const r=S1.вСистеме(т.p,i,т.s.t); o.strokeStyle=css('--accent'); o.lineWidth=VIEW.lw(2); o.beginPath(); o.arc(r[0],r[1],VIEW.lw(14),0,7); o.stroke(); };
    const К=i=>i?['x2','y2','v2','a2']:['x1','y1','v1','a1'];
    return [
      {id:'pos', name:'Положение тела', cursor:'move',
       icon:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21"/>',
       hint:'возьмите тело и перенесите; стрелки клавиатуры сдвигают выделенное (Shift — крупнее)',
       down(т){ const i=ближ(т); т.выбор.i=i<0?null:i; return i>=0; },
       move(т){ const к=К(т.выбор.i); т.set(к[0],т.wx); т.set(к[1],т.wy); },
       key(k,т){ const i=т.выбор.i; if(i==null) return false; const к=К(i), ш=(т.shift?50:5)/Math.max(1e-9,т.ppm/PX_PER_M)/8;
         const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[k]; if(!d) return false;
         т.set(к[0],т.p[к[0]]+d[0]*ш); т.set(к[1],т.p[к[1]]+d[1]*ш); return true; },
       overlay(o,т){ кольцо(o,т); }},
      {id:'vel', name:'Скорость стрелкой', cursor:'crosshair',
       icon:'<circle cx="5" cy="19" r="2.4"/><path d="M7 17 19 5M13 5h6v6"/>',
       hint:'потяните от тела: длина стрелки — скорость (относительно среды или земли, как задано), направление — курс',
       down(т){ const i=ближ(т); т.выбор.i=i<0?null:i; return i>=0; },
       move(т){ const i=т.выбор.i, [sx,sy]=экран(т,i), dx=т.px-sx, dy=sy-т.py, к=К(i);
         т.set(к[2],Math.hypot(dx,dy)/S1.ПИКС); т.set(к[3],Math.atan2(dy,dx)*180/Math.PI); },
       key(k,т){ const i=т.выбор.i; if(i==null) return false; const к=К(i), ш=т.shift?10:1;
         if(k==='ArrowLeft'||k==='ArrowRight'){ т.set(к[3],т.p[к[3]]+(k==='ArrowLeft'?ш:-ш)); return true; }
         if(k==='ArrowUp'||k==='ArrowDown'){ т.set(к[2],Math.max(0,т.p[к[2]]+(k==='ArrowUp'?0.1:-0.1)*ш)); return true; } return false; },
       overlay(o,т){ кольцо(o,т); const i=т.выбор.i; if(i==null) return; const r=S1.вСистеме(т.p,i,0), w=S1.своя(т.p,i,0), k=S1.ПИКС/т.ppm;
         VIEW.arrow(o,r[0],r[1],r[0]+w[0]*k,r[1]+w[1]*k,css('--accent'));
         VIEW.label(o,`v = ${т.p[К(i)[2]]} м/с, ${т.p[К(i)[3]]}°`,r[0]+w[0]*k,r[1]+w[1]*k,10,-12,css('--accent')); }},
      {id:'flow', name:'Течение', cursor:'crosshair',
       icon:'<path d="M3 8c3-2 5 2 8 0s5-2 8 0M3 13c3-2 5 2 8 0s5-2 8 0M15 17h5M17.5 14.5 20 17l-2.5 2.5"/>',
       hint:'проведите стрелку в любом месте: её длина — скорость течения, направление — куда течёт',
       down(т){ т.выбор.с=[т.px,т.py,т.wx,т.wy]; return true; },
       move(т){ const [px,py]=т.выбор.с, dx=т.px-px, dy=py-т.py; т.set('u',Math.hypot(dx,dy)/S1.ПИКС); т.set('uAng',Math.atan2(dy,dx)*180/Math.PI); },
       key(k,т){ if(k==='ArrowLeft'||k==='ArrowRight'){ т.set('uAng',т.p.uAng+(k==='ArrowLeft'?5:-5)); return true; }
         if(k==='ArrowUp'||k==='ArrowDown'){ т.set('u',Math.max(0,т.p.u+(k==='ArrowUp'?0.1:-0.1)*(т.shift?10:1))); return true; } return false; },
       overlay(o,т){ const с=т.выбор.с; if(!с) return; const U=S1.U(т.p), k=S1.ПИКС/т.ppm;
         VIEW.arrow(o,с[2],с[3],с[2]+U[0]*k,с[3]+U[1]*k,css('--second'));
         VIEW.label(o,`u = ${т.p.u} м/с, ${т.p.uAng}°`,с[2]+U[0]*k,с[3]+U[1]*k,10,-12,css('--second')); }}
    ];
  }
},

/* ---------------- ПОГОНЯ (9.2.0) ----------------
   Две классические задачи о кривой погони. N точек стоят в вершинах
   правильного многоугольника со стороной a и с одинаковой по модулю
   скоростью v всё время идут на соседку. По симметрии фигура остаётся
   правильным многоугольником, а сторона укорачивается с постоянной
   скоростью v(1 − cos 2π/N): каждая точка идёт прямо на соседку, а та уходит
   под углом 2π/N. Встреча — через T = a/(v(1 − cos 2π/N)). Во втором
   опыте A гонится за B, который идёт по прямой со скоростью u перпендикулярно
   начальному отрезку AB длиной l; при u < v встреча через T = vl/(v² − u²).
   Уравнения интегрируются численно (Рунге — Кутта), шаг мельчает у встречи. */
pursuit:{
  title:'Погоня: кривая преследования',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'poly',options:[{v:'poly',t:'точки в вершинах многоугольника'},{v:'chase',t:'A гонится за B, B идёт по прямой'}]},
    {type:'group',label:'Многоугольник',если:p=>p.mode==='poly'},
    {key:'N',label:'Число точек N',min:2,max:8,step:1,default:3,если:p=>p.mode==='poly'},
    {key:'a',label:'Сторона многоугольника a',unit:'м',min:1,max:5000,step:1,default:100,если:p=>p.mode==='poly'},
    {type:'group',label:'Догонялки',если:p=>p.mode==='chase'},
    {key:'l',label:'Начальное расстояние AB',unit:'м',min:1,max:5000,step:1,default:100,если:p=>p.mode==='chase'},
    {key:'u',label:'Скорость B (поперёк AB)',unit:'м/с',min:0,max:100,step:0.1,default:3,если:p=>p.mode==='chase'},
    {type:'group',label:'Общее'},
    {key:'v',label:'Скорость преследователя v',unit:'м/с',min:0.1,max:100,step:0.1,default:5},
    {key:'trail',label:'Следы',type:'check',default:true},
    {key:'stopMeet',label:'Остановить при встрече',type:'check',default:true},
    {key:'tStop',label:'Остановить в момент t (0 — выкл)',unit:'с',min:0,max:5000,step:0.1,default:0}
  ],
  R(p){ const N=Math.max(2,Math.round(p.N)); return p.a/(2*Math.sin(Math.PI/N)); },
  нач(p){ if(p.mode==='chase') return [[0,0],[p.l,0]];
    const N=Math.max(2,Math.round(p.N)), R=this.R(p), out=[];
    for(let k=0;k<N;k++){ const f=Math.PI/2+2*Math.PI*k/N; out.push([R*Math.cos(f),R*Math.sin(f)]); } return out; },
  d0(p){ return p.mode==='chase'?p.l:p.a; },
  /* скорости всех точек при положениях q */
  скор(p,q,t){ const out=[];
    if(p.mode==='chase'){ const dx=q[1][0]-q[0][0], dy=q[1][1]-q[0][1], d=Math.hypot(dx,dy)||1;
      out.push([p.v*dx/d,p.v*dy/d],[0,p.u]); return out; }
    const N=q.length; for(let k=0;k<N;k++){ const n=q[(k+1)%N], dx=n[0]-q[k][0], dy=n[1]-q[k][1], d=Math.hypot(dx,dy)||1; out.push([p.v*dx/d,p.v*dy/d]); }
    return out; },
  dist(p,q){ return Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1]); },
  init(p){ const q=this.нач(p); return {t:0,q,следы:q.map(r=>[r.slice()]),event:null,__stop:null,мет:0}; },
  шаг(p,q,t,h){ const сл=(q,k,h)=>q.map((r,i)=>[r[0]+h*k[i][0],r[1]+h*k[i][1]]);
    const k1=this.скор(p,q,t), k2=this.скор(p,сл(q,k1,h/2),t+h/2), k3=this.скор(p,сл(q,k2,h/2),t+h/2), k4=this.скор(p,сл(q,k3,h),t+h);
    return q.map((r,i)=>[r[0]+h/6*(k1[i][0]+2*k2[i][0]+2*k3[i][0]+k4[i][0]), r[1]+h/6*(k1[i][1]+2*k2[i][1]+2*k3[i][1]+k4[i][1])]); },
  step(s,dt,p){ if(s.event) return;
    let t=s.t, end=s.t+dt; if(p.tStop>0) end=Math.min(end,p.tStop);
    const eps=this.d0(p)*2e-4;
    while(t<end-1e-12){ const d=this.dist(p,s.q);
      if(p.stopMeet&&d<=eps){ s.t=t; s.event={type:'meet',t}; s.__stop=`Встреча: t = ${t.toFixed(2)} с, каждый преследователь прошёл ${(p.v*t).toFixed(1)} м`; return; }
      const h=Math.min(end-t,Math.max(1e-6,d/(p.v+(p.u||0)+1e-9)/40)); s.q=this.шаг(p,s.q,t,h); t+=h; }
    s.t=end;
    if(p.trail&&s.t-s.мет>=0){ s.q.forEach((r,i)=>{ const L=s.следы[i], z=L[L.length-1]; if(Math.hypot(r[0]-z[0],r[1]-z[1])>this.d0(p)*2e-3){ L.push(r.slice()); if(L.length>3000) L.shift(); } }); }
    if(p.tStop>0&&s.t>=p.tStop){ s.event={type:'time',t:s.t}; s.__stop=`Остановка по времени: t = ${s.t.toFixed(2)} с`; } },
  readouts(s,p){ const d=this.dist(p,s.q);
    return [['t',s.t,'с'],[p.mode==='chase'?'расстояние A–B':'расстояние между соседями',d,'м'],
      [p.mode==='chase'?'путь A':'путь каждой точки',p.v*s.t,'м'],
      [p.mode==='chase'?'путь B':'расстояние до центра',p.mode==='chase'?(p.u||0)*s.t:Math.hypot(s.q[0][0],s.q[0][1]),'м']]; },
  graphs:[{label:'Расстояние между преследователем и целью',unit:'м',series:['d'],get(s,p){ return [SIMS.pursuit.dist(p,s.q),null]; }}],
  presets:[
    {name:'Три точки в вершинах треугольника',values:{mode:'poly',N:3,a:100,v:5,trail:true,stopMeet:true,tStop:0}},
    {name:'Четыре черепахи в углах квадрата',values:{mode:'poly',N:4,a:100,v:5,trail:true,stopMeet:true,tStop:0}},
    {name:'Шесть точек: спираль закручивается сильнее',values:{mode:'poly',N:6,a:100,v:5,trail:true,stopMeet:true,tStop:0}},
    {name:'Собака гонится за зайцем (u < v)',values:{mode:'chase',l:100,u:3,v:5,trail:true,stopMeet:true,tStop:0}},
    {name:'Равные скорости: догнать нельзя',values:{mode:'chase',l:100,u:5,v:5,trail:true,stopMeet:true,tStop:200}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460, H=(vp&&vp.H)||320;
    if(p.mode==='chase'){ const T=p.u<p.v?p.v*p.l/(p.v*p.v-p.u*p.u):(p.tStop||4*p.l/p.v), y1=Math.max(p.l*0.3,Math.min(p.u*T,p.l*4));
      const sx=p.l*1.35, sy=y1*1.25; const scale=clamp(Math.min((W-60)/(sx*PX_PER_M),(H-60)/(sy*PX_PER_M)),1e-5,30);
      return {x:p.l*0.5,y:y1*0.45,scale}; }
    const R=this.R(p), scale=clamp(Math.min(W-60,H-60)/(2.5*R*PX_PER_M),1e-5,30); return {x:0,y:0,scale}; },
  anchors(s,p){ return s.q.map(r=>({x:r[0],y:r[1]})).concat([{x:0,y:0}]); },
  draw(ctx,s,v,p){
    const пк=1/ppm(), ink3=v.c('--ink-3'), meas=v.c('--measure'), cols=[v.c('--accent'),v.c('--second'),v.c('--third')||v.c('--danger'),v.c('--measure')];
    const q=s.q, n=q.length;
    if(p.mode==='poly'){ // начальный многоугольник и нынешний
      const q0=this.нач(p); ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(4)]);
      ctx.beginPath(); q0.forEach((r,i)=>i?ctx.lineTo(r[0],r[1]):ctx.moveTo(r[0],r[1])); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha=.5; ctx.beginPath(); q.forEach((r,i)=>i?ctx.lineTo(r[0],r[1]):ctx.moveTo(r[0],r[1])); ctx.closePath(); ctx.stroke(); ctx.globalAlpha=1;
      ctx.fillStyle=ink3; ctx.beginPath(); ctx.arc(0,0,v.lw(2.5),0,7); ctx.fill(); }
    else { ctx.strokeStyle=ink3; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(5),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(p.l,0); ctx.lineTo(p.l,1e6); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(q[0][0],q[0][1]); ctx.lineTo(q[1][0],q[1][1]); ctx.stroke(); ctx.globalAlpha=1; }
    if(p.trail) s.следы.forEach((L,i)=>{ ctx.strokeStyle=cols[i%cols.length]; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      L.forEach((r,k)=>k?ctx.lineTo(r[0],r[1]):ctx.moveTo(r[0],r[1])); ctx.lineTo(q[i][0],q[i][1]); ctx.stroke(); });
    const V=this.скор(p,q,s.t), vm=Math.max(p.v,p.u||0,1e-9), k=Math.min(8,40/vm)*пк;
    q.forEach((r,i)=>{ const c=cols[i%cols.length];
      if(!s.event&&Math.hypot(V[i][0],V[i][1])>1e-9) v.arrow(ctx,r[0],r[1],r[0]+V[i][0]*k,r[1]+V[i][1]*k,c);
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(r[0],r[1],v.lw(5.5),0,7); ctx.fill();
      if(p.mode==='chase') v.label(ctx,i?'B':'A',r[0],r[1],10,-12,c); });
    if(s.event&&s.event.type==='meet'){ ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.arc(q[0][0],q[0][1],v.lw(14),0,7); ctx.stroke();
      v.label(ctx,`встреча через ${s.event.t.toFixed(2)} с`,q[0][0],q[0][1],16,-18,meas); }
  },
  /* ---- инструмент модели: «Размер» — потяните точку от центра (или B вдоль оси) ---- */
  tools(p){ return [{id:'size', name:'Размер фигуры', cursor:'move',
    icon:'<path d="M12 4 20 18H4z"/><path d="M15 3h6v6"/>',
    hint:'потяните любую точку: в многоугольнике — от центра (меняется сторона a), в догонялках — B вдоль оси (меняется l)',
    down(т){ return true; },
    move(т){ if(т.p.mode==='chase'){ т.set('l',Math.max(1,т.wx)); return; }
      const N=Math.max(2,Math.round(т.p.N)), R=Math.hypot(т.wx,т.wy); т.set('a',2*R*Math.sin(Math.PI/N)); },
    key(k,т){ const кл=т.p.mode==='chase'?'l':'a', зн={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[k]; if(!зн) return false;
      т.set(кл,т.p[кл]+зн*(т.shift?50:5)); return true; },
    overlay(o,т){ const кл=т.p.mode==='chase'?'l':'a'; VIEW.label(o,`${кл} = ${т.p[кл]} м`,т.wx||0,т.wy||0,12,-14,css('--accent')); }}]; }
},

/* ---------------- ПЕРЕПРАВА ЧЕРЕЗ РЕКУ: СЛОЖЕНИЕ СКОРОСТЕЙ ---------------- */
river:{
  title:'Переправа через реку: снос',
  params:[
    {type:'group',label:'Река'},
    {key:'d',  label:'Ширина реки d',        unit:'м',  min:5,  max:2000,step:1,  default:200},
    {key:'u',  label:'Скорость течения u',   unit:'м/с',min:0,  max:20,  step:0.1,default:2},
    {type:'group',label:'Лодка'},
    {key:'vb', label:'Скорость лодки (отн. воды) v',unit:'м/с',min:0.1,max:30,step:0.1,default:4},
    {key:'ang',label:'Угол носа θ (от оси x)',unit:'°', min:0,  max:360, step:1,  default:90},
    {type:'group',label:'Показывать'},
    {key:'comp', label:'Параллелограмм скоростей',type:'check',default:true},
    {key:'trail',label:'Траекторию',type:'check',default:true},
    {type:'group',label:'Остановка таймера'},
    {key:'stopBank',label:'Останавливать у берега',type:'check',default:true},
    {key:'tStop',   label:'Остановить в момент t (0 — не останавливать)',unit:'с',min:0,max:6000,step:0.5,default:0}
  ],
  presets:[
    {name:'Нос строго поперёк: минимальное время',
     values:{d:200,u:2,vb:4,ang:90,stopBank:true,tStop:0}},
    {name:'Переправа без сноса (θ = arccos(−u/v))',
     values:{d:200,u:2,vb:4,ang:120,stopBank:true,tStop:0}},
    {name:'Течение сильнее лодки: снос неизбежен',
     values:{d:200,u:6,vb:3,ang:90,stopBank:true,tStop:0}}
  ],
  warn(p){
    const th=p.ang*Math.PI/180;
    if(p.vb*Math.sin(th)<=0) return 'При таком угле лодка не идёт к противоположному берегу: поперечная проекция скорости ≤ 0.';
    if(p.vb<=p.u) return 'Скорость лодки не больше скорости течения: переправа без сноса невозможна ни при каком угле.';
    return null;
  },
  vel(p){
    const th=p.ang*Math.PI/180;
    const bx=p.vb*Math.cos(th), by=p.vb*Math.sin(th);
    return {bx,by, vx:bx+p.u, vy:by};                     // v_берег = v_лодки + v_течения
  },
  tCross(p){ const {vy}=this.vel(p); return vy>1e-9 ? p.d/vy : Infinity; },
  init(p){ return {t:0,x:0,y:0,trail:[[0,0]],event:null,__stop:null}; },
  put(s,p,t){
    const V=this.vel(p);
    s.t=t; s.x=V.vx*t; s.y=clamp(V.vy*t,0,p.d);
    const l=s.trail[s.trail.length-1];
    if(Math.hypot(s.x-l[0],s.y-l[1])>p.d/400) s.trail.push([s.x,s.y]);
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt, V=this.vel(p);
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ this.put(s,p,p.tStop);
      s.event={t:p.tStop,type:'time'}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    const tc=this.tCross(p);
    if(p.stopBank && V.vy>0 && t>=tc){
      this.put(s,p,tc); s.y=p.d;
      s.event={t:tc,type:'cross',x:s.x,y:p.d};
      s.__stop=`Переправа: t = ${tc.toFixed(2)} с, снос Δx = ${s.x.toFixed(2)} м`;
      return;
    }
    if(p.stopBank && V.vy<0 && t*Math.abs(V.vy)>=0 && s.y<=0 && t>0.05){
      this.put(s,p,t); s.y=0;
      s.event={t,type:'back',x:s.x,y:0};
      s.__stop=`Лодка вернулась к своему берегу: t = ${t.toFixed(2)} с`; return;
    }
    this.put(s,p,t);
  },
  anchors(s,p){
    const V=this.vel(p), tc=this.tCross(p);
    const out=[{x:0,y:0},{x:s.x,y:s.y},{x:0,y:p.d}];
    if(isFinite(tc)) out.push({x:V.vx*tc,y:p.d});
    return out;
  },
  readouts(s,p){
    const V=this.vel(p), tc=this.tCross(p);
    const vres=Math.hypot(V.vx,V.vy);
    const ang=vres>1e-9?(Math.atan2(V.vy,V.vx)*180/Math.PI+360)%360:0;
    const need=(p.vb>p.u)?Math.acos(-p.u/p.vb)*180/Math.PI:NaN;   // cosθ = −u/v
    return [['t',s.t,'с'],
            ['v лодки',p.vb,'м/с'],['течение u',p.u,'м/с'],
            ['v результ.',vres,'м/с'],['угол v',ang,'°'],
            ['vx',V.vx,'м/с'],['vy',V.vy,'м/с'],
            ['x (снос)',s.x,'м'],['y',s.y,'м'],
            ['ширина d',p.d,'м'],
            ['t переправы',tc,isFinite(tc)?'с':'лодка идёт вдоль берега и не переправится'],
            ['снос итог',isFinite(tc)?V.vx*tc:NaN,isFinite(tc)?'м':'переправы нет — сносить нечего'],
            ['θ без сноса',need,isFinite(need)?'°':'течение быстрее лодки — снос не убрать']];
  },
  graphs:[
    {label:'x(t) — снос вдоль течения', unit:'м', series:['лодка'], get:s=>[s.x,null]},
    {label:'y(t) — продвижение поперёк', unit:'м', series:['лодка'], get:s=>[s.y,null]}
  ],
  fit(p,vp){
    const V=this.vel(p), tc=this.tCross(p);
    const X=isFinite(tc)?V.vx*tc:V.vx*20;
    const x0=Math.min(0,X)-p.d*0.1, x1=Math.max(0,X)+p.d*0.1;
    const spanX=Math.max(x1-x0,p.d*0.6), spanY=p.d*1.3;
    const W=(vp&&vp.W)||460, H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-50)/(spanY*PX_PER_M)),0.002,30);
    return {x:(x0+x1)/2, y:p.d/2, scale};
  },
  draw(ctx,s,v,p){
    const V=this.vel(p), tc=this.tCross(p);
    const X=isFinite(tc)?V.vx*tc:V.vx*20;
    const L=Math.max(Math.abs(X),p.d)*1.5;
    // вода и берега
    ctx.fillStyle=v.c('--accent-soft'); ctx.fillRect(-L,0,3*L,p.d);
    ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(-L,0); ctx.lineTo(2*L,0); ctx.moveTo(-L,p.d); ctx.lineTo(2*L,p.d); ctx.stroke();
    v.label(ctx,'свой берег',-L*0.35,0,0,16,v.c('--ink-3'));
    v.label(ctx,'противоположный берег',-L*0.35,p.d,0,-14,v.c('--ink-3'));
    // стрелки течения
    for(let k=1;k<=3;k++){
      const yy=p.d*k/4;
      if(p.u>0) v.arrow(ctx,-L*0.3,yy,-L*0.3+p.d*0.18,yy,v.c('--ink-3'));
    }
    v.label(ctx,`u = ${p.u} м/с`,-L*0.3,p.d/2,0,-14,v.c('--ink-3'));
    // ширина
    ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(4)]);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,p.d); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`d = ${p.d} м`,0,p.d/2,-58,0,v.c('--ink-3'));
    // траектория и снос
    if(p.trail&&s.trail.length>1){
      ctx.strokeStyle=v.c('--accent'); ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      s.trail.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke();
    }
    if(isFinite(tc)){
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(0,p.d); ctx.lineTo(X,p.d); ctx.stroke(); ctx.setLineDash([]);
      v.arrow(ctx,0,p.d*1.12,X,p.d*1.12,v.c('--measure'));
      v.label(ctx,`снос Δx = ${X.toFixed(1)} м`,X/2,p.d*1.12,-30,-12,v.c('--measure'));
    }
    // параллелограмм скоростей
    const k=Math.max(p.d/(Math.max(p.vb+p.u,1)*4),0.05);
    if(p.comp){
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath();
      ctx.moveTo(s.x+V.bx*k,s.y+V.by*k); ctx.lineTo(s.x+V.vx*k,s.y+V.vy*k);
      ctx.lineTo(s.x+p.u*k,s.y); ctx.stroke(); ctx.setLineDash([]);
      v.arrow(ctx,s.x,s.y,s.x+V.bx*k,s.y+V.by*k,v.c('--second'));
      v.label(ctx,`v = ${p.vb} м/с`,s.x+V.bx*k,s.y+V.by*k,6,-10,v.c('--second'));
      v.arrow(ctx,s.x,s.y,s.x+p.u*k,s.y,v.c('--ink-3'));
      v.label(ctx,`u`,s.x+p.u*k,s.y,6,12,v.c('--ink-3'));
    }
    v.arrow(ctx,s.x,s.y,s.x+V.vx*k,s.y+V.vy*k,v.c('--measure'));
    v.label(ctx,`v рез = ${Math.hypot(V.vx,V.vy).toFixed(2)} м/с`,s.x+V.vx*k,s.y+V.vy*k,8,-10,v.c('--measure'));
    // угол носа
    const rr=p.d*0.09;
    ctx.strokeStyle=v.c('--second'); ctx.lineWidth=v.lw(1.3);
    ctx.beginPath(); ctx.arc(s.x,s.y,rr,0,p.ang*Math.PI/180); ctx.stroke();
    v.label(ctx,`θ = ${p.ang}°`,s.x+rr,s.y+rr*0.4,8,0,v.c('--second'));
    // лодка
    ctx.fillStyle=v.c('--accent'); ctx.beginPath(); ctx.arc(s.x,s.y,v.lw(6),0,7); ctx.fill();
  }
},

/* ---------------- РАВНОМЕРНОЕ ДВИЖЕНИЕ ПО ОКРУЖНОСТИ ---------------- */
circular:{
  title:'Движение по окружности',
  params:[
    {key:'mode',label:'Задавать движение',type:'select',default:'v',
     options:[{v:'v',t:'равномерно, через скорость v'},{v:'T',t:'равномерно, через период T'},{v:'acc',t:'с касательным ускорением aτ'}]},
    /* Верхние пределы подняты так, чтобы помещались и планетные масштабы
       (пример «Экватор Земли»). Ползунка нет — только числовое поле с шагом,
       поэтому широкий диапазон не мешает точной установке обычных значений. */
    {key:'R',  label:'Радиус R',   unit:'м',  min:0.2,max:1e7,  step:0.1,default:5},
    {key:'v',  label:'Скорость v', unit:'м/с',min:0.1,max:1000, step:0.1,default:10,если:p=>p.mode==='v'},
    {key:'T',  label:'Период T',   unit:'с',  min:0.1,max:1e5,  step:0.1,default:3.14,если:p=>p.mode==='T'},
    {key:'v0', label:'Начальная скорость v₀',unit:'м/с',min:0,max:1000,step:0.1,default:0,если:p=>p.mode==='acc'},
    {key:'at', label:'Касательное ускорение aτ',unit:'м/с²',min:-100,max:100,step:0.01,default:0.5,если:p=>p.mode==='acc'},
    {key:'dir',label:'Направление',type:'select',default:'ccw',
     options:[{v:'ccw',t:'против часовой'},{v:'cw',t:'по часовой'}]},
    {type:'group',label:'Показывать'},
    {key:'showA',label:'Центростремительное ускорение',type:'check',default:true},
    {key:'showR',label:'Радиус-вектор и угол',type:'check',default:true},
    {key:'trail',label:'След',type:'check',default:true},
    {type:'group',label:'Остановка таймера'},
    {key:'turns',label:'Остановить через N оборотов (0 — не останавливать)',min:0,max:100,step:0.25,default:0},
    {key:'tStop',label:'Остановить в момент t (0 — не останавливать)',unit:'с',min:0,max:6000,step:0.1,default:0}
  ],
  presets:[
    {name:'Экватор Земли (ускорение ≈ 0,034 м/с²)',
     values:{mode:'T',R:6.37e6,T:8.64e4,v:463,dir:'ccw',turns:0,tStop:0}},
    {name:'Карусель: R = 5 м, v = 10 м/с',
     values:{mode:'v',R:5,v:10,dir:'ccw',turns:0,tStop:0}},
    {name:'Один оборот и стоп',
     values:{mode:'v',R:5,v:10,dir:'ccw',turns:1,tStop:0}},
    {name:'Разгон с места: v = aτt, стоп через 0,1 оборота',
     values:{mode:'acc',R:5,v0:0,at:0.5,dir:'ccw',turns:0.1,tStop:0}},
    {name:'Торможение на повороте до остановки',
     values:{mode:'acc',R:20,v0:15,at:-2,dir:'ccw',turns:0,tStop:0}}
  ],
  /* путь по дуге и скорость в момент t (при разгоне — v = v₀ + aτt, не ниже нуля) */
  дуга(p,t){ if(p.mode!=='acc') return null; const v0=p.v0||0, a=p.at||0;
    const tс=a<0?v0/(-a):Infinity, τ=Math.min(t,tс); return {s:v0*τ+a*τ*τ/2, v:Math.max(0,v0+a*τ), tс}; },
  kin(p,t){                                 // согласованные v, T, ω, a_c (при разгоне — мгновенные)
    const д=this.дуга(p,t||0);
    const v = д ? д.v : p.mode==='v' ? p.v : 2*Math.PI*p.R/p.T;
    const T = 2*Math.PI*p.R/Math.max(v,1e-9);
    const at=д&&!(д.v===0&&(p.at||0)<0)?(p.at||0):0;
    return {v, T, w:v/p.R, ac:v*v/p.R, at, a:Math.hypot(at,v*v/p.R), path:д?д.s:v*(t||0), sgn:p.dir==='cw'?-1:1};
  },
  /* момент, когда пройдено n оборотов */
  tОборотов(p,n){ const L=2*Math.PI*p.R*n;
    if(p.mode!=='acc') return n*this.kin(p,0).T;
    const v0=p.v0||0, a=p.at||0;
    if(Math.abs(a)<1e-12) return v0>0?L/v0:Infinity;
    const D=v0*v0+2*a*L; if(D<0) return Infinity; const t=(-v0+Math.sqrt(D))/a; return t>0?t:Infinity; },
  init(p){ return {t:0,phi:0,trail:[],event:null,__stop:null}; },
  put(s,p,t){
    const K=this.kin(p,t);
    s.t=t; s.phi=p.mode==='acc'?K.sgn*K.path/p.R:K.sgn*K.w*t;
    if(p.trail){ s.trail.push([p.R*Math.cos(s.phi),p.R*Math.sin(s.phi)]);
      if(s.trail.length>4000) s.trail.shift(); }
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ this.put(s,p,p.tStop);
      s.event={t:p.tStop,type:'time'}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    if(p.mode==='acc'){ const д=this.дуга(p,t); if(isFinite(д.tс)&&t>=д.tс&&s.t<д.tс&&!(s.done&&s.done.stop)){ this.put(s,p,д.tс);
        s.event={t:д.tс,type:'stop'}; s.__stop=`Тело остановилось: t = ${д.tс.toFixed(3)} с, путь ${д.s.toFixed(2)} м`; return; } }
    if(p.turns>0){
      const te=this.tОборотов(p,p.turns);
      if(t>=te&&!(s.done&&s.done.turns)){ this.put(s,p,te);
        s.event={t:te,type:'turns'};
        s.__stop=`Пройдено ${p.turns} оборот(а): t = ${te.toFixed(3)} с`; return; }
    }
    this.put(s,p,t);
  },
  pos(s,p){
    const K=this.kin(p,s.t);
    const x=p.R*Math.cos(s.phi), y=p.R*Math.sin(s.phi);
    const ex=-K.sgn*Math.sin(s.phi), ey=K.sgn*Math.cos(s.phi);          // касательная по ходу
    const vx=K.v*ex, vy=K.v*ey;
    const ax=-K.ac*Math.cos(s.phi)+K.at*ex, ay=-K.ac*Math.sin(s.phi)+K.at*ey;
    return {x,y,vx,vy,ax,ay,ex,ey,K};
  },
  anchors(s,p){
    const r=this.pos(s,p);
    return [{x:0,y:0},{x:r.x,y:r.y},{x:p.R,y:0},{x:-p.R,y:0},{x:0,y:p.R},{x:0,y:-p.R}];
  },
  readouts(s,p){
    const r=this.pos(s,p), K=r.K;
    if(p.mode==='acc') return [['t',s.t,'с'],['R',p.R,'м'],['v',K.v,'м/с'],['путь по дуге s',K.path,'м'],['обороты',K.path/(2*Math.PI*p.R),''],
      ['aτ (вдоль скорости)',K.at,'м/с²'],['aₙ = v²/R (к центру)',K.ac,'м/с²'],['полное ускорение |a|',K.a,'м/с²'],
      ['угол между a и v',K.a>1e-12?Math.atan2(K.ac,K.at)*180/Math.PI:NaN,'°'],['ω',K.w,'рад/с']];
    return [['t',s.t,'с'],['R',p.R,'м'],['v',K.v,'м/с'],['период T',K.T,'с'],
            ['частота ν',1/K.T,'Гц'],['ω',K.w,'рад/с'],['aц = v²/R',K.ac,'м/с²'],
            ['угол φ',(s.phi*180/Math.PI)%360,'°'],['обороты',s.t/K.T,''],
            ['x',r.x,'м'],['y',r.y,'м'],['vx',r.vx,'м/с'],['vy',r.vy,'м/с']];
  },
  graphs:[
    {label:'x(t) и y(t) — координаты',unit:'м',series:['x','y'],
     get(s,p){ const r=SIMS.circular.pos(s,p); return [r.x,r.y]; }},
    {label:'v<sub>x</sub>(t) и v<sub>y</sub>(t) — проекции скорости',unit:'м/с',наклон:0,series:['vx','vy'],
     get(s,p){ const r=SIMS.circular.pos(s,p); return [r.vx,r.vy]; }},
    {label:'a<sub>x</sub>(t) и a<sub>y</sub>(t) — проекции ускорения',unit:'м/с²',наклон:1,series:['ax','ay'],
     get(s,p){ const r=SIMS.circular.pos(s,p); return [r.ax,r.ay]; }}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460, H=(vp&&vp.H)||320;
    // нижняя граница 1e-7 (а не 0.002): радиус может быть планетарным —
    // пример «Экватор Земли», R = 6370 км
    const scale=clamp(Math.min((W-70)/(2.6*p.R*PX_PER_M),(H-50)/(2.6*p.R*PX_PER_M)),1e-7,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,p1,p){
    const v=p1, r=this.pos(s,p), K=r.K;
    // окружность
    ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.arc(0,0,p.R,0,7); ctx.stroke();
    // центр
    ctx.fillStyle=v.c('--ink-3'); ctx.beginPath(); ctx.arc(0,0,v.lw(3),0,7); ctx.fill();
    v.label(ctx,'O',0,0,-14,10,v.c('--ink-3'));
    // след
    if(p.trail&&s.trail.length>1&&v.quality!=='low'){
      ctx.strokeStyle=v.c('--accent'); ctx.globalAlpha=.55; ctx.lineWidth=v.lw(2.4);
      ctx.beginPath(); s.trail.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));
      ctx.stroke(); ctx.globalAlpha=1;
    }
    // радиус и угол
    if(p.showR){
      ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(4),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(r.x,r.y); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,`R = ${p.R} м`,r.x/2,r.y/2,6,-8,v.c('--ink-3'));
      ctx.strokeStyle=v.c('--second'); ctx.lineWidth=v.lw(1.3);
      ctx.beginPath(); ctx.arc(0,0,p.R*0.22,0,s.phi,s.phi<0); ctx.stroke();
      v.label(ctx,`φ = ${((s.phi*180/Math.PI)%360).toFixed(0)}°`,
        p.R*0.28*Math.cos(s.phi/2),p.R*0.28*Math.sin(s.phi/2),6,-4,v.c('--second'));
    }
    // векторы: v — по касательной, a_c — к центру
    const vRef=p.mode==='acc'?Math.max(K.v,(p.v0||0)+Math.abs(p.at||0)*4,1e-6):Math.max(K.v,1e-6);
    const kv=p.R/vRef*0.55, ka=p.R/Math.max(p.mode==='acc'?Math.max(K.a,Math.abs(p.at||0)):K.ac,1e-6)*0.55;
    if(K.v>1e-9){ v.arrow(ctx,r.x,r.y,r.x+r.vx*kv,r.y+r.vy*kv,v.c('--measure'));
      v.label(ctx,`v = ${K.v.toFixed(2)} м/с`,r.x+r.vx*kv,r.y+r.vy*kv,8,-10,v.c('--measure')); }
    if(p.showA){
      if(p.mode==='acc'){ const nx=-Math.cos(s.phi), ny=-Math.sin(s.phi);
        ctx.globalAlpha=.55; v.arrow(ctx,r.x,r.y,r.x+nx*K.ac*ka,r.y+ny*K.ac*ka,v.c('--danger'));
        if(Math.abs(K.at)>1e-9) v.arrow(ctx,r.x,r.y,r.x+r.ex*K.at*ka,r.y+r.ey*K.at*ka,v.c('--danger')); ctx.globalAlpha=1;
        if(K.a>1e-9){ v.arrow(ctx,r.x,r.y,r.x+r.ax*ka,r.y+r.ay*ka,v.c('--danger'));
          v.label(ctx,`a = ${K.a.toFixed(2)} м/с²`,r.x+r.ax*ka*0.9,r.y+r.ay*ka*0.9,8,12,v.c('--danger')); } }
      else { v.arrow(ctx,r.x,r.y,r.x+r.ax*ka,r.y+r.ay*ka,v.c('--danger'));
        v.label(ctx,`aц = ${K.ac.toFixed(2)} м/с²`,r.x+r.ax*ka*0.9,r.y+r.ay*ka*0.9,8,12,v.c('--danger')); }
    }
    // тело
    ctx.fillStyle=v.c('--accent'); ctx.beginPath(); ctx.arc(r.x,r.y,v.lw(7),0,7); ctx.fill();
    if(p.mode!=='acc') v.label(ctx,`T = ${K.T.toFixed(2)} с   ω = ${K.w.toFixed(2)} рад/с`,-p.R,-p.R*1.22,0,0,v.c('--ink-3'));
    else v.label(ctx,`aτ = ${K.at.toFixed(2)} м/с²   aₙ = ${K.ac.toFixed(2)} м/с²`,-p.R,-p.R*1.22,0,0,v.c('--ink-3'));
  }
}
,

/* ================== ДИНАМИКА: ВТОРОЙ ЗАКОН, ТРЕНИЕ, УДАРЫ И ИМПУЛЬС ========= */
newton2:{
  title:'Второй закон, трение и удары',
  params:[
    {key:'n',label:'Число тел',min:1,max:3,step:1,default:2},

    {type:'group',label:'Тело 1'},
    {key:'m1',label:'Масса m₁',unit:'кг',min:0.1,max:2000,step:0.1,default:10},
    {key:'x1',label:'Координата x₀',unit:'м',min:-50,max:50,step:0.1,default:0},
    {key:'v1',label:'Скорость v₀',unit:'м/с',min:-50,max:50,step:0.1,default:0},
    {key:'r1',label:'Шероховатое (трение о поверхность)',type:'check',default:true},

    {type:'group',label:'Тело 2',если:p=>(p.n|0)>=2},
    {key:'m2',label:'Масса m₂',unit:'кг',min:0.1,max:2000,step:0.1,default:5},
    {key:'x2',label:'Координата x₀',unit:'м',min:-50,max:50,step:0.1,default:8},
    {key:'v2',label:'Скорость v₀',unit:'м/с',min:-50,max:50,step:0.1,default:0},
    {key:'r2',label:'Шероховатое',type:'check',default:true},

    {type:'group',label:'Тело 3',если:p=>(p.n|0)>=3},
    {key:'m3',label:'Масса m₃',unit:'кг',min:0.1,max:2000,step:0.1,default:5},
    {key:'x3',label:'Координата x₀',unit:'м',min:-50,max:50,step:0.1,default:16},
    {key:'v3',label:'Скорость v₀',unit:'м/с',min:-50,max:50,step:0.1,default:0},
    {key:'r3',label:'Шероховатое',type:'check',default:true},

    {type:'group',label:'Поверхности и удар'},
    {key:'mus',  label:'Статический коэффициент μs',min:0,max:2,step:0.01,default:0.5},
    {key:'mud',  label:'Кинетический коэффициент μd',min:0,max:2,step:0.01,default:0.35},
    {key:'e',    label:'Коэффициент восстановления e (0 — неупругий, 1 — упругий)',min:0,max:1,step:0.05,default:1},
    {key:'g',    label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},

    {type:'group',label:'Приложенная сила'},
    {key:'Flaw',   label:'Закон силы',type:'select',default:'const',options:[{v:'const',t:'постоянная F'},{v:'ramp',t:'растёт со временем: F = αt'}]},
    {key:'F',      label:'Сила F',unit:'Н',min:0,max:20000,step:1,default:0,если:p=>p.Flaw!=='ramp'},
    {key:'Fa',     label:'Скорость роста силы α',unit:'Н/с',min:0,max:5000,step:0.1,default:10,если:p=>p.Flaw==='ramp'},
    {key:'alpha',  label:'Угол приложения α',unit:'°',min:-89,max:89,step:1,default:0},
    {key:'applyTo',label:'К какому телу приложена',min:1,max:3,step:1,default:1,если:p=>(p.n|0)>=2},

    {type:'group',label:'Показывать'},
    {key:'dist',label:'Пройденное расстояние',type:'check',default:true},
    {key:'fbd', label:'Диаграмма сил',type:'check',default:true},
    {key:'poly',label:'Многоугольник сил',type:'check',default:false},

    {type:'group',label:'Остановка таймера'},
    {key:'stopHit', label:'При ударе тел',type:'check',default:true},
    {key:'stopSlip',label:'При срыве / проскальзывании',type:'check',default:true},
    {key:'stopRest',label:'Когда всё остановится',type:'check',default:false},
    {key:'tStop',   label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  N(p){ return Math.min(3,Math.max(1,p.n|0)); },
  /* 9.3.0: сила постоянная или растущая F = αt */
  Fv(p,t){ return p.Flaw==='ramp'?(p.Fa||0)*Math.max(0,t):p.F; },
  /* к какому телу приложена сила: номер больше числа тел — последнее тело,
     иначе при n = 1 и «телу 2» сила молча пропадала бы */
  цель(p){ return Math.min(this.N(p),Math.max(1,p.applyTo|0)); },
  rough(p,i){ return [p.r1,p.r2,p.r3][i]; },
  mass(p,i){ return [p.m1,p.m2,p.m3][i]; },
  half(p,i){ return 0.25+0.12*Math.cbrt(this.mass(p,i)/10); },
  warn(p){
    if(p.mud>p.mus) return 'μd > μs: трение скольжения не может быть больше трения покоя.';
    const al=p.alpha*Math.PI/180;
    if(p.F*Math.sin(al)>=this.mass(p,this.цель(p)-1)*p.g && p.F>0)
      return 'Вертикальная составляющая силы больше веса: тело отрывается от поверхности.';
    if(this.N(p)>1){
      const xs=[p.x1,p.x2,p.x3].slice(0,this.N(p));
      for(let i=1;i<xs.length;i++) if(xs[i]<=xs[i-1]) return 'Тела заданы в перекрывающихся координатах: расставьте их по возрастанию x.';
    }
    return null;
  },
  init(p){
    const n=this.N(p);
    const b=[0,1,2].map(i=>({x:[p.x1,p.x2,p.x3][i], v:[p.v1,p.v2,p.v3][i], a:0, fr:0, N:0,
      x0:[p.x1,p.x2,p.x3][i], path:0}));   // x0 — старт, path — пройденный путь
    return {t:0,b,n,hits:0,dE:0,p0:this.mom(p,b,n),slip:false,event:null,__stop:null};
  },
  mom(p,b,n){ let s=0; for(let i=0;i<n;i++) s+=this.mass(p,i)*b[i].v; return s; },
  kin(p,b,n){ let s=0; for(let i=0;i<n;i++) s+=0.5*this.mass(p,i)*b[i].v**2; return s; },

  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt, n=this.N(p), g=p.g, al=p.alpha*Math.PI/180;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop;
      s.event={t:p.tStop,type:'time'}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
    const Fe=this.Fv(p,t), Fx=Fe*Math.cos(al), Fy=Fe*Math.sin(al);

    {
      /* --- независимые тела на поверхности + удары --- */
      for(let i=0;i<n;i++){
        const b=s.b[i], m=this.mass(p,i);
        const mine=(this.цель(p)===i+1);
        const fx=mine?Fx:0, fy=mine?Fy:0;
        const N=Math.max(0,m*g-fy);
        const muS=this.rough(p,i)?p.mus:0, muD=this.rough(p,i)?p.mud:0;
        let fr,a;
        if(Math.abs(b.v)<1e-6){
          if(Math.abs(fx)<=muS*N){ fr=-fx; a=0; }
          else { fr=-Math.sign(fx)*muD*N; a=(fx+fr)/m;
            if(!s.slip){ s.slip=true;
              if(p.stopSlip&&!(s.done&&s.done.slip)){ s.event={t,type:'slip'};
                s.__stop=`Срыв тела ${i+1}: F·cosα = ${Math.abs(fx).toFixed(1)} Н > μs·N = ${(muS*N).toFixed(1)} Н`;
                return; } }
            b.v+=a*dt; }                                       // 9.3: из покоя тело трогается (раньше скорость не росла)
        } else {
          fr=-Math.sign(b.v)*muD*N; a=(fx+fr)/m;
          const vn=b.v+a*dt;
          if(Math.sign(vn)!==Math.sign(b.v)){                 // трение довело до нуля
            if(Math.abs(fx)<=muS*N){ b.v=0; a=0; fr=-fx; }    // и удерживает — стоп
            else { b.v=vn; }                                   // силы хватает — едет дальше
          } else b.v=vn;
        }
        b.a=a; b.fr=fr; b.N=N;
        const dxStep=b.v*dt; b.x+=dxStep; b.path+=Math.abs(dxStep);
      }
      /* удары: импульс сохраняется всегда, энергия — только при e = 1 */
      for(let i=0;i<n-1;i++){
        const A=s.b[i], Bb=s.b[i+1];
        const hA=this.half(p,i), hB=this.half(p,i+1);
        const gap=hA+hB;
        // геометрический запрет проникновения (на случай слипшихся тел при e=0)
        if(Bb.x-A.x<gap-1e-9 && Math.abs(A.v-Bb.v)<1e-6){
          const mid=(A.x+Bb.x)/2; A.x=mid-gap/2; Bb.x=mid+gap/2;
        }
        if(Bb.x-A.x<=gap && A.v>Bb.v){
          const mA=this.mass(p,i), mB=this.mass(p,i+1), e=p.e;
          const pBefore=mA*A.v+mB*Bb.v, eBefore=0.5*mA*A.v**2+0.5*mB*Bb.v**2;
          const uA=((mA-e*mB)*A.v+(1+e)*mB*Bb.v)/(mA+mB);
          const uB=((mB-e*mA)*Bb.v+(1+e)*mA*A.v)/(mA+mB);
          A.v=uA; Bb.v=uB; s.hits++;
          s.dE=eBefore-(0.5*mA*uA**2+0.5*mB*uB**2);
          const ov=(hA+hB)-(Bb.x-A.x); A.x-=ov/2; Bb.x+=ov/2;
          if(p.stopHit&&!(s.done&&s.done.hit)){
            s.event={t,type:'hit',i};
            s.__stop=`Удар тел ${i+1} и ${i+2}: импульс ${pBefore.toFixed(2)} → ${(mA*uA+mB*uB).toFixed(2)} кг·м/с (сохранился), потеря энергии ${s.dE.toFixed(2)} Дж`;
            return;
          }
        }
      }
    }
    if(p.stopRest && !(s.done&&s.done.rest) && s.t>0.3 &&
       s.b.slice(0,n).every(b=>Math.abs(b.v)<1e-4)){
      s.event={t,type:'rest'};
      s.__stop=`Все тела остановились: t = ${s.t.toFixed(3)} с`;
      return;
    }
    // защита от «улёта в бесконечность»: тело ушло далеко за пределы сцены
    const lim=Math.max(120, 40+Math.abs(s.p0)*4);
    if(!(s.done&&s.done.away) && s.b.slice(0,n).some(b=>Math.abs(b.x)>lim)){
      s.event={t,type:'away'};
      s.__stop=`Тело ушло за пределы сцены (движение без сил равномерно и не заканчивается само).`;
    }
  },

  anchors(s,p){ const n=this.N(p); return s.b.slice(0,n).map(b=>({x:b.x,y:0})).concat([{x:0,y:0}]); },
  readouts(s,p){
    const n=this.N(p);
    const out=[['t',s.t,'с']];
    if(p.Flaw==='ramp') out.push(['сила F = αt',this.Fv(p,s.t),'Н']);
    for(let i=0;i<n;i++){
      const b=s.b[i], tag=n>1?` ${i+1}`:'';
      out.push([`x${tag}`,b.x,'м'],[`v${tag}`,b.v,'м/с'],[`a${tag}`,b.a,'м/с²'],
               [`импульс${tag}`,this.mass(p,i)*b.v,'кг·м/с'],[`трение${tag}`,Math.abs(b.fr),'Н']);
    }
    out.push(['ИМПУЛЬС Σp',this.mom(p,s.b,n),'кг·м/с'],
             ['начальный Σp',s.p0,'кг·м/с'],
             ['кин. энергия ΣE',this.kin(p,s.b,n),'Дж'],
             ['ударов',s.hits,''],
             ['потеря энергии в ударе',s.dE,'Дж']);
    return out;
  },
  graphs:[
    {label:'Σp(t) — суммарный импульс',unit:'кг·м/с',series:['Σp'],
     get(s,p){ const S=SIMS.newton2; return [S.mom(p,s.b,S.N(p)),null]; }},
    {label:'ΣE(t) — кинетическая энергия',unit:'Дж',series:['ΣE'],
     get(s,p){ const S=SIMS.newton2; return [S.kin(p,s.b,S.N(p)),null]; }},
    {label:'v(t) — скорости тел',unit:'м/с',series:['тело 1','тело 2'],
     get(s,p){ return [s.b[0].v, SIMS.newton2.N(p)>1?s.b[1].v:null]; }}
  ],
  presets:[
    {name:'Сила растёт: брусок трогается и разгоняется',values:{n:1,m1:4,x1:0,v1:0,r1:true,mus:0.4,mud:0.3,e:1,g:9.8,Flaw:'ramp',Fa:5,F:0,alpha:0,applyTo:1,stopHit:false,stopSlip:false,stopRest:false,tStop:10}},
    {name:'Пример 2 (Орир): торможение авто, μ = 0,8',
     values:{n:1,m1:1500,x1:0,v1:16.67,r1:true,F:0,alpha:0,mus:0.8,mud:0.8,
             stopRest:true,stopSlip:false,stopHit:false,tStop:0}},
    {name:'Пример 2 (Орир): разгон, тяга 0,4·mg',
     values:{n:1,m1:1500,x1:0,v1:0,r1:false,F:5880,alpha:0,mus:0,mud:0,
             stopSlip:false,stopRest:false,tStop:5}},
    {name:'Сила меньше порога — тело стоит',
     values:{n:1,m1:10,x1:0,v1:0,r1:true,F:30,alpha:0,mus:0.5,mud:0.35,tStop:4}},
    {name:'Абсолютно упругий удар (e = 1), равные массы',
     values:{n:2,m1:2,x1:0,v1:6,r1:false,m2:2,x2:8,v2:0,r2:false,
             e:1,F:0,mus:0,mud:0,stopHit:true,tStop:0}},
    {name:'Абсолютно неупругий удар (e = 0): тела слипаются',
     values:{n:2,m1:2,x1:0,v1:6,r1:false,m2:4,x2:8,v2:0,r2:false,
             e:0,F:0,mus:0,mud:0,stopHit:true,tStop:0}},
    {name:'Встречный удар: импульс сохраняется',
     values:{n:2,m1:3,x1:0,v1:5,r1:false,m2:1,x2:10,v2:-5,r2:false,
             e:0.5,F:0,mus:0,mud:0,stopHit:true,tStop:0}},
    {name:'Три тела: цепочка ударов',
     values:{n:3,m1:2,x1:0,v1:6,r1:false,m2:2,x2:6,v2:0,r2:false,
             m3:2,x3:12,v3:0,r3:false,e:1,F:0,mus:0,mud:0,stopHit:false,tStop:6}},
    {name:'Три тела: цепочка упругих ударов',
     values:{n:3,m1:2,x1:0,v1:6,r1:false,m2:2,x2:6,v2:0,r2:false,
             m3:2,x3:12,v3:0,r3:false,e:1,F:0,mus:0,mud:0,stopHit:false,tStop:6}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, n=this.N(p);
    const xs=[p.x1,p.x2,p.x3].slice(0,n);
    const lo=Math.min(...xs)-3, hi=Math.max(...xs)+Math.max(12,Math.abs(p.v1)*2)+3;
    const spanX=Math.max(hi-lo,10);
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-70)/(10*PX_PER_M)),0.002,30);
    return {x:(lo+hi)/2,y:2,scale};
  },
  draw(ctx,s,v,p){
    const n=this.N(p), cols=[v.c('--accent'),v.c('--second'),v.c('--measure')];
    // пол
    ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(-1e3,0); ctx.lineTo(1e3,0); ctx.stroke();
    ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1);
    for(let k=-60;k<300;k+=0.9){ ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k-0.35,-0.35); ctx.stroke(); }

    const al=p.alpha*Math.PI/180, Fe=this.Fv(p,s.t), Fx=Fe*Math.cos(al), Fy=Fe*Math.sin(al);

    {
      for(let i=0;i<n;i++){
        const b=s.b[i], h=this.half(p,i);
        ctx.fillStyle=cols[i%3]; ctx.fillRect(b.x-h,0,2*h,2*h);
        v.label(ctx,`m${'₁₂₃'[i]} = ${this.mass(p,i)} кг`,b.x,2*h,-30,-12,cols[i%3]);
        v.label(ctx,this.rough(p,i)?'шероховатое':'гладкое',b.x,0,-26,16,v.c('--ink-3'));
        if(Math.abs(b.v)>0.02) v.arrow(ctx,b.x,h,b.x+b.v*0.35,h,v.c('--measure'));
        v.label(ctx,`v = ${b.v.toFixed(2)} м/с`,b.x,h,10,-14,v.c('--measure'));
        // ПРОЙДЕННОЕ РАССТОЯНИЕ: линия от старта до текущего положения
        if(p.dist!==false){
          const yd=-0.8-i*0.75, dx=b.x-b.x0;
          ctx.strokeStyle=cols[i%3]; ctx.globalAlpha=.75; ctx.lineWidth=v.lw(1.5);
          ctx.beginPath(); ctx.moveTo(b.x0,yd); ctx.lineTo(b.x,yd); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(b.x0,yd-0.18); ctx.lineTo(b.x0,yd+0.18);
          ctx.moveTo(b.x,yd-0.18); ctx.lineTo(b.x,yd+0.18); ctx.stroke();
          ctx.globalAlpha=1;
          if(Math.abs(dx)>0.15) v.arrow(ctx,b.x0,yd,b.x,yd,cols[i%3]);
          // пунктир от тела вниз к отметке
          ctx.strokeStyle=cols[i%3]; ctx.globalAlpha=.3; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.lineWidth=v.lw(1);
          ctx.beginPath(); ctx.moveTo(b.x,0); ctx.lineTo(b.x,yd); ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha=1;
          const same=Math.abs(b.path-Math.abs(dx))<0.02;
          v.label(ctx,`s${'₁₂₃'[i]} = ${b.path.toFixed(2)} м`+(same?'':` (смещение ${dx.toFixed(2)} м)`),
            (b.x0+b.x)/2,yd,-30,-9,cols[i%3]);
        }
        if(p.fbd && this.цель(p)===i+1){
          const F=[{fx:0,fy:-this.mass(p,i)*p.g,label:'Fg',color:v.c('--ink-2')},
                   {fx:0,fy:b.N,label:'N',color:v.c('--second')},
                   {fx:b.fr,fy:0,label:'Fтр',color:v.c('--measure')}];
          if(Fe>0) F.push({fx:Fx,fy:Fy,label:'F',color:v.c('--accent')});
          v.fbd(ctx,{x:b.x,y:h,forces:F,len:2.6,resultant:true,sum:p.poly?{x:b.x+8,y:6}:null});
        }
      }
      v.label(ctx,`Σp = ${this.mom(p,s.b,n).toFixed(2)} кг·м/с   (было ${s.p0.toFixed(2)})`,
        s.b[0].x-2,7.2,0,0,v.c('--ink-3'));
      if(s.hits) v.label(ctx,`ударов: ${s.hits}   потеря энергии: ${s.dE.toFixed(2)} Дж`,
        s.b[0].x-2,6.4,0,0,v.c('--ink-3'));
    }
  }
},

/* ================= ДИНАМИКА: НАКЛОННАЯ ПЛОСКОСТЬ ================= */
incline:{
  title:'Наклонная плоскость',
  /* 9.2.0: брусок можно пустить вверх от основания или вниз с вершины, через
     блок на вершине перекинуть нить с грузом m₂, а длину плоскости — сделать
     зависимой от угла при постоянном основании b (задача о самом быстром
     спуске). Координата s отсчитывается от вершины вниз по склону, скорость v
     положительна вниз. Трение всегда против скорости, а в покое — трение покоя,
     пока хватает μs·N. Разворот бруска ловится точно (корень на шаге). */
  params:[
    {type:'group',label:'Тело и плоскость'},
    {key:'m',   label:'Масса бруска m',unit:'кг',min:0.1,max:1000,step:0.1,default:5},
    {key:'th',  label:'Угол наклона θ',unit:'°',min:0,max:85,step:0.5,default:20},
    {key:'mus', label:'Статический коэффициент μs',min:0,max:2,step:0.01,default:0.36},
    {key:'mud', label:'Кинетический коэффициент μd',min:0,max:2,step:0.01,default:0.30},
    {key:'g',   label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},
    {key:'L',   label:'Длина плоскости L',unit:'м',min:1,max:200,step:0.5,default:10,если:p=>!p.baseFix},
    {key:'baseFix',label:'Держать постоянным основание (длина зависит от угла)',type:'check',default:false},
    {key:'b',   label:'Основание b',unit:'м',min:0.5,max:200,step:0.1,default:8,если:p=>!!p.baseFix},
    {type:'group',label:'Пуск'},
    {key:'start',label:'Откуда',type:'select',default:'top',options:[{v:'top',t:'с вершины вниз'},{v:'bottom',t:'от основания вверх'}]},
    {key:'v0',  label:'Начальная скорость вдоль плоскости',unit:'м/с',min:0,max:100,step:0.1,default:0},
    {type:'group',label:'Груз на нити через блок'},
    {key:'m2',  label:'Масса подвешенного груза m₂ (0 — без нити)',unit:'кг',min:0,max:1000,step:0.1,default:0},
    {type:'group',label:'Режим'},
    {key:'auto',label:'Медленно поднимать плоскость до срыва',type:'check',default:false},
    {key:'rate',label:'Скорость подъёма',unit:'°/с',min:0.5,max:30,step:0.5,default:3},
    {key:'fbd', label:'Диаграмма сил',type:'check',default:true},
    {key:'poly',label:'Многоугольник сил',type:'check',default:true},
    {key:'dist',label:'Пройденный путь',type:'check',default:true},
    {type:'group',label:'Остановка таймера'},
    {key:'stopSlip',  label:'В момент срыва (tg θ = μs)',type:'check',default:true},
    {key:'stopBottom',label:'У основания плоскости',type:'check',default:true},
    {key:'stopTurn',  label:'В верхней точке подъёма (брусок остановился)',type:'check',default:false},
    {key:'tStop',     label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  warn(p){
    if(p.mud>p.mus) return 'μd > μs: трение скольжения не может превышать трение покоя.';
    return null;
  },
  ang(s,p){
    if(s.thSlip!=null) return s.thSlip;               // после срыва плоскость больше не поднимаем
    return p.auto ? Math.min(p.th + p.rate*s.t, 85) : p.th;
  },
  Lэф(s,p){ const th=this.ang(s,p)*Math.PI/180; return p.baseFix?p.b/Math.max(Math.cos(th),1e-6):p.L; },
  /* силы при скорости v (вдоль склона, + вниз); груз m₂ тянет вверх по склону */
  forces(s,p,v){
    v=v==null?s.v:v;
    const th=this.ang(s,p)*Math.PI/180, m2=p.m2||0, M=p.m+m2;
    const Fg=p.m*p.g, along=Fg*Math.sin(th), N=Fg*Math.cos(th), lim=p.mus*N;
    const drive=along-m2*p.g;                       // движущая сила системы, + вниз по склону
    const moving=Math.abs(v)>1e-9;
    const stuck=!moving&&Math.abs(drive)<=lim;
    const fr=stuck?-drive:moving?-Math.sign(v)*p.mud*N:-Math.sign(drive)*p.mud*N;
    const a=stuck?0:(drive+fr)/M;
    return {th,Fg,along,N,lim,fr,stuck,a,drive,T:m2*(p.g+a)};
  },
  init(p){ const s0={t:0,s:0,v:0,slipped:false,stopped:false,thSlip:null,event:null,__stop:null,tUp:NaN,tDown:NaN,tTurn:NaN};
    const L=this.Lэф(s0,p);
    if(p.start==='bottom'){ s0.s=L; s0.v=-(p.v0||0); } else { s0.s=0; s0.v=p.v0||0; }
    s0.s0=s0.s; if(Math.abs(s0.v)>1e-9){ s0.slipped=true; s0.thSlip=p.auto?p.th:null; }
    return s0; },
  step(s,dt,p){
    if(s.event) return;
    let t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ t=p.tStop; }
    if(s.stopped){ s.t=t; if(p.tStop>0&&t>=p.tStop){ s.event={t,type:'time'}; s.__stop=`Остановка по времени: t = ${t.toFixed(2)} с`; } return; }
    const n=8, h=(t-s.t)/n;
    for(let k=0;k<n;k++){
      const t0=s.t;
      let f=this.forces(s,p);
      if(f.stuck){ s.t=t0+h; continue; }                     // держится трением покоя
      if(!s.slipped){ const thd=this.ang(s,p); s.slipped=true; s.thSlip=thd;
        if(p.stopSlip&&!(s.done&&s.done.slip)&&Math.abs(s.v)<1e-9){ s.t=t0; s.event={t:t0,type:'slip',th:thd};
          s.__stop=`Срыв при θ = ${thd.toFixed(2)}°  ⇒  μs = tg θ = ${Math.tan(thd*Math.PI/180).toFixed(3)}`; return; } }
      let v1=s.v+f.a*h;
      if(Math.abs(s.v)>1e-9&&Math.sign(v1)!==Math.sign(s.v)){     // брусок остановился на шаге
        const τ=-s.v/f.a; s.s+=s.v*τ+f.a*τ*τ/2; s.t=t0+τ; s.v=0;
        if(isNaN(s.tTurn)){ s.tTurn=s.t; if(s.s0>this.Lэф(s,p)-1e-9&&p.start==='bottom') s.tUp=s.t; }
        if(p.stopTurn&&!(s.done&&s.done.turn)){ s.event={t:s.t,type:'turn'};
          s.__stop=`Брусок остановился: t = ${s.t.toFixed(3)} с, путь ${Math.abs(s.s-s.s0).toFixed(2)} м`; return; }
        continue; }
      s.s+=s.v*h+f.a*h*h/2; s.v=v1; s.t=t0+h;
      const L=this.Lэф(s,p);
      if(s.s>=L&&s.v>0){ const over=s.s-L, τ=over/Math.max(s.v,1e-9); s.t-=τ; s.v-=f.a*τ; s.s=L;
        if(!isNaN(s.tTurn)&&isNaN(s.tDown)) s.tDown=s.t-s.tTurn;
        s.stopped=true; s.v=Math.max(s.v,0);
        if(p.stopBottom&&!(s.done&&s.done.bottom)){ s.event={t:s.t,type:'bottom'};
          s.__stop=`Брусок у основания: t = ${s.t.toFixed(3)} с, v = ${s.v.toFixed(2)} м/с`; }
        s.v=s.event?s.v:0; return; }
      if(s.s<=0&&s.v<0){ s.s=0; s.stopped=true; s.event={t:s.t,type:'top'}; s.__stop=`Брусок дошёл до вершины: t = ${s.t.toFixed(3)} с, v = ${(-s.v).toFixed(2)} м/с`; return; }
    }
    s.t=t;
    if(p.tStop>0&&t>=p.tStop){ s.event={t,type:'time'}; s.__stop=`Остановка по времени: t = ${t.toFixed(2)} с`; }
  },
  geom(s,p){                       // положение бруска на плоскости (вершина в (0,H))
    const th=this.ang(s,p)*Math.PI/180, L=this.Lэф(s,p), H=L*Math.sin(th), X=L*Math.cos(th);
    const x=s.s*Math.cos(th), y=H-s.s*Math.sin(th);
    return {th,H,X,x,y,L};
  },
  anchors(s,p){ const G=this.geom(s,p); return [{x:0,y:0},{x:0,y:G.H},{x:G.X,y:0},{x:G.x,y:G.y}]; },
  readouts(s,p){
    const f=this.forces(s,p), th=this.ang(s,p), out=[['t',s.t,'с'],['угол θ',th,'°'],['tg θ',Math.tan(th*Math.PI/180),''],
      ['вес mg',f.Fg,'Н'],['скатывающая mg·sinθ',f.along,'Н'],['реакция N = mg·cosθ',f.N,'Н'],
      ['порог μs·N',f.lim,'Н'],['модуль трения',Math.abs(f.fr),'Н'],
      ['a (вниз по склону)',f.a,'м/с²'],['путь по плоскости',Math.abs(s.s-s.s0),'м'],['v (вниз по склону)',s.v,'м/с']];
    if(p.baseFix) out.push(['длина плоскости',this.Lэф(s,p),'м']);
    if(p.start==='bottom'||!isNaN(s.tTurn)) out.push(['время до остановки',s.tTurn,'с'],['время обратного спуска',s.tDown,'с']);
    out.push(['θ срыва = arctg μs',Math.atan(p.mus)*180/Math.PI,'°']);
    return out;
  },
  graphs:[
    {label:'v(t) — скорость вдоль плоскости (вниз)',unit:'м/с',series:['v'],get:s=>[s.v,null]},
    {label:'s(t) — координата от вершины',unit:'м',series:['s'],get:s=>[s.s,null]},
    {label:'θ(t) — угол наклона',unit:'°',series:['θ'],get(s,p){ return [SIMS.incline.ang(s,p),null]; }}
  ],
  presets:[
    {name:'Пример 3 (Орир): поднимаем до срыва — найти μs',
     values:{m:5,th:5,mus:0.36,mud:0.30,g:9.8,L:10,baseFix:false,start:'top',v0:0,m2:0,auto:true,rate:3,stopSlip:true,stopBottom:true,stopTurn:false,tStop:0}},
    {name:'Скольжение при θ = 30°',
     values:{m:5,th:30,mus:0.36,mud:0.30,g:9.8,L:10,baseFix:false,start:'top',v0:0,m2:0,auto:false,stopSlip:false,stopBottom:true,stopTurn:false,tStop:0}},
    {name:'Брусок держится: θ = 15°, μs = 0,4',
     values:{m:5,th:15,mus:0.4,mud:0.3,g:9.8,L:10,baseFix:false,start:'top',v0:0,m2:0,auto:false,stopSlip:true,stopBottom:true,stopTurn:false,tStop:6}},
    {name:'Гладкая плоскость (μ = 0)',
     values:{m:5,th:30,mus:0,mud:0,g:9.8,L:10,baseFix:false,start:'top',v0:0,m2:0,auto:false,stopSlip:false,stopBottom:true,stopTurn:false,tStop:0}},
    {name:'Толчок вверх: подъём и спуск',
     values:{m:5,th:15,mus:0.2,mud:0.16,g:9.8,L:20,baseFix:false,start:'bottom',v0:6,m2:0,auto:false,stopSlip:false,stopBottom:true,stopTurn:false,tStop:0}},
    {name:'Груз на нити тянет брусок вверх',
     values:{m:5,th:30,mus:0.15,mud:0.1,g:9.8,L:10,baseFix:false,start:'bottom',v0:0,m2:4,auto:false,stopSlip:false,stopBottom:true,stopTurn:false,tStop:0}},
    {name:'Самый быстрый спуск: основание постоянно',
     values:{m:5,th:49,mus:0.14,mud:0.14,g:9.8,baseFix:true,b:8,start:'top',v0:0,m2:0,auto:false,stopSlip:false,stopBottom:true,stopTurn:false,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, L=p.baseFix?p.b/Math.max(Math.cos(p.th*Math.PI/180),0.2):p.L;
    const spanX=L*2.0, spanY=L*1.75;
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:L*0.5,y:L*0.5,scale};
  },
  draw(ctx,s,v,p){
    const f=this.forces(s,p), G=this.geom(s,p), L=G.L;
    // клин
    ctx.fillStyle=v.c('--panel-2'); ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(G.X,0); ctx.lineTo(0,G.H); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1);
    for(let k=0;k<G.X;k+=Math.max(L/25,0.3)){ ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k-0.3,-0.3); ctx.stroke(); }
    // угол
    ctx.strokeStyle=v.c('--second'); ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.arc(G.X,0,L*0.22,Math.PI-G.th,Math.PI); ctx.stroke();
    v.label(ctx,`θ = ${this.ang(s,p).toFixed(1)}°`,G.X-L*0.3,L*0.06,0,0,v.c('--second'));
    // блок и груз на нити
    const hb=0.25*L/10+0.2;
    if((p.m2||0)>0){ const r=Math.max(hb*0.7,0.15), px=-r*0.2, py=G.H+r*0.9;
      ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.arc(px,py,r,0,7); ctx.stroke();
      const y2=G.H-hb*3+(s.s-s.s0)-(p.start==='bottom'?0:L);   // груз висит вдоль края стола и идёт навстречу бруску
      ctx.beginPath(); ctx.moveTo(G.x-Math.sin(G.th)*0+hb*0,G.y+0.8*hb); ctx.lineTo(px+r*Math.sin(G.th),py+r*Math.cos(G.th)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px-r,py); ctx.lineTo(px-r,y2+hb); ctx.stroke();
      ctx.fillStyle=v.c('--second'); ctx.fillRect(px-r-hb*0.8,y2-hb*0.6,1.6*hb,1.6*hb);
      v.label(ctx,`m₂ = ${p.m2} кг`,px-r,y2,-14,0,v.c('--second')); }
    // брусок (повёрнутый)
    ctx.save();
    ctx.translate(G.x,G.y); ctx.rotate(-G.th);
    ctx.fillStyle=v.c('--accent'); ctx.fillRect(-hb,0,2*hb,1.6*hb);
    ctx.restore();
    v.label(ctx,`m = ${p.m} кг`,G.x,G.y,10,-14,v.c('--accent'));
    v.label(ctx,f.stuck&&Math.abs(s.v)<1e-9?'покой':(s.v<0?'вверх по склону':'вниз по склону'),G.x,G.y,10,-2,f.stuck?v.c('--ink-3'):v.c('--accent'));
    // пройденный путь вдоль плоскости
    if(p.dist!==false && Math.abs(s.s-s.s0)>1e-6){
      const meas=v.c('--measure'), off=0.55*L/10+0.5;
      const s0x=s.s0*Math.cos(G.th), s0y=G.H-s.s0*Math.sin(G.th), ex=G.x, ey=G.y;
      const nx=Math.sin(G.th), ny=Math.cos(G.th);
      const ax=s0x-nx*off, ay=s0y-ny*off, bx=ex-nx*off, by=ey-ny*off;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
      v.arrow(ctx,ax,ay,bx,by,meas);
      v.label(ctx,`${Math.abs(s.s-s.s0).toFixed(2)} м`,(ax+bx)/2,(ay+by)/2,-40,-10,meas);
    }
    // диаграмма сил в точке бруска
    if(p.fbd){
      const n=[Math.sin(G.th),Math.cos(G.th)];        // нормаль к плоскости
      const tvec=[Math.cos(G.th),-Math.sin(G.th)];    // вдоль плоскости, вниз по склону
      const F=[
        {fx:0,fy:-f.Fg,label:'Fg',color:v.c('--ink-2')},
        {fx:n[0]*f.N,fy:n[1]*f.N,label:'N',color:v.c('--second')},
        {fx:tvec[0]*f.fr,fy:tvec[1]*f.fr,label:'Fтр',color:v.c('--measure')}
      ];
      if((p.m2||0)>0) F.push({fx:-tvec[0]*f.T,fy:-tvec[1]*f.T,label:'T',color:v.c('--ink')});
      v.fbd(ctx,{x:G.x,y:G.y+0.45,forces:F,len:L*0.20,resultant:!f.stuck,
                 sum:p.poly?{x:G.X*0.62,y:G.H*1.12}:null});
    }
  }
},

/* ================= ДИНАМИКА: БРУСОК НА ДОСКЕ (9.2.0) =================
   Доска m₁ лежит на столе (трение о стол μ₀), на ней брусок m₂ (трение о
   доску μ). Сила F — постоянная или растущая как F = αt — приложена к доске
   или к бруску. Пока тела едут вместе, у них общее ускорение, а трение между
   ними ровно такое, какое нужно бруску (доске) для этого ускорения. Когда
   нужное трение превышает μm₂g, брусок проскальзывает, и трение становится
   кинетическим, против относительной скорости. Камера следит за доской:
   движение стола видно по уплывающим штрихам. */
plank:{
  title:'Брусок на доске',
  params:[
    {type:'group',label:'Доска и брусок'},
    {key:'m1', label:'Масса доски m₁',unit:'кг',min:0.1,max:500,step:0.1,default:3},
    {key:'m2', label:'Масса бруска m₂',unit:'кг',min:0.1,max:500,step:0.1,default:1},
    {key:'mu', label:'Трение бруска о доску μ',min:0,max:2,step:0.01,default:0.3},
    {key:'mu0',label:'Трение доски о стол μ₀',min:0,max:2,step:0.01,default:0},
    {key:'Lp', label:'Длина доски l',unit:'м',min:0.2,max:50,step:0.1,default:2},
    {key:'g',  label:'Ускорение g',unit:'м/с²',min:1,max:30,step:0.1,default:9.8},
    {type:'group',label:'Сила'},
    {key:'on', label:'Приложена',type:'select',default:'plank',options:[{v:'plank',t:'к доске'},{v:'bar',t:'к бруску'}]},
    {key:'law',label:'Закон',type:'select',default:'const',options:[{v:'const',t:'постоянная F'},{v:'ramp',t:'растёт: F = αt'}]},
    {key:'F',  label:'Сила F',unit:'Н',min:0,max:5000,step:0.1,default:8,если:p=>p.law==='const'},
    {key:'al', label:'Скорость роста силы α',unit:'Н/с',min:0.01,max:500,step:0.01,default:2,если:p=>p.law==='ramp'},
    {type:'group',label:'Остановка таймера'},
    {key:'stopSlip',label:'В момент начала скольжения',type:'check',default:true},
    {key:'stopOff', label:'Когда брусок соскользнёт с доски',type:'check',default:true},
    {key:'tStop',   label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  Fв(p,t){ return p.law==='ramp'?p.al*t:p.F; },
  /* ускорения доски и бруска, сила трения на брусок и режим */
  разбор(p,t,v1,v2){
    const F=this.Fв(p,t), Fp=p.on==='plank'?F:0, Fb=p.on==='bar'?F:0, M=p.m1+p.m2, g=p.g;
    const тр=p.mu*p.m2*g, N0=M*g, тр0=p.mu0*N0;
    const стол=(v,нужно)=>Math.abs(v)>1e-9?-Math.sign(v)*тр0:(Math.abs(нужно)<=тр0?-нужно:-Math.sign(нужно)*тр0);
    if(Math.abs(v2-v1)<1e-9){                         // едут вместе?
      const f0=стол(v1,F), a=(F+f0)/M, f12=p.m2*a-Fb;
      if(Math.abs(f0+F)<1e-12&&Math.abs(v1)<1e-9) return {a1:0,a2:0,f:-Fb,вместе:true,F,f0};
      if(Math.abs(f12)<=тр+1e-12) return {a1:a,a2:a,f:f12,вместе:true,F,f0};
      const f=Math.sign(f12)*тр, f0b=стол(v1,Fp-f); return {a1:(Fp-f+f0b)/p.m1,a2:(Fb+f)/p.m2,f,вместе:false,F,f0:f0b}; }
    const f=-Math.sign(v2-v1)*тр, f0=стол(v1,Fp-f);
    return {a1:(Fp-f+f0)/p.m1,a2:(Fb+f)/p.m2,f,вместе:false,F,f0}; },
  init(p){ return {t:0,x1:0,v1:0,x2:0,v2:0,скольз:false,tSlip:NaN,event:null,__stop:null}; },
  step(s,dt,p){ if(s.event) return; let end=s.t+dt; if(p.tStop>0) end=Math.min(end,p.tStop);
    const n=10, h=(end-s.t)/n;
    for(let k=0;k<n;k++){ const r=this.разбор(p,s.t+h/2,s.v1,s.v2);
      const rel0=s.v2-s.v1;
      let v1=s.v1+r.a1*h, v2=s.v2+r.a2*h;
      if(Math.abs(rel0)>1e-9&&Math.sign(v2-v1)!==Math.sign(rel0)){ const v=(p.m1*v1+p.m2*v2)/(p.m1+p.m2); v1=v; v2=v; }   // скольжение кончилось
      if(Math.abs(s.v1)>1e-9&&Math.sign(v1)!==Math.sign(s.v1)&&!r.F) v1=0;
      s.x1+=(s.v1+v1)/2*h; s.x2+=(s.v2+v2)/2*h; s.v1=v1; s.v2=v2; s.t+=h;
      if(!r.вместе&&!s.скольз){ s.скольз=true; s.tSlip=s.t-h/2;
        if(p.stopSlip){ s.event={type:'slip',t:s.tSlip}; s.__stop=`Брусок начал скользить: t = ${s.tSlip.toFixed(3)} с, F = ${this.Fв(p,s.tSlip).toFixed(2)} Н`; return; } }
      if(Math.abs(s.x2-s.x1)>p.Lp/2){ s.event={type:'off',t:s.t}; s.__stop=`Брусок соскользнул с доски: t = ${s.t.toFixed(3)} с`;
        if(p.stopOff) return; s.event=null; }
    }
    if(p.tStop>0&&s.t>=p.tStop-1e-9){ s.event={type:'time',t:s.t}; s.__stop=`Остановка по времени: t = ${s.t.toFixed(2)} с`; } },
  readouts(s,p){ const r=this.разбор(p,s.t,s.v1,s.v2);
    return [['t',s.t,'с'],['сила F',r.F,'Н'],['ускорение доски',r.a1,'м/с²'],['ускорение бруска',r.a2,'м/с²'],
      ['трение между ними',Math.abs(r.f),'Н'],['скорость доски',s.v1,'м/с'],['скорость бруска',s.v2,'м/с'],
      ['брусок сместился по доске',s.x2-s.x1,'м'],['сейчас',r.вместе&&Math.abs(s.v2-s.v1)<1e-9?'едут вместе':'брусок скользит','']]; },
  graphs:[
    {label:'Ускорения доски и бруска',unit:'м/с²',series:['доска','брусок'],get(s,p){ const r=SIMS.plank.разбор(p,s.t,s.v1,s.v2); return [r.a1,r.a2]; }},
    {label:'Скорости доски и бруска',unit:'м/с',series:['доска','брусок'],get(s){ return [s.v1,s.v2]; }}
  ],
  presets:[
    {name:'Сила растёт: когда брусок поедет по доске',values:{m1:3,m2:1,mu:0.3,mu0:0,Lp:2,g:9.8,on:'plank',law:'ramp',al:2,stopSlip:true,stopOff:true,tStop:0}},
    {name:'Сила мала: едут вместе',values:{m1:3,m2:1,mu:0.3,mu0:0,Lp:2,g:9.8,on:'plank',law:'const',F:8,stopSlip:true,stopOff:true,tStop:4}},
    {name:'Рывок за доску: брусок соскальзывает',values:{m1:3,m2:1,mu:0.3,mu0:0,Lp:2,g:9.8,on:'plank',law:'const',F:25,stopSlip:false,stopOff:true,tStop:0}},
    {name:'Тянем брусок: доска едет следом',values:{m1:3,m2:1,mu:0.3,mu0:0,Lp:2,g:9.8,on:'bar',law:'const',F:6,stopSlip:false,stopOff:true,tStop:0}},
    {name:'Шероховатый стол',values:{m1:3,m2:1,mu:0.3,mu0:0.1,Lp:2,g:9.8,on:'plank',law:'ramp',al:3,stopSlip:false,stopOff:true,tStop:0}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, w=p.Lp*1.9, h=p.Lp*1.0;
    const scale=clamp(Math.min((W-60)/(w*PX_PER_M),(H-60)/(h*PX_PER_M)),0.002,40); return {x:0,y:p.Lp*0.22,scale}; },
  anchors(s,p){ return [{x:-p.Lp/2,y:0},{x:p.Lp/2,y:0}]; },
  draw(ctx,s,v,p){
    const пк=1/ppm(), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure');
    const r=this.разбор(p,s.t,s.v1,s.v2), L=p.Lp, th=Math.max(L*0.06,4*пк), hb=Math.min(L*0.18,Math.max(L*0.1,14*пк));
    // стол: штрихи уплывают — камера едет вместе с доской
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(-L*3,0); ctx.lineTo(L*3,0); ctx.stroke();
    const шаг=L/8, сдв=((s.x1%шаг)+шаг)%шаг; ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
    for(let x=-L*3-сдв;x<L*3;x+=шаг){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x-шаг*0.4,-шаг*0.4); ctx.stroke(); }
    // доска и брусок
    ctx.fillStyle=sec; ctx.globalAlpha=.85; ctx.fillRect(-L/2,0,L,th); ctx.globalAlpha=1;
    const xb=s.x2-s.x1; ctx.fillStyle=acc; ctx.fillRect(xb-hb/2,th,hb,hb);
    v.label(ctx,`доска m₁ = ${p.m1} кг`,-L/2,0,0,16,sec); v.label(ctx,`брусок m₂ = ${p.m2} кг`,xb,th+hb,0,-14,acc);
    // сила и трение: длины стрелок — в одной шкале, самая длинная — 0,4 длины доски
    const Fmax=Math.max(r.F,Math.abs(r.f),1e-9), Fk=0.4*L/Fmax, Fy=p.on==='plank'?th/2:th+hb/2, Fx=p.on==='plank'?L/2:xb+hb/2;
    if(r.F>1e-9){ v.arrow(ctx,Fx,Fy,Fx+r.F*Fk,Fy,v.c('--ink')); v.label(ctx,`F = ${r.F.toFixed(1)} Н`,Fx+r.F*Fk,Fy,6,-10,v.c('--ink')); }
    if(Math.abs(r.f)>1e-9){ const y=th+hb*1.25; v.arrow(ctx,xb,y,xb+r.f*Fk,y,meas); v.label(ctx,`трение на брусок ${Math.abs(r.f).toFixed(2)} Н`,xb+r.f*Fk,y,0,-12,meas); }
    v.label(ctx,r.вместе&&Math.abs(s.v2-s.v1)<1e-9?'едут вместе':'брусок скользит по доске',0,-L*0.12,0,0,r.вместе?ink3:meas);
    v.label(ctx,`v доски ${s.v1.toFixed(2)} м/с · v бруска ${s.v2.toFixed(2)} м/с`,0,-L*0.2,0,0,ink3);
  },
  /* ---- инструмент модели: «Сила» — потяните от тела, к которому она приложена ---- */
  tools(p){ return [{id:'force', name:'Сила', cursor:'ew-resize',
    icon:'<rect x="3" y="12" width="9" height="6"/><path d="M12 15h9M18 12l3 3-3 3"/>',
    hint:'потяните вправо: длина — сила F (или скорость её роста α); ←/→ — по 1 Н',
    down(т){ т.выбор.x0=т.px; т.выбор.F0=т.p.law==='ramp'?т.p.al:т.p.F; return true; },
    move(т){ const кл=т.p.law==='ramp'?'al':'F'; т.set(кл,Math.max(0,т.выбор.F0+(т.px-т.выбор.x0)*(т.p.law==='ramp'?0.02:0.1))); },
    key(k,т){ const кл=т.p.law==='ramp'?'al':'F', зн={ArrowRight:1,ArrowLeft:-1}[k]; if(!зн) return false; т.set(кл,Math.max(0,т.p[кл]+зн*(т.shift?10:1)*(т.p.law==='ramp'?0.1:1))); return true; },
    overlay(o,т){ const кл=т.p.law==='ramp'?'α':'F', зн=т.p.law==='ramp'?т.p.al+' Н/с':т.p.F+' Н'; VIEW.label(o,`${кл} = ${зн}`,т.wx||0,т.wy||0,12,-14,css('--accent')); }}]; }
},

/* ================= ЭНЕРГИЯ: МЁРТВАЯ ПЕТЛЯ, СФЕРА, НИТЬ (9.2.0) =================
   Три задачи об отрыве от опоры. Тело скользит без трения по окружности
   радиуса R; скорость в каждой точке даёт закон сохранения энергии, а сила
   реакции (натяжение) — второй закон для центростремительного ускорения:
     внутри петли и на нити  N = m(v²/R + g·cos φ), φ от нижней точки;
     снаружи сферы           N = m(g·cos θ − v²/R), θ от верхней точки.
   Опора может только толкать (нить — только тянуть): когда N обращается в
   нуль, тело отрывается и дальше летит как брошенное. В опыте с петлёй тело
   скатывается с горки высотой h; путь описан одной координатой q: горка —
   q &lt; 0, петля — 0 ≤ q ≤ 2πR, дальше — ровный пол. */
loop:{
  title:'Мёртвая петля, сфера и нить',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'loop',options:[{v:'loop',t:'горка и мёртвая петля'},{v:'sphere',t:'соскальзывание с вершины сферы'},{v:'thread',t:'шарик на нити'}]},
    {type:'group',label:'Размеры'},
    {key:'R',  label:'Радиус петли, сферы или длина нити R',unit:'м',min:0.2,max:50,step:0.1,default:2},
    {key:'h',  label:'Высота старта на горке h',unit:'м',min:0.1,max:200,step:0.1,default:5,если:p=>p.mode==='loop'},
    {key:'th0',label:'Начальный угол нити от вертикали',unit:'°',min:0,max:180,step:1,default:90,если:p=>p.mode==='thread'},
    {key:'v0', label:'Начальная скорость',unit:'м/с',min:0,max:100,step:0.1,default:0},
    {key:'m',  label:'Масса m',unit:'кг',min:0.01,max:100,step:0.01,default:1},
    {key:'g',  label:'Ускорение g',unit:'м/с²',min:1,max:30,step:0.1,default:9.8},
    {type:'group',label:'Остановка таймера'},
    {key:'stopDetach',label:'В момент отрыва (N = 0)',type:'check',default:true},
    {key:'stopBottom',label:'В нижней точке (нить, петля)',type:'check',default:false},
    {key:'tStop',     label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  β:40*Math.PI/180,                                     // угол горки
  D(p){ return 1.3*p.R; },                               // ровный участок от горки до петли
  центр(p){ return p.mode==='loop'?[this.D(p),p.R]:[0,0]; },
  /* положение и единичная касательная по координате q (опыт с петлёй) */
  точкаПетли(p,q){ const R=p.R, β=this.β, D=this.D(p);
    if(q<0){ const d=-q; return {x:-d*Math.cos(β),y:d*Math.sin(β),tx:Math.cos(β),ty:-Math.sin(β),уч:'горка'}; }
    if(q<D) return {x:q,y:0,tx:1,ty:0,уч:'пол'};
    if(q<=D+2*Math.PI*R){ const f=(q-D)/R; return {x:D+R*Math.sin(f),y:R-R*Math.cos(f),tx:Math.cos(f),ty:Math.sin(f),уч:'петля',f}; }
    return {x:q-2*Math.PI*R,y:0,tx:1,ty:0,уч:'пол'}; },
  init(p){
    const s={t:0,полёт:null,event:null,__stop:null,E0:0};
    if(p.mode==='loop'){ s.q=-p.h/Math.sin(this.β); s.w=p.v0; }
    else if(p.mode==='sphere'){ s.f=p.v0>0?0:0.02; s.w=p.v0/p.R; }           // f — угол от верха; без скорости — лёгкий толчок
    else { s.f=p.th0*Math.PI/180; s.w=-p.v0/p.R; }                         // f — угол от низа
    const st=this.сост(s,p); s.E0=p.m*(st.v*st.v/2+p.g*st.y); return s; },
  /* положение, скорость, сила реакции в текущем состоянии */
  сост(s,p){ const R=p.R, g=p.g, m=p.m;
    if(s.полёт){ const f=s.полёт; return {x:f.x,y:f.y,vx:f.vx,vy:f.vy,v:Math.hypot(f.vx,f.vy),N:0,угол:NaN,где:'в полёте'}; }
    if(p.mode==='loop'){ const т=this.точкаПетли(p,s.q), v=s.w;
      const N=т.уч==='петля'?m*(v*v/R+g*Math.cos(т.f)):т.уч==='горка'?m*g*Math.cos(this.β):m*g;
      return {x:т.x,y:т.y,vx:т.tx*v,vy:т.ty*v,v:Math.abs(v),N,угол:т.уч==='петля'?т.f*180/Math.PI:NaN,где:т.уч}; }
    if(p.mode==='sphere'){ const f=s.f, v=R*s.w; return {x:R*Math.sin(f),y:R*Math.cos(f),vx:v*Math.cos(f),vy:-v*Math.sin(f),v:Math.abs(v),N:m*(g*Math.cos(f)-v*v/R),угол:f*180/Math.PI,где:'на сфере'}; }
    const f=s.f, v=R*s.w; return {x:R*Math.sin(f),y:-R*Math.cos(f),vx:v*Math.cos(f),vy:v*Math.sin(f),v:Math.abs(v),N:m*(v*v/R+g*Math.cos(f)),угол:f*180/Math.PI,где:'на нити'}; },
  ускор(p,s,q,w){ const g=p.g, R=p.R;
    if(p.mode==='loop'){ const D=this.D(p); if(q<0) return g*Math.sin(this.β); if(q<D) return 0; if(q<=D+2*Math.PI*R) return -g*Math.sin((q-D)/R); return 0; }
    if(p.mode==='sphere') return g/R*Math.sin(q);
    return -g/R*Math.sin(q); },
  step(s,dt,p){ if(s.event) return; let end=s.t+dt; if(p.tStop>0) end=Math.min(end,p.tStop);
    const n=20, h=(end-s.t)/n, R=p.R, C=this.центр(p);
    for(let k=0;k<n;k++){
      if(s.полёт){ const f=s.полёт; f.x+=f.vx*h; f.vy-=p.g*h; f.y+=f.vy*h; s.t+=h;
        const r=Math.hypot(f.x-C[0],f.y-C[1]);
        if(p.mode==='sphere'&&f.y<=-R){ s.event={type:'land',t:s.t}; s.__stop=`Тело упало на землю: t = ${s.t.toFixed(3)} с`; return; }
        if(p.mode!=='sphere'&&r>=R&&f.vy*(f.y-C[1])+f.vx*(f.x-C[0])>0){ s.event={type:'catch',t:s.t};
          s.__stop=p.mode==='thread'?`Нить снова натянулась: t = ${s.t.toFixed(3)} с`:`Тело ударилось о петлю: t = ${s.t.toFixed(3)} с`; return; }
        if(f.y<=0&&p.mode==='loop'){ s.event={type:'land',t:s.t}; s.__stop=`Тело упало на пол: t = ${s.t.toFixed(3)} с`; return; }
        continue; }
      const key=p.mode==='loop'?'q':'f', x=s[key], w=s.w;
      // Рунге — Кутта для x'' = a(x)
      const a1=this.ускор(p,s,x,w), a2=this.ускор(p,s,x+h/2*w,w+h/2*a1), a3=this.ускор(p,s,x+h/2*(w+h/2*a1),w+h/2*a2), a4=this.ускор(p,s,x+h*(w+h/2*a2),w+h*a3);
      const x1=x+h*w+h*h/6*(a1+a2+a3), w1=w+h/6*(a1+2*a2+2*a3+a4);
      const было=this.сост(s,p);
      s[key]=x1; s.w=w1; s.t+=h;
      if(p.mode==='loop'&&s.q< -p.h/Math.sin(this.β)){ s.q=-p.h/Math.sin(this.β); s.w=Math.max(0,s.w); }
      const ст=this.сост(s,p);
      // нижняя точка: φ меняет знак (нить, петля)
      if(p.stopBottom&&p.mode!=='sphere'){ const ф0=p.mode==='loop'?x:x, ф1=p.mode==='loop'?x1:x1;
        const D=this.D(p), пере=p.mode==='loop'?(ф0<D&&ф1>=D)||(ф0<D+2*Math.PI*R&&ф1>=D+2*Math.PI*R):(Math.sign(ф0)!==Math.sign(ф1)&&ф0!==0);
        if(пере){ s.event={type:'bottom',t:s.t}; s.__stop=`Нижняя точка: v = ${ст.v.toFixed(2)} м/с, ${p.mode==='thread'?'натяжение':'реакция'} ${ст.N.toFixed(2)} Н`; return; } }
      // отрыв: сила реакции стала отрицательной (на петле — только в её верхней половине)
      const можно=p.mode==='sphere'||p.mode==='thread'||(ст.где==='петля');
      if(можно&&ст.N<0){ // уточняем момент линейно по N
        const d=было.N/(было.N-ст.N), xs=x+(x1-x)*d, ws=w+(w1-w)*d; s[key]=xs; s.w=ws; s.t-=h*(1-d);
        const о=this.сост(s,p); s.полёт={x:о.x,y:о.y,vx:о.vx,vy:о.vy}; s.отрыв={x:о.x,y:о.y,v:о.v,угол:о.угол,t:s.t};
        if(p.stopDetach){ s.event={type:'detach',t:s.t};
          const выс=p.mode==='loop'?о.y:p.mode==='sphere'?о.y:о.y;
          s.__stop=`Отрыв: t = ${s.t.toFixed(3)} с, высота ${выс.toFixed(3)} м, скорость ${о.v.toFixed(3)} м/с, угол ${о.угол.toFixed(1)}°`; return; }
      }
    }
    if(p.tStop>0&&s.t>=p.tStop-1e-9){ s.event={type:'time',t:s.t}; s.__stop=`Остановка по времени: t = ${s.t.toFixed(2)} с`; } },
  readouts(s,p){ const с=this.сост(s,p), E=p.m*(с.v*с.v/2+p.g*с.y);
    return [['t',s.t,'с'],['скорость v',с.v,'м/с'],['высота y',с.y,'м'],
      [p.mode==='thread'?'натяжение нити T':'сила реакции N',с.N,'Н'],[p.mode==='thread'?'T / mg':'N / mg',с.N/(p.m*p.g),''],
      [p.mode==='sphere'?'угол от вершины':'угол от нижней точки',с.угол,'°'],['полная энергия',E,'Дж'],['где тело',с.где,'']]; },
  graphs:[
    {label:'Сила реакции (натяжение)',unit:'Н',series:['N'],get(s,p){ return [SIMS.loop.сост(s,p).N,null]; }},
    {label:'Скорость',unit:'м/с',series:['v'],get(s,p){ return [SIMS.loop.сост(s,p).v,null]; }}
  ],
  presets:[
    {name:'Петля пройдена: h чуть выше 2,5R',values:{mode:'loop',R:2,h:5.4,v0:0,m:1,g:9.8,stopDetach:true,stopBottom:false,tStop:0}},
    {name:'Не хватило высоты: отрыв в верхней половине',values:{mode:'loop',R:2,h:4,v0:0,m:1,g:9.8,stopDetach:false,stopBottom:false,tStop:0}},
    {name:'Слишком низко: тело катается туда-обратно',values:{mode:'loop',R:2,h:1.5,v0:0,m:1,g:9.8,stopDetach:true,stopBottom:false,tStop:8}},
    {name:'Соскальзывание с вершины сферы',values:{mode:'sphere',R:2,v0:0,m:1,g:9.8,stopDetach:false,stopBottom:false,tStop:0}},
    {name:'Шарик на нити отпущен из горизонтального положения',values:{mode:'thread',R:2,th0:90,v0:0,m:1,g:9.8,stopDetach:true,stopBottom:false,tStop:0}},
    {name:'Шарик на нити: толкнули слабо — нить провисла',values:{mode:'thread',R:2,th0:0,v0:8.5,m:1,g:9.8,stopDetach:false,stopBottom:false,tStop:0}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460, H=(vp&&vp.H)||320, R=p.R;
    let x0,x1,y0,y1;
    if(p.mode==='loop'){ const d=p.h/Math.tan(this.β); x0=-d-0.3*R; x1=this.D(p)+1.6*R; y0=-0.3*R; y1=Math.max(p.h,2.5*R)*1.12; }
    else if(p.mode==='sphere'){ x0=-1.3*R; x1=2.6*R; y0=-1.15*R; y1=1.35*R; }
    else { x0=-1.35*R; x1=1.35*R; y0=-1.3*R; y1=1.3*R; }
    const scale=clamp(Math.min((W-50)/((x1-x0)*PX_PER_M),(H-50)/((y1-y0)*PX_PER_M)),0.005,40);
    return {x:(x0+x1)/2,y:(y0+y1)/2,scale}; },
  anchors(s,p){ const c=this.центр(p), с=this.сост(s,p); return [{x:c[0],y:c[1]},{x:с.x,y:с.y}]; },
  draw(ctx,s,v,p){
    const R=p.R, C=this.центр(p), пк=1/ppm(), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second');
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2.2);
    if(p.mode==='loop'){ const d=p.h/Math.tan(this.β);
      ctx.beginPath(); ctx.moveTo(-d,p.h); ctx.lineTo(0,0); ctx.lineTo(this.D(p)+3*R,0); ctx.stroke();
      ctx.beginPath(); ctx.arc(C[0],C[1],R,0,7); ctx.stroke();
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(-d-0.3*R,2.5*R); ctx.lineTo(this.D(p)+1.4*R,2.5*R); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'h = 2,5R',-d-0.3*R,2.5*R,4,-10,ink3); v.label(ctx,`h = ${p.h} м`,-d,p.h,8,-12,ink3); }
    else if(p.mode==='sphere'){ ctx.fillStyle=v.c('--panel-2'); ctx.beginPath(); ctx.arc(0,0,R,0,7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1.3*R,-R); ctx.lineTo(2.6*R,-R); ctx.stroke();
      const c=2/3+(p.v0*p.v0)/(3*p.g*R); if(c<=1){ const a=Math.acos(c); ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(4)]);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(R*1.15*Math.sin(a),R*1.15*Math.cos(a)); ctx.stroke(); ctx.setLineDash([]); } }
    else { ctx.fillStyle=ink2; ctx.fillRect(-0.4*R,0,0.8*R,0.06*R); ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(4)]);
      ctx.beginPath(); ctx.arc(0,0,R,0,7); ctx.stroke(); ctx.setLineDash([]); }
    const с=this.сост(s,p);
    if(p.mode==='thread'&&!s.полёт){ ctx.strokeStyle=v.c('--ink'); ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(с.x,с.y); ctx.stroke(); }
    if(p.mode==='thread'&&s.полёт){ ctx.strokeStyle=v.c('--ink'); ctx.lineWidth=v.lw(1.1); ctx.globalAlpha=.6; ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(с.x*0.4,с.y*0.4-0.3*R,с.x,с.y); ctx.stroke(); ctx.globalAlpha=1; }
    // точка отрыва
    if(s.отрыв){ ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(s.отрыв.x,s.отрыв.y,v.lw(4),0,7); ctx.fill();
      v.label(ctx,`отрыв на высоте ${s.отрыв.y.toFixed(2)} м`,s.отрыв.x,s.отрыв.y,10,-14,dang); }
    // скорость и сила реакции
    const k=Math.min(0.35*R/Math.max(с.v,1e-9),8*пк*10);
    if(с.v>1e-6) v.arrow(ctx,с.x,с.y,с.x+с.vx*k,с.y+с.vy*k,meas);
    if(!s.полёт&&Math.abs(с.N)>1e-9&&с.где!=='горка'&&с.где!=='пол'){ const nx=(C[0]-с.x)/R, ny=(C[1]-с.y)/R, kN=0.3*R/(p.m*p.g)*Math.sign(p.mode==='sphere'?-1:1);
      v.arrow(ctx,с.x,с.y,с.x+nx*с.N*kN,с.y+ny*с.N*kN,sec); v.label(ctx,`${p.mode==='thread'?'T':'N'} = ${с.N.toFixed(1)} Н`,с.x+nx*с.N*kN,с.y+ny*с.N*kN,8,10,sec); }
    ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(с.x,с.y,Math.max(0.07*R,v.lw(6)),0,7); ctx.fill();
  },
  /* ---- инструмент модели: «Старт» — тяните тело: по горке — высота, на нити — угол ---- */
  tools(p){ const S1=this; return [{id:'start', name:'Точка старта', cursor:'grab',
    icon:'<circle cx="12" cy="12" r="7"/><circle cx="17" cy="7" r="2.2"/>',
    hint:'потяните тело: на горке — высота старта h, на нити — начальный угол; ↑/↓ — по 0,1 м или 1°',
    down(т){ return т.p.mode!=='sphere'; },
    move(т){ if(т.p.mode==='loop'){ т.set('h',Math.max(0.1,т.wy)); return; }
      if(т.p.mode==='thread'){ т.set('th0',Math.abs(Math.atan2(т.wx,-т.wy))*180/Math.PI); } },
    key(k,т){ const зн={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[k]; if(!зн) return false;
      if(т.p.mode==='loop'){ т.set('h',Math.max(0.1,т.p.h+зн*(т.shift?1:0.1))); return true; }
      if(т.p.mode==='thread'){ т.set('th0',т.p.th0+зн*(т.shift?10:1)); return true; } return false; },
    overlay(o,т){ const t=т.p.mode==='loop'?`h = ${т.p.h} м (порог ${(2.5*т.p.R).toFixed(2)} м)`:т.p.mode==='thread'?`θ₀ = ${т.p.th0}°`:''; if(t) VIEW.label(o,t,т.wx||0,т.wy||0,12,-14,css('--accent')); }}]; }
},

/* ================= ДИНАМИКА: КОНИЧЕСКИЙ МАЯТНИК ================= */
conical:{
  title:'Конический маятник',
  params:[
    {type:'group',label:'Маятник'},
    {key:'m', label:'Масса груза m',unit:'кг',min:0.05,max:100,step:0.05,default:1},
    {key:'L', label:'Длина нити L',unit:'м',min:0.2,max:50,step:0.1,default:2},
    {key:'th',label:'Угол нити с вертикалью θ',unit:'°',min:1,max:85,step:0.5,default:30},
    {key:'g', label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},
    {type:'group',label:'Показывать'},
    {key:'fbd', label:'Диаграмма сил',type:'check',default:true},
    {key:'poly',label:'Многоугольник сил (T + mg = центростремит.)',type:'check',default:true},
    {type:'group',label:'Остановка таймера'},
    {key:'turns',label:'Через N оборотов (0 — выкл)',min:0,max:100,step:0.25,default:0},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  kin(p){
    const th=p.th*Math.PI/180;
    const R=p.L*Math.sin(th), hh=p.L*Math.cos(th);
    const T=p.m*p.g/Math.cos(th);            // натяжение нити
    const ac=p.g*Math.tan(th);               // центростремительное ускорение
    const v=Math.sqrt(ac*R);
    const per=2*Math.PI*Math.sqrt(hh/p.g);   // период обращения
    return {th,R,h:hh,T,ac,v,per,w:2*Math.PI/per};
  },
  init(p){ return {t:0,phi:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const K=this.kin(p), t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.phi=K.w*p.tStop;
      s.event={t:p.tStop,type:'time'}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    if(p.turns>0){ const te=p.turns*K.per;
      if(t>=te&&!(s.done&&s.done.turns)){ s.t=te; s.phi=K.w*te; s.event={t:te,type:'turns'};
        s.__stop=`Пройдено ${p.turns} оборот(а): t = ${te.toFixed(3)} с (период T = ${K.per.toFixed(3)} с)`; return; } }
    s.t=t; s.phi=K.w*t;
  },
  /* Проекция 3D → 2D: экранный вектор = (X, Y + kZ). Через неё нужно пропускать
     и координаты, и СИЛЫ — иначе сумма сил на экране получается неверной.        */
  PZ:0.38,
  prj(x,y,z){ return [x, y + this.PZ*z]; },
  pos(s,p){
    const K=this.kin(p);
    const X=K.R*Math.cos(s.phi), Y=-K.h, Z=K.R*Math.sin(s.phi);
    const [x,y]=this.prj(X,Y,Z);
    return {x,y,X,Y,Z,K};
  },
  anchors(s,p){
    const r=this.pos(s,p), K=r.K;
    const [ax,ay]=this.prj(0,-K.h,0);
    return [{x:0,y:0},{x:r.x,y:r.y},{x:ax,y:ay},
            ...[0,Math.PI/2,Math.PI,3*Math.PI/2].map(a=>{
              const [px,py]=this.prj(K.R*Math.cos(a),-K.h,K.R*Math.sin(a)); return {x:px,y:py}; })];
  },
  readouts(s,p){
    const K=this.kin(p);
    return [['t',s.t,'с'],['радиус R = L·sinθ',K.R,'м'],['высота h = L·cosθ',K.h,'м'],
            ['натяжение T = mg/cosθ',K.T,'Н'],['вес mg',p.m*p.g,'Н'],
            ['aц = g·tgθ',K.ac,'м/с²'],['скорость v',K.v,'м/с'],
            ['период',K.per,'с'],['ω',K.w,'рад/с'],['обороты',s.t/K.per,''],
            ['угол поворота φ',(s.phi*180/Math.PI)%360,'°']];
  },
  graphs:[
    {label:'x(t) и z(t) — координаты по кругу',unit:'м',series:['x','z'],
     get(s,p){ const r=SIMS.conical.pos(s,p); return [r.X,r.Z]; }},
    {label:'Натяжение T и вес mg',unit:'Н',series:['T','mg'],
     get(s,p){ return [SIMS.conical.kin(p).T, p.m*p.g]; }}
  ],
  presets:[
    {name:'θ = 30°, L = 2 м',values:{m:1,L:2,th:30,g:9.8,turns:0,tStop:0}},
    {name:'Большой угол: θ = 70° — натяжение растёт втрое',values:{m:1,L:2,th:70,g:9.8,turns:0,tStop:0}},
    {name:'Один оборот и стоп',values:{m:1,L:2,th:30,g:9.8,turns:1,tStop:0}}
  ],
  fit(p,vp){
    const K=this.kin(p);
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    // по вертикали — с запасом под стрелку mg ниже груза
    const spanX=Math.max(K.R*2.6,2), spanY=Math.max(K.h*2.5,2.6);
    const scale=clamp(Math.min((W-70)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:0,y:-K.h*0.72,scale};
  },
  draw(ctx,s,v,p){
    const r=this.pos(s,p), K=r.K, PZ=this.PZ;
    const [ax,ay]=this.prj(0,-K.h,0);                 // центр окружности на экране
    // подвес
    ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(3);
    ctx.beginPath(); ctx.moveTo(-0.6,0); ctx.lineTo(0.6,0); ctx.stroke();
    // ось вращения и окружность (эллипс в проекции)
    ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(4),v.lw(4)]);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ax,ay); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ax,ay,K.R,K.R*PZ,0,0,7); ctx.stroke();
    ctx.setLineDash([]);
    v.label(ctx,`h = ${K.h.toFixed(2)} м`,0,-K.h/2,8,0,v.c('--ink-3'));
    // радиус в плоскости круга
    ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1.2);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(r.x,r.y); ctx.stroke();
    v.label(ctx,`R = ${K.R.toFixed(2)} м`,(ax+r.x)/2,(ay+r.y)/2,6,12,v.c('--ink-3'));
    // нить
    ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(1.8);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(r.x,r.y); ctx.stroke();
    // угол θ между вертикалью и нитью (в экранной проекции)
    const a0=-Math.PI/2, a1=Math.atan2(r.y,r.x), rr=K.h*0.3;
    ctx.strokeStyle=v.c('--second'); ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.arc(0,0,rr,Math.min(a0,a1),Math.max(a0,a1)); ctx.stroke();
    const am=(a0+a1)/2;
    v.label(ctx,`θ = ${p.th}°`,rr*1.25*Math.cos(am),rr*1.25*Math.sin(am),
      r.x>=0?6:-46,0,v.c('--second'));
    // СИЛЫ: считаем в 3D и проецируем тем же преобразованием
    if(p.fbd){
      const L=p.L;
      const T3=[(0-r.X)/L*K.T, (0-r.Y)/L*K.T, (0-r.Z)/L*K.T];   // натяжение: от груза к точке подвеса
      const G3=[0,-p.m*p.g,0];                                   // вес
      const [Tx,Ty]=this.prj(T3[0],T3[1],T3[2]);
      const [Gx,Gy]=this.prj(G3[0],G3[1],G3[2]);
      /* Векторы нарисованы в проекции и на экране короче настоящих, поэтому
         подписи берут настоящие величины (mag, resMag). Сумма сил — это
         центростремительная сила m·aц, она направлена к оси вращения. */
      const Fc=p.m*K.ac;
      v.fbd(ctx,{x:r.x,y:r.y,len:K.h*0.55,resultant:true,resMag:Fc,
        sum:p.poly?{x:ax-K.R*1.35,y:ay-K.h*0.5}:null,
        forces:[
          {fx:Gx,fy:Gy,label:'mg',mag:p.m*p.g,color:v.c('--ink-2')},
          {fx:Tx,fy:Ty,label:'T',mag:K.T,color:v.c('--measure')}
        ]});
    }
    // груз
    ctx.fillStyle=v.c('--accent'); ctx.beginPath(); ctx.arc(r.x,r.y,v.lw(8),0,7); ctx.fill();
    v.label(ctx,`период ${K.per.toFixed(2)} с   v = ${K.v.toFixed(2)} м/с   aц = ${K.ac.toFixed(2)} м/с²`,
      -K.R,0,0,-24,v.c('--ink-3'));
  }
}
,

/* ================== ГРАВИТАЦИЯ: ОРБИТАЛЬНОЕ ДВИЖЕНИЕ ================= */
orbit:{
  title:'Тяготение: орбита спутника',
  /* Сцена в своём масштабе: клетка — тысячи километров. Поэтому ни осей с
     числами, ни надписи «сетка N м». */
  schema:true,
  params:[
    {type:'group',label:'Центральное тело'},
    {key:'M',   label:'Масса центрального тела M',unit:'×10²⁴ кг',min:0.001,max:2000,step:0.001,default:5.97},
    {key:'Rc',  label:'Радиус центрального тела',unit:'×10³ км',min:1,max:100,step:1,default:6.37},
    {type:'group',label:'Спутник (начальные условия)'},
    {key:'r0',  label:'Начальное расстояние r₀',unit:'×10³ км',min:1,max:600,step:1,default:42},
    {key:'v0',  label:'Начальная скорость v₀',unit:'км/с',min:0.1,max:20,step:0.05,default:3.07},
    {key:'ang', label:'Угол скорости к радиусу',unit:'°',min:0,max:180,step:1,default:90},
    {type:'group',label:'Показывать'},
    {key:'circleV',label:'Подсказать круговую скорость',type:'check',default:true},
    {key:'trail',  label:'След орбиты',type:'check',default:true},
    {key:'vecs',   label:'Векторы силы и скорости',type:'check',default:true},
    {key:'kepler', label:'Площади за равные времена (II закон Кеплера)',type:'check',default:false},
    {type:'group',label:'Импульс двигателя'},
    {key:'burn',label:'Когда включить',type:'select',default:'none',
     options:[{v:'none',t:'Не включать'},{v:'apo',t:'В апогее (дальней точке)'},
              {v:'peri',t:'В перигее (ближней точке)'},{v:'time',t:'В момент t'}]},
    {key:'dv',label:'Прибавка скорости Δv (минус — торможение)',unit:'км/с',min:-3,max:3,step:0.05,default:0.5,если:p=>p.burn!=='none'},
    {key:'tBurn',label:'Момент включения',unit:'ч',min:0,max:1000,step:0.5,default:6,если:p=>p.burn==='time'},
    {type:'group',label:'Остановка таймера'},
    {key:'turns',label:'Через N витков (0 — выкл)',min:0,max:50,step:0.25,default:0},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'ч',min:0,max:10000,step:1,default:0}
  ],
  G:6.674e-11,
  /* переводим «удобные» единицы в СИ */
  si(p){ return {M:p.M*1e24, Rc:p.Rc*1e6, r0:p.r0*1e6, v0:p.v0*1e3, mu:this.G*p.M*1e24}; },
  vCirc(p){ const S=this.si(p); return Math.sqrt(S.mu/S.r0); },       // круговая скорость на r₀
  vEsc(p){ const S=this.si(p); return Math.sqrt(2*S.mu/S.r0); },      // вторая космическая
  init(p){
    const S=this.si(p), a=p.ang*Math.PI/180;
    // спутник на оси x справа от центра; радиус смотрит вдоль +x.
    // угол a отсчитывается ОТ радиуса против часовой: a=90° → скорость по касательной (+y).
    return {t:0, x:S.r0, y:0,
      vx:S.v0*Math.cos(a), vy:S.v0*Math.sin(a),
      trail:[[S.r0,0]], turns:0, prevAng:0, rmin:S.r0, rmax:S.r0,
      vr:0, burned:null, ksecs:[], ksec:[[S.r0,0]], kT:this.kStep(S,S.r0,0,S.v0*Math.cos(a),S.v0*Math.sin(a)), kNext:0,
      crashed:false, escaped:false, event:null, __stop:null};
  },
  /* Шаг меток Кеплера — двенадцатая часть периода (в часах). У незамкнутой
     орбиты периода нет, и площади не размечаем. */
  kStep(S,x,y,vx,vy){
    const r=Math.hypot(x,y), E=(vx*vx+vy*vy)/2-S.mu/r;
    if(E>=0) return 0;
    const a=-S.mu/(2*E); return 2*Math.PI*Math.sqrt(a*a*a/S.mu)/3600/12;
  },
  accel(S,x,y){ const r=Math.hypot(x,y), k=-S.mu/(r*r*r); return [k*x,k*y,r]; },
  step(s,dt0,p){
    if(s.event) return;
    const S=this.si(p);
    const dt=dt0*3600;                       // модельное время в часах → быстрее считаем крупным шагом
    const sub=40, h=dt/sub;                  // подшаги для точности (velocity Verlet)
    for(let i=0;i<sub;i++){
      let [ax,ay,r]=this.accel(S,s.x,s.y);
      s.vx+=ax*h/2; s.vy+=ay*h/2;
      s.x+=s.vx*h;  s.y+=s.vy*h;
      let [ax2,ay2,r2]=this.accel(S,s.x,s.y);
      s.vx+=ax2*h/2; s.vy+=ay2*h/2;
      if(r2<=S.Rc){ s.crashed=true; break; }
      if(r2>S.r0*12){ s.escaped=true; break; }
    }
    s.t+=dt0;
    const r=Math.hypot(s.x,s.y);
    /* Импульс двигателя: скорость меняется мгновенно вдоль направления
       движения. Апогей и перигей узнаём по смене знака радиальной скорости. */
    const vr=(s.x*s.vx+s.y*s.vy)/r;
    if(p.burn!=='none' && !s.burned && p.dv){
      /* Старт под 90° к радиусу — это уже апсида: перигей, если скорость
         больше круговой, апогей — если меньше. Круговая орбита годится для обоих. */
      const vc=this.vCirc(p), старт=s.t<=dt0*1.5 && p.ang===90 &&
        (Math.abs(S.v0-vc)<vc*0.01 || (p.burn==='peri') === (S.v0>vc));
      const пора = старт ? true : p.burn==='time' ? s.t>=p.tBurn
        : p.burn==='apo' ? (s.vr>=0 && vr<0) : (s.vr<=0 && vr>0);   // в самой точке старта — тоже
      if(пора){
        const v=Math.hypot(s.vx,s.vy), k=Math.max(0,v+p.dv*1e3)/Math.max(v,1e-9);
        s.vx*=k; s.vy*=k; s.burned={x:s.x,y:s.y,t:s.t};
        s.rmin=s.rmax=r;
        s.kT=this.kStep(S,s.x,s.y,s.vx,s.vy); s.ksecs=[]; s.ksec=[[s.x,s.y]]; s.kNext=s.t;
      }
    }
    s.vr=vr;
    // секторы для второго закона Кеплера
    if(s.kT>0){
      s.ksec.push([s.x,s.y]);
      if(s.t>=s.kNext+s.kT){ s.kNext+=s.kT; s.ksecs.push(s.ksec); s.ksec=[[s.x,s.y]];
        if(s.ksecs.length>12) s.ksecs.shift(); }
    }
    s.rmin=Math.min(s.rmin,r); s.rmax=Math.max(s.rmax,r);
    if(p.trail){ s.trail.push([s.x,s.y]); if(s.trail.length>6000) s.trail.shift(); }
    // счётчик витков по накоплению угла
    const ang=Math.atan2(s.y,s.x);
    let d=ang-s.prevAng; if(d>Math.PI) d-=2*Math.PI; if(d<-Math.PI) d+=2*Math.PI;
    s.turns+=d/(2*Math.PI); s.prevAng=ang;

    if(s.crashed){ s.event={t:s.t,type:'crash'};
      s.__stop=`Спутник упал на поверхность: t = ${s.t.toFixed(2)} ч`; return; }
    if(s.escaped){ s.event={t:s.t,type:'escape'};
      s.__stop=`Спутник покинул систему (превышена вторая космическая скорость).`; return; }
    if(p.tStop>0 && s.t>=p.tStop){ s.event={t:s.t,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(1)} ч`; return; }
    if(p.turns>0 && Math.abs(s.turns)>=p.turns){ s.event={t:s.t,type:'turns'};
      s.__stop=`Пройдено ${p.turns} витк(а): t = ${s.t.toFixed(2)} ч`; return; }
  },
  anchors(s,p){ return [{x:0,y:0},{x:s.x,y:s.y}]; },
  /* геометрия орбиты из энергии и момента импульса */
  orbitInfo(s,p){
    const S=this.si(p), r=Math.hypot(s.x,s.y), v=Math.hypot(s.vx,s.vy);
    const E=v*v/2 - S.mu/r;                       // удельная энергия
    const a=-S.mu/(2*E);                          // большая полуось (a<0 — гипербола)
    const L=s.x*s.vy - s.y*s.vx;                  // удельный момент импульса
    const e=Math.sqrt(Math.max(0,1+2*E*L*L/(S.mu*S.mu)));
    const T=(a>0)?2*Math.PI*Math.sqrt(a*a*a/S.mu):Infinity;
    return {r,v,E,a,e,L,T,S};
  },
  readouts(s,p){
    const o=this.orbitInfo(s,p);
    const vc=this.vCirc(p), ve=this.vEsc(p);
    const type = o.e<0.01?'круговая' : o.e<1?'эллипс' : o.e<1.01?'парабола' : 'гипербола';
    return [['t',s.t,'ч'],
            ['расстояние r',o.r/1e6,'×10³ км'],['скорость v',o.v/1e3,'км/с'],
            ['круговая скорость vкр',vc/1e3,'км/с'],['вторая космическая v₂',ve/1e3,'км/с'],
            ['тип орбиты',o.e<1?0:1,type],['эксцентриситет e',o.e,''],
            ['большая полуось a',isFinite(o.a)?o.a/1e6:NaN,'×10³ км'],
            ['период T',isFinite(o.T)?o.T/3600:NaN,
              isFinite(o.T)?'ч':'орбита незамкнута — тело уходит от планеты'],
            ['перигей',s.rmin/1e6,'×10³ км'],['апогей',isFinite(o.a)?s.rmax/1e6:NaN,'×10³ км'],
            ['витки',s.turns,''],
            ['секторная скорость ΔS/Δt = L/2',o.L/2/1e10,'×10¹⁰ м²/с — постоянна']];
  },
  graphs:[
    {label:'r(t) — расстояние до центра',unit:'×10³ км',series:['r'],
     get(s,p){ return [Math.hypot(s.x,s.y)/1e6,null]; }},
    {label:'v(t) — скорость',unit:'км/с',series:['v'],
     get(s,p){ return [Math.hypot(s.vx,s.vy)/1e3,null]; }},
    {label:'Энергия: кинетическая и потенциальная',unit:'МДж/кг',series:['E_кин','E_пот'],
     get(s,p){ const S=SIMS.orbit.si(p), r=Math.hypot(s.x,s.y), v=Math.hypot(s.vx,s.vy);
       return [v*v/2/1e6, -S.mu/r/1e6]; }}
  ],
  presets:[
    {name:'Геостационар: круговая орбита 42 000 км',
     values:{M:5.97,Rc:6.37,r0:42,v0:3.07,ang:90,turns:0,tStop:0}},
    {name:'Низкая круговая орбита (МКС ≈ 6800 км)',
     values:{M:5.97,Rc:6.37,r0:6.8,v0:7.66,ang:90,turns:0,tStop:0}},
    {name:'Эллипс: скорость меньше круговой',
     values:{M:5.97,Rc:6.37,r0:42,v0:2.4,ang:90,turns:0,tStop:0}},
    {name:'Улёт: превышена вторая космическая',
     values:{M:5.97,Rc:6.37,r0:42,v0:4.4,ang:90,turns:0,tStop:0}},
    {name:'Падение: слишком малая скорость',
     values:{M:5.97,Rc:6.37,r0:42,v0:1.2,ang:90,turns:0,tStop:0}},
    {name:'Переход на высокую орбиту: импульс в перигее',
     values:{M:5.97,Rc:6.37,r0:10,v0:6.31,ang:90,burn:'peri',dv:1.2,kepler:false,turns:0,tStop:0}},
    {name:'II закон Кеплера на вытянутом эллипсе',
     values:{M:5.97,Rc:6.37,r0:42,v0:1.9,ang:90,burn:'none',kepler:true,turns:0,tStop:0}},
    {name:'Луна вокруг Земли',
     values:{M:5.97,Rc:6.37,r0:384,v0:1.02,ang:90,turns:0,tStop:0}}
  ],
  fit(p,vp){
    const S=this.si(p);
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    /* в кадр должна влезть и орбита после импульса: её апогей считаем по
       энергии и моменту, как будто импульс дан в точке старта */
    const апо=v0=>{ const a0=p.ang*Math.PI/180, E=v0*v0/2-S.mu/S.r0, L=S.r0*v0*Math.sin(a0);
      if(E>=0) return S.r0*3; const a=-S.mu/(2*E), e=Math.sqrt(Math.max(0,1+2*E*L*L/(S.mu*S.mu)));
      return Math.min(a*(1+e),S.r0*6); };
    let R=Math.max(S.r0,апо(S.v0));
    if(p.burn&&p.burn!=='none'&&p.dv) R=Math.max(R,апо(Math.max(0,S.v0+p.dv*1e3)));
    const span=R*2.3/1e6;                           // в единицах сцены (×10³ км → делим)
    const scaleW=(W-60)/(span*PX_PER_M), scaleH=(H-60)/(span*PX_PER_M);
    return {x:0,y:0,scale:clamp(Math.min(scaleW,scaleH),0.002,30)};
  },
  /* сцена в единицах ×10³ км (делим координаты в СИ на 1e6) */
  draw(ctx,s,v,p){
    const S=this.si(p), U=1e6;
    const cx=0,cy=0, Rc=S.Rc/U;
    // центральное тело
    ctx.fillStyle=v.c('--accent'); ctx.globalAlpha=.25;
    ctx.beginPath(); ctx.arc(cx,cy,Rc,0,7); ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle=v.c('--accent'); ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.arc(cx,cy,Rc,0,7); ctx.stroke();
    ctx.fillStyle=v.c('--accent'); ctx.beginPath(); ctx.arc(cx,cy,v.lw(3),0,7); ctx.fill();
    v.label(ctx,`M = ${p.M}·10²⁴ кг`,0,0,-40,-Rc*40-6,v.c('--accent'));
    // подсказка круговой орбиты на r₀
    if(p.circleV){
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(5)]);
      ctx.beginPath(); ctx.arc(0,0,p.r0,0,7); ctx.stroke(); ctx.setLineDash([]);
    }
    // II закон Кеплера: секторы, заметённые радиусом за равные времена
    if(p.kepler && s.ksecs.length){
      s.ksecs.forEach((P,i)=>{
        ctx.fillStyle=v.c(i%2?'--accent':'--measure'); ctx.globalAlpha=.16;
        ctx.beginPath(); ctx.moveTo(0,0); P.forEach(q=>ctx.lineTo(q[0]/U,q[1]/U)); ctx.closePath(); ctx.fill();
      });
      ctx.globalAlpha=1;
      const P=s.ksecs[s.ksecs.length-1], q=P[P.length>>1];
      v.label(ctx,`за каждые ${s.kT.toFixed(1)} ч — одна и та же площадь`,q[0]/U,q[1]/U,8,-12,v.c('--ink-2'));
    }
    // точка включения двигателя
    if(s.burned){
      const bx=s.burned.x/U, by=s.burned.y/U;
      ctx.strokeStyle=v.c('--danger'); ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.arc(bx,by,v.lw(7),0,7); ctx.stroke();
      v.label(ctx,`импульс Δv = ${p.dv>0?'+':''}${p.dv} км/с`,bx,by,10,14,v.c('--danger'));
    }
    // след орбиты
    if(p.trail&&s.trail.length>1&&v.quality!=='low'){
      ctx.strokeStyle=v.c('--second'); ctx.lineWidth=v.lw(1.6); ctx.globalAlpha=.8;
      ctx.beginPath(); s.trail.forEach((q,i)=>i?ctx.lineTo(q[0]/U,q[1]/U):ctx.moveTo(q[0]/U,q[1]/U));
      ctx.stroke(); ctx.globalAlpha=1;
    }
    const px=s.x/U, py=s.y/U;
    // радиус-вектор
    ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(px,py); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`r = ${(Math.hypot(s.x,s.y)/U).toFixed(1)}·10³ км`,px/2,py/2,6,-8,v.c('--ink-3'));
    // векторы
    if(p.vecs){
      const kv=p.r0*0.09/Math.max(this.vCirc(p)/1e3,0.1);
      v.arrow(ctx,px,py,px+s.vx/1e3*kv,py+s.vy/1e3*kv,v.c('--measure'));
      v.label(ctx,`v = ${(Math.hypot(s.vx,s.vy)/1e3).toFixed(2)} км/с`,px+s.vx/1e3*kv,py+s.vy/1e3*kv,8,-10,v.c('--measure'));
      const [ax,ay,r]=this.accel(S,s.x,s.y), am=Math.hypot(ax,ay);
      const ka=p.r0*0.5;
      v.arrow(ctx,px,py,px+ax/am*ka*0.001,py+ay/am*ka*0.001,v.c('--danger'));
      v.label(ctx,'F тяготения',px+ax/am*ka*0.001,py+ay/am*ka*0.001,8,12,v.c('--danger'));
    }
    // спутник
    ctx.fillStyle=v.c('--measure'); ctx.beginPath(); ctx.arc(px,py,v.lw(6),0,7); ctx.fill();
  }
}
,

/* ================== РАБОТА И ЭНЕРГИЯ ================= */
energy:{
  title:'Работа и энергия: превращения',
  params:[
    {key:'mode',label:'Сценарий',type:'select',default:'hill',
     options:[{v:'hill', t:'Горка: Eкин ⇄ Eпот'},
              {v:'spring',t:'Пружина: Eупр ⇄ Eкин'},
              {v:'fric',  t:'Трение: работа уходит в тепло'},
              {v:'slope', t:'Горка с трением: съехать и остановиться'}]},
    {key:'m', label:'Масса m',unit:'кг',min:0.1,max:100,step:0.1,default:2},
    {key:'g', label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},

    {type:'group',label:'Горка'},
    {key:'h0', label:'Начальная высота h₀',unit:'м',min:0,max:100,step:0.5,default:10},
    {key:'v0h',label:'Начальная скорость (+ вверх)',unit:'м/с',min:-30,max:30,step:0.5,default:0},

    {type:'group',label:'Пружина'},
    {key:'k',  label:'Жёсткость k',unit:'Н/м',min:1,max:2000,step:1,default:80},
    {key:'x0', label:'Начальное сжатие/растяжение x₀',unit:'м',min:-3,max:3,step:0.05,default:1.5},

    {type:'group',label:'Трение'},
    {key:'v0f',label:'Начальная скорость v₀',unit:'м/с',min:0.5,max:50,step:0.5,default:12},
    {key:'mu', label:'Коэффициент трения μ',min:0.01,max:2,step:0.01,default:0.3},

    {type:'group',label:'Горка с трением',если:p=>p.mode==='slope'},
    {key:'hs', label:'Высота горки h',unit:'м',min:0.1,max:100,step:0.1,default:3,если:p=>p.mode==='slope'},
    {key:'alS',label:'Угол склона α',unit:'°',min:5,max:85,step:0.5,default:35,если:p=>p.mode==='slope'},
    {key:'muS',label:'Коэффициент трения μ (склон и пол)',min:0,max:2,step:0.01,default:0.25,если:p=>p.mode==='slope'},

    {type:'group',label:'Показывать'},
    {key:'bars',label:'Диаграмма энергии (столбцы)',type:'check',default:true},
    {key:'trail',label:'След',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'stopEvent',label:'На ключевом событии (низ горки / остановка)',type:'check',default:true},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],

  /* ---- энергия по сценарию ---- */
  energies(s,p){
    if(p.mode==='hill'){
      const Ek=0.5*p.m*s.v*s.v, Ep=p.m*p.g*Math.max(0,s.y);
      return {Ek,Ep,Eel:0,Eth:0,tot:Ek+Ep};
    }
    if(p.mode==='spring'){
      const Ek=0.5*p.m*s.v*s.v, Eel=0.5*p.k*s.x*s.x;
      return {Ek,Ep:0,Eel,Eth:0,tot:Ek+Eel};
    }
    if(p.mode==='slope'){ const Ek=0.5*p.m*s.v*s.v, Ep=p.m*p.g*Math.max(0,s.y);
      return {Ek,Ep,Eel:0,Eth:s.heat,tot:Ek+Ep+s.heat}; }
    const Ek=0.5*p.m*s.v*s.v;
    return {Ek,Ep:0,Eel:0,Eth:s.heat,tot:Ek+s.heat};
  },
  /* горка с трением: s — путь от вершины; склон длиной h/sin α, дальше пол */
  склон(p){ const a=p.alS*Math.PI/180; return {a,L:p.hs/Math.sin(a)}; },
  точкаСклона(p,sp){ const {a,L}=this.склон(p);
    if(sp<=L) return {x:sp*Math.cos(a),y:p.hs-sp*Math.sin(a)}; return {x:L*Math.cos(a)+(sp-L),y:0}; },
  init(p){
    if(p.mode==='hill')   return {t:0,x:0,y:p.h0,v:p.v0h,heat:0,trail:[],E0:null,event:null,__stop:null};
    if(p.mode==='spring') return {t:0,x:p.x0,v:0,heat:0,trail:[],E0:null,event:null,__stop:null};
    if(p.mode==='slope') return {t:0,x:0,y:p.hs,sp:0,v:0,heat:0,trail:[],E0:null,event:null,__stop:null,наСклоне:true};
    return {t:0,x:0,v:p.v0f,heat:0,trail:[],E0:null,event:null,__stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;

    if(p.mode==='hill'){
      // свободное вертикальное движение, Verlet + упругий отскок от земли
      s.y+=s.v*dt-0.5*p.g*dt*dt; s.v-=p.g*dt;
      if(s.y<0){
        // отражаем от земли; энергию на диаграмме считаем по |v| на уровне y=0
        s.y=0; s.v=Math.abs(s.v);
        if(!(s.done&&s.done.bottom)){ s.event={t:s.t,type:'bottom'};
          if(p.stopEvent) s.__stop=`Низ горки: вся E_пот перешла в E_кин. v = ${Math.abs(s.v).toFixed(2)} м/с`; else s.event=null; }
      }
      if(p.trail){ s.trail.push([s.x,s.y]); if(s.trail.length>2000) s.trail.shift(); }
    }
    else if(p.mode==='spring'){
      // гармонические колебания, velocity Verlet (сохраняет энергию точно)
      const a1=-p.k*s.x/p.m;
      s.x+=s.v*dt+0.5*a1*dt*dt;
      const a2=-p.k*s.x/p.m;
      s.v+=0.5*(a1+a2)*dt;
    }
    else if(p.mode==='slope'){
      const {a,L}=this.склон(p), n=8, h=dt/n;
      let ост=dt;
      for(let k=0;k<n*2&&ост>1e-12;k++){
        const on=s.sp<L-1e-12, acc=on?p.g*(Math.sin(a)-p.muS*Math.cos(a)):-p.muS*p.g, N=on?p.m*p.g*Math.cos(a):p.m*p.g;
        if(s.v<=1e-12&&acc<=0){ s.v=0; break; }                     // трение держит
        let hh=Math.min(h,ост);
        if(acc<0&&s.v+acc*hh<0) hh=s.v/(-acc);                     // остановится внутри шага
        let ds=s.v*hh+acc*hh*hh/2;
        if(on&&s.sp+ds>L){ const d=L-s.sp;                          // излом склона: точно до него
          hh=Math.abs(acc)>1e-12?(-s.v+Math.sqrt(Math.max(0,s.v*s.v+2*acc*d)))/acc:d/Math.max(s.v,1e-12); ds=d; }
        s.sp+=ds; s.v=Math.max(0,s.v+acc*hh); s.heat+=p.muS*N*ds; ост-=hh;
        if(s.v===0&&!on) break; }
      const q=this.точкаСклона(p,s.sp); s.x=q.x; s.y=q.y;
      if(p.trail){ s.trail.push([s.x,s.y]); if(s.trail.length>2000) s.trail.shift(); }
      if(s.v===0&&s.t>dt*1.5&&!(s.done&&s.done.rest)){ s.event={t:s.t,type:'rest'};
        if(p.stopEvent) s.__stop=`Тело остановилось в ${s.x.toFixed(2)} м по горизонтали от вершины; в тепло ушло ${s.heat.toFixed(2)} Дж`; else s.event=null; }
    }
    else {
      // трение тормозит: a = -μ g, energy → heat
      if(s.v>1e-6){
        const a=p.mu*p.g, dv=a*dt;
        const vn=Math.max(0,s.v-dv);
        const dx=(s.v+vn)/2*dt;
        s.heat+=p.mu*p.m*p.g*dx;          // работа трения = μmg·Δx
        s.x+=dx; s.v=vn;
        if(p.trail){ s.trail.push([s.x,0]); if(s.trail.length>2000) s.trail.shift(); }
      } else if(!(s.done&&s.done.rest)){
        s.event={t:s.t,type:'rest'};
        if(p.stopEvent) s.__stop=`Тело остановилось: вся E_кин ушла в тепло (${s.heat.toFixed(1)} Дж). Путь ${s.x.toFixed(2)} м`; else s.event=null;
      }
    }
    if(s.E0===null) s.E0=this.energies(s,p).tot;
  },
  anchors(s,p){
    if(p.mode==='hill') return [{x:0,y:0},{x:0,y:s.y},{x:0,y:p.h0}];
    if(p.mode==='spring') return [{x:s.x,y:0},{x:0,y:0}];
    if(p.mode==='slope') return [{x:0,y:p.hs},{x:s.x,y:s.y},{x:this.склон(p).L*Math.cos(this.склон(p).a),y:0}];
    return [{x:0,y:0},{x:s.x,y:0}];
  },
  readouts(s,p){
    const E=this.energies(s,p);
    const out=[['t',s.t,'с']];
    if(p.mode==='hill') out.push(['высота y',s.y,'м'],['скорость v',s.v,'м/с']);
    if(p.mode==='spring') out.push(['смещение x',s.x,'м'],['скорость v',s.v,'м/с'],['сила пружины',-p.k*s.x,'Н']);
    if(p.mode==='fric') out.push(['путь x',s.x,'м'],['скорость v',s.v,'м/с']);
    if(p.mode==='slope') out.push(['смещение по горизонтали от вершины',s.x,'м'],['высота y',s.y,'м'],['путь вдоль опоры',s.sp,'м'],['скорость v',s.v,'м/с']);
    out.push(['E кинетическая',E.Ek,'Дж']);
    if(p.mode==='hill')   out.push(['E потенциальная',E.Ep,'Дж']);
    if(p.mode==='spring') out.push(['E упругая',E.Eel,'Дж']);
    if(p.mode==='slope')  out.push(['E потенциальная',E.Ep,'Дж']);
    if(p.mode==='fric'||p.mode==='slope') out.push(['ушло в тепло',E.Eth,'Дж']);
    out.push(['ПОЛНАЯ E',E.tot,'Дж']);
    if(s.E0!==null) out.push(['E в начале',s.E0,'Дж']);
    return out;
  },
  graphs:[
    {label:'Энергии во времени',unit:'Дж',series:['кинетическая','потенц./упругая/тепло'],
     get(s,p){ const E=SIMS.energy.energies(s,p);
       return [E.Ek, p.mode==='hill'||p.mode==='slope'?E.Ep:(p.mode==='spring'?E.Eel:E.Eth)]; }},
    {label:'Полная энергия (проверка сохранения)',unit:'Дж',series:['E полная'],
     get(s,p){ return [SIMS.energy.energies(s,p).tot,null]; }}
  ],
  presets:[
    {name:'Горка: падение с 10 м',values:{mode:'hill',m:2,h0:10,v0h:0,g:9.8,stopEvent:true,tStop:0}},
    {name:'Горка: брошено вверх с 5 м',values:{mode:'hill',m:2,h0:5,v0h:10,g:9.8,stopEvent:false,tStop:0}},
    {name:'Пружина: колебания',values:{mode:'spring',m:2,k:80,x0:1.5,g:9.8,stopEvent:false,tStop:0}},
    {name:'Пружина жёстче — быстрее колебания',values:{mode:'spring',m:1,k:400,x0:1,g:9.8,tStop:0}},
    {name:'Трение: тело тормозит',values:{mode:'fric',m:2,v0f:12,mu:0.3,g:9.8,stopEvent:true,tStop:0}},
    {name:'Трение слабое — едет далеко',values:{mode:'fric',m:2,v0f:12,mu:0.08,g:9.8,stopEvent:true,tStop:0}},
    {name:'Горка с трением: съехала и остановилась',values:{mode:'slope',m:2,hs:3,alS:35,muS:0.25,g:9.8,stopEvent:true,tStop:0}},
    {name:'Та же горка круче — останавливается там же',values:{mode:'slope',m:2,hs:3,alS:60,muS:0.25,g:9.8,stopEvent:true,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    let spanX,spanY,cx,cy;
    if(p.mode==='hill'){ spanX=8; spanY=Math.max(p.h0*1.3,4); cx=0; cy=spanY/2; }
    else if(p.mode==='spring'){ spanX=Math.max(Math.abs(p.x0)*3.5,3); spanY=spanX*H/W; cx=0; cy=0; }
    else if(p.mode==='slope'){ const l=p.muS>0?p.hs/p.muS:p.hs*4; spanX=Math.max(l*1.2,p.hs*1.5,3); spanY=Math.max(p.hs*1.5,spanX*H/W*0.6); cx=l/2; cy=p.hs*0.45; }
    else { const d=p.v0f*p.v0f/(2*p.mu*p.g); spanX=Math.max(d*1.3,6); spanY=spanX*H/W; cx=d/2; cy=1; }
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:cx,y:cy,scale};
  },
  draw(ctx,s,v,p){
    const E=this.energies(s,p), sz=0.28+0.08*Math.cbrt(p.m);
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger');

    if(p.mode==='hill'){
      // земля + вертикальная шкала высоты
      ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(6,0); ctx.stroke();
      ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1);
      for(let k=-6;k<6;k+=0.7){ ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k-0.3,-0.3); ctx.stroke(); }
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,p.h0); ctx.stroke(); ctx.setLineDash([]);
      // тело
      ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(0,s.y+sz,v.lw(9),0,7); ctx.fill();
      v.label(ctx,`h = ${s.y.toFixed(2)} м`,0,s.y+sz,14,-6,v.c('--ink-3'));
      if(Math.abs(s.v)>0.05) v.arrow(ctx,0,s.y+sz,0,s.y+sz+s.v*0.2,meas);
    }
    else if(p.mode==='spring'){
      const wall=-Math.max(Math.abs(p.x0)*2,2);
      // стена и пол
      ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(wall,-1); ctx.lineTo(wall,1.4); ctx.moveTo(wall,0); ctx.lineTo(4,0); ctx.stroke();
      // пружина (зигзаг) от стены до тела
      const bx=s.x, coils=14, x1=wall, x2=bx-sz;
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath(); ctx.moveTo(x1,0.5);
      for(let i=0;i<=coils;i++){ const tt=i/coils; ctx.lineTo(x1+(x2-x1)*tt, 0.5+(i%2?0.22:-0.22)); }
      ctx.lineTo(x2,0.5); ctx.stroke();
      // положение равновесия
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(0,-0.6); ctx.lineTo(0,1.2); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'равновесие',0,1.2,-30,-4,v.c('--ink-3'));
      // границы амплитуды
      ctx.strokeStyle=sec; ctx.globalAlpha=.45; ctx.setLineDash([v.lw(2),v.lw(4)]); ctx.lineWidth=v.lw(1);
      for(const sgn of [1,-1]){ ctx.beginPath(); ctx.moveTo(sgn*Math.abs(p.x0),-0.5); ctx.lineTo(sgn*Math.abs(p.x0),1.1); ctx.stroke(); }
      ctx.setLineDash([]); ctx.globalAlpha=1;
      // тело
      ctx.fillStyle=acc; ctx.fillRect(bx-sz,0.5-sz,2*sz,2*sz);
      if(Math.abs(s.v)>0.05) v.arrow(ctx,bx,0.5,bx+s.v*0.2,0.5,meas);
      // ЛИНИЯ СМЕЩЕНИЯ Δx снизу: от положения равновесия до тела
      {
        const yd=-0.75;
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
        ctx.beginPath(); ctx.moveTo(0,yd); ctx.lineTo(bx,yd); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,yd-0.13); ctx.lineTo(0,yd+0.13);
        ctx.moveTo(bx,yd-0.13); ctx.lineTo(bx,yd+0.13); ctx.stroke();
        if(Math.abs(bx)>0.1) v.arrow(ctx,0,yd,bx,yd,meas);
        v.label(ctx,`Δx = ${s.x.toFixed(2)} м`,bx/2,yd,-24,-10,meas);
        ctx.strokeStyle=meas; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(bx,0.5-sz); ctx.lineTo(bx,yd); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
        v.label(ctx,`Eупр = kΔx²/2 = ${(0.5*p.k*s.x*s.x).toFixed(2)} Дж`,bx/2,yd,-42,16,v.c('--ink-3'));
      }
    }
    else if(p.mode==='slope'){
      const {a,L}=this.склон(p), X=L*Math.cos(a), far=Math.max(p.muS>0?p.hs/p.muS:p.hs*4,X)*1.3+1;
      ctx.fillStyle=v.c('--panel-2'); ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,p.hs); ctx.lineTo(X,0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0,p.hs); ctx.lineTo(X,0); ctx.lineTo(far,0); ctx.stroke();
      if(p.trail&&s.trail.length>1){ ctx.strokeStyle=dang; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(2.4); ctx.beginPath();
        s.trail.forEach((q,k)=>k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke(); ctx.globalAlpha=1; }
      const наСклоне=s.sp<L-1e-9, ang=наСклоне?-a:0, r=Math.max(0.08*p.hs,0.12);
      ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(ang); ctx.fillStyle=acc; ctx.fillRect(-r,0,2*r,1.4*r); ctx.restore();
      if(s.v>0.05){ const ux=наСклоне?Math.cos(a):1, uy=наСклоне?-Math.sin(a):0; v.arrow(ctx,s.x,s.y+r,s.x+ux*s.v*0.15,s.y+r+uy*s.v*0.15,meas); }
      v.label(ctx,`h = ${p.hs} м, α = ${p.alS}°`,0,p.hs,8,-12,v.c('--ink-3'));
      v.label(ctx,`по горизонтали ${s.x.toFixed(2)} м`,s.x,0,0,18,v.c('--ink-3'));
    }
    else {
      // пол
      ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(1e3,0); ctx.stroke();
      ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1);
      for(let k=-2;k<200;k+=0.7){ ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k-0.3,-0.3); ctx.stroke(); }
      if(p.trail&&s.x>0){ ctx.strokeStyle=dang; ctx.globalAlpha=.3; ctx.lineWidth=v.lw(2.4);
        ctx.beginPath(); ctx.moveTo(0,sz); ctx.lineTo(s.x,sz); ctx.stroke(); ctx.globalAlpha=1; }
      ctx.fillStyle=acc; ctx.fillRect(s.x-sz,0,2*sz,2*sz);
      v.label(ctx,`s = ${s.x.toFixed(2)} м`,s.x,2*sz,-16,-14,v.c('--ink-3'));
      if(s.v>0.05){ v.arrow(ctx,s.x,sz,s.x+s.v*0.25,sz,meas);
        v.arrow(ctx,s.x-sz,sz*0.6,s.x-sz-p.mu*p.m*p.g*0.006,sz*0.6,dang);
        v.label(ctx,'F трения',s.x-sz,sz*0.6,-56,0,dang); }
    }

    // диаграмма энергии вынесена в HTML-оверлей (#energybox), см. updateEnergyBox()

  }
}
,

/* ================== ЦЕНТР МАСС И ИМПУЛЬС (9.3.0) =================
   Три задачи, где внешних сил по горизонтали нет (или они не меняют движение
   центра масс), поэтому импульс системы сохраняется, а центр масс движется
   так, как двигался бы без внутренних сил.
     • Человек идёт по лодке: центр масс «человек + лодка» стоит на месте,
       лодка отъезжает на mL/(m + M).
     • Снаряд разрывается в верхней точке: осколки разлетаются по горизонтали,
       а их центр масс продолжает ту же параболу.
     • Баллистический маятник: пуля застревает в бруске (импульс сохраняется,
       энергия — нет), дальше брусок с пулей поднимается (энергия сохраняется). */
cmass:{
  title:'Центр масс: лодка, разрыв снаряда, баллистический маятник',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'boat',options:[{v:'boat',t:'человек идёт по лодке'},{v:'shell',t:'снаряд разрывается в верхней точке'},{v:'pend',t:'баллистический маятник'}]},
    {type:'group',label:'Лодка',если:p=>p.mode==='boat'},
    {key:'M', label:'Масса лодки M',unit:'кг',min:1,max:5000,step:1,default:150,если:p=>p.mode==='boat'},
    {key:'Lb',label:'Длина лодки L',unit:'м',min:0.5,max:50,step:0.1,default:4,если:p=>p.mode==='boat'},
    {key:'mh',label:'Масса человека m',unit:'кг',min:1,max:500,step:1,default:60,если:p=>p.mode==='boat'},
    {key:'u', label:'Скорость человека относительно лодки',unit:'м/с',min:0.1,max:10,step:0.1,default:1,если:p=>p.mode==='boat'},
    {type:'group',label:'Снаряд',если:p=>p.mode==='shell'},
    {key:'v0',label:'Начальная скорость v₀',unit:'м/с',min:1,max:500,step:1,default:50,если:p=>p.mode==='shell'},
    {key:'th',label:'Угол выстрела θ',unit:'°',min:5,max:89,step:1,default:60,если:p=>p.mode==='shell'},
    {key:'fr',label:'Доля массы осколка 1',min:0.05,max:0.95,step:0.05,default:0.5,если:p=>p.mode==='shell'},
    {key:'k1',label:'Скорость осколка 1 сразу после разрыва (в долях скорости снаряда)',min:-3,max:3,step:0.05,default:0,если:p=>p.mode==='shell'},
    {type:'group',label:'Баллистический маятник',если:p=>p.mode==='pend'},
    {key:'mb',label:'Масса пули m',unit:'кг',min:0.001,max:1,step:0.001,default:0.01,если:p=>p.mode==='pend'},
    {key:'vb',label:'Скорость пули v',unit:'м/с',min:1,max:2000,step:1,default:400,если:p=>p.mode==='pend'},
    {key:'Mb',label:'Масса бруска M',unit:'кг',min:0.05,max:100,step:0.01,default:2,если:p=>p.mode==='pend'},
    {key:'Lp',label:'Длина нити l',unit:'м',min:0.1,max:10,step:0.05,default:1,если:p=>p.mode==='pend'},
    {type:'group',label:'Общее'},
    {key:'g', label:'Ускорение g',unit:'м/с²',min:1,max:30,step:0.1,default:9.8},
    {key:'stopEnd',label:'Остановить в конце опыта',type:'check',default:true},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  /* ---- снаряд ---- */
  снаряд(p){ const th=p.th*Math.PI/180, vx=p.v0*Math.cos(th), vy=p.v0*Math.sin(th), tt=vy/p.g, H=vy*vy/(2*p.g), xt=vx*tt;
    const v1=p.k1*vx, v2=(vx-p.fr*v1)/(1-p.fr), tf=Math.sqrt(2*H/p.g);
    return {vx,vy,tt,H,xt,v1,v2,tf,T:tt+tf}; },
  /* ---- маятник ---- */
  удар(p){ const V=p.mb*p.vb/(p.mb+p.Mb); return {V,h:V*V/(2*p.g),tI:0.25}; },
  init(p){ const s={t:0,event:null,__stop:null};
    if(p.mode==='pend'){ s.th=0; s.w=0; s.удар=false; s.max=0; }
    return s; },
  step(s,dt,p){ if(s.event) return; let t=s.t+dt; if(p.tStop>0) t=Math.min(t,p.tStop);
    if(p.mode==='boat'){ const T=p.Lb/p.u; if(p.stopEnd&&t>=T&&s.t<T){ s.t=T; s.event={type:'end',t:T}; s.__stop=`Человек дошёл до конца лодки: t = ${T.toFixed(2)} с, лодка сместилась на ${this.лодка(p,T).X.toFixed(3)} м`; return; } }
    if(p.mode==='shell'){ const К=this.снаряд(p); if(p.stopEnd&&t>=К.T&&s.t<К.T){ s.t=К.T; s.event={type:'land',t:К.T};
      s.__stop=`Осколки упали: t = ${К.T.toFixed(2)} с; первый в ${(К.xt+К.v1*К.tf).toFixed(1)} м, второй в ${(К.xt+К.v2*К.tf).toFixed(1)} м`; return; } }
    if(p.mode==='pend'){ const У=this.удар(p), n=20, h=(t-s.t)/n;
      for(let k=0;k<n;k++){ const tk=s.t+h*(k+1);
        if(!s.удар){ if(tk>=У.tI){ s.удар=true; s.w=У.V/p.Lp; } continue; }
        const f=(th)=>-p.g/p.Lp*Math.sin(th), a1=f(s.th), a2=f(s.th+h/2*s.w), a3=f(s.th+h/2*(s.w+h/2*a1)), a4=f(s.th+h*(s.w+h/2*a2));
        const th1=s.th+h*s.w+h*h/6*(a1+a2+a3), w1=s.w+h/6*(a1+2*a2+2*a3+a4);
        if(p.stopEnd&&s.w>0&&w1<=0){ const d=s.w/(s.w-w1); s.th=s.th+(th1-s.th)*d; s.w=0; s.t=tk-h*(1-d); s.max=s.th;
          s.event={type:'max',t:s.t}; s.__stop=`Наибольшее отклонение: ${(s.th*180/Math.PI).toFixed(2)}°, подъём ${(p.Lp*(1-Math.cos(s.th))).toFixed(4)} м`; return; }
        s.th=th1; s.w=w1; s.max=Math.max(s.max,s.th); } }
    s.t=t; if(p.tStop>0&&t>=p.tStop){ s.event={type:'time',t}; s.__stop=`Остановка по времени: t = ${t.toFixed(2)} с`; } },
  лодка(p,t){ const sp=Math.min(p.u*t,p.Lb), X=-p.mh*sp/(p.mh+p.M); return {sp,X,xh:X+sp,v:t<p.Lb/p.u?-p.mh*p.u/(p.mh+p.M):0}; },
  readouts(s,p){ const out=[['t',s.t,'с']];
    if(p.mode==='boat'){ const Л=this.лодка(p,s.t), cm=(p.M*(Л.X+p.Lb/2)+p.mh*Л.xh)/(p.M+p.mh);
      out.push(['смещение лодки',Л.X,'м'],['смещение человека относительно земли',Л.xh,'м'],['скорость лодки',Л.v,'м/с'],['центр масс системы x',cm,'м']); }
    else if(p.mode==='shell'){ const К=this.снаряд(p), t=s.t, oc=[this.осколок(p,0,t),this.осколок(p,1,t)], cmx=p.fr*oc[0].x+(1-p.fr)*oc[1].x, cmy=p.fr*oc[0].y+(1-p.fr)*oc[1].y;
      out.push(['центр масс x',cmx,'м'],['центр масс y',cmy,'м'],['осколок 1: x',oc[0].x,'м'],['осколок 2: x',oc[1].x,'м'],['высота разрыва',t>=К.tt?К.H:NaN,'м']); }
    else { const У=this.удар(p), M=p.mb+p.Mb, v=s.удар?Math.abs(s.w)*p.Lp:0, h=p.Lp*(1-Math.cos(s.th));
      out.push(['угол нити',s.th*180/Math.PI,'°'],['высота подъёма бруска',h,'м'],['скорость бруска',v,'м/с'],
        ['энергия пули до удара',p.mb*p.vb*p.vb/2,'Дж'],['механическая энергия после удара',s.удар?M*v*v/2+M*p.g*h:NaN,'Дж']); }
    return out; },
  осколок(p,i,t){ const К=this.снаряд(p);
    if(t<=К.tt) return {x:К.vx*t,y:К.vy*t-p.g*t*t/2};
    const τ=Math.min(t-К.tt,К.tf), v=i?К.v2:К.v1; return {x:К.xt+v*τ,y:Math.max(0,К.H-p.g*τ*τ/2)}; },
  graphs:[{label:'Центр масс по горизонтали',unit:'м',series:['x ЦМ'],get(s,p){ const r=SIMS.cmass.readouts(s,p).find(q=>/центр масс/.test(q[0])); return [r?r[1]:null,null]; }}],
  presets:[
    {name:'Человек проходит по лодке: лодка отъезжает',values:{mode:'boat',M:150,Lb:4,mh:60,u:1,g:9.8,stopEnd:true,tStop:0}},
    {name:'Лёгкая лодка: отъезжает почти на всю длину',values:{mode:'boat',M:20,Lb:4,mh:80,u:1,g:9.8,stopEnd:true,tStop:0}},
    {name:'Разрыв в верхней точке: половина падает отвесно',values:{mode:'shell',v0:50,th:60,fr:0.5,k1:0,g:9.8,stopEnd:true,tStop:0}},
    {name:'Осколок летит назад по той же траектории',values:{mode:'shell',v0:50,th:60,fr:0.5,k1:-1,g:9.8,stopEnd:true,tStop:0}},
    {name:'Баллистический маятник: пуля в брусок',values:{mode:'pend',mb:0.01,vb:400,Mb:2,Lp:1,g:9.8,stopEnd:true,tStop:0}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320; let x0,x1,y0,y1;
    if(p.mode==='boat'){ x0=-p.Lb*0.6; x1=p.Lb*1.6; y0=-p.Lb*0.3; y1=p.Lb*0.5; }
    else if(p.mode==='shell'){ const К=this.снаряд(p), xs=[0,К.xt+К.v1*К.tf,К.xt+К.v2*К.tf,2*К.xt]; x0=Math.min(...xs); x1=Math.max(...xs); y0=0; y1=К.H*1.2; const d=(x1-x0)*0.08; x0-=d; x1+=d; }
    else { x0=-p.Lp*1.3; x1=p.Lp*1.3; y0=-p.Lp*1.25; y1=p.Lp*0.3; }
    const scale=clamp(Math.min((W-60)/((x1-x0)*PX_PER_M),(H-60)/((y1-y0)*PX_PER_M)),0.0005,40); return {x:(x0+x1)/2,y:(y0+y1)/2,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'), пк=1/ppm();
    const цм=(x,y)=>{ ctx.fillStyle=meas; ctx.beginPath(); ctx.moveTo(x,y+6*пк); ctx.lineTo(x-6*пк,y-5*пк); ctx.lineTo(x+6*пк,y-5*пк); ctx.closePath(); ctx.fill(); };
    if(p.mode==='boat'){ const Л=this.лодка(p,s.t), L=p.Lb, h=L*0.12, cm=(p.M*(Л.X+L/2)+p.mh*Л.xh)/(p.M+p.mh);
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); for(let x=-L;x<=2*L;x+=L/30){ const y=0.012*L*Math.sin(x*12/L+s.t*2); x>-L?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
      ctx.fillStyle=ink2; ctx.beginPath(); ctx.moveTo(Л.X-L*0.03,h); ctx.lineTo(Л.X+L*1.03,h); ctx.lineTo(Л.X+L*0.92,-h*0.4); ctx.lineTo(Л.X+L*0.08,-h*0.4); ctx.closePath(); ctx.fill();
      const hx=Л.xh, ph=L*0.22; ctx.strokeStyle=acc; ctx.lineWidth=v.lw(3); ctx.beginPath(); ctx.moveTo(hx,h); ctx.lineTo(hx,h+ph); ctx.stroke();
      ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(hx,h+ph+0.05*L,0.05*L,0,7); ctx.fill();
      ctx.strokeStyle=meas; ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(cm,-0.3*L); ctx.lineTo(cm,0.5*L); ctx.stroke(); ctx.setLineDash([]);
      цм(cm,h*0.4); v.label(ctx,'центр масс стоит',cm,0.45*L,6,-4,meas);
      ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.beginPath(); ctx.moveTo(0,-0.2*L); ctx.lineTo(0,h); ctx.stroke(); ctx.setLineDash([]);
      if(Math.abs(Л.X)>1e-6){ v.arrow(ctx,0,-0.2*L,Л.X,-0.2*L,ink2); v.label(ctx,`лодка ${Л.X.toFixed(2)} м`,Л.X/2,-0.2*L,0,14,ink2); } }
    else if(p.mode==='shell'){ const К=this.снаряд(p);
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(-1e5,0); ctx.lineTo(1e5,0); ctx.stroke();
      ctx.strokeStyle=meas; ctx.globalAlpha=.55; ctx.setLineDash([v.lw(4),v.lw(4)]); ctx.lineWidth=v.lw(1.2); ctx.beginPath();
      for(let k=0;k<=80;k++){ const τ=2*К.tt*k/80; const x=К.vx*τ, y=К.vy*τ-p.g*τ*τ/2; k?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      const cols=[acc,sec];
      for(let i=0;i<2;i++){ ctx.strokeStyle=cols[i]; ctx.lineWidth=v.lw(2); ctx.beginPath(); const n=60;
        for(let k=0;k<=n;k++){ const τ=Math.min(s.t,К.T)*k/n, q=this.осколок(p,i,τ); k?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y); } ctx.stroke();
        const q=this.осколок(p,i,Math.min(s.t,К.T)); ctx.fillStyle=cols[i]; ctx.beginPath(); ctx.arc(q.x,q.y,v.lw(5),0,7); ctx.fill();
        if(s.t>=К.tt) v.label(ctx,`осколок ${i+1}`,q.x,q.y,8,-12,cols[i]); }
      if(s.t>=К.tt){ ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.5); for(let k=0;k<8;k++){ const a=k*Math.PI/4; ctx.beginPath(); ctx.moveTo(К.xt+5*пк*Math.cos(a),К.H+5*пк*Math.sin(a)); ctx.lineTo(К.xt+12*пк*Math.cos(a),К.H+12*пк*Math.sin(a)); ctx.stroke(); }
        const a=this.осколок(p,0,Math.min(s.t,К.T)), b=this.осколок(p,1,Math.min(s.t,К.T)); цм(p.fr*a.x+(1-p.fr)*b.x,p.fr*a.y+(1-p.fr)*b.y);
        v.label(ctx,'центр масс идёт по прежней параболе',К.xt,К.H,10,-26,meas); } }
    else { const L=p.Lp, У=this.удар(p), bx=L*Math.sin(s.th), by=-L*Math.cos(s.th), r=0.09*L;
      ctx.fillStyle=ink2; ctx.fillRect(-0.4*L,0,0.8*L,0.05*L);
      ctx.strokeStyle=v.c('--ink'); ctx.lineWidth=v.lw(1.3); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(bx,by); ctx.stroke();
      ctx.save(); ctx.translate(bx,by); ctx.rotate(s.th); ctx.fillStyle=acc; ctx.fillRect(-r,-r,2*r,1.6*r); ctx.restore();
      if(!s.удар){ const xb=-L*1.2+(L*1.2-r)*Math.min(1,s.t/У.tI); ctx.fillStyle=dang; ctx.fillRect(xb-0.04*L,by-0.01*L,0.08*L,0.02*L); v.label(ctx,`пуля ${p.vb} м/с`,xb,by,0,-12,dang); }
      ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(-0.6*L,-L); ctx.lineTo(0.9*L,-L); ctx.stroke();
      if(s.th>1e-4){ ctx.beginPath(); ctx.moveTo(bx-0.3*L,by); ctx.lineTo(bx+0.3*L,by); ctx.stroke(); } ctx.setLineDash([]);
      if(s.th>1e-4) v.label(ctx,`h = ${(L*(1-Math.cos(s.th))).toFixed(3)} м`,bx,by,24,-6,meas); }
  }
},

/* ================== ВРАЩЕНИЕ: БЛОК С МАССОЙ, МАХОВИК, МАЯТНИК МАКСВЕЛЛА (9.3.0) ==================
   У блока, по которому идёт нить, есть масса — значит, есть и момент инерции
   I = k·m₀R² (диск k = ½, обруч k = 1). Нить не проскальзывает, поэтому
   угловое ускорение ε = a/R, и натяжения по обе стороны блока разные: их
   разность раскручивает блок, (T₁ − T₂)R = Iε. Все три опыта — равноускоренные:
     блок и два груза   a = (m₁ − m₂)g / (m₁ + m₂ + k·m₀);
     груз на маховике   a = m g / (m + k·m₀);
     маятник Максвелла  a = g / (1 + k·R²/r²), r — радиус оси с нитью. */
rotor:{
  title:'Блок с массой, маховик и маятник Максвелла',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'atwood',options:[{v:'atwood',t:'блок с массой и два груза'},{v:'unwind',t:'груз на нити, намотанной на маховик'},{v:'maxwell',t:'маятник Максвелла'}]},
    {type:'group',label:'Блок (маховик, диск)'},
    {key:'shape',label:'Форма',type:'select',default:'disk',options:[{v:'disk',t:'сплошной диск (k = ½)'},{v:'ring',t:'тонкий обод (k = 1)'}]},
    {key:'m0',label:'Масса блока m₀',unit:'кг',min:0,max:100,step:0.1,default:2},
    {key:'R', label:'Радиус блока R',unit:'м',min:0.02,max:2,step:0.01,default:0.2},
    {key:'r', label:'Радиус оси, на которую намотана нить r',unit:'м',min:0.005,max:2,step:0.005,default:0.2,если:p=>p.mode==='maxwell'},
    {type:'group',label:'Грузы',если:p=>p.mode!=='maxwell'},
    {key:'m1',label:'Масса груза m₁',unit:'кг',min:0.01,max:100,step:0.01,default:3,если:p=>p.mode!=='maxwell'},
    {key:'m2',label:'Масса груза m₂',unit:'кг',min:0.01,max:100,step:0.01,default:1,если:p=>p.mode==='atwood'},
    {type:'group',label:'Общее'},
    {key:'g', label:'Ускорение g',unit:'м/с²',min:1,max:30,step:0.1,default:9.8},
    {key:'h', label:'Путь до остановки таймера',unit:'м',min:0.1,max:20,step:0.05,default:2},
    {key:'stopH',label:'Остановить, когда груз пройдёт этот путь',type:'check',default:true},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  k(p){ return p.shape==='ring'?1:0.5; },
  /* ускорение «главного» тела (вниз) и натяжения */
  дин(p){ const k=this.k(p), g=p.g;
    if(p.mode==='atwood'){ const a=(p.m1-p.m2)*g/(p.m1+p.m2+k*p.m0); return {a,T1:p.m1*(g-a),T2:p.m2*(g+a),rad:p.R}; }
    if(p.mode==='unwind'){ const a=p.m1*g/(p.m1+k*p.m0); return {a,T1:p.m1*(g-a),T2:NaN,rad:p.R}; }
    const a=g/(1+k*p.R*p.R/(p.r*p.r)); return {a,T1:p.m0*(g-a),T2:NaN,rad:p.r}; },
  init(p){ return {t:0,event:null,__stop:null}; },
  путь(p,t){ const d=this.дин(p); return {s:d.a*t*t/2, v:d.a*t, φ:d.a*t*t/2/d.rad, ω:d.a*t/d.rad}; },
  step(s,dt,p){ if(s.event) return; let t=s.t+dt; if(p.tStop>0) t=Math.min(t,p.tStop);
    const d=this.дин(p);
    if(p.stopH&&Math.abs(d.a)>1e-12){ const th=Math.sqrt(2*p.h/Math.abs(d.a)); if(t>=th&&s.t<th){ s.t=th; const П=this.путь(p,th);
      s.event={type:'h',t:th}; s.__stop=`Груз прошёл ${p.h} м: t = ${th.toFixed(3)} с, v = ${Math.abs(П.v).toFixed(3)} м/с`; return; } }
    s.t=t; if(p.tStop>0&&t>=p.tStop){ s.event={type:'time',t}; s.__stop=`Остановка по времени: t = ${t.toFixed(2)} с`; } },
  readouts(s,p){ const П=this.путь(p,s.t);
    return [['t',s.t,'с'],['путь груза',Math.abs(П.s),'м'],['скорость груза',Math.abs(П.v),'м/с'],['угловая скорость блока',Math.abs(П.ω),'рад/с'],['обороты блока',Math.abs(П.φ)/(2*Math.PI),'']]; },
  graphs:[{label:'Скорость груза',unit:'м/с',series:['v'],get(s,p){ return [Math.abs(SIMS.rotor.путь(p,s.t).v),null]; }}],
  presets:[
    {name:'Блок-диск и грузы 3 и 1 кг',values:{mode:'atwood',shape:'disk',m0:2,R:0.2,m1:3,m2:1,g:9.8,h:2,stopH:true,tStop:0}},
    {name:'Лёгкий блок: обычная машина Атвуда',values:{mode:'atwood',shape:'disk',m0:0,R:0.2,m1:3,m2:1,g:9.8,h:2,stopH:true,tStop:0}},
    {name:'Тяжёлый обод: грузы еле ползут',values:{mode:'atwood',shape:'ring',m0:20,R:0.2,m1:3,m2:1,g:9.8,h:2,stopH:true,tStop:0}},
    {name:'Груз раскручивает маховик',values:{mode:'unwind',shape:'disk',m0:8,R:0.3,m1:1,g:9.8,h:2,stopH:true,tStop:0}},
    {name:'Маятник Максвелла: нить на тонкой оси',values:{mode:'maxwell',shape:'disk',m0:0.5,R:0.1,r:0.01,g:9.8,h:1,stopH:true,tStop:0}},
    {name:'Цилиндр на собственной нити: a = 2g/3',values:{mode:'maxwell',shape:'disk',m0:0.5,R:0.1,r:0.1,g:9.8,h:1,stopH:true,tStop:0}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, R=p.R, h=p.h;
    const top=R*2, bot=p.mode==='atwood'?-(2*h+4*R):-(h+3*R), sx=Math.max(R*5,h*0.9), sy=top-bot;
    const scale=clamp(Math.min((W-60)/(sx*PX_PER_M),(H-60)/(sy*PX_PER_M)),0.002,80);
    return {x:0,y:(top+bot)/2,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  draw(ctx,s,v,p){
    const R=p.R, d=this.дин(p), П=this.путь(p,s.t), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), пк=1/ppm();
    const колесо=(x,y,rr,φ,лучи)=>{ ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(x,y,rr,0,7); ctx.stroke();
      ctx.fillStyle=v.c('--panel-2'); ctx.globalAlpha=.6; ctx.fill(); ctx.globalAlpha=1;
      ctx.lineWidth=v.lw(1.2); for(let k=0;k<лучи;k++){ const a=φ+k*2*Math.PI/лучи; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+rr*Math.cos(a),y+rr*Math.sin(a)); ctx.stroke(); }
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(x+rr*0.8*Math.cos(φ),y+rr*0.8*Math.sin(φ),v.lw(3),0,7); ctx.fill(); };
    const груз=(x,y,m,c,txt)=>{ const w=Math.max(R*0.9,0.12)*Math.cbrt(Math.max(m,0.05)/2); ctx.fillStyle=c; ctx.fillRect(x-w/2,y-w,w,w); v.label(ctx,txt,x,y-w/2,w*ppm()/2+8,0,c); return w; };
    ctx.fillStyle=ink2; ctx.fillRect(-R*2.5,R*1.6,R*5,R*0.25);
    if(p.mode==='atwood'){ const s1=П.s, y0=-p.h-3*R;
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.5); ctx.beginPath(); ctx.moveTo(0,R*1.6); ctx.lineTo(0,0); ctx.stroke();
      колесо(0,0,R,-П.φ,6);
      const y1=y0-s1, y2=y0+s1;
      ctx.strokeStyle=v.c('--ink'); ctx.lineWidth=v.lw(1.3); ctx.beginPath(); ctx.moveTo(-R,0); ctx.lineTo(-R,y1); ctx.moveTo(R,0); ctx.lineTo(R,y2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI); ctx.stroke();
      груз(-R,y1,p.m1,acc,`m₁ = ${p.m1} кг`); груз(R,y2,p.m2,sec,`m₂ = ${p.m2} кг`); }
    else if(p.mode==='unwind'){ const y0=-R*1.5;
      ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.5); ctx.beginPath(); ctx.moveTo(0,R*1.6); ctx.lineTo(0,0); ctx.stroke();
      колесо(0,0,R,-П.φ,8); const y1=y0-П.s;
      ctx.strokeStyle=v.c('--ink'); ctx.lineWidth=v.lw(1.3); ctx.beginPath(); ctx.moveTo(R,0); ctx.lineTo(R,y1); ctx.stroke();
      груз(R,y1,p.m1,acc,`m = ${p.m1} кг`); }
    else { const yc=-R*1.2-П.s;
      ctx.strokeStyle=v.c('--ink'); ctx.lineWidth=v.lw(1.3); ctx.beginPath(); ctx.moveTo(-p.r,R*1.6); ctx.lineTo(-p.r,yc); ctx.stroke();
      колесо(0,yc,R,П.φ,6); ctx.strokeStyle=ink3; ctx.beginPath(); ctx.arc(0,yc,p.r,0,7); ctx.stroke(); }
    // путь
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(3),v.lw(4)]);
    const xm=-R*2.2, ya=p.mode==='maxwell'?-R*1.2:p.mode==='unwind'?-R*1.5:-p.h-3*R;
    ctx.beginPath(); ctx.moveTo(xm,ya); ctx.lineTo(xm,ya-p.h); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`h = ${p.h} м`,xm,ya-p.h/2,-10,0,meas);
    v.label(ctx,`ω = ${Math.abs(П.ω).toFixed(2)} рад/с`,0,R*1.9,0,-14,ink3);
  }
},

/* ================== МОМЕНТ ИМПУЛЬСА: СКАМЬЯ ЖУКОВСКОГО И ШАЙБА НА НИТИ (9.3.0) ==================
   Внешних моментов сил относительно оси нет, поэтому момент импульса L = Iω
   сохраняется.
     • Платформа-диск (I₀ = MR²/2) с человеком m на расстоянии r: человек идёт
       к центру — I уменьшается, ω растёт; кинетическая энергия Iω²/2 = L²/2I
       растёт, и эту работу совершает человек.
     • Шайба на гладком столе на нити, продетой в отверстие: нить втягивают, и
       vr = const (сила натяжения направлена к оси, её момент равен нулю);
       натяжение T = mv²/r, работа втягивания равна приросту кинетической энергии. */
spin:{
  title:'Момент импульса: скамья и шайба на нити',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'platform',options:[{v:'platform',t:'человек на вращающейся платформе'},{v:'puck',t:'шайба на нити, втягиваемой в отверстие'}]},
    {type:'group',label:'Платформа',если:p=>p.mode==='platform'},
    {key:'M', label:'Масса платформы-диска M',unit:'кг',min:1,max:2000,step:1,default:120,если:p=>p.mode==='platform'},
    {key:'Rd',label:'Радиус платформы R',unit:'м',min:0.3,max:20,step:0.1,default:2,если:p=>p.mode==='platform'},
    {key:'mh',label:'Масса человека m',unit:'кг',min:1,max:300,step:1,default:60,если:p=>p.mode==='platform'},
    {key:'w0',label:'Начальная угловая скорость ω₀',unit:'рад/с',min:0.01,max:20,step:0.01,default:1,если:p=>p.mode==='platform'},
    {key:'ra',label:'Человек стоит на расстоянии от оси (сначала)',unit:'м',min:0,max:20,step:0.05,default:2,если:p=>p.mode==='platform'},
    {key:'rb',label:'…и переходит на расстояние',unit:'м',min:0,max:20,step:0.05,default:0,если:p=>p.mode==='platform'},
    {type:'group',label:'Шайба',если:p=>p.mode==='puck'},
    {key:'m', label:'Масса шайбы m',unit:'кг',min:0.01,max:10,step:0.01,default:0.2,если:p=>p.mode==='puck'},
    {key:'r0',label:'Начальный радиус r₀',unit:'м',min:0.05,max:10,step:0.01,default:0.8,если:p=>p.mode==='puck'},
    {key:'v0',label:'Начальная скорость v₀',unit:'м/с',min:0.01,max:50,step:0.01,default:2,если:p=>p.mode==='puck'},
    {key:'r1',label:'Нить втягивают до радиуса r',unit:'м',min:0.02,max:10,step:0.01,default:0.2,если:p=>p.mode==='puck'},
    {type:'group',label:'Общее'},
    {key:'u', label:'Скорость перехода (втягивания)',unit:'м/с',min:0.01,max:5,step:0.01,default:0.25},
    {key:'stopEnd',label:'Остановить, когда переход закончен',type:'check',default:true},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  T(p){ const a=p.mode==='puck'?p.r0:p.ra, b=p.mode==='puck'?p.r1:p.rb; return Math.abs(b-a)/p.u; },
  r(p,t){ const a=p.mode==='puck'?p.r0:p.ra, b=p.mode==='puck'?p.r1:p.rb, T=this.T(p); return T>0?a+(b-a)*Math.min(1,t/T):a; },
  I(p,r){ return 0.5*p.M*p.Rd*p.Rd+p.mh*r*r; },
  L(p){ return p.mode==='puck'?p.m*p.v0*p.r0:this.I(p,p.ra)*p.w0; },
  ω(p,t){ const r=this.r(p,t); return p.mode==='puck'?this.L(p)/(p.m*r*r):this.L(p)/this.I(p,r); },
  init(p){ const r=this.r(p,0); return {t:0,φ:0,event:null,__stop:null,след:[[r,0]]}; },
  step(s,dt,p){ if(s.event) return; let t=s.t+dt; if(p.tStop>0) t=Math.min(t,p.tStop);
    const T=this.T(p); if(p.stopEnd&&t>=T&&s.t<T) t=T;
    const n=10, h=(t-s.t)/n; for(let k=0;k<n;k++){ const tm=s.t+h*(k+0.5); s.φ+=this.ω(p,tm)*h; }
    s.след.push([this.r(p,t),s.φ]); if(s.след.length>4000) s.след.shift();
    s.t=t;
    if(p.stopEnd&&t>=T-1e-12&&!(s.done&&s.done.end)){ s.event={type:'end',t}; s.__stop=`Переход закончен: t = ${t.toFixed(2)} с, ω = ${this.ω(p,t).toFixed(3)} рад/с`; return; }
    if(p.tStop>0&&t>=p.tStop){ s.event={type:'time',t}; s.__stop=`Остановка по времени: t = ${t.toFixed(2)} с`; } },
  readouts(s,p){ const r=this.r(p,s.t), w=this.ω(p,s.t);
    if(p.mode==='puck'){ const v=w*r; return [['t',s.t,'с'],['радиус r',r,'м'],['скорость шайбы v',v,'м/с'],['угловая скорость ω',w,'рад/с'],
      ['момент импульса L = mvr',p.m*v*r,'кг·м²/с'],['кинетическая энергия',p.m*v*v/2,'Дж'],['натяжение нити',p.m*v*v/r,'Н']]; }
    const I=this.I(p,r); return [['t',s.t,'с'],['человек от оси r',r,'м'],['момент инерции I',I,'кг·м²'],['угловая скорость ω',w,'рад/с'],
      ['момент импульса L = Iω',I*w,'кг·м²/с'],['кинетическая энергия',I*w*w/2,'Дж'],['обороты',s.φ/(2*Math.PI),'']]; },
  graphs:[{label:'Угловая скорость',unit:'рад/с',series:['ω'],get(s,p){ return [SIMS.spin.ω(p,s.t),null]; }}],
  presets:[
    {name:'Человек идёт с края в центр платформы',values:{mode:'platform',M:120,Rd:2,mh:60,w0:1,ra:2,rb:0,u:0.25,stopEnd:true,tStop:0}},
    {name:'Из центра на край: платформа замедляется',values:{mode:'platform',M:120,Rd:2,mh:60,w0:2,ra:0,rb:2,u:0.25,stopEnd:true,tStop:0}},
    {name:'Шайба на нити: втягиваем вчетверо',values:{mode:'puck',m:0.2,r0:0.8,v0:2,r1:0.2,u:0.1,stopEnd:true,tStop:0}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, R=p.mode==='puck'?Math.max(p.r0,p.r1):p.Rd;
    const scale=clamp(Math.min(W-60,H-60)/(2.6*R*PX_PER_M),0.002,80); return {x:0,y:0,scale}; },
  anchors(s,p){ return [{x:0,y:0}]; },
  draw(ctx,s,v,p){
    const ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), пк=1/ppm(), r=this.r(p,s.t);
    if(p.mode==='platform'){ const R=p.Rd;
      ctx.fillStyle=v.c('--panel-2'); ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.arc(0,0,R,0,7); ctx.fill(); ctx.stroke();
      ctx.lineWidth=v.lw(1); for(let k=0;k<8;k++){ const a=s.φ+k*Math.PI/4; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(R*Math.cos(a),R*Math.sin(a)); ctx.stroke(); }
      ctx.fillStyle=ink3; ctx.beginPath(); ctx.arc(0,0,v.lw(3),0,7); ctx.fill();
      const x=r*Math.cos(s.φ), y=r*Math.sin(s.φ); ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(x,y,Math.max(0.08*R,v.lw(6)),0,7); ctx.fill();
      v.label(ctx,`человек, r = ${r.toFixed(2)} м`,x,y,10,-12,acc);
      v.label(ctx,`ω = ${this.ω(p,s.t).toFixed(3)} рад/с`,0,-R*1.15,0,0,meas); }
    else { const R=Math.max(p.r0,p.r1)*1.1, w=this.ω(p,s.t);
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.beginPath(); ctx.arc(0,0,p.r0,0,7); ctx.stroke(); ctx.beginPath(); ctx.arc(0,0,p.r1,0,7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=ink2; ctx.beginPath(); ctx.arc(0,0,v.lw(4),0,7); ctx.fill();
      const x=r*Math.cos(s.φ), y=r*Math.sin(s.φ);
      ctx.strokeStyle=acc; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1.4); ctx.beginPath();
      s.след.forEach(([rr,ф],k)=>{ const X=rr*Math.cos(ф), Y=rr*Math.sin(ф); k?ctx.lineTo(X,Y):ctx.moveTo(X,Y); }); ctx.stroke(); ctx.globalAlpha=1;
      ctx.strokeStyle=v.c('--ink'); ctx.lineWidth=v.lw(1.3); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(x,y); ctx.stroke();
      ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(x,y,Math.max(0.05*R,v.lw(6)),0,7); ctx.fill();
      const vv=w*r, k=0.35*R/Math.max(p.v0*p.r0/p.r1,1e-9); v.arrow(ctx,x,y,x-Math.sin(s.φ)*vv*k,y+Math.cos(s.φ)*vv*k,meas);
      v.label(ctx,`v = ${vv.toFixed(2)} м/с`,x,y,10,-12,meas); }
  }
},

/* ================== ЗАКОН СОХРАНЕНИЯ ЭНЕРГИИ ================= */
econs:{
  title:'Сохранение энергии: три опыта',
  params:[
    {key:'exp',label:'Опыт',type:'select',default:'spring',
     options:[{v:'spring',t:'Пружина: полная мех. энергия постоянна'},
              {v:'collide',t:'Соударение двух тел'},
              {v:'orbit',t:'Гравитация: энергия на орбите'}]},

    {type:'group',label:'Пружина'},
    {key:'m', label:'Масса m',unit:'кг',min:0.1,max:20,step:0.1,default:1},
    {key:'k', label:'Жёсткость k',unit:'Н/м',min:1,max:400,step:1,default:40},
    {key:'x0',label:'Начальное отклонение x₀',unit:'м',min:-4,max:4,step:0.1,default:2},

    {type:'group',label:'Соударение'},
    {key:'m1',label:'Масса m₁',unit:'кг',min:0.1,max:50,step:0.1,default:2},
    {key:'u1',label:'Скорость m₁',unit:'м/с',min:-20,max:20,step:0.5,default:5},
    {key:'m2',label:'Масса m₂',unit:'кг',min:0.1,max:50,step:0.1,default:3},
    {key:'u2',label:'Скорость m₂',unit:'м/с',min:-20,max:20,step:0.5,default:0},
    {key:'e', label:'Коэффициент восстановления e (1 — упругий, 0 — слипаются)',min:0,max:1,step:0.05,default:1},

    {type:'group',label:'Гравитация'},
    {key:'M',  label:'Масса центра M',unit:'×10²⁴ кг',min:0.1,max:2000,step:0.1,default:5.97},
    {key:'r0', label:'Расстояние r₀',unit:'×10³ км',min:6.5,max:400,step:1,default:42},
    {key:'v0', label:'Скорость v₀',unit:'км/с',min:0.1,max:15,step:0.05,default:3.07},

    {type:'group',label:'Остановка таймера'},
    {key:'stopHit',label:'При ударе (соударение)',type:'check',default:true},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  G:6.674e-11,

  /* энергии для диаграммы (единый интерфейс) */
  energies(s,p){
    if(p.exp==='spring'){
      const Ek=0.5*p.m*s.v*s.v, Eel=0.5*p.k*s.x*s.x;
      return {Ek,Ep:0,Eel,Eth:0,tot:Ek+Eel};
    }
    if(p.exp==='collide'){
      const Ek=0.5*p.m1*s.v1*s.v1+0.5*p.m2*s.v2*s.v2;
      return {Ek,Ep:0,Eel:0,Eth:s.heat,tot:Ek+s.heat};
    }
    const S=this.si(p), r=Math.hypot(s.x,s.y), v=Math.hypot(s.vx,s.vy);
    const Ek=0.5*v*v, Ep=-S.mu/r;                     // на единицу массы
    return {Ek:Ek/1e6,Ep:Ep/1e6,Eel:0,Eth:0,tot:(Ek+Ep)/1e6};
  },
  si(p){ return {mu:this.G*p.M*1e24, r0:p.r0*1e6, v0:p.v0*1e3}; },

  init(p){
    if(p.exp==='spring') return {t:0,x:p.x0,v:0,event:null,__stop:null};
    if(p.exp==='collide') return {t:0,x1:-6,x2:2,v1:p.u1,v2:p.u2,heat:0,hit:false,event:null,__stop:null};
    const S=this.si(p);
    return {t:0,x:S.r0,y:0,vx:0,vy:S.v0,trail:[[S.r0,0]],event:null,__stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;

    if(p.exp==='spring'){
      const a1=-p.k*s.x/p.m; s.x+=s.v*dt+0.5*a1*dt*dt;
      const a2=-p.k*s.x/p.m; s.v+=0.5*(a1+a2)*dt;
    }
    else if(p.exp==='collide'){
      const h1=0.2+0.06*Math.cbrt(p.m1), h2=0.2+0.06*Math.cbrt(p.m2);
      s.x1+=s.v1*dt; s.x2+=s.v2*dt;
      if(!s.hit && s.x2-s.x1<=h1+h2 && s.v1>s.v2){
        const eB=0.5*p.m1*s.v1*s.v1+0.5*p.m2*s.v2*s.v2;
        const u1=((p.m1-p.e*p.m2)*s.v1+(1+p.e)*p.m2*s.v2)/(p.m1+p.m2);
        const u2=((p.m2-p.e*p.m1)*s.v2+(1+p.e)*p.m1*s.v1)/(p.m1+p.m2);
        s.v1=u1; s.v2=u2; s.hit=true;
        s.heat=eB-(0.5*p.m1*u1*u1+0.5*p.m2*u2*u2);
        const ov=(h1+h2)-(s.x2-s.x1); s.x1-=ov/2; s.x2+=ov/2;
        if(p.stopHit&&!(s.done&&s.done.hit)){ s.event={t:s.t,type:'hit'};
          const p0=p.m1*p.u1+p.m2*p.u2;
          s.__stop=`Удар: импульс ${p0.toFixed(1)} кг·м/с сохранился, в тепло ушло ${s.heat.toFixed(1)} Дж`; }
      }
      if(Math.abs(s.x1)>12||Math.abs(s.x2)>12){ if(!(s.done&&s.done.away)){ s.event={t:s.t,type:'away'};
        s.__stop=`Тела разошлись.`; } }
    }
    else {
      const S=this.si(p), sub=60, h=dt*3600/sub;
      const Rc=6.37e6;                                  // радиус центрального тела
      for(let i=0;i<sub;i++){
        const acc=(x,y)=>{const r=Math.hypot(x,y),k=-S.mu/(r*r*r);return [k*x,k*y];};
        let [ax,ay]=acc(s.x,s.y);
        s.vx+=ax*h/2; s.vy+=ay*h/2; s.x+=s.vx*h; s.y+=s.vy*h;
        let [ax2,ay2]=acc(s.x,s.y); s.vx+=ax2*h/2; s.vy+=ay2*h/2;
        if(Math.hypot(s.x,s.y)<=Rc){                    // упал на поверхность
          const r=Math.hypot(s.x,s.y)||1;
          s.x*=Rc/r; s.y*=Rc/r; s.vx=0; s.vy=0;
          if(!(s.done&&s.done.crash)){ s.event={t:s.t,type:'crash'};
            s.__stop=`Спутник упал на поверхность центрального тела: t = ${s.t.toFixed(2)} ч`; }
          break;
        }
      }
      if(s.trail){ s.trail.push([s.x,s.y]); if(s.trail.length>4000) s.trail.shift(); }
    }
  },
  anchors(s,p){
    if(p.exp==='spring') return [{x:s.x,y:0},{x:0,y:0}];
    if(p.exp==='collide') return [{x:s.x1,y:0},{x:s.x2,y:0}];
    return [{x:0,y:0},{x:s.x/1e6,y:s.y/1e6}];
  },
  readouts(s,p){
    const E=this.energies(s,p);
    if(p.exp==='spring')
      return [['t',s.t,'с'],['отклонение x',s.x,'м'],['скорость v',s.v,'м/с'],
              ['E кинетическая',E.Ek,'Дж'],['E упругая',E.Eel,'Дж'],['ПОЛНАЯ E',E.tot,'Дж']];
    if(p.exp==='collide')
      return [['t',s.t,'с'],['v₁',s.v1,'м/с'],['v₂',s.v2,'м/с'],
              ['импульс Σp',p.m1*s.v1+p.m2*s.v2,'кг·м/с'],['было Σp',p.m1*p.u1+p.m2*p.u2,'кг·м/с'],
              ['E кинетическая',E.Ek,'Дж'],['ушло в тепло',E.Eth,'Дж'],['ПОЛНАЯ E',E.tot,'Дж']];
    const r=Math.hypot(s.x,s.y)/1e6, v=Math.hypot(s.vx,s.vy)/1e3;
    return [['t',s.t,'ч'],['расстояние r',r,'×10³ км'],['скорость v',v,'км/с'],
            ['E кин (уд.)',E.Ek,'МДж/кг'],['E пот (уд.)',E.Ep,'МДж/кг'],['ПОЛНАЯ E',E.tot,'МДж/кг']];
  },
  graphs:[
    {label:'Энергии во времени',unit:'Дж',series:['кинетическая','потенц./упр./тепло'],
     get(s,p){ const E=SIMS.econs.energies(s,p);
       return [E.Ek, p.exp==='spring'?E.Eel:(p.exp==='collide'?E.Eth:E.Ep)]; }},
    {label:'Полная энергия (проверка сохранения)',unit:'Дж',series:['E полная'],
     get(s,p){ return [SIMS.econs.energies(s,p).tot,null]; }}
  ],
  presets:[
    {name:'Пружина: колебания, E = ½kx² постоянна',values:{exp:'spring',m:1,k:40,x0:2,tStop:0}},
    {name:'Упругий удар (e=1): равные массы обмениваются',values:{exp:'collide',m1:2,u1:5,m2:2,u2:0,e:1,stopHit:true,tStop:0}},
    {name:'Неупругий удар (e=0): тела слипаются',values:{exp:'collide',m1:2,u1:5,m2:3,u2:0,e:0,stopHit:true,tStop:0}},
    {name:'Встречный удар',values:{exp:'collide',m1:3,u1:4,m2:1,u2:-6,e:0.5,stopHit:true,tStop:0}},
    {name:'Орбита: E < 0 (связанное состояние)',values:{exp:'orbit',M:5.97,r0:42,v0:3.07,tStop:0}},
    {name:'Орбита эллиптическая: скорость меньше круговой',values:{exp:'orbit',M:5.97,r0:42,v0:2.4,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    if(p.exp==='spring'){ const sp=Math.max(Math.abs(p.x0)*3,4);
      return {x:0,y:0,scale:clamp(Math.min((W-60)/(sp*PX_PER_M),(H-60)/(sp*H/W*PX_PER_M)),0.002,30)}; }
    if(p.exp==='collide'){ const sp=18;
      return {x:0,y:0,scale:clamp((W-60)/(sp*PX_PER_M),0.002,30)}; }
    const S=this.si(p), span=S.r0*2.6/1e6;
    return {x:0,y:0,scale:clamp(Math.min((W-60)/(span*PX_PER_M),(H-60)/(span*PX_PER_M)),0.002,30)};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger');
    if(p.exp==='spring'){
      const wall=-Math.max(Math.abs(p.x0)*2,2.5), sz=0.3+0.06*Math.cbrt(p.m);
      ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(wall,-1.2); ctx.lineTo(wall,1.4); ctx.moveTo(wall,0); ctx.lineTo(5,0); ctx.stroke();
      const coils=14, x2=s.x-sz;
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath(); ctx.moveTo(wall,0.5);
      for(let i=0;i<=coils;i++) ctx.lineTo(wall+(x2-wall)*i/coils, 0.5+(i%2?0.24:-0.24));
      ctx.lineTo(x2,0.5); ctx.stroke();
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(0,-0.8); ctx.lineTo(0,1.3); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'равновесие',0,1.3,-30,-2,v.c('--ink-3'));
      ctx.fillStyle=acc; ctx.fillRect(s.x-sz,0.5-sz,2*sz,2*sz);
      v.label(ctx,`x = ${s.x.toFixed(2)} м`,s.x,0.5+sz,-20,-16,v.c('--ink-3'));
      if(Math.abs(s.v)>0.05) v.arrow(ctx,s.x,0.5,s.x+s.v*0.25,0.5,meas);
    }
    else if(p.exp==='collide'){
      const h1=0.2+0.06*Math.cbrt(p.m1), h2=0.2+0.06*Math.cbrt(p.m2);
      ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(-13,0); ctx.lineTo(13,0); ctx.stroke();
      ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1);
      for(let k=-13;k<13;k+=0.8){ ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k-0.3,-0.3); ctx.stroke(); }
      ctx.fillStyle=acc; ctx.fillRect(s.x1-h1,0,2*h1,2*h1);
      ctx.fillStyle=sec; ctx.fillRect(s.x2-h2,0,2*h2,2*h2);
      v.label(ctx,`m₁ = ${p.m1} кг`,s.x1,2*h1,-24,-12,acc);
      v.label(ctx,`m₂ = ${p.m2} кг`,s.x2,2*h2,-24,-12,sec);
      if(Math.abs(s.v1)>0.05) v.arrow(ctx,s.x1,h1,s.x1+s.v1*0.3,h1,meas);
      if(Math.abs(s.v2)>0.05) v.arrow(ctx,s.x2,h2,s.x2+s.v2*0.3,h2,meas);
      v.label(ctx,`Σp = ${(p.m1*s.v1+p.m2*s.v2).toFixed(1)} (было ${(p.m1*p.u1+p.m2*p.u2).toFixed(1)})`,-11,3,0,0,v.c('--ink-3'));
      if(s.hit) v.label(ctx,`в тепло: ${s.heat.toFixed(1)} Дж`,-11,2.3,0,0,v.c('--ink-3'));
    }
    else {
      const S=this.si(p), U=1e6, Rc=6.37;
      ctx.fillStyle=acc; ctx.globalAlpha=.22; ctx.beginPath(); ctx.arc(0,0,Rc,0,7); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.5); ctx.beginPath(); ctx.arc(0,0,Rc,0,7); ctx.stroke();
      if(s.trail&&s.trail.length>1&&v.quality!=='low'){
        ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.6); ctx.globalAlpha=.8;
        ctx.beginPath(); s.trail.forEach((q,i)=>i?ctx.lineTo(q[0]/U,q[1]/U):ctx.moveTo(q[0]/U,q[1]/U)); ctx.stroke(); ctx.globalAlpha=1;
      }
      const px=s.x/U,py=s.y/U;
      ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(px,py); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(px,py,v.lw(6),0,7); ctx.fill();
      v.label(ctx,`r = ${(Math.hypot(s.x,s.y)/U).toFixed(1)}·10³ км`,px,py,10,-8,v.c('--ink-3'));
    }
  }
}
,

/* ================== СТАТИКА: РАВНОВЕСИЕ ТВЁРДОГО ТЕЛА ================= */
momentum:{
  title:'Импульс: соударение на плоскости и отдача',
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'hit',
     options:[{v:'hit',   t:'Косое соударение двух шайб'},
              {v:'recoil',t:'Отдача: разлёт из покоя'}]},

    {type:'group',label:'Соударение'},
    {key:'m1',label:'Масса налетающей m₁',unit:'кг',min:0.2,max:20,step:0.1,default:2},
    {key:'v1',label:'Скорость налетающей v₁',unit:'м/с',min:0.5,max:12,step:0.1,default:5},
    {key:'m2',label:'Масса покоящейся m₂',unit:'кг',min:0.2,max:20,step:0.1,default:2},
    {key:'b', label:'Прицельное расстояние b',unit:'м',min:-1.2,max:1.2,step:0.05,default:0.45},
    {key:'e', label:'Коэффициент восстановления e (1 — упругое, 0 — слипаются)',min:0,max:1,step:0.05,default:1},

    {type:'group',label:'Отдача'},
    {key:'M', label:'Масса пушки M',unit:'кг',min:1,max:2000,step:1,default:400},
    {key:'ms',label:'Масса снаряда m',unit:'кг',min:0.1,max:100,step:0.1,default:8},
    {key:'vs',label:'Скорость снаряда',unit:'м/с',min:1,max:400,step:1,default:200},

    {type:'group',label:'Показывать'},
    {key:'vec', label:'Векторы импульса',type:'check',default:true},
    {key:'cm',  label:'Центр масс',type:'check',default:true},
    {key:'trail',label:'Следы',type:'check',default:true}
  ],
  rad(m){ return clamp(0.22*Math.cbrt(m),0.16,0.62); },
  /* Скорости после удара. Импульс идёт вдоль линии центров, касательная
     составляющая не меняется — шайбы гладкие. */
  resolve(m1,v1,m2,v2,n,e){
    const un=(v1[0]-v2[0])*n[0]+(v1[1]-v2[1])*n[1];
    const J=(1+e)*un/(1/m1+1/m2);
    return [[v1[0]-J/m1*n[0], v1[1]-J/m1*n[1]],
            [v2[0]+J/m2*n[0], v2[1]+J/m2*n[1]], J];
  },
  vcm(p){
    if(p.mode==='recoil') return [0,0];
    return [p.m1*p.v1/(p.m1+p.m2), 0];
  },
  recoilV(p){ return p.ms*p.vs/p.M; },
  init(p){
    if(p.mode==='recoil'){
      return {t:0,mode:'recoil',fired:false,
        xg:0, xs:0, vg:0, vsh:0, tr1:[], tr2:[], event:null,__stop:null};
    }
    const r1=this.rad(p.m1), r2=this.rad(p.m2);
    return {t:0,mode:'hit',hit:false,tHit:null,
      x1:-4.2, y1:p.b, vx1:p.v1, vy1:0,
      x2:0,    y2:0,  vx2:0,     vy2:0,
      n:[1,0], Jimp:0, tr1:[], tr2:[], event:null,__stop:null};
  },
  step(s,dt,p){
    s.t+=dt;
    if(s.mode==='recoil'){
      if(!s.fired && s.t>0.6){ s.fired=true; s.vsh=p.vs; s.vg=-this.recoilV(p); }
      // скорости настоящие, но для показа сжимаем: иначе снаряд мгновенно улетает
      const k=0.02;
      s.xs+=s.vsh*dt*k; s.xg+=s.vg*dt*k;
      if(p.trail){ s.tr1.push([s.xg,0.35]); s.tr2.push([s.xs,-0.35]);
        if(s.tr1.length>260) s.tr1.shift(); if(s.tr2.length>260) s.tr2.shift(); }
      return;
    }
    const r1=this.rad(p.m1), r2=this.rad(p.m2), R=r1+r2;
    s.x1+=s.vx1*dt; s.y1+=s.vy1*dt;
    s.x2+=s.vx2*dt; s.y2+=s.vy2*dt;
    if(!s.hit){
      const dx=s.x2-s.x1, dy=s.y2-s.y1, d=Math.hypot(dx,dy);
      if(d<=R && d>1e-9){
        const n=[dx/d,dy/d];
        const [a,b,J]=this.resolve(p.m1,[s.vx1,s.vy1],p.m2,[s.vx2,s.vy2],n,p.e);
        s.vx1=a[0]; s.vy1=a[1]; s.vx2=b[0]; s.vy2=b[1];
        s.n=n; s.Jimp=Math.abs(J); s.hit=true; s.tHit=s.t;
        /* Разводим шайбы, чтобы не залипли, — но обратно пропорционально массам.
           Если развести поровну, центр масс дёрнется, а он обязан идти
           равномерно сквозь удар: внешних сил нет. */
        const ov=(R-d)+1e-4, sum=p.m1+p.m2;
        const d1=ov*p.m2/sum, d2=ov*p.m1/sum;
        s.x1-=n[0]*d1; s.y1-=n[1]*d1;
        s.x2+=n[0]*d2; s.y2+=n[1]*d2;
        s.event={type:'hit',t:s.t};
      }
    }
    if(p.trail){
      s.tr1.push([s.x1,s.y1]); s.tr2.push([s.x2,s.y2]);
      if(s.tr1.length>300) s.tr1.shift(); if(s.tr2.length>300) s.tr2.shift();
    }
  },
  readouts(s,p){
    if(s.mode==='recoil'){
      const V=this.recoilV(p);
      return [['t',s.t,'с'],
        ['импульс снаряда',p.ms*p.vs,'кг·м/с'],
        ['импульс пушки',-p.M*V,'кг·м/с'],
        ['сумма импульсов',p.ms*p.vs-p.M*V,'кг·м/с — ровно ноль, как и было'],
        ['скорость отдачи',V,'м/с'],
        ['энергия снаряда',0.5*p.ms*p.vs*p.vs,'Дж'],
        ['энергия пушки',0.5*p.M*V*V,'Дж'],
        ['доля энергии у пушки',100*(0.5*p.M*V*V)/(0.5*p.ms*p.vs*p.vs+0.5*p.M*V*V),'%']];
    }
    const P0x=p.m1*p.v1, P0y=0;
    const Px=p.m1*s.vx1+p.m2*s.vx2, Py=p.m1*s.vy1+p.m2*s.vy2;
    const K0=0.5*p.m1*p.v1*p.v1;
    const K=0.5*p.m1*(s.vx1**2+s.vy1**2)+0.5*p.m2*(s.vx2**2+s.vy2**2);
    const out=[['t',s.t,'с'],
      ['импульс по x',Px,'кг·м/с'],['было по x',P0x,'кг·м/с'],
      ['импульс по y',Py,'кг·м/с'],['было по y',P0y,'кг·м/с'],
      ['кинетическая E',K,'Дж'],['было E',K0,'Дж'],
      ['ушло в тепло',K0-K,'Дж']];
    if(s.hit){
      const a1=Math.atan2(s.vy1,s.vx1)*180/Math.PI, a2=Math.atan2(s.vy2,s.vx2)*180/Math.PI;
      out.push(['угол m₁ после удара',a1,'°'],['угол m₂ после удара',a2,'°'],
        ['угол между ними',Math.abs(((a1-a2)%360+540)%360-180),'°']);
    }
    return out;
  },
  /* Контракт графиков: get обязан вернуть МАССИВ рядов [y₁, y₂|null].
     Одно число ломает отрисовку — история потом перебирается по элементам. */
  graphs:[
    {label:'Импульс системы',unit:'кг·м/с',series:['Σpx','Σpy'],
     get(s,p){ return s.mode==='recoil'
       ? [p.ms*p.vs-(s.fired? p.M*SIMS.momentum.recoilV(p) : 0), null]
       : [p.m1*s.vx1+p.m2*s.vx2, p.m1*s.vy1+p.m2*s.vy2]; }},
    {label:'Кинетическая энергия',unit:'Дж',series:['E'],
     get(s,p){ return s.mode==='recoil'
       ? [s.fired? 0.5*p.ms*p.vs*p.vs+0.5*p.M*SIMS.momentum.recoilV(p)**2 : 0, null]
       : [0.5*p.m1*(s.vx1**2+s.vy1**2)+0.5*p.m2*(s.vx2**2+s.vy2**2), null]; }}
  ],
  presets:[
    {name:'Лобовой упругий, равные массы: обмен скоростями',values:{mode:'hit',m1:2,m2:2,v1:5,b:0,e:1}},
    {name:'Косой упругий, равные массы: разлёт ровно под 90°',values:{mode:'hit',m1:2,m2:2,v1:5,b:0.45,e:1}},
    {name:'Слипание: максимум тепла',values:{mode:'hit',m1:2,m2:3,v1:6,b:0,e:0}},
    {name:'Лёгкая в тяжёлую: отскок назад',values:{mode:'hit',m1:1,m2:12,v1:6,b:0,e:1}},
    {name:'Тяжёлая в лёгкую: почти не замечает',values:{mode:'hit',m1:12,m2:1,v1:5,b:0,e:1}},
    {name:'Отдача пушки',values:{mode:'recoil',M:400,ms:8,vs:200}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-50)/(11*PX_PER_M),(H-50)/(7.5*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    if(s.mode==='recoil'){ this.drawRecoil(ctx,s,v,p,{acc,meas,dang,sec,ink,ink3}); return; }
    const r1=this.rad(p.m1), r2=this.rad(p.m2);

    // линия движения налетающей шайбы и прицельное расстояние
    ctx.strokeStyle=ink3; ctx.globalAlpha=.28; ctx.setLineDash([v.lw(3),v.lw(4)]); ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(-5,p.b); ctx.lineTo(5,p.b); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
    if(Math.abs(p.b)>0.02){
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.3);
      ctx.beginPath(); ctx.moveTo(-3.2,0); ctx.lineTo(-3.2,p.b); ctx.stroke();
      v.label(ctx,`b = ${p.b.toFixed(2)} м`,-3.2,p.b/2,-52,4,meas);
    }
    // следы
    if(p.trail) for(const [tr,col] of [[s.tr1,dang],[s.tr2,acc]]){
      if(tr.length<2) continue;
      ctx.strokeStyle=col; ctx.globalAlpha=.22; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); tr.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));
      ctx.stroke(); ctx.globalAlpha=1;
    }
    // линия центров в момент удара
    if(s.hit){
      ctx.strokeStyle=sec; ctx.globalAlpha=.5; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.lineWidth=v.lw(1.2);
      ctx.beginPath();
      ctx.moveTo(s.x1-s.n[0]*1.4, s.y1-s.n[1]*1.4);
      ctx.lineTo(s.x1+s.n[0]*2.6, s.y1+s.n[1]*2.6);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'вдоль этой линии передан импульс',s.x1+s.n[0]*2.6,s.y1+s.n[1]*2.6,-58,-10,sec);
    }
    // шайбы
    const disk=(x,y,r,col,txt)=>{
      ctx.fillStyle=col; ctx.globalAlpha=.22;
      ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=col; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.stroke();
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,v.lw(2.2),0,7); ctx.fill();
      v.label(ctx,txt,x,y,-14,-r*20-8,col);
    };
    disk(s.x1,s.y1,r1,dang,`m₁ = ${p.m1} кг`);
    disk(s.x2,s.y2,r2,acc,`m₂ = ${p.m2} кг`);
    // векторы импульса
    if(p.vec){
      const sc=0.5/Math.max(1,p.m1*p.v1/4);
      const arrow=(x,y,px,py,col,lab)=>{
        const L=Math.hypot(px,py); if(L<1e-6) return;
        const ex=x+px*sc, ey=y+py*sc;
        v.arrow(ctx,x,y,ex,ey,col);
        v.label(ctx,lab,ex,ey,px>=0?8:-64,py>=0?-8:14,col);
      };
      arrow(s.x1,s.y1,p.m1*s.vx1,p.m1*s.vy1,dang,`p₁ = ${(p.m1*Math.hypot(s.vx1,s.vy1)).toFixed(2)}`);
      arrow(s.x2,s.y2,p.m2*s.vx2,p.m2*s.vy2,acc,`p₂ = ${(p.m2*Math.hypot(s.vx2,s.vy2)).toFixed(2)}`);
    }
    // центр масс — движется равномерно, удар его не трогает
    if(p.cm){
      const cx=(p.m1*s.x1+p.m2*s.x2)/(p.m1+p.m2), cy=(p.m1*s.y1+p.m2*s.y2)/(p.m1+p.m2);
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
      ctx.beginPath(); ctx.arc(cx,cy,0.13,0,7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-0.2,cy); ctx.lineTo(cx+0.2,cy);
      ctx.moveTo(cx,cy-0.2); ctx.lineTo(cx,cy+0.2); ctx.stroke();
      v.label(ctx,'центр масс',cx,cy,-30,-16,meas);
    }
    // итог
    const yb=-2.75;
    if(!s.hit){
      v.label(ctx,'до удара: весь импульс у налетающей шайбы',-4.9,yb,0,0,ink3);
      v.label(ctx,'центр масс идёт равномерно — и будет идти так же после удара',-4.9,yb,0,17,ink3);
    } else {
      const a1=Math.atan2(s.vy1,s.vx1)*180/Math.PI, a2=Math.atan2(s.vy2,s.vx2)*180/Math.PI;
      const gap=Math.abs(((a1-a2)%360+540)%360-180);
      v.label(ctx,`после удара шайбы расходятся под ${gap.toFixed(1)}°`,-4.9,yb,0,0,ink);
      if(Math.abs(p.m1-p.m2)<1e-9 && p.e>0.99 && Math.abs(p.b)>0.02)
        v.label(ctx,'при равных массах и упругом ударе это всегда ровно 90°',-4.9,yb,0,17,meas);
      else if(p.e<0.01)
        v.label(ctx,'слипание: тела идут вместе, потеря энергии наибольшая',-4.9,yb,0,17,ink3);
      else
        v.label(ctx,'импульс сохранился по обеим осям, часть энергии ушла в тепло',-4.9,yb,0,17,ink3);
    }
  },
  drawRecoil(ctx,s,v,p,C){
    const {acc,meas,dang,sec,ink,ink3}=C;
    const V=this.recoilV(p);
    // земля
    ctx.strokeStyle=ink3; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.moveTo(-5,-1.1); ctx.lineTo(5,-1.1); ctx.stroke(); ctx.globalAlpha=1;
    // пушка
    const gx=s.xg;
    ctx.fillStyle=sec; ctx.globalAlpha=.25; ctx.fillRect(gx-0.6,0.05,1.2,0.6); ctx.globalAlpha=1;
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2); ctx.strokeRect(gx-0.6,0.05,1.2,0.6);
    ctx.beginPath(); ctx.moveTo(gx+0.6,0.35); ctx.lineTo(gx+1.5,0.35); ctx.stroke();
    v.label(ctx,`пушка M = ${p.M} кг`,gx,0.65,-34,-10,sec);
    // снаряд
    if(s.fired){
      ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(1.5+s.xs,0.35,0.16,0,7); ctx.fill();
      v.label(ctx,`снаряд m = ${p.ms} кг`,1.5+s.xs,0.35,-16,-16,dang);
    }
    // векторы импульса — равны по модулю и противоположны
    if(p.vec && s.fired){
      const sc=1.6/Math.max(1,p.ms*p.vs);
      v.arrow(ctx,gx,-0.45,gx-p.M*V*sc,-0.45,sec);
      v.label(ctx,`p = ${(p.M*V).toFixed(0)} кг·м/с`,gx-p.M*V*sc,-0.45,-70,16,sec);
      v.arrow(ctx,1.5+s.xs,-0.45,1.5+s.xs+p.ms*p.vs*sc,-0.45,dang);
      v.label(ctx,`p = ${(p.ms*p.vs).toFixed(0)} кг·м/с`,1.5+s.xs+p.ms*p.vs*sc,-0.45,8,16,dang);
    }
    const yb=-1.75;
    if(!s.fired){
      v.label(ctx,'до выстрела всё покоится: суммарный импульс равен нулю',-4.9,yb,0,0,ink3);
    } else {
      v.label(ctx,`импульсы равны по модулю (${(p.ms*p.vs).toFixed(0)} кг·м/с) и противоположны — сумма осталась нулём`,-4.9,yb,0,0,ink);
      v.label(ctx,`скорость отдачи V = mv/M = ${V.toFixed(2)} м/с`,-4.9,yb,0,17,meas);
      const Es=0.5*p.ms*p.vs*p.vs, Eg=0.5*p.M*V*V;
      v.label(ctx,`энергия делится неровно: пушке достаётся ${(100*Eg/(Es+Eg)).toFixed(1)} % — она тяжелее`,-4.9,yb,0,34,ink3);
    }
  }
},

stability:{
  title:'Устойчивость: опрокинется или соскользнёт',
  params:[
    {key:'w',  label:'Ширина тела',unit:'м',min:0.2,max:3,step:0.05,default:0.8},
    {key:'h',  label:'Высота тела',unit:'м',min:0.2,max:4,step:0.05,default:2},
    {key:'m',  label:'Масса',unit:'кг',min:1,max:500,step:1,default:60},
    {key:'ang',label:'Угол наклона плоскости',unit:'°',min:0,max:60,step:0.5,default:12},
    {key:'mu', label:'Коэффициент трения μ',min:0,max:1.5,step:0.01,default:0.5},
    {key:'g',  label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},
    {type:'group',label:'Показывать'},
    {key:'vert',label:'Отвес из центра масс',type:'check',default:true},
    {key:'forces',label:'Силы',type:'check',default:true}
  ],
  /* Предельный угол опрокидывания: отвес из центра масс выходит за нижнее ребро. */
  tipAngle(p){ return Math.atan(p.w/p.h)*180/Math.PI; },
  /* Предельный угол скольжения: составляющая тяжести вдоль склона превысила трение. */
  slipAngle(p){ return Math.atan(p.mu)*180/Math.PI; },
  verdict(p){
    const t=this.tipAngle(p), sl=this.slipAngle(p);
    if(p.ang<Math.min(t,sl)) return 'стоит';
    return (sl<t)? 'скользит' : 'опрокидывается';
  },
  /* Смещение точки приложения нормальной силы от центра основания:
     d = h·tgα/2. Когда оно достигает w/2, тело встаёт на ребро. */
  shift(p){ return p.h*Math.tan(p.ang*Math.PI/180)/2; },
  init(p){ return {t:0,phi:0,om:0,slide:0,vs:0,fallen:false,event:null,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    const verd=this.verdict(p), a=p.ang*Math.PI/180, g=p.g;
    if(verd==='опрокидывается'){
      /* Поворот вокруг НИЖНЕГО ПРАВОГО ребра. Момент создаёт вес,
         плечо — горизонтальный вынос центра масс за ребро. */
      const w=p.w, h=p.h;
      const r=Math.hypot(w/2,h/2);                 // расстояние от ребра до центра масс
      const b=Math.atan2(h/2,w/2);                 // его угол над основанием
      const I=(p.m*(w*w+h*h)/12)+p.m*r*r;          // момент инерции относительно ребра
      const th=a+s.phi;                            // текущий наклон тела
      const eps=p.m*g*r*Math.sin(th-(Math.PI/2-b))/I;
      s.om+=Math.max(eps,0)*dt; s.phi+=s.om*dt;
      /* Тело «легло», когда его боковая грань коснулась склона. Грань
         перпендикулярна основанию, поэтому это ровно поворот на 90° вокруг
         ребра — независимо от пропорций тела. (Раньше стоял предел π/2−β —
         это угол до положения равновесия на ребре, а не до лежания: тело
         останавливалось повёрнутым на ~10–20° с текстом «легло».) */
      const lim=Math.PI/2;
      if(s.phi>=lim){
        s.phi=lim; s.om=0;
        if(!s.fallen){ s.fallen=true; s.event={type:'fell',t:s.t}; }
      }
    } else if(verd==='скользит'){
      const acc=g*(Math.sin(a)-p.mu*Math.cos(a));
      s.vs+=Math.max(acc,0)*dt; s.slide+=s.vs*dt;
      if(s.slide>3.2){ s.slide=3.2; s.vs=0; }
    } else { s.phi=0; s.om=0; s.slide=0; s.vs=0; s.fallen=false; }
  },
  readouts(s,p){
    const t=this.tipAngle(p), sl=this.slipAngle(p), d=this.shift(p), verd=this.verdict(p);
    const rad=p.ang*Math.PI/180, W=p.m*p.g;
    return [['t',s.t,'с'],
      ['угол наклона',p.ang,'°'],
      ['предел опрокидывания arctg(w/h)',t,'°'],
      ['предел скольжения arctg μ',sl,'°'],
      ['что случится раньше',0, sl<t? 'скольжение — трения не хватит' : 'опрокидывание — тело узкое и высокое'],
      ['состояние',0,verd],
      ['вес',W,'Н'],
      ['нормальная реакция N',W*Math.cos(rad),'Н'],
      ['скатывающая сила',W*Math.sin(rad),'Н'],
      ['предельное трение μN',p.mu*W*Math.cos(rad),'Н'],
      ['сдвиг точки опоры',d,d>=p.w/2? 'м — вышел за ребро' : 'м (ребро на '+(p.w/2).toFixed(2)+' м)'],
      ['поворот от начала',s.phi*180/Math.PI, verd==='опрокидывается'? (s.fallen?'° — тело легло':'° и растёт') : '°'],
      ['проехало по склону',s.slide, verd==='скользит'?'м':'м']];
  },
  presets:[
    {name:'Высокий шкаф: опрокинется раньше, чем поедет',values:{w:0.6,h:1.8,mu:0.6,ang:12}},
    {name:'Низкий ящик: сначала поедет',values:{w:1.6,h:0.6,mu:0.25,ang:10}},
    {name:'Куб: ровно 45°',values:{w:1,h:1,mu:1.2,ang:40}},
    {name:'Гладкий склон: скользит почти сразу',values:{w:0.8,h:2,mu:0.05,ang:5}},
    {name:'На грани опрокидывания',values:{w:0.8,h:2,mu:1.2,ang:21.8}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const span=Math.max(6,p.h*2.2);
    const scale=clamp(Math.min((W-60)/(8*PX_PER_M),(H-60)/(span*PX_PER_M)),0.002,30);
    return {x:0,y:0.2,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const a=p.ang*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a);
    const w=p.w, h=p.h, verd=this.verdict(p);
    // склон
    ctx.save();
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.2);
    ctx.beginPath(); ctx.moveTo(-4.2*ca,-4.2*(-sa)); ctx.lineTo(4.2*ca,4.2*(-sa));
    // штриховка под склоном
    ctx.stroke();
    ctx.strokeStyle=ink3; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1);
    for(let u=-4;u<=4;u+=0.32){
      const bx=u*ca, by=-u*sa;
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx-0.18,by-0.22); ctx.stroke();
    }
    ctx.globalAlpha=1; ctx.restore();
    // угол наклона
    {
      const rad=1.5;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath();
      for(let i=0;i<=28;i++){ const t=-a*i/28;
        const x=rad*Math.cos(t), y=rad*Math.sin(t);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,`α = ${p.ang}°`,rad*1.2*Math.cos(-a/2),rad*1.2*Math.sin(-a/2),-14,4,ink3);
    }
    // тело: ставим на склон; сползание сдвигает его вдоль плоскости
    const ux=[ca,-sa], uy=[sa,ca];            // вдоль склона и по нормали
    const slid=s.slide||0;
    const P0=(u,n)=>[(u+slid)*ux[0]+n*uy[0], (u+slid)*ux[1]+n*uy[1]];
    /* ОПРОКИДЫВАНИЕ: всё тело поворачивается вокруг НИЖНЕГО ПРАВОГО ребра.
       Ребро остаётся на месте, остальные углы описывают вокруг него дугу. */
    const piv=P0(w/2,0), phi=s.phi||0, cf=Math.cos(-phi), sf=Math.sin(-phi);
    const P=(u,n)=>{
      const q=P0(u,n), dx=q[0]-piv[0], dy=q[1]-piv[1];
      return [piv[0]+dx*cf-dy*sf, piv[1]+dx*sf+dy*cf];
    };
    const c0=P(-w/2,0), c1=P(w/2,0), c2=P(w/2,h), c3=P(-w/2,h);
    ctx.fillStyle=acc; ctx.globalAlpha=.16;
    ctx.beginPath(); ctx.moveTo(c0[0],c0[1]); ctx.lineTo(c1[0],c1[1]);
    ctx.lineTo(c2[0],c2[1]); ctx.lineTo(c3[0],c3[1]); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;
    ctx.strokeStyle=verd==='стоит'?acc:dang; ctx.lineWidth=v.lw(2.2);
    ctx.beginPath(); ctx.moveTo(c0[0],c0[1]); ctx.lineTo(c1[0],c1[1]);
    ctx.lineTo(c2[0],c2[1]); ctx.lineTo(c3[0],c3[1]); ctx.closePath(); ctx.stroke();
    // ребро, вокруг которого идёт опрокидывание
    if(this.verdict(p)==='опрокидывается'){
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.2);
      ctx.beginPath(); ctx.arc(piv[0],piv[1],0.10,0,7); ctx.stroke();
      v.label(ctx,'ось поворота',piv[0],piv[1],10,20,dang);
    }
    // центр масс
    const cm=P(0,h/2);
    ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(cm[0],cm[1],v.lw(3.4),0,7); ctx.fill();
    v.label(ctx,'центр масс',cm[0],cm[1],10,-6,meas);
    // отвес: где вертикаль из центра масс встречает основание
    if(p.vert){
      ctx.strokeStyle=meas; ctx.globalAlpha=.65; ctx.setLineDash([v.lw(4),v.lw(4)]); ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(cm[0],cm[1]); ctx.lineTo(cm[0],cm[1]-h*1.15); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      // точка пересечения отвеса с линией основания
      const t=(cm[0]*uy[1]-cm[1]*uy[0])/(ux[0]*uy[1]-ux[1]*uy[0]);
      const foot=P(t,0);
      const inside=Math.abs(t)<=w/2+1e-9;
      ctx.fillStyle=inside?acc:dang;
      ctx.beginPath(); ctx.arc(foot[0],foot[1],v.lw(3),0,7); ctx.fill();
      v.label(ctx,inside?'отвес внутри основания':'отвес вышел за ребро',
        foot[0],foot[1],-42,20,inside?acc:dang);
    }
    // силы
    if(p.forces){
      const W=p.m*p.g, sc=1.1/Math.max(W,1);
      v.arrow(ctx,cm[0],cm[1],cm[0],cm[1]-W*sc,dang);
      v.label(ctx,'mg',cm[0],cm[1]-W*sc,-16,14,dang);
      const N=W*ca, sh=clamp(this.shift(p),-w/2,w/2);
      const np=P(sh,0);
      v.arrow(ctx,np[0],np[1],np[0]+N*sc*uy[0],np[1]+N*sc*uy[1],acc);
      v.label(ctx,'N',np[0]+N*sc*uy[0],np[1]+N*sc*uy[1],8,-4,acc);
      const F=Math.min(W*sa,p.mu*N);
      if(F>1e-6){
        v.arrow(ctx,c0[0],c0[1],c0[0]+F*sc*ux[0],c0[1]+F*sc*ux[1],sec);
        v.label(ctx,'трение',c0[0]+F*sc*ux[0],c0[1]+F*sc*ux[1],-38,16,sec);
      }
    }
    // итог
    const t=this.tipAngle(p), sl=this.slipAngle(p), yb=-2.9;
    const col=verd==='стоит'?acc:dang;
    v.label(ctx,`опрокидывание при ${t.toFixed(1)}°, скольжение при ${sl.toFixed(1)}°`,-4.6,yb,0,0,ink3);
    v.label(ctx, verd==='стоит' ? `α = ${p.ang}° меньше обоих пределов — тело стоит`
              : (verd==='скользит' ? `α = ${p.ang}° ≥ ${sl.toFixed(1)}° — трения не хватило, тело едет вниз`
                                   : (s.fallen ? `тело опрокинулось через нижнее ребро и легло`
                                               : `α = ${p.ang}° ≥ ${t.toFixed(1)}° — отвес вышел за ребро, тело валится`)),
      -4.6,yb,0,17,col);
    v.label(ctx, sl<t ? 'узкое высокое тело опрокидывается, широкое низкое — скользит: здесь раньше наступит скольжение'
                      : 'здесь раньше наступит опрокидывание: тело слишком высокое для своей ширины',
      -4.6,yb,0,34,ink3);
  }
},

statics:{
  title:'Статика: равновесие тел',
  params:[
    {key:'sys',label:'Система',type:'select',default:'lever',
     options:[{v:'lever', t:'Рычаг: две массы на опоре'},
              {v:'beam',  t:'Балка на двух опорах'},
              {v:'ladder',t:'Лестница у стены'},
              {v:'bracket',t:'Кронштейн: вывеска на стене'}]},
    {key:'g', label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},

    {type:'group',label:'Рычаг'},
    {key:'m1', label:'Масса слева m₁',unit:'кг',min:0.1,max:200,step:0.5,default:20},
    {key:'m2', label:'Масса справа m₂',unit:'кг',min:0.1,max:200,step:0.5,default:30},
    {key:'L',  label:'Длина стержня L',unit:'м',min:1,max:10,step:0.1,default:4},
    {key:'piv',label:'Положение опоры от левого конца',unit:'м',min:0.1,max:9.9,step:0.05,default:2.4},

    {type:'group',label:'Балка на двух опорах'},
    {key:'Lb', label:'Длина балки',unit:'м',min:2,max:12,step:0.1,default:6},
    {key:'mb', label:'Масса балки',unit:'кг',min:0,max:500,step:1,default:40},
    {key:'load',label:'Груз на балке',unit:'кг',min:0,max:1000,step:1,default:100},
    {key:'lpos',label:'Положение груза от левой опоры',unit:'м',min:0,max:12,step:0.1,default:2},

    {type:'group',label:'Лестница'},
    {key:'Ll', label:'Длина лестницы',unit:'м',min:2,max:10,step:0.1,default:5},
    {key:'ang',label:'Угол к полу θ',unit:'°',min:20,max:85,step:1,default:60},
    {key:'mL', label:'Масса лестницы',unit:'кг',min:1,max:50,step:0.5,default:10},
    {key:'mMan',label:'Масса человека',unit:'кг',min:0,max:150,step:1,default:70},
    {key:'sMan',label:'Положение человека (доля длины)',min:0,max:1,step:0.05,default:0.5},
    {key:'muF',label:'Трение о пол μ',min:0,max:1.5,step:0.05,default:0.4},

    {type:'group',label:'Кронштейн'},
    {key:'Lbr',label:'Вылет кронштейна',unit:'м',min:0.5,max:4,step:0.1,default:1.5},
    {key:'mSign',label:'Масса вывески',unit:'кг',min:1,max:200,step:1,default:25},
    {key:'braceA',label:'Угол растяжки к стене',unit:'°',min:15,max:75,step:1,default:40}
  ],
  /* каждая система возвращает силы реакции и признак равновесия */
  solve(p){
    if(p.sys==='lever'){
      const W1=p.m1*p.g, W2=p.m2*p.g, a=p.piv, b=p.L-p.piv;
      const tau=W2*b - W1*a;                       // момент относительно опоры (+ по часовой = вниз справа)
      const N=W1+W2;                               // реакция опоры
      const balancedPiv=p.m2*p.L/(p.m1+p.m2);      // m1·a = m2·(L−a) ⇒ a = m2·L/(m1+m2)
      return {W1,W2,N,tau,a,b,balanced:Math.abs(tau)<0.5,balancedPiv};
    }
    if(p.sys==='beam'){
      /* Опоры стоят на 0 и Lb, но САМА балка может быть длиннее: если груз
         вынесен дальше правой опоры, он лежит на свесе балки, а не висит в
         воздухе за её концом (раньше груз рисовался вне балки и вращался
         вместе с ней — тело буквально лежало «за бруском»).
         Вес балки приложен в середине её полной длины. */
      const Wb=p.mb*p.g, Wl=p.load*p.g, L=p.Lb, d=p.lpos;
      const Lbeam=Math.max(L, d+0.4);                       // полная длина со свесом
      // ΣF=0, Στ=0 относительно левой опоры
      const R2=(Wb*(Lbeam/2)+Wl*d)/L;
      const R1=Wb+Wl-R2;
      // опора умеет только подпирать: если реакция вышла отрицательной, балка задирается и опрокидывается
      const tipL=R1<0, tipR=R2<0;
      // момент опрокидывания относительно ближней опоры
      const tipTau = tipR ? (Wl*(0-d)-Wb*(Lbeam/2))    // груз левее левой опоры
                   : (tipL ? (Wl*(d-L)-Wb*(Lbeam/2-L)) : 0);
      return {Wb,Wl,R1,R2,L,Lbeam,d,tipL,tipR,tipTau,balanced:!tipL&&!tipR};
    }
    if(p.sys==='ladder'){
      const th=p.ang*Math.PI/180, W=p.mL*p.g, Wm=p.mMan*p.g, L=p.Ll;
      const N=W+Wm;                                // реакция пола (верт.)
      // момент относительно нижней опоры: стена даёт горизонт. реакцию Fw
      // W на L/2, Wm на sMan·L; Fw·L·sinθ = W·(L/2)cosθ + Wm·(sMan·L)cosθ
      const Fw=(W*(L/2)*Math.cos(th)+Wm*(p.sMan*L)*Math.cos(th))/(L*Math.sin(th));
      const need=Fw, avail=p.muF*N;                // трение о пол должно удержать Fw
      return {th,W,Wm,N,Fw,need,avail,L,slips:need>avail};
    }
    // bracket: горизонтальный стержень к стене + растяжка (трос) под углом
    const th=p.braceA*Math.PI/180, W=p.mSign*p.g, Lr=p.Lbr;
    // трос крепится к концу стержня и к стене выше; вертикальная составляющая держит вес
    // момент относительно крепления стержня к стене: T·sinθ·Lr = W·Lr → T=W/sinθ
    const T=W/Math.sin(th);
    const comp=T*Math.cos(th);                     // стержень сжат этой силой
    return {th,W,T,comp,Lr,balanced:true};
  },
  init(p){ return {t:0,rot:0,vrot:0,event:null,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    // показательное (не гиперточное) вращение неуравновешенных систем
    const d=this.solve(p);
    let drive=0;
    if(p.sys==='lever')  drive = -d.tau*0.00002;               // момент → угловое ускорение (условный масштаб)
    else if(p.sys==='ladder' && d.slips) drive = -0.15;        // низ уезжает, угол падает: rot < 0
    else if(p.sys==='beam' && !d.balanced)                      // груз вынесен за опору — балка опрокидывается
      drive = (d.tipR? 1:-1)*0.05;
    else if(p.sys==='bracket'){                                 // вывеска на кронштейне слегка покачивается
      s.sway = (s.sway||0) + dt*1.6;
    }
    if(Math.abs(drive)>1e-9){
      s.vrot += drive*dt*60;
      s.vrot *= 0.998;                                          // лёгкое затухание, чтобы не разносило
      s.rot  += s.vrot*dt;
      if(p.sys==='ladder'){
        // лестница валится, пока не ляжет на пол: угол не может стать меньше нуля
        const th0=p.ang*Math.PI/180;
        if(s.rot<=-th0){ s.rot=-th0; s.vrot=0; }
        if(s.rot>0){ s.rot=0; s.vrot=0; }
      }
      if(p.sys==='beam'){ s.rot=Math.max(-0.5,Math.min(0.5,s.rot)); }   // балка кренится до упора в пол
      if(p.sys==='lever'){
        // концы стержня упираются в пол: тяжёлый конец не проваливается ниже уровня опоры.
        // максимальный угол наклона — когда более длинное плечо коснулось пола (высота опоры ≈ 0.6 м).
        const armL=Math.max(p.piv,p.L-p.piv);
        const maxTilt=Math.min(0.6, Math.asin(Math.min(1,0.6/Math.max(armL,0.01))));
        if(s.rot> maxTilt){ s.rot= maxTilt; s.vrot=0; }         // левый конец лёг на пол
        if(s.rot<-maxTilt){ s.rot=-maxTilt; s.vrot=0; }         // правый конец лёг на пол
      }
    } else { s.vrot*=0.9; }                                     // уравновешено — успокаивается
  },
  warn(p){
    const d=this.solve(p);
    if(p.sys==='lever' && !d.balanced)
      return `Рычаг не уравновешен: момент ${d.tau>0?'вращает по часовой':'против часовой'} (${Math.abs(d.tau).toFixed(0)} Н·м). Опора для равновесия — на ${d.balancedPiv.toFixed(2)} м от левого конца.`;
    if(p.sys==='ladder' && d.slips)
      return `Лестница скользит: нужно трение ${d.need.toFixed(0)} Н, а пол даёт максимум ${d.avail.toFixed(0)} Н.`;
    return null;
  },
  anchors(s,p){
    const d=this.solve(p);
    if(p.sys==='lever') return [{x:0,y:0},{x:p.piv,y:0},{x:p.L,y:0}];
    if(p.sys==='beam') return [{x:0,y:0},{x:p.Lb,y:0},{x:p.lpos,y:0}];
    if(p.sys==='ladder'){ const th=d.th; return [{x:0,y:0},{x:p.Ll*Math.cos(th),y:0},{x:0,y:p.Ll*Math.sin(th)}]; }
    return [{x:0,y:0},{x:p.Lbr,y:0}];
  },
  readouts(s,p){
    const d=this.solve(p);
    if(p.sys==='lever')
      return [['вес слева m₁g',d.W1,'Н'],['вес справа m₂g',d.W2,'Н'],
              ['плечо слева',d.a,'м'],['плечо справа',d.b,'м'],
              ['момент слева',d.W1*d.a,'Н·м'],['момент справа',d.W2*d.b,'Н·м'],
              ['реакция опоры N',d.N,'Н'],
              ['равновесие',d.balanced?1:0,d.balanced?'да':'нет'],
              ['опора для равновесия',d.balancedPiv,'м']];
    if(p.sys==='beam')
      return [['вес балки',d.Wb,'Н'],['вес груза',d.Wl,'Н'],
              ['положение груза от левой опоры',d.d,'м'],
              ['пролёт между опорами',d.L,'м'],
              ['полная длина балки',d.Lbeam, d.Lbeam>d.L+1e-6? `м (свес ${(d.Lbeam-d.L).toFixed(1)} м)` : 'м'],
              ['реакция левой опоры R₁',d.R1,'Н'],['реакция правой опоры R₂',d.R2,'Н'],
              ['сумма реакций',d.R1+d.R2,'Н'],['сумма весов',d.Wb+d.Wl,'Н'],
              ['равновесие',d.balanced?1:0,
                d.balanced?'да: обе реакции положительны'
                          :'НЕТ: балка опрокидывается — груз вынесен за опору'],
              ['угол наклона',(s.rot||0)*180/Math.PI,'°']];
    if(p.sys==='ladder')
      return [['угол θ',p.ang,'°'],['вес лестницы',d.W,'Н'],['вес человека',d.Wm,'Н'],
              ['реакция пола N',d.N,'Н'],['реакция стены Fw',d.Fw,'Н'],
              ['нужно трение',d.need,'Н'],['доступно μN',d.avail,'Н'],
              ['состояние',d.slips?0:1,d.slips?'скользит':'держится']];
    return [['вес вывески',d.W,'Н'],['натяжение троса T',d.T,'Н'],
            ['сжатие стержня',d.comp,'Н'],['угол растяжки',p.braceA,'°']];
  },
  graphs:[],
  presets:[
    {name:'Рычаг: уравновешен',values:{sys:'lever',m1:20,m2:30,L:4,piv:2.4,g:9.8}},
    {name:'Рычаг: перевешивает правая',values:{sys:'lever',m1:20,m2:30,L:4,piv:2.0,g:9.8}},
    {name:'Балка: груз вынесен за опору — опрокидывается',values:{sys:'beam',Lb:6,mb:40,load:300,lpos:8.5,g:9.8}},
    {name:'Балка: груз ближе к левой опоре',values:{sys:'beam',Lb:6,mb:40,load:100,lpos:2,g:9.8}},
    {name:'Лестница держится (θ=60°, μ=0.4)',values:{sys:'ladder',Ll:5,ang:60,mL:10,mMan:70,sMan:0.5,muF:0.4,g:9.8}},
    {name:'Лестница: человек слишком высоко — скользит',values:{sys:'ladder',Ll:5,ang:60,mL:10,mMan:70,sMan:0.9,muF:0.4,g:9.8}},
    {name:'Кронштейн с вывеской',values:{sys:'bracket',Lbr:1.5,mSign:25,braceA:40,g:9.8}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    let spanX,spanY,cx,cy;
    if(p.sys==='lever'){ spanX=p.L*1.5; spanY=p.L*0.9; cx=p.L/2; cy=0.3; }
    else if(p.sys==='beam'){
      /* по горизонтали учитываем груз, вынесенный за опору, по вертикали —
         стрелки сил (до 0.42·L вверх и вниз) и строку состояния под полом */
      const Lb=Math.max(p.Lb,p.lpos+0.4);
      spanX=Lb*1.35+1;
      spanY=Lb*1.2;
      cx=Lb/2; cy=0.1;
    }
    else if(p.sys==='ladder'){ const th=p.ang*Math.PI/180; spanX=Math.max(p.Ll*Math.cos(th),p.Ll*Math.sin(th))*2.2; spanY=p.Ll*1.2; cx=p.Ll*Math.cos(th)/2; cy=p.Ll*Math.sin(th)/2; }
    else { spanX=p.Lbr*2.6; spanY=p.Lbr*2.2; cx=p.Lbr*0.3; cy=0; }
    const scale=clamp(Math.min((W-70)/(spanX*PX_PER_M),(H-70)/(spanY*PX_PER_M)),0.002,30);
    return {x:cx,y:cy,scale};
  },
  draw(ctx,s,v,p){
    const d=this.solve(p), acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'),
          dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    /* Масштаб стрелок сил АДАПТИВНЫЙ: самая большая сила системы получает
       стрелку в четверть характерного размера сцены. Раньше стоял жёсткий
       коэффициент 0.0022 м/Н — при грузе 300 кг (2940 Н) стрелка выходила
       длиной 6,5 м на балке длиной 6 м и уезжала далеко за экран. */
    const kF=(()=>{
      let span, forces;
      if(p.sys==='lever'){ span=p.L; forces=[d.W1,d.W2,d.N]; }
      else if(p.sys==='beam'){ span=p.Lb; forces=[d.Wb,d.Wl,d.R1,d.R2]; }
      else if(p.sys==='ladder'){ span=p.Ll; forces=[d.W,d.Wm,d.N,d.Fw,d.need]; }
      else { span=p.Lbr*2; forces=[d.W,d.T,d.comp]; }
      const Fmax=Math.max(1,...forces.map(f=>Math.abs(f)||0));
      return (span*0.42)/Fmax;                       // длиннейшая стрелка ≈ 0.42 span
    })();

    if(p.sys==='lever'){
      const rot=s.rot||0, cs=Math.cos(rot), sn=Math.sin(rot);
      // пол-ограничитель: концы стержня упираются, вечного вращения нет
      ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1.5);
      const floorY=-0.62;
      ctx.beginPath(); ctx.moveTo(-0.6,floorY); ctx.lineTo(p.L+0.6,floorY); ctx.stroke();
      ctx.lineWidth=v.lw(1);
      for(let k=-0.6;k<p.L+0.6;k+=0.5){ ctx.beginPath(); ctx.moveTo(k,floorY); ctx.lineTo(k-0.25,floorY-0.25); ctx.stroke(); }
      // точки стержня, повёрнутые вокруг опоры
      const piv={x:p.piv,y:0};
      const R=(x)=>({x:piv.x+(x-piv.x)*cs, y:(x-piv.x)*sn});     // поворот точки на оси стержня
      const P0=R(0), PL=R(p.L);
      // стержень
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(4);
      ctx.beginPath(); ctx.moveTo(P0.x,P0.y); ctx.lineTo(PL.x,PL.y); ctx.stroke();
      // опора
      ctx.fillStyle=sec; ctx.beginPath();
      ctx.moveTo(piv.x,0); ctx.lineTo(piv.x-0.35,-0.6); ctx.lineTo(piv.x+0.35,-0.6); ctx.closePath(); ctx.fill();
      // грузы
      const s1=0.2+0.06*Math.cbrt(p.m1), s2=0.2+0.06*Math.cbrt(p.m2);
      // грузы наклоняются вместе со стержнем — квадрат «лежит» на плече
      const box=(cx,cy,half,col)=>{
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
        ctx.fillStyle=col; ctx.fillRect(-half,0,2*half,2*half);
        ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(1);
        ctx.strokeRect(-half,0,2*half,2*half);
        ctx.restore();
      };
      box(P0.x,P0.y,s1,acc);
      box(PL.x,PL.y,s2,meas);
      v.label(ctx,`m₁ = ${p.m1} кг`,P0.x,P0.y,-20,-14,acc);
      v.label(ctx,`m₂ = ${p.m2} кг`,PL.x,PL.y,-20,-14,meas);
      // веса (всегда вниз)
      v.arrow(ctx,P0.x,P0.y,P0.x,P0.y-d.W1*kF,dang);
      v.arrow(ctx,PL.x,PL.y,PL.x,PL.y-d.W2*kF,dang);
      v.label(ctx,`${d.W1.toFixed(0)} Н`,P0.x,P0.y-d.W1*kF,6,-4,dang);
      v.label(ctx,`${d.W2.toFixed(0)} Н`,PL.x,PL.y-d.W2*kF,6,-4,dang);
      // дуга суммарного момента вокруг опоры
      if(!d.balanced){
        v.torqueArc(ctx,piv.x,0.1,0.7,-d.tau,d.tau>0?dang:sec);
        v.label(ctx,d.tau>0?'вращает по часовой':'против часовой',piv.x,0.9,-46,0,d.tau>0?dang:sec);
      } else {
        v.label(ctx,'РАВНОВЕСИЕ  Στ = 0',piv.x,0.9,-52,0,sec);
      }
      // подписи моментов
      v.label(ctx,`τ_л = ${(d.W1*d.a).toFixed(0)} Н·м`,piv.x-d.a*0.5,-0.7,-30,0,ink3);
      v.label(ctx,`τ_п = ${(d.W2*d.b).toFixed(0)} Н·м`,piv.x+d.b*0.5,-0.7,-30,0,ink3);
    }

    else if(p.sys==='beam'){
      const L=d.L, Lb=d.Lbeam, rot=s.rot||0;
      // при опрокидывании балка поворачивается вокруг той опоры, что ещё нагружена
      const pivX = d.tipR? 0 : L;
      const R=(x)=>({x:pivX+(x-pivX)*Math.cos(rot), y:(x-pivX)*Math.sin(rot)});
      const B0=R(0), BL=R(Lb);          // балка рисуется на всю длину, включая свес
      // пол — чтобы было видно, куда валится
      if(!d.balanced){
        ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1.2);
        ctx.beginPath(); ctx.moveTo(-1,-0.7); ctx.lineTo(Lb+1,-0.7); ctx.stroke(); ctx.globalAlpha=1;
      }
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(6);
      ctx.beginPath(); ctx.moveTo(B0.x,B0.y); ctx.lineTo(BL.x,BL.y); ctx.stroke();
      // отметка свеса за правой опорой
      if(Lb>L+1e-6){
        const S1=R(L), S2=R(Lb);
        ctx.strokeStyle=sec; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
        ctx.setLineDash([v.lw(3),v.lw(3)]);
        ctx.beginPath(); ctx.moveTo(S1.x,S1.y-0.28); ctx.lineTo(S2.x,S2.y-0.28); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
        v.label(ctx,`свес ${(Lb-L).toFixed(1)} м`,(S1.x+S2.x)/2,(S1.y+S2.y)/2,-24,22,sec);
      }
      /* Опоры стоят на месте. Подписи разведены по вертикали в МИРОВЫХ
         координатах, а не пиксельными сдвигами от одной точки: иначе на
         разных зумах строки наезжали друг на друга (см. отчёт по «грузу за
         опорой»). Реакция показывается только когда она положительна —
         опора умеет лишь подпирать. */
      [[0,d.R1],[L,d.R2]].forEach(([x,Rr])=>{
        ctx.fillStyle=Rr<0?dang:sec; ctx.beginPath();
        ctx.moveTo(x,-0.05); ctx.lineTo(x-0.3,-0.65); ctx.lineTo(x+0.3,-0.65); ctx.closePath(); ctx.fill();
        if(Rr>=0){
          v.arrow(ctx,x,0.05,x,0.05+Rr*kF,sec);
          v.label(ctx,`R = ${Rr.toFixed(0)} Н`,x,0.05+Rr*kF,-26,-8,sec);
        } else {
          // опора, с которой балка снялась: помечаем её и уводим текст вбок
          ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.6);
          ctx.beginPath(); ctx.arc(x,-0.35,0.22,0,7); ctx.stroke();
          v.label(ctx,`опора разгружена (R < 0)`,x,-0.9,-56,0,dang);
        }
      });
      // вес балки в центре (точка едет вместе с балкой)
      const Bc=R(Lb/2);   // центр тяжести — середина ПОЛНОЙ длины, включая свес
      v.arrow(ctx,Bc.x,Bc.y,Bc.x,Bc.y-d.Wb*kF,dang);
      // подпись веса — под остриём стрелки: сбоку она попадала бы на саму балку
      v.label(ctx,`вес балки ${d.Wb.toFixed(0)} Н`,Bc.x,Bc.y-d.Wb*kF,-30,14,dang);
      // груз: поворачивается вместе с балкой
      const Bg=R(p.lpos), bs=0.25;
      ctx.save(); ctx.translate(Bg.x,Bg.y); ctx.rotate(rot);
      ctx.fillStyle=acc; ctx.fillRect(-bs,0,2*bs,2*bs);
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1); ctx.strokeRect(-bs,0,2*bs,2*bs);
      ctx.restore();
      v.label(ctx,`${p.load} кг`,Bg.x,Bg.y,10,-16,acc);
      v.arrow(ctx,Bg.x,Bg.y,Bg.x,Bg.y-d.Wl*kF,dang);
      v.label(ctx,`${d.Wl.toFixed(0)} Н`,Bg.x,Bg.y-d.Wl*kF,8,0,dang);
      // строка состояния — ниже пола, отдельным «этажом», чтобы ни с чем не пересекаться
      const yMsg=-1.35-Math.max(d.Wb,d.Wl)*kF*0.10;
      if(!d.balanced){
        v.torqueArc(ctx,pivX,0.15,0.7,d.tipR?-1:1,dang);
        v.label(ctx,'ОПРОКИДЫВАЕТСЯ: груз вынесен за опору',0,yMsg,0,0,dang);
        v.label(ctx,'опора умеет только подпирать, а не тянуть вниз',0,yMsg,0,16,ink3);
      } else {
        v.label(ctx,'равновесие: обе реакции положительны',0,yMsg,0,0,sec);
      }
    }

    else if(p.sys==='ladder'){
      const th0=d.th, rot=s.rot||0, L=p.Ll;
      const th=th0+rot;                                // при скольжении угол уменьшается (падает)
      const tx=L*Math.cos(th), ty=L*Math.sin(th);
      // пол и стена
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(-0.6,0); ctx.lineTo(tx+1.2,0); ctx.moveTo(0,-0.3); ctx.lineTo(0,ty+1.2); ctx.stroke();
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
      for(let k=-0.6;k<tx+1.2;k+=0.4){ ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k-0.2,-0.2); ctx.stroke(); }
      // лестница: две тетивы и ступеньки — по ним и видно поворот
      const ux=(tx-0)/L, uy=(0-ty)/L;             // единичный вектор вдоль лестницы
      const px=-uy, py=ux, wgap=0.13*L/5+0.06;    // нормаль и полуширина
      ctx.strokeStyle=d.slips?dang:acc; ctx.lineWidth=v.lw(3);
      for(const sgn of [1,-1]){
        ctx.beginPath();
        ctx.moveTo(0+px*wgap*sgn, ty+py*wgap*sgn);
        ctx.lineTo(tx+px*wgap*sgn, 0+py*wgap*sgn);
        ctx.stroke();
      }
      ctx.lineWidth=v.lw(1.6);
      for(let i=1;i<8;i++){
        const t=i/8, bxr=t*tx, byr=ty+t*(0-ty);
        ctx.beginPath();
        ctx.moveTo(bxr+px*wgap, byr+py*wgap);
        ctx.lineTo(bxr-px*wgap, byr-py*wgap);
        ctx.stroke();
      }
      // человек
      const hx=p.sMan*tx, hy=(1-p.sMan)*ty;
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(hx,hy,v.lw(6),0,7); ctx.fill();
      v.label(ctx,`${p.mMan} кг`,hx,hy,10,-6,meas);
      // силы (веса вниз, реакции — от стены/пола)
      v.arrow(ctx,hx,hy,hx,hy-d.Wm*kF,dang);
      v.arrow(ctx,tx*0.5,ty*0.5,tx*0.5,ty*0.5-d.W*kF,dang);
      v.label(ctx,`вес ${d.W.toFixed(0)} Н`,tx*0.5,ty*0.5-d.W*kF,6,-4,dang);
      // реакция стены — горизонтальная, от стены
      v.arrow(ctx,0,ty,d.Fw*kF,ty,sec);
      v.label(ctx,`Fw = ${d.Fw.toFixed(0)} Н`,d.Fw*kF,ty,6,-6,sec);
      // реакция пола — вертикально вверх у основания
      v.arrow(ctx,tx,0,tx,d.N*kF,sec);
      v.label(ctx,`N = ${d.N.toFixed(0)} Н`,tx,d.N*kF,6,4,sec);
      // трение — горизонтально у основания
      v.arrow(ctx,tx,0.02,tx-d.need*kF,0.02,meas);
      v.label(ctx,`Fтр = ${d.need.toFixed(0)} Н`,tx-d.need*kF,0.02,-30,-14,meas);
      v.label(ctx,d.slips?'СКОЛЬЗИТ':'держится',tx*0.5,ty*0.5,14,18,d.slips?dang:sec);
      v.label(ctx,`θ = ${p.ang}°`,0.6,0.12,10,0,ink3);
    }

    else {                                            // кронштейн
      const Lr=p.Lbr, th=d.th, ty=Lr*Math.tan(th);
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(0,-ty-0.6); ctx.lineTo(0,0.9); ctx.stroke();
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
      for(let k=-ty-0.6;k<0.9;k+=0.4){ ctx.beginPath(); ctx.moveTo(0,k); ctx.lineTo(-0.25,k+0.2); ctx.stroke(); }
      // стержень (сжат) и трос (натянут)
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(4);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Lr,0); ctx.stroke();
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2.4);
      ctx.beginPath(); ctx.moveTo(Lr,0); ctx.lineTo(0,ty); ctx.stroke();
      // натяжение троса — вдоль троса от конца стержня
      const tl=Math.hypot(Lr,ty), ux=-Lr/tl, uy=ty/tl;
      v.arrow(ctx,Lr,0,Lr+ux*d.T*kF,uy*d.T*kF,sec);
      v.label(ctx,`T = ${d.T.toFixed(0)} Н`,Lr*0.5,ty*0.5,6,0,sec);
      // вывеска висит на подвесе и слегка покачивается — видно, что тело подвижно
      const bs=0.28, sw=0.12*Math.sin(s.sway||0);
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(Lr,0); ctx.lineTo(Lr+0.22*Math.sin(sw),-0.22*Math.cos(sw)); ctx.stroke();
      ctx.save();
      ctx.translate(Lr,0); ctx.rotate(sw); ctx.translate(-Lr,0);
      ctx.fillStyle=meas; ctx.fillRect(Lr-bs,-0.9,2*bs,0.7);
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1); ctx.strokeRect(Lr-bs,-0.9,2*bs,0.7);
      ctx.restore();
      v.label(ctx,`${p.mSign} кг`,Lr,-0.9,-16,-4,meas);
      v.arrow(ctx,Lr,0,Lr,-d.W*kF,dang);
      v.label(ctx,`${d.W.toFixed(0)} Н`,Lr,-d.W*kF,6,-4,dang);
      v.label(ctx,`стержень сжат: ${d.comp.toFixed(0)} Н`,Lr*0.5,0,-40,16,ink3);
    }
  }
}

,
/* ============ ВРАЩЕНИЕ: СКАТЫВАНИЕ ТЕЛ И МОМЕНТ ИНЕРЦИИ ============
   Орир, т.1: тело катится без проскальзывания по наклонной плоскости.
   Из mg·sinα − Fтр = m·a и Fтр·R = I·ε, при a = ε·R получаем
       a = g·sinα / (1 + I/(mR²)),
   то есть ускорение зависит ТОЛЬКО от формы (через β = I/mR²), но не от
   массы и радиуса. Нужное для качения трение
       Fтр = m·a·β,  условие непроскальзывания:  μ ≥ β·tgα/(1+β).          */
rolling:{
  title:'Скатывание тел: момент инерции решает, кто быстрее',
  params:[
    {key:'ang',label:'Угол наклона α',unit:'°',min:2,max:45,step:0.5,default:20},
    {key:'L',  label:'Длина склона',unit:'м',min:1,max:20,step:0.5,default:6},
    {key:'R',  label:'Радиус тел',unit:'м',min:0.1,max:0.8,step:0.05,default:0.3},
    {key:'m',  label:'Масса каждого тела',unit:'кг',min:0.1,max:50,step:0.1,default:2},
    {key:'mu', label:'Коэффициент трения μ',min:0,max:1.5,step:0.05,default:0.6},
    {key:'g',  label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},
    {type:'group',label:'Кто участвует'},
    {key:'hoop',  label:'Обруч (β = 1)',type:'check',default:true},
    {key:'disk',  label:'Диск / цилиндр (β = 1/2)',type:'check',default:true},
    {key:'sphere',label:'Шар (β = 2/5)',type:'check',default:true},
    {key:'slide', label:'Брусок без трения (β = 0)',type:'check',default:true},
    {type:'group',label:'Показывать'},
    {key:'energy',label:'Разделение энергии',type:'check',default:true}
  ],
  /* β = I/(mR²) — вся форма тела сидит в одном числе */
  BODIES:[
    {key:'hoop',  name:'обруч',  beta:1,   col:'--danger'},
    {key:'disk',  name:'диск',   beta:0.5, col:'--accent'},
    {key:'sphere',name:'шар',    beta:0.4, col:'--second'},
    {key:'slide', name:'брусок', beta:0,   col:'--measure'}
  ],
  active(p){ return this.BODIES.filter(b=>p[b.key]); },
  acc(p,beta){ return p.g*Math.sin(p.ang*Math.PI/180)/(1+beta); },
  /* нужное трение и предельное, которое может дать поверхность */
  fNeed(p,beta){ return p.m*this.acc(p,beta)*beta; },
  fMax(p){ return p.mu*p.m*p.g*Math.cos(p.ang*Math.PI/180); },
  slips(p,beta){ return beta>0 && this.fNeed(p,beta)>this.fMax(p)+1e-9; },
  tFinish(p,beta){ const a=this.acc(p,beta); return a>1e-9? Math.sqrt(2*p.L/a) : Infinity; },
  init(p){
    const st={t:0,event:null,__stop:null,done:{}};
    for(const b of this.BODIES) st[b.key]={s:0,v:0,fin:null};
    return st;
  },
  step(s,dt,p){
    s.t+=dt;
    let allDone=true;
    for(const b of this.active(p)){
      const o=s[b.key];
      if(o.fin!==null) continue;
      allDone=false;
      const a=this.acc(p,b.beta);
      o.v+=a*dt; o.s+=o.v*dt;
      if(o.s>=p.L){ o.s=p.L; o.fin=s.t; }
    }
    // как только финишировал первый — отмечаем событие
    if(!s.done.first){
      const fin=this.active(p).filter(b=>s[b.key].fin!==null);
      if(fin.length){
        s.done.first=true;
        const w=fin[0];
        s.event={type:'first',t:s.t};
        s.__stop=`Первым внизу: ${w.name} (β = ${w.beta}), t = ${s[w.key].fin.toFixed(3)} с`;
      }
    }
  },
  readouts(s,p){
    const a0=p.g*Math.sin(p.ang*Math.PI/180);
    const out=[['t',s.t,'с'],['угол α',p.ang,'°'],
      ['без трения a = g·sinα',a0,'м/с²'],
      ['предельное трение μN',this.fMax(p),'Н']];
    for(const b of this.active(p)){
      const o=s[b.key], a=this.acc(p,b.beta);
      out.push([`${b.name}: a`,a,'м/с²'],
        [`${b.name}: путь`,o.s,'м'],
        [`${b.name}: v`,o.v,'м/с'],
        [`${b.name}: время спуска`,o.fin!==null?o.fin:this.tFinish(p,b.beta),
          o.fin!==null?'с (финиш)':'с (расчёт)'],
        [`${b.name}: нужно трение`,this.fNeed(p,b.beta),
          this.slips(p,b.beta)?'Н — БОЛЬШЕ предельного, поедет юзом':'Н']);
    }
    return out;
  },
  graphs:[
    {label:'Путь по склону',unit:'м',series:['обруч','шар'],
     get(s,p){ return [s.hoop?s.hoop.s:null, s.sphere?s.sphere.s:null]; }},
    {label:'Скорость',unit:'м/с',наклон:0,series:['обруч','шар'],
     get(s,p){ return [s.hoop?s.hoop.v:null, s.sphere?s.sphere.v:null]; }}
  ],
  presets:[
    {name:'Классика: шар обгоняет диск, обруч последний',values:{ang:20,L:6,R:0.3,m:2,mu:0.6}},
    {name:'Крутой склон: трения не хватает, обруч буксует',values:{ang:40,L:6,R:0.3,m:2,mu:0.15}},
    {name:'Только обруч и шар — разница видна лучше всего',values:{ang:25,L:8,R:0.3,m:2,mu:0.8,disk:false,slide:false}},
    {name:'Брусок без трения обгоняет всех',values:{ang:20,L:6,R:0.3,m:2,mu:0.6,slide:true}}
  ],
  anchors(s,p){
    const a=p.ang*Math.PI/180, out=[];
    this.active(p).forEach((b,i)=>{
      const o=s[b.key], lane=(i-1)*2.2*p.R;
      out.push({x:o.s*Math.cos(a)+lane*Math.sin(a), y:-o.s*Math.sin(a)+lane*Math.cos(a)+p.R});
    });
    return out;
  },
  dragPoints(p){ return [{x:p.L*Math.cos(p.ang*Math.PI/180), y:-p.L*Math.sin(p.ang*Math.PI/180)}]; },
  dragMove(p,idx,x,y){
    const L=Math.hypot(x,y); p.L=clamp(Math.round(L*2)/2,1,20);
    const a=Math.atan2(-y,Math.max(x,0.01))*180/Math.PI;
    p.ang=clamp(Math.round(a*2)/2,2,45);
  },
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, a=p.ang*Math.PI/180;
    const spanX=p.L*Math.cos(a)+3, spanY=Math.max(p.L*Math.sin(a)+3.4,4);
    const scale=clamp(Math.min((W-70)/(spanX*PX_PER_M),(H-70)/(spanY*PX_PER_M)),1e-7,30);
    return {x:spanX/2-1.2, y:-p.L*Math.sin(a)/2+0.6, scale};
  },
  draw(ctx,s,v,p){
    const ink=v.c('--ink-2'), ink3=v.c('--ink-3'), dang=v.c('--danger');
    const a=p.ang*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a);
    const ux=[ca,-sa], uy=[sa,ca];                 // вдоль склона и по нормали
    const P=(u,n)=>[u*ux[0]+n*uy[0], u*ux[1]+n*uy[1]];
    // склон
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.4);
    const e0=P(-0.6,0), e1=P(p.L+0.8,0);
    ctx.beginPath(); ctx.moveTo(e0[0],e0[1]); ctx.lineTo(e1[0],e1[1]); ctx.stroke();
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.globalAlpha=.5;
    for(let u=-0.4;u<p.L+0.8;u+=0.42){
      const q=P(u,0); ctx.beginPath(); ctx.moveTo(q[0],q[1]); ctx.lineTo(q[0]-0.16,q[1]-0.24); ctx.stroke();
    }
    ctx.globalAlpha=1;
    // отметки старта и финиша
    const st=P(0,0), fi=P(p.L,0);
    ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1.2);
    ctx.beginPath(); ctx.moveTo(st[0],st[1]); ctx.lineTo(st[0]+uy[0]*1.6,st[1]+uy[1]*1.6);
    ctx.moveTo(fi[0],fi[1]); ctx.lineTo(fi[0]+uy[0]*1.6,fi[1]+uy[1]*1.6); ctx.stroke();
    ctx.setLineDash([]);
    v.label(ctx,'старт',st[0],st[1],-34,-6,ink3);
    v.label(ctx,`финиш, L = ${p.L} м`,fi[0],fi[1],6,-6,ink3);
    v.label(ctx,`α = ${p.ang}°`,P(0.9,0)[0],P(0.9,0)[1],0,20,ink3);
    // тела на своих дорожках
    const act=this.active(p);
    act.forEach((b,i)=>{
      const col=v.c(b.col), o=s[b.key];
      /* Все тела катятся по ОДНОЙ поверхности: центр на расстоянии R по
         нормали. Разносить их по нормали нельзя — тела уходили под склон;
         они и так расходятся сами, потому что ускорения разные. */
      const q=P(o.s, p.R);
      ctx.strokeStyle=col; ctx.lineWidth=v.lw(2);
      if(b.beta===0){
        // брусок: квадрат, скользит без вращения
        ctx.save(); ctx.translate(q[0],q[1]); ctx.rotate(-a);
        ctx.fillStyle=col; ctx.globalAlpha=.2; ctx.fillRect(-p.R,-p.R,2*p.R,2*p.R); ctx.globalAlpha=1;
        ctx.strokeRect(-p.R,-p.R,2*p.R,2*p.R);
        ctx.restore();
      } else {
        ctx.fillStyle=col; ctx.globalAlpha=.18;
        ctx.beginPath(); ctx.arc(q[0],q[1],p.R,0,7); ctx.fill(); ctx.globalAlpha=1;
        ctx.beginPath(); ctx.arc(q[0],q[1],p.R,0,7); ctx.stroke();
        // спица показывает поворот: φ = s/R
        const ph=-o.s/Math.max(p.R,1e-6)-a;
        ctx.beginPath(); ctx.moveTo(q[0],q[1]);
        ctx.lineTo(q[0]+p.R*Math.cos(ph), q[1]+p.R*Math.sin(ph)); ctx.stroke();
        if(b.beta===1){   // у обруча внутренняя окружность — видно, что масса на ободе
          ctx.globalAlpha=.5;
          ctx.beginPath(); ctx.arc(q[0],q[1],p.R*0.82,0,7); ctx.stroke(); ctx.globalAlpha=1;
        }
      }
      const lab=`${b.name} β=${b.beta}`+(o.fin!==null?`  ${o.fin.toFixed(2)} с`:'');
      v.label(ctx,lab,q[0],q[1],-14,-p.R*20-10-i*13,col);
      if(this.slips(p,b.beta)) v.label(ctx,'буксует!',q[0],q[1],-14,p.R*20+14,dang);
    });
    // разделение энергии для первого активного тела
    if(p.energy && act.length){
      const b=act[0], o=s[b.key];
      const Ek=0.5*p.m*o.v*o.v, Er=0.5*p.m*b.beta*o.v*o.v;
      const yb=P(0.2,0)[1]-2.4, xb=P(0.2,0)[0];
      v.label(ctx,`${b.name}: поступательная ${Ek.toFixed(2)} Дж, вращательная ${Er.toFixed(2)} Дж`,xb,yb,0,0,ink3);
      v.label(ctx,`доля вращения β/(1+β) = ${(b.beta/(1+b.beta)*100).toFixed(0)} % энергии`,xb,yb,0,16,ink3);
    }
    v.label(ctx,'a = g·sinα / (1 + I/mR²) — масса и радиус не влияют, важна только форма',
      P(-0.5,0)[0],P(-0.5,0)[1]-3.0,0,0,ink3);
  }
}
,
/* ================= ГИДРОСТАТИКА: АРХИМЕД И ПЛАВАНИЕ =================
   Орир, т.1. Сила Архимеда равна весу вытесненной жидкости:
       F_A = ρж·g·V_погр.
   Плавающее тело тонет ровно настолько, чтобы F_A уравновесила вес:
       ρт·V·g = ρж·g·V_погр  ⇒  V_погр/V = ρт/ρж.
   Если ρт > ρж, тело тонет и лежит на дне: N = mg − F_A.
   Давление на глубине: p = p₀ + ρж·g·h.                                  */
buoyancy:{
  title:'Архимед: плавает, тонет или висит',
  params:[
    {key:'shape',label:'Тело',type:'select',default:'cube',
     options:[{v:'cube',t:'Куб (сторона a)'},{v:'ball',t:'Шар (радиус R)'}]},
    {key:'a',   label:'Размер тела (сторона / радиус)',unit:'м',min:0.1,max:1.2,step:0.05,default:0.4},
    {key:'rho', label:'Плотность тела ρт',unit:'кг/м³',min:50,max:12000,step:10,default:600},
    {key:'liq', label:'Жидкость',type:'select',default:'water',
     options:[{v:'water',t:'вода, 1000 кг/м³'},{v:'oil',t:'масло, 900'},
              {v:'sea',  t:'морская вода, 1025'},{v:'merc',t:'ртуть, 13546'}]},
    {key:'depth',label:'Глубина сосуда',unit:'м',min:0.5,max:4,step:0.1,default:1.6},
    {key:'g',   label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},
    {type:'group',label:'Показывать'},
    {key:'forces',label:'Силы',type:'check',default:true},
    {key:'press', label:'Эпюра давления',type:'check',default:true}
  ],
  RHO:{water:1000, oil:900, sea:1025, merc:13546},
  nameOf:{water:'вода', oil:'масло', sea:'морская вода', merc:'ртуть'},
  rhoL(p){ return this.RHO[p.liq]; },
  vol(p){ return p.shape==='cube'? Math.pow(p.a,3) : (4/3)*Math.PI*Math.pow(p.a,3); },
  mass(p){ return p.rho*this.vol(p); },
  /* доля объёма под водой в равновесии (для плавающего тела) */
  frac(p){ return clamp(p.rho/this.rhoL(p),0,1); },
  floats(p){ return p.rho<this.rhoL(p); },
  /* Погружённый объём при заданной осадке d (глубина погружения тела) */
  subVol(p,d){
    const h=p.shape==='cube'? p.a : 2*p.a;
    const t=clamp(d,0,h);
    if(p.shape==='cube') return p.a*p.a*t;
    // шаровой сегмент: V = π·t²·(3R − t)/3
    return Math.PI*t*t*(3*p.a-t)/3;
  },
  height(p){ return p.shape==='cube'? p.a : 2*p.a; },
  FA(p,d){ return this.rhoL(p)*p.g*this.subVol(p,d); },
  init(p){
    // тело начинает у поверхности и приходит к равновесию
    return {t:0, d:0.02, v:0, rest:false, event:null, __stop:null};
  },
  step(s,dt,p){
    s.t+=dt;
    const m=this.mass(p), W=m*p.g, H=this.height(p);
    /* Осадка d отсчитывается ВНИЗ, поэтому и силу берём вниз-положительной:
       вес тянет топить, Архимед — выталкивать. (Со знаком «вверх» тело
       всплывало из воды вместо того, чтобы садиться на свою ватерлинию.) */
    const F=W-this.FA(p,s.d);
    // вязкое сопротивление, чтобы тело не качалось вечно
    const drag=-6*this.rhoL(p)*Math.pow(p.a,2)*s.v*0.5;
    const acc=(F+drag)/m;
    s.v+=acc*dt; s.d+=s.v*dt;
    // дно сосуда: глубже погрузиться некуда
    if(s.d>Math.min(H,p.depth)){ s.d=Math.min(H,p.depth); if(s.v>0) s.v=0; }
    if(s.d<0){ s.d=0; if(s.v<0) s.v=0; }
    if(!s.rest && Math.abs(s.v)<1e-3 && s.t>1.2){
      s.rest=true; s.event={type:'rest',t:s.t};
      s.__stop=this.floats(p)
        ? `Тело всплыло и плавает: под водой ${(100*this.subVol(p,s.d)/this.vol(p)).toFixed(1)} % объёма`
        : `Тело утонуло: сила Архимеда меньше веса`;
    }
  },
  readouts(s,p){
    const V=this.vol(p), m=this.mass(p), W=m*p.g;
    const FA=this.FA(p,s.d), Vs=this.subVol(p,s.d);
    const rl=this.rhoL(p);
    return [['t',s.t,'с'],
      ['объём тела V',V*1000,'л'],
      ['масса тела',m,'кг'],
      ['вес mg',W,'Н'],
      ['плотность тела ρт',p.rho,'кг/м³'],
      ['плотность жидкости ρж',rl,'кг/м³'],
      ['осадка (глубина погружения)',s.d,'м'],
      ['погружённый объём',Vs*1000,'л'],
      ['доля под водой',100*Vs/V,'%'],
      ['сила Архимеда F_A = ρж·g·V',FA,'Н'],
      ['равнодействующая F_A − mg',FA-W,'Н'],
      ['теоретическая доля ρт/ρж',this.floats(p)?100*this.frac(p):100,
        this.floats(p)?'% — тело плавает':'% — тело тонет'],
      ['давление на дне p = ρ·g·h',rl*p.g*p.depth,'Па'],
      ['состояние',0, this.floats(p)?'плавает':'тонет']];
  },
  graphs:[
    {label:'Осадка',unit:'м',series:['d'],get(s,p){ return [s.d,null]; }},
    {label:'Силы: Архимеда и вес',unit:'Н',series:['F_A','mg'],
     get(s,p){ return [SIMS.buoyancy.FA(p,s.d), SIMS.buoyancy.mass(p)*p.g]; }}
  ],
  presets:[
    {name:'Дерево в воде: плавает, погружено 60 %',values:{shape:'cube',a:0.4,rho:600,liq:'water'}},
    {name:'Лёд в воде: над водой лишь десятая часть',values:{shape:'cube',a:0.4,rho:917,liq:'water'}},
    {name:'Сталь в воде: тонет',values:{shape:'cube',a:0.3,rho:7800,liq:'water'}},
    {name:'Сталь в ртути: всплывает!',values:{shape:'cube',a:0.3,rho:7800,liq:'merc'}},
    {name:'Шар ровно нейтральный (ρт = ρж)',values:{shape:'ball',a:0.3,rho:1000,liq:'water'}}
  ],
  anchors(s,p){ return [{x:0,y:-s.d+this.height(p)/2}]; },
  dragPoints(p){ return [{x:0,y:0}]; },
  dragMove(p,idx,x,y){ /* уровень жидкости фиксирован — тянуть нечего */ },
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const spanY=p.depth+2.2, spanX=4.4;
    const scale=clamp(Math.min((W-70)/(spanX*PX_PER_M),(H-70)/(spanY*PX_PER_M)),1e-7,30);
    return {x:0,y:-p.depth/2+0.5,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const W=1.9, D=p.depth, rl=this.rhoL(p);
    // сосуд
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.4);
    ctx.beginPath(); ctx.moveTo(-W,0.7); ctx.lineTo(-W,-D); ctx.lineTo(W,-D); ctx.lineTo(W,0.7); ctx.stroke();
    // жидкость
    ctx.fillStyle=sec; ctx.globalAlpha=.16; ctx.fillRect(-W,-D,2*W,D); ctx.globalAlpha=1;
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.moveTo(-W,0); ctx.lineTo(W,0); ctx.stroke();
    v.label(ctx,`${this.nameOf[p.liq]}, ρж = ${rl} кг/м³`,-W,0,4,-10,sec);
    // эпюра давления по стенке: p = ρgh растёт линейно с глубиной
    if(p.press){
      const pmax=rl*p.g*D, sc=0.9/Math.max(pmax,1);
      ctx.strokeStyle=meas; ctx.globalAlpha=.65; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.moveTo(W,0); ctx.lineTo(W+pmax*sc,-D); ctx.lineTo(W,-D); ctx.stroke();
      for(let i=1;i<=5;i++){
        const h=D*i/5, pr=rl*p.g*h;
        ctx.beginPath(); ctx.moveTo(W,-h); ctx.lineTo(W+pr*sc,-h); ctx.stroke();
      }
      ctx.globalAlpha=1;
      v.label(ctx,`p = ρgh, на дне ${(pmax/1000).toFixed(1)} кПа`,W,-D,6,-8,meas);
    }
    // тело
    /* Осадка s.d — насколько тело утоплено считая от его дна. Значит дно
       лежит на y = −d, а центр — на полвысоты выше. (Раньше за центр брали
       само дно, и тело рисовалось целиком под водой.) */
    const H=this.height(p), yc=-s.d+H/2;
    /* Тело НЕПРОЗРАЧНО. Раньше оно заливалось акцентом с alpha 0.30, и
       погружаясь, шар просвечивал жидкостью — выглядело как исчезновение
       тела, а не как погружение. Красим в два слоя: сначала фоном сцены
       (он и делает тело плотным), сверху — тот же лёгкий акцент. */
    const bg=v.c('--canvas');
    if(p.shape==='cube'){
      ctx.fillStyle=bg; ctx.fillRect(-p.a/2,yc-p.a/2,p.a,p.a);
      ctx.fillStyle=acc; ctx.globalAlpha=.30;
      ctx.fillRect(-p.a/2,yc-p.a/2,p.a,p.a); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2); ctx.strokeRect(-p.a/2,yc-p.a/2,p.a,p.a);
    } else {
      ctx.beginPath(); ctx.arc(0,yc,p.a,0,7);
      ctx.fillStyle=bg; ctx.fill();
      ctx.fillStyle=acc; ctx.globalAlpha=.30; ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.arc(0,yc,p.a,0,7); ctx.stroke();
    }
    v.label(ctx,`ρт = ${p.rho} кг/м³`,0,yc,-30,-H*20-8,acc);
    /* Силы — диаграммой свободного тела из ЦЕНТРА тела. Раньше F_A и N были
       сдвинуты по горизонтали на 0.16 м, чтобы не совпасть с mg, и казалось,
       что они приложены мимо тела. Противоположно направленные стрелки из
       одной точки и так не накладываются. */
    if(p.forces){
      const m=this.mass(p), Wt=m*p.g, FA=this.FA(p,s.d);
      const F=[{fx:0, fy:-Wt, label:'mg', color:dang}];
      if(FA>1e-6) F.push({fx:0, fy:FA, label:'F_A', color:sec});
      // лежит на дне — добавляется реакция дна
      if(!this.floats(p) && s.d>=Math.min(H,D)-1e-6)
        F.push({fx:0, fy:Math.max(0,Wt-FA), label:'N', color:meas});
      v.fbd(ctx,{x:0, y:yc, forces:F, len:1.0, resultant:false, units:'Н'});
    }
    // ватерлиния тела
    if(s.d>0.001 && s.d<H){
      ctx.strokeStyle=meas; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.moveTo(-p.a*0.9,0); ctx.lineTo(p.a*0.9,0); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,`под водой ${(100*this.subVol(p,s.d)/this.vol(p)).toFixed(0)} %`,p.a*0.9,0,6,14,meas);
    }
    // вывод
    const f=this.floats(p);
    v.label(ctx, f? `ρт < ρж — плавает, погружено ρт/ρж = ${(100*this.frac(p)).toFixed(1)} % объёма`
                  : `ρт > ρж — тонет: веса больше, чем может вытолкнуть жидкость`,
      -W,-D,0,26,f?sec:dang);
    v.label(ctx,'сила Архимеда равна весу вытесненной жидкости, а не весу тела',
      -W,-D,0,42,ink3);
  }
}
,
/* ============ РЕАКТИВНОЕ ДВИЖЕНИЕ: УРАВНЕНИЕ ЦИОЛКОВСКОГО ============
   Орир, т.1, глава об импульсе. Ракета — единственное тело, которое разгоняется,
   ничего не отталкивая снаружи: она отбрасывает часть САМОЙ СЕБЯ.

   За время dt ракета выбрасывает массу dm со скоростью u относительно себя.
   Сохранение импульса замкнутой системы «ракета + выброшенный газ» даёт
       m·dv = u·dm      ⇒      dv/dt = u·q/m(t),        q = dm/dt — расход,
   где F = q·u — реактивная тяга. Она НЕ зависит от скорости ракеты.
   Интегрируя от m₀ до m_к, получаем формулу Циолковского:
       Δv = u·ln(m₀/m_к).
   При старте с Земли к этому добавляется потеря на тяготение −g·t_раб:
   чем дольше горит топливо, тем больше «съедает» сила тяжести.            */
rocket:{
  title:'Реактивное движение: формула Циолковского',
  /* Высота сжата масштабом, иначе ракета мгновенно улетела бы за кадр.
     Поэтому ни осей с числами, ни надписи «сетка N м». */
  schema:true,
  params:[
    {key:'where',label:'Где летим',type:'select',default:'space',
     options:[{v:'space',t:'В космосе — чистая формула Циолковского'},
              {v:'earth',t:'Старт с Земли — с тяготением'}]},
    {key:'mp', label:'Масса ракеты без топлива m_к',unit:'кг',min:100,max:20000,step:100,default:2000},
    {key:'mf', label:'Масса топлива',unit:'кг',min:100,max:200000,step:100,default:18000},
    {key:'u',  label:'Скорость истечения газов u',unit:'м/с',min:500,max:5000,step:50,default:3000},
    {key:'q',  label:'Расход топлива q',unit:'кг/с',min:10,max:2000,step:10,default:200},
    {key:'g',  label:'Ускорение свободного падения g',unit:'м/с²',min:0,max:20,step:0.1,default:9.8},

    {type:'group',label:'Показывать'},
    {key:'vec',   label:'Тяга и вес',type:'check',default:true},
    {key:'jet',   label:'Струю газов',type:'check',default:true},
    {key:'tank',  label:'Указатель топлива',type:'check',default:true},
    {key:'ideal', label:'Идеальный Δv по Циолковскому',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'stopBurn',label:'Когда топливо кончится',type:'check',default:true},
    {key:'tStop',   label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],
  m0(p){ return p.mp+p.mf; },                          // стартовая масса
  tBurn(p){ return p.mf/Math.max(p.q,1e-9); },         // время работы двигателя
  /* идеальный прирост скорости и потеря на тяготение */
  dvIdeal(p){ return p.u*Math.log(this.m0(p)/Math.max(p.mp,1e-9)); },
  gLoss(p){ return p.where==='earth' ? p.g*this.tBurn(p) : 0; },
  init(p){
    return {t:0,y:0,v:0,m:this.m0(p),burned:0,jet:0,vmax:0,event:null,__stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t; s.jet+=dt*6;
    const g = p.where==='earth' ? p.g : 0;
    const burning = s.burned < p.mf-1e-9;
    // расход и тяга: пока есть топливо
    let F=0;
    if(burning){
      const dm=Math.min(p.q*dt, p.mf-s.burned);
      s.burned+=dm; s.m=this.m0(p)-s.burned;
      F=p.q*p.u;                                        // реактивная тяга F = q·u
    } else s.m=p.mp;
    const a=F/Math.max(s.m,1e-9)-g;
    s.v+=a*dt; s.y+=s.v*dt;
    s.a=a;
    if(s.v>s.vmax) s.vmax=s.v;
    /* На Земле ракета может не оторваться: если тяга меньше веса, она просто
       стоит на стартовом столе, а не проваливается сквозь него. */
    if(p.where==='earth'&&s.y<0){ s.y=0; if(s.v<0) s.v=0; }
    if(burning && s.burned>=p.mf-1e-9 && p.stopBurn && !s.event){
      s.event={t:s.t,type:'burnout'};
      s.__stop=`Топливо кончилось: t = ${s.t.toFixed(2)} с, v = ${s.v.toFixed(1)} м/с`;
    }
  },
  // якорь — ЦЕНТР корпуса (корпус занимает Y−0.7 … Y+1.15), а не срез сопла
  anchors(s,p){ return [{x:0,y:s.y/this.yScale(p)+0.2}]; },
  /* Высоты бывают километровые, поэтому сцену меряем в «экранных метрах»:
     весь подъём за время работы двигателя укладывается в 8 единиц. */
  yScale(p){
    const tb=this.tBurn(p), dv=this.dvIdeal(p)-this.gLoss(p);
    return Math.max(1, Math.abs(dv)*tb/2/8);
  },
  readouts(s,p){
    const tb=this.tBurn(p), burning=s.burned<p.mf-1e-9;
    const F=burning?p.q*p.u:0;
    return [['t',s.t,'с'],
      ['стартовая масса m₀',this.m0(p),'кг'],
      ['масса сейчас m(t)',s.m,'кг'],
      ['осталось топлива',p.mf-s.burned,'кг'],
      ['отношение масс m₀/m_к',this.m0(p)/Math.max(p.mp,1e-9),''],
      ['реактивная тяга F = q·u',F,'Н'],
      ['вес ракеты m·g',p.where==='earth'?s.m*p.g:0,'Н'],
      ['ускорение a = F/m − g',s.a||0,'м/с²'],
      ['скорость v',s.v,'м/с'],
      ['высота h',s.y,'м'],
      ['время работы двигателя',tb,'с'],
      ['идеальный Δv = u·ln(m₀/m_к)',this.dvIdeal(p),'м/с'],
      ['потеря на тяготение g·t_раб',this.gLoss(p),'м/с'],
      ['ожидаемая скорость в конце',this.dvIdeal(p)-this.gLoss(p),'м/с'],
      ['максимальная скорость',s.vmax,'м/с']];
  },
  graphs:[
    {label:'Скорость ракеты',unit:'м/с',series:['v'],get(s,p){ return [s.v,null]; }},
    {label:'Масса ракеты',unit:'кг',series:['m'],get(s,p){ return [s.m,null]; }},
    {label:'Ускорение',unit:'м/с²',наклон:0,series:['a'],get(s,p){ return [s.a||0,null]; }}
  ],
  presets:[
    {name:'В космосе: чистая формула Циолковского',
     values:{where:'space',mp:2000,mf:18000,u:3000,q:200,tStop:0}},
    {name:'Старт с Земли: видна потеря на тяготение',
     values:{where:'earth',mp:2000,mf:18000,u:3000,q:400,g:9.8,tStop:0}},
    {name:'Тяга меньше веса — ракета не взлетит',
     values:{where:'earth',mp:8000,mf:12000,u:1500,q:40,g:9.8,tStop:0}},
    {name:'Больше топлива — прирост растёт лишь как логарифм',
     values:{where:'space',mp:2000,mf:120000,u:3000,q:600,tStop:0}},
    {name:'Быстрое истечение важнее запаса топлива',
     values:{where:'space',mp:2000,mf:18000,u:4500,q:200,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-60)/(9*PX_PER_M),(H-60)/(12*PX_PER_M)),0.002,30);
    return {x:0,y:3,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), dang=v.c('--danger'), meas=v.c('--measure'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    const Y=s.y/this.yScale(p);                       // экранная высота ракеты
    const burning=s.burned<p.mf-1e-9;

    // ---- земля и стартовый стол (только при старте с Земли)
    if(p.where==='earth'){
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(-4.5,0); ctx.lineTo(4.5,0); ctx.stroke();
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.globalAlpha=.6;
      for(let x=-4.4;x<4.5;x+=0.5){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x-0.3,-0.3); ctx.stroke(); }
      ctx.globalAlpha=1;
    }

    // ---- струя газов: длина ∝ расходу, мерцает
    if(p.jet&&burning){
      const L=clamp(p.q/200,0.3,2.2);
      for(let i=0;i<7;i++){
        const f=i/7, w=0.34*(1-f)+0.06;
        ctx.fillStyle=i<3?dang:meas; ctx.globalAlpha=(1-f)*0.75*(0.75+0.25*Math.sin(s.jet+i));
        ctx.beginPath();
        ctx.ellipse(0,Y-0.75-L*f,w,L*0.22,0,0,7); ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    // ---- корпус ракеты
    ctx.fillStyle=v.c('--panel'); ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.beginPath();
    ctx.moveTo(0,Y+1.15);                 // нос
    ctx.lineTo(0.3,Y+0.4); ctx.lineTo(0.3,Y-0.7);
    ctx.lineTo(-0.3,Y-0.7); ctx.lineTo(-0.3,Y+0.4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();                       // стабилизаторы
    ctx.moveTo(0.3,Y-0.35); ctx.lineTo(0.68,Y-0.75); ctx.lineTo(0.3,Y-0.75);
    ctx.moveTo(-0.3,Y-0.35); ctx.lineTo(-0.68,Y-0.75); ctx.lineTo(-0.3,Y-0.75);
    ctx.fillStyle=acc; ctx.fill(); ctx.stroke();

    // ---- бак: сколько топлива осталось
    if(p.tank){
      const frac=clamp(1-s.burned/Math.max(p.mf,1e-9),0,1);
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
      ctx.strokeRect(-0.22,Y-0.6,0.44,0.85);
      ctx.fillStyle=meas; ctx.globalAlpha=.65;
      ctx.fillRect(-0.22,Y-0.6,0.44,0.85*frac); ctx.globalAlpha=1;
    }

    /* ---- Силы приложены к ЦЕНТРУ ракеты: тяга вверх, вес вниз. Тяга не
       зависит от скорости — это главное, что стоит увидеть. */
    if(p.vec){
      /* Тяга и вес — в килоньютонах: fbd сам дописывает значение к подписи,
         и в ньютонах это было бы «600000.0 Н» поперёк всей сцены. */
      const F=(burning?p.q*p.u:0)/1000, Wt=(p.where==='earth'?s.m*p.g:0)/1000;
      const forces=[];
      if(F>0)  forces.push({fx:0,fy:F, label:'тяга F = q·u',color:dang});
      if(Wt>0) forces.push({fx:0,fy:-Wt,label:'вес m·g',color:acc});
      if(forces.length) v.fbd(ctx,{x:0,y:Y+0.2,forces,len:1.9,units:'кН',resultant:false});
    }

    // ---- шкала высоты слева
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(-3.6,0); ctx.lineTo(-3.6,9); ctx.stroke(); ctx.globalAlpha=1;
    for(let i=0;i<=8;i+=2){
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5;
      ctx.beginPath(); ctx.moveTo(-3.75,i); ctx.lineTo(-3.45,i); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,fmtKm(i*this.yScale(p)),-3.75,i,-46,0,ink3);
    }
    v.label(ctx,'высота',-3.75,9,-30,-14,ink3);

    /* Сводка — справа и ВЫШЕ ракеты: под ней проходит стрелка веса со своей
       подписью, и раньше строки накладывались друг на друга. */
    const x0=2.4, ys=Y+1.55;
    v.label(ctx,`v = ${s.v.toFixed(1)} м/с`,x0,ys,0,0,meas);
    v.label(ctx,`m = ${s.m.toFixed(0)} кг`,x0,ys,0,14,ink3);
    v.label(ctx,`a = ${(s.a||0).toFixed(2)} м/с²`,x0,ys,0,28,ink3);

    // ---- итог главы внизу
    const dv=this.dvIdeal(p), loss=this.gLoss(p);
    v.label(ctx,`Δv = u·ln(m₀/m_к) = ${p.u} · ln(${(this.m0(p)/p.mp).toFixed(2)}) = ${dv.toFixed(0)} м/с`,
      0,-1.5,-150,0,ink3);
    if(p.where==='earth')
      v.label(ctx,`потеря на тяготение g·t_раб = ${loss.toFixed(0)} м/с  →  ожидаемо ${(dv-loss).toFixed(0)} м/с`,
        0,-1.5,-150,14,meas);
    if(p.ideal)
      v.label(ctx,'прирост скорости растёт лишь как ЛОГАРИФМ отношения масс — вот почему ракеты многоступенчатые',
        0,-1.5,-150,28,ink3);
    // не оторвались от стола — прямо об этом говорим
    if(p.where==='earth'&&burning&&p.q*p.u<=s.m*p.g)
      v.label(ctx,'тяга меньше веса — ракета не отрывается от стартового стола',0,-1.5,-150,42,dang);
    else if(!burning)
      v.label(ctx,`двигатель отработал: дальше — свободный полёт (v_max = ${s.vmax.toFixed(0)} м/с)`,
        0,-1.5,-150,42,ok);
  }
}
,


/* ======================= ЛИФТ: ВЕС И НЕВЕСОМОСТЬ =======================
   Орир, т.1: вес — это сила, с которой тело давит на опору, а не сила
   тяжести. Груз стоит на весах в кабине; по второму закону для оси,
   направленной вверх,
       N − mg = m·a   ⇒   P = N = m(g + a).
   Разгон вверх и торможение при спуске (a > 0) — весы показывают больше,
   разгон вниз и торможение при подъёме (a < 0) — меньше, свободное падение
   (a = −g) — ноль: невесомость.

   Поездка задана так же, как у настоящего лифта: разгон с ускорением a до
   скорости v_max, равномерный ход, торможение с тем же ускорением. Если
   этаж близко и до v_max разогнаться не успеть, ход треугольный. Профиль
   считается аналитически (профиль()), а не интегрированием — поэтому время
   поездки и путь разгона в задачах совпадают с моделью до последней цифры.

   Сцена — схема (schema): слева вся шахта в масштабе поездки, справа
   кабина крупно. Метров на сетке нет, есть этажи по 3 м. */
lift:{
  title:'Лифт: вес, перегрузка и невесомость',
  schema:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'trip',
     options:[{v:'trip',t:'Поездка: разгон, ход, торможение'},{v:'break',t:'Обрыв троса: свободное падение'}]},
    {key:'m',label:'Масса груза m',unit:'кг',min:1,max:500,step:1,default:70},
    {key:'g',label:'Ускорение g',unit:'м/с²',min:1,max:25,step:0.1,default:9.8},

    {type:'group',label:'Поездка',если:p=>p.mode==='trip'},
    {key:'dir',label:'Направление',type:'select',default:'up',если:p=>p.mode==='trip',
     options:[{v:'up',t:'Вверх'},{v:'down',t:'Вниз'}]},
    {key:'H',label:'Путь кабины',unit:'м',min:3,max:300,step:1,default:30},
    {key:'a',label:'Ускорение разгона и торможения',unit:'м/с²',min:0.2,max:8,step:0.1,default:1.5,если:p=>p.mode==='trip'},
    {key:'vmax',label:'Скорость хода v_max',unit:'м/с',min:0.5,max:12,step:0.1,default:3,если:p=>p.mode==='trip'},

    {type:'group',label:'Обрыв троса',если:p=>p.mode==='break'},
    {key:'tBreak',label:'Трос обрывается в момент',unit:'с',min:0,max:10,step:0.1,default:1,если:p=>p.mode==='break'},

    {type:'group',label:'Показывать'},
    {key:'forces',label:'Силы на груз (в центре масс)',type:'check',default:true},
    {key:'accel', label:'Ускорение кабины',type:'check',default:true},
    {key:'stopEnd',label:'Остановить таймер, когда кабина встала',type:'check',default:true}
  ],
  /* Профиль поездки: путь s ≥ 0 вдоль направления, скорость и ускорение
     вдоль него, фаза и полное время T. */
  профиль(p,t){
    const d=Math.max(0,p.H), a=Math.max(1e-6,p.a), vm=Math.max(1e-6,p.vmax);
    let vpk=vm, t1=vm/a, d1=vm*vm/(2*a), tc=(d-2*d1)/vm;
    if(tc<0){ vpk=Math.sqrt(a*d); t1=vpk/a; d1=d/2; tc=0; }
    const T=2*t1+tc;
    if(t<=0) return {s:0,v:0,acc:a,фаза:'разгон',T,t1,tc,d1,vpk};
    if(t<t1) return {s:a*t*t/2,v:a*t,acc:a,фаза:'разгон',T,t1,tc,d1,vpk};
    if(t<t1+tc) return {s:d1+vpk*(t-t1),v:vpk,acc:0,фаза:'равномерный ход',T,t1,tc,d1,vpk};
    if(t<T){ const τ=t-t1-tc; return {s:d1+vpk*tc+vpk*τ-a*τ*τ/2,v:vpk-a*τ,acc:-a,фаза:'торможение',T,t1,tc,d1,vpk}; }
    return {s:d,v:0,acc:0,фаза:'приехали',T,t1,tc,d1,vpk};
  },
  /* Кинематика кабины по оси «вверх»: высота, скорость, ускорение, фаза. */
  кабина(p,t){
    if(p.mode==='break'){
      const H=Math.max(0,p.H), tb=Math.max(0,p.tBreak);
      if(t<tb) return {y:H,v:0,a:0,фаза:'трос держит',свобода:false};
      const τ=t-tb, y=H-p.g*τ*τ/2;
      if(y<=0) return {y:0,v:0,a:0,фаза:'удар о дно шахты',свобода:false,дно:true};
      return {y,v:-p.g*τ,a:-p.g,фаза:'свободное падение',свобода:true};
    }
    const σ=p.dir==='down'?-1:1, y0=p.dir==='down'?p.H:0, пр=this.профиль(p,t);
    return {y:y0+σ*пр.s,v:σ*пр.v,a:σ*пр.acc,фаза:пр.фаза,T:пр.T};
  },
  вес(p,к){ return Math.max(0,p.m*(p.g+к.a)); },
  init(p){ const s={t:0,event:null,__stop:null}; Object.assign(s,this.кабина(p,0)); return s; },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt, к=this.кабина(p,t);
    Object.assign(s,к); s.t=t;
    if(p.mode==='trip'&&к.фаза==='приехали'){
      s.event={t,type:'arrive'};
      if(p.stopEnd) s.__stop=`Лифт приехал: ${p.H} м за ${к.T.toFixed(2)} с`;
    }
    if(p.mode==='break'&&к.дно){
      const vуд=Math.sqrt(2*p.g*p.H);
      s.event={t,type:'hit'};
      if(p.stopEnd) s.__stop=`Кабина упала с ${p.H} м: скорость удара ${vуд.toFixed(1)} м/с (${(vуд*3.6).toFixed(0)} км/ч)`;
    }
  },
  readouts(s,p){
    const P=this.вес(p,s);
    return [['t',s.t,'с'],
      ['фаза',s.фаза,''],
      ['высота кабины h',s.y,'м'],
      ['скорость v (ось вверх)',s.v,'м/с'],
      ['ускорение a (ось вверх)',s.a,'м/с²'],
      ['сила тяжести mg',p.m*p.g,'Н'],
      ['вес P = m(g + a)',P,'Н'],
      ['показания весов',P/p.g,'кг'],
      ['перегрузка P / mg',P/(p.m*p.g),'']];
  },
  graphs:[
    {label:'h(t) — высота кабины',unit:'м',series:['h'],get:s=>[s.y,null]},
    {label:'v(t) — скорость (наклон h(t))',unit:'м/с',наклон:0,series:['v'],get:s=>[s.v,null]},
    {label:'a(t) — ускорение (наклон v(t))',unit:'м/с²',наклон:1,series:['a'],get:s=>[s.a,null]},
    {label:'Вес P и сила тяжести mg',unit:'Н',series:['P','mg'],get(s,p){ return [SIMS.lift.вес(p,s),p.m*p.g]; }}
  ],
  presets:[
    {name:'Скоростной лифт небоскрёба',values:{mode:'trip',dir:'up',H:240,a:1.2,vmax:10,m:70}},
    {name:'Один этаж вниз: разогнаться не успевает',values:{mode:'trip',dir:'down',H:3,a:1,vmax:3,m:70}},
    {name:'Резкий разгон вверх — перегрузка',values:{mode:'trip',dir:'up',H:30,a:5,vmax:6,m:70}},
    {name:'Обрыв троса: невесомость',values:{mode:'break',H:30,tBreak:1,m:70}},
    {name:'Лифт на Луне',values:{mode:'trip',dir:'up',H:30,a:1.5,vmax:3,g:1.6}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    /* Рисунок занимает правые две трети: левый верхний угол по умолчанию
       отдан панели показаний, и шахта под ней была не видна. */
    const spanX=15, spanY=10.4;
    const scale=clamp(Math.min((W-24)/(spanX*PX_PER_M),(H-24)/(spanY*PX_PER_M)),0.002,30);
    return {x:1.6,y:4.3,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink=v.c('--ink'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line'), ok=v.c('--ok'), panel=v.c('--panel');
    const P=this.вес(p,s), mg=p.m*p.g, Hs=Math.max(3,p.H);
    /* ---- шахта целиком: 8 единиц схемы на весь путь ---- */
    const sx0=6.2, sx1=7.8, sy0=0, sy1=8.2, k=(sy1-sy0)/Hs;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4);
    ctx.strokeRect(sx0,sy0,sx1-sx0,sy1-sy0);
    const шагЭт=Math.max(3,Math.ceil(Hs/24/3)*3);           // не больше ~24 отметок
    ctx.strokeStyle=line; ctx.lineWidth=v.lw(1);
    for(let h=шагЭт;h<Hs;h+=шагЭт){ const y=sy0+h*k; ctx.beginPath(); ctx.moveTo(sx0,y); ctx.lineTo(sx0+0.3,y); ctx.moveTo(sx1-0.3,y); ctx.lineTo(sx1,y); ctx.stroke(); }
    v.label(ctx,`${fmtKm(Hs)}`,sx0,sy1,0,-10,ink3);
    v.label(ctx,'0 м',sx0,sy0,0,12,ink3);
    v.label(ctx,'шахта',sx0,sy0,0,26,ink3);
    const cy=sy0+clamp(s.y,0,Hs)*k, ch=0.55;
    // трос (в обрыве — оборванный конец висит сверху)
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.2);
    ctx.beginPath(); const mx=(sx0+sx1)/2;
    if(p.mode==='break'&&s.t>=p.tBreak){ ctx.moveTo(mx,sy1); ctx.lineTo(mx,sy1-0.5); }
    else { ctx.moveTo(mx,sy1); ctx.lineTo(mx,cy+ch); }
    ctx.stroke();
    ctx.fillStyle=acc; ctx.fillRect(sx0+0.18,cy,sx1-sx0-0.36,ch);
    v.label(ctx,`h = ${s.y.toFixed(1)} м`,sx0,cy+ch/2,-70,0,acc);

    /* ---- кабина крупно ---- */
    const bx0=-1.6, bx1=4.6, by0=0.4, by1=8.2;
    // стены шахты за кабиной: отметки этажей проплывают мимо — видно движение
    ctx.save(); ctx.beginPath(); ctx.rect(bx0-1.1,by0-0.4,bx1-bx0+2.2,by1-by0+0.8); ctx.clip();
    const этаж=3, пикс=(by1-by0)/6;                         // 6 м шахты на высоту кабины
    const сдвиг=((s.y%этаж)+этаж)%этаж;
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4);
    for(let i=-2;i<5;i++){
      const y=by0+(i*этаж-сдвиг)*пикс;
      ctx.beginPath(); ctx.moveTo(bx0-1.1,y); ctx.lineTo(bx0-0.25,y); ctx.moveTo(bx1+0.25,y); ctx.lineTo(bx1+1.1,y); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle=panel; ctx.fillRect(bx0,by0,bx1-bx0,by1-by0);
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(2.2); ctx.strokeRect(bx0,by0,bx1-bx0,by1-by0);
    // пол и весы
    const fy=by0+0.35;
    ctx.fillStyle=line; ctx.fillRect(bx0,by0,bx1-bx0,0.35);
    const wx0=-0.9, wx1=1.1, wy=fy, wh=0.32;
    ctx.fillStyle=ink3; ctx.fillRect(wx0,wy,wx1-wx0,wh);
    // табло весов
    const tx=2.0, ty=by0+1.2, tw=2.3, th=1.05;
    ctx.fillStyle=v.c('--well'); ctx.strokeStyle=line; ctx.lineWidth=v.lw(1.2);
    ctx.fillRect(tx,ty,tw,th); ctx.strokeRect(tx,ty,tw,th);
    const кг=P/p.g, отн=P/mg;
    const цвет=отн>1.02?dang:отн<0.98?(отн<0.02?meas:acc):ok;
    v.label(ctx,`${кг.toFixed(1)} кг`,tx+0.15,ty+th*0.62,0,0,цвет);
    v.label(ctx,'весы',tx+0.15,ty+th,0,9,ink3);
    ctx.strokeStyle=line; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.beginPath(); ctx.moveTo(wx1,wy+wh/2); ctx.lineTo(tx,ty+th/2); ctx.stroke(); ctx.setLineDash([]);
    /* Груз — брусок на весах. Для второго закона это материальная точка:
       обе силы, mg и N, приложены к центру масс и лежат на одной прямой,
       поэтому их можно складывать как числа со знаком. В невесомости
       брусок чуть отходит от весов: опора его больше не держит. */
    const всплыл=s.свобода?clamp((s.t-p.tBreak)*0.5,0,0.6):0;
    const бш=Math.min(2.6,1.7+0.4*Math.cbrt(p.m/70)), бв=бш*0.8;
    const px=(wx0+wx1)/2, низ=wy+wh+всплыл, cm=низ+бв/2;
    ctx.fillStyle=v.c('--panel-2'); ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6);
    ctx.fillRect(px-бш/2,низ,бш,бв); ctx.strokeRect(px-бш/2,низ,бш,бв);
    v.label(ctx,`m = ${p.m} кг`,px-бш/2,низ+бв*0.7,-66,0,ink3);
    // центр масс: точка, к которой приложены силы
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(px,cm,v.lw(3.2),0,Math.PI*2); ctx.fill();
    if(p.forces){
      // длина mg — от центра масс до пола: стрелки не протыкают кабину
      const L=Math.max(0.6,cm-(by0+0.05));
      const cg=v.c('--f-grav')||dang, cn=v.c('--f-norm')||acc;     // общие цвета сил (3.0.0)
      v.arrow(ctx,px,cm,px,cm-L,cg);
      v.label(ctx,`mg = ${mg.toFixed(0)} Н`,px,cm-L,10,6,cg);
      if(P>1e-6){
        const LN=L*P/mg;
        v.arrow(ctx,px,cm,px,cm+LN,cn);
        v.label(ctx,`N = ${P.toFixed(0)} Н`,px,cm+LN,10,-4,cn);
      } else v.label(ctx,'N = 0 — невесомость',px,cm,12,-14,meas);
    }
    // ускорение кабины
    if(p.accel&&Math.abs(s.a)>1e-6){
      const La=clamp(Math.abs(s.a)*0.35,0.4,3.2)*Math.sign(s.a), ax=bx1-0.5, ay=by0+4.8;
      v.arrow(ctx,ax,ay,ax,ay+La,meas);
      v.label(ctx,`a = ${Math.abs(s.a).toFixed(1)} м/с² ${s.a>0?'вверх':'вниз'}`,ax,ay+La,-118,s.a>0?-10:12,meas);
    }
    v.label(ctx,s.фаза+(s.v?` · v = ${Math.abs(s.v).toFixed(1)} м/с ${s.v>0?'вверх':'вниз'}`:''),bx0,by1,0,-12,ink2);
    // что значит вес здесь и сейчас
    let смысл;
    if(отн<0.02) смысл='невесомость: весы ничего не показывают, хотя сила тяжести та же';
    else if(отн>1.02) смысл=`перегрузка ×${отн.toFixed(2)}: пол давит сильнее, чем тянет Земля`;
    else if(отн<0.98) смысл=`легче на ${((1-отн)*100).toFixed(0)} %: ускорение кабины направлено вниз`;
    else смысл='вес равен силе тяжести: кабина стоит или едет равномерно';
    v.label(ctx,смысл,bx0,by0,0,22,цвет);
  }
},

/* ============ МОМЕНТ ИМПУЛЬСА: ГИРОСКОП И ПРЕЦЕССИЯ ============
   Орир, т.1. Момент силы тяжести перпендикулярен моменту импульса, поэтому
   он не меняет |L|, а поворачивает его: dL/dt = M. Отсюда угловая скорость
   прецессии
       Ω = M / (L·sinθ) = m·g·d / (I·ω),
   то есть чем быстрее раскручен волчок, тем МЕДЛЕННЕЕ он прецессирует.
   Условие «быстрого волчка» (гироскопическое приближение): L ≫ I·Ω.       */

});
/* Короткая подпись высоты: метры до километра, дальше — километры. */
function fmtKm(m){
  if(Math.abs(m)>=1000) return (m/1000).toFixed(m>=10000?0:1)+' км';
  return Math.round(m)+' м';
}
