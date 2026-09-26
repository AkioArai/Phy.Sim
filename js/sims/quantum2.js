'use strict';
/* =============================================================================
   КВАНТОВАЯ МЕХАНИКА: ИЗМЕРЕНИЕ (3.1.0)

   Две сцены о том, что отличает квантовую механику от волн и частиц по
   отдельности:
     • двухщелевой опыт с одиночными электронами — каждый оставляет одну
       точку, а картина из тысяч точек интерференционная; узнали, через какую
       щель прошёл электрон, — интерференция пропала;
     • опыт Штерна — Герлаха — пучок атомов в неоднородном магнитном поле
       расщепляется на два пятна, а не размазывается полосой; последовательные
       магниты показывают, что измерение меняет состояние.

   Случайность здесь настоящая: каждое попадание разыгрывается по
   вероятности, которую даёт теория, генератором с зерном — поэтому две
   одинаковые настройки дают одинаковую картину, а статистика сходится к
   теории так, как в опыте.
   ============================================================================= */
const КВ2={
  rnd(s){ s.seed=(Math.imul(s.seed^(s.seed>>>15),2246822507)+0x9e3779b9)|0;
    return ((s.seed>>>0)%1000003)/1000003; },
  sinc(x){ return Math.abs(x)<1e-9 ? 1 : Math.sin(x)/x; }
};

