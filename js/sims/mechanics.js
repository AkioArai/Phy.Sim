'use strict';
/* ====================== СИМУЛЯЦИЯ: ОДНОМЕРНОЕ ДВИЖЕНИЕ ================== */
/* ТЕЛО ОДНОМЕРНОГО ДВИЖЕНИЯ (9.1.0). Закон движения — один из трёх:
     'a'      — равноускоренное: x = x₀ + v₀τ + aτ²/2;
     'jerk'   — ускорение меняется равномерно (рывок j): x = x₀ + v₀τ + aτ²/2 + jτ³/6;
     'stages' — по участкам: разгон (aᵣ, Tᵣ), равномерно (Tₙ), торможение (aₜ, Tₜ),
                дальше — без ускорения. На каждом участке ускорение постоянно,
                поэтому решение точное, а скорость — ломаная.
   Все три решаются в замкнутом виде — ни шагов интегрирования, ни накопления ошибки. */
const mkBody=(x0,v0,a,t0,law,j,st)=>({x0,v0,a,t0,law:law||'a',j:j||0,st:st||null,x:x0,v:0,acc:0,path:0,started:false,landed:false});
function кин1(b,τ){
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
  return i? mkBody(p.x02,p.v02,p.a2,p.delay,law,p.j2,st) : mkBody(p.x01,p.v01,p.a1,0,law,p.j1,st);
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
     options:[{v:'a',t:'равноускоренно (a = const)'},{v:'stages',t:'по участкам: разгон, равномерно, торможение'},{v:'jerk',t:'ускорение растёт равномерно (рывок)'}]},
    {key:'x01',label:'Начальная координата x₀',unit:'м',   min:-500,max:500,step:0.5,default:0},
    {key:'v01',label:'Начальная скорость v₀',  unit:'м/с', min:-100,max:100,step:0.5,default:20},
    {key:'a1', label:'Ускорение a',            unit:'м/с²',min:-50, max:50, step:0.1,default:-9.8,если:p=>p.law1!=='stages'},
    {key:'j1', label:'Рывок j = Δa/Δt',        unit:'м/с³',min:-20, max:20, step:0.1,default:1,если:p=>p.law1==='jerk'},
    {key:'T11',label:'Разгон: длительность',unit:'с',min:0,max:60,step:0.1,default:4,если:p=>true&&p.law1==='stages'},
    {key:'A11',label:'Разгон: ускорение',unit:'м/с²',min:-50,max:50,step:0.1,default:3,если:p=>true&&p.law1==='stages'},
    {key:'T12',label:'Равномерно: длительность',unit:'с',min:0,max:60,step:0.1,default:3,если:p=>true&&p.law1==='stages'},
    {key:'T13',label:'Торможение: длительность',unit:'с',min:0,max:60,step:0.1,default:3,если:p=>true&&p.law1==='stages'},
    {key:'A13',label:'Торможение: ускорение',unit:'м/с²',min:-50,max:50,step:0.1,default:-4,если:p=>true&&p.law1==='stages'},

    {type:'group',label:'Тело 2',если:p=>p.bodies==='2'},
    {key:'law2',label:'Закон движения',type:'select',default:'a',если:p=>p.bodies==='2',
     options:[{v:'a',t:'равноускоренно (a = const)'},{v:'stages',t:'по участкам: разгон, равномерно, торможение'},{v:'jerk',t:'ускорение растёт равномерно (рывок)'}]},
    {key:'x02',  label:'Начальная координата x₀',unit:'м',   min:-500,max:500,step:0.5,default:0},
    {key:'v02',  label:'Начальная скорость v₀',  unit:'м/с', min:-100,max:100,step:0.5,default:20},
    {key:'a2',   label:'Ускорение a',            unit:'м/с²',min:-50, max:50, step:0.1,default:-9.8,если:p=>p.law2!=='stages'},
    {key:'j2',   label:'Рывок j = Δa/Δt',        unit:'м/с³',min:-20, max:20, step:0.1,default:1,если:p=>p.bodies==='2'&&p.law2==='jerk'},
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
          b.x0=G; b.v0=-p.rest*vHit; b.t0=tl; b.v=b.v0; b.a=kh.a; b.law='a';
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
    {key:'x01',label:'Начальная координата x₀',unit:'м',  min:-1000,max:1000,step:0.5,default:0},
    {key:'y01',label:'Начальная высота y₀',    unit:'м',  min:0,    max:1000,step:0.5,default:0},
    {key:'v01',label:'Начальная скорость v₀',  unit:'м/с',min:0,    max:400, step:0.5,default:25},
    {key:'a01',label:'Угол броска θ',          unit:'°',  min:0,    max:360, step:1,  default:45},

    {type:'group',label:'Тело 2',если:p=>p.bodies!=='1'},
    {key:'x02',  label:'Начальная координата x₀',unit:'м',  min:-1000,max:1000,step:0.5,default:40},
    {key:'y02',  label:'Начальная высота y₀',    unit:'м',  min:0,    max:1000,step:0.5,default:25},
    {key:'v02',  label:'Начальная скорость v₀',  unit:'м/с',min:0,    max:400, step:0.5,default:0},
    {key:'a02',  label:'Угол броска θ',          unit:'°',  min:0,    max:360, step:1,  default:0},
    {key:'delay',label:'Задержка старта Δt',     unit:'с',  min:0,    max:60,  step:0.1,default:0},

    {type:'group',label:'Тело 3',если:p=>p.bodies==='3'},
    {key:'x03',   label:'Начальная координата x₀',unit:'м',  min:-1000,max:1000,step:0.5,default:0},
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

    // падение на землю
    for(let i=0;i<n;i++){
      const r=this.posOf(p,i,t);
      if(r.started && r.landed && !s.landed[i]){
        s.landed[i]=true;
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

/* ---------------- РАКЕТА НАВСТРЕЧУ КОРАБЛЮ (9.1.0) ----------------
   С берега высотой h₀ запускают ракету: скорость v₀ под углом θ. Корабль в
   момент пуска в D метрах от берега и идёт к нему со скоростью u. Без
   двигателя ракета летит по параболе, с двигателем первые τ секунд ещё и
   разгоняется ускорением aₜ вдоль скорости. Целиться в корабль бесполезно:
   за время полёта T он подойдёт на uT — попасть можно только с упреждением.
   При h₀ = 0 и без двигателя условие попадания пишется в одну строку:
   (v₀cos θ + u)·T = D, T = 2v₀ sin θ / g — ракета и корабль вместе
   закрывают расстояние D. Траектория считается заранее (Рунге — Кутта,
   шаг 5 мс), попадание — по пересечению с корпусом (длина L, высота 10 м). */
intercept:{
  title:'Ракета навстречу кораблю',
  params:[
    {type:'group',label:'Корабль'},
    {key:'D',  label:'Расстояние до корабля в момент пуска D',unit:'м',min:300,max:12000,step:10,default:3600},
    {key:'u',  label:'Скорость корабля к берегу u',unit:'м/с',min:-40,max:40,step:0.5,default:12},
    {key:'Ls', label:'Длина корабля L',unit:'м',min:20,max:300,step:1,default:80},
    {type:'group',label:'Ракета'},
    {key:'v0', label:'Начальная скорость v₀',unit:'м/с',min:20,max:700,step:1,default:200},
    {key:'th', label:'Угол пуска θ',unit:'°',min:1,max:89,step:0.1,default:30},
    {key:'h0', label:'Высота берега h₀',unit:'м',min:0,max:400,step:1,default:0},
    {key:'eng',label:'Двигатель работает после пуска',type:'check',default:false},
    {key:'aT', label:'Ускорение от двигателя aₜ',unit:'м/с²',min:0,max:120,step:0.5,default:25,если:p=>!!p.eng},
    {key:'tB', label:'Время работы двигателя τ',unit:'с',min:0,max:40,step:0.1,default:4,если:p=>!!p.eng},
    {key:'g',  label:'Ускорение свободного падения g',unit:'м/с²',min:1,max:30,step:0.1,default:9.8},
    {type:'group',label:'Показывать'},
    {key:'lead', label:'Упреждение: где будет корабль и куда упадёт ракета',type:'check',default:true},
    {key:'solve',label:'Подсказать углы попадания',type:'check',default:false}
  ],
  ДЕК:10,                                                       // высота корпуса над водой, м
  /* траектория по параметрам: [{t,x,y,vx,vy}] до воды (или до 400 с) */
  путь(p,шаг){ шаг=шаг||0.005; const g=p.g, th=p.th*Math.PI/180;
    let q=[0,p.h0,p.v0*Math.cos(th),p.v0*Math.sin(th)], t=0; const out=[{t,x:q[0],y:q[1],vx:q[2],vy:q[3]}];
    const f=(t,q)=>{ let ax=0, ay=-g; if(p.eng&&t<p.tB){ const v=Math.hypot(q[2],q[3])||1; ax+=p.aT*q[2]/v; ay+=p.aT*q[3]/v; } return [q[2],q[3],ax,ay]; };
    while(t<400){
      const k1=f(t,q), y2=q.map((v,i)=>v+шаг/2*k1[i]), k2=f(t+шаг/2,y2), y3=q.map((v,i)=>v+шаг/2*k2[i]), k3=f(t+шаг/2,y3),
            y4=q.map((v,i)=>v+шаг*k3[i]), k4=f(t+шаг,y4);
      const n=q.map((v,i)=>v+шаг/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i])); t+=шаг;
      if(n[1]<0){ const a=q[1]/(q[1]-n[1]); out.push({t:t-шаг+a*шаг,x:q[0]+a*(n[0]-q[0]),y:0,vx:n[2],vy:n[3]}); break; }
      q=n; out.push({t,x:q[0],y:q[1],vx:q[2],vy:q[3]});
    }
    return out; },
  xs(p,t){ return p.D-p.u*t; },
  /* исход полёта: попадание в корпус или падение в воду с промахом Δ (+ перелёт) */
  исход(p,путь){ const L=p.Ls/2, H=this.ДЕК;
    for(let i=1;i<путь.length;i++){ const q=путь[i], xs=this.xs(p,q.t);
      if(q.y<=H&&Math.abs(q.x-xs)<=L) return {попал:true,t:q.t,x:q.x,y:q.y,i}; }
    const к=путь[путь.length-1];
    return {попал:false,t:к.t,x:к.x,y:0,Δ:к.x-this.xs(p,к.t),i:путь.length-1}; },
  /* промах по середине корабля на уровне воды (корпус не учитываем — так корень один и точный) */
  промах(p,θ){ const q=Object.assign({},p,{th:θ}), пу=this.путь(q,0.05), к=пу[пу.length-1]; return к.x-this.xs(q,к.t); },
  /* углы попадания: перебор по градусу и деление пополам на смене знака промаха */
  углы(p){ const к=JSON.stringify([p.D,p.u,p.Ls,p.v0,p.h0,p.eng,p.aT,p.tB,p.g]);
    if(this._кэш&&this._кэш.к===к) return this._кэш.у;
    /* пока тянут прицел, считаем не чаще раза в 150 мс — иначе перебор углов
       на каждое движение мыши тормозит; последний расчёт догоняет таймером */
    const сейчас=Date.now();
    if(this._кэш&&сейчас-this._кэш.когда<150){ clearTimeout(this._таймер);
      this._таймер=setTimeout(()=>{ try{ if(typeof drawAll==='function') drawAll(); if(typeof updateHud==='function'&&A()) updateHud(A()); }catch(_){} },160);
      return this._кэш.у; }
    const у=[]; let θ0=1, m0=this.промах(p,1);
    for(let θ=3;θ<=89;θ+=2){ const m1=this.промах(p,θ);
      if(Math.sign(m1)!==Math.sign(m0)){ let lo=θ0,hi=θ,mlo=m0;
        for(let k=0;k<16;k++){ const mid=(lo+hi)/2, mm=this.промах(p,mid); if(Math.sign(mm)===Math.sign(mlo)){ lo=mid; mlo=mm; } else hi=mid; }
        у.push((lo+hi)/2); }
      θ0=θ; m0=m1; }
    this._кэш={к,у,когда:сейчас}; return у; },
  init(p){ const путь=this.путь(p); return {t:0,event:null,__stop:null,путь,исход:this.исход(p,путь)}; },
  в(s,t){ const П=s.путь; if(t<=0) return П[0]; const i=Math.min(П.length-1,Math.max(1,Math.ceil(t/0.005)));
    const a=П[i-1], b=П[i], k=b.t>a.t?clamp((t-a.t)/(b.t-a.t),0,1):1;
    return {t,x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,vx:a.vx+(b.vx-a.vx)*k,vy:a.vy+(b.vy-a.vy)*k}; },
  step(s,dt,p){ if(s.event) return; s.t+=dt; const и=s.исход;
    if(s.t>=и.t){ s.t=и.t; s.event={t:и.t,type:и.попал?'hit':'splash',x:и.x,y:и.y};
      s.__stop=и.попал?`Попадание: t = ${и.t.toFixed(2)} с`:`${и.Δ>0?'Перелёт':'Недолёт'} ${Math.abs(и.Δ).toFixed(0)} м: ракета упала в воду через ${и.t.toFixed(2)} с`; } },
  итог(s){ const и=s.исход; return и.попал?'попадание':`${и.Δ>0?'перелёт':'недолёт'} ${Math.abs(и.Δ).toFixed(0)} м`; },
  readouts(s,p){ const r=this.в(s,s.t), xs=this.xs(p,s.t);
    const out=[['t',s.t,'с'],['высота ракеты y',r.y,'м'],['скорость ракеты v',Math.hypot(r.vx,r.vy),'м/с'],
      ['до корабля',Math.hypot(xs-r.x,r.y),'м'],['время полёта до воды',s.путь[s.путь.length-1].t,'с'],['исход',this.итог(s),'']];
    if(p.solve){ const у=this.углы(p); out.push(['угол для попадания',у.length?у.map(a=>a.toFixed(1)+'°').join(' или '):'не достать: мала скорость','']); }
    return out; },
  graphs:[
    {label:'y(t) — высота ракеты',unit:'м',series:['ракета'],get(s){ return [SIMS.intercept.в(s,s.t).y,null]; }},
    {label:'Расстояние от ракеты до корабля',unit:'м',series:['расстояние'],get(s,p){ const r=SIMS.intercept.в(s,s.t); return [Math.hypot(SIMS.intercept.xs(p,s.t)-r.x,r.y),null]; }},
    {label:'v(t) — скорость ракеты',unit:'м/с',series:['ракета'],get(s){ const r=SIMS.intercept.в(s,s.t); return [Math.hypot(r.vx,r.vy),null]; }}
  ],
  presets:[
    {name:'Прицелились в сам корабль — перелёт',values:{D:3600,u:12,Ls:80,v0:200,th:30,h0:0,eng:false,g:9.8,lead:true,solve:false}},
    {name:'С упреждением: настильная траектория',values:{D:3600,u:12,Ls:80,v0:200,th:27.9,h0:0,eng:false,g:9.8,lead:true,solve:true}},
    {name:'Тот же корабль навесом',values:{D:3600,u:12,Ls:80,v0:200,th:64.7,h0:0,eng:false,g:9.8,lead:true,solve:true}},
    {name:'С обрыва 200 м по удаляющемуся кораблю',values:{D:4000,u:-15,Ls:100,v0:230,th:23,h0:200,eng:false,g:9.8,lead:true,solve:true}},
    {name:'Ракета с двигателем: 6 с разгона',values:{D:6000,u:15,Ls:80,v0:120,th:35,h0:0,eng:true,aT:25,tB:6,g:9.8,lead:true,solve:true}}
  ],
  fit(p,vp){ const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320, П=this.путь(p,0.05);
    let x1=Math.max(p.D,p.D-p.u*П[П.length-1].t)+p.Ls, ymax=Math.max(p.h0,60); for(const q of П){ x1=Math.max(x1,q.x); ymax=Math.max(ymax,q.y); }
    const x0=-0.06*x1, span=x1*1.08-x0, hy=ymax*1.3+0.12*span*H/W;
    const scale=clamp(Math.min((W-50)/(span*PX_PER_M),(H-50)/(hy*PX_PER_M)),1e-5,30), k=PX_PER_M*scale;
    return {x:(x0+x1*1.08)/2, y:Math.max(ymax*0.55,H/k/2-40/k), scale}; },
  anchors(s,p){ const и=s.исход; return [{x:0,y:p.h0},{x:p.D,y:0},{x:и.x,y:и.y}]; },
  /* корабль: корпус, надстройка, мачта (нос — к берегу). На дальней сцене
     настоящий корабль — пара пикселей, поэтому силуэт рисуется не короче 44 px,
     а честная зона попадания (длина L, высота корпуса) — полосой у воды. */
  корабль(ctx,v,p,x,цв,контур){ const пк=1/ppm(), L=Math.max(p.Ls,44*пк), H=L*0.13;
    ctx.beginPath(); ctx.moveTo(x-L/2-L*0.06,H); ctx.lineTo(x+L/2,H); ctx.lineTo(x+L/2-L*0.05,-H*0.35); ctx.lineTo(x-L/2+L*0.12,-H*0.35); ctx.closePath();
    if(контур){ ctx.strokeStyle=цв; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.stroke(); ctx.setLineDash([]); return L; }
    ctx.fillStyle=цв; ctx.fill();
    ctx.fillRect(x-L*0.05,H,L*0.25,H*0.8); ctx.fillRect(x+L*0.05,H*1.8,L*0.12,H*0.5);
    ctx.strokeStyle=цв; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.moveTo(x+L*0.1,H*2.3); ctx.lineTo(x+L*0.1,H*3.4); ctx.stroke();
    if(L>p.Ls*1.05){ ctx.fillStyle=v.c('--accent'); ctx.fillRect(x-p.Ls/2,0,p.Ls,Math.max(this.ДЕК,3*пк)); }
    return L; },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), ink2=v.c('--ink-2'), ink3=v.c('--ink-3'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second');
    const пк=1/ppm(), П=s.путь, и=s.исход, x1=Math.max(p.D,и.x)*1.6+500, xs=this.xs(p,s.t);
    // море и волны
    ctx.fillStyle=sec; ctx.globalAlpha=.09; ctx.fillRect(0,-4000,x1*2,4000); ctx.globalAlpha=1;
    ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.3); ctx.beginPath();
    const шаг=14*пк; for(let x=0;x<=x1*1.5;x+=шаг){ const y=2*пк*Math.sin(x/(40*пк)-s.t*1.5); x?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
    // берег
    ctx.fillStyle=ink3; ctx.globalAlpha=.28; ctx.beginPath(); ctx.moveTo(-x1,-4000); ctx.lineTo(-x1,p.h0); ctx.lineTo(0,p.h0); ctx.lineTo(Math.max(p.h0*0.25,8*пк),-4000); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(-x1,p.h0); ctx.lineTo(0,p.h0); ctx.lineTo(Math.max(p.h0*0.25,8*пк),0); ctx.stroke();
    // пусковая направляющая
    const th=p.th*Math.PI/180, R=26*пк; ctx.strokeStyle=ink2; ctx.lineWidth=v.lw(3); ctx.beginPath(); ctx.moveTo(0,p.h0); ctx.lineTo(R*Math.cos(th),p.h0+R*Math.sin(th)); ctx.stroke();
    // упреждение: где будет корабль в момент падения ракеты, и куда она упадёт
    if(p.lead&&!s.event){
      ctx.strokeStyle=acc; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1.4); ctx.setLineDash([v.lw(5),v.lw(4)]); ctx.beginPath();
      П.forEach((q,i)=>{ if(i%8&&i!==П.length-1) return; i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y); }); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      const xT=this.xs(p,и.t); this.корабль(ctx,v,p,xT,ink3,true);
      v.label(ctx,`здесь через ${и.t.toFixed(1)} с`,xT,0,0,-76,ink3);
      ctx.fillStyle=и.попал?acc:dang; ctx.beginPath(); ctx.arc(и.x,и.y,v.lw(3.5),0,7); ctx.fill();
    }
    if(p.solve&&!s.event){ const у=this.углы(p);
      if(!this._призраки||this._призраки.у!==у) this._призраки={у,пути:у.map(a=>this.путь(Object.assign({},p,{th:a}),0.05))};
      for(const пу of this._призраки.пути){
      ctx.strokeStyle=v.c('--ok'); ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1.2); ctx.setLineDash([v.lw(2),v.lw(4)]); ctx.beginPath();
      пу.forEach((r,i)=>i?ctx.lineTo(r.x,r.y):ctx.moveTo(r.x,r.y)); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; } }
    // корабль
    this.корабль(ctx,v,p,xs,ink2,false);
    // пройденный путь ракеты
    const r=this.в(s,s.t);
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2); ctx.beginPath(); ctx.moveTo(П[0].x,П[0].y);
    for(let i=1;i<П.length&&П[i].t<=s.t;i+=4) ctx.lineTo(П[i].x,П[i].y); ctx.lineTo(r.x,r.y); ctx.stroke();
    // ракета: корпус по скорости, факел, пока работает двигатель
    if(!s.event){ const ang=Math.atan2(r.vy,r.vx), ux=Math.cos(ang), uy=Math.sin(ang), Lр=20*пк, Wр=3.5*пк;
      if(p.eng&&s.t<p.tB){ ctx.fillStyle=meas; ctx.beginPath(); ctx.moveTo(r.x-ux*Lр*0.5+uy*Wр,r.y-uy*Lр*0.5-ux*Wр); ctx.lineTo(r.x-ux*Lр*(1.1+0.2*Math.sin(s.t*40)),r.y-uy*Lр*(1.1+0.2*Math.sin(s.t*40))); ctx.lineTo(r.x-ux*Lр*0.5-uy*Wр,r.y-uy*Lр*0.5+ux*Wр); ctx.fill(); }
      ctx.fillStyle=ink2; ctx.beginPath(); ctx.moveTo(r.x+ux*Lр*0.5,r.y+uy*Lр*0.5); ctx.lineTo(r.x-ux*Lр*0.5+uy*Wр,r.y-uy*Lр*0.5-ux*Wр); ctx.lineTo(r.x-ux*Lр*0.5-uy*Wр,r.y-uy*Lр*0.5+ux*Wр); ctx.closePath(); ctx.fill(); }
    // исход
    if(s.event){ const e=s.event;
      if(e.type==='hit'){ ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2);
        for(let k=0;k<12;k++){ const a=k*Math.PI/6, r1=6*пк, r2=(k%2?16:24)*пк; ctx.beginPath(); ctx.moveTo(e.x+r1*Math.cos(a),e.y+r1*Math.sin(a)); ctx.lineTo(e.x+r2*Math.cos(a),e.y+r2*Math.sin(a)); ctx.stroke(); }
        ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(e.x,e.y,v.lw(6),0,7); ctx.fill();
        v.label(ctx,'попадание',e.x,e.y,14,-30,dang);
      } else { ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.6);
        for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.moveTo(e.x+k*3*пк,0); ctx.lineTo(e.x+k*5*пк,(18-3*Math.abs(k))*пк); ctx.stroke(); }
        v.label(ctx,this.итог(s),e.x,0,10,-34,dang); }
    }
    // расстояние до корабля в момент пуска
    if(s.t<0.6){ const y=-26*пк; v.arrow(ctx,0,y,p.D,y,ink3); v.label(ctx,`D = ${p.D} м`,p.D/2,y,0,14,ink3); }
    if(Math.abs(p.u)>0.01&&!s.event){ const y=30*пк, d=-Math.sign(p.u)*34*пк; v.arrow(ctx,xs,y,xs+d,y,ink3); v.label(ctx,`u = ${Math.abs(p.u)} м/с`,xs+d,y,Math.sign(d)*8,-12,ink3); }
  },
  /* ---- инструменты модели ----
     «Прицел» — потяните от пусковой: длина стрелки — скорость, направление — угол;
     «Корабль» — передвиньте корабль по морю (расстояние D в момент пуска). */
  ПИКС:0.8,                                                    // пикселей стрелки на 1 м/с
  tools(p){ const S1=this;
    return [
      {id:'aim', name:'Прицел', cursor:'crosshair',
       icon:'<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
       hint:'потяните от пусковой: длина — скорость, направление — угол; ←/→ — угол, ↑/↓ — скорость',
       down(т){ const [x,y]=т.toScreen(0,т.p.h0); т.выбор.в=Math.hypot(т.px-x,т.py-y)<60; return т.выбор.в; },
       move(т){ const [x,y]=т.toScreen(0,т.p.h0), dx=т.px-x, dy=y-т.py; т.set('v0',Math.hypot(dx,dy)/S1.ПИКС); т.set('th',clamp(Math.atan2(dy,dx)*180/Math.PI,1,89)); },
       key(k,т){ const ш=т.shift?5:1;
         if(k==='ArrowLeft'||k==='ArrowRight'){ т.set('th',т.p.th+(k==='ArrowLeft'?ш:-ш)*0.5); return true; }
         if(k==='ArrowUp'||k==='ArrowDown'){ т.set('v0',т.p.v0+(k==='ArrowUp'?ш:-ш)); return true; } return false; },
       overlay(o,т){ const th=т.p.th*Math.PI/180, L=т.p.v0*S1.ПИКС/т.ppm, x=L*Math.cos(th), y=т.p.h0+L*Math.sin(th);
         VIEW.arrow(o,0,т.p.h0,x,y,css('--accent')); VIEW.label(o,`v₀ = ${т.p.v0} м/с, θ = ${т.p.th}°`,x,y,10,-12,css('--accent')); }},
      {id:'ship', name:'Корабль', cursor:'ew-resize',
       icon:'<path d="M3 15h18l-2.5 4h-13z"/><path d="M8 15v-4h7v4M11 11V7"/>',
       hint:'передвиньте корабль по морю — так задаётся расстояние D в момент пуска; ←/→ — по 50 м. Силуэт крупнее настоящего, корпус в настоящем масштабе — полоса у воды',
       down(т){ return true; },
       move(т){ т.set('D',т.wx); },
       key(k,т){ const зн={ArrowRight:1,ArrowLeft:-1}[k]; if(!зн) return false; т.set('D',т.p.D+зн*(т.shift?250:50)); return true; },
       overlay(o,т){ const пк=1/т.ppm; o.strokeStyle=css('--accent'); o.globalAlpha=.6; o.lineWidth=пк; o.setLineDash([3*пк,4*пк]);
         o.beginPath(); o.moveTo(т.p.D,0); o.lineTo(т.p.D,110*пк); o.stroke(); o.setLineDash([]); o.globalAlpha=1; }}
    ];
  }
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
  title:'Равномерное движение по окружности',
  params:[
    {key:'mode',label:'Задавать движение',type:'select',default:'v',
     options:[{v:'v',t:'через скорость v'},{v:'T',t:'через период T'}]},
    /* Верхние пределы подняты так, чтобы помещались и планетные масштабы
       (пример «Экватор Земли»). Ползунка нет — только числовое поле с шагом,
       поэтому широкий диапазон не мешает точной установке обычных значений. */
    {key:'R',  label:'Радиус R',   unit:'м',  min:0.2,max:1e7,  step:0.1,default:5},
    {key:'v',  label:'Скорость v', unit:'м/с',min:0.1,max:1000, step:0.1,default:10},
    {key:'T',  label:'Период T',   unit:'с',  min:0.1,max:1e5,  step:0.1,default:3.14},
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
     values:{mode:'v',R:5,v:10,dir:'ccw',turns:1,tStop:0}}
  ],
  kin(p){                                   // согласованные v, T, ω, a_c
    const v = p.mode==='v' ? p.v : 2*Math.PI*p.R/p.T;
    const T = 2*Math.PI*p.R/Math.max(v,1e-9);
    return {v, T, w:v/p.R, ac:v*v/p.R, sgn:p.dir==='cw'?-1:1};
  },
  init(p){ return {t:0,phi:0,trail:[],event:null,__stop:null}; },
  put(s,p,t){
    const K=this.kin(p);
    s.t=t; s.phi=K.sgn*K.w*t;
    if(p.trail){ s.trail.push([p.R*Math.cos(s.phi),p.R*Math.sin(s.phi)]);
      if(s.trail.length>4000) s.trail.shift(); }
  },
  step(s,dt,p){
    if(s.event) return;
    const K=this.kin(p), t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ this.put(s,p,p.tStop);
      s.event={t:p.tStop,type:'time'}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    if(p.turns>0){
      const te=p.turns*K.T;
      if(t>=te&&!(s.done&&s.done.turns)){ this.put(s,p,te);
        s.event={t:te,type:'turns'};
        s.__stop=`Пройдено ${p.turns} оборот(а): t = ${te.toFixed(3)} с`; return; }
    }
    this.put(s,p,t);
  },
  pos(s,p){
    const K=this.kin(p);
    const x=p.R*Math.cos(s.phi), y=p.R*Math.sin(s.phi);
    const vx=-K.sgn*K.v*Math.sin(s.phi), vy=K.sgn*K.v*Math.cos(s.phi);
    const ax=-K.ac*Math.cos(s.phi), ay=-K.ac*Math.sin(s.phi);
    return {x,y,vx,vy,ax,ay,K};
  },
  anchors(s,p){
    const r=this.pos(s,p);
    return [{x:0,y:0},{x:r.x,y:r.y},{x:p.R,y:0},{x:-p.R,y:0},{x:0,y:p.R},{x:0,y:-p.R}];
  },
  readouts(s,p){
    const r=this.pos(s,p), K=r.K;
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
    const kv=p.R/Math.max(K.v,1e-6)*0.55, ka=p.R/Math.max(K.ac,1e-6)*0.55;
    v.arrow(ctx,r.x,r.y,r.x+r.vx*kv,r.y+r.vy*kv,v.c('--measure'));
    v.label(ctx,`v = ${K.v.toFixed(2)} м/с`,r.x+r.vx*kv,r.y+r.vy*kv,8,-10,v.c('--measure'));
    if(p.showA){
      v.arrow(ctx,r.x,r.y,r.x+r.ax*ka,r.y+r.ay*ka,v.c('--danger'));
      v.label(ctx,`aц = ${K.ac.toFixed(2)} м/с²`,r.x+r.ax*ka*0.9,r.y+r.ay*ka*0.9,8,12,v.c('--danger'));
    }
    // тело
    ctx.fillStyle=v.c('--accent'); ctx.beginPath(); ctx.arc(r.x,r.y,v.lw(7),0,7); ctx.fill();
    v.label(ctx,`T = ${K.T.toFixed(2)} с   ω = ${K.w.toFixed(2)} рад/с`,-p.R,-p.R*1.22,0,0,v.c('--ink-3'));
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
    {key:'F',      label:'Сила F',unit:'Н',min:0,max:20000,step:1,default:0},
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
    const Fx=p.F*Math.cos(al), Fy=p.F*Math.sin(al);

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
                return; } } }
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

    const al=p.alpha*Math.PI/180, Fx=p.F*Math.cos(al), Fy=p.F*Math.sin(al);

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
          if(p.F>0) F.push({fx:Fx,fy:Fy,label:'F',color:v.c('--accent')});
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
  params:[
    {type:'group',label:'Тело и плоскость'},
    {key:'m',   label:'Масса m',unit:'кг',min:0.1,max:1000,step:0.1,default:5},
    {key:'th',  label:'Угол наклона θ',unit:'°',min:0,max:85,step:0.5,default:20},
    {key:'mus', label:'Статический коэффициент μs',min:0,max:2,step:0.01,default:0.36},
    {key:'mud', label:'Кинетический коэффициент μd',min:0,max:2,step:0.01,default:0.30},
    {key:'g',   label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},
    {key:'L',   label:'Длина плоскости L',unit:'м',min:1,max:200,step:0.5,default:10},
    {type:'group',label:'Режим'},
    {key:'auto',label:'Медленно поднимать плоскость до срыва',type:'check',default:false},
    {key:'rate',label:'Скорость подъёма',unit:'°/с',min:0.5,max:30,step:0.5,default:3},
    {key:'fbd', label:'Диаграмма сил',type:'check',default:true},
    {key:'poly',label:'Многоугольник сил',type:'check',default:true},
    {key:'dist',label:'Пройденный путь',type:'check',default:true},
    {type:'group',label:'Остановка таймера'},
    {key:'stopSlip',  label:'В момент срыва (tg θ = μs)',type:'check',default:true},
    {key:'stopBottom',label:'У основания плоскости',type:'check',default:true},
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
  forces(s,p){
    const th=this.ang(s,p)*Math.PI/180;
    const Fg=p.m*p.g;
    const along=Fg*Math.sin(th);              // скатывающая составляющая
    const N=Fg*Math.cos(th);                  // реакция опоры
    const lim=p.mus*N;                        // порог трения покоя
    const moving=s.v>1e-6;
    const stuck = !moving && along<=lim;
    /* Трение статическое ТОЛЬКО пока тело держится. Как только скатывающая
       превысила порог, начинается скольжение, и трение сразу кинетическое —
       даже в тот самый миг, когда скорость ещё нулевая.
       Раньше в этот миг бралось -min(along, lim) = -μs·N, и показание
       ускорения выдавало g(sinθ − μs·cosθ) — величину, которой в физике
       не соответствует ничего: при v→0⁺ трение равно μd·N. На глаз это не
       видно, потому что при stopSlip симуляция замирает ровно здесь.
       В newton2 тот же случай изначально считается через μd. */
    const fr = stuck ? -along : -p.mud*N;
    return {th,Fg,along,N,lim,fr,stuck,a:stuck?0:(along+fr)/p.m};
  },
  init(p){ return {t:0,s:0,v:0,slipped:false,stopped:false,thSlip:null,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    if(s.arrived) return;                                 // упёрся в край — стоит
    s.t=t;
    const f=this.forces(s,p);
    if(f.stuck) return;                                   // брусок держится трением покоя
    if(!s.slipped){
      const thd=this.ang(s,p);
      s.slipped=true; s.thSlip=thd;                    // фиксируем угол срыва
      if(p.stopSlip&&!(s.done&&s.done.slip)){
        s.event={t,type:'slip',th:thd};
        s.__stop=`Срыв при θ = ${thd.toFixed(2)}°  ⇒  μs = tg θ = ${Math.tan(thd*Math.PI/180).toFixed(3)}`;
        return; }
    }
    if(s.stopped){ s.v=0; return; }                     // брусок упёрся в край — стоим
    s.v+=f.a*dt; s.s+=s.v*dt;
    if(s.s>=p.L){                                       // достиг основания
      s.s=p.L; s.stopped=true;
      if(!(s.done&&s.done.bottom)){ s.event={t:s.t,type:'bottom'};
        if(p.stopBottom) s.__stop=`Брусок у основания: t = ${s.t.toFixed(3)} с, v = ${s.v.toFixed(2)} м/с`;
        else { s.event=null; s.stopped=false; s.v=0; } }
      else { s.stopped=false; s.v=0; }
    }
  },
  geom(s,p){                       // положение бруска на плоскости (вершина в (0,H))
    const th=this.ang(s,p)*Math.PI/180, H=p.L*Math.sin(th), X=p.L*Math.cos(th);
    const x=s.s*Math.cos(th), y=H-s.s*Math.sin(th);
    return {th,H,X,x,y};
  },
  anchors(s,p){ const G=this.geom(s,p); return [{x:0,y:0},{x:0,y:G.H},{x:G.X,y:0},{x:G.x,y:G.y}]; },
  readouts(s,p){
    const f=this.forces(s,p), th=this.ang(s,p);
    return [['t',s.t,'с'],['угол θ',th,'°'],['tg θ',Math.tan(th*Math.PI/180),''],
      ['вес mg',f.Fg,'Н'],['скатывающая mg·sinθ',f.along,'Н'],['реакция N = mg·cosθ',f.N,'Н'],
      ['порог μs·N',f.lim,'Н'],['модуль трения',Math.abs(f.fr),'Н'],['F рез',f.stuck?0:f.along+f.fr,'Н'],
      ['a',f.a,'м/с²'],['путь по плоскости',s.s,'м'],['v',s.v,'м/с'],
      ['θ срыва = arctg μs',Math.atan(p.mus)*180/Math.PI,'°']];
  },
  graphs:[
    {label:'v(t) — скорость вдоль плоскости',unit:'м/с',series:['v'],get:s=>[s.v,null]},
    {label:'s(t) — путь по плоскости',unit:'м',series:['s'],get:s=>[s.s,null]},
    {label:'θ(t) — угол наклона',unit:'°',series:['θ'],get(s,p){ return [SIMS.incline.ang(s,p),null]; }}
  ],
  presets:[
    {name:'Пример 3 (Орир): поднимаем до срыва — найти μs',
     values:{m:5,th:5,mus:0.36,mud:0.30,g:9.8,L:10,auto:true,rate:3,stopSlip:true,stopBottom:true,tStop:0}},
    {name:'Скольжение при θ = 30°',
     values:{m:5,th:30,mus:0.36,mud:0.30,g:9.8,L:10,auto:false,stopSlip:false,stopBottom:true,tStop:0}},
    {name:'Брусок держится: θ = 15°, μs = 0,4',
     values:{m:5,th:15,mus:0.4,mud:0.3,g:9.8,L:10,auto:false,stopSlip:true,stopBottom:true,tStop:6}},
    {name:'Гладкая плоскость (μ = 0)',
     values:{m:5,th:30,mus:0,mud:0,g:9.8,L:10,auto:false,stopSlip:false,stopBottom:true,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const spanX=p.L*2.0, spanY=p.L*1.75;
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:p.L*0.5,y:p.L*0.5,scale};
  },
  draw(ctx,s,v,p){
    const f=this.forces(s,p), G=this.geom(s,p);
    // клин
    ctx.fillStyle=v.c('--panel-2'); ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(G.X,0); ctx.lineTo(0,G.H); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1);
    for(let k=0;k<G.X;k+=Math.max(p.L/25,0.3)){ ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k-0.3,-0.3); ctx.stroke(); }
    // угол
    ctx.strokeStyle=v.c('--second'); ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.arc(G.X,0,p.L*0.22,Math.PI-G.th,Math.PI); ctx.stroke();
    v.label(ctx,`θ = ${this.ang(s,p).toFixed(1)}°`,G.X-p.L*0.3,p.L*0.06,0,0,v.c('--second'));
    // брусок (повёрнутый)
    const hb=0.25*p.L/10+0.2;
    ctx.save();
    ctx.translate(G.x,G.y); ctx.rotate(-G.th);
    ctx.fillStyle=v.c('--accent'); ctx.fillRect(-hb,0,2*hb,1.6*hb);
    ctx.restore();
    v.label(ctx,`m = ${p.m} кг`,G.x,G.y,10,-14,v.c('--accent'));
    v.label(ctx,f.stuck?'покой':'скольжение',G.x,G.y,10,-2,f.stuck?v.c('--ink-3'):v.c('--accent'));
    // ПРОЙДЕННЫЙ ПУТЬ вдоль наклонной плоскости: от старта до текущего положения
    if(p.dist!==false && s.s>1e-6){
      const meas=v.c('--measure'), off=0.55*p.L/10+0.5;
      // старт бруска — вершина склона
      const sx=0, sy=G.H, ex=G.x, ey=G.y;
      const nx=Math.sin(G.th), ny=Math.cos(G.th);          // нормаль к плоскости
      const ax=sx-nx*off, ay=sy-ny*off, bx=ex-nx*off, by=ey-ny*off;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      // засечки поперёк линии
      const tx=Math.cos(G.th), ty=-Math.sin(G.th), tick=0.18*p.L/10+0.14;
      ctx.beginPath();
      ctx.moveTo(ax-tx*tick,ay-ty*tick); ctx.lineTo(ax+tx*tick,ay+ty*tick);
      ctx.moveTo(bx-tx*tick,by-ty*tick); ctx.lineTo(bx+tx*tick,by+ty*tick);
      ctx.stroke();
      v.arrow(ctx,ax,ay,bx,by,meas);
      // пунктир от бруска к линии
      ctx.strokeStyle=meas; ctx.globalAlpha=.35; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(bx,by); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,`s = ${s.s.toFixed(2)} м из ${p.L} м`,(ax+bx)/2,(ay+by)/2,-40,-10,meas);
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
      v.fbd(ctx,{x:G.x,y:G.y+0.45,forces:F,len:p.L*0.20,resultant:!f.stuck,
                 sum:p.poly?{x:G.X*0.62,y:G.H*1.12}:null});
    }
  }
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

