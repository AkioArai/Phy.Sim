/* =============================================================================
   МАТЕМАТИЧЕСКИЙ АППАРАТ

   Симуляции этого файла ничего не моделируют в природе: они показывают саму
   математику, которой пользуются остальные главы. Смысл тот же, что и у
   физических моделей, — покрутить и увидеть, а не поверить на слово.

   Сцены здесь безразмерные (единичная окружность, график функции), поэтому
   у всех стоит schema: метрических осей и подписи «сетка N м» быть не должно.
   ============================================================================= */
'use strict';
Object.assign(SIMS,{

/* ================== ЕДИНИЧНАЯ ОКРУЖНОСТЬ ================= */
/* Синус и косинус вводят тремя разными способами — как отношение сторон в
   прямоугольном треугольнике, как координаты точки на окружности и как
   функцию времени. Ученик обычно знает первый, физике нужны второй и третий,
   и связь между ними не очевидна. Здесь все три показаны одной картинкой:
   точка бежит по окружности, её тень на осях — это cos и sin, а развёртка
   этой тени по времени — синусоида, с которой начинается глава о колебаниях. */
unitcircle:{
  title:'Единичная окружность: синус, косинус и радианы',
  /* Сцена — математический чертёж: по осям не метры, а числа от −1 до 1.
     Поэтому ни осей с числами в метрах, ни надписи «сетка N м». */
  schema:true,
  params:[
    {key:'mode',label:'Что показываем',type:'select',default:'circle',
     options:[{v:'circle', t:'Окружность: cos и sin как проекции'},
              {v:'unwrap', t:'Развёртка: та же точка как синусоида'},
              {v:'small',  t:'Малые углы: когда sin θ ≈ θ'}]},
    {key:'ang',label:'Угол φ₀',unit:'°',min:-360,max:360,step:1,default:35},
    {key:'w',  label:'Угловая скорость ω',unit:'рад/с',min:0,max:3,step:0.05,default:0},

    {type:'group',label:'Показывать'},
    {key:'proj',  label:'Проекции на оси (cos и sin)',type:'check',default:true},
    {key:'arc',   label:'Дугу и её длину в радианах',type:'check',default:true},
    {key:'tang',  label:'Тангенс как отрезок касательной',type:'check',default:false},
    {key:'ident', label:'Треугольник основного тождества',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],

  /* Текущий угол в радианах: начальный плюс набежавший за время. При ω = 0
     картинка стоит, и углом управляет ползунок — так удобнее разбираться. */
  phi(s,p){ return p.ang*Math.PI/180 + p.w*(s?s.t:0); },
  RAD:2.6,                                   // радиус окружности на сцене

  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
  },
  anchors(s,p){
    const R=this.RAD, f=this.phi(s,p);
    return [{x:0,y:0},{x:R*Math.cos(f),y:R*Math.sin(f)}];
  },

  readouts(s,p){
    const f=this.phi(s,p), c=Math.cos(f), sn=Math.sin(f);
    const град=f*180/Math.PI;
    const out=[
      ['угол φ',град,'°'],
      ['он же в радианах',f,'рад'],
      ['длина дуги при R = 1',Math.abs(f),'— вот что такое радиан'],
      ['cos φ (проекция на x)',c,''],
      ['sin φ (проекция на y)',sn,''],
      ['sin²φ + cos²φ',sn*sn+c*c,'— всегда единица, это теорема Пифагора']
    ];
    if(p.tang){
      const tg=Math.abs(c)<1e-9?Infinity:sn/c;
      out.push(['tg φ = sin φ / cos φ',tg,'']);
    }
    if(p.mode==='small'){
      /* Приближение sin θ ≈ θ — рабочая лошадь всей физики малых колебаний.
         Показываем не только «примерно равно», но и цену приближения. */
      const θ=Math.abs(f), sθ=Math.abs(sn);
      const ошибка=θ>1e-12?100*(θ-sθ)/θ:0;
      out.push(['θ в радианах',θ,'рад'],
               ['sin θ',sθ,''],
               ['ошибка замены sin θ → θ',ошибка,'%'],
               ['она же для cos θ → 1 − θ²/2',
                θ>1e-12?100*Math.abs(Math.cos(f)-(1-θ*θ/2))/Math.abs(Math.cos(f)):0,'%']);
    }
    return out;
  },

  graphs:[
    {label:'Проекции точки: cos φ и sin φ',unit:'',series:['cos','sin'],
     get(s,p){ const f=SIMS.unitcircle.phi(s,p); return [Math.cos(f),Math.sin(f)]; }},
    {label:'Угол φ',unit:'рад',series:['φ'],
     get(s,p){ return [SIMS.unitcircle.phi(s,p),null]; }}
  ],

  presets:[
    {name:'Радиан — это длина дуги, равная радиусу',
     values:{mode:'circle',ang:57,w:0,arc:true,proj:true,ident:false,tang:false}},
    {name:'Синус — высота, косинус — ширина',
     values:{mode:'circle',ang:35,w:0,proj:true,ident:true,arc:true,tang:false}},
    {name:'Знакомые углы: 30°, 45°, 60°',
     values:{mode:'circle',ang:45,w:0,proj:true,ident:true,arc:false,tang:false}},
    {name:'Тангенс — отрезок на касательной',
     values:{mode:'circle',ang:60,w:0,tang:true,proj:true,ident:false,arc:false}},
    {name:'Развёртка: откуда берётся синусоида',
     values:{mode:'unwrap',ang:0,w:1,proj:true,arc:false,ident:false,tang:false}},
    {name:'Малые углы: 10° — ошибка меньше 0,5 %',
     values:{mode:'small',ang:10,w:0,proj:true,arc:true,ident:false,tang:false}},
    {name:'Малые углы: 60° — приближение уже врёт на 17 %',
     values:{mode:'small',ang:60,w:0,proj:true,arc:true,ident:false,tang:false}}
  ],

  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const ш=p.mode==='unwrap'?15:9.5, в=p.mode==='unwrap'?8.6:8.6;
    const scale=clamp(Math.min((W-60)/(ш*PX_PER_M),(H-60)/(в*PX_PER_M)),0.002,30);
    return {x:p.mode==='unwrap'?3.3:0,y:0,scale};
  },

  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const R=this.RAD, f=this.phi(s,p);
    const c=Math.cos(f), sn=Math.sin(f), X=R*c, Y=R*sn;
    const mid=t=>-Math.round(String(t).length*3.05);

    // ---- оси чертежа: они свои, а не метрические
    ctx.strokeStyle=ink3; ctx.globalAlpha=.7; ctx.lineWidth=v.lw(1.2);
    ctx.beginPath();
    ctx.moveTo(-R-0.7,0); ctx.lineTo(R+0.9,0);
    ctx.moveTo(0,-R-0.7); ctx.lineTo(0,R+0.9);
    ctx.stroke(); ctx.globalAlpha=1;
    v.label(ctx,'cos φ',R+0.9,0,-24,16,ink3);
    v.label(ctx,'sin φ',0,R+0.9,8,-4,ink3);
    // деления −1 и +1: масштаб чертежа задаётся радиусом, а не сеткой
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
    for(const [x,y,t] of [[R,0,'1'],[-R,0,'−1'],[0,R,'1'],[0,-R,'−1']]){
      ctx.beginPath();
      if(y===0){ ctx.moveTo(x,-0.12); ctx.lineTo(x,0.12); }
      else     { ctx.moveTo(-0.12,y); ctx.lineTo(0.12,y); }
      ctx.stroke();
      v.label(ctx,t,x,y,y===0?-3:10,y===0?16:-4,ink3);
    }

    // ---- сама окружность
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.8);
    ctx.beginPath(); ctx.arc(0,0,R,0,7); ctx.stroke();

    /* ---- дуга от нуля до точки. Её длина при R = 1 и ЕСТЬ угол в радианах —
       это единственное определение радиана, которое не нужно запоминать. */
    if(p.arc){
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(3.4);
      ctx.beginPath(); ctx.arc(0,0,R,Math.min(0,f),Math.max(0,f)); ctx.stroke();
      /* Подпись выносим ЗА окружность: внутри она ложится на треугольник
         основного тождества и на подпись гипотенузы. */
      const серед=f/2, t=`дуга = ${Math.abs(f).toFixed(3)}`;
      v.label(ctx,t,(R+1.15)*Math.cos(серед),(R+1.15)*Math.sin(серед),mid(t),-6,acc);
    }

    // ---- радиус к точке
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(X,Y); ctx.stroke();

    /* ---- проекции: пунктиры до осей. Это и есть определение косинуса и
       синуса, годное для любого угла, а не только для острого. */
    if(p.proj){
      ctx.setLineDash([v.lw(4),v.lw(4)]); ctx.lineWidth=v.lw(1.4);
      ctx.strokeStyle=meas;
      ctx.beginPath(); ctx.moveTo(X,Y); ctx.lineTo(X,0); ctx.stroke();
      ctx.strokeStyle=sec;
      ctx.beginPath(); ctx.moveTo(X,Y); ctx.lineTo(0,Y); ctx.stroke();
      ctx.setLineDash([]);
      // сами отрезки-проекции — жирнее пунктира
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(3.4);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(X,0); ctx.stroke();
      ctx.strokeStyle=sec;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,Y); ctx.stroke();
      const tc=`cos φ = ${c.toFixed(3)}`, ts=`sin φ = ${sn.toFixed(3)}`;
      v.label(ctx,tc,X/2,0,mid(tc),Y>=0?20:-10,meas);
      v.label(ctx,ts,0,Y/2,X>=0?-Math.round(ts.length*6.1)-10:12,0,sec);
    }

    /* ---- прямоугольный треугольник: гипотенуза 1, катеты cos и sin.
       Теорема Пифагора для него и есть sin² + cos² = 1 — тождество, которое
       обычно заучивают, хотя выводится оно в одну строку. */
    if(p.ident){
      ctx.strokeStyle=acc; ctx.globalAlpha=.16;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(X,0); ctx.lineTo(X,Y); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1;
      // прямой угол
      const зн=Math.sign(Y)||1, знx=Math.sign(X)||1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath();
      ctx.moveTo(X-0.22*знx,0); ctx.lineTo(X-0.22*знx,0.22*зн); ctx.lineTo(X,0.22*зн);
      ctx.stroke();
      /* Подпись гипотенузы сдвигаем к центру и наружу от треугольника: на
         середине она наезжала и на подпись синуса, и на дугу. */
      const t='гипотенуза = 1';
      v.label(ctx,t,X*0.55,Y*0.42,mid(t),4,acc);
    }

    /* ---- тангенс: отрезок касательной от оси до продолжения радиуса.
       Отсюда видно, почему он уходит в бесконечность при φ → 90°. */
    if(p.tang && Math.abs(c)>1e-3){
      const tg=sn/c;
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.2); ctx.globalAlpha=.5;
      ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(R*1.6*Math.sign(c),R*1.6*tg*Math.sign(c)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(3.4);
      ctx.beginPath(); ctx.moveTo(R*Math.sign(c),0); ctx.lineTo(R*Math.sign(c),R*tg*Math.sign(c)); ctx.stroke();
      const t=`tg φ = ${tg.toFixed(3)}`;
      v.label(ctx,t,R*Math.sign(c),R*tg*Math.sign(c)/2,12*Math.sign(c),0,dang);
    }

    // ---- сама точка
    ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(X,Y,v.lw(5),0,7); ctx.fill();
    const tф=`φ = ${(f*180/Math.PI).toFixed(1)}° = ${f.toFixed(3)} рад`;
    v.label(ctx,tф,X,Y,mid(tф),Y>=0?-24:22,acc);

    /* ---- РАЗВЁРТКА. Тень точки по вертикали, отложенная вправо по мере
       поворота, рисует синусоиду. Это переход от «синус — сторона
       треугольника» к «синус — функция времени», с которого начинается
       описание любых колебаний. */
    if(p.mode==='unwrap'){
      const X0=R+1.3, L=7.0;                      // где и насколько широко разворачиваем
      const к=1.15;                               // единиц сцены на один радиан
      const окно=L/к;                             // сколько радиан помещается
      /* Окно едет за точкой: пока углов мало, кривая растёт слева направо, а
         дальше начинает прокручиваться. Подписи делений показывают НАСТОЯЩИЙ
         угол, а не расстояние от начала кривой — иначе ось врала бы. */
      const φ0=Math.max(0,f-окно);
      const x=φ=>X0+(φ-φ0)*к;

      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(X0,0); ctx.lineTo(X0+L,0); ctx.stroke();
      ctx.globalAlpha=1;
      for(let k=Math.ceil(φ0);k<=f;k++){
        ctx.beginPath(); ctx.moveTo(x(k),-0.1); ctx.lineTo(x(k),0.1); ctx.stroke();
        v.label(ctx,`${k}`,x(k),0,-3,16,ink3);
      }
      v.label(ctx,'угол φ, рад',X0+L*0.5,0,-42,30,ink3);

      // сама синусоида на видимом участке
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(2.4);
      ctx.beginPath();
      for(let i=0;i<=300;i++){
        const φ=φ0+(f-φ0)*i/300;
        i?ctx.lineTo(x(φ),R*Math.sin(φ)):ctx.moveTo(x(φ),R*Math.sin(φ));
      }
      ctx.stroke();
      // связь: горизонтальный пунктир от точки на круге к концу синусоиды
      ctx.strokeStyle=sec; ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1.2);
      ctx.setLineDash([v.lw(4),v.lw(4)]);
      ctx.beginPath(); ctx.moveTo(X,Y); ctx.lineTo(x(f),Y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      ctx.fillStyle=sec; ctx.beginPath(); ctx.arc(x(f),Y,v.lw(4),0,7); ctx.fill();
      const t='высота точки = sin φ';
      v.label(ctx,t,x(f),Y,mid(t),Y>=0?-16:18,sec);
    }

    /* ---- МАЛЫЕ УГЛЫ. Дуга (это θ), её хорда и высота (это sin θ) при малом
       угле почти совпадают. Показываем обе величины рядом с увеличением. */
    if(p.mode==='small'){
      const θ=Math.abs(f);
      const ошибка=θ>1e-12?100*(θ-Math.abs(sn))/θ:0;
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(3.4);
      ctx.beginPath(); ctx.moveTo(X,0); ctx.lineTo(X,Y); ctx.stroke();
      const t1=`θ (дуга) = ${θ.toFixed(4)}`;
      const t2=`sin θ (высота) = ${Math.abs(sn).toFixed(4)}`;
      /* Порог не один, а два: до процента приближением пользуются молча,
         до пяти — с оговоркой «оценка», дальше оно просто врёт. */
      const вывод = ошибка<1 ? ' — приближение годится' :
                    ошибка<5 ? ' — годится только для грубой оценки' : ' — так уже нельзя';
      const t3=`разница ${ошибка.toFixed(2)} %${вывод}`;
      v.label(ctx,t1,0,-R-1.0,mid(t1),0,acc);
      v.label(ctx,t2,0,-R-1.0,mid(t2),16,sec);
      v.label(ctx,t3,0,-R-1.0,mid(t3),32,ошибка<1?v.c('--ok'):ошибка<5?meas:dang);
    }

    // ---- подпись режима внизу
    const подпись = p.mode==='unwrap' ? 'поворот по кругу → синусоида: это одно и то же движение'
      : p.mode==='small' ? 'при малом угле дуга и её высота почти совпадают'
      : 'точка на окружности радиуса 1: её координаты — это cos φ и sin φ';
    v.label(ctx,подпись,0,-R-1.9,mid(подпись),0,ink3);
  }
}

});