Object.assign(SIMS,{
/* ================== ДВУХЩЕЛЕВОЙ ОПЫТ С ОДИНОЧНЫМИ ЭЛЕКТРОНАМИ ================= */
slits1:{
  title:'Двухщелевой опыт: электроны по одному',
  schema:true,
  hudAware:true,
  params:[
    {key:'E',label:'Энергия электронов E',unit:'эВ',min:5,max:300,step:5,default:50},
    {key:'d',label:'Расстояние между щелями d',unit:'нм',min:100,max:1500,step:10,default:400},
    {key:'a',label:'Ширина щели a',unit:'нм',min:20,max:300,step:5,default:80},
    {key:'L',label:'Расстояние до экрана L',unit:'м',min:0.2,max:2,step:0.1,default:1},
    {key:'open',label:'Щели',type:'select',default:'both',
     options:[{v:'both',t:'Открыты обе'},{v:'left',t:'Только верхняя'},{v:'right',t:'Только нижняя'}]},
    {key:'which',label:'Детектор «через какую щель»',type:'check',default:false},
    {key:'rate',label:'Электронов в секунду',min:1,max:400,step:1,default:60},

    {type:'group',label:'Показывать'},
    {key:'theory',label:'Теоретическая кривая |ψ|²',type:'check',default:true},
    {key:'hist',label:'Гистограмма попаданий',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'Nstop',label:'Когда попаданий станет (0 — выкл)',min:0,max:20000,step:100,default:0}
  ],
  h:6.62607015e-34, me:9.1093837015e-31, e:1.602176634e-19,
  /* длина волны де Бройля λ = h/√(2meE), в нм */
  lam(p){ return this.h/Math.sqrt(2*this.me*p.E*this.e)*1e9; },
  /* ширина полосы на экране Δx = λL/d и половина центрального максимума
     огибающей λL/a — в миллиметрах */
  fringe(p){ return this.lam(p)*p.L/p.d*1e3; },
  envelope(p){ return this.lam(p)*p.L/p.a*1e3; },
  /* интенсивность на экране в точке x (мм); малые углы: sin θ ≈ x/L */
  I(p,x){
    const s=x*1e-3/p.L, λ=this.lam(p);
    const env=Math.pow(КВ2.sinc(Math.PI*p.a*s/λ),2);
    if(p.open!=='both' || p.which) return env;         // одна щель или известен путь — без интерференции
    return env*Math.pow(Math.cos(Math.PI*p.d*s/λ),2);
  },
  X(p){ return 1.5*this.envelope(p); },               // полуширина экрана, мм: центральный максимум огибающей и половина соседних
  BINS:120,
  init(p){ return {t:0,seed:20260926,hits:[],bins:new Array(this.BINS).fill(0),полёт:[],копилка:0,__stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    s.копилка+=dt*p.rate;
    const X=this.X(p);
    while(s.копилка>=1){
      s.копилка-=1;
      // точка на экране — отбором по |ψ|² (максимум равен 1 в центре)
      let x, охр=0;
      do{ x=(КВ2.rnd(s)*2-1)*X; } while(КВ2.rnd(s)>this.I(p,x) && ++охр<400);
      const y=КВ2.rnd(s);                              // высота вдоль щели — равномерно
      const щель = p.open==='left'?1 : p.open==='right'?-1 : (КВ2.rnd(s)<0.5?1:-1);
      s.полёт.push({x,y,щель,t:0});
      if(s.полёт.length>60) { const q=s.полёт.shift(); this.засчитать(s,q,X); }
    }
    const скорость=Math.max(1.6,p.rate/30);               // при частом счёте летят быстрее, чтобы долетать
    for(const q of s.полёт) q.t+=dt*скорость;
    while(s.полёт.length && s.полёт[0].t>=1) this.засчитать(s,s.полёт.shift(),X);
    if(p.Nstop>0 && s.hits.length>=p.Nstop){ s.__stop=`Попаданий: ${s.hits.length}. Сравните гистограмму с кривой |ψ|²`; }
  },
  засчитать(s,q,X){
    s.hits.push(q); if(s.hits.length>20000) s.hits.shift();
    const b=Math.floor((q.x+X)/(2*X)*this.BINS); if(b>=0&&b<this.BINS) s.bins[b]++;
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    return [['попало на экран',s.hits.length,'электронов'],
      ['длина волны де Бройля λ = h/√(2mE)',this.lam(p)*1e3,'пм'],
      ['ширина полосы Δx = λL/d',this.fringe(p),'мм'],
      ['первый ноль огибающей λL/a',this.envelope(p),'мм'],
      ['полос в центральном максимуме ≈ 2d/a',p.open==='both'&&!p.which?2*p.d/p.a:NaN, p.open==='both'&&!p.which?'':'— интерференции нет'],
      ['путь известен',p.which?1:0, p.which?'да — картина двух щелей без полос':'нет']];
  },
  graphs:[],
  presets:[
    {name:'Обе щели: полосы из отдельных точек',values:{open:'both',which:false,rate:60,E:50,d:400,a:80}},
    {name:'Быстро набрать 5000 попаданий',values:{open:'both',which:false,rate:400,Nstop:5000}},
    {name:'Детектор включён — полосы исчезают',values:{open:'both',which:true,rate:200}},
    {name:'Одна щель — только огибающая',values:{open:'left',which:false,rate:200}},
    {name:'Медленные электроны — шире полосы',values:{open:'both',which:false,E:10,rate:200}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-20)/(11.2*PX_PER_M),(H-20)/(8.2*PX_PER_M)),0.002,30);
    return {x:0.4,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), line=v.c('--line');
    const X=this.X(p), H=3.6;                          // экран — по вертикали от −H до H
    const Y=x=>x/X*H;                                  // миллиметры экрана → сцена
    const src=-5, wall=-2.2, scr=1.8;
    // пушка
    ctx.fillStyle=ink; ctx.fillRect(src-0.5,-0.3,0.5,0.6);
    v.label(ctx,`электроны, E = ${p.E} эВ`,src-0.5,-0.3,0,16,ink3);
    // стенка со щелями (на сцене щели раздвинуты условно, 0,7 — «d»)
    const ys=0.7, wa=0.18;
    ctx.fillStyle=ink3;
    ctx.fillRect(wall-0.08,-H,0.16,H-ys-wa); ctx.fillRect(wall-0.08,-ys+wa,0.16,2*(ys-wa)); ctx.fillRect(wall-0.08,ys+wa,0.16,H-ys-wa);
    if(p.open==='left') ctx.fillRect(wall-0.08,-ys-wa,0.16,2*wa);
    if(p.open==='right') ctx.fillRect(wall-0.08,ys-wa,0.16,2*wa);
    v.label(ctx,`d = ${p.d} нм, a = ${p.a} нм`,wall,-H,-50,16,ink3);
    if(p.which){                                        // детектор у щелей
      for(const y of [ys,-ys]){ ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.arc(wall+0.35,y,0.16,0,7); ctx.stroke(); }
      v.label(ctx,'детектор: какая щель',wall+0.35,ys,-60,-18,dang);
    }
    // летящие электроны: до стенки прямо, потом к точке попадания
    for(const q of s.полёт){
      const yh=Y(q.x), sl=q.щель*ys;
      let x,y;
      if(q.t<0.5){ const u=q.t/0.5; x=src+(wall-src)*u; y=sl*u; }
      else { const u=(q.t-0.5)/0.5; x=wall+(scr-wall)*u; y=sl+(yh-sl)*u; }
      ctx.fillStyle=p.which?dang:acc; ctx.beginPath(); ctx.arc(x,y,v.lw(2.6),0,7); ctx.fill();
    }
    // экран с точками попаданий
    ctx.fillStyle=v.c('--panel-2'); ctx.fillRect(scr,-H,1.1,2*H);
    ctx.strokeStyle=line; ctx.lineWidth=v.lw(1); ctx.strokeRect(scr,-H,1.1,2*H);
    ctx.fillStyle=ink; ctx.globalAlpha=Math.max(0.25,Math.min(0.9,300/Math.max(1,s.hits.length)*2));
    const r=v.lw(1.3);
    for(let i=Math.max(0,s.hits.length-8000);i<s.hits.length;i++){ const q=s.hits[i]; ctx.fillRect(scr+0.05+q.y*1.0-r/2,Y(q.x)-r/2,r,r); }
    ctx.globalAlpha=1;
    v.label(ctx,`экран: ${s.hits.length} точек`,scr,H,0,-10,ink);
    // гистограмма и теория — справа от экрана, столбики вбок
    const gx=scr+1.3, gw=2.6;
    let mx=0; for(const b of s.bins) if(b>mx) mx=b;
    if(p.hist && mx>0){
      ctx.fillStyle=acc; ctx.globalAlpha=.45;
      const bh=2*H/this.BINS;
      s.bins.forEach((b,i)=>{ if(b) ctx.fillRect(gx,-H+i*bh,gw*b/mx,bh*0.9); });
      ctx.globalAlpha=1;
    }
    if(p.theory){
      /* Кривая в тех же единицах, что столбики: ожидаемое число попаданий в
         корзину = N·I(x)/ΣI по центрам корзин. Пока точек нет — в полный рост. */
      let S=0; for(let i=0;i<this.BINS;i++) S+=this.I(p,-X+2*X*(i+0.5)/this.BINS);
      const N=s.hits.length, n=400;
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.6); ctx.beginPath();
      for(let i=0;i<=n;i++){ const x=-X+2*X*i/n, I=this.I(p,x);
        const w = mx>0 ? gw*(N*I/S)/mx : gw*I;
        i?ctx.lineTo(gx+Math.min(w,gw*1.2),Y(x)):ctx.moveTo(gx+Math.min(w,gw*1.2),Y(x)); }
      ctx.stroke();
      v.label(ctx,'|ψ|² — теория',gx+gw,H,-80,-10,dang);
    }
    // масштаб экрана
    v.label(ctx,`±${X.toFixed(2)} мм`,scr+1.1,-H,4,10,ink3);
    const Δ=this.fringe(p);
    if(p.open==='both'&&!p.which) v.label(ctx,`полосы через Δx = λL/d = ${Δ.toFixed(3)} мм`,wall,H,-40,-10,ink);
    else v.label(ctx,p.which?'путь известен — интерференции нет':'одна щель — только огибающая',wall,H,-40,-10,dang);
  }
},