/* ================== РАБОТА И ЭНЕРГИЯ: ПРЕВРАЩЕНИЯ ЭНЕРГИИ ================= */
energy:{
  title:'Работа и энергия: превращения',
  params:[
    {key:'mode',label:'Сценарий',type:'select',default:'ramp',
     options:[{v:'ramp', t:'Горка: кинетическая ⇄ потенциальная'},
              {v:'spring',t:'Пружина: упругая ⇄ кинетическая'},
              {v:'friction',t:'Трение: работа против движения'}]},
    {type:'group',label:'Тело'},
    {key:'m', label:'Масса m',unit:'кг',min:0.1,max:100,step:0.1,default:2},
    {key:'g', label:'Ускорение g',unit:'м/с²',min:0.5,max:30,step:0.1,default:9.8},

    {type:'group',label:'Горка'},
    {key:'h0',label:'Начальная высота h₀',unit:'м',min:0,max:50,step:0.5,default:10},
    {key:'v0',label:'Начальная скорость v₀',unit:'м/с',min:0,max:40,step:0.5,default:0},
    {key:'muR',label:'Трение горки μ (0 — гладкая)',min:0,max:1,step:0.01,default:0},

    {type:'group',label:'Пружина'},
    {key:'k', label:'Жёсткость k',unit:'Н/м',min:1,max:2000,step:1,default:200},
    {key:'x0',label:'Начальное сжатие x₀',unit:'м',min:0.05,max:5,step:0.05,default:1},

    {type:'group',label:'Трение (горизонталь)'},
    {key:'vf',label:'Начальная скорость v₀',unit:'м/с',min:0.5,max:40,step:0.5,default:12},
    {key:'muF',label:'Коэффициент трения μ',min:0.01,max:1,step:0.01,default:0.3},

    {type:'group',label:'Остановка таймера'},
    {key:'stopEnd',label:'В конце процесса (низ горки / остановка)',type:'check',default:true},
    {key:'tStop',  label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],

  /* ---- Горка: тело съезжает по наклонному жёлобу высотой h0, длина ската задаётся углом 35° ---- */
  ramp(p){ const ang=35*Math.PI/180, L=p.h0/Math.sin(ang); return {ang,L}; },
  init(p){
    if(p.mode==='ramp'){
      const {L}=this.ramp(p);
      return {t:0,mode:'ramp',s:0,v:p.v0,L,E0:0,heat:0,event:null,__stop:null};
    }
    if(p.mode==='spring'){
      return {t:0,mode:'spring',x:-p.x0,v:0,released:true,heat:0,event:null,__stop:null};
    }
    return {t:0,mode:'friction',x:0,v:p.vf,heat:0,event:null,__stop:null};
  },

  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop&&!(s.done&&s.done.time)){ s.t=p.tStop;
      s.event={t:p.tStop,type:'time'}; s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;

    if(s.mode==='ramp'){
      const {ang,L}=this.ramp(p);
      const N=p.m*p.g*Math.cos(ang);
      const fr=p.muR*N;                                   // трение вдоль ската
      let a=p.g*Math.sin(ang) - (s.v>0?fr/p.m:0);
      s.v+=a*dt; if(s.v<0)s.v=0;
      const ds=s.v*dt; s.s+=ds; s.heat+=fr*ds;
      if(s.s>=L){ s.s=L; 
        if(!(s.done&&s.done.end)){ s.event={t:s.t,type:'end'};
          if(p.stopEnd) s.__stop=`Тело внизу горки: v = ${s.v.toFixed(2)} м/с, в тепло ушло ${s.heat.toFixed(1)} Дж`; else s.event=null; }
      }
    }
    else if(s.mode==='spring'){
      // масса на пружине F = -kx; полушаговый (симплектический) интегратор сохраняет энергию
      const sub=8, h=dt/sub;
      for(let i=0;i<sub;i++){
        let a=-p.k*s.x/p.m; s.v+=a*h/2; s.x+=s.v*h;
        a=-p.k*s.x/p.m; s.v+=a*h/2;
      }
    }
    else { // friction
      if(Math.abs(s.v)>1e-4){
        const fr=p.muF*p.m*p.g, a=-Math.sign(s.v)*fr/p.m;
        const vN=s.v+a*dt;
        if(Math.sign(vN)!==Math.sign(s.v)){ s.heat+=0.5*p.m*s.v*s.v; s.x+=s.v*s.v/(2*fr/p.m)*0; 
          const dx=s.v*s.v/(2*(fr/p.m)); s.x+=Math.sign(s.v)*dx; s.v=0;
          if(!(s.done&&s.done.end)){ s.event={t:s.t,type:'end'};
            if(p.stopEnd) s.__stop=`Тело остановилось: путь ${Math.abs(s.x).toFixed(2)} м, вся кинетическая энергия ${s.heat.toFixed(1)} Дж ушла в тепло`; else s.event=null; }
        } else { const dx=s.v*dt; s.x+=dx; s.heat+=fr*Math.abs(dx); s.v=vN; }
      }
    }
  },

  /* энергии для диаграммы */
  energies(s,p){
    if(s.mode==='ramp'){
      const {ang,L}=this.ramp(p);
      const h=(L-s.s)*Math.sin(ang);
      return {kin:0.5*p.m*s.v*s.v, pot:p.m*p.g*h, spr:0, heat:s.heat};
    }
    if(s.mode==='spring'){
      return {kin:0.5*p.m*s.v*s.v, pot:0, spr:0.5*p.k*s.x*s.x, heat:0};
    }
    return {kin:0.5*p.m*s.v*s.v, pot:0, spr:0, heat:s.heat};
  },
  total(s,p){ const e=this.energies(s,p); return e.kin+e.pot+e.spr+e.heat; },

  anchors(s,p){
    if(s.mode==='ramp'){ const {ang,L}=this.ramp(p);
      const x=s.s*Math.cos(ang), y=(L-s.s)*Math.sin(ang);
      return [{x:0,y:0},{x,y}]; }
    return [{x:s.x||0,y:0},{x:0,y:0}];
  },
  readouts(s,p){
    const e=this.energies(s,p), tot=this.total(s,p);
    const out=[['t',s.t,'с'],['скорость v',Math.abs(s.v),'м/с']];
    out.push(['кинетическая E_к',e.kin,'Дж']);
    if(s.mode==='ramp') out.push(['потенциальная E_п',e.pot,'Дж']);
    if(s.mode==='spring') out.push(['упругая E_упр',e.spr,'Дж']);
    if(e.heat>0||s.mode==='friction') out.push(['ушло в тепло',e.heat,'Дж']);
    out.push(['ПОЛНАЯ энергия',tot,'Дж']);
    if(s.mode==='friction') out.push(['работа трения',e.heat,'Дж'],['сила трения',p.muF*p.m*p.g,'Н']);
    return out;
  },
  graphs:[
    {label:'Энергии во времени',unit:'Дж',series:['кинетич.','потенц./упр.'],
     get(s,p){ const e=SIMS.energy.energies(s,p); return [e.kin, e.pot+e.spr]; }},
    {label:'Полная механическая энергия',unit:'Дж',series:['полная','в тепле'],
     get(s,p){ const e=SIMS.energy.energies(s,p); return [e.kin+e.pot+e.spr, e.heat]; }}
  ],
  presets:[
    {name:'Горка без трения: энергия сохраняется',
     values:{mode:'ramp',m:2,h0:10,v0:0,muR:0,g:9.8,stopEnd:true}},
    {name:'Горка с трением: часть уходит в тепло',
     values:{mode:'ramp',m:2,h0:10,v0:0,muR:0.25,g:9.8,stopEnd:true}},
    {name:'Пружина: колебания энергии',
     values:{mode:'spring',m:2,k:200,x0:1,g:9.8,stopEnd:false,tStop:6}},
    {name:'Трение: вся кинетическая энергия в тепло',
     values:{mode:'friction',m:2,vf:12,muF:0.3,g:9.8,stopEnd:true}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    let spanX,spanY,cx,cy;
    if(p.mode==='ramp'){ const {ang,L}=this.ramp(p);
      spanX=L*Math.cos(ang)*1.35+3; spanY=p.h0*1.3+3; cx=spanX*0.32; cy=spanY*0.42; }
    else if(p.mode==='spring'){ spanX=p.x0*4+2; spanY=6; cx=0; cy=1; }
    else { spanX=Math.max(p.vf*p.vf/(2*p.muF*p.g)*1.3,10); spanY=6; cx=spanX*0.35; cy=1; }
    const scale=clamp(Math.min((W-70)/(spanX*PX_PER_M),(H-70)/(spanY*PX_PER_M)),0.002,30);
    return {x:cx,y:cy,scale};
  },

  /* ---- столбчатая диаграмма энергии сбоку (в пикселях поверх сцены) ---- */
  bars(ctx,s,p){
    const e=this.energies(s,p), tot=Math.max(this.total(s,p),1e-6);
    const items=[['E_к',e.kin,'--measure']];
    if(s.mode==='ramp') items.push(['E_п',e.pot,'--accent']);
    if(s.mode==='spring') items.push(['E_упр',e.spr,'--second']);
    if(e.heat>0) items.push(['тепло',e.heat,'--danger']);
    ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
    const x0=12, y0=CH-16, w=26, gap=12, Hbar=Math.min(CH*0.5,180);
    ctx.font='10px ui-monospace,monospace'; ctx.textBaseline='alphabetic';
    let x=x0;
    for(const [lbl,val,cvar] of items){
      const hh=val/tot*Hbar;
      ctx.fillStyle=css(cvar); ctx.globalAlpha=.85;
      ctx.fillRect(x,y0-hh,w,hh); ctx.globalAlpha=1;
      ctx.fillStyle=css('--ink-2');
      if(S.settings.nums!==false) ctx.fillText(Math.round(val)+'',x-2,y0-hh-4);
      ctx.fillText(lbl,x-2,y0+12);
      x+=w+gap;
    }
    // рамка «полная энергия»
    ctx.strokeStyle=css('--ink-3'); ctx.globalAlpha=.4;
    ctx.strokeRect(x0-4,y0-Hbar-2,x-x0+2,Hbar+2); ctx.globalAlpha=1;
    ctx.fillStyle=css('--ink-3'); ctx.fillText('энергия, Дж',x0-4,y0-Hbar-8);
    ctx.restore();
  },
  draw(ctx,s,v,p){
    if(s.mode==='ramp'){
      const {ang,L}=this.ramp(p);
      const X=L*Math.cos(ang), Y=p.h0;
      // горка (жёлоб)
      ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2.5);
      ctx.beginPath(); ctx.moveTo(0,Y); ctx.lineTo(X,0); ctx.lineTo(X+4,0); ctx.stroke();
      ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1);
      for(let k=0;k<X+4;k+=Math.max(L/30,0.3)){ ctx.beginPath(); ctx.moveTo(k,Math.max(0,Y-k*Math.tan(ang))); ctx.lineTo(k-0.3,Math.max(0,Y-k*Math.tan(ang))-0.3); ctx.stroke(); }
      // уровень отсчёта
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(4),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(X+4,0); ctx.stroke(); ctx.setLineDash([]);
      // тело
      const px=s.s*Math.cos(ang), py=(L-s.s)*Math.sin(ang), hb=0.4;
      ctx.fillStyle=v.c('--accent'); ctx.beginPath(); ctx.arc(px,py+hb*0.5,v.lw(7),0,7); ctx.fill();
      if(s.v>0.02) v.arrow(ctx,px,py+hb*0.5,px+Math.cos(-ang)*s.v*0.2,py+hb*0.5+Math.sin(-ang)*s.v*0.2,v.c('--measure'));
      v.label(ctx,`h = ${((L-s.s)*Math.sin(ang)).toFixed(1)} м`,px,py,10,-12,v.c('--accent'));
    }
    else if(s.mode==='spring'){
      // стена слева, пружина, тело
      const wall=-p.x0-1;
      ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2.5);
      ctx.beginPath(); ctx.moveTo(wall,-1.4); ctx.lineTo(wall,1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4,-1.4); ctx.lineTo(6,-1.4); ctx.stroke();  // пол
      // пружина (зигзаг) от стены до тела
      const bx=s.x, coils=14, x1=wall, x2=bx-0.35;
      ctx.strokeStyle=v.c('--second'); ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(x1,0);
      for(let i=0;i<=coils;i++){ const t=i/coils; ctx.lineTo(x1+(x2-x1)*t, (i%2?0.35:-0.35)*(i>0&&i<coils?1:0)); }
      ctx.lineTo(x2,0); ctx.stroke();
      // положение равновесия
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(0,-1.4); ctx.lineTo(0,1.4); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'равновесие',0,1.4,-30,-4,v.c('--ink-3'));
      const hb=0.45;
      ctx.fillStyle=v.c('--accent'); ctx.fillRect(bx-hb,-hb,2*hb,2*hb);
      v.label(ctx,`x = ${s.x.toFixed(2)} м`,bx,hb,8,10,v.c('--accent'));
      if(Math.abs(s.v)>0.02) v.arrow(ctx,bx,0,bx+s.v*0.25,0,v.c('--measure'));
    }
    else {
      // горизонталь + тело + метка старта
      ctx.strokeStyle=v.c('--ink-2'); ctx.lineWidth=v.lw(2);
      ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(1e3,0); ctx.stroke();
      ctx.strokeStyle=v.c('--ink-3'); ctx.lineWidth=v.lw(1);
      for(let k=-2;k<200;k+=0.6){ ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k-0.25,-0.25); ctx.stroke(); }
      ctx.strokeStyle=v.c('--line'); ctx.lineWidth=v.lw(1); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(0,-0.6); ctx.lineTo(0,1.5); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'старт',0,1.2,-10,0,v.c('--ink-3'));
      const hb=0.45;
      ctx.fillStyle=v.c('--accent'); ctx.fillRect(s.x-hb,0,2*hb,2*hb);
      if(Math.abs(s.v)>0.02) v.arrow(ctx,s.x,hb,s.x+s.v*0.2,hb,v.c('--measure'));
      if(p.muF>0) v.arrow(ctx,s.x,hb,s.x-Math.sign(s.v||1)*0.8,hb,v.c('--danger'));
      v.label(ctx,`v = ${Math.abs(s.v).toFixed(2)} м/с`,s.x,hb,8,-12,v.c('--measure'));
    }
    this.bars(ctx,s,p);
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
              {v:'fric',  t:'Трение: работа уходит в тепло'}]},
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
    const Ek=0.5*p.m*s.v*s.v;
    return {Ek,Ep:0,Eel:0,Eth:s.heat,tot:Ek+s.heat};
  },
  init(p){
    if(p.mode==='hill')   return {t:0,x:0,y:p.h0,v:p.v0h,heat:0,trail:[],E0:null,event:null,__stop:null};
    if(p.mode==='spring') return {t:0,x:p.x0,v:0,heat:0,trail:[],E0:null,event:null,__stop:null};
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
    return [{x:0,y:0},{x:s.x,y:0}];
  },
  readouts(s,p){
    const E=this.energies(s,p);
    const out=[['t',s.t,'с']];
    if(p.mode==='hill') out.push(['высота y',s.y,'м'],['скорость v',s.v,'м/с']);
    if(p.mode==='spring') out.push(['смещение x',s.x,'м'],['скорость v',s.v,'м/с'],['сила пружины',-p.k*s.x,'Н']);
    if(p.mode==='fric') out.push(['путь x',s.x,'м'],['скорость v',s.v,'м/с']);
    out.push(['E кинетическая',E.Ek,'Дж']);
    if(p.mode==='hill')   out.push(['E потенциальная',E.Ep,'Дж']);
    if(p.mode==='spring') out.push(['E упругая',E.Eel,'Дж']);
    if(p.mode==='fric')   out.push(['ушло в тепло',E.Eth,'Дж']);
    out.push(['ПОЛНАЯ E',E.tot,'Дж']);
    if(s.E0!==null) out.push(['E в начале',s.E0,'Дж']);
    return out;
  },
  graphs:[
    {label:'Энергии во времени',unit:'Дж',series:['кинетическая','потенц./упругая/тепло'],
     get(s,p){ const E=SIMS.energy.energies(s,p);
       return [E.Ek, p.mode==='hill'?E.Ep:(p.mode==='spring'?E.Eel:E.Eth)]; }},
    {label:'Полная энергия (проверка сохранения)',unit:'Дж',series:['E полная'],
     get(s,p){ return [SIMS.energy.energies(s,p).tot,null]; }}
  ],
  presets:[
    {name:'Горка: падение с 10 м',values:{mode:'hill',m:2,h0:10,v0h:0,g:9.8,stopEvent:true,tStop:0}},
    {name:'Горка: брошено вверх с 5 м',values:{mode:'hill',m:2,h0:5,v0h:10,g:9.8,stopEvent:false,tStop:0}},
    {name:'Пружина: колебания',values:{mode:'spring',m:2,k:80,x0:1.5,g:9.8,stopEvent:false,tStop:0}},
    {name:'Пружина жёстче — быстрее колебания',values:{mode:'spring',m:1,k:400,x0:1,g:9.8,tStop:0}},
    {name:'Трение: тело тормозит',values:{mode:'fric',m:2,v0f:12,mu:0.3,g:9.8,stopEvent:true,tStop:0}},
    {name:'Трение слабое — едет далеко',values:{mode:'fric',m:2,v0f:12,mu:0.08,g:9.8,stopEvent:true,tStop:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    let spanX,spanY,cx,cy;
    if(p.mode==='hill'){ spanX=8; spanY=Math.max(p.h0*1.3,4); cx=0; cy=spanY/2; }
    else if(p.mode==='spring'){ spanX=Math.max(Math.abs(p.x0)*3.5,3); spanY=spanX*H/W; cx=0; cy=0; }
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