/* ================== ОПЫТ ШТЕРНА — ГЕРЛАХА ================= */
sterngerlach:{
  title:'Спин: опыт Штерна — Герлаха',
  schema:true,
  hudAware:true,
  params:[
    {key:'mode',label:'Опыт',type:'select',default:'one',
     options:[{v:'one',t:'Один магнит: пятна или полоса?'},
              {v:'two',t:'Два магнита: z, потом под углом θ'},
              {v:'three',t:'Три магнита: z, x, снова z'}]},
    {key:'spin',label:'Спин атомов',type:'select',default:'half',
     options:[{v:'half',t:'½ — серебро (два пятна)'},{v:'one',t:'1 — три пятна'}]},
    {key:'th',label:'Угол второго магнита θ',unit:'°',min:0,max:180,step:5,default:90,если:p=>p.mode==='two'},
    {key:'classic',label:'Показать классическое ожидание',type:'check',default:true},
    {key:'rate',label:'Атомов в секунду',min:1,max:300,step:1,default:40}
  ],
  /* Вероятности. Спин ½: после «+z» второй магнит под углом θ даёт «+» с
     вероятностью cos²(θ/2). Спин 1 в первом магните — три исхода по трети
     (неполяризованный пучок). В опыте «z, x, z» после выбора «+x» третий
     магнит снова даёт 50/50: знание о z стёрто. */
  P2(p){ const t=p.th*Math.PI/180; return Math.pow(Math.cos(t/2),2); },
  исходы(p){ return p.spin==='one'?[1,0,-1]:[1,-1]; },
  init(p){ return {t:0,seed:777,A:{},B:{},C:{},летят:[],копилка:0,N:0,__stop:null}; },
  step(s,dt,p){
    s.t+=dt; s.копилка+=dt*p.rate;
    while(s.копилка>=1){ s.копилка-=1; s.летят.push(this.атом(s,p)); s.N++; }
    for(const a of s.летят) a.t+=dt*0.8;
    while(s.летят.length && s.летят[0].t>=1){ const a=s.летят.shift(); this.засчитать(s,a); }
    if(s.летят.length>200) s.летят.splice(0,s.летят.length-200);
  },
  /* судьба одного атома: исходы в каждом магните, по вероятностям */
  атом(s,p){
    const r=()=>КВ2.rnd(s);
    const out=this.исходы(p);
    const m1=out[Math.floor(r()*out.length)];
    const a={t:0,m1,m2:null,m3:null,y0:(r()-0.5)*0.3,кл:(r()*2-1)};
    if(p.mode==='one') return a;
    if(m1!==1) return a;                                // во второй магнит идут только «+»
    if(p.mode==='two'){
      if(p.spin==='half') a.m2 = r()<this.P2(p)?1:-1;
      else { const c=Math.cos(p.th*Math.PI/180), P=[(1+c)*(1+c)/4,(1-c*c)/2,(1-c)*(1-c)/4], u=r();
        a.m2 = u<P[0]?1 : u<P[0]+P[1]?0 : -1; }
      return a;
    }
    // «z, x, z»: второй — вдоль x, дальше идут только «+x»; третий — снова z
    if(p.spin==='half'){ a.m2=r()<0.5?1:-1; if(a.m2===1) a.m3=r()<0.5?1:-1; }
    else { const u=r(); a.m2=u<0.25?1:u<0.75?0:-1; if(a.m2===1){ const w=r(); a.m3=w<0.25?1:w<0.75?0:-1; } }
    return a;
  },
  засчитать(s,a){
    s.A[a.m1]=(s.A[a.m1]||0)+1;
    if(a.m2!==null) s.B[a.m2]=(s.B[a.m2]||0)+1;
    if(a.m3!==null) s.C[a.m3]=(s.C[a.m3]||0)+1;
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const доля=(o,k)=>{ const n=Object.values(o).reduce((a,b)=>a+b,0); return n?(o[k]||0)/n*100:NaN; };
    const out=[['атомов прошло',s.N,''],
      ['первый магнит (z): вверх',доля(s.A,1),'%'],
      ['первый магнит (z): вниз',доля(s.A,-1),'%']];
    if(p.spin==='one') out.push(['первый магнит: посередине',доля(s.A,0),'%']);
    if(p.mode==='two'){
      out.push([`второй магнит (угол ${p.th}°): «+»`,доля(s.B,1),'%']);
      if(p.spin==='half') out.push(['теория: cos²(θ/2)',this.P2(p)*100,'%']);
    }
    if(p.mode==='three') out.push(['второй (x): «+x»',доля(s.B,1),'%'],['третий (снова z): вверх',доля(s.C,1),'% — опять половина']);
    out.push(['проекция спина на ось',0, p.spin==='half'?'только +ħ/2 или −ħ/2':'только +ħ, 0 или −ħ']);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Серебро: два пятна, а не полоса',values:{mode:'one',spin:'half',classic:true,rate:60}},
    {name:'Спин 1: три пятна',values:{mode:'one',spin:'one',rate:60}},
    {name:'Второй магнит под 90°: 50 на 50',values:{mode:'two',spin:'half',th:90,rate:120}},
    {name:'Второй магнит под 60°: 75 на 25',values:{mode:'two',spin:'half',th:60,rate:120}},
    {name:'z, x, z: измерение стирает прошлое',values:{mode:'three',spin:'half',rate:150}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const w=p.mode==='one'?9.4:p.mode==='two'?11.5:13.8;
    const scale=clamp(Math.min((W-20)/(w*PX_PER_M),(H-20)/(7*PX_PER_M)),0.002,30);
    return {x:p.mode==='one'?0:p.mode==='two'?1.1:2.2,y:0.3,scale};
  },
  /* магнит: клин сверху (северный полюс) и паз снизу — поле неоднородно */
  магнит(ctx,v,x,y0,подпись,подписи){
    const acc=v.c('--accent'), dang=v.c('--danger'), ink3=v.c('--ink-3');
    ctx.save(); ctx.translate(x+0.8,y0);
    ctx.fillStyle=dang; ctx.globalAlpha=.75;
    ctx.beginPath(); ctx.moveTo(-0.8,0.9); ctx.lineTo(0.8,0.9); ctx.lineTo(0.8,0.55); ctx.lineTo(0,0.25); ctx.lineTo(-0.8,0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle=acc;
    ctx.beginPath(); ctx.moveTo(-0.8,-0.9); ctx.lineTo(0.8,-0.9); ctx.lineTo(0.8,-0.3); ctx.lineTo(0.3,-0.3); ctx.lineTo(0.3,-0.5); ctx.lineTo(-0.3,-0.5); ctx.lineTo(-0.3,-0.3); ctx.lineTo(-0.8,-0.3); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha=1;
    // подпись откладываем: экраны рисуются позже и закрыли бы её
    подписи.push([подпись,x+0.8,y0-0.9]);
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    const S=0.9;                                        // расщепление по высоте за один магнит
    const src=-4.2, m1=-2.6;
    ctx.fillStyle=ink; ctx.fillRect(src-0.5,-0.25,0.5,0.5);
    v.label(ctx,'печь: атомы',src-0.5,0.25,-6,-12,ink3);
    const подписи=[];
    this.магнит(ctx,v,m1,0,'магнит z',подписи);
    const уровни=this.исходы(p);
    const yOf=m=>m*S;
    // один магнит: экран
    const scr1=p.mode==='one'?3.2:1.4;
    const cnt=o=>Object.values(o).reduce((a,b)=>a+b,0);
    if(p.mode==='one'){
      ctx.fillStyle=v.c('--panel-2'); ctx.fillRect(scr1,-2.6,0.5,5.2);
      if(p.classic){                                     // классика: сплошная полоса
        ctx.fillStyle=ink3; ctx.globalAlpha=.25; ctx.fillRect(scr1-0.35,-S,0.25,2*S); ctx.globalAlpha=1;
        v.label(ctx,'классика: полоса',scr1-0.35,0,-110,0,ink3);
      }
      for(const m of уровни){ const n=s.A[m]||0, y=yOf(m)*1.6;
        ctx.fillStyle=acc; ctx.globalAlpha=Math.min(0.9,0.15+n/Math.max(1,cnt(s.A))*1.4);
        ctx.beginPath(); ctx.ellipse(scr1+0.25,y,0.18,0.28,0,0,7); ctx.fill(); ctx.globalAlpha=1;
        v.label(ctx,`${m>0?'+':m<0?'−':''}${p.spin==='half'?'ħ/2':(m===0?'0':'ħ')}: ${n}`,scr1+0.5,y,6,0,acc);
      }
      v.label(ctx,'опыт: пятна',scr1,2.6,-10,-8,acc);
    } else {
      // верхний пучок идёт дальше, нижний — в поглотитель
      ctx.fillStyle=ink; ctx.fillRect(scr1-0.1,yOf(-1)*1.2-0.25,0.2,0.5);
      v.label(ctx,'поглотитель',scr1,yOf(-1)*1.2,-30,20,ink3);
      const x2=scr1+0.6;
      // второй магнит, повёрнутый вокруг оси пучка: показываем поворот подписью и наклоном полюсов
      this.магнит(ctx,v,x2,yOf(1)*1.2,p.mode==='two'?`магнит под ${p.th}°`:'магнит x',подписи);
      if(p.mode==='two'){                                   // вид вдоль пучка: куда смотрит ось второго магнита
        const cx=x2+0.8, cy=yOf(1)*1.2+1.45, t=p.th*Math.PI/180;
        ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.arc(cx,cy,0.32,0,7); ctx.stroke();
        v.arrow(ctx,cx,cy,cx+0.3*Math.sin(t),cy+0.3*Math.cos(t),ok);
        v.label(ctx,'ось',cx,cy,14,-4,ok);
      }
      const scr2=x2+2.2;
      if(p.mode==='two'){
        ctx.fillStyle=v.c('--panel-2'); ctx.fillRect(scr2,-2.6,0.5,5.2);
        for(const m of уровни){ const n=s.B[m]||0, y=yOf(1)*1.2+m*S;
          ctx.fillStyle=ok; ctx.globalAlpha=Math.min(0.9,0.15+n/Math.max(1,cnt(s.B))*1.4);
          ctx.beginPath(); ctx.arc(scr2+0.25,y,0.22,0,7); ctx.fill(); ctx.globalAlpha=1;
          v.label(ctx,`${m>0?'+':m<0?'−':'0'}: ${n}`,scr2+0.5,y,6,0,ok);
        }
        if(p.spin==='half') v.label(ctx,`теория: «+» = cos²(θ/2) = ${(this.P2(p)*100).toFixed(0)} %`,scr2,-2.6,-60,18,ink);
      } else {
        ctx.fillStyle=ink; ctx.fillRect(scr2-0.1,yOf(1)*1.2+S-0.25-2*S,0.2,0.5);
        const x3=scr2+0.5;
        this.магнит(ctx,v,x3,yOf(1)*1.2+S,'снова z',подписи);
        const scr3=x3+2.2;
        ctx.fillStyle=v.c('--panel-2'); ctx.fillRect(scr3,-2.6,0.5,5.2);
        for(const m of уровни){ const n=s.C[m]||0, y=yOf(1)*1.2+S+m*S*0.8;
          ctx.fillStyle=dang; ctx.globalAlpha=Math.min(0.9,0.15+n/Math.max(1,cnt(s.C))*1.4);
          ctx.beginPath(); ctx.arc(scr3+0.25,y,0.22,0,7); ctx.fill(); ctx.globalAlpha=1;
          v.label(ctx,`${m>0?'+z':m<0?'−z':'0'}: ${n}`,scr3+0.5,y,6,0,dang);
        }
        v.label(ctx,'снова 50 на 50: измерение x стёрло знание о z',scr3,-2.6,-290,18,ink);
      }
    }
    // летящие атомы: точки вдоль пучков
    const x2=scr1+0.6, scr2=x2+2.2, x3=scr2+0.5, scr3=x3+2.2;
    const конец = p.mode==='one'?scr1 : p.mode==='two'?scr2 : scr3;
    const изгиб=(x,x0,L)=>Math.min(1,Math.pow(Math.max(0,x-x0)/L,2));   // в магните путь — парабола
    for(const a of s.летят){
      const x=src+(конец-src)*a.t;
      let y;
      if(p.mode==='one') y=a.y0+yOf(a.m1)*1.6*изгиб(x,m1,scr1-m1);
      else {
        y=a.y0+yOf(a.m1)*1.2*изгиб(x,m1,scr1-m1);
        if(x>scr1){ if(a.m1!==1) continue;             // нижний пучок остался в поглотителе
          y=yOf(1)*1.2+(a.m2===null?0:a.m2*S*изгиб(x,x2,2.2)); }
        if(p.mode==='three' && x>scr2){ if(a.m2!==1) continue;
          y=yOf(1)*1.2+S+(a.m3===null?0:a.m3*S*0.8*изгиб(x,x3,2.2)); }
      }
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(x,y,v.lw(2.4),0,7); ctx.fill();
    }
    for(const [t,x,y] of подписи) v.label(ctx,t,x,y,-24,16,ink3);
    v.label(ctx,p.spin==='half'?'проекция спина на ось магнита — только ±ħ/2':'проекция — только +ħ, 0, −ħ',src-0.5,-2.6,0,20,ink3);
  }
}
});
